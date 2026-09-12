import AsyncStorage from '@react-native-async-storage/async-storage';

import type { MovementExerciseCategory, MovementWorkoutType } from '../../engines/movement';

/**
 * Saved, editable routines.
 *
 * Local for now, behind the same boundary the protocol and draft stores use.
 * There is no remote table for user routines yet, and this project's migration
 * history has drifted enough that adding one deserves its own deliberate change
 * rather than riding along with a feature. `RoutineStore` is the seam a Supabase
 * implementation drops into.
 */

export type RoutineExercise = {
  id: string;
  exercise_name: string;
  exercise_library_item_id: string | null;
  category: MovementExerciseCategory;
  sets: number;
};

export type Routine = {
  id: string;
  title: string;
  workout_type: MovementWorkoutType;
  exercises: RoutineExercise[];
  created_at: string;
  updated_at: string;
};

const STORAGE_KEY = 'healthi:movement:routines:v1';
const MAX_ROUTINES = 40;
const MAX_EXERCISES = 30;

const isUuid = (value: string | null | undefined): value is string =>
  Boolean(value?.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i));

export function routineScope(userId: string | null | undefined): string {
  return isUuid(userId) ? userId : 'demo';
}

function keyFor(scope: string): string {
  return `${STORAGE_KEY}:${scope}`;
}

let routineSequence = 0;
export function routineId(prefix = 'routine'): string {
  routineSequence += 1;
  return `${prefix}-${Date.now().toString(36)}-${routineSequence.toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

const CATEGORIES: MovementExerciseCategory[] = ['strength', 'cardio', 'mobility', 'recovery', 'sport', 'other'];

/** Anything unrecognised is dropped rather than trusted into the UI. */
export function parseRoutines(value: unknown): Routine[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const record = asRecord(item);
    if (!record) return [];
    const id = asString(record.id);
    const title = asString(record.title);
    if (!id || !title?.trim()) return [];
    if (!Array.isArray(record.exercises)) return [];

    const exercises = record.exercises.flatMap((entry) => {
      const exercise = asRecord(entry);
      if (!exercise) return [];
      const exerciseId = asString(exercise.id);
      const name = asString(exercise.exercise_name);
      if (!exerciseId || !name?.trim()) return [];
      const category = asString(exercise.category);
      const sets = typeof exercise.sets === 'number' && Number.isFinite(exercise.sets)
        ? Math.max(1, Math.min(20, Math.round(exercise.sets)))
        : 3;
      return [{
        id: exerciseId,
        exercise_name: name,
        exercise_library_item_id: asString(exercise.exercise_library_item_id),
        category: (category && CATEGORIES.includes(category as MovementExerciseCategory)
          ? category
          : 'strength') as MovementExerciseCategory,
        sets
      }];
    }).slice(0, MAX_EXERCISES);

    if (exercises.length === 0) return [];

    const now = new Date().toISOString();
    return [{
      id,
      title: title.trim(),
      workout_type: (asString(record.workout_type) ?? 'other') as MovementWorkoutType,
      exercises,
      created_at: asString(record.created_at) ?? now,
      updated_at: asString(record.updated_at) ?? now
    }];
  }).slice(0, MAX_ROUTINES);
}

export async function readRoutines(scope: string): Promise<Routine[]> {
  try {
    const stored = await AsyncStorage.getItem(keyFor(scope));
    if (!stored) return [];
    return parseRoutines(JSON.parse(stored) as unknown);
  } catch {
    return [];
  }
}

export async function writeRoutines(scope: string, routines: Routine[]): Promise<void> {
  try {
    await AsyncStorage.setItem(keyFor(scope), JSON.stringify(routines.slice(0, MAX_ROUTINES)));
  } catch {
    // A failed routine write must never interrupt training; the list stays in
    // memory and the next edit retries.
  }
}

export function upsertRoutine(routines: Routine[], routine: Routine): Routine[] {
  const stamped = { ...routine, updated_at: new Date().toISOString() };
  const index = routines.findIndex((item) => item.id === routine.id);
  if (index < 0) return [stamped, ...routines].slice(0, MAX_ROUTINES);
  const next = [...routines];
  next[index] = stamped;
  return next;
}

export function removeRoutine(routines: Routine[], id: string): Routine[] {
  return routines.filter((routine) => routine.id !== id);
}

/** Capture what was actually trained, so a routine can be saved from a session. */
export function routineFromExercises(
  title: string,
  workoutType: MovementWorkoutType,
  exercises: Array<{ exercise_name: string; exercise_library_item_id: string | null; category: MovementExerciseCategory; setCount: number }>
): Routine | null {
  const usable = exercises.filter((exercise) => exercise.exercise_name.trim());
  if (!title.trim() || usable.length === 0) return null;
  const now = new Date().toISOString();
  return {
    id: routineId(),
    title: title.trim(),
    workout_type: workoutType,
    exercises: usable.slice(0, MAX_EXERCISES).map((exercise) => ({
      id: routineId('routine-exercise'),
      exercise_name: exercise.exercise_name.trim(),
      exercise_library_item_id: exercise.exercise_library_item_id,
      category: exercise.category,
      sets: Math.max(1, Math.min(20, exercise.setCount))
    })),
    created_at: now,
    updated_at: now
  };
}
