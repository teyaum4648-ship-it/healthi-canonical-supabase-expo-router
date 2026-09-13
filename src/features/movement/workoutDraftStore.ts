import AsyncStorage from '@react-native-async-storage/async-storage';

import { isWeightUnit, DEFAULT_WEIGHT_UNIT } from './weightUnits';
import type { QuickWorkoutDraft } from './workoutQuickLog';

/**
 * Crash-safe storage for the workout in progress.
 *
 * A logged workout is the one thing a training app cannot afford to lose: it is
 * unrecoverable by the user, unlike a plan or a preference. The draft is written
 * on every edit (debounced by the caller) and rehydrated on mount, so a phone
 * call, a backgrounded app, or a crash mid-set costs nothing.
 */

const STORAGE_KEY = 'healthi:movement:workoutDraft:v1';

const isUuid = (value: string | null | undefined): value is string =>
  Boolean(value?.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i));

export function workoutDraftScope(userId: string | null | undefined): string {
  return isUuid(userId) ? userId : 'demo';
}

function keyFor(scope: string): string {
  return `${STORAGE_KEY}:${scope}`;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function asNumberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * Validate a stored draft field by field.
 *
 * A draft written by an older build must never crash the Move tab, so anything
 * unrecognised is dropped rather than trusted, and a draft with no usable
 * exercises is treated as absent.
 */
export function parseWorkoutDraft(value: unknown): QuickWorkoutDraft | null {
  const record = asRecord(value);
  if (!record) return null;
  const startedAt = asString(record.started_at);
  const title = asString(record.title);
  if (!startedAt || title === null) return null;
  if (!Array.isArray(record.exercises)) return null;

  const exercises = record.exercises.flatMap((item) => {
    const exercise = asRecord(item);
    if (!exercise) return [];
    const id = asString(exercise.id);
    const name = asString(exercise.exercise_name);
    const category = asString(exercise.category);
    if (!id || name === null || !category) return [];
    if (!Array.isArray(exercise.sets)) return [];

    const sets = exercise.sets.flatMap((entry) => {
      const set = asRecord(entry);
      if (!set) return [];
      const setId = asString(set.id);
      const setIndex = asNumberOrNull(set.set_index);
      if (!setId || setIndex === null) return [];
      return [{
        id: setId,
        set_index: setIndex,
        weight: asString(set.weight) ?? '',
        reps: asString(set.reps) ?? '',
        rpe: asString(set.rpe) ?? '',
        rest_seconds: asString(set.rest_seconds) ?? '90',
        completed: set.completed === true,
        completed_at: asString(set.completed_at),
        warmup: set.warmup === true
      }];
    });
    if (sets.length === 0) return [];

    const previousSets = Array.isArray(exercise.previous_sets)
      ? exercise.previous_sets.flatMap((entry) => {
          const previous = asRecord(entry);
          const index = previous ? asNumberOrNull(previous.set_index) : null;
          if (!previous || index === null) return [];
          return [{
            set_index: index,
            weight: asNumberOrNull(previous.weight),
            reps: asNumberOrNull(previous.reps),
            rpe: asNumberOrNull(previous.rpe),
            rest_seconds: asNumberOrNull(previous.rest_seconds),
            weight_unit: isWeightUnit(previous.weight_unit) ? previous.weight_unit : null
          }];
        })
      : [];

    return [{
      id,
      exercise_name: name,
      exercise_library_item_id: asString(exercise.exercise_library_item_id),
      category: category as QuickWorkoutDraft['exercises'][number]['category'],
      sets,
      previous_date: asString(exercise.previous_date),
      previous_sets: previousSets
    }];
  });

  if (exercises.length === 0) return null;

  return {
    title,
    workout_type: (asString(record.workout_type) ?? 'other') as QuickWorkoutDraft['workout_type'],
    started_at: startedAt,
    weight_unit: isWeightUnit(record.weight_unit) ? record.weight_unit : DEFAULT_WEIGHT_UNIT,
    note: asString(record.note),
    exercises
  };
}

export async function readWorkoutDraft(scope: string): Promise<QuickWorkoutDraft | null> {
  try {
    const stored = await AsyncStorage.getItem(keyFor(scope));
    if (!stored) return null;
    return parseWorkoutDraft(JSON.parse(stored) as unknown);
  } catch {
    return null;
  }
}

export async function writeWorkoutDraft(scope: string, draft: QuickWorkoutDraft): Promise<void> {
  try {
    await AsyncStorage.setItem(keyFor(scope), JSON.stringify(draft));
  } catch {
    // Storage failures must not interrupt the set in front of the user; the
    // session stays in memory and the next edit retries the write.
  }
}

export async function clearWorkoutDraft(scope: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(keyFor(scope));
  } catch {
    // Nothing to recover from: a stale draft is replaced on the next save.
  }
}
