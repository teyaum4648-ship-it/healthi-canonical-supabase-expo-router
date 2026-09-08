import { describe, expect, it } from 'vitest';

import { calculateFoodPatternProfile } from '../../../src/engines/nutrition';
import type { FoodPatternAnswers, FoodPatternProfile } from '../../../src/engines/nutrition';

const now = '2026-07-01T12:00:00.000Z';

const balancedAnswers: Required<FoodPatternAnswers> = {
  protein_meal_energy: 'neutral',
  carb_meal_energy: 'steady',
  hunger_frequency: 'three_to_four_hours',
  cravings_pattern: 'rare',
  large_meal_digestion: 'fine',
  higher_fat_meal_response: 'neutral',
  breakfast_skip_response: 'fine',
  afternoon_energy: 'steady',
  late_dinner_response: 'fine',
  heavy_dinner_sleep: 'unchanged',
  training_fuel_need: 'normal_meals',
  appetite_stability: 'predictable',
  meal_size_preference: 'three_balanced',
  caffeine_food_sensitivity: 'fine',
  stress_life_load_eating: 'steady',
  morning_fueling_pattern: 'no_breakfast'
};

function profile(overrides: FoodPatternAnswers = {}, base: Required<FoodPatternAnswers> = balancedAnswers): FoodPatternProfile {
  return calculateFoodPatternProfile({
    answers: {
      ...base,
      ...overrides
    },
    now
  });
}

function profileFrom(answers: Required<FoodPatternAnswers>): FoodPatternProfile {
  return calculateFoodPatternProfile({ answers, now });
}

