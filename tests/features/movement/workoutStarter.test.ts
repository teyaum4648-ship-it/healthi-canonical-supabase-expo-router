import { describe, expect, it } from 'vitest';

import {
  addMovement,
  applyStarterToQuickDraft,
  applySource,
  canStart,
  createStarterDraft,
  createStarterMovement,
  moveMovement,
  recentSources,
  removeMovement,
  routineSource,
  minimumSets,
  movementDisplayName,
  starterFromQuickDraft,
  starterTitle,
  starterWorkoutType,
  templateSource,
  toQuickWorkoutDraft,
  updateMovement
} from '../../../src/features/movement/workoutStarter';
import type { WorkoutExerciseEntryRow, WorkoutSessionRow } from '../../../src/features/movement/movementPersistence';
import type { Routine } from '../../../src/features/movement/routineStore';
import { createQuickExerciseDraft, type QuickWorkoutDraft } from '../../../src/features/movement/workoutQuickLog';
import { workoutTemplates } from '../../../src/features/movement/workoutForms';

function draftWith(...names: string[]) {
  return names.reduce((draft, name) => addMovement(draft, createStarterMovement(name)), createStarterDraft());
}

function session(overrides: Partial<WorkoutSessionRow> = {}): WorkoutSessionRow {
  return {
    id: 's1',
    user_id: 'demo-user',
    logged_at: '2026-09-12T18:00:00.000Z',
    session_date: '2026-09-12',
    title: 'Upper push',
    workout_type: 'strength',
    duration_minutes: 45,
    perceived_effort: 7,
    readiness_before: null,
    session_note: null,
    source: 'demo',
    source_confidence: 'medium',
    reason_codes: [],
    created_at: '2026-09-12T18:00:00.000Z',
    updated_at: '2026-09-12T18:00:00.000Z',
    ...overrides
  };
}

function entry(overrides: Partial<WorkoutExerciseEntryRow> = {}): WorkoutExerciseEntryRow {
  return {
    id: 'e1',
    user_id: 'demo-user',
    workout_session_id: 's1',
    exercise_library_item_id: null,
    exercise_name: 'Bench Press',
    category: 'strength',
    order_index: 0,
    sets: 3,
    reps: 8,
    weight: 135,
    weight_unit: 'lb',
    distance: null,
    duration_minutes: null,
    effort: null,
    notes: null,
    source: 'demo',
    source_confidence: 'medium',
    reason_codes: [],
    created_at: '2026-09-12T18:00:00.000Z',
    updated_at: '2026-09-12T18:00:00.000Z',
    ...overrides
  };
}

const formatDate = (value: string) => value.slice(5);

describe('the draft someone is about to start', () => {
  it('will not start on rows nobody filled in', () => {
    expect(canStart(createStarterDraft())).toBe(false);
    expect(canStart(addMovement(createStarterDraft()))).toBe(false);
    expect(canStart(draftWith('Back Squat'))).toBe(true);
  });

  it('lets the movements name a session nobody named', () => {
    // A blank name is ordinary, so it is filled in rather than refused.
    expect(starterTitle(draftWith('Back Squat'))).toBe('Back Squat');
    expect(starterTitle(draftWith('Back Squat', 'Row', 'Plank'))).toBe('Back Squat + 2');
    expect(starterTitle({ ...draftWith('Back Squat'), title: '  Leg day  ' })).toBe('Leg day');
    expect(starterTitle(createStarterDraft())).toBe('');
  });

  it('reads the session type off the movements rather than asking', () => {
    expect(starterWorkoutType(draftWith('Back Squat', 'Bench Press'))).toBe('strength');
    const mixed = addMovement(draftWith('Back Squat'), createStarterMovement('Easy Walk', 'cardio'));
    expect(starterWorkoutType(mixed)).toBe('mixed');
  });

  it('edits, reorders and removes without disturbing the rest', () => {
    const draft = draftWith('Squat', 'Row', 'Plank');
    const [, second] = draft.movements;
    expect(updateMovement(draft, second.id, { sets: 5 }).movements[1].sets).toBe(5);
    expect(moveMovement(draft, second.id, -1).movements.map((m) => m.name)).toEqual(['Row', 'Squat', 'Plank']);
    expect(moveMovement(draft, draft.movements[0].id, -1).movements.map((m) => m.name)).toEqual(['Squat', 'Row', 'Plank']);
    expect(removeMovement(draft, second.id).movements.map((m) => m.name)).toEqual(['Squat', 'Plank']);
  });
});

