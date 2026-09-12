import type { MovementExerciseCategory, MovementWorkoutType } from '../../engines/movement';
import type {
  ExerciseLibraryItemInput,
  ExerciseLibraryItemRow,
  MovementPersistenceSource,
  WorkoutExerciseEntryInput,
  WorkoutExerciseEntryRow,
  WorkoutSessionInput,
  WorkoutSessionRow
} from './movementPersistence';

export const workoutTypes: MovementWorkoutType[] = ['strength', 'cardio', 'mobility', 'recovery', 'mixed', 'sport', 'other'];
export const exerciseCategories: MovementExerciseCategory[] = ['strength', 'cardio', 'mobility', 'recovery', 'sport', 'other'];

export type WorkoutExerciseDraft = {
  id: string;
  exercise_name: string;
  category: MovementExerciseCategory;
  sets: string;
  reps: string;
  weight: string;
  distance: string;
  duration_minutes: string;
  effort: string;
  notes: string;
};

export type WorkoutDraft = {
  title: string;
  workout_type: MovementWorkoutType;
  session_date: string;
  duration_minutes: string;
  perceived_effort: string;
  session_note: string;
  exercises: WorkoutExerciseDraft[];
};

export type WorkoutTemplate = {
  id: string;
  title: string;
  workout_type: MovementWorkoutType;
  duration_minutes: string;
  perceived_effort: string;
  exercises: Array<Omit<WorkoutExerciseDraft, 'id'>>;
};

export type WorkoutFormResult =
  | { ok: true; session: WorkoutSessionInput; exercises: Omit<WorkoutExerciseEntryInput, 'workout_session_id'>[] }
  | { ok: false; error: string };

let draftSequence = 0;

function draftId(): string {
  draftSequence += 1;
  return `exercise-draft-${draftSequence}`;
}

export function createEmptyExerciseDraft(category: MovementExerciseCategory = 'strength'): WorkoutExerciseDraft {
  return {
    id: draftId(),
    exercise_name: '',
    category,
    sets: '',
    reps: '',
    weight: '',
    distance: '',
    duration_minutes: '',
    effort: '',
    notes: ''
  };
}

export function createEmptyWorkoutDraft(date = new Date().toISOString().slice(0, 10)): WorkoutDraft {
  return {
    title: '',
    workout_type: 'strength',
    session_date: date,
    duration_minutes: '',
    perceived_effort: '',
    session_note: '',
    exercises: []
  };
}

const exercise = (
  exercise_name: string,
  category: MovementExerciseCategory,
  values: Partial<Omit<WorkoutExerciseDraft, 'id' | 'exercise_name' | 'category'>> = {}
): Omit<WorkoutExerciseDraft, 'id'> => ({
  exercise_name,
  category,
  sets: '',
  reps: '',
  weight: '',
  distance: '',
  duration_minutes: '',
  effort: '',
  notes: '',
  ...values
});

export const workoutTemplates: WorkoutTemplate[] = [
  {
    id: 'full-body-strength',
    title: 'Full Body Strength',
    workout_type: 'strength',
    duration_minutes: '45',
    perceived_effort: '7',
    exercises: [
      exercise('Goblet Squat', 'strength', { sets: '3', reps: '8' }),
      exercise('Dumbbell Row', 'strength', { sets: '3', reps: '10' }),
      exercise('Push-Up', 'strength', { sets: '3', reps: '8' })
    ]
  },
  {
    id: 'easy-cardio',
    title: 'Easy Cardio',
    workout_type: 'cardio',
    duration_minutes: '30',
    perceived_effort: '4',
    exercises: [exercise('Easy Cardio', 'cardio', { duration_minutes: '30', effort: '4' })]
  },
  {
    id: 'mobility-reset',
    title: 'Mobility Reset',
    workout_type: 'mobility',
    duration_minutes: '15',
    perceived_effort: '3',
    exercises: [exercise('Mobility Flow', 'mobility', { duration_minutes: '15', effort: '3' })]
  },
  {
    id: 'recovery-walk',
    title: 'Recovery Walk',
    workout_type: 'recovery',
    duration_minutes: '25',
    perceived_effort: '3',
    exercises: [exercise('Comfortable Walk', 'recovery', { duration_minutes: '25', effort: '3' })]
  }
];

