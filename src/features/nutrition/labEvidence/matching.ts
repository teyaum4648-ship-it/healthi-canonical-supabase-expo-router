import { canonicalGtin } from '../productLookup/barcodeUtils';
import type { LabEvidenceMatchLevel } from './labEvidenceTypes';

export type MatchIdentity = {
  barcode?: string | null;
  productName?: string | null;
  brand?: string | null;
  variant?: string | null;
  size?: string | null;
  market?: string | null;
  country?: string | null;
  lotNumber?: string | null;
  productionDate?: string | null;
  formulationStart?: string | null;
  formulationEnd?: string | null;
};

export type DeterministicMatch = {
  level: LabEvidenceMatchLevel | null;
  confidence: 'high' | 'medium' | 'low';
  reasonCodes: string[];
};

function text(value: string | null | undefined): string {
  return (value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function exactOptional(left: string | null | undefined, right: string | null | undefined): boolean {
  return !left || !right || text(left) === text(right);
}

function withinFormulationDate(identity: MatchIdentity, evidence: MatchIdentity): boolean {
  if (!identity.productionDate) return true;
  const date = Date.parse(identity.productionDate);
  if (!Number.isFinite(date)) return false;
  const start = evidence.formulationStart ? Date.parse(evidence.formulationStart) : Number.NEGATIVE_INFINITY;
  const end = evidence.formulationEnd ? Date.parse(evidence.formulationEnd) : Number.POSITIVE_INFINITY;
  return date >= start && date <= end;
}

export function deterministicEvidenceMatch(identity: MatchIdentity, evidence: MatchIdentity): DeterministicMatch {
  const productBarcode = canonicalGtin(identity.barcode ?? '');
  const evidenceBarcode = canonicalGtin(evidence.barcode ?? '');
  if ((identity.barcode && !productBarcode) || (evidence.barcode && !evidenceBarcode)) {
    return { level: null, confidence: 'low', reasonCodes: ['invalid_gtin_checksum'] };
  }
  if (productBarcode && evidenceBarcode && productBarcode !== evidenceBarcode) {
    return { level: null, confidence: 'low', reasonCodes: ['barcode_mismatch'] };
  }
  const barcodeExact = Boolean(productBarcode && evidenceBarcode && productBarcode === evidenceBarcode);
  const nameExact = Boolean(text(identity.productName) && text(identity.productName) === text(evidence.productName));
  const brandExact = Boolean(text(identity.brand) && text(identity.brand) === text(evidence.brand));
  if (!barcodeExact && !(nameExact && brandExact)) {
    return brandExact
      ? { level: 'brand_only', confidence: 'medium', reasonCodes: ['brand_exact_product_unresolved'] }
      : { level: null, confidence: 'low', reasonCodes: ['identity_mismatch'] };
  }
  if (!exactOptional(identity.variant, evidence.variant)) {
    return { level: 'related_variant', confidence: 'medium', reasonCodes: ['product_identity_exact_variant_differs'] };
  }
  if (!exactOptional(identity.size, evidence.size) || !exactOptional(identity.market, evidence.market) || !exactOptional(identity.country, evidence.country)) {
    return { level: 'related_variant', confidence: 'medium', reasonCodes: ['product_identity_exact_pack_or_market_differs'] };
  }
  if (!withinFormulationDate(identity, evidence)) {
    return { level: 'related_variant', confidence: 'medium', reasonCodes: ['formulation_date_outside_evidence_window'] };
  }
  if (identity.lotNumber && evidence.lotNumber) {
    return text(identity.lotNumber) === text(evidence.lotNumber)
      ? { level: 'exact_lot', confidence: 'high', reasonCodes: ['barcode_and_lot_exact'] }
      : { level: 'exact_product_different_lot', confidence: 'high', reasonCodes: ['product_exact_lot_differs'] };
  }
  return {
    level: 'exact_product',
    confidence: barcodeExact ? 'high' : 'medium',
    reasonCodes: [barcodeExact ? 'canonical_barcode_exact' : 'brand_and_product_name_exact']
  };
}
