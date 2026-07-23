import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { isServiceRequest, serviceClient } from '../_shared/auth.ts';

type FdaResult = {
  recall_number?: string;
  reason_for_recall?: string;
  status?: string;
  recall_initiation_date?: string;
  product_description?: string;
  code_info?: string;
  recalling_firm?: string;
  distribution_pattern?: string;
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405);
  if (!isServiceRequest(request)) return jsonResponse({ error: 'forbidden' }, 403);

  const client = serviceClient();
  const [{ data: flag }, { data: source }] = await Promise.all([
    client.from('lab_evidence_feature_flags').select('enabled').eq('flag_key', 'fda_regulatory_ingestion').maybeSingle(),
    client.from('lab_evidence_sources').select('*').eq('source_key', 'fda_regulatory').maybeSingle()
  ]);
  if (!flag?.enabled || !source?.enabled || source.rights_status !== 'approved') {
    return jsonResponse({ status: 'disabled', ingested: 0 });
  }

  const body = await request.json().catch(() => ({})) as { skip?: number };
  const skip = Number.isInteger(body.skip) && Number(body.skip) >= 0 ? Number(body.skip) : 0;
  const run = await client.from('lab_ingestion_runs').insert({
    source_id: source.id,
    run_type: 'fda_food_enforcement_incremental',
    status: 'started',
    cursor_value: String(skip)
  }).select('id').single();
  if (!run.data) return jsonResponse({ error: 'run_start_failed' }, 500);

  try {
    const response = await fetch(`https://api.fda.gov/food/enforcement.json?limit=100&skip=${skip}`, {
      headers: { 'User-Agent': 'Healthi-Lab-Evidence/1.0' }
    });
    if (!response.ok) throw new Error(`FDA ${response.status}`);
    const payload = await response.json() as { results?: FdaResult[] };
    const results = payload.results ?? [];
    let created = 0;
    for (const result of results) {
      if (!result.recall_number || !result.product_description) continue;
      const { error } = await client.from('lab_regulatory_alerts').upsert({
        source_id: source.id,
        authority: 'U.S. Food and Drug Administration',
        external_alert_id: result.recall_number,
        title: result.product_description.slice(0, 500),
        alert_status: result.status?.toLowerCase() === 'ongoing' ? 'active' : result.status?.toLowerCase() === 'terminated' ? 'resolved' : 'unknown',
        published_at: result.recall_initiation_date
          ? `${result.recall_initiation_date.slice(0, 4)}-${result.recall_initiation_date.slice(4, 6)}-${result.recall_initiation_date.slice(6, 8)}T00:00:00Z`
          : null,
        source_url: `https://www.accessdata.fda.gov/scripts/ires/?Product=${encodeURIComponent(result.recall_number)}`,
        match_status: 'pending_review',
        match_reason_codes: ['official_structured_fda_record', 'product_identity_requires_review']
      }, { onConflict: 'source_id,external_alert_id' });
      if (!error) created += 1;
    }
    await client.from('lab_ingestion_runs').update({
      status: 'completed',
      records_seen: results.length,
      records_created: created,
      records_withheld: results.length,
      cursor_value: String(skip + results.length),
      completed_at: new Date().toISOString()
    }).eq('id', run.data.id);
    return jsonResponse({ status: 'completed', seen: results.length, ingested: created, nextSkip: skip + results.length });
  } catch (error) {
    await client.from('lab_ingestion_runs').update({
      status: 'failed',
      error_summary: error instanceof Error ? error.message.slice(0, 500) : 'unknown_error',
      completed_at: new Date().toISOString()
    }).eq('id', run.data.id);
    return jsonResponse({ error: 'fda_sync_failed' }, 502);
  }
});
