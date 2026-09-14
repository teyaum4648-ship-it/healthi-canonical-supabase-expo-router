import type { MovementExerciseCategory, MovementWorkoutType } from '../../engines/movement';
import type { WorkoutExerciseEntryRow, WorkoutSessionRow } from './movementPersistence';
import type { Routine } from './routineStore';
import { DEFAULT_WEIGHT_UNIT, type WeightUnit } from './weightUnits';
import type { WorkoutTemplate } from './workoutForms';
import {
  createQuickExerciseDraft,
  createQuickSetDraft,
  type QuickExerciseDraft,
  type QuickWorkoutDraft
} from './workoutQuickLog';

/**
 * One way into a workout.
 *
 * Starting a session used to mean choosing between three surfaces that did not agree
 * with each other: a sheet with a text prompt and a routine carousel, a Templates
 * segment with a second copy of the same routines, and a long "Build a session" form
 * whose Add movement button sat below everything else. Each held a different draft
 * shape, so a choice made in one was not visible in the others.
 *
 * This is the single draft all three fed. It is deliberately small — a name and an
 * ordered list of movements — because sets, weights and reps belong to the session
 * logger, not to the decision to start. Anything a person picks from (a saved routine,
 * a starting point, last Tuesday) fills this same draft rather than jumping straight
 * into the logger, so the thing about to be started is always on screen first.
 */

export type StarterMovement = {
  id: string;
  name: string;
  /** Planned sets. The logger can add or drop them once the session is live. */
  sets: number;
  category: MovementExerciseCategory;
  library_item_id: string | null;
  /**
   * Sets already completed, when this movement is being edited mid-session. It is the
   * floor the set count cannot go below, and the reason removing the movement asks
   * first — logged work is the one thing here that cannot be typed again.
   */
  logged_sets?: number;
};

export type StarterDraft = {
  title: string;
  movements: StarterMovement[];
};

export type StarterTab = 'Routines' | 'Templates' | 'Recent';

export type StarterSource = {
  kind: StarterTab;
  id: string;
  title: string;
  /** What starting it would mean, in the terms that tab is organized by. */
  detail: string;
  workout_type: MovementWorkoutType;
  movements: StarterMovement[];
};

const MAX_RECENT = 6;
const MAX_MOVEMENTS = 12;
const DEFAULT_SETS = 3;

let starterSequence = 0;

/** Ids only have to be unique within one draft, but must survive a re-render. */
function starterId(): string {
  starterSequence += 1;
  return `starter-${Date.now().toString(36)}-${starterSequence.toString(36)}`;
}

const normalized = (value: string): string =>
  value.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export function createStarterMovement(
  name = '',
  category: MovementExerciseCategory = 'strength',
  sets = DEFAULT_SETS,
  libraryItemId: string | null = null
): StarterMovement {
  return {
    id: starterId(),
    name,
    sets: Math.min(10, Math.max(1, Math.round(sets) || DEFAULT_SETS)),
    category,
    library_item_id: libraryItemId
  };
}

export function createStarterDraft(): StarterDraft {
  return { title: '', movements: [] };
}

/** A movement with no name is a row someone has not filled in yet, not a movement. */
export function namedMovements(draft: StarterDraft): StarterMovement[] {
  return draft.movements.filter((movement) => movement.name.trim().length > 0);
}

export function canStart(draft: StarterDraft): boolean {
  return namedMovements(draft).length > 0;
}

/**
 * The name to save under.
 *
 * A blank name is normal — plenty of sessions are just "the squat one" — so rather
 * than refusing to start or saving "Untitled", the movements name it: one movement
 * lends its own name, several become "Squat + 2".
 */
export function starterTitle(draft: StarterDraft): string {
  const typed = draft.title.trim();
  if (typed) return typed;
  const names = namedMovements(draft).map((movement) => movement.name.trim());
  if (names.length === 0) return '';
  return names.length === 1 ? names[0] : `${names[0]} + ${names.length - 1}`;
}

