import { describe, expect, it } from 'vitest';

import {
  deleteWorkoutSession,
  getWorkoutSessionsForRange,
  saveWorkoutExerciseEntries,
  saveWorkoutSetEntries,
  toExerciseLibraryItemInsert,
  toWorkoutExerciseEntryInsert,
  toWorkoutSessionInsert,
  toWorkoutSetEntryInsert,
  type ExerciseLibraryItemInsert,
  type MovementSupabaseClient,
  type WorkoutExerciseEntryInsert,
  type WorkoutExerciseEntryRow,
  type WorkoutSessionInsert,
  type WorkoutSessionRow,
  type WorkoutSetEntryInsert,
  type WorkoutSetEntryRow
} from '../../../src/features/movement/movementPersistence';

const userId = '00000000-0000-0000-0000-000000000001';

function sessionRow(payload: WorkoutSessionInsert): WorkoutSessionRow {
  return { ...payload, id: 'session-1', created_at: payload.logged_at, updated_at: payload.logged_at };
}

function entryRow(payload: WorkoutExerciseEntryInsert, index = 0): WorkoutExerciseEntryRow {
  return { ...payload, id: `entry-${index + 1}`, created_at: '2026-07-13T18:00:00.000Z', updated_at: '2026-07-13T18:00:00.000Z' };
}

function setRow(payload: WorkoutSetEntryInsert, index = 0): WorkoutSetEntryRow {
  return { ...payload, id: `set-${index + 1}`, created_at: '2026-07-13T18:00:00.000Z', updated_at: '2026-07-13T18:00:00.000Z' };
}

function createClient(calls: Array<{ action: string; table?: string; column?: string; value?: unknown; payload?: unknown }>): MovementSupabaseClient {
  return {
    from(table: string) {
      calls.push({ action: 'from', table });
      const query = {
        insert(payload: ExerciseLibraryItemInsert | WorkoutSessionInsert | WorkoutExerciseEntryInsert | WorkoutSetEntryInsert) {
          calls.push({ action: 'insert', table, payload });
          return {
            select() {
              return {
                single() {
                  const data = table === 'workout_sessions'
                    ? sessionRow(payload as WorkoutSessionInsert)
                    : table === 'workout_exercise_entries'
                      ? entryRow(payload as WorkoutExerciseEntryInsert, calls.filter((call) => call.action === 'insert').length - 1)
                      : table === 'workout_set_entries'
                        ? setRow(payload as WorkoutSetEntryInsert, calls.filter((call) => call.action === 'insert').length - 1)
                      : { ...payload, id: 'library-1', created_at: '2026-07-13T18:00:00.000Z', updated_at: '2026-07-13T18:00:00.000Z' };
                  return Promise.resolve({ data, error: null });
                }
              };
            }
          };
        },
        select() {
          return query;
        },
        eq(column: string, value: string | boolean) {
          calls.push({ action: 'eq', table, column, value });
          return query;
        },
        gte(column: string, value: string) {
          calls.push({ action: 'gte', table, column, value });
          return query;
        },
        lte(column: string, value: string) {
          calls.push({ action: 'lte', table, column, value });
          return query;
        },
        order(column: string, value: unknown) {
          calls.push({ action: 'order', table, column, value });
          return query;
        },
        limit(value: number) {
          calls.push({ action: 'limit', table, value });
          return Promise.resolve({ data: [], error: null });
        },
        update(payload: unknown) {
          calls.push({ action: 'update', table, payload });
          return query;
        },
        delete() {
          calls.push({ action: 'delete', table });
          const deleteQuery = {
            eq(column: string, value: string) {
              calls.push({ action: 'delete_eq', table, column, value });
              return deleteQuery;
            },
            then<TResult1 = { data: null; error: null }>(onfulfilled?: ((value: { data: null; error: null }) => TResult1 | PromiseLike<TResult1>) | null) {
              return Promise.resolve({ data: null, error: null }).then(onfulfilled ?? ((value) => value as TResult1));
            }
          };
          return deleteQuery;
        }
      };
      return query;
    }
  } as unknown as MovementSupabaseClient;
}

