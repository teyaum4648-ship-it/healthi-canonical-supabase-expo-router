import type {
  BaselineDomainScore,
  BaselinePlanSignals,
  BaselineProfileDraft,
  BaselineProfileInput,
  OnboardingAnswerValue,
  OnboardingAnswers
} from '../../types/onboarding';
import { generateLifestylePlan } from './generateLifestylePlan';

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

function calculateSleepNeedMinutes(answers: OnboardingAnswers) {
  const planResult = generateLifestylePlan(answers);

  if (
    planResult.tags.includes('hpaFatigue') ||
    planResult.tags.includes('poorSleep') ||
    planResult.tags.includes('overtraining')
  ) {
    return 540;
  }

  if (planResult.scores.sleepScore >= 40) {
    return 510;
  }

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

function buildPlanSignals(answers: OnboardingAnswers): BaselinePlanSignals {
  const result = generateLifestylePlan(answers);

  return {
    sleep_circadian_repair: result.scores.sleepScore,
    stress_rhythm_support: result.scores.stressScore,
    food_quality_foundation: result.scores.dietScore,
    metabolic_stability: result.tags.includes('bloodSugarDysregulation') ? 85 : 25,
    digestion_support: result.scores.digestiveScore,
    movement_reactivation: result.tags.includes('sedentary') ? 85 : result.scores.activityScore,
    performance_recovery: result.tags.includes('overtraining') ? 90 : result.scores.activityScore
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
  const planResult = generateLifestylePlan(answers);
  const planSignals = buildPlanSignals(answers);
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
    sleep_need_minutes_estimate: calculateSleepNeedMinutes(answers),
    preferred_bedtime: asString(answers.bedtime),
    preferred_waketime: asString(answers.wake_time),
    hydration_target_ml: calculateHydrationTargetMl(answers),
    food_constraints: [],
    training_capacity: {
      experience: null,
      weekly_training_days: asString(answers.weekly_training_days),
      equipment: asStringArray(answers.training_types)
    },
    movement_flags: planResult.tags.includes('sedentary') ? ['sedentary_start'] : [],
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
      protocol_biases: protocolBiases
    },
    calibration_status: 'calibrating'
  };
}
