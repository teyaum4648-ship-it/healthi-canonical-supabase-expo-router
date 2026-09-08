import { describe, expect, it } from 'vitest';

import { calculateNutrientSummary } from '../../../src/engines/nutrition';
import type { MealLog, NutritionTargets } from '../../../src/engines/nutrition';

const targets: NutritionTargets = {
  calories_target: 2200,
  protein_g_target: 150,
  carbs_g_target: 220,
  fat_g_target: 80,
  fiber_g_target: 30,
  sodium_mg_limit: 2300,
  confidence: 'medium',
  basis: ['onboarding']
};

function meal(overrides: Partial<MealLog> = {}): MealLog {
  return {
    logged_at: '2026-06-14T12:00:00.000Z',
    meal_type: 'lunch',
    name: 'Lunch bowl',
    source: 'manual',
    source_confidence: 'medium',
    calories: 600,
    protein_g: 40,
    carbs_g: 55,
    fat_g: 20,
    fiber_g: 8,
    sugar_g: 7,
    sodium_mg: 600,
    ingredients: ['rice', 'chicken'],
    quality_flags: [],
    user_response: null,
    reason_codes: [],
    created_at: '2026-06-14T12:01:00.000Z',
    ...overrides
  };
}

describe('calculateNutrientSummary', () => {
  it('sums calories, protein, carbs, fat, fiber, sugar, and sodium', () => {
    const result = calculateNutrientSummary({
      date: '2026-06-14',
      meals: [
        meal(),
        meal({
          calories: 400,
          protein_g: 20,
          carbs_g: 45,
          fat_g: 10,
          fiber_g: 5,
          sugar_g: 6,
          sodium_mg: 350
        })
      ],
      targets
    });

    expect(result.meal_count).toBe(2);
    expect(result.calories).toBe(1000);
    expect(result.protein_g).toBe(60);
    expect(result.carbs_g).toBe(100);
    expect(result.fat_g).toBe(30);
    expect(result.fiber_g).toBe(13);
    expect(result.sugar_g).toBe(13);
    expect(result.sodium_mg).toBe(950);
  });

  it('returns null for nutrients missing across all meals', () => {
    const result = calculateNutrientSummary({
      date: '2026-06-14',
      meals: [meal({ fiber_g: null }), meal({ fiber_g: undefined })],
      targets
    });

    expect(result.fiber_g).toBeNull();
  });

  it('filters meals by date', () => {
    const result = calculateNutrientSummary({
      date: '2026-06-14',
      meals: [meal(), meal({ logged_at: '2026-06-13T12:00:00.000Z', calories: 900 })],
      targets
    });

    expect(result.meal_count).toBe(1);
    expect(result.calories).toBe(600);
  });

  it('calculates target progress as percent values', () => {
    const result = calculateNutrientSummary({
      date: '2026-06-14',
      meals: [meal({ calories: 1100, protein_g: 75, carbs_g: 110, fat_g: 40, fiber_g: 15, sodium_mg: 1150 })],
      targets
    });

    expect(result.target_progress.calories).toBe(50);
    expect(result.target_progress.protein).toBe(50);
    expect(result.target_progress.carbs).toBe(50);
    expect(result.target_progress.fat).toBe(50);
    expect(result.target_progress.fiber).toBe(50);
    expect(result.target_progress.sodium).toBe(50);
  });

  it('uses low confidence when meals are missing', () => {
    const result = calculateNutrientSummary({
      date: '2026-06-14',
      meals: [],
      targets
    });

    expect(result.confidence).toBe('low');
    expect(result.reason_codes).toEqual(expect.arrayContaining(['food_data_missing', 'nutrition_calibrating']));
    expect(result.calories).toBeNull();
  });

  it('emits low and supportive protein reason codes', () => {
    const low = calculateNutrientSummary({
      date: '2026-06-14',
      meals: [meal({ protein_g: 50 })],
      targets
    });
    const supportive = calculateNutrientSummary({
      date: '2026-06-14',
      meals: [meal({ protein_g: 145 })],
      targets
    });

    expect(low.reason_codes).toContain('protein_low');
    expect(supportive.reason_codes).toContain('protein_supportive');
  });

  it('emits low and supportive fiber reason codes', () => {
    const low = calculateNutrientSummary({
      date: '2026-06-14',
      meals: [meal({ fiber_g: 10 })],
      targets
    });
    const supportive = calculateNutrientSummary({
      date: '2026-06-14',
      meals: [meal({ fiber_g: 26 })],
      targets
    });

    expect(low.reason_codes).toContain('fiber_low');
    expect(supportive.reason_codes).toContain('fiber_supportive');
  });

  it('keeps output serializable and source confidence visible in reason codes', () => {
    const result = calculateNutrientSummary({
      date: '2026-06-14',
      meals: [meal({ source: 'demo', source_confidence: 'low' })],
      targets
    });

    expect(result.confidence).toBe('low');
    expect(result.reason_codes).toEqual(expect.arrayContaining(['demo_food_data', 'source_low_confidence']));
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
  });
});
