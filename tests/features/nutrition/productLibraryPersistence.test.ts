import { describe, expect, it } from 'vitest';

import { calculateProductQuality } from '../../../src/features/nutrition/productLookup/productQuality';
import type { HealthiProductSnapshot } from '../../../src/features/nutrition/productLookup/productLookupTypes';
import { toUserFoodProductInsert, toUserFoodProductUpdate } from '../../../src/features/nutrition/productLibraryPersistence';

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
    expect(payload.quality_snapshot).toMatchObject({ label: quality.label, summary: quality.summary });
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
});
