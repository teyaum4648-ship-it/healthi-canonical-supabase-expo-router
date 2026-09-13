import { describe, expect, it } from 'vitest';

import type {
  WorkoutExerciseEntryRow,
  WorkoutSessionRow,
  WorkoutSetEntryRow
} from '../../../src/features/movement/movementPersistence';
import {
  attachPreviousWorkout,
  copyPreviousSet,
  createDemoQuickWorkoutRows,
  createQuickWorkoutFromTemplate,
  createQuickWorkoutFromText,
  isMovementLogWithinSafetyGuidance,
  quickWorkoutToInputs,
  removeQuickSetDraft
} from '../../../src/features/movement/workoutQuickLog';
import { workoutTemplates } from '../../../src/features/movement/workoutForms';

const previousSession: WorkoutSessionRow = {
  id: 'previous-session',
  user_id: 'demo-user',
  logged_at: '2026-08-01T17:00:00.000Z',
  session_date: '2026-08-01',
  title: 'Full Body Strength',
  workout_type: 'strength',
  duration_minutes: 42,
  perceived_effort: 7,
  readiness_before: null,
  session_note: null,
  source: 'demo',
  source_confidence: 'medium',
  reason_codes: ['manual_workout_log'],
  created_at: '2026-08-01T17:00:00.000Z',
  updated_at: '2026-08-01T17:00:00.000Z'
};

function previousExercise(overrides: Partial<WorkoutExerciseEntryRow> = {}): WorkoutExerciseEntryRow {
  return {
    id: 'previous-exercise',
    user_id: 'demo-user',
    workout_session_id: previousSession.id,
    exercise_library_item_id: null,
    exercise_name: 'Goblet Squat',
    category: 'strength',
    order_index: 0,
    sets: 2,
    reps: 8,
    weight: 24,
    weight_unit: null,
    distance: null,
    duration_minutes: null,
    effort: 7,
    notes: null,
    source: 'demo',
    source_confidence: 'medium',
    reason_codes: ['manual_workout_log'],
    created_at: previousSession.created_at,
    updated_at: previousSession.updated_at,
    ...overrides
  };
}

function previousSet(setIndex: number, overrides: Partial<WorkoutSetEntryRow> = {}): WorkoutSetEntryRow {
  return {
    id: `previous-set-${setIndex}`,
    user_id: 'demo-user',
    workout_session_id: previousSession.id,
    workout_exercise_entry_id: 'previous-exercise',
    set_index: setIndex,
    weight: 24,
    weight_unit: null,
    warmup: false,
    reps: setIndex === 1 ? 8 : 7,
    rpe: 7.5,
    rest_seconds: 90,
    completed_at: previousSession.logged_at,
    notes: null,
    source: 'demo',
    source_confidence: 'medium',
    reason_codes: ['quick_set_log'],
    created_at: previousSession.created_at,
    updated_at: previousSession.updated_at,
    ...overrides
  };
}

