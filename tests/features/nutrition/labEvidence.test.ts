import { describe, expect, it } from 'vitest';

import { calculateProductQuality } from '../../../src/features/nutrition/productLookup/productQuality';
import type { HealthiProductSnapshot } from '../../../src/features/nutrition/productLookup/productLookupTypes';
import { formatLabAnalyte, matchLabEvidence, visibleLabAnalytes } from '../../../src/features/nutrition/labEvidence/labEvidenceMatcher';
import { normalizeLabEvidenceRecord, unavailableLabEvidenceProvider } from '../../../src/features/nutrition/labEvidence/labEvidenceProvider';
import type { LabEvidenceRecord } from '../../../src/features/nutrition/labEvidence/labEvidenceTypes';

const product: HealthiProductSnapshot = {
  barcode: '123456789012', canonical_barcode: '123456789012', provider: 'open_food_facts', provider_product_id: 'provider-1',
  name: 'Cocoa nut bar', brand: 'Fixture Foods', variant: 'Cocoa', serving_size: '50 g', serving_quantity_g: 50,
  calories_per_serving: 200, protein_g: 12, carbs_g: 22, fat_g: 8, fiber_g: 4, sugar_g: 12, sodium_mg: 180,
  ingredients_text: 'dates, egg whites, almonds, cocoa, sea salt', categories_tags: ['protein bars'],
  ingredient_evidence: {
    resolved_text: 'dates, egg whites, almonds, cocoa, sea salt', raw_text: 'dates, egg whites, almonds, cocoa, sea salt',
    source_field: 'ingredients_text', language: 'en', structured_ingredients: [], status: 'complete', confidence: 'high', reconstructed: false, conflicts: []
  },
  evidence_confidence: {
    identity: 'high', ingredients: 'high', nutrition: 'high', serving: 'high', category: 'high', product_form: 'high', provider: 'medium', overall: 'high'
  },
  quality_flags: [], confidence: 'high', reason_codes: ['product_label_data']
};

function record(overrides: Partial<LabEvidenceRecord> = {}): LabEvidenceRecord {
  return {
    id: 'lab-1', productCode: '0123456789012', productName: 'Cocoa nut bar', brand: 'Fixture Foods', variant: 'Cocoa',
    sourceName: 'Independent fixture laboratory', sourceType: 'independent_lab_test', laboratory: 'Fixture Analytical',
    testingMethod: 'Validated fixture method', sampleDate: '2026-06-01', publicationDate: '2026-06-15',
    matchLevel: 'exact_product', sampleAcquisition: 'retail_purchased', evidenceConfidence: 'high',
    analytes: [{ analyte: 'Lead', measuredValue: 4, unit: 'ppb', status: 'detected' }], ...overrides
  };
}

describe('Lab Evidence boundary', () => {
  it('ranks exact-lot evidence strongest and permits a badge only for exact independent testing', () => {
    const matches = matchLabEvidence(product, [
      record({ id: 'related', productCode: undefined, matchLevel: 'related_variant' }),
      record({ id: 'product', matchLevel: 'exact_product' }),
      record({ id: 'lot', lotNumber: 'LOT-1', matchLevel: 'exact_lot' })
    ]);
    expect(matches.map((item) => item.record.id)).toEqual(['lot', 'product', 'related']);
    expect(matches[0]).toMatchObject({ badgeEligible: true, matchLabel: 'Exact lot' });
    expect(matches[2]).toMatchObject({ badgeEligible: false, matchLabel: 'Related variant' });
  });

  it('does not present brand or category evidence as exact-product testing', () => {
    const matches = matchLabEvidence(product, [
      record({ id: 'brand', productCode: undefined, matchLevel: 'brand_only' }),
      record({ id: 'category', productCode: undefined, matchLevel: 'category_only' })
    ]);
    expect(matches.map((item) => ({ badge: item.badgeEligible, label: item.matchLabel }))).toEqual([
      { badge: false, label: 'Brand-level evidence' },
      { badge: false, label: 'Category background' }
    ]);
  });

  it('keeps manufacturer-provided evidence distinguishable from independent retail testing', () => {
    const coa = matchLabEvidence(product, [record({ sourceType: 'manufacturer_coa', sampleAcquisition: 'manufacturer_submitted' })])[0]!;
    const independent = matchLabEvidence(product, [record()])[0]!;
    expect(coa.badgeEligible).toBe(false);
    expect(coa.record).toMatchObject({ sourceType: 'manufacturer_coa', sampleAcquisition: 'manufacturer_submitted' });
    expect(independent.record).toMatchObject({ sourceType: 'independent_lab_test', sampleAcquisition: 'retail_purchased' });
  });

  it('preserves reporting limits and avoids unsupported absence claims', () => {
    const analyte = { analyte: 'Arsenic', reportingLimit: 4, unit: 'ppb', status: 'below_reporting_limit' as const };
    expect(formatLabAnalyte(analyte)).toBe('Below reporting limit: <4 ppb');
    expect(formatLabAnalyte(analyte).toLowerCase()).not.toMatch(/not detected|free|safe/);
  });

  it('shows microplastics only for actual product-specific evidence', () => {
    const analytes = [
      { analyte: 'Lead', measuredValue: 4, unit: 'ppb', status: 'detected' as const },
      { analyte: 'Microplastics', measuredValue: 2, unit: 'particles/g', status: 'detected' as const }
    ];
    expect(visibleLabAnalytes(record({ matchLevel: 'category_only', analytes })).map((item) => item.analyte)).toEqual(['Lead']);
    expect(visibleLabAnalytes(record({ matchLevel: 'exact_product', analytes })).map((item) => item.analyte)).toEqual(['Lead', 'Microplastics']);
  });

  it('does not alter Product Quality when Lab Evidence is present or absent', () => {
    const withoutEvidence = calculateProductQuality(product);
    const withEvidence = calculateProductQuality({ ...product, lab_evidence: [record()] });
    expect(withEvidence).toEqual(withoutEvidence);
  });

  it('retains dates and normalizes serializable fixture records', () => {
    const normalized = normalizeLabEvidenceRecord(record({ productName: ' Cocoa nut bar ', brand: ' Fixture Foods ' }));
    expect(normalized).toMatchObject({ productName: 'Cocoa nut bar', brand: 'Fixture Foods', sampleDate: '2026-06-01', publicationDate: '2026-06-15' });
    expect(JSON.parse(JSON.stringify(normalized))).toEqual(normalized);
  });

  it('keeps production Lab Evidence explicitly unavailable without an approved source', async () => {
    await expect(unavailableLabEvidenceProvider.lookup({ barcode: product.barcode, productName: product.name, brand: product.brand!, variant: product.variant! }))
      .resolves.toEqual({ status: 'unavailable', records: [], reason: 'not_configured' });
  });

  it('contains no unsupported safety language in normalized evidence output', () => {
    const output = JSON.stringify(record()).toLowerCase();
    expect(output).not.toMatch(/contaminant free|toxin free|zero contaminants|guaranteed safe|dangerous|likely microplastics|harmful ingredients/);
  });
});
