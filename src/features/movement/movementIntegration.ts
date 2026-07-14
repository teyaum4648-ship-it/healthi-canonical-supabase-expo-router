import type { MovementReadinessSignal, MovementSummary } from '../../engines/movement';
import type { GenerateDayPlanInput } from '../../engines/dayPlan';

export type DashboardMovementSummary = {
  label: string;
  workout_count: number;
  total_minutes: number;
  suggested_next_action: string;
  confidence: MovementReadinessSignal['confidence'];
  source_label: 'logged' | 'demo' | 'calibrating';
};

function titleCase(value: string): string {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function composeDashboardMovementSummary(params: {
  summary: MovementSummary;
  signal: MovementReadinessSignal;
  demoMode?: boolean;
}): DashboardMovementSummary {
  return {
    label: titleCase(params.signal.label),
    workout_count: params.summary.workout_count,
    total_minutes: params.summary.total_minutes,
    suggested_next_action: params.signal.suggested_next_action,
    confidence: params.signal.confidence,
    source_label: params.summary.workout_count === 0 ? 'calibrating' : params.demoMode ? 'demo' : 'logged'
  };
}

export function movementSignalToDayPlanInput(
  signal: MovementReadinessSignal,
  preferredTrainingTime: string | null = null
): NonNullable<GenerateDayPlanInput['movement']> {
  return {
    training_readiness: signal.training_readiness,
    preferred_training_time: preferredTrainingTime,
    reason_codes: [...signal.reason_codes]
  };
}
