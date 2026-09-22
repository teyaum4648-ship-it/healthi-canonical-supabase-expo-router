import { describe, expect, it } from 'vitest';

import type { MealLog, NutritionTargets } from '../../../src/engines/nutrition';
import {
  toMealLogInsert,
  toNutritionTargetInsert,
  type JsonValue,
  type MealLogPersistenceInput
} from '../../../src/features/nutrition/persistence';

const userId = '00000000-0000-0000-0000-000000000001';

function baseMeal(overrides: Partial<MealLogPersistenceInput> = {}): MealLogPersistenceInput {
  return {
    logged_at: '2026-06-14T12:30:00.000Z',
    meal_type: 'lunch',
    name: 'Chicken bowl',
    source: 'manual',
    source_confidence: 'medium',
    calories: 720,
    protein_g: 54,
    carbs_g: 82,
    fat_g: 22,
    fiber_g: 11,
    sugar_g: 8,
    sodium_mg: 680,
    ingredients: ['chicken', 'rice', 'greens'],
    quality_flags: ['balanced_meal', 'whole_food_emphasis'],
    user_response: {
      digestion: 'good',
      energy: 'steady',
      appetite: 'stable',
      cravings: 'none',
      notes: 'felt steady'
    },
    corrected_by_user: false,
    confirmed_by_user: true,
    reason_codes: ['manual_food_log', 'balanced_meal'],
    created_at: '2026-06-14T12:31:00.000Z',
    ...overrides
  };
}

function baseTarget(overrides: Partial<NutritionTargets> = {}): NutritionTargets {
  return {
    calories_target: 2300,
    protein_g_target: 160,
    carbs_g_target: 240,
    fat_g_target: 80,
    fiber_g_target: 32,
    sodium_mg_limit: 2300,
    confidence: 'medium',
    basis: ['onboarding'],
    ...overrides
  };
}

