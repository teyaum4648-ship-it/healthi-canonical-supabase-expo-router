import { describe, expect, it } from 'vitest';

import { calculateProductQuality } from '../../../src/features/nutrition/productLookup/productQuality';
import { buildNutrientEvidenceLedger, nutrientObservation } from '../../../src/features/nutrition/productLookup/nutrientEvidence';
import { validateNutritionData } from '../../../src/features/nutrition/productLookup/nutritionValidation';
import type { HealthiProductSnapshot } from '../../../src/features/nutrition/productLookup/productLookupTypes';
import { shouldRefreshCachedProduct, toUserFoodProductInsert, toUserFoodProductUpdate } from '../../../src/features/nutrition/productLibraryPersistence';
import { userFoodProductRowToSnapshot } from '../../../src/features/nutrition/mealBuilder';

const snapshot: HealthiProductSnapshot = {
  barcode: '012345678905',
  provider: 'open_food_facts',
  provider_product_id: 'provider-1',
  name: 'Test oats',
  brand: 'Test Foods',
  serving_size: '50 g',
  serving_quantity_g: 50,
  calories_per_serving: 220,
  protein_g: 14,
  carbs_g: 31,
  fat_g: 6,
  saturated_fat_g: 1,
  fiber_g: 5,
  sugar_g: 7,
  sodium_mg: 180,
  ingredients_text: 'Oats, seeds, whey',
  quality_flags: ['balanced_meal'],
  confidence: 'high',
  reason_codes: ['product_label_data', 'fiber_supportive']
};

const validatedNutrition = validateNutritionData({
  source: 'open_food_facts',
  values: {
    calories: 220, protein_g: 14, carbs_g: 31, fat_g: 6, saturated_fat_g: 1,
    fiber_g: 5, sugar_g: 7, added_sugar_g: null, sodium_mg: 180, caffeine_mg: null
  },
  servingQuantity: 50,
  servingUnit: 'g',
  ingredientsText: 'Oats, seeds, whey',
  categoryAvailable: true,
  categories: ['protein bars']
});

const providerResolution: NonNullable<HealthiProductSnapshot['provider_resolution']> = {
  version: 'product_data_resolver_v3',
  requested_barcode: '123456789012',
  canonical_gtin: '123456789012',
  terminal_state: 'resolved',
  sources: [{ provider: 'open_food_facts', status: 'found', record_id: 'provider-1' }]
};

