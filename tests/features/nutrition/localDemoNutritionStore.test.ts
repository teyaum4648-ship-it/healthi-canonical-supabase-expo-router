import { describe, expect, it } from 'vitest';

import type { FoodPatternProfile, MealLog } from '../../../src/engines/nutrition';
import { composeDashboardNutritionSummary } from '../../../src/features/dashboard/dashboardComposer';
import type { PostMealResponseLogRow } from '../../../src/features/nutrition/foodPersonalizationPersistence';
import {
  createEmptyLocalDemoNutritionState,
  deserializeDemoFoodPatternProfile,
  deserializeDemoMealLogs,
  deserializeDemoPostMealResponses,
  serializeDemoFoodPatternProfile,
  serializeDemoMealLogs,
  serializeDemoPostMealResponses,
  toLocalDemoMealLog
} from '../../../src/features/nutrition/localDemoNutritionStore';

function createMeal(overrides: Partial<MealLog> = {}): MealLog {
  return {
    id: 'local-meal-1',
    user_id: 'demo-user',
    logged_at: '2026-06-12T12:00:00.000Z',
    meal_type: 'lunch',
    name: 'Lunch bowl',
    source: 'manual',
    source_confidence: 'medium',
    calories: 640,
    protein_g: 44,
    carbs_g: 62,
    fat_g: 20,
    fiber_g: 11,
    sugar_g: 9,
    sodium_mg: 620,
    ingredients: ['rice', 'chicken', 'greens'],
    quality_flags: ['balanced_meal', 'whole_food_emphasis'],
    user_response: {
      digestion: 'good',
      energy: 'steady',
      appetite: 'stable',
      cravings: 'none',
      notes: 'Felt steady.'
    },
    corrected_by_user: false,
    confirmed_by_user: true,
    reason_codes: ['manual_food_log'],
    created_at: '2026-06-12T12:01:00.000Z',
    ...overrides
  };
}

function createResponse(overrides: Partial<PostMealResponseLogRow> = {}): PostMealResponseLogRow {
  return {
    id: 'local-response-1',
    user_id: 'demo-user',
    meal_log_id: 'local-meal-1',
    responded_at: '2026-06-12T13:30:00.000Z',
    minutes_after_meal: 90,
    overall_score: 8,
    digestion: 'good',
    energy: 'steady',
    appetite: 'stable',
    focus: 'clear',
    cravings: 'none',
    notes: 'Smooth afternoon.',
    confidence: 'medium',
    reason_codes: ['post_meal_response_logged'],
    created_at: '2026-06-12T13:31:00.000Z',
    updated_at: '2026-06-12T13:31:00.000Z',
    ...overrides
  };
}

function createProfile(overrides: Partial<FoodPatternProfile> = {}): FoodPatternProfile {
  return {
    id: 'local-profile-1',
    user_id: 'demo-user',
    created_at: '2026-06-12T14:00:00.000Z',
    updated_at: '2026-06-12T14:00:00.000Z',
    source: 'food_pattern_test',
    confidence: 'medium',
    pattern_label: 'steady_balanced',
    scores: {
      steady_balanced: 82,
      protein_forward: 52,
      carb_supported: 30,
      lighter_frequent: 40,
      evening_sensitive: 35
    },
    macro_tendency: {
      protein: 'moderate',
      carbs: 'moderate',
      fat: 'moderate'
    },
    meal_timing_tendency: {
      breakfast: 'helpful',
      meal_spacing: 'moderate',
      late_meal_sensitivity: 'medium'
    },
    response_tendencies: {
      digestion: 'steady',
      energy: 'steady',
      appetite: 'stable'
    },
    reason_codes: ['steady_balanced_signal', 'breakfast_helpful'],
    ...overrides
  };
}

describe('local demo nutrition store helpers', () => {
  it('serializes and deserializes meal logs while preserving nested response data', () => {
    const meal = createMeal();
    const roundTrip = deserializeDemoMealLogs(serializeDemoMealLogs([meal]));

    expect(roundTrip).toEqual([meal]);
    expect(roundTrip[0]?.user_response?.energy).toBe('steady');
    expect(roundTrip[0]?.ingredients).toEqual(['rice', 'chicken', 'greens']);
  });

  it('serializes and deserializes post-meal responses', () => {
    const response = createResponse();

    expect(deserializeDemoPostMealResponses(serializeDemoPostMealResponses([response]))).toEqual([response]);
  });

  it('serializes and deserializes the active food pattern profile', () => {
    const profile = createProfile();
    const roundTrip = deserializeDemoFoodPatternProfile(serializeDemoFoodPatternProfile(profile));

    expect(roundTrip).toEqual(profile);
    expect(roundTrip?.scores.steady_balanced).toBe(82);
    expect(roundTrip?.reason_codes).toContain('steady_balanced_signal');
  });

  it('returns defaults for missing or invalid local demo data', () => {
    expect(deserializeDemoMealLogs(null)).toEqual([]);
    expect(deserializeDemoMealLogs('not-json')).toEqual([]);
    expect(deserializeDemoPostMealResponses(JSON.stringify([{ id: 'missing-required-fields' }]))).toEqual([]);
    expect(deserializeDemoFoodPatternProfile(null)).toBeNull();
    expect(createEmptyLocalDemoNutritionState()).toEqual({
      mealLogs: [],
      postMealResponses: [],
      foodPatternProfile: null
    });
  });

  it('maps a Food tab local meal into the shared store shape without mutating the source meal', () => {
    const meal = createMeal({ id: 'local-meal-food-tab' });
    const mapped = toLocalDemoMealLog(meal);

    mapped.name = 'Edited clone';

    expect(mapped.id).toBe('local-meal-food-tab');
    expect(mapped.reason_codes).toEqual(['manual_food_log']);
    expect(meal.name).toBe('Lunch bowl');
  });

  it('lets dashboard nutrition summary consume shared local demo meal logs', () => {
    const summary = composeDashboardNutritionSummary({
      date: '2026-06-12',
      meals: deserializeDemoMealLogs(serializeDemoMealLogs([createMeal()])),
      targets: null,
      demoMode: true
    });

    expect(summary.meal_count).toBe(1);
    expect(summary.calorie_label).toBe('640');
    expect(summary.protein_label).toBe('44g');
    expect(summary.food_response_label).toBe('Steady');
    expect(summary.source_label).toBe('demo');
  });

  it('does not introduce blocked language in local demo nutrition payloads', () => {
    const output = JSON.stringify({
      meal: createMeal(),
      response: createResponse(),
      profile: createProfile()
    }).toLowerCase();
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
      'cheat ' + 'meal',
      'guilt-' + 'free',
      'bad ' + 'food',
      'metabolic ' + 'type',
      'metabolic ' + 'typing',
      'che' + 'k',
      'h' + 'lc',
      '4 doc' + 'tors',
      'primal ' + 'pattern',
      'work-' + 'in'
    ];

    for (const term of blockedTerms) {
      expect(output).not.toContain(term);
    }
  });
});
