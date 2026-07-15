import { describe, expect, it } from 'vitest';

import { generateBaselineProfile } from '../../../src/features/onboarding/generateBaselineProfile';
import {
  generateOnboardingV2Result,
  readOnboardingV2Setup
} from '../../../src/features/onboarding/onboardingV2Model';
import { composeProfileScreenModel } from '../../../src/features/profile/profileComposer';
import type { OnboardingAnswers } from '../../../src/types/onboarding';

describe('onboarding v2 model', () => {
  it('keeps sparse answers calibrating with low confidence and missing data', () => {
    const result = generateOnboardingV2Result({ answers: { primary_goal: 'energy_focus' } });

    expect(result.completed).toBe(false);
    expect(result.confidence).toBe('low');
    expect(result.missing_data).toEqual(expect.arrayContaining(['bedtime', 'meal_cadence', 'weekly_training_days']));
    expect(result.reason_codes).toContain('baseline_details_missing');
  });

  it('suggests build for a consistent progress-oriented starting point', () => {
    const result = generateOnboardingV2Result({
      answers: {
        primary_goal: 'build_consistency',
        bedtime: '22:30',
        wake_time: '06:30',
        morning_rested_score: 7,
        overnight_waking: 'never',
        meal_cadence: 'three_larger_meals',
        diet_quality_score: 7,
        water_intake: '2l_plus',
        post_meal_energy: 'stable',
        weekly_training_days: '3_to_4',
        training_types: ['strength_lifting'],
        recovery_between_sessions: 'recovers_well',
        non_fitness_activity: 'moderately_active',
        daily_stress_score: 4,
        daily_schedule: 'standard_9_to_5',
        blocking_factors: ['no_clear_issue']
      }
    });

    expect(result.baseline_mode).toBe('build');
    expect(result.primary_focus).toBe('movement_capacity');
    expect(result.confidence).toBe('medium');
  });

  it('prioritizes recovery rhythm when its signals are strongest', () => {
    const result = generateOnboardingV2Result({
      answers: {
        primary_goal: 'energy_focus',
        bedtime: '00:30',
        wake_time: '06:00',
        morning_rested_score: 3,
        overnight_waking: 'most_nights',
        meal_cadence: 'three_larger_meals',
        diet_quality_score: 7,
        water_intake: '2l_plus',
        post_meal_energy: 'stable',
        weekly_training_days: '3_to_4',
        training_types: ['strength_lifting'],
        recovery_between_sessions: 'recovers_well',
        non_fitness_activity: 'moderately_active',
        daily_stress_score: 5,
        daily_schedule: 'standard_9_to_5',
        blocking_factors: ['poor_sleep']
      }
    });

    expect(result.primary_focus).toBe('recovery_rhythm');
    expect(result.calibration_hints[0]?.domain).toBe('recovery_rhythm');
  });

  it('maps explicit goals to nourishment, movement, and schedule focus', () => {
    const base: OnboardingAnswers = {
      bedtime: '22:30', wake_time: '06:30', morning_rested_score: 7, overnight_waking: 'never',
      meal_cadence: 'three_larger_meals', diet_quality_score: 7, water_intake: '2l_plus', post_meal_energy: 'stable',
      weekly_training_days: '3_to_4', training_types: ['strength_lifting'], recovery_between_sessions: 'recovers_well',
      non_fitness_activity: 'moderately_active', daily_stress_score: 4, daily_schedule: 'standard_9_to_5', blocking_factors: ['no_clear_issue']
    };

    expect(generateOnboardingV2Result({ answers: { ...base, primary_goal: 'nourishment_habits' } }).primary_focus).toBe('nourishment');
    expect(generateOnboardingV2Result({ answers: { ...base, primary_goal: 'athletic_performance' } }).primary_focus).toBe('movement_capacity');
    expect(generateOnboardingV2Result({ answers: { ...base, primary_goal: 'balance_schedule' } }).primary_focus).toBe('mind_life_load');
  });

  it('suggests restore conservatively when low movement capacity and high life load stack', () => {
    const result = generateOnboardingV2Result({
      answers: {
        primary_goal: 'energy_focus',
        weekly_training_days: '0',
        training_types: ['none_currently'],
        recovery_between_sessions: 'slow_recovery',
        non_fitness_activity: 'mostly_sedentary',
        daily_stress_score: 9,
        daily_schedule: 'shift_irregular',
        blocking_factors: ['schedule_pressure']
      }
    });

    expect(result.baseline_mode).toBe('restore');
  });

  it('only preserves guided mode when it is explicitly supplied', () => {
    const result = generateOnboardingV2Result({
      answers: { primary_goal: 'energy_focus' },
      existing_baseline_mode: 'professional_guidance'
    });

    expect(result.baseline_mode).toBe('professional_guidance');
  });

  it('stores v2 setup in the existing baseline record and exposes it to Profile', () => {
    const baseline = generateBaselineProfile({
      userId: 'user-1',
      answers: {
        primary_goal: 'sleep_optimization',
        bedtime: '22:45',
        wake_time: '06:45',
        morning_rested_score: 5,
        overnight_waking: 'occasionally',
        meal_cadence: 'three_larger_meals',
        diet_quality_score: 6,
        water_intake: '1_to_2l',
        post_meal_energy: 'slight_drop',
        weekly_training_days: '1_to_2',
        training_types: ['yoga_mobility'],
        recovery_between_sessions: 'slow_recovery',
        non_fitness_activity: 'mostly_sedentary',
        daily_stress_score: 6,
        daily_schedule: 'remote_flexible',
        blocking_factors: ['poor_sleep']
      }
    });
    const setup = readOnboardingV2Setup(baseline.initial_foundation_scores);
    const profile = composeProfileScreenModel({
      profile: { display_name: 'Taylor', goal: baseline.primary_goal, baseline_mode: setup?.baseline_mode },
      onboarding: { completed: true, baseline_profile: { primary_goal: baseline.primary_goal, baseline_mode: setup?.baseline_mode, primary_focus: setup?.primary_focus } },
      primary_focus: setup?.primary_focus,
      source_label: 'demo'
    });

    expect(setup?.primary_focus).toBe('recovery_rhythm');
    expect(profile.baseline.profile_cards.map((card) => card.id)).toEqual(expect.arrayContaining(['mode', 'focus']));
    expect(JSON.parse(JSON.stringify(profile))).toEqual(profile);
  });
});
