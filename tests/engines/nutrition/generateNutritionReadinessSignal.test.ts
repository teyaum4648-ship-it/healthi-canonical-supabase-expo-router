import { describe, expect, it } from 'vitest';

import {
  calculateFoodQuality,
  calculateFoodResponse,
  calculateNutrientSummary,
  generateNutritionReadinessSignal
} from '../../../src/engines/nutrition';
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
    calories: 800,
    protein_g: 75,
    carbs_g: 80,
    fat_g: 24,
    fiber_g: 16,
    sugar_g: 8,
    sodium_mg: 600,
    ingredients: null,
    quality_flags: ['balanced_meal', 'whole_food_emphasis'],
    user_response: {
      digestion: 'good',
      energy: 'steady',
      appetite: 'stable'
    },
    reason_codes: [],
    created_at: '2026-06-14T12:01:00.000Z',
    ...overrides
  };
}

function signalFor(meals: MealLog[]) {
  const nutrientSummary = calculateNutrientSummary({ date: '2026-06-14', meals, targets });
  const foodQuality = calculateFoodQuality({ date: '2026-06-14', meals, nutrientSummary });
  const foodResponse = calculateFoodResponse({ date: '2026-06-14', meals });

  return generateNutritionReadinessSignal({
    date: '2026-06-14',
    nutrientSummary,
    foodQuality,
    foodResponse
  });
}

describe('generateNutritionReadinessSignal', () => {
  it('keeps score adjustment in a conservative range', () => {
    const result = signalFor([
      meal({
        calories: 100,
        protein_g: 5,
        fiber_g: 1,
        sodium_mg: 4000,
        quality_flags: ['added_sugar', 'high_sodium', 'low_fiber', 'protein_low', 'ultra_processed_indicator'],
        user_response: { digestion: 'uncomfortable', energy: 'dip', appetite: 'overfull' }
      })
    ]);

    expect(result.score_adjustment).toBeGreaterThanOrEqual(-8);
    expect(result.score_adjustment).toBeLessThanOrEqual(5);
  });

  it('lowers confidence more than score when data is missing', () => {
    const result = signalFor([]);

    expect(result.confidence).toBe('low');
    expect(result.label).toBe('unknown');
    expect(result.score_adjustment).toBeGreaterThanOrEqual(-1);
    expect(result.reason_codes).toEqual(expect.arrayContaining(['food_data_missing', 'nutrition_calibrating']));
  });

  it('improves the signal slightly with supportive quality and response', () => {
    const result = signalFor([
      meal({ protein_g: 145, fiber_g: 28, calories: 1200 }),
      meal({ protein_g: 20, fiber_g: 2, calories: 700 })
    ]);

    expect(result.score_adjustment).toBeGreaterThan(0);
    expect(result.label).toBe('supportive');
    expect(result.reason_codes).toContain('nutrition_signal_supportive');
  });

  it('lowers readiness slightly with watch signals', () => {
    const result = signalFor([
      meal({
        calories: 900,
        protein_g: 40,
        fiber_g: 6,
        sodium_mg: 2600,
        quality_flags: ['high_sodium', 'low_fiber', 'protein_low'],
        user_response: { digestion: 'heavy', energy: 'dip', appetite: 'hungry_soon' }
      })
    ]);

    expect(result.score_adjustment).toBeLessThan(0);
    expect(result.label).toBe('watch');
    expect(result.reason_codes).toEqual(expect.arrayContaining(['protein_low', 'digestion_discomfort_reported', 'energy_dip_reported']));
  });

  it('keeps output serializable', () => {
    const result = signalFor([meal()]);

    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
  });

  it('does not introduce blocked language in generated output', () => {
    const result = signalFor([
      meal({
        user_response: { digestion: 'heavy', energy: 'dip', appetite: 'overfull' },
        quality_flags: ['late_heavy_meal']
      })
    ]);
    const blockedTerms = [
      'diag' + 'nosis',
      'diag' + 'nose',
      'treat' + 'ment',
      'c' + 'ure',
      'pre' + 'scribe',
      'pre' + 'scription',
      'ad' + 'renal',
      'h' + 'pa',
      'cor' + 'tisol',
      'hor' + 'mone',
      'clin' + 'ical',
      'medical ' + 'decision',
      'dys' + 'regulated',
      'dys' + 'function',
      'de' + 'tox',
      'tox' + 'in',
      'tox' + 'ic',
      'clean' + 'se',
      'che' + 'k',
      'h' + 'lc',
      '4 doctors',
      'primal pattern',
      'work-in'
    ];
    const output = JSON.stringify(result).toLowerCase();

    for (const term of blockedTerms) {
      expect(output).not.toContain(term);
    }
  });
});
