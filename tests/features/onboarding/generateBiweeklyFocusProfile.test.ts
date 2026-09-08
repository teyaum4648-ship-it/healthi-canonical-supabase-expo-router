import { describe, expect, it } from 'vitest';

import { generateBiweeklyFocusProfile } from '../../../src/features/onboarding/generateBiweeklyFocusProfile';
import type { OnboardingAnswers } from '../../../src/types/onboarding';

describe('generateBiweeklyFocusProfile', () => {
  it('selects recovery rhythm when sleep timing, night waking, caffeine, and recovery signals stack', () => {
    const answers: OnboardingAnswers = {
      bedtime: '00:30',
      wake_time: '06:30',
      morning_rested_score: 3,
      overnight_waking: 'most_nights',
      caffeine_dependence: 'four_plus',
      daily_schedule: 'shift_irregular',
      recovery_between_sessions: 'slow_recovery',
      diet_quality_score: 8,
      processed_food_frequency: 'rarely',
      vegetable_frequency: 'yes',
      water_intake: '2l_plus',
      breakfast_skipping: 'never',
      post_meal_discomfort: 'rarely',
      post_meal_energy: 'stable',
      bowel_regular: 'yes',
      weekly_training_days: '3_to_4',
      training_types: ['strength_lifting'],
      non_fitness_activity: 'moderately_active',
      daily_stress_score: 5,
      stress_sources: ['low_stress'],
      daytime_energy_crashes: 'never',
      blocking_factors: ['poor_sleep']
    };

    const profile = generateBiweeklyFocusProfile({
      userId: 'user-1',
      answers,
      generatedAt: new Date('2026-06-10T12:00:00.000Z')
    });

    expect(profile.primary_focus).toBe('recovery_rhythm');
    expect(profile.training_bias).toBe('reduce_intensity');
    expect(profile.lifestyle_bias).toBe('circadian_consistency');
    expect(profile.recovery_bias).toBe('caffeine_cutoff');
    expect(profile.calibration_status).toBe('calibrating');
    expect(profile.reassessment_due_at).toBe('2026-06-24');
    expect(profile.dynamic_score_sheet.domain_scores.recovery_rhythm.label).toBe(
      'Recovery + Rhythm'
    );
    expect(profile.dynamic_score_sheet.ranked_reasons[0]?.domain).toBe('recovery_rhythm');
    expect(profile.reason_codes).toEqual(
      expect.arrayContaining(['calibrating', 'poor_sleep_quality', 'circadian_shift'])
    );
  });

  it('differentiates nourishment from sedentary movement when food and hydration signals dominate', () => {
    const answers: OnboardingAnswers = {
      bedtime: '22:30',
      wake_time: '06:30',
      morning_rested_score: 8,
      overnight_waking: 'never',
      caffeine_dependence: 'one_cup',
      daily_schedule: 'standard_9_to_5',
      recovery_between_sessions: 'recovers_well',
      diet_quality_score: 3,
      processed_food_frequency: 'daily',
      vegetable_frequency: 'rarely',
      water_intake: 'less_than_1l',
      breakfast_skipping: 'most_days',
      post_meal_discomfort: 'sometimes',
      post_meal_energy: 'significant_crash',
      bowel_regular: 'irregular',
      sweet_food_response: 'hard_crash',
      weekly_training_days: '1_to_2',
      training_types: ['mixed'],
      non_fitness_activity: 'moderately_active',
      daily_stress_score: 4,
      stress_sources: ['low_stress'],
      daytime_energy_crashes: 'post_lunch_only',
      blocking_factors: ['low_energy']
    };

    const profile = generateBiweeklyFocusProfile({ answers });

    expect(profile.primary_focus).toBe('nourishment');
    expect(profile.training_bias).toBe('reduce_intensity');
    expect(profile.lifestyle_bias).toBe('hydration_and_meal_rhythm');
    expect(profile.nourishment_bias).toBe('hydration_first');
    expect(profile.dynamic_score_sheet.overall_score).toBeGreaterThan(0);
    expect(profile.dynamic_score_sheet.domain_scores.nourishment.color_token).toBe('red');
    expect(profile.dynamic_score_sheet.ranked_reasons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          domain: 'nourishment',
          label: 'Hydration is a high-leverage starting point.',
          reason_code: 'hydration_low'
        })
      ])
    );
    expect(profile.scorecard.nourishment.focus_pressure_score).toBeGreaterThan(
      profile.scorecard.movement_capacity.focus_pressure_score
    );
  });

  it('returns balanced low-confidence calibration output when useful onboarding data is missing', () => {
    const profile = generateBiweeklyFocusProfile({
      answers: {},
      generatedAt: new Date('2026-06-10T12:00:00.000Z')
    });

    expect(profile.primary_focus).toBe('balanced');
    expect(profile.secondary_focus).toBeUndefined();
    expect(profile.confidence).toBe('low');
    expect(profile.training_bias).toBe('normal_progression');
    expect(profile.dynamic_score_sheet.overall_priority).toBe('low');
    expect(profile.dynamic_score_sheet.ranked_reasons).toEqual([]);
    expect(profile.reason_codes).toEqual(
      expect.arrayContaining(['calibrating', 'missing_data_low_confidence'])
    );
    expect(profile.top_limiting_factors).toEqual([]);
  });

  it('can select mind and life load when stress signals dominate', () => {
    const profile = generateBiweeklyFocusProfile({
      answers: {
        bedtime: '22:00',
        wake_time: '06:30',
        morning_rested_score: 8,
        overnight_waking: 'never',
        caffeine_dependence: 'one_cup',
        daily_schedule: 'shift_irregular',
        recovery_between_sessions: 'recovers_well',
        diet_quality_score: 8,
        processed_food_frequency: 'rarely',
        vegetable_frequency: 'yes',
        water_intake: '2l_plus',
        breakfast_skipping: 'never',
        post_meal_discomfort: 'rarely',
        post_meal_energy: 'stable',
        bowel_regular: 'yes',
        weekly_training_days: '3_to_4',
        training_types: ['mixed'],
        non_fitness_activity: 'moderately_active',
        daily_stress_score: 10,
        stress_sources: ['work_finances', 'relationships', 'family'],
        daytime_energy_crashes: 'multiple_daily',
        blocking_factors: ['brain_fog', 'mood_swings']
      }
    });

    expect(profile.primary_focus).toBe('mind_life_load');
    expect(profile.training_bias).toBe('stress_adapted_training');
    expect(profile.dynamic_score_sheet.domain_scores.mind_life_load.priority).toBe('high');
    expect(profile.dynamic_score_sheet.summary).toContain('Stress + Life Load');
  });

  it('can select movement capacity when movement baseline signals dominate', () => {
    const profile = generateBiweeklyFocusProfile({
      answers: {
        bedtime: '22:00',
        wake_time: '06:30',
        morning_rested_score: 8,
        overnight_waking: 'never',
        caffeine_dependence: 'none',
        daily_schedule: 'standard_9_to_5',
        recovery_between_sessions: 'always_sore_fatigued',
        diet_quality_score: 8,
        processed_food_frequency: 'rarely',
        vegetable_frequency: 'yes',
        water_intake: '2l_plus',
        breakfast_skipping: 'never',
        post_meal_discomfort: 'rarely',
        post_meal_energy: 'stable',
        bowel_regular: 'yes',
        weekly_training_days: '0',
        training_types: ['none_currently'],
        non_fitness_activity: 'mostly_sedentary',
        daily_stress_score: 3,
        stress_sources: ['low_stress'],
        daytime_energy_crashes: 'never',
        blocking_factors: ['poor_recovery']
      }
    });

    expect(profile.primary_focus).toBe('movement_capacity');
    expect(profile.training_bias).toBe('movement_quality_first');
    expect(profile.dynamic_score_sheet.domain_scores.movement_capacity.reasons[0]?.domain).toBe(
      'movement_capacity'
    );
  });

  it('keeps the score sheet serializable and includes all bias fields', () => {
    const profile = generateBiweeklyFocusProfile({
      answers: {
        bedtime: '22:30',
        wake_time: '06:30',
        morning_rested_score: 6,
        overnight_waking: 'occasionally',
        caffeine_dependence: 'two_to_three',
        daily_schedule: 'remote_flexible',
        recovery_between_sessions: 'slow_recovery'
      }
    });

    expect(() => JSON.stringify(profile.dynamic_score_sheet)).not.toThrow();
    expect(profile.training_bias).toBeTruthy();
    expect(profile.lifestyle_bias).toBeTruthy();
    expect(profile.nourishment_bias).toBeTruthy();
    expect(profile.recovery_bias).toBeTruthy();
    expect(Object.keys(profile.dynamic_score_sheet.domain_scores)).toEqual([
      'recovery_rhythm',
      'nourishment',
      'mind_life_load',
      'movement_capacity'
    ]);
  });
});