export const starterExerciseLibrary: ExerciseLibraryItemInput[] = [
  { name: 'Goblet Squat', category: 'strength', movement_pattern: 'squat', equipment: ['dumbbell'], source: 'default', is_default: true },
  { name: 'Romanian Deadlift', category: 'strength', movement_pattern: 'hinge', equipment: ['dumbbell'], source: 'default', is_default: true },
  { name: 'Push-Up', category: 'strength', movement_pattern: 'push', equipment: ['bodyweight'], source: 'default', is_default: true },
  { name: 'Dumbbell Row', category: 'strength', movement_pattern: 'pull', equipment: ['dumbbell'], source: 'default', is_default: true },
  { name: 'Easy Cardio', category: 'cardio', movement_pattern: 'locomotion', source: 'default', is_default: true },
  { name: 'Comfortable Walk', category: 'recovery', movement_pattern: 'locomotion', source: 'default', is_default: true },
  { name: 'Mobility Flow', category: 'mobility', movement_pattern: 'mobility', source: 'default', is_default: true }
];

export function applyWorkoutTemplate(template: WorkoutTemplate, date: string): WorkoutDraft {
  return {
    title: template.title,
    workout_type: template.workout_type,
    session_date: date.slice(0, 10),
    duration_minutes: template.duration_minutes,
    perceived_effort: template.perceived_effort,
    session_note: '',
    exercises: template.exercises.map((item) => ({ ...item, id: draftId() }))
  };
}

function parseOptionalNumber(value: string, options: { integer?: boolean; min?: number; max?: number } = {}): number | null | undefined {
  if (!value.trim()) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  if (options.integer && !Number.isInteger(parsed)) return undefined;
  if (parsed < (options.min ?? 0)) return undefined;
  if (options.max !== undefined && parsed > options.max) return undefined;
  return parsed;
}

function defaultWorkoutTitle(type: MovementWorkoutType): string {
  return type === 'mixed' ? 'Mixed Workout' : `${type.charAt(0).toUpperCase()}${type.slice(1)} Session`;
}

export function workoutDraftToInputs(
  draft: WorkoutDraft,
  source: MovementPersistenceSource = 'manual',
  now = new Date().toISOString()
): WorkoutFormResult {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.session_date.trim())) {
    return { ok: false, error: 'Use a date like 2026-07-13.' };
  }

  const duration = parseOptionalNumber(draft.duration_minutes, { integer: true });
  const effort = parseOptionalNumber(draft.perceived_effort, { integer: true, min: 1, max: 10 });
  if (duration === undefined) return { ok: false, error: 'Duration must be a whole number of minutes or left blank.' };
  if (effort === undefined) return { ok: false, error: 'Effort must be a whole number from 1 to 10 or left blank.' };

  const exercises: Omit<WorkoutExerciseEntryInput, 'workout_session_id'>[] = [];
  for (const [index, item] of draft.exercises.entries()) {
    if (!item.exercise_name.trim()) return { ok: false, error: 'Each exercise needs a name.' };
    const sets = parseOptionalNumber(item.sets, { integer: true });
    const reps = parseOptionalNumber(item.reps, { integer: true });
    const weight = parseOptionalNumber(item.weight);
    const distance = parseOptionalNumber(item.distance);
    const exerciseDuration = parseOptionalNumber(item.duration_minutes, { integer: true });
    const exerciseEffort = parseOptionalNumber(item.effort, { integer: true, min: 1, max: 10 });
    if ([sets, reps, weight, distance, exerciseDuration, exerciseEffort].some((value) => value === undefined)) {
      return { ok: false, error: 'Exercise numbers must be zero or higher, and effort must be 1 to 10.' };
    }
    exercises.push({
      exercise_library_item_id: null,
      exercise_name: item.exercise_name.trim(),
      category: item.category,
      order_index: index,
      sets: sets ?? null,
      reps: reps ?? null,
      weight: weight ?? null,
      weight_unit: null,
      distance: distance ?? null,
      duration_minutes: exerciseDuration ?? null,
      effort: exerciseEffort ?? null,
      notes: item.notes.trim() || null,
      source,
      source_confidence: 'medium',
      reason_codes: source === 'demo' ? ['manual_workout_log', 'demo_movement_data'] : ['manual_workout_log']
    });
  }

  const date = draft.session_date.trim();
  return {
    ok: true,
    session: {
      logged_at: now.slice(0, 10) === date ? now : `${date}T12:00:00.000Z`,
      session_date: date,
      title: draft.title.trim() || defaultWorkoutTitle(draft.workout_type),
      workout_type: draft.workout_type,
      duration_minutes: duration,
      perceived_effort: effort,
      readiness_before: null,
      session_note: draft.session_note.trim() || null,
      source,
      source_confidence: 'medium',
      reason_codes: source === 'demo' ? ['manual_workout_log', 'demo_movement_data'] : ['manual_workout_log']
    },
    exercises
  };
}

