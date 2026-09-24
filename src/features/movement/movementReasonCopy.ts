/**
 * The reasons behind today's movement suggestion, in the words a person would use.
 *
 * The screen used to print the engine's reason codes with the underscores turned into
 * spaces — "Weekly Workouts Available", "Strength Sessions Logged" — which read like a
 * database talking. Codes that are bookkeeping rather than a reason (where the plan came
 * from, whether the data is a demo) have no sentence and are left out.
 *
 * Order is priority: anything about safety or today's capacity outranks what the week
 * contains, so the three lines shown are the three that most explain the suggestion.
 */
const REASON_LINES: [code: string, line: string][] = [
  ['training_limited_by_safety', 'A safety flag is keeping today’s suggestions easier.'],
  ['restore_mode_active', 'Today is set up as a restore day.'],
  ['readiness_suggests_lighter_day', 'Today’s readiness points to a lighter session.'],
  ['multiple_high_effort_sessions', 'Several hard sessions this week, so recovery counts.'],
  ['recent_high_effort', 'You had a hard session recently.'],
  ['readiness_supports_build', 'Today’s readiness supports building.'],
  ['sleep_signal_limited', 'Recent sleep has been short.'],
  ['sleep_signal_supportive', 'Recent sleep supports normal effort.'],
  ['nutrition_signal_watch', 'Recent meals suggest keeping effort measured.'],
  ['nutrition_signal_supportive', 'Recent meals support this session.'],
  ['calibration_session_recommended', 'An easy first session helps calibrate.'],
  ['no_workouts_logged', 'No sessions logged this week yet.'],
  ['limited_workout_history', 'One session so far. Suggestions sharpen as you log.'],
  ['mobility_recovery_underrepresented', 'No mobility or recovery this week.'],
  ['consistent_moderate_training', 'Steady, moderate training this week.'],
  ['movement_mix_balanced', 'Your week mixes more than one kind of session.'],
  ['strength_sessions_logged', 'Strength is in this week.'],
  ['cardio_sessions_logged', 'Cardio is in this week.'],
  ['mobility_recovery_logged', 'Mobility or recovery is in this week.'],
  ['sleep_context_unknown', 'No recent sleep logged yet.'],
  ['nutrition_context_unknown', 'No recent meals logged yet.']
];

export function movementReasonLines(codes: readonly string[], limit = 3): string[] {
  const present = new Set(codes);
  return REASON_LINES.filter(([code]) => present.has(code)).map(([, line]) => line).slice(0, limit);
}
