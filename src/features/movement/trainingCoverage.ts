import type {
  ExerciseLibraryItemRow,
  ExerciseMovementPattern,
  WorkoutExerciseEntryRow,
  WorkoutSessionRow,
  WorkoutSetEntryRow
} from './movementPersistence';
import { normalizeExerciseName } from './exerciseProgress';

/**
 * What your training has actually covered — not how strong a body part is.
 *
 * Coverage is grouped by movement pattern rather than by muscle. The library's
 * `primary_muscles` column is empty for the default exercises, so a muscle map
 * would be built on data that does not exist; movement pattern is populated, and
 * push/pull/hinge/squat balance is a real training idea that does not require
 * claiming which muscle head did the work.
 *
 * Nothing here scores a body part or predicts recovery. A pattern with no
 * logged work is reported as "no logged work", which is a fact, rather than as
 * a deficit, which would be a judgement the data cannot support.
 */

export type CoveragePattern = {
  pattern: ExerciseMovementPattern;
  label: string;
  working_sets: number;
  sessions: number;
  last_trained: string | null;
  /** Distinct exercise names that contributed, most recent first. */
  exercises: string[];
};

export type TrainingCoverage = {
  window_days: number;
  from_date: string;
  to_date: string;
  patterns: CoveragePattern[];
  /** Patterns the library knows about that saw no logged work in the window. */
  uncovered: CoveragePattern[];
  total_working_sets: number;
  /** Working sets whose exercise could not be matched to a known pattern. */
  unclassified_sets: number;
  /**
   * The movements behind that count, named.
   *
   * A pattern is never guessed from a name, so a movement the library has not seen
   * drops out of the balance entirely — "bench" is not "Bench Press". Reporting only
   * a number leaves nothing to do about it; naming them is what lets a screen offer
   * to learn one, which fixes every past and future session at once.
   */
  unclassified_exercises: { exercise_name: string; working_sets: number; last_trained: string }[];
};

const PATTERN_LABELS: Record<ExerciseMovementPattern, string> = {
  squat: 'Squat',
  hinge: 'Hinge',
  push: 'Push',
  pull: 'Pull',
  carry: 'Carry',
  lunge: 'Lunge',
  rotation: 'Rotation',
  locomotion: 'Locomotion',
  mobility: 'Mobility',
  other: 'Other'
};

/** Patterns worth reporting balance across. 'other' is a fallback, not a goal. */
const REPORTED_PATTERNS: ExerciseMovementPattern[] = [
  'squat', 'hinge', 'push', 'pull', 'lunge', 'carry', 'rotation', 'locomotion', 'mobility'
];

