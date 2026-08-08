import type { MovementExerciseCategory, MovementWorkoutType } from '../../engines/movement';
import type { LocalDemoMovementState } from './localDemoMovementStore';
import type {
  ExerciseLibraryItemRow,
  ExerciseMovementPattern,
  WorkoutExerciseEntryRow,
  WorkoutSessionRow,
  WorkoutSetEntryRow
} from './movementPersistence';
import { starterExerciseRows } from './workoutForms';

const PREVIEW_USER_ID = 'development-move-preview';

function dateBefore(date: string, days: number): string {
  return new Date(new Date(`${date}T12:00:00.000Z`).getTime() - days * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

function session(
  today: string,
  id: string,
  daysAgo: number,
  title: string,
  workoutType: MovementWorkoutType,
  durationMinutes: number,
  effort: number
): WorkoutSessionRow {
  const sessionDate = dateBefore(today, daysAgo);
  const timestamp = `${sessionDate}T12:00:00.000Z`;
  return {
    id,
    user_id: PREVIEW_USER_ID,
    logged_at: timestamp,
    session_date: sessionDate,
    title,
    workout_type: workoutType,
    duration_minutes: durationMinutes,
    perceived_effort: effort,
    readiness_before: null,
    session_note: null,
    source: 'demo',
    source_confidence: 'medium',
    reason_codes: ['demo_movement_data'],
    created_at: timestamp,
    updated_at: timestamp
  };
}

function entry(
  sessionRow: WorkoutSessionRow,
  id: string,
  orderIndex: number,
  exerciseName: string,
  category: MovementExerciseCategory,
  values: Partial<Pick<WorkoutExerciseEntryRow, 'sets' | 'reps' | 'weight' | 'distance' | 'duration_minutes' | 'effort'>> = {}
): WorkoutExerciseEntryRow {
  return {
    id,
    user_id: PREVIEW_USER_ID,
    workout_session_id: sessionRow.id,
    exercise_library_item_id: null,
    exercise_name: exerciseName,
    category,
    order_index: orderIndex,
    sets: values.sets ?? null,
    reps: values.reps ?? null,
    weight: values.weight ?? null,
    distance: values.distance ?? null,
    duration_minutes: values.duration_minutes ?? null,
    effort: values.effort ?? sessionRow.perceived_effort,
    notes: null,
    source: 'demo',
    source_confidence: 'medium',
    reason_codes: ['demo_movement_data'],
    created_at: sessionRow.created_at,
    updated_at: sessionRow.updated_at
  };
}

function libraryItem(
  index: number,
  name: string,
  category: MovementExerciseCategory,
  pattern: ExerciseMovementPattern,
  equipment: string[] = []
): ExerciseLibraryItemRow {
  const timestamp = '2026-01-01T12:00:00.000Z';
  return {
    id: `preview-library-${index}`,
    user_id: PREVIEW_USER_ID,
    name,
    category,
    movement_pattern: pattern,
    primary_muscles: [],
    equipment,
    is_default: true,
    source: 'demo',
    source_confidence: 'medium',
    reason_codes: ['demo_movement_data'],
    created_at: timestamp,
    updated_at: timestamp
  };
}

function setEntriesFor(entryRow: WorkoutExerciseEntryRow): WorkoutSetEntryRow[] {
  return Array.from({ length: Math.max(1, entryRow.sets ?? 1) }, (_, index) => ({
    id: `${entryRow.id}-set-${index + 1}`,
    user_id: PREVIEW_USER_ID,
    workout_session_id: entryRow.workout_session_id,
    workout_exercise_entry_id: entryRow.id,
    set_index: index + 1,
    weight: entryRow.weight,
    reps: entryRow.reps,
    rpe: entryRow.effort,
    rest_seconds: entryRow.category === 'strength' ? 90 : null,
    completed_at: entryRow.created_at,
    notes: null,
    source: 'demo',
    source_confidence: 'medium',
    reason_codes: ['demo_movement_data', 'quick_set_log'],
    created_at: entryRow.created_at,
    updated_at: entryRow.updated_at
  }));
}

export function createMovementPreviewFixture(today: string): LocalDemoMovementState {
  const workoutSessions = [
    session(today, 'preview-session-1', 0, 'Full Body Strength', 'strength', 48, 7),
    session(today, 'preview-session-2', 2, 'Easy Cardio', 'cardio', 32, 4),
    session(today, 'preview-session-3', 4, 'Mobility Reset', 'mobility', 18, 3),
    session(today, 'preview-session-4', 7, 'Lower Body Strength', 'strength', 52, 8),
    session(today, 'preview-session-5', 10, 'Recovery Walk', 'recovery', 28, 3),
    session(today, 'preview-session-6', 13, 'Tempo Cardio', 'cardio', 36, 7),
    session(today, 'preview-session-7', 16, 'Upper Body Strength', 'strength', 45, 6),
    session(today, 'preview-session-8', 20, 'Mobility Flow', 'mobility', 20, 3),
    session(today, 'preview-session-9', 23, 'Mixed Session', 'mixed', 40, 6),
    session(today, 'preview-session-10', 27, 'Comfortable Walk', 'recovery', 30, 2)
  ];
  const byId = new Map(workoutSessions.map((item) => [item.id, item]));
  const requiredSession = (id: string): WorkoutSessionRow => {
    const row = byId.get(id);
    if (!row) throw new Error(`Missing movement preview session: ${id}`);
    return row;
  };
  const workoutExerciseEntries = [
    entry(requiredSession('preview-session-1'), 'preview-entry-1', 0, 'Goblet Squat', 'strength', { sets: 3, reps: 8, weight: 24 }),
    entry(requiredSession('preview-session-1'), 'preview-entry-2', 1, 'Dumbbell Row', 'strength', { sets: 3, reps: 10, weight: 20 }),
    entry(requiredSession('preview-session-1'), 'preview-entry-3', 2, 'Push-Up', 'strength', { sets: 3, reps: 10 }),
    entry(requiredSession('preview-session-2'), 'preview-entry-4', 0, 'Easy Cardio', 'cardio', { duration_minutes: 32 }),
    entry(requiredSession('preview-session-3'), 'preview-entry-5', 0, 'Mobility Flow', 'mobility', { duration_minutes: 18 }),
    entry(requiredSession('preview-session-4'), 'preview-entry-6', 0, 'Romanian Deadlift', 'strength', { sets: 4, reps: 8, weight: 30 }),
    entry(requiredSession('preview-session-4'), 'preview-entry-7', 1, 'Split Squat', 'strength', { sets: 3, reps: 8, weight: 16 }),
    entry(requiredSession('preview-session-5'), 'preview-entry-8', 0, 'Comfortable Walk', 'recovery', { duration_minutes: 28 }),
    entry(requiredSession('preview-session-6'), 'preview-entry-9', 0, 'Tempo Cardio', 'cardio', { duration_minutes: 36 }),
    entry(requiredSession('preview-session-7'), 'preview-entry-10', 0, 'Half-Kneeling Press', 'strength', { sets: 3, reps: 8, weight: 12 }),
    entry(requiredSession('preview-session-8'), 'preview-entry-11', 0, 'Hip Mobility Flow', 'mobility', { duration_minutes: 20 }),
    entry(requiredSession('preview-session-9'), 'preview-entry-12', 0, 'Farmer Carry', 'strength', { sets: 4, distance: 30, weight: 24 }),
    entry(requiredSession('preview-session-10'), 'preview-entry-13', 0, 'Comfortable Walk', 'recovery', { duration_minutes: 30 })
  ];
  const extraLibrary = [
    libraryItem(1, 'Split Squat', 'strength', 'lunge', ['dumbbell']),
    libraryItem(2, 'Half-Kneeling Press', 'strength', 'push', ['dumbbell']),
    libraryItem(3, 'Farmer Carry', 'strength', 'carry', ['dumbbell']),
    libraryItem(4, 'Tempo Cardio', 'cardio', 'locomotion'),
    libraryItem(5, 'Bike Intervals', 'cardio', 'locomotion', ['bike']),
    libraryItem(6, 'Hip Mobility Flow', 'mobility', 'mobility'),
    libraryItem(7, 'Thoracic Rotation', 'mobility', 'rotation'),
    libraryItem(8, 'Breathing Reset', 'recovery', 'other'),
    libraryItem(9, 'Light Recovery Ride', 'recovery', 'locomotion', ['bike']),
    libraryItem(10, 'Court Practice', 'sport', 'locomotion'),
    libraryItem(11, 'Carry + Crawl', 'other', 'carry')
  ];
  const workoutSetEntries = workoutExerciseEntries
    .filter((item) => item.category === 'strength')
    .flatMap(setEntriesFor);

  return {
    exerciseLibrary: [...starterExerciseRows(PREVIEW_USER_ID), ...extraLibrary],
    workoutSessions,
    workoutExerciseEntries,
    workoutSetEntries
  };
}