describe('the things you can start from', () => {
  it('describes a saved routine in movements and sets', () => {
    const routine: Routine = {
      id: 'r1',
      title: 'Upper push',
      workout_type: 'strength',
      exercises: [
        { id: 'x1', exercise_name: 'Bench Press', exercise_library_item_id: 'lib-1', category: 'strength', sets: 3 },
        { id: 'x2', exercise_name: 'Overhead Press', exercise_library_item_id: null, category: 'strength', sets: 2 }
      ],
      created_at: '2026-09-01T00:00:00.000Z',
      updated_at: '2026-09-01T00:00:00.000Z'
    };
    const source = routineSource(routine);
    expect(source).toMatchObject({ kind: 'Routines', title: 'Upper push', detail: '2 movements · 5 sets' });
    // The library link has to survive, or the started session loses its history.
    expect(source.movements[0].library_item_id).toBe('lib-1');
  });

  it('describes a starting point by what it asks of the day', () => {
    const source = templateSource(workoutTemplates[0]);
    expect(source.kind).toBe('Templates');
    expect(source.detail).toContain('movements');
    expect(source.detail).toContain('min');
  });

  it('offers a past session once, however many times it was trained', () => {
    const sources = recentSources({
      sessions: [
        session({ id: 's1', session_date: '2026-09-12', title: 'Upper push' }),
        session({ id: 's2', session_date: '2026-09-09', title: 'upper push' }),
        session({ id: 's3', session_date: '2026-09-10', title: 'Lower body' })
      ],
      entries: [
        entry({ id: 'e1', workout_session_id: 's1', exercise_name: 'Bench Press', order_index: 1 }),
        entry({ id: 'e2', workout_session_id: 's1', exercise_name: 'Overhead Press', order_index: 0 }),
        entry({ id: 'e3', workout_session_id: 's2', exercise_name: 'Bench Press' }),
        entry({ id: 'e4', workout_session_id: 's3', exercise_name: 'Back Squat' })
      ],
      formatDate
    });
    expect(sources.map((source) => source.title)).toEqual(['Upper push', 'Lower body']);
    // Newest first, and the movements come back in the order they were trained.
    expect(sources[0].movements.map((movement) => movement.name)).toEqual(['Overhead Press', 'Bench Press']);
    expect(sources[0].detail).toBe('09-12 · 2 movements');
  });

  it('skips a past session whose movements were not kept', () => {
    // An empty start is worse than no offer: it looks like a routine and does nothing.
    const sources = recentSources({ sessions: [session()], entries: [], formatDate });
    expect(sources).toEqual([]);
  });

  it('replaces the draft when a source is chosen, with ids of its own', () => {
    const source = templateSource(workoutTemplates[0]);
    const applied = applySource(source);
    expect(applied.title).toBe(source.title);
    expect(applied.movements.map((movement) => movement.name))
      .toEqual(source.movements.map((movement) => movement.name));
    expect(applied.movements[0].id).not.toBe(source.movements[0].id);
  });
});

describe('handing the draft to the session logger', () => {
  it('drops unfilled rows and keeps the planned sets', () => {
    const draft = addMovement(
      updateMovement(draftWith('Back Squat'), draftWith('Back Squat').movements[0].id, {}),
      createStarterMovement('', 'strength')
    );
    const quick = toQuickWorkoutDraft({ ...draft, title: 'Leg day' }, { weightUnit: 'kg', startedAt: '2026-09-14T12:00:00.000Z' });
    expect(quick).toMatchObject({ title: 'Leg day', workout_type: 'strength', weight_unit: 'kg' });
    expect(quick?.exercises).toHaveLength(1);
    expect(quick?.exercises[0].sets).toHaveLength(3);
    expect(quick?.exercises[0].exercise_name).toBe('Back Squat');
  });

  it('writes the name the way it will be read back', () => {
    // "bench" typed in a hurry should not leave a recap saying "First measurement for
    // bench" — but deliberate capitals are someone's spelling, not a mistake.
    expect(movementDisplayName('bench')).toBe('Bench');
    expect(movementDisplayName('  seated   press ')).toBe('Seated Press');
    expect(movementDisplayName('RDL')).toBe('RDL');
    expect(movementDisplayName('McGill big 3')).toBe('McGill Big 3');
    const quick = toQuickWorkoutDraft(draftWith('bench', 'seated press'));
    expect(quick?.exercises.map((exercise) => exercise.exercise_name)).toEqual(['Bench', 'Seated Press']);
    expect(quick?.title).toBe('Bench + 1');
  });

  it('returns nothing rather than an empty session', () => {
    expect(toQuickWorkoutDraft(createStarterDraft())).toBeNull();
    expect(toQuickWorkoutDraft(addMovement(createStarterDraft()))).toBeNull();
  });
});

