import type {
  AdaptiveMovementCapacity,
  AdaptiveMovementPlan,
  AdaptiveMovementPlanInput,
  AdaptiveMovementPlanReasonCode,
  MovementWorkoutType
} from './movementTypes';

type CapacityProfile = {
  capacity: AdaptiveMovementCapacity;
  verdict: string;
  explanation: string;
  objective: string;
  effort_range: { min: number; max: number };
  recommended_session_types: MovementWorkoutType[];
};

const PROFILES: Record<AdaptiveMovementCapacity, CapacityProfile> = {
  restore: {
    capacity: 'restore',
    verdict: 'Restore capacity today.',
    explanation: 'Gentle movement or rest fits the available signals better than adding meaningful training load.',
    objective: 'Finish with more capacity than you started with.',
    effort_range: { min: 1, max: 3 },
    recommended_session_types: ['recovery', 'mobility']
  },
  technique: {
    capacity: 'technique',
    verdict: 'Make the lighter choice useful.',
    explanation: 'Keep intensity modest and give movement quality more attention than output.',
    objective: 'Practice clean, comfortable movement without chasing fatigue.',
    effort_range: { min: 3, max: 5 },
    recommended_session_types: ['mobility', 'recovery', 'strength', 'cardio']
  },
  build: {
    capacity: 'build',
    verdict: 'Keep the session steady.',
    explanation: 'A useful, controlled session fits better than chasing an all-out effort.',
    objective: 'Build useful work while leaving some capacity in reserve.',
    effort_range: { min: 5, max: 7 },
    recommended_session_types: ['strength', 'cardio', 'mixed', 'sport']
  },
  push: {
    capacity: 'push',
    verdict: 'There is room to build.',
    explanation: 'Your recent pattern supports a focused challenge if your energy remains steady.',
    objective: 'Use the available capacity for one clear training focus.',
    effort_range: { min: 6, max: 8 },
    recommended_session_types: ['strength', 'cardio', 'mixed', 'sport']
  }
};

function uniqueReasons(reasons: AdaptiveMovementPlanReasonCode[]): AdaptiveMovementPlanReasonCode[] {
  return [...new Set(reasons)];
}

function capacityFromInput(input: AdaptiveMovementPlanInput): AdaptiveMovementCapacity {
  if (input.training_allowed === false) return 'restore';
  if (input.signal.label === 'recovery_support') return 'restore';
  if (input.signal.label === 'lighter_day' || input.signal.label === 'calibrating') return 'technique';
  if (input.signal.label === 'steady_maintenance') return 'build';
  return 'push';
}

function movementMixInsight(input: AdaptiveMovementPlanInput): {
  copy: string;
  reason: AdaptiveMovementPlanReasonCode;
} {
  const { summary } = input;
  if (summary.workout_count === 0) {
    return {
      copy: 'Your movement mix will become clearer as sessions are logged.',
      reason: 'movement_data_calibrating'
    };
  }
  if (summary.mobility_recovery_session_count === 0) {
    return {
      copy: 'Mobility and recovery have not appeared in this week’s logs.',
      reason: 'mobility_recovery_underrepresented'
    };
  }
  const represented = [
    summary.strength_session_count,
    summary.cardio_session_count,
    summary.mobility_recovery_session_count
  ].filter((count) => count > 0).length;
  if (represented >= 2) {
    return {
      copy: 'Your recent logs include more than one kind of movement support.',
      reason: 'movement_mix_balanced'
    };
  }
  return {
    copy: 'Your recent movement has centered on one primary session type.',
    reason: 'weekly_workouts_available'
  };
}

export function generateAdaptiveMovementPlan(input: AdaptiveMovementPlanInput): AdaptiveMovementPlan {
  const trainingAllowed = input.training_allowed !== false;
  const capacity = capacityFromInput(input);
  const profile = PROFILES[capacity];
  const reasons: AdaptiveMovementPlanReasonCode[] = [
    ...input.signal.reason_codes,
    'adaptive_plan_from_readiness'
  ];

  if (!trainingAllowed) reasons.push('training_limited_by_safety');
  if (input.signal.label === 'calibrating') reasons.push('calibration_session_recommended');
  if ((input.sleep_signal ?? 'unknown') === 'unknown') reasons.push('sleep_context_unknown');
  if ((input.nutrition_signal ?? 'unknown') === 'unknown') reasons.push('nutrition_context_unknown');

  const mix = movementMixInsight(input);
  reasons.push(mix.reason);

  const sleepState = input.sleep_signal ?? 'unknown';
  const nutritionState = input.nutrition_signal ?? 'unknown';

  return {
    ...profile,
    readiness_score: input.signal.score,
    confidence: input.signal.confidence,
    agenda: [
      { timing: 'now', guidance: 'Choose a session that matches today’s useful range.' },
      { timing: 'next', guidance: 'Keep effort responsive rather than forcing the planned number.' },
      { timing: 'later', guidance: 'Log what you completed so the next suggestion can adapt.' }
    ],
    support: [
      {
        key: 'sleep',
        label: 'Sleep',
        state: sleepState,
        summary: sleepState === 'supportive'
          ? 'Recent sleep signals support normal movement capacity.'
          : sleepState === 'limited'
            ? 'Recent sleep signals favor a lighter movement choice.'
            : 'Sleep context is still calibrating for today.'
      },
      {
        key: 'nutrition',
        label: 'Fueling',
        state: nutritionState,
        summary: nutritionState === 'supportive'
          ? 'Logged meals provide supportive fueling context.'
          : nutritionState === 'watch'
            ? 'Available meal context favors a measured session.'
            : 'Fueling context is still calibrating from logged meals.'
      },
      {
        key: 'recent_load',
        label: 'Recent load',
        state: 'available',
        summary: `${input.summary.workout_count} sessions · ${input.summary.total_minutes} minutes in the current window.`
      }
    ],
    movement_mix_insight: mix.copy,
    training_allowed: trainingAllowed,
    reason_codes: uniqueReasons(reasons)
  };
}
