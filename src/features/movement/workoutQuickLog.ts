import type { MovementExerciseCategory, MovementWorkoutType } from '../../engines/movement';
import type {
  MovementPersistenceSource,
  WorkoutExerciseEntryInput,
  WorkoutExerciseEntryRow,
  WorkoutSessionInput,
  WorkoutSessionRow,
  WorkoutSetEntryInput,
  WorkoutSetEntryRow
} from './movementPersistence';
import { createDemoWorkoutRows, type WorkoutTemplate } from './workoutForms';
import { DEFAULT_WEIGHT_UNIT, type WeightUnit } from './weightUnits';

export type QuickSetDraft = {
  id: string;
  set_index: number;
  weight: string;
  reps: string;
  rpe: string;
  rest_seconds: string;
  completed: boolean;
  completed_at: string | null;
  /** Warm-up sets are recorded but excluded from the exercise's headline load. */
  warmup: boolean;
};

export type PreviousQuickSet = {
  set_index: number;
  weight: number | null;
  reps: number | null;
  rpe: number | null;
  rest_seconds: number | null;
  /** Null for sets recorded before units existed. */
  weight_unit: WeightUnit | null;
};

export type QuickExerciseDraft = {
  id: string;
  exercise_name: string;
  /** Links to the canonical library so one movement keeps one history. */
  exercise_library_item_id: string | null;
  category: MovementExerciseCategory;
  sets: QuickSetDraft[];
  previous_date: string | null;
  previous_sets: PreviousQuickSet[];
};

export type QuickWorkoutDraft = {
  title: string;
  workout_type: MovementWorkoutType;
  started_at: string;
  /** The unit this session's weights were entered in. */
  weight_unit: WeightUnit;
  /** Free-text context saved with the session, such as how training felt. */
  note?: string | null;
  exercises: QuickExerciseDraft[];
};

export type QuickWorkoutInputs = {
  session: WorkoutSessionInput;
  exercises: Omit<WorkoutExerciseEntryInput, 'workout_session_id'>[];
  sets: Array<{ exercise_index: number; input: Omit<WorkoutSetEntryInput, 'workout_session_id' | 'workout_exercise_entry_id'> }>;
};

export type QuickWorkoutResult =
  | { ok: true; value: QuickWorkoutInputs }
  | { ok: false; error: string };

export function isMovementLogWithinSafetyGuidance(
  trainingAllowed: boolean,
  workoutType: MovementWorkoutType,
  categories: MovementExerciseCategory[]
): boolean {
  if (trainingAllowed) return true;
  const gentle = (value: string) => value === 'mobility' || value === 'recovery';
  return gentle(workoutType) && categories.every(gentle);
}

let quickDraftSequence = 0;

/**
 * Draft ids must stay unique across a rehydrated draft, so they carry a random
 * segment rather than relying on a counter that resets to zero when the app
 * restarts — a restored set and a newly added one would otherwise collide.
 */
