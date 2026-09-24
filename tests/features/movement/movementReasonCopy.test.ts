import { describe, expect, it } from 'vitest';

import { movementReasonLines } from '../../../src/features/movement/movementReasonCopy';

describe('movementReasonLines', () => {
  it('turns engine codes into sentences and drops bookkeeping codes', () => {
    const lines = movementReasonLines(['weekly_workouts_available', 'weekly_minutes_available', 'strength_sessions_logged', 'adaptive_plan_from_readiness', 'demo_movement_data']);
    expect(lines).toEqual(['Strength is in this week.']);
  });

  it('puts safety and today’s capacity ahead of what the week contains', () => {
    const lines = movementReasonLines(['strength_sessions_logged', 'cardio_sessions_logged', 'readiness_suggests_lighter_day', 'training_limited_by_safety']);
    expect(lines).toEqual([
      'A safety flag is keeping today’s suggestions easier.',
      'Today’s readiness points to a lighter session.',
      'Strength is in this week.'
    ]);
  });

  it('never shows an underscore or a title-cased code', () => {
    const all = movementReasonLines([
      'no_workouts_logged', 'limited_workout_history', 'mobility_recovery_underrepresented', 'sleep_context_unknown',
      'nutrition_context_unknown', 'movement_mix_balanced', 'recent_high_effort', 'readiness_supports_build'
    ], 20);
    expect(all.length).toBe(8);
    for (const line of all) expect(line).not.toMatch(/_|\b[A-Z][a-z]+ [A-Z][a-z]+ [A-Z]/);
  });
});
