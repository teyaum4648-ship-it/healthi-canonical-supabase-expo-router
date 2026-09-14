import { describe, expect, it } from 'vitest';

import { generateBaselineProfile } from '../../../src/features/onboarding/generateBaselineProfile';
import { generateLifestylePlan } from '../../../src/features/onboarding/generateLifestylePlan';
import type { OnboardingAnswers } from '../../../src/types/onboarding';

describe('generateLifestylePlan', () => {
  it('overrides body composition into stress recovery when stress, caffeine, night waking, and crashes stack', () => {
    const answers: OnboardingAnswers = {
      primary_goal: 'body_composition',
      blocking_factors: ['low_energy', 'poor_sleep', 'brain_fog', 'poor_recovery'],
      protein_fat_meal_response: 'energized_satisfied',
      carb_meal_response: 'tired_craving_more',
      sweet_food_response: 'hard_crash',
      meal_cadence: 'smaller_frequent_meals',
      post_exercise_craving: 'protein_fat',
      diet_quality_score: 7,
      processed_food_frequency: '1_to_2_weekly',
      vegetable_frequency: 'sometimes',
      water_intake: '1_to_2l',
      breakfast_skipping: 'sometimes',
      bedtime: '00:30',
      wake_time: '07:00',
      morning_rested_score: 3,
      overnight_waking: 'most_nights',
      daily_stress_score: 9,
      stress_sources: ['work_finances', 'health_concerns', 'general_anxiety'],
      daytime_energy_crashes: 'multiple_daily',
      caffeine_dependence: 'two_to_three',
      post_meal_discomfort: 'sometimes',
      post_meal_energy: 'significant_crash',
      bowel_regular: 'irregular',
      weekly_training_days: '3_to_4',
      training_types: ['strength_lifting'],
      recovery_between_sessions: 'slow_recovery',
      daily_schedule: 'remote_flexible',
      non_fitness_activity: 'moderately_active'
    };

    const result = generateLifestylePlan(answers);

    expect(result.archetype).toBe('stressRecovery');
    expect(result.tags).toEqual(
      expect.arrayContaining(['hpaFatigue', 'bloodSugarDysregulation', 'poorSleep'])
    );
    expect(result.plan.stressProtocol.priority).toBe('high');
    expect(result.plan.exerciseGuidance.intensity).toBe('low-moderate');
  });

  it('keeps a sedentary poor-diet user in a food and movement foundation lane', () => {
    const answers: OnboardingAnswers = {
      primary_goal: 'body_composition',
      blocking_factors: ['excess_body_fat', 'low_energy'],
      protein_fat_meal_response: 'neutral',
      carb_meal_response: 'neutral',
      sweet_food_response: 'rush_then_drop',
      meal_cadence: 'three_larger_meals',
      post_exercise_craving: 'both',
      diet_quality_score: 3,
      processed_food_frequency: 'daily',
      vegetable_frequency: 'rarely',
      water_intake: 'less_than_1l',
      breakfast_skipping: 'most_days',
      bedtime: '22:30',
      wake_time: '06:30',
      morning_rested_score: 7,
      overnight_waking: 'never',
      daily_stress_score: 4,
      stress_sources: ['low_stress'],
      daytime_energy_crashes: 'post_lunch_only',
      caffeine_dependence: 'one_cup',
      post_meal_discomfort: 'rarely',
      post_meal_energy: 'slight_drop',
      bowel_regular: 'yes',
      weekly_training_days: '0',
      training_types: ['none_currently'],
      recovery_between_sessions: 'recovers_well',
      daily_schedule: 'standard_9_to_5',
      non_fitness_activity: 'mostly_sedentary'
    };

    const result = generateLifestylePlan(answers);
    const baseline = generateBaselineProfile({ userId: 'user-1', answers });

    expect(result.archetype).toBe('bodyRecomposition');
    expect(result.tags).toEqual(
      expect.arrayContaining(['poorDietQuality', 'underHydrated', 'sedentary'])
    );
    expect(result.tags).not.toContain('hpaFatigue');
    expect(result.plan.exerciseGuidance.focus).toBe('movement habit');
    expect(baseline.initial_foundation_scores.protocol_biases).toEqual(
      expect.arrayContaining(['movement_reactivation', 'food_quality_foundation'])
    );
  });

  it('stores plan signals inside the baseline profile for the next scoring layer', () => {
    const baseline = generateBaselineProfile({
      userId: 'user-1',
      answers: {
        primary_goal: 'sleep_optimization',
        bedtime: '23:45',
        wake_time: '06:15',
        morning_rested_score: 4,
        overnight_waking: 'occasionally',
        daily_stress_score: 7,
        daytime_energy_crashes: 'multiple_daily',
        caffeine_dependence: 'two_to_three',
        diet_quality_score: 6,
        processed_food_frequency: '1_to_2_weekly',
        vegetable_frequency: 'sometimes',
        water_intake: '1_to_2l',
        post_meal_discomfort: 'sometimes',
        post_meal_energy: 'slight_drop',
        bowel_regular: 'irregular',
        weekly_training_days: '1_to_2',
        recovery_between_sessions: 'slow_recovery',
        daily_schedule: 'shift_irregular',
        non_fitness_activity: 'mostly_sedentary'
      }
    });

    expect(baseline.calibration_status).toBe('calibrating');
    expect(baseline.initial_foundation_scores.plan_signals.sleep_circadian_repair).toBeGreaterThan(
      0
    );
    expect(baseline.initial_foundation_scores.recovery_rhythm.confidence).toBe('low');
  });
});