describe('calculateFoodPatternProfile', () => {
  it('produces protein_forward from protein-forward answer patterns', () => {
    const result = profileFrom({
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
    });

    expect(result.pattern_label).toBe('protein_forward');
    expect(result.confidence).toBe('medium');
    expect(result.macro_tendency).toEqual({ protein: 'higher', carbs: 'moderate', fat: 'moderate' });
    expect(result.meal_timing_tendency.breakfast).toBe('helpful');
    expect(result.reason_codes).toContain('protein_forward_signal');
  });

  it('produces carb_supported from carb-supportive answer patterns', () => {
    const result = profileFrom({
      protein_meal_energy: 'not_sure',
      carb_meal_energy: 'steady',
      hunger_frequency: 'varies',
      cravings_pattern: 'evening',
      large_meal_digestion: 'not_sure',
      higher_fat_meal_response: 'neutral',
      breakfast_skip_response: 'not_applicable',
      afternoon_energy: 'training_days_only',
      late_dinner_response: 'not_sure',
      heavy_dinner_sleep: 'slow_morning',
      training_fuel_need: 'extra_carbs',
      appetite_stability: 'swings',
      meal_size_preference: 'changes_daily',
      caffeine_food_sensitivity: 'rare_caffeine',
      stress_life_load_eating: 'snack_more',
      morning_fueling_pattern: 'carb_breakfast'
    });

    expect(result.pattern_label).toBe('carb_supported');
    expect(result.macro_tendency.carbs).toBe('higher');
    expect(result.reason_codes).toEqual(expect.arrayContaining(['carb_supported_signal', 'training_fuel_needed']));
  });

  it('produces lighter_frequent from smaller and more frequent meal patterns', () => {
    const result = profileFrom({
      protein_meal_energy: 'heavy',
      carb_meal_energy: 'dip',
      hunger_frequency: 'under_2_hours',
      cravings_pattern: 'afternoon',
      large_meal_digestion: 'heavy',
      higher_fat_meal_response: 'heavy',
      breakfast_skip_response: 'overeat_later',
      afternoon_energy: 'dip',
      late_dinner_response: 'heavy',
      heavy_dinner_sleep: 'slow_morning',
      training_fuel_need: 'not_active',
      appetite_stability: 'swings',
      meal_size_preference: 'smaller_more_often',
      caffeine_food_sensitivity: 'wired_or_crash',
      stress_life_load_eating: 'snack_more',
      morning_fueling_pattern: 'light_start'
    });

    expect(result.pattern_label).toBe('lighter_frequent');
    expect(result.meal_timing_tendency.meal_spacing).toBe('shorter');
    expect(result.response_tendencies.digestion).toBe('sensitive');
    expect(result.response_tendencies.energy).toBe('dip_prone');
    expect(result.response_tendencies.appetite).toBe('hungry_soon');
    expect(result.reason_codes).toContain('lighter_frequent_signal');
  });

  it('produces evening_sensitive from late and heavy dinner sensitivity', () => {
    const result = profileFrom({
      protein_meal_energy: 'heavy',
      carb_meal_energy: 'depends',
      hunger_frequency: 'varies',
      cravings_pattern: 'evening',
      large_meal_digestion: 'heavy',
      higher_fat_meal_response: 'depends_on_timing',
      breakfast_skip_response: 'overeat_later',
      afternoon_energy: 'depends_lunch',
      late_dinner_response: 'restless',
      heavy_dinner_sleep: 'worse_sleep',
      training_fuel_need: 'not_active',
      appetite_stability: 'low_then_high',
      meal_size_preference: 'changes_daily',
      caffeine_food_sensitivity: 'rare_caffeine',
      stress_life_load_eating: 'dinner_heavier',
      morning_fueling_pattern: 'light_start'
    });

    expect(result.pattern_label).toBe('evening_sensitive');
    expect(result.meal_timing_tendency.late_meal_sensitivity).toBe('high');
    expect(result.reason_codes).toEqual(expect.arrayContaining(['evening_sensitive_signal', 'late_meal_sensitivity']));
  });

  it('produces steady_balanced from balanced no-strong-signal answers', () => {
    const result = profile();

    expect(result.pattern_label).toBe('steady_balanced');
    expect(result.macro_tendency).toEqual({ protein: 'moderate', carbs: 'moderate', fat: 'moderate' });
    expect(result.meal_timing_tendency).toEqual({
      breakfast: 'optional',
      meal_spacing: 'moderate',
      late_meal_sensitivity: 'low'
    });
    expect(result.response_tendencies).toEqual({ digestion: 'steady', energy: 'steady', appetite: 'stable' });
  });

  it('produces calibrating from sparse answers', () => {
    const result = calculateFoodPatternProfile({
      answers: {
        protein_meal_energy: 'steady',
        carb_meal_energy: 'steady'
      },
      now
    });

    expect(result.pattern_label).toBe('calibrating');
    expect(result.confidence).toBe('low');
    expect(result.reason_codes).toContain('food_pattern_calibrating');
  });

  it('uses a conservative output for conflicting close non-balanced scores', () => {
    const result = profile({
      protein_meal_energy: 'steady',
      carb_meal_energy: 'steady',
      hunger_frequency: 'under_2_hours',
      cravings_pattern: 'evening',
      large_meal_digestion: 'heavy',
      higher_fat_meal_response: 'depends_on_timing',
      breakfast_skip_response: 'crash',
      afternoon_energy: 'training_days_only',
      late_dinner_response: 'fine',
      heavy_dinner_sleep: 'unchanged',
      training_fuel_need: 'extra_carbs',
      appetite_stability: 'swings',
      meal_size_preference: 'larger_fewer',
      caffeine_food_sensitivity: 'need_food_first',
      stress_life_load_eating: 'steady',
      morning_fueling_pattern: 'carb_breakfast'
    });

    expect(['calibrating', 'steady_balanced']).toContain(result.pattern_label);
    expect(result.confidence).not.toBe('high');
  });

  it('never exceeds medium confidence from test answers alone', () => {
    expect(profile({ training_fuel_need: 'extra_protein' }).confidence).not.toBe('high');
    expect(profile().confidence).not.toBe('high');
  });

  it('does not throw for missing or unknown answers', () => {
    expect(() =>
      calculateFoodPatternProfile({
        answers: {
          protein_meal_energy: undefined,
          carb_meal_energy: null,
          hunger_frequency: 'not_a_real_answer'
        },
        now
      })
    ).not.toThrow();
  });

  it('keeps output serializable with stable timestamps', () => {
    const result = profile();

    expect(result.created_at).toBe(now);
    expect(result.updated_at).toBe(now);
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
  });
});