function quickId(prefix: string): string {
  quickDraftSequence += 1;
  return `${prefix}-${Date.now().toString(36)}-${quickDraftSequence.toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function normalized(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function titleFromInput(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map((part) => part ? part.charAt(0).toUpperCase() + part.slice(1) : part)
    .join(' ');
}

function categoryFromName(value: string): MovementExerciseCategory {
  const name = normalized(value);
  if (/\b(mobility|stretch|range of motion|flow)\b/.test(name)) return 'mobility';
  if (/\b(recovery|easy walk|breath|reset)\b/.test(name)) return 'recovery';
  if (/\b(run|bike|cycle|cardio|rower|swim|walk|interval)\b/.test(name)) return 'cardio';
  if (/\b(practice|court|field|sport)\b/.test(name)) return 'sport';
  return 'strength';
}

function workoutTypeFromCategories(categories: MovementExerciseCategory[]): MovementWorkoutType {
  const unique = new Set(categories);
  if (unique.size !== 1) return 'mixed';
  return categories[0] ?? 'other';
}

function parseOptionalNumber(
  value: string,
  options: { integer?: boolean; min?: number; max?: number } = {}
): number | null | undefined {
  if (!value.trim()) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  if (options.integer && !Number.isInteger(parsed)) return undefined;
  if (parsed < (options.min ?? 0)) return undefined;
  if (options.max !== undefined && parsed > options.max) return undefined;
  return parsed;
}

export function createQuickSetDraft(
  setIndex: number,
  previous?: PreviousQuickSet
): QuickSetDraft {
  return {
    id: quickId('quick-set'),
    set_index: setIndex,
    weight: previous?.weight?.toString() ?? '',
    reps: previous?.reps?.toString() ?? '',
    rpe: '',
    rest_seconds: previous?.rest_seconds?.toString() ?? '90',
    completed: false,
    completed_at: null,
    warmup: false
  };
}

export function createQuickExerciseDraft(
  exerciseName = '',
  category: MovementExerciseCategory = 'strength',
  setCount = 3,
  libraryItemId: string | null = null
): QuickExerciseDraft {
  return {
    id: quickId('quick-exercise'),
    exercise_name: exerciseName.trim(),
    exercise_library_item_id: libraryItemId,
    category,
    sets: Array.from({ length: Math.max(1, setCount) }, (_, index) => createQuickSetDraft(index + 1)),
    previous_date: null,
    previous_sets: []
  };
}

/**
 * The previous set to show beside today's.
 *
 * Falls back to the nearest earlier set rather than showing nothing, so adding
 * a fourth set to a three-set exercise still has a reference point. The caller
 * is told which set index the value came from so the UI can say so.
 */
export function previousSetFor(
  exercise: QuickExerciseDraft,
  setIndex: number
): { set: PreviousQuickSet; exact: boolean } | null {
  const exact = exercise.previous_sets.find((set) => set.set_index === setIndex);
  if (exact) return { set: exact, exact: true };
  const earlier = exercise.previous_sets
    .filter((set) => set.set_index < setIndex)
    .sort((left, right) => right.set_index - left.set_index)[0];
  return earlier ? { set: earlier, exact: false } : null;
}

export function removeQuickSetDraft(
  exercise: QuickExerciseDraft,
  setId: string
): QuickExerciseDraft {
  if (exercise.sets.length <= 1) return exercise;
  return {
    ...exercise,
    sets: exercise.sets
      .filter((set) => set.id !== setId)
      .map((set, index) => ({ ...set, set_index: index + 1 }))
  };
}

export function createQuickWorkoutFromText(
  input: string,
  startedAt = new Date().toISOString(),
  weightUnit: WeightUnit = DEFAULT_WEIGHT_UNIT
): QuickWorkoutDraft | null {
  const names = input
    .split(/[\n,+;&]+/)
    .map((part) => titleFromInput(part))
    .filter(Boolean)
    .filter((value, index, values) => values.findIndex((candidate) => normalized(candidate) === normalized(value)) === index)
    .slice(0, 8);
  if (names.length === 0) return null;
  const categories = names.map(categoryFromName);
  return {
    title: names.length === 1 ? names[0] : `${names[0]} + ${names.length - 1}`,
    workout_type: workoutTypeFromCategories(categories),
    started_at: startedAt,
    weight_unit: weightUnit,
    exercises: names.map((name, index) => createQuickExerciseDraft(name, categories[index]))
  };
}

export function createQuickWorkoutFromTemplate(
  template: WorkoutTemplate,
  startedAt = new Date().toISOString(),
  weightUnit: WeightUnit = DEFAULT_WEIGHT_UNIT
): QuickWorkoutDraft {
  return {
    title: template.title,
    workout_type: template.workout_type,
    started_at: startedAt,
    weight_unit: weightUnit,
    exercises: template.exercises.map((exercise) =>
      createQuickExerciseDraft(exercise.exercise_name, exercise.category, Math.max(1, Number(exercise.sets) || 1))
    )
  };
}

function previousSetsForEntry(entry: WorkoutExerciseEntryRow, sets: WorkoutSetEntryRow[]): PreviousQuickSet[] {
  const exact = sets
    .filter((set) => set.workout_exercise_entry_id === entry.id)
    .sort((left, right) => left.set_index - right.set_index)
    .map((set) => ({
      set_index: set.set_index,
      weight: set.weight,
      reps: set.reps,
      rpe: set.rpe,
      rest_seconds: set.rest_seconds,
      weight_unit: set.weight_unit ?? null
    }));
  if (exact.length > 0) return exact;

  const count = Math.max(1, entry.sets ?? 1);
  return Array.from({ length: count }, (_, index) => ({
    set_index: index + 1,
    weight: entry.weight,
    reps: entry.reps,
    rpe: entry.effort,
    rest_seconds: null,
    weight_unit: entry.weight_unit ?? null
  }));
}

export function attachPreviousWorkout(
  draft: QuickWorkoutDraft,
  sessions: WorkoutSessionRow[],
  entries: WorkoutExerciseEntryRow[],
  sets: WorkoutSetEntryRow[]
): QuickWorkoutDraft {
  const priorSession = [...sessions]
    .filter((session) => session.logged_at < draft.started_at)
    .sort((left, right) => right.logged_at.localeCompare(left.logged_at))
    .find((session) => {
      if (normalized(session.title) === normalized(draft.title)) return true;
      const priorNames = new Set(entries
        .filter((entry) => entry.workout_session_id === session.id)
        .map((entry) => normalized(entry.exercise_name)));
      return draft.exercises.length > 0 && draft.exercises.every((exercise) => priorNames.has(normalized(exercise.exercise_name)));
    });

  if (!priorSession) return draft;
  const priorEntries = entries.filter((entry) => entry.workout_session_id === priorSession.id);
  return {
    ...draft,
    exercises: draft.exercises.map((exercise) => {
      const priorEntry = priorEntries.find((entry) => normalized(entry.exercise_name) === normalized(exercise.exercise_name));
      if (!priorEntry) return exercise;
      const previousSets = previousSetsForEntry(priorEntry, sets);
      return {
        ...exercise,
        exercise_library_item_id: exercise.exercise_library_item_id ?? priorEntry.exercise_library_item_id ?? null,
        previous_date: priorSession.session_date,
        previous_sets: previousSets,
        sets: previousSets.map((set) => createQuickSetDraft(set.set_index, set))
      };
    })
  };
}

export function copyPreviousSet(exercise: QuickExerciseDraft, setIndex: number): QuickExerciseDraft {
  const previous = exercise.previous_sets.find((set) => set.set_index === setIndex);
  if (!previous) return exercise;
  return {
    ...exercise,
    sets: exercise.sets.map((set) => set.set_index === setIndex
      ? {
          ...set,
          weight: previous.weight?.toString() ?? '',
          reps: previous.reps?.toString() ?? '',
          rpe: previous.rpe?.toString() ?? '',
          rest_seconds: previous.rest_seconds?.toString() ?? set.rest_seconds
        }
      : set)
  };
}

export function quickWorkoutToInputs(
  draft: QuickWorkoutDraft,
  source: MovementPersistenceSource = 'manual',
  finishedAt = new Date().toISOString()
): QuickWorkoutResult {
  if (!draft.title.trim()) return { ok: false, error: 'Give this workout a short name.' };
  if (draft.exercises.length === 0) return { ok: false, error: 'Add at least one movement.' };

  const exercises: QuickWorkoutInputs['exercises'] = [];
  const sets: QuickWorkoutInputs['sets'] = [];
  for (const [exerciseIndex, exercise] of draft.exercises.entries()) {
    if (!exercise.exercise_name.trim()) return { ok: false, error: 'Each movement needs a name.' };
    const parsedSets: Array<{
      set_index: number;
      weight: number | null;
      reps: number | null;
      rpe: number | null;
      rest_seconds: number | null;
      completed: boolean;
      completed_at: string | null;
      warmup: boolean;
    }> = [];
    for (const set of exercise.sets) {
      const weight = parseOptionalNumber(set.weight);
      const reps = parseOptionalNumber(set.reps, { integer: true });
      const rpe = parseOptionalNumber(set.rpe, { min: 1, max: 10 });
      const rest = parseOptionalNumber(set.rest_seconds, { integer: true });
      if ([weight, reps, rpe, rest].some((value) => value === undefined)) {
        return { ok: false, error: 'Use valid set values: whole reps/rest, non-negative weight, and RPE from 1 to 10.' };
      }
      const hasValues = weight !== null || reps !== null || rpe !== null;
      if (!hasValues && !set.completed) continue;
      if (set.completed && !hasValues) return { ok: false, error: `Set ${set.set_index} for ${exercise.exercise_name} needs at least one value.` };
      parsedSets.push({
        set_index: set.set_index,
        weight: weight ?? null,
        reps: reps ?? null,
        rpe: rpe ?? null,
        rest_seconds: rest ?? null,
        completed: set.completed,
        completed_at: set.completed_at,
        warmup: set.warmup
      });
    }

    const workingSets = parsedSets.filter((set) => !set.warmup);
    const headlineSets = workingSets.length > 0 ? workingSets : parsedSets;
    const lastWithReps = [...headlineSets].reverse().find((set) => set.reps !== null);
    const lastWithWeight = [...headlineSets].reverse().find((set) => set.weight !== null);
    const rpeValues = headlineSets.map((set) => set.rpe).filter((value): value is number => value !== null);
    exercises.push({
      exercise_library_item_id: exercise.exercise_library_item_id ?? null,
      exercise_name: exercise.exercise_name.trim(),
      category: exercise.category,
      order_index: exerciseIndex,
      sets: workingSets.length || parsedSets.length || null,
      reps: lastWithReps?.reps ?? null,
      weight: lastWithWeight?.weight ?? null,
      weight_unit: lastWithWeight?.weight !== undefined && lastWithWeight?.weight !== null ? draft.weight_unit : null,
      distance: null,
      duration_minutes: null,
      effort: rpeValues.length > 0 ? Math.round(rpeValues.reduce((sum, value) => sum + value, 0) / rpeValues.length) : null,
      notes: null,
      source,
      source_confidence: 'medium',
      reason_codes: source === 'demo'
        ? ['manual_workout_log', 'quick_set_log', 'demo_movement_data']
        : ['manual_workout_log', 'quick_set_log']
    });
    parsedSets.forEach((set) => sets.push({
      exercise_index: exerciseIndex,
      input: {
        set_index: set.set_index,
        weight: set.weight,
        weight_unit: set.weight === null ? null : draft.weight_unit,
        warmup: set.warmup,
        reps: set.reps,
        rpe: set.rpe,
        rest_seconds: set.rest_seconds,
        completed_at: set.completed ? set.completed_at ?? finishedAt : null,
        notes: null,
        source,
        source_confidence: 'medium',
        reason_codes: source === 'demo'
          ? ['manual_workout_log', 'quick_set_log', 'demo_movement_data']
          : ['manual_workout_log', 'quick_set_log']
      }
    }));
  }

  const elapsedMinutes = Math.max(0, Math.round((new Date(finishedAt).getTime() - new Date(draft.started_at).getTime()) / 60000));
  const rpeValues = sets.map((set) => set.input.rpe).filter((value): value is number => value !== null && value !== undefined);
  return {
    ok: true,
    value: {
      session: {
        logged_at: draft.started_at,
        session_date: draft.started_at.slice(0, 10),
        title: draft.title.trim(),
        workout_type: draft.workout_type,
        duration_minutes: elapsedMinutes,
        perceived_effort: rpeValues.length > 0 ? Math.round(rpeValues.reduce((sum, value) => sum + value, 0) / rpeValues.length) : null,
        readiness_before: null,
        session_note: draft.note?.trim() || null,
        source,
        source_confidence: 'medium',
        reason_codes: source === 'demo'
          ? ['manual_workout_log', 'quick_set_log', 'automatic_workout_timestamp', 'demo_movement_data']
          : ['manual_workout_log', 'quick_set_log', 'automatic_workout_timestamp']
      },
      exercises,
      sets
    }
  };
}

export function createDemoQuickWorkoutRows(
  result: QuickWorkoutInputs,
  userId = 'demo-user',
  now = new Date().toISOString()
): {
  session: WorkoutSessionRow;
  exercises: WorkoutExerciseEntryRow[];
  sets: WorkoutSetEntryRow[];
} {
  const aggregateRows = createDemoWorkoutRows({
    ok: true,
    session: result.session,
    exercises: result.exercises
  }, userId, now);
  const sets = result.sets.map((set, index): WorkoutSetEntryRow => {
    const exercise = aggregateRows.exercises[set.exercise_index];
    if (!exercise) throw new Error('Quick workout set references a missing exercise.');
    return {
      id: `${exercise.id}-set-${set.input.set_index}-${index + 1}`,
      user_id: userId,
      workout_session_id: aggregateRows.session.id,
      workout_exercise_entry_id: exercise.id,
      set_index: set.input.set_index,
      weight: set.input.weight ?? null,
      weight_unit: set.input.weight_unit ?? null,
      warmup: set.input.warmup ?? false,
      reps: set.input.reps ?? null,
      rpe: set.input.rpe ?? null,
      rest_seconds: set.input.rest_seconds ?? null,
      completed_at: set.input.completed_at ?? null,
      notes: set.input.notes ?? null,
      source: set.input.source ?? 'demo',
      source_confidence: set.input.source_confidence ?? 'medium',
      reason_codes: [...(set.input.reason_codes ?? ['manual_workout_log', 'quick_set_log', 'demo_movement_data'])],
      created_at: now,
      updated_at: now
    };
  });
  return { ...aggregateRows, sets };
}
