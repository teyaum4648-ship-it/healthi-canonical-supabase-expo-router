import type {
  InternalLabEvidenceResolution,
  LabEvidenceIdentity,
  LabEvidenceReferenceSnapshot,
  LabEvidenceResolution,
  LabEvidenceResolutionStatus
} from './labEvidenceTypes';

const coverageForStatus: Record<LabEvidenceResolutionStatus, InternalLabEvidenceResolution['coverageLevel']> = {
  identity_unresolved: 0,
  no_evidence: 1,
  category_context: 2,
  brand_evidence: 3,
  related_variant: 4,
  current_certification: 4,
  manufacturer_coa: 5,
  exact_product: 5,
  regulatory_alert: 5,
  exact_lot: 6,
  unavailable: 0
};

export function emptyLabEvidenceIdentity(input: Partial<LabEvidenceIdentity>): LabEvidenceIdentity {
  return {
    barcode: input.barcode ?? '',
    canonicalBarcode: input.canonicalBarcode ?? null,
    productName: input.productName ?? '',
    brand: input.brand ?? null,
    variant: input.variant ?? null,
    size: input.size ?? null,
    market: input.market ?? null,
    country: input.country ?? null,
    lotNumber: input.lotNumber ?? null,
    productionDate: input.productionDate ?? null,
    categoryKeys: input.categoryKeys ?? []
  };
}

export function createTerminalResolution(params: {
  status: LabEvidenceResolutionStatus;
  identity: LabEvidenceIdentity;
  resolvedAt?: string;
  reasonCodes?: string[];
  sourcesChecked?: string[];
  retryable?: boolean;
  availabilityReason?: LabEvidenceResolution['availabilityReason'];
  confidence?: LabEvidenceResolution['confidence'];
  refreshAfter?: string | null;
  labEvidence?: LabEvidenceResolution['labEvidence'];
  certifications?: LabEvidenceResolution['certifications'];
  regulatoryAlerts?: LabEvidenceResolution['regulatoryAlerts'];
  relatedEvidence?: LabEvidenceResolution['relatedEvidence'];
  categoryContext?: LabEvidenceResolution['categoryContext'];
}): InternalLabEvidenceResolution {
  return {
    schemaVersion: 2,
    status: params.status,
    coverageLevel: coverageForStatus[params.status],
    identity: params.identity,
    confidence: params.confidence ?? (params.status === 'identity_unresolved' || params.status === 'unavailable' ? 'low' : 'high'),
    reasonCodes: [...(params.reasonCodes ?? [])],
    sourcesChecked: [...(params.sourcesChecked ?? [])],
    resolvedAt: params.resolvedAt ?? new Date().toISOString(),
    refreshAfter: params.refreshAfter ?? null,
    retryable: params.retryable ?? params.status === 'unavailable',
    availabilityReason: params.availabilityReason ?? null,
    labEvidence: [...(params.labEvidence ?? [])],
    certifications: [...(params.certifications ?? [])],
    regulatoryAlerts: [...(params.regulatoryAlerts ?? [])],
    relatedEvidence: [...(params.relatedEvidence ?? [])],
    categoryContext: [...(params.categoryContext ?? [])]
  };
}

export function deriveResolutionStatus(resolution: Omit<InternalLabEvidenceResolution, 'status' | 'coverageLevel'>): LabEvidenceResolutionStatus {
  if (resolution.regulatoryAlerts.length) return 'regulatory_alert';
  if (resolution.labEvidence.some((item) => item.matchLevel === 'exact_lot')) return 'exact_lot';
  if (resolution.labEvidence.some((item) => item.sourceType === 'independent_lab_test')) return 'exact_product';
  if (resolution.labEvidence.some((item) => item.sourceType === 'manufacturer_coa')) return 'manufacturer_coa';
  if (resolution.certifications.length) return 'current_certification';
  if (resolution.relatedEvidence.some((item) => item.scope === 'related_variant')) return 'related_variant';
  if (resolution.relatedEvidence.some((item) => item.scope === 'brand')) return 'brand_evidence';
  if (resolution.categoryContext.length) return 'category_context';
  return 'no_evidence';
}

export function clientSafeResolution(resolution: InternalLabEvidenceResolution): LabEvidenceResolution {
  const { coverageLevel: _coverageLevel, ...safe } = resolution;
  return JSON.parse(JSON.stringify(safe)) as LabEvidenceResolution;
}

export function toLabEvidenceReferenceSnapshot(resolution: LabEvidenceResolution): LabEvidenceReferenceSnapshot {
  return {
    schemaVersion: 2,
    status: resolution.status,
    evidenceIds: resolution.labEvidence.map((item) => item.evidenceId),
    certificationIds: resolution.certifications.map((item) => item.certificationId),
    regulatoryAlertIds: resolution.regulatoryAlerts.map((item) => item.alertId),
    contextIds: [...resolution.relatedEvidence, ...resolution.categoryContext].map((item) => item.contextId),
    resolvedAt: resolution.resolvedAt,
    refreshAfter: resolution.refreshAfter
  };
}

export function shouldRefreshLabEvidence(reference: LabEvidenceReferenceSnapshot | null | undefined, now = Date.now()): boolean {
  if (!reference || reference.schemaVersion !== 2) return true;
  if (!reference.refreshAfter) return true;
  const refreshTime = Date.parse(reference.refreshAfter);
  return !Number.isFinite(refreshTime) || refreshTime <= now;
}
