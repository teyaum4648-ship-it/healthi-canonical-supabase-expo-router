import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  addDemoWorkoutExerciseEntries,
  addDemoWorkoutSession,
  addDemoWorkoutSetEntries,
  clearDemoMovementData,
  deleteDemoWorkoutExerciseEntry,
  deleteDemoWorkoutSession,
  deserializeDemoWorkoutExerciseEntries,
  deserializeDemoWorkoutSessions,
  deserializeDemoWorkoutSetEntries,
  getLocalDemoMovementState,
  readDemoWorkoutExerciseEntries,
  readDemoWorkoutSessions,
  readDemoWorkoutSetEntries,
  serializeDemoWorkoutExerciseEntries,
  serializeDemoWorkoutSessions,
  serializeDemoWorkoutSetEntries,
  updateDemoWorkoutSession
} from '../../../src/features/movement/localDemoMovementStore';
import type { WorkoutExerciseEntryRow, WorkoutSessionRow, WorkoutSetEntryRow } from '../../../src/features/movement/movementPersistence';

const storage = vi.hoisted(() => new Map<string, string>());

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn((key: string) => Promise.resolve(storage.get(key) ?? null)),
    setItem: vi.fn((key: string, value: string) => {
      storage.set(key, value);
      return Promise.resolve();
    }),
    removeItem: vi.fn((key: string) => {
      storage.delete(key);
      return Promise.resolve();
    })
  }
}));

function session(overrides: Partial<WorkoutSessionRow> = {}): WorkoutSessionRow {
  return {
    id: 'local-workout-1',
    user_id: 'demo-user',
    logged_at: '2026-07-13T18:00:00.000Z',
    session_date: '2026-07-13',
    title: 'Easy Cardio',
    workout_type: 'cardio',
    duration_minutes: 30,
    perceived_effort: 4,
    readiness_before: null,
    session_note: null,
    source: 'demo',
    source_confidence: 'medium',
    reason_codes: ['manual_workout_log', 'demo_movement_data'],
    created_at: '2026-07-13T18:00:00.000Z',
    updated_at: '2026-07-13T18:00:00.000Z',
    ...overrides
  };
}

function entry(overrides: Partial<WorkoutExerciseEntryRow> = {}): WorkoutExerciseEntryRow {
  return {
    id: 'local-entry-1',
    user_id: 'demo-user',
    workout_session_id: 'local-workout-1',
    exercise_library_item_id: null,
    exercise_name: 'Easy Cardio',
    category: 'cardio',
    order_index: 0,
    sets: null,
    reps: null,
    weight: null,
    distance: null,
    duration_minutes: 30,
    effort: 4,
    notes: null,
    source: 'demo',
    source_confidence: 'medium',
    reason_codes: ['manual_workout_log', 'demo_movement_data'],
    created_at: '2026-07-13T18:00:00.000Z',
    updated_at: '2026-07-13T18:00:00.000Z',
    ...overrides
  };
}

function setEntry(overrides: Partial<WorkoutSetEntryRow> = {}): WorkoutSetEntryRow {
  return {
    id: 'local-set-1',
    user_id: 'demo-user',
    workout_session_id: 'local-workout-1',
    workout_exercise_entry_id: 'local-entry-1',
    set_index: 1,
    weight: 20,
    reps: 8,
    rpe: 7,
    rest_seconds: 90,
    completed_at: '2026-07-13T18:05:00.000Z',
    notes: null,
    source: 'demo',
    source_confidence: 'medium',
    reason_codes: ['manual_workout_log', 'quick_set_log', 'demo_movement_data'],
    created_at: '2026-07-13T18:00:00.000Z',
    updated_at: '2026-07-13T18:00:00.000Z',
    ...overrides
  };
}

describe('local demo Movement store', () => {
  beforeEach(() => storage.clear());

  it('serializes and deserializes workout sessions, exercises, and sets', () => {
    expect(deserializeDemoWorkoutSessions(serializeDemoWorkoutSessions([session()]))).toEqual([session()]);
    expect(deserializeDemoWorkoutExerciseEntries(serializeDemoWorkoutExerciseEntries([entry()]))).toEqual([entry()]);
    expect(deserializeDemoWorkoutSetEntries(serializeDemoWorkoutSetEntries([setEntry()]))).toEqual([setEntry()]);
  });

  it('returns empty arrays for missing or malformed data', async () => {
    expect(deserializeDemoWorkoutSessions(null)).toEqual([]);
    expect(deserializeDemoWorkoutSessions('not-json')).toEqual([]);
    expect(deserializeDemoWorkoutExerciseEntries(JSON.stringify([{ id: 'partial' }]))).toEqual([]);
    expect(await getLocalDemoMovementState()).toEqual({ exerciseLibrary: [], workoutSessions: [], workoutExerciseEntries: [], workoutSetEntries: [] });
  });

  it('adds, updates, and deletes a workout session', async () => {
    await addDemoWorkoutSession(session());
    expect(await readDemoWorkoutSessions()).toHaveLength(1);

    await updateDemoWorkoutSession(session({ title: 'Updated Cardio' }));
    expect((await readDemoWorkoutSessions())[0].title).toBe('Updated Cardio');

    await deleteDemoWorkoutSession('local-workout-1');
    expect(await readDemoWorkoutSessions()).toEqual([]);
  });

  it('adds and deletes exercise entries', async () => {
    await addDemoWorkoutExerciseEntries([entry(), entry({ id: 'local-entry-2', exercise_name: 'Walk' })]);
    await addDemoWorkoutSetEntries([setEntry()]);
    expect(await readDemoWorkoutExerciseEntries()).toHaveLength(2);

    await deleteDemoWorkoutExerciseEntry('local-entry-1');
    expect((await readDemoWorkoutExerciseEntries()).map((item) => item.id)).toEqual(['local-entry-2']);
    expect(await readDemoWorkoutSetEntries()).toEqual([]);
  });

  it('deleting a session also removes its exercise entries', async () => {
    await addDemoWorkoutSession(session());
    await addDemoWorkoutExerciseEntries([entry()]);
    await addDemoWorkoutSetEntries([setEntry()]);
    await deleteDemoWorkoutSession('local-workout-1');

    expect(await readDemoWorkoutExerciseEntries()).toEqual([]);
    expect(await readDemoWorkoutSetEntries()).toEqual([]);
  });

  it('clears all local Movement keys', async () => {
    await addDemoWorkoutSession(session());
    await addDemoWorkoutExerciseEntries([entry()]);
    await addDemoWorkoutSetEntries([setEntry()]);
    await clearDemoMovementData();

    expect(await getLocalDemoMovementState()).toEqual({ exerciseLibrary: [], workoutSessions: [], workoutExerciseEntries: [], workoutSetEntries: [] });
  });
});
