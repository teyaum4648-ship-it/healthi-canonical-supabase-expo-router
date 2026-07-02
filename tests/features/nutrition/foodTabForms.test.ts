import { describe, expect, it } from 'vitest';

import { calculateFoodPatternProfile } from '../../../src/engines/nutrition';
import {
  createEmptyManualMealForm,
  createEmptyResponseLogForm,
  demoModeLabel,
  foodPatternDraftToAnswers,
  manualMealFormToMealLog,
  responseLogFormToInput,
  type FoodPatternAnswerDraft
} from '../../../src/features/nutrition/foodTabForms';

const now = '2026-07-02T12:00:00.000Z';

describe('food tab form helpers', () => {
  it('creates a valid manual meal log from form input', () => {
    const meal = manualMealFormToMealLog(
      {
        ...createEmptyManualMealForm(now),
        name: 'Greek bowl',
        meal_type: 'lunch',
        calories: '520',
        protein_g: '42',
        carbs_g: '46',
        fat_g: '18',
        fiber_g: '8',
        sugar_g: '6',
        sodium_mg: '680',
        quality_flags: ['balanced_meal', 'whole_food_emphasis']
      },
      now
    );

    expect(meal.name).toBe('Greek bowl');
    expect(meal.meal_type).toBe('lunch');
    expect(meal.calories).toBe(520);
    expect(meal.protein_g).toBe(42);
    expect(meal.carbs_g).toBe(46);
    expect(meal.fat_g).toBe(18);
    expect(meal.confirmed_by_user).toBe(true);
  });

  it('adds calibrating reasons for sparse manual meal logs', () => {
    const meal = manualMealFormToMealLog(
      {
        ...createEmptyManualMealForm(now),
        name: 'Snack',
        calories: '180'
      },
      now
    );

    expect(meal.reason_codes).toContain('manual_food_log');
    expect(meal.reason_codes).toContain('nutrition_calibrating');
    expect(meal.reason_codes).toContain('partial_nutrition_data');
  });

  it('uses manual source and medium confidence for manual logs', () => {
    const meal = manualMealFormToMealLog(createEmptyManualMealForm(now), now);

    expect(meal.source).toBe('manual');
    expect(meal.source_confidence).toBe('medium');
    expect(meal.corrected_by_user).toBe(false);
  });

  it('preserves quality flags without mutating form state', () => {
    const qualityFlags = ['balanced_meal'] as const;
    const form = {
      ...createEmptyManualMealForm(now),
      quality_flags: [...qualityFlags]
    };
    const meal = manualMealFormToMealLog(form, now);

    meal.quality_flags.push('whole_food_emphasis');

    expect(form.quality_flags).toEqual(['balanced_meal']);
    expect(meal.quality_flags).toEqual(['balanced_meal', 'whole_food_emphasis']);
  });

  it('creates a valid post-meal response payload', () => {
    const response = responseLogFormToInput({
      ...createEmptyResponseLogForm(now),
      meal_log_id: 'meal-1',
      minutes_after_meal: '75',
      overall_score: '8',
      digestion: 'good',
      energy: 'steady',
      appetite: 'stable',
      focus: 'clear',
      cravings: 'none',
      notes: 'Steady after lunch.'
    });

    expect(response).toEqual({
      meal_log_id: 'meal-1',
      responded_at: now,
      minutes_after_meal: 75,
      overall_score: 8,
      digestion: 'good',
      energy: 'steady',
      appetite: 'stable',
      focus: 'clear',
      cravings: 'none',
      notes: 'Steady after lunch.',
      confidence: 'medium',
      reason_codes: ['post_meal_response_logged']
    });
  });

  it('clamps overall response score to the 1-10 range', () => {
    expect(responseLogFormToInput({ ...createEmptyResponseLogForm(now), overall_score: '14' }).overall_score).toBe(10);
    expect(responseLogFormToInput({ ...createEmptyResponseLogForm(now), overall_score: '-3' }).overall_score).toBe(1);
    expect(responseLogFormToInput({ ...createEmptyResponseLogForm(now), overall_score: 'nope' }).overall_score).toBe(5);
  });

  it('maps Food Pattern Test answers into the scoring engine', () => {
    const draft: FoodPatternAnswerDraft = {
      protein_meal_energy: 'steady',
      carb_meal_energy: 'dip',
      hunger_frequency: 'five_plus_hours',
      cravings_pattern: 'after_sweets',
      large_meal_digestion: 'sleepy',
      higher_fat_meal_response: 'satisfied',
      breakfast_skip_response: 'crash',
      afternoon_energy: 'dip',
      late_dinner_response: 'not_sure',
      heavy_dinner_sleep: 'not_sure',
      training_fuel_need: 'extra_protein',
      appetite_stability: 'swings',
      meal_size_preference: 'larger_fewer',
      caffeine_food_sensitivity: 'need_food_first',
      stress_life_load_eating: 'forget_food',
      morning_fueling_pattern: 'protein_breakfast'
    };

    const profile = calculateFoodPatternProfile({
      answers: foodPatternDraftToAnswers(draft),
      now
    });

    expect(profile.pattern_label).toBe('protein_forward');
    expect(profile.source).toBe('food_pattern_test');
    expect(profile.reason_codes).toContain('protein_forward_signal');
  });

  it('labels local demo state clearly', () => {
    expect(demoModeLabel(false, false)).toBe('Local demo mode');
    expect(demoModeLabel(true, false)).toBe('Local preview');
    expect(demoModeLabel(true, true)).toBe('Synced when saved');
  });

  it('keeps helper outputs serializable', () => {
    const meal = manualMealFormToMealLog(createEmptyManualMealForm(now), now);
    const response = responseLogFormToInput(createEmptyResponseLogForm(now));

    expect(JSON.parse(JSON.stringify(meal))).toEqual(meal);
    expect(JSON.parse(JSON.stringify(response))).toEqual(response);
  });

  it('does not introduce blocked language in helper output', () => {
    const output = JSON.stringify({
      meal: manualMealFormToMealLog(createEmptyManualMealForm(now), now),
      response: responseLogFormToInput(createEmptyResponseLogForm(now)),
      label: demoModeLabel(false, false)
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
      'work' + '-in'
    ];

    for (const term of blockedTerms) {
      expect(output).not.toContain(term);
    }
  });
});