describe('quick workout logging', () => {
  it('keeps restricted days limited to mobility and recovery logs', () => {
    expect(isMovementLogWithinSafetyGuidance(false, 'recovery', ['recovery', 'mobility'])).toBe(true);
    expect(isMovementLogWithinSafetyGuidance(false, 'recovery', ['strength'])).toBe(false);
    expect(isMovementLogWithinSafetyGuidance(false, 'strength', ['mobility'])).toBe(false);
    expect(isMovementLogWithinSafetyGuidance(true, 'strength', ['strength'])).toBe(true);
  });

  it('turns short manual text into a deterministic editable workout', () => {
    const draft = createQuickWorkoutFromText('goblet squat + dumbbell row, mobility flow', '2026-08-04T18:00:00.000Z');

    expect(draft).not.toBeNull();
    expect(draft?.title).toBe('Goblet Squat + 2');
    expect(draft?.workout_type).toBe('mixed');
    expect(draft?.exercises.map((item) => item.exercise_name)).toEqual(['Goblet Squat', 'Dumbbell Row', 'Mobility Flow']);
    expect(draft?.exercises.every((item) => item.sets.length === 3)).toBe(true);
  });

  it('creates one set row per template prescription without changing the template', () => {
    const draft = createQuickWorkoutFromTemplate(workoutTemplates[0], '2026-08-04T18:00:00.000Z');

    expect(draft.exercises[0].sets).toHaveLength(3);
    draft.exercises[0].sets[0].reps = '12';
    expect(workoutTemplates[0].exercises[0].reps).toBe('8');
  });

  it('removes a set, preserves remaining values, and renumbers rows', () => {
    const draft = createQuickWorkoutFromTemplate(workoutTemplates[0], '2026-08-04T18:00:00.000Z');
    const exercise = draft.exercises[0];
    exercise.sets[2].reps = '6';
    const thirdSetId = exercise.sets[2].id;

    const changed = removeQuickSetDraft(exercise, exercise.sets[1].id);
    expect(changed.sets).toHaveLength(2);
    expect(changed.sets.map((set) => set.set_index)).toEqual([1, 2]);
    expect(changed.sets[1]).toMatchObject({ id: thirdSetId, reps: '6' });
    expect(removeQuickSetDraft({ ...changed, sets: [changed.sets[0]] }, changed.sets[0].id).sets).toHaveLength(1);
  });

  it('attaches the latest matching set history and supports one-tap copy', () => {
    const draft = createQuickWorkoutFromText('Goblet Squat', '2026-08-04T18:00:00.000Z');
    expect(draft).not.toBeNull();
    if (!draft) return;

    const withHistory = attachPreviousWorkout(
      { ...draft, title: 'Full Body Strength' },
      [previousSession],
      [previousExercise()],
      [previousSet(1), previousSet(2)]
    );
    const exercise = withHistory.exercises[0];
    expect(exercise.previous_date).toBe('2026-08-01');
    expect(exercise.previous_sets.map((set) => set.reps)).toEqual([8, 7]);
    expect(copyPreviousSet(exercise, 2).sets[1]).toMatchObject({ weight: '24', reps: '7', rpe: '7.5', rest_seconds: '90' });
  });

  it('falls back to aggregate legacy exercise history when set rows do not exist', () => {
    const draft = createQuickWorkoutFromText('Goblet Squat', '2026-08-04T18:00:00.000Z');
    expect(draft).not.toBeNull();
    if (!draft) return;

    const withHistory = attachPreviousWorkout(draft, [previousSession], [previousExercise()], []);
    expect(withHistory.exercises[0].previous_sets).toHaveLength(2);
    expect(withHistory.exercises[0].previous_sets[0]).toMatchObject({ weight: 24, reps: 8, rpe: 7 });
  });

  it('creates set rows and backward-compatible aggregate fields with automatic timestamps', () => {
    const draft = createQuickWorkoutFromText('Goblet Squat', '2026-08-04T18:00:00.000Z');
    expect(draft).not.toBeNull();
    if (!draft) return;
    draft.exercises[0].sets[0] = {
      ...draft.exercises[0].sets[0],
      weight: '24',
      reps: '8',
      rpe: '7.5',
      rest_seconds: '90',
      completed: true
    };

    const result = quickWorkoutToInputs(draft, 'demo', '2026-08-04T18:43:00.000Z');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.session).toMatchObject({ logged_at: '2026-08-04T18:00:00.000Z', session_date: '2026-08-04', duration_minutes: 43, perceived_effort: 8 });
    expect(result.value.session.reason_codes).toContain('automatic_workout_timestamp');
    expect(result.value.exercises[0]).toMatchObject({ sets: 1, reps: 8, weight: 24, effort: 8 });
    expect(result.value.sets[0].input).toMatchObject({ set_index: 1, weight: 24, reps: 8, rpe: 7.5, rest_seconds: 90, completed_at: '2026-08-04T18:43:00.000Z' });

    const rows = createDemoQuickWorkoutRows(result.value, 'demo-user', '2026-08-04T18:43:00.000Z');
    expect(rows.sets[0].workout_exercise_entry_id).toBe(rows.exercises[0].id);
    expect(JSON.parse(JSON.stringify(rows))).toEqual(rows);
  });

  it('ignores untouched rows and rejects malformed set values', () => {
    const draft = createQuickWorkoutFromText('Goblet Squat', '2026-08-04T18:00:00.000Z');
    expect(draft).not.toBeNull();
    if (!draft) return;
    expect(quickWorkoutToInputs(draft).ok).toBe(true);

    draft.exercises[0].sets[0].rpe = '11';
    const invalid = quickWorkoutToInputs(draft);
    expect(invalid).toEqual({
      ok: false,
      error: 'Use valid set values: whole reps/rest, non-negative weight, and RPE from 1 to 10.'
    });
  });
});