describe('product library persistence mapping', () => {
  it('maps a product snapshot while preserving barcode, provider, quality, and saved state', () => {
    const quality = calculateProductQuality(snapshot);
    const payload = toUserFoodProductInsert({
      ...snapshot,
      quality,
      is_saved: true,
      source: 'scanner',
      last_used_at: '2026-07-12T12:00:00.000Z',
      last_scanned_at: '2026-07-12T12:00:00.000Z'
    }, 'user-1');

    expect(payload).toMatchObject({
      user_id: 'user-1',
      barcode: '012345678905',
      provider: 'open_food_facts',
      provider_product_id: 'provider-1',
      name: 'Test oats',
      is_saved: true,
      source: 'scanner',
      quality_label: quality.label,
      quality_score: quality.score,
      quality_confidence: quality.confidence,
      quality_reason_codes: quality.reason_codes
    });
    expect(payload.quality_snapshot).toMatchObject({
      label: quality.label,
      summary: quality.summary,
      letter_grade: quality.letter_grade,
      grade_band: quality.grade_band,
      product_form: quality.product_form,
      nutrient_basis: quality.nutrient_basis,
      macro_context: quality.macro_context,
      source_confidence: quality.source_confidence,
      interpretation_confidence: quality.interpretation_confidence,
      evidence_refs: quality.evidence_refs,
      better_options: quality.better_options,
      dimension_aggregation: quality.dimension_aggregation,
      score_eligibility: quality.score_eligibility,
      generalized_fallback_used: quality.generalized_fallback_used
    });
    expect(payload.quality_snapshot).toMatchObject({ result_state: quality.result_state });
    expect(JSON.parse(JSON.stringify(payload))).toEqual(payload);
  });

  it('keeps optional update fields narrowly scoped and preserves nested quality data', () => {
    const quality = calculateProductQuality(snapshot);
    const update = toUserFoodProductUpdate({ is_saved: true, quality, last_used_at: '2026-07-12T12:00:00.000Z' });

    expect(update).toMatchObject({
      is_saved: true,
      quality_label: quality.label,
      quality_snapshot: { reason_codes: quality.reason_codes },
      last_used_at: '2026-07-12T12:00:00.000Z'
    });
    expect(update).not.toHaveProperty('user_id');
  });

  it('persists and hydrates backward-compatible product evidence fields', () => {
    const nutrientEvidence = buildNutrientEvidenceLedger([nutrientObservation({
      nutrient: 'protein_g', value: 14, unit: 'g', basis: 'per_serving', servingQuantity: 50, servingUnit: 'g',
      packageQuantity: 250, packageUnit: 'g', provider: 'open_food_facts', providerRecordId: 'provider-1',
      directlyReported: true, derivedFrom: [], conversionFormula: null, conversionConfidence: 'high', confidence: 'high',
      sourceTimestamp: '2026-07-20T12:00:00.000Z', rawField: 'proteins_serving', selectionReason: null
    })], { servingQuantity: 50, servingUnit: 'g' });
    const enriched: HealthiProductSnapshot = {
      ...snapshot,
      canonical_barcode: '123456789012',
      barcode: '0123456789012',
      categories_tags: ['protein bars'],
      labels: ['organic'],
      ingredient_evidence: {
        resolved_text: snapshot.ingredients_text!, raw_text: snapshot.ingredients_text!, source_field: 'ingredients_text_en',
        language: 'en',
        localized_texts: [
          { source_field: 'ingredients_text_en', language: 'en', text: snapshot.ingredients_text! },
          { source_field: 'ingredients_text_fr', language: 'fr', text: 'Avoine, graines, lactosérum' }
        ],
        structured_ingredients: [], status: 'complete', confidence: 'high', reconstructed: false, conflicts: []
      },
      evidence_confidence: {
        identity: 'high', ingredients: 'high', nutrition: 'high', serving: 'high', category: 'medium',
        product_form: 'medium', provider: 'medium', overall: 'high'
      },
      provider_updated_at: '2026-07-20T12:00:00.000Z',
      nutrient_evidence: nutrientEvidence,
      nutrition_validation: validatedNutrition,
      validation_issues: validatedNutrition.validationIssues,
      provider_resolution_trace: [{
        field: 'protein_g', candidates: [{ source: 'open_food_facts', value: 14, reliability: 'KNOWN' }],
        selectedSource: 'open_food_facts', selectedValue: 14, reason: 'Validated direct field.'
      }],
      product_identity_resolution: {
        confidence: 0.9, accepted: true,
        signals: { barcodeMatch: true, brandSimilarity: 1, productNameSimilarity: 1, packageSizeSimilarity: null, ingredientSimilarity: 1 }
      },
      provider_resolution: providerResolution,
      nutriments_per_100ml: { protein_g: 2 }
    };
    const quality = calculateProductQuality(enriched);
    const inserted = toUserFoodProductInsert({ ...enriched, quality }, 'user-1');
    const hydrated = userFoodProductRowToSnapshot({
      ...inserted, id: 'row-1', created_at: '2026-07-20T12:00:00.000Z', updated_at: '2026-07-20T12:00:00.000Z'
    });
    expect(inserted.barcode).toBe('123456789012');
    expect(hydrated).toMatchObject({
      canonical_barcode: '123456789012', categories_tags: ['protein bars'], labels: ['organic'],
      ingredient_evidence: {
        status: 'complete', source_field: 'ingredients_text_en', language: 'en',
        localized_texts: expect.arrayContaining([{ source_field: 'ingredients_text_fr', language: 'fr', text: 'Avoine, graines, lactosérum' }])
      },
      evidence_confidence: { ingredients: 'high', serving: 'high' },
      nutrient_evidence: { version: 'nutrient_evidence_v1', observations: [expect.objectContaining({ basis: 'per_serving', value: 14 })] },
      nutrition_validation: { version: 'nutrition_validation_v1' },
      provider_resolution_trace: [expect.objectContaining({ field: 'protein_g', selectedValue: 14 })],
      product_identity_resolution: { accepted: true, confidence: 0.9 },
      provider_resolution: { version: 'product_data_resolver_v3' },
      nutriments_per_100ml: { protein_g: 2 }
    });
    expect(inserted.quality_snapshot).toMatchObject({
      nutrient_basis: quality.nutrient_basis,
      grade_certainty: quality.grade_certainty,
      engine_version: 'product_quality_v5',
      review_trace: {
        engine_version: 'product_quality_v5',
        category_resolution: expect.any(Object),
        score_ledger: expect.any(Array),
        grade_certainty: quality.grade_certainty,
        dimension_aggregation: quality.dimension_aggregation,
        score_eligibility: quality.score_eligibility
      }
    });
  });

  it('refreshes partial or stale cache records while reusing recent complete evidence', () => {
    const quality = calculateProductQuality(snapshot);
    const base = toUserFoodProductInsert({ ...snapshot, quality }, 'user-1');
    const row = { ...base, id: 'row-1', created_at: '2026-07-20T12:00:00.000Z', updated_at: '2026-07-20T12:00:00.000Z' };
    expect(shouldRefreshCachedProduct(row, new Date('2026-07-21T12:00:00.000Z').getTime())).toBe(true);

    const completeSnapshot: HealthiProductSnapshot = {
      ...snapshot,
      ingredient_evidence: {
        resolved_text: snapshot.ingredients_text!, raw_text: snapshot.ingredients_text!, source_field: 'ingredients_text', language: 'en',
        structured_ingredients: [], status: 'complete', confidence: 'high', reconstructed: false, conflicts: []
      },
      provider_updated_at: '2026-07-20T12:00:00.000Z',
      nutrition_validation: validatedNutrition,
      provider_resolution: providerResolution
    };
    const completeInsert = toUserFoodProductInsert({ ...completeSnapshot, quality: calculateProductQuality(completeSnapshot) }, 'user-1');
    const completeRow = { ...completeInsert, id: 'row-2', created_at: row.created_at, updated_at: row.updated_at };
    expect(shouldRefreshCachedProduct(completeRow, new Date('2026-07-21T12:00:00.000Z').getTime())).toBe(false);
    expect(shouldRefreshCachedProduct({
      ...completeRow,
      quality_snapshot: { score: completeRow.quality_score, label: completeRow.quality_label }
    }, new Date('2026-07-21T12:00:00.000Z').getTime())).toBe(true);
    expect(shouldRefreshCachedProduct(completeRow, new Date('2026-08-01T12:00:00.000Z').getTime())).toBe(true);
  });
});