function workoutTypeFor(movements: StarterMovement[]): MovementWorkoutType {
  const unique = new Set(movements.map((movement) => movement.category));
  if (unique.size === 0) return 'other';
  if (unique.size > 1) return 'mixed';
  return movements[0].category;
}

export function starterWorkoutType(draft: StarterDraft): MovementWorkoutType {
  return workoutTypeFor(namedMovements(draft));
}

/** The fewest sets a movement can be cut to: never fewer than what is already logged. */
export function minimumSets(movement: StarterMovement): number {
  return Math.max(1, movement.logged_sets ?? 0);
}

export function addMovement(draft: StarterDraft, movement?: StarterMovement): StarterDraft {
  if (draft.movements.length >= MAX_MOVEMENTS) return draft;
  return { ...draft, movements: [...draft.movements, movement ?? createStarterMovement()] };
}

export function updateMovement(
  draft: StarterDraft,
  id: string,
  update: Partial<Omit<StarterMovement, 'id'>>
): StarterDraft {
  return {
    ...draft,
    movements: draft.movements.map((movement) => movement.id === id ? { ...movement, ...update } : movement)
  };
}

export function removeMovement(draft: StarterDraft, id: string): StarterDraft {
  return { ...draft, movements: draft.movements.filter((movement) => movement.id !== id) };
}

export function moveMovement(draft: StarterDraft, id: string, direction: -1 | 1): StarterDraft {
  const index = draft.movements.findIndex((movement) => movement.id === id);
  const next = index + direction;
  if (index === -1 || next < 0 || next >= draft.movements.length) return draft;
  const movements = [...draft.movements];
  [movements[index], movements[next]] = [movements[next], movements[index]];
  return { ...draft, movements };
}

/** Replaces the draft wholesale: picking a routine means starting that routine. */
export function applySource(source: StarterSource): StarterDraft {
  return {
    title: source.title,
    movements: source.movements.map((movement) => ({ ...movement, id: starterId() }))
  };
}

export function routineSource(routine: Routine): StarterSource {
  const movements = routine.exercises.map((exercise) =>
    createStarterMovement(exercise.exercise_name, exercise.category, exercise.sets, exercise.exercise_library_item_id));
  const sets = movements.reduce((total, movement) => total + movement.sets, 0);
  return {
    kind: 'Routines',
    id: `routine-${routine.id}`,
    title: routine.title,
    detail: `${movements.length} movement${movements.length === 1 ? '' : 's'} · ${sets} set${sets === 1 ? '' : 's'}`,
    workout_type: routine.workout_type,
    movements
  };
}

export function templateSource(template: WorkoutTemplate): StarterSource {
  const movements = template.exercises.map((exercise) =>
    createStarterMovement(exercise.exercise_name, exercise.category, Number(exercise.sets) || DEFAULT_SETS));
  return {
    kind: 'Templates',
    id: `template-${template.id}`,
    title: template.title,
    detail: `${movements.length} movement${movements.length === 1 ? '' : 's'} · about ${template.duration_minutes} min`,
    workout_type: template.workout_type,
    movements
  };
}

/**
 * Past sessions, rebuilt as something startable.
 *
 * Same-titled sessions collapse to the most recent, because a list offering "Upper
 * push" five times is a list of one thing. A session whose movements were not kept
 * is skipped rather than offered as an empty start.
 */
export function recentSources(params: {
  sessions: WorkoutSessionRow[];
  entries: WorkoutExerciseEntryRow[];
  formatDate: (date: string) => string;
}): StarterSource[] {
  const bySession = new Map<string, WorkoutExerciseEntryRow[]>();
  for (const entry of params.entries) {
    bySession.set(entry.workout_session_id, [...(bySession.get(entry.workout_session_id) ?? []), entry]);
  }

  const seen = new Set<string>();
  const sources: StarterSource[] = [];
  const ordered = [...params.sessions].sort((left, right) => right.session_date.localeCompare(left.session_date));

  for (const session of ordered) {
    if (sources.length >= MAX_RECENT) break;
    const key = normalized(session.title);
    if (!key || seen.has(key)) continue;
    const rows = (bySession.get(session.id) ?? []).sort((left, right) => left.order_index - right.order_index);
    if (rows.length === 0) continue;
    seen.add(key);
    const movements = rows.map((row) =>
      createStarterMovement(row.exercise_name, row.category, row.sets ?? DEFAULT_SETS, row.exercise_library_item_id));
    sources.push({
      kind: 'Recent',
      id: `recent-${session.id}`,
      title: session.title,
      detail: `${params.formatDate(session.session_date)} · ${movements.length} movement${movements.length === 1 ? '' : 's'}`,
      workout_type: session.workout_type,
      movements
    });
  }

  return sources;
}