export function createDemoWorkoutRows(
  result: Extract<WorkoutFormResult, { ok: true }>,
  userId = 'demo-user',
  now = new Date().toISOString()
): { session: WorkoutSessionRow; exercises: WorkoutExerciseEntryRow[] } {
  const sessionId = `local-workout-${Date.now()}`;
  const session: WorkoutSessionRow = {
    user_id: userId,
    id: sessionId,
    logged_at: result.session.logged_at,
    session_date: result.session.session_date ?? result.session.logged_at.slice(0, 10),
    title: result.session.title,
    workout_type: result.session.workout_type,
    duration_minutes: result.session.duration_minutes ?? null,
    perceived_effort: result.session.perceived_effort ?? null,
    readiness_before: result.session.readiness_before ?? null,
    session_note: result.session.session_note ?? null,
    source: result.session.source ?? 'demo',
    source_confidence: result.session.source_confidence ?? 'medium',
    reason_codes: [...(result.session.reason_codes ?? ['demo_movement_data'])],
    created_at: now,
    updated_at: now
  };
  const exercises = result.exercises.map((item, index): WorkoutExerciseEntryRow => ({
    user_id: userId,
    id: `${sessionId}-exercise-${index + 1}`,
    workout_session_id: sessionId,
    exercise_library_item_id: item.exercise_library_item_id ?? null,
    exercise_name: item.exercise_name,
    category: item.category,
    order_index: item.order_index ?? index,
    sets: item.sets ?? null,
    reps: item.reps ?? null,
    weight: item.weight ?? null,
    weight_unit: item.weight_unit ?? null,
    distance: item.distance ?? null,
    duration_minutes: item.duration_minutes ?? null,
    effort: item.effort ?? null,
    notes: item.notes ?? null,
    source: item.source ?? 'demo',
    source_confidence: item.source_confidence ?? 'medium',
    reason_codes: [...(item.reason_codes ?? ['demo_movement_data'])],
    created_at: now,
    updated_at: now
  }));

  return { session, exercises };
}

export function starterExerciseRows(userId = 'demo-user', now = new Date().toISOString()): ExerciseLibraryItemRow[] {
  return starterExerciseLibrary.map((item, index) => ({
    user_id: userId,
    id: `starter-exercise-${index + 1}`,
    name: item.name,
    category: item.category,
    movement_pattern: item.movement_pattern ?? null,
    primary_muscles: [...(item.primary_muscles ?? [])],
    equipment: [...(item.equipment ?? [])],
    is_default: true,
    source: 'default',
    source_confidence: 'medium',
    reason_codes: [],
    created_at: now,
    updated_at: now
  }));
}
