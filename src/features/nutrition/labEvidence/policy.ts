import type { LabEvidenceFreshness, LabEvidenceSourceType } from './labEvidenceTypes';

export type EvidenceSourceRights = {
  enabled: boolean;
  rightsStatus: 'approved' | 'pending' | 'expired' | 'revoked';
  allowClientSummary: boolean;
  allowNumericResults: boolean;
  validFrom?: string | null;
  validUntil?: string | null;
};

export type EvidenceLifecycle = {
  publishedAt?: string | null;
  expiresAt?: string | null;
  revokedAt?: string | null;
};

export function sourceRightsDecision(rights: EvidenceSourceRights, now = Date.now()) {
  if (!rights.enabled) return { usable: false, reason: 'source_disabled' as const };
  if (rights.rightsStatus !== 'approved') {
    return { usable: false, reason: rights.rightsStatus === 'expired' ? 'rights_expired' as const : 'source_disabled' as const };
  }
  const from = rights.validFrom ? Date.parse(rights.validFrom) : Number.NEGATIVE_INFINITY;
  const until = rights.validUntil ? Date.parse(rights.validUntil) : Number.POSITIVE_INFINITY;
  if (now < from || now > until) return { usable: false, reason: 'rights_expired' as const };
  return { usable: true, reason: null };
}

export function evidenceFreshness(lifecycle: EvidenceLifecycle, now = Date.now(), agingDays = 365): LabEvidenceFreshness {
  if (lifecycle.revokedAt && Date.parse(lifecycle.revokedAt) <= now) return 'revoked';
  if (lifecycle.expiresAt && Date.parse(lifecycle.expiresAt) < now) return 'expired';
  if (!lifecycle.publishedAt || !Number.isFinite(Date.parse(lifecycle.publishedAt))) return 'unknown';
  return now - Date.parse(lifecycle.publishedAt) > agingDays * 86_400_000 ? 'aging' : 'current';
}

export function badgeEligible(params: {
  sourceType: LabEvidenceSourceType;
  matchLevel: string;
  freshness: LabEvidenceFreshness;
  rights: EvidenceSourceRights;
  now?: number;
}): boolean {
  return params.sourceType === 'independent_lab_test'
    && (params.matchLevel === 'exact_lot' || params.matchLevel === 'exact_product')
    && params.freshness === 'current'
    && sourceRightsDecision(params.rights, params.now).usable;
}
