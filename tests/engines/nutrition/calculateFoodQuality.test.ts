import { describe, expect, it } from 'vitest';

import { calculateFoodQuality, calculateNutrientSummary } from '../../../src/engines/nutrition';
import type { MealLog, NutritionTargets } from '../../../src/engines/nutrition';

const targets: NutritionTargets = {
  calories_target: 2200,
  protein_g_target: 140,
  fiber_g_target: 30,
  sodium_mg_limit: 2300,
  confidence: 'medium',
  basis: ['onboarding']
};

function meal(overrides: Partial<MealLog> = {}): MealLog {
  return {
    logged_at: '2026-06-14T12:00:00.000Z',
    meal_type: 'lunch',
    name: 'Meal',
    source: 'manual',
    source_confidence: 'medium',
    calories: 700,
    protein_g: 70,
    carbs_g: 70,
    fat_g: 20,
    fiber_g: 16,
    sugar_g: 8,
    sodium_mg: 600,
    ingredients: null,
    quality_flags: [],
    user_response: null,
    reason_codes: [],
    created_at: '2026-06-14T12:01:00.000Z',
    ...overrides
  };
}

describe('calculateFoodQuality', () => {
  it('rewards supportive quality flags and nutrient signals', () => {
    const meals = [
      meal({
        quality_flags: ['whole_food_emphasis', 'balanced_meal'],
        protein_g: 145,
        fiber_g: 28
      })
    ];
    const nutrientSummary = calculateNutrientSummary({ date: '2026-06-14', meals, targets });
    const result = calculateFoodQuality({ date: '2026-06-14', meals, nutrientSummary });

    expect(result.score).toBeGreaterThanOrEqual(78);
    expect(result.label).toBe('supportive');
    expect(result.reason_codes).toEqual(expect.arrayContaining(['whole_food_emphasis', 'balanced_meal', 'food_quality_supportive']));
  });

  it('penalizes watch flags conservatively', () => {
    const meals = [
      meal({
        quality_flags: ['added_sugar', 'high_sodium', 'ultra_processed_indicator'],
        protein_g: 35,
        fiber_g: 5,
        sodium_mg: 2600
      })
    ];
    const nutrientSummary = calculateNutrientSummary({ date: '2026-06-14', meals, targets });
    const result = calculateFoodQuality({ date: '2026-06-14', meals, nutrientSummary });

    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThan(55);
    expect(result.label).toBe('watch');
    expect(result.reason_codes).toEqual(expect.arrayContaining(['added_sugar_high', 'sodium_high', 'processing_level_high']));
  });

  it('returns unknown and low confidence when no meals exist', () => {
    const result = calculateFoodQuality({
      date: '2026-06-14',
      meals: [],
      nutrientSummary: null
    });

    expect(result.score).toBeNull();
    expect(result.label).toBe('unknown');
    expect(result.confidence).toBe('low');
    expect(result.reason_codes).toEqual(expect.arrayContaining(['food_data_missing', 'nutrition_calibrating']));
  });

  it('lowers confidence when nutrition data is partial', () => {
    const meals = [meal({ fiber_g: null }), meal({ fiber_g: 4 })];
    const nutrientSummary = calculateNutrientSummary({ date: '2026-06-14', meals, targets });
    const result = calculateFoodQuality({ date: '2026-06-14', meals, nutrientSummary });

    expect(result.confidence).toBe('low');
    expect(result.reason_codes).toContain('partial_nutrition_data');
  });

  it('keeps output serializable', () => {
    const meals = [meal({ quality_flags: ['balanced_meal'] })];
    const nutrientSummary = calculateNutrientSummary({ date: '2026-06-14', meals, targets });
    const result = calculateFoodQuality({ date: '2026-06-14', meals, nutrientSummary });

    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
  });
});
