import { describe, expect, it } from 'vitest';

import { toMealLogItemInsert } from '../../../src/features/nutrition/mealItemPersistence';

describe('meal item persistence mapping', () => {
  it('maps detailed meal items with optional fields, source metadata, and reasons', () => {
    const payload = toMealLogItemInsert({
      meal_log_id: 'meal-1',
      food_product_id: 'product-1',
      logged_at: '2026-07-12T12:00:00.000Z',
      meal_type: 'lunch',
      name: 'Protein oats',
      brand: 'Test Foods',
      servings: 1.5,
      serving_size: '50 g',
      serving_quantity_g: 50,
      calories: 330,
      protein_g: 21,
      carbs_g: 46.5,
      fat_g: 9,
      fiber_g: 7.5,
      sodium_mg: 270,
      barcode: '012345678905',
      provider: 'open_food_facts',
      provider_product_id: 'provider-1',
      quality_label: 'supportive',
      quality_score: 82,
      quality_confidence: 'high',
      source: 'scanner',
      source_confidence: 'high',
      reason_codes: ['barcode_food_logged', 'product_label_data'],
      metadata: { builder_item_id: 'item-1' }
    }, 'user-1');

    expect(payload).toMatchObject({
      user_id: 'user-1',
      meal_log_id: 'meal-1',
      food_product_id: 'product-1',
      servings: 1.5,
      calories: 330,
      source: 'scanner',
      reason_codes: ['barcode_food_logged', 'product_label_data'],
      metadata: { builder_item_id: 'item-1' }
    });
    expect(JSON.parse(JSON.stringify(payload))).toEqual(payload);
  });

  it('keeps sparse food items safe and does not reject overlapping meals at mapping time', () => {
    const payload = toMealLogItemInsert({
      logged_at: '2026-07-12T12:00:00.000Z',
      meal_type: 'snack',
      name: 'Simple snack',
      servings: 1,
      source: 'manual'
    }, 'user-1');

    expect(payload.calories).toBeNull();
    expect(payload.food_product_id).toBeNull();
    expect(payload.reason_codes).toEqual(['manual_food_log']);
  });
});