describe('Movement persistence', () => {
  it('maps exercise library fields and preserves arrays', () => {
    const muscles = ['legs'];
    const payload = toExerciseLibraryItemInsert({
      name: ' Goblet Squat ',
      category: 'strength',
      movement_pattern: 'squat',
      primary_muscles: muscles,
      equipment: ['dumbbell'],
      is_default: true,
      source: 'default',
      reason_codes: ['starter_library']
    }, userId);

    payload.primary_muscles.push('core');
    expect(payload.name).toBe('Goblet Squat');
    expect(payload.user_id).toBe(userId);
    expect(muscles).toEqual(['legs']);
  });

  it('maps required and optional workout session fields', () => {
    const payload = toWorkoutSessionInsert({
      logged_at: '2026-07-13T18:00:00.000Z',
      title: ' Strength ',
      workout_type: 'strength',
      duration_minutes: 45,
      perceived_effort: 7,
      session_note: ' Good pace ',
      reason_codes: ['manual_workout_log']
    }, userId);

    expect(payload).toMatchObject({ user_id: userId, session_date: '2026-07-13', title: 'Strength', duration_minutes: 45, perceived_effort: 7, session_note: 'Good pace' });
    expect(payload.reason_codes).toEqual(['manual_workout_log']);
  });

  it('maps required and sparse exercise entry fields', () => {
    const payload = toWorkoutExerciseEntryInsert({
      workout_session_id: 'session-1',
      exercise_name: ' Bike ',
      category: 'cardio',
      duration_minutes: 20
    }, userId);

    expect(payload).toMatchObject({ user_id: userId, exercise_name: 'Bike', duration_minutes: 20, sets: null, reps: null, weight: null, effort: null });
  });

  it('maps set-level continuity fields without inventing values', () => {
    const payload = toWorkoutSetEntryInsert({
      workout_session_id: 'session-1',
      workout_exercise_entry_id: 'entry-1',
      set_index: 1,
      weight: 24,
      reps: 8,
      rpe: 7.5,
      rest_seconds: 90,
      completed_at: '2026-07-13T18:05:00.000Z'
    }, userId);

    expect(payload).toMatchObject({ user_id: userId, set_index: 1, weight: 24, reps: 8, rpe: 7.5, rest_seconds: 90 });
    expect(payload.reason_codes).toContain('quick_set_log');
  });

  it('saves multiple exercise entries without losing ordering', async () => {
    const calls: Array<{ action: string; table?: string; column?: string; value?: unknown; payload?: unknown }> = [];
    const rows = await saveWorkoutExerciseEntries(createClient(calls), userId, [
      { workout_session_id: 'session-1', exercise_name: 'Squat', category: 'strength', order_index: 0 },
      { workout_session_id: 'session-1', exercise_name: 'Row', category: 'strength', order_index: 1 }
    ]);

    expect(rows.map((row) => row.order_index)).toEqual([0, 1]);
    expect(calls.filter((call) => call.action === 'insert')).toHaveLength(2);
  });

  it('saves multiple set entries with their exercise relationship', async () => {
    const calls: Array<{ action: string; table?: string; column?: string; value?: unknown; payload?: unknown }> = [];
    const rows = await saveWorkoutSetEntries(createClient(calls), userId, [
      { workout_session_id: 'session-1', workout_exercise_entry_id: 'entry-1', set_index: 1, reps: 8 },
      { workout_session_id: 'session-1', workout_exercise_entry_id: 'entry-1', set_index: 2, reps: 7 }
    ]);

    expect(rows.map((row) => row.set_index)).toEqual([1, 2]);
    expect(calls.filter((call) => call.table === 'workout_set_entries' && call.action === 'insert')).toHaveLength(2);
  });

  it('uses user-scoped range filters', async () => {
    const calls: Array<{ action: string; table?: string; column?: string; value?: unknown; payload?: unknown }> = [];
    await getWorkoutSessionsForRange(createClient(calls), userId, '2026-07-07', '2026-07-13');

    expect(calls).toEqual(expect.arrayContaining([
      { action: 'eq', table: 'workout_sessions', column: 'user_id', value: userId },
      { action: 'gte', table: 'workout_sessions', column: 'session_date', value: '2026-07-07' },
      { action: 'lte', table: 'workout_sessions', column: 'session_date', value: '2026-07-13' }
    ]));
  });

  it('deletes only the provided user session', async () => {
    const calls: Array<{ action: string; table?: string; column?: string; value?: unknown; payload?: unknown }> = [];
    await deleteWorkoutSession(createClient(calls), userId, 'session-1');

    expect(calls).toEqual(expect.arrayContaining([
      { action: 'delete_eq', table: 'workout_sessions', column: 'id', value: 'session-1' },
      { action: 'delete_eq', table: 'workout_sessions', column: 'user_id', value: userId }
    ]));
  });
});