describe('nutrition persistence mapping', () => {
  it('maps all required meal log fields', () => {
    const payload = toMealLogInsert(baseMeal(), userId);

    expect(payload).toEqual({
      user_id: userId,
      logged_at: '2026-06-14T12:30:00.000Z',
      meal_date: '2026-06-14',
      meal_type: 'lunch',
      name: 'Chicken bowl',
      source: 'manual',
      source_confidence: 'medium',
      calories: 720,
      protein_g: 54,
      carbs_g: 82,
      fat_g: 22,
      fiber_g: 11,
      sugar_g: 8,
      sodium_mg: 680,
      micronutrients: null,
      ingredients: ['chicken', 'rice', 'greens'],
      quality_flags: ['balanced_meal', 'whole_food_emphasis'],
      user_response: {
        digestion: 'good',
        energy: 'steady',
        appetite: 'stable',
        cravings: 'none',
        notes: 'felt steady'
      },
      corrected_by_user: false,
      confirmed_by_user: true,
      correction_of_meal_id: null,
      original_source_id: null,
      raw_source_payload: null,
      reason_codes: ['manual_food_log', 'balanced_meal']
    });
  });

  it('handles optional nutrient fields safely', () => {
    const payload = toMealLogInsert(
      baseMeal({
        calories: undefined,
        protein_g: null,
        carbs_g: undefined,
        fat_g: null,
        fiber_g: undefined,
        sugar_g: null,
        sodium_mg: undefined,
        ingredients: undefined,
        user_response: undefined,
        corrected_by_user: undefined,
        confirmed_by_user: undefined
      }),
      userId
    );

    expect(payload.calories).toBeNull();
    expect(payload.protein_g).toBeNull();
    expect(payload.carbs_g).toBeNull();
    expect(payload.fat_g).toBeNull();
    expect(payload.fiber_g).toBeNull();
    expect(payload.sugar_g).toBeNull();
    expect(payload.sodium_mg).toBeNull();
    expect(payload.ingredients).toBeNull();
    expect(payload.user_response).toBeNull();
    expect(payload.corrected_by_user).toBe(false);
    expect(payload.confirmed_by_user).toBe(false);
  });

  it('preserves ingredients without mutating the source array', () => {
    const ingredients = ['oats', 'berries'];
    const payload = toMealLogInsert(baseMeal({ ingredients }), userId);

    payload.ingredients?.push('yogurt');

    expect(ingredients).toEqual(['oats', 'berries']);
  });

  it('preserves quality flags without mutating the source array', () => {
    const qualityFlags: MealLog['quality_flags'] = ['balanced_meal'];
    const payload = toMealLogInsert(baseMeal({ quality_flags: qualityFlags }), userId);

    payload.quality_flags.push('whole_food_emphasis');

    expect(qualityFlags).toEqual(['balanced_meal']);
  });

  it('preserves user response data', () => {
    const payload = toMealLogInsert(
      baseMeal({
        user_response: {
          digestion: 'heavy',
          energy: 'dip',
          appetite: 'overfull',
          cravings: 'mild'
        }
      }),
      userId
    );

    expect(payload.user_response).toEqual({
      digestion: 'heavy',
      energy: 'dip',
      appetite: 'overfull',
      cravings: 'mild'
    });
  });

  it('preserves correction lineage and source payload metadata', () => {
    const rawPayload: JsonValue = {
      provider: 'demo_seed',
      meal: { name: 'corrected meal' }
    };
    const payload = toMealLogInsert(
      baseMeal({
        source: 'user_corrected',
        source_confidence: 'high',
        corrected_by_user: true,
        confirmed_by_user: true,
        correction_of_meal_id: '11111111-1111-1111-1111-111111111111',
        original_source_id: 'demo-meal-1',
        raw_source_payload: rawPayload
      }),
      userId
    );

    expect(payload.source).toBe('user_corrected');
    expect(payload.source_confidence).toBe('high');
    expect(payload.corrected_by_user).toBe(true);
    expect(payload.confirmed_by_user).toBe(true);
    expect(payload.correction_of_meal_id).toBe('11111111-1111-1111-1111-111111111111');
    expect(payload.original_source_id).toBe('demo-meal-1');
    expect(payload.raw_source_payload).toEqual(rawPayload);
  });

  it('preserves a micronutrient panel without mutating the source', () => {
    const micronutrients = { vitamin_c: 32, iron: 2.1 };
    const payload = toMealLogInsert(baseMeal({ micronutrients }), userId);

    expect(payload.micronutrients).toEqual({ vitamin_c: 32, iron: 2.1 });

    payload.micronutrients!.folate = 400;
    expect(micronutrients).toEqual({ vitamin_c: 32, iron: 2.1 });
  });

  it('persists a meal with no panel as null rather than as an empty object', () => {
    // An empty object would read back as "we looked and found nothing", which is a
    // different claim from "this food never carried a panel".
    expect(toMealLogInsert(baseMeal({ micronutrients: undefined }), userId).micronutrients).toBeNull();
    expect(toMealLogInsert(baseMeal({ micronutrients: null }), userId).micronutrients).toBeNull();
  });

  it('preserves reason codes without mutating the source array', () => {
    const reasonCodes: MealLog['reason_codes'] = ['manual_food_log', 'protein_supportive'];
    const payload = toMealLogInsert(baseMeal({ reason_codes: reasonCodes }), userId);

    payload.reason_codes.push('fiber_supportive');

    expect(reasonCodes).toEqual(['manual_food_log', 'protein_supportive']);
  });

  it('derives meal date from logged_at and allows explicit override', () => {
    const derived = toMealLogInsert(baseMeal({ logged_at: '2026-06-14T23:30:00.000Z' }), userId);
    const explicit = toMealLogInsert(baseMeal({ logged_at: '2026-06-14T23:30:00.000Z', meal_date: '2026-06-15' }), userId);

    expect(derived.meal_date).toBe('2026-06-14');
    expect(explicit.meal_date).toBe('2026-06-15');
  });

  it('keeps meal log payloads serializable', () => {
    const payload = toMealLogInsert(baseMeal(), userId);

    expect(JSON.parse(JSON.stringify(payload))).toEqual(payload);
  });

  it('maps required nutrition target fields', () => {
    const payload = toNutritionTargetInsert(baseTarget(), userId);

    expect(payload).toEqual({
      user_id: userId,
      calories_target: 2300,
      protein_g_target: 160,
      carbs_g_target: 240,
      fat_g_target: 80,
      fiber_g_target: 32,
      sodium_mg_limit: 2300,
      confidence: 'medium',
      basis: ['onboarding'],
      is_active: true
    });
  });

  it('supports inactive target payloads and nullable target fields', () => {
    const payload = toNutritionTargetInsert(
      baseTarget({
        calories_target: undefined,
        protein_g_target: null,
        carbs_g_target: undefined,
        fat_g_target: null,
        fiber_g_target: undefined,
        sodium_mg_limit: null,
        confidence: 'high',
        basis: ['nutrition_history', 'manual_adjustment']
      }),
      userId,
      false
    );

    expect(payload).toEqual({
      user_id: userId,
      calories_target: null,
      protein_g_target: null,
      carbs_g_target: null,
      fat_g_target: null,
      fiber_g_target: null,
      sodium_mg_limit: null,
      confidence: 'high',
      basis: ['nutrition_history', 'manual_adjustment'],
      is_active: false
    });
  });

  it('does not introduce blocked language in helper-generated strings', () => {
    const mealPayload = toMealLogInsert(baseMeal(), userId);
    const targetPayload = toNutritionTargetInsert(baseTarget(), userId);
    const output = JSON.stringify({ mealPayload, targetPayload }).toLowerCase();
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

    for (const term of blockedTerms) {
      expect(output).not.toContain(term);
    }
  });
});
