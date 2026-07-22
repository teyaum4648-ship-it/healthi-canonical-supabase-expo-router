import type { HealthiProductSnapshot } from '../productLookup/productLookupTypes';
import { canonicalBarcodeIdentity } from '../productLookup/barcodeUtils';
import type { LabAnalyteResult, LabEvidenceMatchLevel, LabEvidenceRecord } from './labEvidenceTypes';

export type MatchedLabEvidence = {
  record: LabEvidenceRecord;
  badgeEligible: boolean;
  matchLabel: string;
  matchStrength: number;
};

const strength: Record<LabEvidenceMatchLevel, number> = {
  exact_lot: 6,
  exact_product: 5,
  exact_product_different_lot: 4,
  related_variant: 3,
  brand_only: 2,
  category_only: 1
};

export function isExactProductLabMatch(level: LabEvidenceMatchLevel): boolean {
  return level === 'exact_lot' || level === 'exact_product' || level === 'exact_product_different_lot';
}

export function labMatchLabel(level: LabEvidenceMatchLevel): string {
  if (level === 'exact_lot') return 'Exact lot';
  if (level === 'exact_product') return 'Exact product';
  if (level === 'exact_product_different_lot') return 'Exact product · different lot';
  if (level === 'related_variant') return 'Related variant';
  if (level === 'brand_only') return 'Brand-level evidence';
  return 'Category background';
}

function normalized(value: string | null | undefined): string {
  return (value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function matchLabEvidence(product: HealthiProductSnapshot, records: LabEvidenceRecord[]): MatchedLabEvidence[] {
  return records.flatMap((record) => {
    if (record.productCode && canonicalBarcodeIdentity(record.productCode) !== canonicalBarcodeIdentity(product.barcode)) return [];
    if (isExactProductLabMatch(record.matchLevel)) {
      if (normalized(record.productName) !== normalized(product.name)) return [];
      if (product.brand && normalized(record.brand) !== normalized(product.brand)) return [];
      if (record.variant && product.variant && normalized(record.variant) !== normalized(product.variant)) return [];
    }
    return [{
      record,
      badgeEligible: isExactProductLabMatch(record.matchLevel) && record.sourceType === 'independent_lab_test',
      matchLabel: labMatchLabel(record.matchLevel),
      matchStrength: strength[record.matchLevel]
    }];
  }).sort((left, right) => right.matchStrength - left.matchStrength);
}

export function visibleLabAnalytes(record: LabEvidenceRecord): LabAnalyteResult[] {
  return record.analytes.filter((analyte) => {
    const microplastic = /microplastics?/i.test(analyte.analyte);
    return !microplastic || isExactProductLabMatch(record.matchLevel);
  });
}

export function formatLabAnalyte(result: LabAnalyteResult): string {
  const unit = result.unit ? ` ${result.unit}` : '';
  if (result.status === 'below_reporting_limit') {
    return typeof result.reportingLimit === 'number' ? `Below reporting limit: <${result.reportingLimit}${unit}` : 'Below reporting limit';
  }
  if (result.status === 'not_reported') return 'Not reported';
  const measurement = typeof result.measuredValue === 'number' ? `${result.measuredValue}${unit}` : 'Detected';
  return result.status === 'above_reference' ? `${measurement} · Above documented reference` : `${measurement} · Detected`;
}
