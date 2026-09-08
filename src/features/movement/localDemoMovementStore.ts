import AsyncStorage from '@react-native-async-storage/async-storage';

import type {
  ExerciseLibraryItemRow,
  WorkoutExerciseEntryRow,
  WorkoutSessionRow,
  WorkoutSetEntryRow
} from './movementPersistence';

export const demoMovementExerciseLibraryKey = 'healthi:demo:movement:exerciseLibrary';
export const demoMovementWorkoutSessionsKey = 'healthi:demo:movement:workoutSessions';
export const demoMovementWorkoutExerciseEntriesKey = 'healthi:demo:movement:workoutExerciseEntries';
export const demoMovementWorkoutSetEntriesKey = 'healthi:demo:movement:workoutSetEntries';

export type LocalDemoMovementState = {
  exerciseLibrary: ExerciseLibraryItemRow[];
  workoutSessions: WorkoutSessionRow[];
  workoutExerciseEntries: WorkoutExerciseEntryRow[];
  workoutSetEntries: WorkoutSetEntryRow[];
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function parse(value: string | null): unknown {
  if (!value) return [];
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return [];
  }
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isWorkoutSession(value: unknown): value is WorkoutSessionRow {
  if (!value || typeof value !== 'object') return false;
  const row = value as Partial<WorkoutSessionRow>;
  return (
    typeof row.id === 'string' &&
    typeof row.user_id === 'string' &&
    typeof row.logged_at === 'string' &&
    typeof row.session_date === 'string' &&
    typeof row.title === 'string' &&
    typeof row.workout_type === 'string' &&
    isStringArray(row.reason_codes) &&
    typeof row.created_at === 'string' &&
    typeof row.updated_at === 'string'
  );
}

function isWorkoutExerciseEntry(value: unknown): value is WorkoutExerciseEntryRow {
  if (!value || typeof value !== 'object') return false;
  const row = value as Partial<WorkoutExerciseEntryRow>;
  return (
    typeof row.id === 'string' &&
    typeof row.user_id === 'string' &&
    typeof row.workout_session_id === 'string' &&
    typeof row.exercise_name === 'string' &&
    typeof row.category === 'string' &&
    typeof row.order_index === 'number' &&
    isStringArray(row.reason_codes) &&
    typeof row.created_at === 'string' &&
    typeof row.updated_at === 'string'
  );
}

function isWorkoutSetEntry(value: unknown): value is WorkoutSetEntryRow {
  if (!value || typeof value !== 'object') return false;
  const row = value as Partial<WorkoutSetEntryRow>;
  return (
    typeof row.id === 'string' &&
    typeof row.user_id === 'string' &&
    typeof row.workout_session_id === 'string' &&
    typeof row.workout_exercise_entry_id === 'string' &&
    typeof row.set_index === 'number' &&
    isStringArray(row.reason_codes) &&
    typeof row.created_at === 'string' &&
    typeof row.updated_at === 'string'
  );
}

function isExerciseLibraryItem(value: unknown): value is ExerciseLibraryItemRow {
  if (!value || typeof value !== 'object') return false;
  const row = value as Partial<ExerciseLibraryItemRow>;
  return (
    typeof row.id === 'string' &&
    typeof row.user_id === 'string' &&
    typeof row.name === 'string' &&
    typeof row.category === 'string' &&
    isStringArray(row.primary_muscles) &&
    isStringArray(row.equipment) &&
    isStringArray(row.reason_codes) &&
    typeof row.created_at === 'string' &&
    typeof row.updated_at === 'string'
  );
}

export function serializeDemoWorkoutSessions(rows: WorkoutSessionRow[]): string {
  return JSON.stringify(rows.map(clone));
}

export function deserializeDemoWorkoutSessions(value: string | null): WorkoutSessionRow[] {
  const rows = parse(value);
  return Array.isArray(rows) ? rows.filter(isWorkoutSession).map(clone) : [];
}

export function serializeDemoWorkoutExerciseEntries(rows: WorkoutExerciseEntryRow[]): string {
  return JSON.stringify(rows.map(clone));
}

export function deserializeDemoWorkoutExerciseEntries(value: string | null): WorkoutExerciseEntryRow[] {
  const rows = parse(value);
  return Array.isArray(rows) ? rows.filter(isWorkoutExerciseEntry).map(clone) : [];
}

export function serializeDemoWorkoutSetEntries(rows: WorkoutSetEntryRow[]): string {
  return JSON.stringify(rows.map(clone));
}

export function deserializeDemoWorkoutSetEntries(value: string | null): WorkoutSetEntryRow[] {
  const rows = parse(value);
  return Array.isArray(rows) ? rows.filter(isWorkoutSetEntry).map(clone) : [];
}

export function serializeDemoExerciseLibrary(rows: ExerciseLibraryItemRow[]): string {
  return JSON.stringify(rows.map(clone));
}

export function deserializeDemoExerciseLibrary(value: string | null): ExerciseLibraryItemRow[] {
  const rows = parse(value);
  return Array.isArray(rows) ? rows.filter(isExerciseLibraryItem).map(clone) : [];
}

export async function readDemoWorkoutSessions(): Promise<WorkoutSessionRow[]> {
  return deserializeDemoWorkoutSessions(await AsyncStorage.getItem(demoMovementWorkoutSessionsKey));
}

export async function writeDemoWorkoutSessions(rows: WorkoutSessionRow[]): Promise<void> {
  await AsyncStorage.setItem(demoMovementWorkoutSessionsKey, serializeDemoWorkoutSessions(rows));
}

export async function addDemoWorkoutSession(row: WorkoutSessionRow): Promise<WorkoutSessionRow[]> {
  const current = await readDemoWorkoutSessions();
  const next = [clone(row), ...current.filter((item) => item.id !== row.id)];
  await writeDemoWorkoutSessions(next);
  return next;
}

export async function updateDemoWorkoutSession(row: WorkoutSessionRow): Promise<WorkoutSessionRow[]> {
  const current = await readDemoWorkoutSessions();
  const next = current.map((item) => item.id === row.id ? clone(row) : item);
  await writeDemoWorkoutSessions(next);
  return next;
}

export async function deleteDemoWorkoutSession(sessionId: string): Promise<WorkoutSessionRow[]> {
  const current = await readDemoWorkoutSessions();
  const next = current.filter((item) => item.id !== sessionId);
  await writeDemoWorkoutSessions(next);
  const entries = await readDemoWorkoutExerciseEntries();
  await writeDemoWorkoutExerciseEntries(entries.filter((item) => item.workout_session_id !== sessionId));
  const sets = await readDemoWorkoutSetEntries();
  await writeDemoWorkoutSetEntries(sets.filter((item) => item.workout_session_id !== sessionId));
  return next;
}

export async function getDemoWorkoutSessionsForRange(startDate: string, endDate: string): Promise<WorkoutSessionRow[]> {
  const sessions = await readDemoWorkoutSessions();
  return sessions
    .filter((session) => session.session_date >= startDate.slice(0, 10) && session.session_date <= endDate.slice(0, 10))
    .sort((left, right) => right.logged_at.localeCompare(left.logged_at));
}

export async function readDemoWorkoutExerciseEntries(): Promise<WorkoutExerciseEntryRow[]> {
  return deserializeDemoWorkoutExerciseEntries(await AsyncStorage.getItem(demoMovementWorkoutExerciseEntriesKey));
}

export async function writeDemoWorkoutExerciseEntries(rows: WorkoutExerciseEntryRow[]): Promise<void> {
  await AsyncStorage.setItem(demoMovementWorkoutExerciseEntriesKey, serializeDemoWorkoutExerciseEntries(rows));
}

export async function addDemoWorkoutExerciseEntries(rows: WorkoutExerciseEntryRow[]): Promise<WorkoutExerciseEntryRow[]> {
  const current = await readDemoWorkoutExerciseEntries();
  const ids = new Set(rows.map((row) => row.id));
  const next = [...rows.map(clone), ...current.filter((item) => !ids.has(item.id))];
  await writeDemoWorkoutExerciseEntries(next);
  return next;
}

export async function deleteDemoWorkoutExerciseEntry(entryId: string): Promise<WorkoutExerciseEntryRow[]> {
  const current = await readDemoWorkoutExerciseEntries();
  const next = current.filter((item) => item.id !== entryId);
  await writeDemoWorkoutExerciseEntries(next);
  const sets = await readDemoWorkoutSetEntries();
  await writeDemoWorkoutSetEntries(sets.filter((item) => item.workout_exercise_entry_id !== entryId));
  return next;
}

export async function getDemoWorkoutExerciseEntriesForSession(sessionId: string): Promise<WorkoutExerciseEntryRow[]> {
  const entries = await readDemoWorkoutExerciseEntries();
  return entries
    .filter((entry) => entry.workout_session_id === sessionId)
    .sort((left, right) => left.order_index - right.order_index);
}

export async function readDemoWorkoutSetEntries(): Promise<WorkoutSetEntryRow[]> {
  return deserializeDemoWorkoutSetEntries(await AsyncStorage.getItem(demoMovementWorkoutSetEntriesKey));
}

export async function writeDemoWorkoutSetEntries(rows: WorkoutSetEntryRow[]): Promise<void> {
  await AsyncStorage.setItem(demoMovementWorkoutSetEntriesKey, serializeDemoWorkoutSetEntries(rows));
}

export async function addDemoWorkoutSetEntries(rows: WorkoutSetEntryRow[]): Promise<WorkoutSetEntryRow[]> {
  const current = await readDemoWorkoutSetEntries();
  const ids = new Set(rows.map((row) => row.id));
  const next = [...rows.map(clone), ...current.filter((item) => !ids.has(item.id))];
  await writeDemoWorkoutSetEntries(next);
  return next;
}

export async function getDemoWorkoutSetEntriesForSession(sessionId: string): Promise<WorkoutSetEntryRow[]> {
  const rows = await readDemoWorkoutSetEntries();
  return rows
    .filter((row) => row.workout_session_id === sessionId)
    .sort((left, right) => left.set_index - right.set_index);
}

export async function readDemoExerciseLibrary(): Promise<ExerciseLibraryItemRow[]> {
  return deserializeDemoExerciseLibrary(await AsyncStorage.getItem(demoMovementExerciseLibraryKey));
}

export async function writeDemoExerciseLibrary(rows: ExerciseLibraryItemRow[]): Promise<void> {
  await AsyncStorage.setItem(demoMovementExerciseLibraryKey, serializeDemoExerciseLibrary(rows));
}

export async function addDemoExerciseLibraryItem(row: ExerciseLibraryItemRow): Promise<ExerciseLibraryItemRow[]> {
  const current = await readDemoExerciseLibrary();
  const next = [clone(row), ...current.filter((item) => item.id !== row.id)];
  await writeDemoExerciseLibrary(next);
  return next;
}

export async function getLocalDemoMovementState(): Promise<LocalDemoMovementState> {
  const [exerciseLibrary, workoutSessions, workoutExerciseEntries, workoutSetEntries] = await Promise.all([
    readDemoExerciseLibrary(),
    readDemoWorkoutSessions(),
    readDemoWorkoutExerciseEntries(),
    readDemoWorkoutSetEntries()
  ]);
  return { exerciseLibrary, workoutSessions, workoutExerciseEntries, workoutSetEntries };
}

export async function clearDemoMovementData(): Promise<void> {
  await Promise.all([
    AsyncStorage.removeItem(demoMovementExerciseLibraryKey),
    AsyncStorage.removeItem(demoMovementWorkoutSessionsKey),
    AsyncStorage.removeItem(demoMovementWorkoutExerciseEntriesKey),
    AsyncStorage.removeItem(demoMovementWorkoutSetEntriesKey)
  ]);
}
