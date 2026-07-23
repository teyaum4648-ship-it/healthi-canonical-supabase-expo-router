import { canonicalBarcodeIdentity } from '../productLookup/barcodeUtils';
import type { HealthiProductSnapshot } from '../productLookup/productLookupTypes';
import { clientSafeResolution, createTerminalResolution, emptyLabEvidenceIdentity } from './resolution';
import type { LabEvidenceResolution } from './labEvidenceTypes';

type InvokeResult = { data: unknown; error: { message?: string } | null };
export type LabEvidenceFunctionClient = {
  functions: { invoke(name: string, options: { body: Record<string, unknown> }): Promise<InvokeResult> };
};

function identityFromProduct(product: HealthiProductSnapshot, lotNumber?: string | null) {
  return emptyLabEvidenceIdentity({
    barcode: product.barcode,
    canonicalBarcode: product.canonical_barcode ?? (canonicalBarcodeIdentity(product.barcode) || null),
    productName: product.name,
    brand: product.brand ?? null,
    variant: product.variant ?? null,
    size: product.quantity ?? null,
    lotNumber: lotNumber ?? null,
    categoryKeys: [...(product.categories_tags ?? [])]
  });
}

function isResolution(value: unknown): value is LabEvidenceResolution {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<LabEvidenceResolution>;
  return candidate.schemaVersion === 2
    && typeof candidate.status === 'string'
    && Array.isArray(candidate.labEvidence)
    && Array.isArray(candidate.certifications)
    && Array.isArray(candidate.regulatoryAlerts)
    && Array.isArray(candidate.relatedEvidence)
    && Array.isArray(candidate.categoryContext);
}

export async function lookupLabEvidenceResolution(params: {
  client?: LabEvidenceFunctionClient | null;
  product: HealthiProductSnapshot;
  lotNumber?: string | null;
  configured: boolean;
}): Promise<LabEvidenceResolution> {
  const identity = identityFromProduct(params.product, params.lotNumber);
  if (!params.configured || !params.client) {
    return clientSafeResolution(createTerminalResolution({
      status: 'unavailable',
      identity,
      reasonCodes: ['lab_evidence_service_not_configured'],
      availabilityReason: 'not_configured',
      sourcesChecked: [],
      retryable: true
    }));
  }
  try {
    const { data, error } = await params.client.functions.invoke('lab-evidence-lookup', { body: { identity } });
    if (!error && isResolution(data)) return data;
    return clientSafeResolution(createTerminalResolution({
      status: 'unavailable',
      identity,
      reasonCodes: ['lab_evidence_service_temporarily_unavailable'],
      availabilityReason: 'temporarily_unavailable',
      sourcesChecked: [],
      retryable: true
    }));
  } catch {
    return clientSafeResolution(createTerminalResolution({
      status: 'unavailable',
      identity,
      reasonCodes: ['lab_evidence_service_temporarily_unavailable'],
      availabilityReason: 'temporarily_unavailable',
      sourcesChecked: [],
      retryable: true
    }));
  }
}

export function labEvidenceStatusCopy(resolution: LabEvidenceResolution): { title: string; detail: string } {
  const copies: Record<LabEvidenceResolution['status'], { title: string; detail: string }> = {
    exact_lot: { title: 'Exact lot evidence', detail: 'Evidence was matched to the entered lot and product identity.' },
    exact_product: { title: 'Exact product evidence', detail: 'Evidence was matched to this product; the tested lot may differ.' },
    manufacturer_coa: { title: 'Manufacturer-provided evidence', detail: 'A manufacturer certificate or report is available for this product.' },
    current_certification: { title: 'Current certification', detail: 'A current certification record is available. Certification is not a numeric lab result.' },
    regulatory_alert: { title: 'Regulatory status', detail: 'An official alert was conservatively matched to this product or lot.' },
    related_variant: { title: 'Related variant evidence', detail: 'Evidence exists for a related variant, not the scanned product.' },
    brand_evidence: { title: 'Brand-level evidence', detail: 'Evidence exists at brand scope and does not establish results for this product.' },
    category_context: { title: 'Evidence context', detail: 'Category context is available. It is not testing of the scanned product.' },
    no_evidence: { title: 'No evidence found', detail: 'No current matching evidence was found in the sources checked. This is not negative evidence.' },
    unavailable: { title: 'Evidence lookup unavailable', detail: 'Lab Evidence could not be checked right now. Product Quality is unaffected.' },
    identity_unresolved: { title: 'Product identity unresolved', detail: 'A reliable product identity is needed before evidence can be matched.' }
  };
  return copies[resolution.status];
}
