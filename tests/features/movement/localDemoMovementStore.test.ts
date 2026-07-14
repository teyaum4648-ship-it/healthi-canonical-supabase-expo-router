import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  addDemoWorkoutExerciseEntries,
  addDemoWorkoutSession,
  clearDemoMovementData,
  deleteDemoWorkoutExerciseEntry,
  deleteDemoWorkoutSession,
  deserializeDemoWorkoutExerciseEntries,
  deserializeDemoWorkoutSessions,
  getLocalDemoMovementState,
  readDemoWorkoutExerciseEntries,
  readDemoWorkoutSessions,
  serializeDemoWorkoutExerciseEntries,
  serializeDemoWorkoutSessions,
  updateDemoWorkoutSession
} from '../../../src/features/movement/localDemoMovementStore';
import type { WorkoutExerciseEntryRow, WorkoutSessionRow } from '../../../src/features/movement/movementPersistence';

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

describe('local demo Movement store', () => {
  beforeEach(() => storage.clear());

  it('serializes and deserializes workout sessions and exercise entries', () => {
    expect(deserializeDemoWorkoutSessions(serializeDemoWorkoutSessions([session()]))).toEqual([session()]);
    expect(deserializeDemoWorkoutExerciseEntries(serializeDemoWorkoutExerciseEntries([entry()]))).toEqual([entry()]);
  });

  it('returns empty arrays for missing or malformed data', async () => {
    expect(deserializeDemoWorkoutSessions(null)).toEqual([]);
    expect(deserializeDemoWorkoutSessions('not-json')).toEqual([]);
    expect(deserializeDemoWorkoutExerciseEntries(JSON.stringify([{ id: 'partial' }]))).toEqual([]);
    expect(await getLocalDemoMovementState()).toEqual({ exerciseLibrary: [], workoutSessions: [], workoutExerciseEntries: [] });
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
    expect(await readDemoWorkoutExerciseEntries()).toHaveLength(2);

    await deleteDemoWorkoutExerciseEntry('local-entry-1');
    expect((await readDemoWorkoutExerciseEntries()).map((item) => item.id)).toEqual(['local-entry-2']);
  });

  it('deleting a session also removes its exercise entries', async () => {
    await addDemoWorkoutSession(session());
    await addDemoWorkoutExerciseEntries([entry()]);
    await deleteDemoWorkoutSession('local-workout-1');

    expect(await readDemoWorkoutExerciseEntries()).toEqual([]);
  });

  it('clears all local Movement keys', async () => {
    await addDemoWorkoutSession(session());
    await addDemoWorkoutExerciseEntries([entry()]);
    await clearDemoMovementData();

    expect(await getLocalDemoMovementState()).toEqual({ exerciseLibrary: [], workoutSessions: [], workoutExerciseEntries: [] });
  });
});
