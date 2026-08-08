import type {
  DataConfidence,
  MovementExerciseCategory,
  MovementExerciseEntry,
  MovementSession,
  MovementWorkoutType
} from '../../engines/movement';

export type ExerciseMovementPattern =
  | 'squat'
  | 'hinge'
  | 'push'
  | 'pull'
  | 'carry'
  | 'lunge'
  | 'rotation'
  | 'locomotion'
  | 'mobility'
  | 'other';

export type MovementPersistenceSource = 'manual' | 'demo';
export type ExerciseLibrarySource = 'manual' | 'demo' | 'default';

export type ExerciseLibraryItemInput = {
  name: string;
  category: MovementExerciseCategory;
  movement_pattern?: ExerciseMovementPattern | null;
  primary_muscles?: string[];
  equipment?: string[];
  is_default?: boolean;
  source?: ExerciseLibrarySource;
  source_confidence?: DataConfidence;
  reason_codes?: string[];
};

export type ExerciseLibraryItemInsert = Required<Omit<ExerciseLibraryItemInput, 'movement_pattern'>> & {
  user_id: string;
  movement_pattern: ExerciseMovementPattern | null;
};

export type ExerciseLibraryItemRow = ExerciseLibraryItemInsert & {
  id: string;
  created_at: string;
  updated_at: string;
};

export type WorkoutSessionInput = {
  logged_at: string;
  session_date?: string;
  title: string;
  workout_type: MovementWorkoutType;
  duration_minutes?: number | null;
  perceived_effort?: number | null;
  readiness_before?: string | null;
  session_note?: string | null;
  source?: MovementPersistenceSource;
  source_confidence?: DataConfidence;
  reason_codes?: string[];
};

export type WorkoutSessionInsert = {
  user_id: string;
  logged_at: string;
  session_date: string;
  title: string;
  workout_type: MovementWorkoutType;
  duration_minutes: number | null;
  perceived_effort: number | null;
  readiness_before: string | null;
  session_note: string | null;
  source: MovementPersistenceSource;
  source_confidence: DataConfidence;
  reason_codes: string[];
};

export type WorkoutSessionRow = WorkoutSessionInsert & {
  id: string;
  created_at: string;
  updated_at: string;
};

export type WorkoutExerciseEntryInput = {
  workout_session_id: string;
  exercise_library_item_id?: string | null;
  exercise_name: string;
  category: MovementExerciseCategory;
  order_index?: number;
  sets?: number | null;
  reps?: number | null;
  weight?: number | null;
  distance?: number | null;
  duration_minutes?: number | null;
  effort?: number | null;
  notes?: string | null;
  source?: MovementPersistenceSource;
  source_confidence?: DataConfidence;
  reason_codes?: string[];
};

export type WorkoutExerciseEntryInsert = {
  user_id: string;
  workout_session_id: string;
  exercise_library_item_id: string | null;
  exercise_name: string;
  category: MovementExerciseCategory;
  order_index: number;
  sets: number | null;
  reps: number | null;
  weight: number | null;
  distance: number | null;
  duration_minutes: number | null;
  effort: number | null;
  notes: string | null;
  source: MovementPersistenceSource;
  source_confidence: DataConfidence;
  reason_codes: string[];
};

export type WorkoutExerciseEntryRow = WorkoutExerciseEntryInsert & {
  id: string;
  created_at: string;
  updated_at: string;
};

export type WorkoutSetEntryInput = {
  workout_session_id: string;
  workout_exercise_entry_id: string;
  set_index: number;
  weight?: number | null;
  reps?: number | null;
  rpe?: number | null;
  rest_seconds?: number | null;
  completed_at?: string | null;
  notes?: string | null;
  source?: MovementPersistenceSource;
  source_confidence?: DataConfidence;
  reason_codes?: string[];
};

export type WorkoutSetEntryInsert = {
  user_id: string;
  workout_session_id: string;
  workout_exercise_entry_id: string;
  set_index: number;
  weight: number | null;
  reps: number | null;
  rpe: number | null;
  rest_seconds: number | null;
  completed_at: string | null;
  notes: string | null;
  source: MovementPersistenceSource;
  source_confidence: DataConfidence;
  reason_codes: string[];
};

export type WorkoutSetEntryRow = WorkoutSetEntryInsert & {
  id: string;
  created_at: string;
  updated_at: string;
};

