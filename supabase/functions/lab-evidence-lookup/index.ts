import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { authenticatedUser, serviceClient } from '../_shared/auth.ts';
import {
  baseResolution,
  freshness,
  hasValidGtinChecksum,
  identityDetailsMatch,
  normalized,
  sourceIsUsable,
  statusFor,
  validIdentity
} from '../_shared/labEvidence.ts';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405);
  if (!await authenticatedUser(request)) return jsonResponse({ error: 'unauthorized' }, 401);

  const body = await request.json().catch(() => null) as { identity?: unknown } | null;
  if (!validIdentity(body?.identity)) return jsonResponse({ error: 'invalid_identity' }, 400);
  const identity = body.identity;
  const resolution = baseResolution(identity);
  const inputGtin = identity.canonicalBarcode ?? identity.barcode;
  if (!identity.productName.trim() || !inputGtin.trim() || !hasValidGtinChecksum(inputGtin)) {
    return jsonResponse({ ...resolution, status: 'identity_unresolved', confidence: 'low', reasonCodes: ['reliable_product_identity_missing'] });
  }

  const client = serviceClient();
  const { data: flagRows } = await client.from('lab_evidence_feature_flags').select('flag_key, enabled');
  const flags = new Map((flagRows ?? []).map((flag) => [flag.flag_key as string, Boolean(flag.enabled)]));
  if (!flags.get('lab_evidence_lookup')) {
    return jsonResponse({
      ...resolution,
      status: 'unavailable',
      confidence: 'low',
      retryable: true,
      availabilityReason: 'source_disabled',
      refreshAfter: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      reasonCodes: ['lab_evidence_lookup_disabled']
    });
  }

  const { data: sourceRows, error: sourceError } = await client.from('lab_evidence_sources').select('*');
  if (sourceError) {
    return jsonResponse({
      ...resolution,
      status: 'unavailable',
      confidence: 'low',
      retryable: true,
      availabilityReason: 'temporarily_unavailable',
      reasonCodes: ['registry_unavailable']
    });
  }
  const sourceFeatureEnabled = (source: Record<string, unknown>) => {
    const sourceKey = String(source.source_key);
    const directFlag = flags.get(sourceKey);
    if (directFlag !== undefined) return directFlag;
    if (source.source_type === 'fda_regulatory') return flags.get('fda_regulatory_ingestion') === true;
    if (source.source_type === 'manufacturer') return flags.get('manufacturer_coa') === true;
    if (source.source_type === 'independent_lab') return flags.get('independent_labs') === true;
    if (source.source_type === 'licensed_provider') return flags.get('licensed_providers') === true;
    return true;
  };
  const sources = new Map(
    (sourceRows ?? []).filter((source) => {
      if (!sourceIsUsable(source) || !sourceFeatureEnabled(source)) return false;
      return source.source_type !== 'licensed_provider'
        || !source.allow_numeric_results
        || flags.get('licensed_numeric_evidence') === true;
    }).map((source) => [source.id as string, source])
  );
  resolution.sourcesChecked = [...sources.values()].map((source) => String(source.source_key));

  const gtin = inputGtin;
  const { data: directIdentity } = await client
    .from('lab_product_identities')
    .select('*')
    .eq('canonical_gtin', gtin)
    .eq('identity_status', 'reviewed')
    .maybeSingle();
  let productIdentity = directIdentity;
  if (!productIdentity) {
    const { data: aliases } = await client
      .from('lab_product_identity_aliases')
      .select('product_identity_id')
      .eq('alias_type', 'gtin')
      .eq('alias_value', gtin)
      .limit(2);
    const alias = aliases?.length === 1 ? aliases[0] : null;
    if (alias?.product_identity_id) {
      const { data } = await client
        .from('lab_product_identities')
        .select('*')
        .eq('id', alias.product_identity_id)
        .eq('identity_status', 'reviewed')
        .maybeSingle();
      productIdentity = data;
    }
  }
  if (productIdentity && !identityDetailsMatch(identity, productIdentity)) productIdentity = null;

  if (productIdentity) {
    const { data: records } = await client
      .from('lab_evidence_records')
      .select('*, lab_analyte_results(*, lab_analytes(analyte_key, display_name))')
      .eq('product_identity_id', productIdentity.id)
      .eq('review_status', 'approved');
    resolution.labEvidence = (records ?? []).flatMap((record) => {
      const source = sources.get(record.source_id);
      const currentFreshness = freshness(record);
      if (!source || currentFreshness === 'expired' || currentFreshness === 'revoked') return [];
      const lotExact = Boolean(identity.lotNumber && record.lot_number && normalized(identity.lotNumber) === normalized(record.lot_number));
      const matchLevel = lotExact ? 'exact_lot' : identity.lotNumber && record.lot_number ? 'exact_product_different_lot' : 'exact_product';
      const allowNumeric = Boolean(source.allow_numeric_results);
      return [{
        evidenceId: record.id,
        sourceName: source.display_name,
        sourceType: record.record_type,
        provenance: record.record_type === 'manufacturer_coa' ? 'manufacturer_provided' : 'independent',
        matchLevel,
        matchReason: lotExact ? 'Canonical product identity and lot match.' : 'Canonical product identity match; lot is not confirmed.',
        sampleDate: record.sample_date,
        publicationDate: record.publication_date,
        freshness: currentFreshness,
        laboratory: record.laboratory_name,
        laboratoryAccreditation: record.laboratory_accreditation,
        testingMethod: record.testing_method,
        sampleAcquisition: record.sample_acquisition,
        analytes: allowNumeric ? (record.lab_analyte_results ?? []).map((result: Record<string, unknown>) => {
          const analyte = result.lab_analytes as Record<string, unknown> | null;
          return {
            analyte: String(analyte?.display_name ?? 'Reported analyte'),
            canonicalAnalyteId: String(analyte?.analyte_key ?? 'other'),
            measuredValue: result.measured_value,
            unit: result.unit,
            reportingLimit: result.reporting_limit,
            status: result.result_status,
            comparisonThreshold: result.comparison_threshold,
            thresholdUnit: result.threshold_unit,
            thresholdAuthority: result.threshold_authority,
            note: result.note
          };
        }) : [],
        confidence: 'high'
      }];
    });

    const { data: certifications } = await client
      .from('lab_certifications')
      .select('*')
      .eq('product_identity_id', productIdentity.id)
      .eq('review_status', 'approved');
    resolution.certifications = (certifications ?? []).flatMap((certification) => {
      const source = sources.get(certification.source_id);
      const expired = certification.valid_until && Date.parse(certification.valid_until) < Date.now();
      if (!source || certification.revoked_at || expired) return [];
      return [{
        certificationId: certification.id,
        certificationName: certification.certification_name,
        certifyingBody: certification.certifying_body,
        scope: certification.scope,
        matchReason: certification.scope === 'product' ? 'Certification is scoped to this product identity.' : `Certification scope: ${certification.scope}.`,
        validFrom: certification.valid_from,
        validUntil: certification.valid_until,
        freshness: 'current',
        confidence: certification.scope === 'product' ? 'high' : 'medium'
      }];
    });

    const { data: alerts } = await client
      .from('lab_regulatory_alerts')
      .select('*')
      .eq('product_identity_id', productIdentity.id)
      .in('match_status', ['approved_exact_lot', 'approved_exact_product', 'approved_related']);
    resolution.regulatoryAlerts = (alerts ?? []).flatMap((alert) => {
      const source = sources.get(alert.source_id);
      if (!source) return [];
      const matchLevel = alert.match_status === 'approved_exact_lot'
        ? 'exact_lot' : alert.match_status === 'approved_exact_product' ? 'exact_product' : 'related_variant';
      if (matchLevel === 'exact_lot' && (!identity.lotNumber || normalized(identity.lotNumber) !== normalized(alert.lot_number))) return [];
      return [{
        alertId: alert.id,
        authority: alert.authority,
        title: alert.title,
        status: alert.alert_status,
        matchLevel,
        matchReason: (alert.match_reason_codes ?? []).join(', ') || 'Reviewer-approved conservative identity match.',
        publishedAt: alert.published_at,
        sourceUrl: alert.source_url,
        confidence: matchLevel === 'related_variant' ? 'medium' : 'high'
      }];
    });

    const { data: related } = await client
      .from('lab_evidence_contexts')
      .select('*')
      .eq('product_identity_id', productIdentity.id)
      .eq('review_status', 'approved');
    resolution.relatedEvidence = (related ?? []).flatMap((context) => {
      const source = sources.get(context.source_id);
      const currentFreshness = freshness(context);
      if (!source || currentFreshness === 'expired' || currentFreshness === 'revoked') return [];
      return [{
        contextId: context.id,
        title: context.title,
        sourceName: source.display_name,
        scope: context.scope,
        matchReason: `Reviewed ${context.scope.replace('_', ' ')} context; not testing of this product.`,
        summary: context.safe_summary,
        publicationDate: context.publication_date,
        confidence: 'medium'
      }];
    });
  }

  if (identity.categoryKeys.length) {
    const { data: contexts } = await client
      .from('lab_evidence_contexts')
      .select('*')
      .in('category_key', identity.categoryKeys)
      .eq('scope', 'category')
      .eq('review_status', 'approved');
    resolution.categoryContext = (contexts ?? []).flatMap((context) => {
      const source = sources.get(context.source_id);
      const currentFreshness = freshness(context);
      if (!source || currentFreshness === 'expired' || currentFreshness === 'revoked') return [];
      return [{
        contextId: context.id,
        title: context.title,
        sourceName: source.display_name,
        scope: 'category',
        matchReason: 'Category context only; not testing of the scanned product.',
        summary: context.safe_summary,
        publicationDate: context.publication_date,
        confidence: 'medium'
      }];
    });
  }

  const status = statusFor(resolution);
  resolution.reasonCodes.push(status === 'no_evidence' ? 'no_current_matching_evidence' : `coverage_${status}`);
  await client.rpc('record_lab_coverage_metric', { candidate_status: status });
  return jsonResponse({ ...resolution, status });
});
