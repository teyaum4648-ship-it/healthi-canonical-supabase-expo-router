import type {
  MovementExerciseEntry,
  MovementReasonCode,
  MovementSession,
  MovementSummary
} from './movementTypes';

const DAY_MS = 24 * 60 * 60 * 1000;

function safeDate(value: string): number | null {
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? null : parsed;
}

function uniqueReasons(reasons: MovementReasonCode[]): MovementReasonCode[] {
  return [...new Set(reasons)];
}

function sessionLoad(session: MovementSession): number {
  const duration = Math.max(0, session.duration_minutes ?? 0);
  const effort = Math.min(10, Math.max(1, session.perceived_effort ?? 5));
  return Math.round(duration * effort);
}

export function calculateMovementSummary(params: {
  date: string;
  sessions?: MovementSession[];
  exerciseEntries?: MovementExerciseEntry[];
}): MovementSummary {
  const date = params.date.slice(0, 10);
  const endMs = new Date(`${date}T23:59:59.999Z`).getTime();
  const startMs = endMs - 6 * DAY_MS;
  const sessions = (params.sessions ?? []).filter((session) => {
    const value = safeDate(session.logged_at || `${session.session_date}T12:00:00.000Z`);
    return value !== null && value >= startMs && value <= endMs;
  });
  const sessionIds = new Set(sessions.map((session) => session.id));
  const entries = (params.exerciseEntries ?? []).filter((entry) => sessionIds.has(entry.workout_session_id));
  const totalMinutes = sessions.reduce((sum, session) => sum + Math.max(0, session.duration_minutes ?? 0), 0);
  const highEffortCount = sessions.filter((session) => (session.perceived_effort ?? 0) >= 8).length;
  const strengthCount = sessions.filter((session) => session.workout_type === 'strength').length;
  const cardioCount = sessions.filter((session) => session.workout_type === 'cardio').length;
  const mobilityRecoveryCount = sessions.filter(
    (session) => session.workout_type === 'mobility' || session.workout_type === 'recovery'
  ).length;
  const reasons: MovementReasonCode[] = [];

  if (sessions.length === 0) reasons.push('no_workouts_logged', 'movement_data_calibrating');
  if (sessions.length > 0) reasons.push('weekly_workouts_available');
  if (sessions.length === 1) reasons.push('limited_workout_history');
  if (totalMinutes > 0) reasons.push('weekly_minutes_available');
  if (strengthCount > 0) reasons.push('strength_sessions_logged');
  if (cardioCount > 0) reasons.push('cardio_sessions_logged');
  if (mobilityRecoveryCount > 0) reasons.push('mobility_recovery_logged');
  if (highEffortCount === 1) reasons.push('recent_high_effort');
  if (highEffortCount >= 2) reasons.push('recent_high_effort', 'multiple_high_effort_sessions');
  if (entries.length > 0) reasons.push('exercise_entries_available');
  if (sessions.length >= 2 && sessions.length <= 4 && highEffortCount <= 1) reasons.push('consistent_moderate_training');
  if (sessions.some((session) => session.reason_codes.includes('demo_movement_data'))) reasons.push('demo_movement_data');

  const consistency =
    sessions.length === 0 ? 'calibrating' : sessions.length === 1 ? 'starting' : sessions.length <= 4 ? 'steady' : 'high_frequency';
  const confidence = sessions.length >= 3 && sessions.every((session) => session.duration_minutes !== null)
    ? 'high'
    : sessions.length > 0
      ? 'medium'
      : 'low';

  return {
    date,
    window_start: new Date(startMs).toISOString().slice(0, 10),
    workout_count: sessions.length,
    total_minutes: totalMinutes,
    strength_session_count: strengthCount,
    cardio_session_count: cardioCount,
    mobility_recovery_session_count: mobilityRecoveryCount,
    estimated_training_load: sessions.reduce((sum, session) => sum + sessionLoad(session), 0),
    recent_high_effort_count: highEffortCount,
    exercise_entry_count: entries.length,
    consistency,
    confidence,
    reason_codes: uniqueReasons(reasons)
  };
}
