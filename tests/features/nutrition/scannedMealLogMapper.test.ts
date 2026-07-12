import { describe, expect, it } from 'vitest';

import type { HealthiProductSnapshot } from '../../../src/features/nutrition/productLookup/productLookupTypes';
import {
  normalizeServingQuantity,
  scannedProductToMealLog
} from '../../../src/features/nutrition/scannedMealLogMapper';

const snapshot: HealthiProductSnapshot = {
  barcode: '012345678905',
  provider: 'open_food_facts',
  provider_product_id: '012345678905',
  name: 'Protein oats',
  brand: 'Healthi Test',
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

describe('scanned product meal log mapper', () => {
  it('scales all supported nutrients by serving quantity', () => {
    const meal = scannedProductToMealLog({
      snapshot,
      servingQuantity: 1.5,
      loggedAt: '2026-07-12T12:00:00.000Z',
      mealType: 'lunch'
    });

    expect(meal).toMatchObject({
      name: 'Protein oats',
      meal_type: 'lunch',
      calories: 330,
      protein_g: 21,
      carbs_g: 46.5,
      fat_g: 9,
      fiber_g: 7.5,
      sugar_g: 10.5,
      sodium_mg: 270,
      original_source_id: '012345678905'
    });
  });

  it('preserves barcode metadata and reason codes', () => {
    const meal = scannedProductToMealLog({ snapshot, servingQuantity: 1, loggedAt: '2026-07-12T12:00:00.000Z' });

    expect(meal.reason_codes).toEqual(expect.arrayContaining(['barcode_food_logged', 'product_label_data', 'fiber_supportive']));
    expect(meal.raw_source_payload).toEqual({
      barcode: '012345678905',
      provider: 'open_food_facts',
      provider_product_id: '012345678905',
      serving_quantity: 1,
      serving_size: '50 g'
    });
    expect(JSON.parse(JSON.stringify(meal))).toEqual(meal);
  });

  it('creates a safe sparse meal log when macros are missing', () => {
    const meal = scannedProductToMealLog({
      snapshot: {
        ...snapshot,
        calories_per_serving: null,
        protein_g: null,
        carbs_g: null,
        fat_g: null,
        confidence: 'low'
      },
      servingQuantity: 1,
      loggedAt: '2026-07-12T12:00:00.000Z'
    });

    expect(meal.calories).toBeNull();
    expect(meal.reason_codes).toEqual(expect.arrayContaining(['nutrition_calibrating', 'partial_nutrition_data']));
  });

  it('validates serving quantity without changing valid fractions', () => {
    expect(normalizeServingQuantity('1.5')).toBe(1.5);
    expect(normalizeServingQuantity('0')).toBeNull();
    expect(normalizeServingQuantity('many')).toBeNull();
    expect(normalizeServingQuantity('21')).toBeNull();
  });
});