type QueryError = { message?: string };
type QueryResponse<T> = { data: T | null; error: QueryError | null };
type InsertQuery<TRow> = { select(columns: string): { single(): Promise<QueryResponse<TRow>> } };
type SelectQuery<TRow> = {
  eq(column: string, value: string | boolean): SelectQuery<TRow>;
  gte(column: string, value: string): SelectQuery<TRow>;
  lte(column: string, value: string): SelectQuery<TRow>;
  order(column: string, options: { ascending: boolean }): SelectQuery<TRow>;
  limit(count: number): Promise<QueryResponse<TRow[]>>;
};
type UpdateQuery<TRow> = {
  eq(column: string, value: string): UpdateQuery<TRow>;
  select(columns: string): { single(): Promise<QueryResponse<TRow>> };
};
type DeleteQuery = {
  eq(column: string, value: string): DeleteQuery;
  then<TResult1 = QueryResponse<null>, TResult2 = never>(
    onfulfilled?: ((value: QueryResponse<null>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2>;
};
type TableQuery<TInsert, TRow> = {
  insert(payload: TInsert): InsertQuery<TRow>;
  select(columns: string): SelectQuery<TRow>;
  update(payload: Partial<TInsert>): UpdateQuery<TRow>;
  delete(): DeleteQuery;
};

export type MovementSupabaseClient = {
  from(table: 'exercise_library_items'): TableQuery<ExerciseLibraryItemInsert, ExerciseLibraryItemRow>;
  from(table: 'workout_sessions'): TableQuery<WorkoutSessionInsert, WorkoutSessionRow>;
  from(table: 'workout_exercise_entries'): TableQuery<WorkoutExerciseEntryInsert, WorkoutExerciseEntryRow>;
  from(table: 'workout_set_entries'): TableQuery<WorkoutSetEntryInsert, WorkoutSetEntryRow>;
};

function raiseSupabaseError(error: QueryError): never {
  throw new Error(error.message ?? 'Movement persistence request failed.');
}

function trimOrNull(value: string | null | undefined): string | null {
  return value?.trim() || null;
}

export function toExerciseLibraryItemInsert(
  input: ExerciseLibraryItemInput,
  userId: string
): ExerciseLibraryItemInsert {
  return {
    user_id: userId,
    name: input.name.trim(),
    category: input.category,
    movement_pattern: input.movement_pattern ?? null,
    primary_muscles: [...(input.primary_muscles ?? [])],
    equipment: [...(input.equipment ?? [])],
    is_default: input.is_default ?? false,
    source: input.source ?? 'manual',
    source_confidence: input.source_confidence ?? 'medium',
    reason_codes: [...(input.reason_codes ?? [])]
  };
}

export function toWorkoutSessionInsert(input: WorkoutSessionInput, userId: string): WorkoutSessionInsert {
  return {
    user_id: userId,
    logged_at: input.logged_at,
    session_date: input.session_date ?? input.logged_at.slice(0, 10),
    title: input.title.trim(),
    workout_type: input.workout_type,
    duration_minutes: input.duration_minutes ?? null,
    perceived_effort: input.perceived_effort ?? null,
    readiness_before: trimOrNull(input.readiness_before),
    session_note: trimOrNull(input.session_note),
    source: input.source ?? 'manual',
    source_confidence: input.source_confidence ?? 'medium',
    reason_codes: [...(input.reason_codes ?? ['manual_workout_log'])]
  };
}

export function toWorkoutExerciseEntryInsert(
  input: WorkoutExerciseEntryInput,
  userId: string
): WorkoutExerciseEntryInsert {
  return {
    user_id: userId,
    workout_session_id: input.workout_session_id,
    exercise_library_item_id: input.exercise_library_item_id ?? null,
    exercise_name: input.exercise_name.trim(),
    category: input.category,
    order_index: input.order_index ?? 0,
    sets: input.sets ?? null,
    reps: input.reps ?? null,
    weight: input.weight ?? null,
    distance: input.distance ?? null,
    duration_minutes: input.duration_minutes ?? null,
    effort: input.effort ?? null,
    notes: trimOrNull(input.notes),
    source: input.source ?? 'manual',
    source_confidence: input.source_confidence ?? 'medium',
    reason_codes: [...(input.reason_codes ?? ['manual_workout_log'])]
  };
}

export function toWorkoutSetEntryInsert(
  input: WorkoutSetEntryInput,
  userId: string
): WorkoutSetEntryInsert {
  return {
    user_id: userId,
    workout_session_id: input.workout_session_id,
    workout_exercise_entry_id: input.workout_exercise_entry_id,
    set_index: input.set_index,
    weight: input.weight ?? null,
    reps: input.reps ?? null,
    rpe: input.rpe ?? null,
    rest_seconds: input.rest_seconds ?? null,
    completed_at: input.completed_at ?? null,
    notes: trimOrNull(input.notes),
    source: input.source ?? 'manual',
    source_confidence: input.source_confidence ?? 'medium',
    reason_codes: [...(input.reason_codes ?? ['manual_workout_log', 'quick_set_log'])]
  };
}

export function workoutSessionRowToEngineSession(row: WorkoutSessionRow): MovementSession {
  return {
    id: row.id,
    session_date: row.session_date,
    logged_at: row.logged_at,
    title: row.title,
    workout_type: row.workout_type,
    duration_minutes: row.duration_minutes,
    perceived_effort: row.perceived_effort,
    source_confidence: row.source_confidence,
    reason_codes: [...row.reason_codes]
  };
}

export function workoutExerciseEntryRowToEngineEntry(row: WorkoutExerciseEntryRow): MovementExerciseEntry {
  return {
    id: row.id,
    workout_session_id: row.workout_session_id,
    exercise_name: row.exercise_name,
    category: row.category,
    sets: row.sets,
    reps: row.reps,
    weight: row.weight,
    distance: row.distance,
    duration_minutes: row.duration_minutes,
    effort: row.effort
  };
}

export async function saveExerciseLibraryItem(
  client: MovementSupabaseClient,
  userId: string,
  input: ExerciseLibraryItemInput
): Promise<ExerciseLibraryItemRow> {
  const { data, error } = await client.from('exercise_library_items').insert(toExerciseLibraryItemInsert(input, userId)).select('*').single();
  if (error) raiseSupabaseError(error);
  if (!data) throw new Error('Exercise library save returned no data.');
  return data;
}

export async function getExerciseLibraryItems(
  client: MovementSupabaseClient,
  userId: string,
  limit = 100
): Promise<ExerciseLibraryItemRow[]> {
  const { data, error } = await client
    .from('exercise_library_items')
    .select('*')
    .eq('user_id', userId)
    .order('name', { ascending: true })
    .limit(limit);
  if (error) raiseSupabaseError(error);
  return data ?? [];
}

export async function saveWorkoutSession(
  client: MovementSupabaseClient,
  userId: string,
  input: WorkoutSessionInput
): Promise<WorkoutSessionRow> {
  const { data, error } = await client.from('workout_sessions').insert(toWorkoutSessionInsert(input, userId)).select('*').single();
  if (error) raiseSupabaseError(error);
  if (!data) throw new Error('Workout session save returned no data.');
  return data;
}

export async function updateWorkoutSession(
  client: MovementSupabaseClient,
  userId: string,
  sessionId: string,
  update: Partial<WorkoutSessionInput>
): Promise<WorkoutSessionRow> {
  const payload: Partial<WorkoutSessionInsert> = {};
  if (update.logged_at !== undefined) payload.logged_at = update.logged_at;
  if (update.session_date !== undefined) payload.session_date = update.session_date;
  if (update.title !== undefined) payload.title = update.title.trim();
  if (update.workout_type !== undefined) payload.workout_type = update.workout_type;
  if (update.duration_minutes !== undefined) payload.duration_minutes = update.duration_minutes;
  if (update.perceived_effort !== undefined) payload.perceived_effort = update.perceived_effort;
  if (update.readiness_before !== undefined) payload.readiness_before = trimOrNull(update.readiness_before);
  if (update.session_note !== undefined) payload.session_note = trimOrNull(update.session_note);
  if (update.source !== undefined) payload.source = update.source;
  if (update.source_confidence !== undefined) payload.source_confidence = update.source_confidence;
  if (update.reason_codes !== undefined) payload.reason_codes = [...update.reason_codes];

  const { data, error } = await client
    .from('workout_sessions')
    .update(payload)
    .eq('id', sessionId)
    .eq('user_id', userId)
    .select('*')
    .single();
  if (error) raiseSupabaseError(error);
  if (!data) throw new Error('Workout session update returned no data.');
  return data;
}

export async function deleteWorkoutSession(client: MovementSupabaseClient, userId: string, sessionId: string): Promise<void> {
  const { error } = await client.from('workout_sessions').delete().eq('id', sessionId).eq('user_id', userId);
  if (error) raiseSupabaseError(error);
}

export async function getWorkoutSessionsForDate(
  client: MovementSupabaseClient,
  userId: string,
  date: string,
  limit = 50
): Promise<WorkoutSessionRow[]> {
  const { data, error } = await client
    .from('workout_sessions')
    .select('*')
    .eq('user_id', userId)
    .eq('session_date', date.slice(0, 10))
    .order('logged_at', { ascending: false })
    .limit(limit);
  if (error) raiseSupabaseError(error);
  return data ?? [];
}

export async function getWorkoutSessionsForRange(
  client: MovementSupabaseClient,
  userId: string,
  startDate: string,
  endDate: string,
  limit = 100
): Promise<WorkoutSessionRow[]> {
  const { data, error } = await client
    .from('workout_sessions')
    .select('*')
    .eq('user_id', userId)
    .gte('session_date', startDate.slice(0, 10))
    .lte('session_date', endDate.slice(0, 10))
    .order('logged_at', { ascending: false })
    .limit(limit);
  if (error) raiseSupabaseError(error);
  return data ?? [];
}

export async function saveWorkoutExerciseEntry(
  client: MovementSupabaseClient,
  userId: string,
  input: WorkoutExerciseEntryInput
): Promise<WorkoutExerciseEntryRow> {
  const { data, error } = await client.from('workout_exercise_entries').insert(toWorkoutExerciseEntryInsert(input, userId)).select('*').single();
  if (error) raiseSupabaseError(error);
  if (!data) throw new Error('Workout exercise save returned no data.');
  return data;
}

export async function saveWorkoutExerciseEntries(
  client: MovementSupabaseClient,
  userId: string,
  inputs: WorkoutExerciseEntryInput[]
): Promise<WorkoutExerciseEntryRow[]> {
  return Promise.all(inputs.map((input) => saveWorkoutExerciseEntry(client, userId, input)));
}

export async function getWorkoutExerciseEntriesForSession(
  client: MovementSupabaseClient,
  userId: string,
  sessionId: string,
  limit = 100
): Promise<WorkoutExerciseEntryRow[]> {
  const { data, error } = await client
    .from('workout_exercise_entries')
    .select('*')
    .eq('user_id', userId)
    .eq('workout_session_id', sessionId)
    .order('order_index', { ascending: true })
    .limit(limit);
  if (error) raiseSupabaseError(error);
  return data ?? [];
}

export async function deleteWorkoutExerciseEntry(
  client: MovementSupabaseClient,
  userId: string,
  entryId: string
): Promise<void> {
  const { error } = await client.from('workout_exercise_entries').delete().eq('id', entryId).eq('user_id', userId);
  if (error) raiseSupabaseError(error);
}

export async function saveWorkoutSetEntry(
  client: MovementSupabaseClient,
  userId: string,
  input: WorkoutSetEntryInput
): Promise<WorkoutSetEntryRow> {
  const { data, error } = await client
    .from('workout_set_entries')
    .insert(toWorkoutSetEntryInsert(input, userId))
    .select('*')
    .single();
  if (error) raiseSupabaseError(error);
  if (!data) throw new Error('Workout set save returned no data.');
  return data;
}

export async function saveWorkoutSetEntries(
  client: MovementSupabaseClient,
  userId: string,
  inputs: WorkoutSetEntryInput[]
): Promise<WorkoutSetEntryRow[]> {
  return Promise.all(inputs.map((input) => saveWorkoutSetEntry(client, userId, input)));
}

export async function getWorkoutSetEntriesForSession(
  client: MovementSupabaseClient,
  userId: string,
  sessionId: string,
  limit = 500
): Promise<WorkoutSetEntryRow[]> {
  const { data, error } = await client
    .from('workout_set_entries')
    .select('*')
    .eq('user_id', userId)
    .eq('workout_session_id', sessionId)
    .order('set_index', { ascending: true })
    .limit(limit);
  if (error) raiseSupabaseError(error);
  return data ?? [];
}
