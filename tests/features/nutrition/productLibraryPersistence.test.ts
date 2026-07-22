import { describe, expect, it } from 'vitest';

import { calculateProductQuality } from '../../../src/features/nutrition/productLookup/productQuality';
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
      better_options: quality.better_options
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
      provider_updated_at: '2026-07-20T12:00:00.000Z'
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
      evidence_confidence: { ingredients: 'high', serving: 'high' }
    });
    expect(inserted.quality_snapshot).toMatchObject({ nutrient_basis: quality.nutrient_basis });
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
      provider_updated_at: '2026-07-20T12:00:00.000Z'
    };
    const completeInsert = toUserFoodProductInsert({ ...completeSnapshot, quality: calculateProductQuality(completeSnapshot) }, 'user-1');
    const completeRow = { ...completeInsert, id: 'row-2', created_at: row.created_at, updated_at: row.updated_at };
    expect(shouldRefreshCachedProduct(completeRow, new Date('2026-07-21T12:00:00.000Z').getTime())).toBe(false);
    expect(shouldRefreshCachedProduct(completeRow, new Date('2026-08-01T12:00:00.000Z').getTime())).toBe(true);
  });
});
