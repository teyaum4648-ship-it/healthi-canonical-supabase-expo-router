export type LookupIdentity = {
  barcode: string;
  canonicalBarcode: string | null;
  productName: string;
  brand: string | null;
  variant: string | null;
  size: string | null;
  market: string | null;
  country: string | null;
  lotNumber: string | null;
  productionDate: string | null;
  categoryKeys: string[];
};

export function normalized(value: string | null | undefined): string {
  return (value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function hasValidGtinChecksum(value: string): boolean {
  const barcode = value.replace(/\D/g, '');
  if (!/^\d{8}$|^\d{12,14}$/.test(barcode)) return false;
  const digits = [...barcode].map(Number);
  const check = digits.pop() as number;
  const sum = digits.reverse().reduce((total, digit, index) => total + digit * (index % 2 === 0 ? 3 : 1), 0);
  return (10 - sum % 10) % 10 === check;
}

export function exactOptional(left: string | null | undefined, right: string | null | undefined): boolean {
  return !left || !right || normalized(left) === normalized(right);
}

export function identityDetailsMatch(request: LookupIdentity, registry: Record<string, unknown>): boolean {
  if (!exactOptional(request.variant, registry.variant_name as string | null)) return false;
  if (!exactOptional(request.size, registry.package_size as string | null)) return false;
  if (!exactOptional(request.market, registry.market as string | null)) return false;
  if (!exactOptional(request.country, registry.country as string | null)) return false;
  if (!request.productionDate) return true;
  const productionDate = Date.parse(request.productionDate);
  const from = typeof registry.formulation_valid_from === 'string' ? Date.parse(registry.formulation_valid_from) : Number.NEGATIVE_INFINITY;
  const until = typeof registry.formulation_valid_until === 'string' ? Date.parse(registry.formulation_valid_until) : Number.POSITIVE_INFINITY;
  return Number.isFinite(productionDate) && productionDate >= from && productionDate <= until;
}

export function validIdentity(value: unknown): value is LookupIdentity {
  if (!value || typeof value !== 'object') return false;
  const input = value as Partial<LookupIdentity>;
  return typeof input.barcode === 'string'
    && typeof input.productName === 'string'
    && Array.isArray(input.categoryKeys)
    && input.categoryKeys.every((item) => typeof item === 'string');
}

export function sourceIsUsable(source: Record<string, unknown>, now = Date.now()): boolean {
  if (!source.enabled || source.rights_status !== 'approved' || !source.allow_client_summary) return false;
  const from = typeof source.rights_valid_from === 'string' ? Date.parse(source.rights_valid_from) : Number.NEGATIVE_INFINITY;
  const until = typeof source.rights_valid_until === 'string' ? Date.parse(source.rights_valid_until) : Number.POSITIVE_INFINITY;
  return now >= from && now < until;
}

export function freshness(row: Record<string, unknown>, now = Date.now()): 'current' | 'aging' | 'expired' | 'revoked' | 'unknown' {
  if (typeof row.revoked_at === 'string' && Date.parse(row.revoked_at) <= now) return 'revoked';
  if (typeof row.expires_at === 'string' && Date.parse(row.expires_at) <= now) return 'expired';
  const published = typeof row.publication_date === 'string'
    ? Date.parse(row.publication_date)
    : typeof row.published_at === 'string' ? Date.parse(row.published_at) : NaN;
  if (!Number.isFinite(published)) return 'unknown';
  return now - published > 365 * 86_400_000 ? 'aging' : 'current';
}

export function baseResolution(identity: LookupIdentity, now = new Date().toISOString()) {
  return {
    schemaVersion: 2 as const,
    identity,
    confidence: 'high' as const,
    reasonCodes: [] as string[],
    sourcesChecked: [] as string[],
    resolvedAt: now,
    refreshAfter: new Date(Date.parse(now) + 24 * 60 * 60 * 1000).toISOString(),
    retryable: false,
    availabilityReason: null,
    labEvidence: [] as unknown[],
    certifications: [] as unknown[],
    regulatoryAlerts: [] as unknown[],
    relatedEvidence: [] as unknown[],
    categoryContext: [] as unknown[]
  };
}

export function statusFor(resolution: ReturnType<typeof baseResolution>) {
  const lab = resolution.labEvidence as Array<Record<string, unknown>>;
  const contexts = resolution.relatedEvidence as Array<Record<string, unknown>>;
  if (resolution.regulatoryAlerts.length) return 'regulatory_alert';
  if (lab.some((item) => item.matchLevel === 'exact_lot')) return 'exact_lot';
  if (lab.some((item) => item.sourceType === 'independent_lab_test')) return 'exact_product';
  if (lab.some((item) => item.sourceType === 'manufacturer_coa')) return 'manufacturer_coa';
  if (resolution.certifications.length) return 'current_certification';
  if (contexts.some((item) => item.scope === 'related_variant')) return 'related_variant';
  if (contexts.some((item) => item.scope === 'brand')) return 'brand_evidence';
  if (resolution.categoryContext.length) return 'category_context';
  return 'no_evidence';
}