/**
 * A live session, opened back up as the screen that built it.
 *
 * Mid-session the movement list is the thing people want to change — one more
 * movement, one fewer, a rename — and the only way to do it was a button inside the
 * logger's Overview tab. Going back to where the list was made is the obvious move,
 * so the back arrow does that. Ids carry over from the session's own exercises, which
 * is what lets the trip back tell an edited movement from a new one.
 */
export function starterFromQuickDraft(draft: QuickWorkoutDraft): StarterDraft {
  return {
    title: draft.title,
    movements: draft.exercises.map((exercise) => ({
      id: exercise.id,
      name: exercise.exercise_name,
      sets: exercise.sets.length,
      category: exercise.category,
      library_item_id: exercise.exercise_library_item_id,
      logged_sets: exercise.sets.filter((set) => set.completed).length
    }))
  };
}

/**
 * Sets kept, added or dropped to match a new count.
 *
 * A completed set is never dropped, whatever the count says: it is a record of work
 * that happened, and no edit on a planning screen should be able to erase it. Trailing
 * empty rows go first, and the remaining sets are re-indexed so the logger's numbering
 * and its comparison against last time stay in step.
 */
function resizeSets(exercise: QuickExerciseDraft, target: number): QuickExerciseDraft {
  const completed = exercise.sets.filter((set) => set.completed).length;
  const wanted = Math.max(Math.max(1, completed), Math.min(10, target));
  let sets = [...exercise.sets];

  for (let index = sets.length - 1; index >= 0 && sets.length > wanted; index -= 1) {
    if (!sets[index].completed) sets.splice(index, 1);
  }
  while (sets.length < wanted) sets = [...sets, createQuickSetDraft(sets.length + 1)];

  return { ...exercise, sets: sets.map((set, index) => ({ ...set, set_index: index + 1 })) };
}

/**
 * The edited list, folded back into the running session.
 *
 * A movement the session already had keeps everything it has logged; one that was
 * added arrives empty; one that was removed is gone. Order follows the editor, because
 * that is what the person just arranged.
 */
export function applyStarterToQuickDraft(draft: QuickWorkoutDraft, starter: StarterDraft): QuickWorkoutDraft {
  const existing = new Map(draft.exercises.map((exercise) => [exercise.id, exercise]));
  const movements = namedMovements(starter);
  if (movements.length === 0) return draft;

  const exercises = movements.map((movement) => {
    const current = existing.get(movement.id);
    if (!current) {
      return createQuickExerciseDraft(movement.name.trim(), movement.category, movement.sets, movement.library_item_id);
    }
    return resizeSets({ ...current, exercise_name: movement.name.trim() }, movement.sets);
  });

  return {
    ...draft,
    title: starterTitle(starter) || draft.title,
    workout_type: workoutTypeFor(movements),
    exercises
  };
}

/** The draft, converted into what the session logger runs on. */
export function toQuickWorkoutDraft(
  draft: StarterDraft,
  options: { weightUnit?: WeightUnit; startedAt?: string } = {}
): QuickWorkoutDraft | null {
  const movements = namedMovements(draft);
  if (movements.length === 0) return null;
  return {
    title: starterTitle(draft),
    workout_type: workoutTypeFor(movements),
    started_at: options.startedAt ?? new Date().toISOString(),
    weight_unit: options.weightUnit ?? DEFAULT_WEIGHT_UNIT,
    exercises: movements.map((movement) =>
      createQuickExerciseDraft(movement.name.trim(), movement.category, movement.sets, movement.library_item_id))
  };
}
