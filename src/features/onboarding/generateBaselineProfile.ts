import type {
  BaselineDomainScore,
  BaselinePlanSignals,
  BaselineProfileDraft,
  BaselineProfileInput,
  OnboardingAnswerValue,
  OnboardingAnswers
} from '../../types/onboarding';
import { generateOnboardingV2Result, onboardingV2SetupFromResult } from './onboardingV2Model';

function asString(value: OnboardingAnswerValue | undefined): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function asStringArray(value: OnboardingAnswerValue | undefined): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (item) => !['none', 'no_clear_issue', 'low_stress', 'none_currently'].includes(item)
  );
}

function scoreDomain(score: number, limitingFactors: string[]): BaselineDomainScore {
  return {
    score: Math.max(0, Math.min(100, Math.round(score))),
    confidence: 'low',
    reason_codes: ['calibrating'],
    limiting_factors: limitingFactors
  };
}

function calculateSleepNeedMinutes(baselineMode: string, primaryFocus: string) {
  if (baselineMode === 'restore') return 510;
  if (primaryFocus === 'recovery_rhythm') return 500;
  return 480;
}

function calculateHydrationTargetMl(answers: OnboardingAnswers) {
  const trainingDays = asString(answers.weekly_training_days);
  const waterIntake = asString(answers.water_intake);

  if (trainingDays === '5_plus') {
    return 3200;
  }

  if (waterIntake === 'less_than_1l') {
    return 2800;
  }

  return 2600;
}

function buildPlanSignals(result: ReturnType<typeof generateOnboardingV2Result>): BaselinePlanSignals {
  const priorityFor = (domain: 'recovery_rhythm' | 'nourishment' | 'movement_capacity' | 'mind_life_load') =>
    result.calibration_hints.find((hint) => hint.domain === domain)?.priority ?? 0;
  return {
    sleep_circadian_repair: priorityFor('recovery_rhythm'),
    stress_rhythm_support: priorityFor('mind_life_load'),
    food_quality_foundation: priorityFor('nourishment'),
    metabolic_stability: priorityFor('nourishment'),
    digestion_support: priorityFor('nourishment'),
    movement_reactivation: priorityFor('movement_capacity'),
    performance_recovery: priorityFor('movement_capacity')
  };
}

function buildProtocolBiases(signals: BaselinePlanSignals) {
  return Object.entries(signals)
    .filter(([, score]) => score >= 50)
    .sort(([, left], [, right]) => right - left)
    .map(([key]) => key);
}

function limitersFromSignals(signals: BaselinePlanSignals, keys: Array<keyof BaselinePlanSignals>) {
  return keys.filter((key) => signals[key] >= 50);
}

function buildDigestionTendencies(answers: OnboardingAnswers) {
  const tendencies: string[] = [];

  if (asString(answers.post_meal_discomfort) === 'often') {
    tendencies.push('post_meal_discomfort');
  }

  if (asString(answers.post_meal_energy) === 'significant_crash') {
    tendencies.push('post_meal_energy_crash');
  }

  if (asString(answers.bowel_regular) === 'irregular' || asString(answers.bowel_regular) === 'no') {
    tendencies.push('bowel_rhythm_irregular');
  }

  return tendencies;
}

export function generateBaselineProfile({
  userId,
  answers
}: BaselineProfileInput): BaselineProfileDraft {
  const onboardingV2 = generateOnboardingV2Result({ answers });
  const planSignals = buildPlanSignals(onboardingV2);
  const protocolBiases = buildProtocolBiases(planSignals);
  const recoveryLimiters = limitersFromSignals(planSignals, [
    'sleep_circadian_repair',
    'stress_rhythm_support',
    'performance_recovery'
  ]);
  const nourishmentLimiters = limitersFromSignals(planSignals, [
    'food_quality_foundation',
    'metabolic_stability',
    'digestion_support'
  ]);
  const movementLimiters = limitersFromSignals(planSignals, [
    'movement_reactivation',
    'performance_recovery'
  ]);
  const mindLimiters = limitersFromSignals(planSignals, ['stress_rhythm_support']);

  return {
    user_id: userId,
    sleep_need_minutes_estimate: calculateSleepNeedMinutes(onboardingV2.baseline_mode, onboardingV2.primary_focus),
    preferred_bedtime: asString(answers.bedtime),
    preferred_waketime: asString(answers.wake_time),
    hydration_target_ml: calculateHydrationTargetMl(answers),
    food_constraints: [],
    training_capacity: {
      experience: null,
      weekly_training_days: asString(answers.weekly_training_days),
      equipment: asStringArray(answers.training_types)
    },
    movement_flags: asString(answers.weekly_training_days) === '0' ? ['movement_starting_point'] : [],
    posture_flags: [],
    stress_tendencies: asStringArray(answers.stress_sources),
    digestion_tendencies: buildDigestionTendencies(answers),
    primary_goal: asString(answers.primary_goal),
    initial_foundation_scores: {
      recovery_rhythm: scoreDomain(100 - planSignals.sleep_circadian_repair, recoveryLimiters),
      nourishment: scoreDomain(100 - planSignals.food_quality_foundation, nourishmentLimiters),
      movement_capacity: scoreDomain(100 - planSignals.movement_reactivation, movementLimiters),
      mind_life_load: scoreDomain(100 - planSignals.stress_rhythm_support, mindLimiters),
      plan_signals: planSignals,
      protocol_biases: protocolBiases,
      setup_v2: onboardingV2SetupFromResult(onboardingV2)
    },
    calibration_status: 'calibrating'
  };
}
