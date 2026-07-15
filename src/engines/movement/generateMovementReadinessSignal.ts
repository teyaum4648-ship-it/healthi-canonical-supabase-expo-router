import type {
  MovementReadinessInput,
  MovementReadinessLabel,
  MovementReadinessSignal,
  MovementReasonCode
} from './movementTypes';

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function uniqueReasons(reasons: MovementReasonCode[]): MovementReasonCode[] {
  return [...new Set(reasons)];
}

function copyFor(label: MovementReadinessLabel): Pick<MovementReadinessSignal, 'summary' | 'suggested_next_action'> {
  if (label === 'ready_to_build') {
    return {
      summary: 'Your recent movement pattern leaves room for a build session if energy holds.',
      suggested_next_action: 'Choose a focused strength, cardio, or mixed session.'
    };
  }
  if (label === 'steady_maintenance') {
    return {
      summary: 'Your recent training pattern supports a steady session today.',
      suggested_next_action: 'Keep today useful and leave a little capacity in reserve.'
    };
  }
  if (label === 'lighter_day') {
    return {
      summary: 'A lighter session may fit today better.',
      suggested_next_action: 'Choose easy cardio, mobility, or a shorter session.'
    };
  }
  if (label === 'recovery_support') {
    return {
      summary: 'Today is better suited to recovery support and gentle movement.',
      suggested_next_action: 'Use a comfortable walk or mobility reset.'
    };
  }
  return {
    summary: 'Movement is still calibrating.',
    suggested_next_action: 'Log a workout to improve your movement signal.'
  };
}

export function generateMovementReadinessSignal(input: MovementReadinessInput): MovementReadinessSignal {
  const { summary } = input;
  const reasons: MovementReasonCode[] = [...summary.reason_codes];

  if (summary.workout_count === 0) {
    const copy = copyFor('calibrating');
    return {
      label: 'calibrating',
      score: 50,
      training_readiness: 'medium',
      confidence: 'low',
      ...copy,
      reason_codes: uniqueReasons([...reasons, 'movement_data_calibrating'])
    };
  }

  let score = 64;
  if (summary.consistency === 'steady') score += 8;
  if (summary.consistency === 'high_frequency') score -= 5;
  score -= summary.recent_high_effort_count * 10;
  if (input.readiness_mode === 'build' || (input.readiness_score ?? 0) >= 75) {
    score += 8;
    reasons.push('readiness_supports_build');
  }
  if (input.readiness_mode === 'restore') {
    score = Math.min(score, 28);
    reasons.push('restore_mode_active', 'readiness_suggests_lighter_day');
  } else if (input.readiness_mode === 'correct' || (input.readiness_score !== null && input.readiness_score !== undefined && input.readiness_score < 45)) {
    score = Math.min(score, 42);
    reasons.push('readiness_suggests_lighter_day');
  }
  if (input.sleep_signal === 'limited') {
    score = Math.min(score, 48);
    reasons.push('sleep_signal_limited');
  } else if (input.sleep_signal === 'supportive') {
    score += 4;
    reasons.push('sleep_signal_supportive');
  }

  if (input.nutrition_signal === 'supportive') {
    score += 3;
    reasons.push('nutrition_signal_supportive');
  } else if (input.nutrition_signal === 'watch') {
    score -= 4;
    reasons.push('nutrition_signal_watch');
  }

  score = clamp(score);
  const label: MovementReadinessLabel =
    input.readiness_mode === 'restore'
      ? 'recovery_support'
      : score >= 75 && summary.recent_high_effort_count === 0
        ? 'ready_to_build'
        : score >= 55
          ? 'steady_maintenance'
          : 'lighter_day';
  const trainingReadiness = label === 'ready_to_build' ? 'high' : label === 'steady_maintenance' ? 'medium' : 'low';
  const copy = copyFor(label);

  return {
    label,
    score,
    training_readiness: trainingReadiness,
    confidence: summary.confidence,
    ...copy,
    reason_codes: uniqueReasons(reasons)
  };
}