export function shiftIsoDate(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function buildTrainingCoverage(params: {
  sessions: WorkoutSessionRow[];
  entries: WorkoutExerciseEntryRow[];
  sets: WorkoutSetEntryRow[];
  library: ExerciseLibraryItemRow[];
  today: string;
  windowDays?: number;
}): TrainingCoverage {
  const windowDays = params.windowDays ?? 7;
  const fromDate = shiftIsoDate(params.today, -(windowDays - 1));

  const libraryById = new Map(params.library.map((item) => [item.id, item]));
  const libraryByName = new Map(params.library.map((item) => [normalizeExerciseName(item.name), item]));

  const sessionsInWindow = new Map(
    params.sessions
      .filter((session) => session.session_date >= fromDate && session.session_date <= params.today)
      .map((session) => [session.id, session])
  );

  const setsByEntry = new Map<string, WorkoutSetEntryRow[]>();
  for (const set of params.sets) {
    const bucket = setsByEntry.get(set.workout_exercise_entry_id);
    if (bucket) bucket.push(set); else setsByEntry.set(set.workout_exercise_entry_id, [set]);
  }

  type Bucket = { sets: number; sessions: Set<string>; last: string | null; exercises: Map<string, string> };
  const buckets = new Map<ExerciseMovementPattern, Bucket>();
  let totalWorkingSets = 0;
  let unclassified = 0;
  const unmatched = new Map<string, { exercise_name: string; working_sets: number; last_trained: string }>();

  for (const entry of params.entries) {
    const session = sessionsInWindow.get(entry.workout_session_id);
    if (!session) continue;
    const working = (setsByEntry.get(entry.id) ?? []).filter((set) => !set.warmup);
    if (working.length === 0) continue;

    const item = entry.exercise_library_item_id
      ? libraryById.get(entry.exercise_library_item_id)
      : libraryByName.get(normalizeExerciseName(entry.exercise_name));
    const pattern = item?.movement_pattern ?? null;

    totalWorkingSets += working.length;
    if (!pattern) {
      // An exercise with no known pattern is counted but never guessed at.
      unclassified += working.length;
      const key = normalizeExerciseName(entry.exercise_name);
      const seen = unmatched.get(key);
      unmatched.set(key, {
        exercise_name: seen?.exercise_name ?? entry.exercise_name,
        working_sets: (seen?.working_sets ?? 0) + working.length,
        last_trained: seen && seen.last_trained > session.session_date ? seen.last_trained : session.session_date
      });
      continue;
    }

    const bucket = buckets.get(pattern) ?? { sets: 0, sessions: new Set<string>(), last: null, exercises: new Map() };
    bucket.sets += working.length;
    bucket.sessions.add(session.id);
    if (bucket.last === null || session.session_date > bucket.last) bucket.last = session.session_date;
    const existing = bucket.exercises.get(entry.exercise_name);
    if (!existing || session.session_date > existing) bucket.exercises.set(entry.exercise_name, session.session_date);
    buckets.set(pattern, bucket);
  }

  function toPattern(pattern: ExerciseMovementPattern, bucket: Bucket | undefined): CoveragePattern {
    return {
      pattern,
      label: PATTERN_LABELS[pattern],
      working_sets: bucket?.sets ?? 0,
      sessions: bucket?.sessions.size ?? 0,
      last_trained: bucket?.last ?? null,
      exercises: bucket
        ? [...bucket.exercises.entries()]
            .sort((left, right) => right[1].localeCompare(left[1]))
            .map(([name]) => name)
        : []
    };
  }

  const covered = REPORTED_PATTERNS
    .filter((pattern) => buckets.has(pattern))
    .map((pattern) => toPattern(pattern, buckets.get(pattern)))
    .sort((left, right) => right.working_sets - left.working_sets);

  const uncovered = REPORTED_PATTERNS
    .filter((pattern) => !buckets.has(pattern))
    .map((pattern) => toPattern(pattern, undefined));

  return {
    window_days: windowDays,
    from_date: fromDate,
    to_date: params.today,
    patterns: covered,
    uncovered,
    total_working_sets: totalWorkingSets,
    unclassified_sets: unclassified,
    unclassified_exercises: [...unmatched.values()]
      .sort((left, right) => right.working_sets - left.working_sets || right.last_trained.localeCompare(left.last_trained))
  };
}

/**
 * A plain-language read of the window. Stays descriptive: it names what is
 * missing without asserting that missing work caused anything.
 */
export function coverageSummary(coverage: TrainingCoverage): string {
  if (coverage.total_working_sets === 0) {
    return `No working sets logged in the last ${coverage.window_days} days.`;
  }
  const top = coverage.patterns[0];
  if (!top) {
    return `${coverage.total_working_sets} working set${coverage.total_working_sets === 1 ? '' : 's'} logged in the last ${coverage.window_days} days. Movement patterns are not available for these exercises yet.`;
  }
  const missing = coverage.uncovered.filter((item) => item.pattern !== 'carry' && item.pattern !== 'rotation');
  const lead = `${coverage.total_working_sets} working set${coverage.total_working_sets === 1 ? '' : 's'} across ${coverage.patterns.length} pattern${coverage.patterns.length === 1 ? '' : 's'}, most in ${top.label.toLowerCase()}.`;
  if (missing.length === 0) return lead;
  const names = missing.slice(0, 3).map((item) => item.label.toLowerCase()).join(', ');
  return `${lead} No logged work in ${names}.`;
}