describe('editing a session that is already running', () => {
  function live(): QuickWorkoutDraft {
    const bench = createQuickExerciseDraft('Bench Press', 'strength', 3, 'lib-1');
    // Two sets are done; the third is still empty.
    bench.sets[0] = { ...bench.sets[0], weight: '135', reps: '8', completed: true };
    bench.sets[1] = { ...bench.sets[1], weight: '135', reps: '8', completed: true };
    return {
      title: 'Upper push',
      workout_type: 'strength',
      started_at: '2026-09-14T18:00:00.000Z',
      weight_unit: 'lb',
      exercises: [bench, createQuickExerciseDraft('Overhead Press', 'strength', 3)]
    };
  }

  it('opens the running session as the screen that built it', () => {
    const draft = live();
    const starter = starterFromQuickDraft(draft);
    expect(starter.title).toBe('Upper push');
    expect(starter.movements.map((movement) => movement.name)).toEqual(['Bench Press', 'Overhead Press']);
    expect(starter.movements[0]).toMatchObject({ sets: 3, logged_sets: 2, library_item_id: 'lib-1' });
    // The ids are the session's own, which is what identifies a movement on the way back.
    expect(starter.movements.map((movement) => movement.id))
      .toEqual(draft.exercises.map((exercise) => exercise.id));
  });

  it('keeps every logged set when a movement is trimmed', () => {
    // The floor is what has been done, not what the stepper was set to.
    const draft = live();
    const starter = starterFromQuickDraft(draft);
    expect(minimumSets(starter.movements[0])).toBe(2);
    const trimmed = updateMovement(starter, starter.movements[0].id, { sets: 1 });
    const applied = applyStarterToQuickDraft(draft, trimmed);
    expect(applied.exercises[0].sets).toHaveLength(2);
    expect(applied.exercises[0].sets.every((set) => set.completed)).toBe(true);
    expect(applied.exercises[0].sets.map((set) => set.set_index)).toEqual([1, 2]);
  });

  it('drops the empty rows first when a count comes down', () => {
    const draft = live();
    const starter = starterFromQuickDraft(draft);
    const trimmed = updateMovement(starter, starter.movements[1].id, { sets: 1 });
    expect(applyStarterToQuickDraft(draft, trimmed).exercises[1].sets).toHaveLength(1);
  });

  it('adds a movement empty and leaves the logged one untouched', () => {
    const draft = live();
    const starter = addMovement(starterFromQuickDraft(draft), createStarterMovement('Face Pull', 'strength', 2));
    const applied = applyStarterToQuickDraft(draft, starter);
    expect(applied.exercises.map((exercise) => exercise.exercise_name))
      .toEqual(['Bench Press', 'Overhead Press', 'Face Pull']);
    expect(applied.exercises[2].sets).toHaveLength(2);
    expect(applied.exercises[0].sets.filter((set) => set.completed)).toHaveLength(2);
  });

  it('removes a movement the editor removed, and reorders to match', () => {
    const draft = live();
    const starter = starterFromQuickDraft(draft);
    const removed = removeMovement(starter, starter.movements[1].id);
    expect(applyStarterToQuickDraft(draft, removed).exercises.map((exercise) => exercise.exercise_name))
      .toEqual(['Bench Press']);
    const reordered = moveMovement(starter, starter.movements[1].id, -1);
    expect(applyStarterToQuickDraft(draft, reordered).exercises.map((exercise) => exercise.exercise_name))
      .toEqual(['Overhead Press', 'Bench Press']);
  });

  it('renames in place rather than starting the movement over', () => {
    const draft = live();
    const starter = starterFromQuickDraft(draft);
    const renamed = updateMovement(starter, starter.movements[0].id, { name: 'Incline Bench' });
    const applied = applyStarterToQuickDraft(draft, renamed);
    expect(applied.exercises[0].exercise_name).toBe('Incline Bench');
    expect(applied.exercises[0].sets.filter((set) => set.completed)).toHaveLength(2);
  });

  it('refuses to empty a running session', () => {
    // Clearing every row is a slip, not an instruction to throw the workout away.
    const draft = live();
    const emptied = { title: 'Upper push', movements: [] };
    expect(applyStarterToQuickDraft(draft, emptied)).toBe(draft);
  });
});
