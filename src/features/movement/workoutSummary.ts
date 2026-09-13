import {
  convertWeightForDisplay,
  formatWeight,
  type WeightUnit
} from './weightUnits';
import { previousSetFor, type QuickExerciseDraft, type QuickWorkoutDraft } from './workoutQuickLog';

/**
 * What changed this session, compared with the last time the same movements
 * were logged.
 *
 * This is the moment the adaptive loop earns belief, so it only states what the
 * logged sets support: a load or rep change on a matched set, or nothing. It
 * never estimates, never scores the session, and stays silent when there is no
 * comparable history instead of inventing encouragement.
 */

export type ExerciseChange = {
  exercise_id: string;
  exercise_name: string;
  /** 'new' when there is no comparable previous set. */
  direction: 'up' | 'down' | 'held' | 'new';
  detail: string;
};

export type WorkoutSummary = {
  title: string;
  /** Completed working sets, excluding warm-ups. */
  working_sets: number;
  warmup_sets: number;
  exercises_logged: number;
  duration_minutes: number | null;
  changes: ExerciseChange[];
  /** Present only when at least one movement had history to compare against. */
  headline: string | null;
};

function numberOrNull(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** The heaviest completed working set, which is what a load comparison should use. */
function topWorkingSet(exercise: QuickExerciseDraft): { weight: number | null; reps: number | null; set_index: number } | null {
  const candidates = exercise.sets
    .filter((set) => !set.warmup && set.completed)
    .map((set) => ({ weight: numberOrNull(set.weight), reps: numberOrNull(set.reps), set_index: set.set_index }))
    .filter((set) => set.weight !== null || set.reps !== null);
  if (candidates.length === 0) return null;
  return candidates.reduce((best, set) => {
    if ((set.weight ?? -1) > (best.weight ?? -1)) return set;
    if ((set.weight ?? -1) === (best.weight ?? -1) && (set.reps ?? -1) > (best.reps ?? -1)) return set;
    return best;
  });
}

function describeChange(
  exercise: QuickExerciseDraft,
  sessionUnit: WeightUnit
): ExerciseChange {
  const today = topWorkingSet(exercise);
  const base = { exercise_id: exercise.id, exercise_name: exercise.exercise_name };
  if (!today) return { ...base, direction: 'new', detail: 'No completed sets' };

  const previous = previousSetFor(exercise, today.set_index);
  if (!previous) return { ...base, direction: 'new', detail: 'First time logged' };

  // Compare like with like: a previous set recorded in another unit is converted
  // into this session's unit before any comparison.
  const previousWeight = previous.set.weight === null
    ? null
    : previous.set.weight_unit && previous.set.weight_unit !== sessionUnit
      ? convertWeightForDisplay(previous.set.weight, previous.set.weight_unit, sessionUnit)
      : previous.set.weight;

  if (today.weight !== null && previousWeight !== null && today.weight !== previousWeight) {
    const delta = Math.round((today.weight - previousWeight) * 100) / 100;
    return {
      ...base,
      direction: delta > 0 ? 'up' : 'down',
      detail: `${delta > 0 ? '+' : ''}${delta} ${sessionUnit} from ${formatWeight(previousWeight, sessionUnit)}`
    };
  }

  if (today.reps !== null && previous.set.reps !== null && today.reps !== previous.set.reps) {
    const delta = today.reps - previous.set.reps;
    return {
      ...base,
      direction: delta > 0 ? 'up' : 'down',
      detail: `${delta > 0 ? '+' : ''}${delta} rep${Math.abs(delta) === 1 ? '' : 's'} at ${formatWeight(today.weight, sessionUnit)}`
    };
  }

  return { ...base, direction: 'held', detail: `Matched ${formatWeight(previousWeight ?? today.weight, sessionUnit)}` };
}

export function summarizeQuickWorkout(
  draft: QuickWorkoutDraft,
  finishedAt: string = new Date().toISOString()
): WorkoutSummary {
  const completed = draft.exercises.flatMap((exercise) => exercise.sets.filter((set) => set.completed));
  const changes = draft.exercises
    .filter((exercise) => exercise.exercise_name.trim())
    .map((exercise) => describeChange(exercise, draft.weight_unit));

  const started = new Date(draft.started_at).getTime();
  const ended = new Date(finishedAt).getTime();
  const duration = Number.isFinite(started) && Number.isFinite(ended) && ended > started
    ? Math.round((ended - started) / 60000)
    : null;

  const improved = changes.filter((change) => change.direction === 'up');
  const held = changes.filter((change) => change.direction === 'held');
  const headline = improved.length > 0
    ? `${improved[0].exercise_name} ${improved[0].detail}`
    : held.length > 0
      ? `Held your numbers on ${held.length} movement${held.length === 1 ? '' : 's'}`
      : null;

  return {
    title: draft.title.trim(),
    working_sets: completed.filter((set) => !set.warmup).length,
    warmup_sets: completed.filter((set) => set.warmup).length,
    exercises_logged: draft.exercises.filter((exercise) => exercise.sets.some((set) => set.completed)).length,
    duration_minutes: duration,
    changes,
    headline
  };
}
