import {
  convertWeight,
  type WeightUnit
} from './weightUnits';
import type {
  WorkoutExerciseEntryRow,
  WorkoutSessionRow,
  WorkoutSetEntryRow
} from './movementPersistence';

/**
 * Per-exercise history and records.
 *
 * Two rules shape everything here:
 *
 * Variants stay separate. A machine press, a dumbbell press and a barbell press
 * are different exercises, so grouping keys on the canonical library id when one
 * exists and falls back to the normalized name — never on a looser match that
 * would silently merge them.
 *
 * A weight with no unit is not comparable. Sets logged before units existed are
 * counted where the unit does not matter (rep records, session counts) and
 * excluded where it does (load records, volume, one-rep-max estimates), with the
 * exclusion reported rather than hidden.
 */

export type ExerciseSetPoint = {
  session_id: string;
  date: string;
  set_index: number;
  /** Normalized into the requested unit; null when the set carried no unit. */
  weight: number | null;
  reps: number | null;
  rpe: number | null;
};

export type ExerciseSessionPoint = {
  session_id: string;
  date: string;
  /** Heaviest comparable working set of that session. */
  top_weight: number | null;
  top_reps: number | null;
  working_sets: number;
  /** Sum of weight × reps across comparable working sets. */
  volume: number | null;
};

export type ExerciseRecord = {
  value: number;
  reps: number | null;
  date: string;
};

export type OneRepMaxEstimate = {
  value: number;
  /** The set it came from, so the number is never unattributable. */
  from: { weight: number; reps: number; date: string };
  basis: string;
};

export type ExerciseProgress = {
  key: string;
  name: string;
  library_item_id: string | null;
  unit: WeightUnit;
  sessions: ExerciseSessionPoint[];
  last_performed: string | null;
  total_working_sets: number;
  /** Heaviest working set with a known unit. */
  heaviest: ExerciseRecord | null;
  /** Most reps in a single working set, regardless of unit. */
  most_reps: ExerciseRecord | null;
  estimated_one_rep_max: OneRepMaxEstimate | null;
  /** Working sets skipped from load maths because they carried no unit. */
  sets_without_unit: number;
};

export function normalizeExerciseName(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/** Library id when known, otherwise the normalized name. Never a looser match. */
export function exerciseKey(entry: { exercise_library_item_id: string | null; exercise_name: string }): string {
  return entry.exercise_library_item_id
    ? `library:${entry.exercise_library_item_id}`
    : `name:${normalizeExerciseName(entry.exercise_name)}`;
}

function comparableWeight(set: WorkoutSetEntryRow, unit: WeightUnit): number | null {
  if (typeof set.weight !== 'number' || !Number.isFinite(set.weight)) return null;
  if (!set.weight_unit) return null;
  return set.weight_unit === unit ? set.weight : convertWeight(set.weight, set.weight_unit, unit);
}

/**
 * Epley, and only where it holds up. Above ten reps the estimate drifts far
 * enough that reporting it would be a guess dressed as a measurement.
 */
const MAX_ESTIMABLE_REPS = 10;

function estimateOneRepMax(weight: number, reps: number): number | null {
  if (reps < 1 || reps > MAX_ESTIMABLE_REPS) return null;
  if (reps === 1) return weight;
  return Math.round(weight * (1 + reps / 30) * 10) / 10;
}

export function buildExerciseProgress(
  params: {
    sessions: WorkoutSessionRow[];
    entries: WorkoutExerciseEntryRow[];
    sets: WorkoutSetEntryRow[];
    unit: WeightUnit;
  }
): ExerciseProgress[] {
  const sessionById = new Map(params.sessions.map((session) => [session.id, session]));
  const setsByEntry = new Map<string, WorkoutSetEntryRow[]>();
  for (const set of params.sets) {
    const bucket = setsByEntry.get(set.workout_exercise_entry_id);
    if (bucket) bucket.push(set); else setsByEntry.set(set.workout_exercise_entry_id, [set]);
  }

  const grouped = new Map<string, { name: string; libraryId: string | null; entries: WorkoutExerciseEntryRow[] }>();
  for (const entry of params.entries) {
    const key = exerciseKey(entry);
    const existing = grouped.get(key);
    if (existing) {
      existing.entries.push(entry);
      // Prefer a library-backed name once one appears.
      if (!existing.libraryId && entry.exercise_library_item_id) {
        existing.libraryId = entry.exercise_library_item_id;
        existing.name = entry.exercise_name;
      }
    } else {
      grouped.set(key, {
        name: entry.exercise_name,
        libraryId: entry.exercise_library_item_id,
        entries: [entry]
      });
    }
  }

  const progress: ExerciseProgress[] = [];
  for (const [key, group] of grouped) {
    const sessionPoints: ExerciseSessionPoint[] = [];
    let heaviest: ExerciseRecord | null = null;
    let mostReps: ExerciseRecord | null = null;
    let best1rm: OneRepMaxEstimate | null = null;
    let totalWorkingSets = 0;
    let withoutUnit = 0;

    for (const entry of group.entries) {
      const session = sessionById.get(entry.workout_session_id);
      if (!session) continue;
      const date = session.session_date;
      const working = (setsByEntry.get(entry.id) ?? []).filter((set) => !set.warmup);
      if (working.length === 0) continue;
      totalWorkingSets += working.length;

      let topWeight: number | null = null;
      let topReps: number | null = null;
      let volume: number | null = null;

      for (const set of working) {
        const weight = comparableWeight(set, params.unit);
        if (weight === null && typeof set.weight === 'number') withoutUnit += 1;

        if (typeof set.reps === 'number' && (mostReps === null || set.reps > mostReps.value)) {
          mostReps = { value: set.reps, reps: set.reps, date };
        }
        if (weight === null) continue;

        if (topWeight === null || weight > topWeight) {
          topWeight = weight;
          topReps = set.reps;
        }
        if (heaviest === null || weight > heaviest.value) {
          heaviest = { value: Math.round(weight * 10) / 10, reps: set.reps, date };
        }
        if (typeof set.reps === 'number') {
          volume = (volume ?? 0) + weight * set.reps;
          const estimate = estimateOneRepMax(weight, set.reps);
          if (estimate !== null && (best1rm === null || estimate > best1rm.value)) {
            best1rm = {
              value: estimate,
              from: { weight: Math.round(weight * 10) / 10, reps: set.reps, date },
              basis: `Epley estimate from ${Math.round(weight * 10) / 10} ${params.unit} × ${set.reps}`
            };
          }
        }
      }

      sessionPoints.push({
        session_id: session.id,
        date,
        top_weight: topWeight === null ? null : Math.round(topWeight * 10) / 10,
        top_reps: topReps,
        working_sets: working.length,
        volume: volume === null ? null : Math.round(volume)
      });
    }

    if (sessionPoints.length === 0) continue;
    sessionPoints.sort((left, right) => left.date.localeCompare(right.date));

    progress.push({
      key,
      name: group.name,
      library_item_id: group.libraryId,
      unit: params.unit,
      sessions: sessionPoints,
      last_performed: sessionPoints[sessionPoints.length - 1]?.date ?? null,
      total_working_sets: totalWorkingSets,
      heaviest,
      most_reps: mostReps,
      estimated_one_rep_max: best1rm,
      sets_without_unit: withoutUnit
    });
  }

  progress.sort((left, right) => (right.last_performed ?? '').localeCompare(left.last_performed ?? ''));
  return progress;
}

/** Change between the two most recent sessions, when both are comparable. */
export function recentTopSetChange(progress: ExerciseProgress): { delta: number; from: string; to: string } | null {
  const withWeight = progress.sessions.filter((point) => point.top_weight !== null);
  if (withWeight.length < 2) return null;
  const latest = withWeight[withWeight.length - 1];
  const previous = withWeight[withWeight.length - 2];
  return {
    delta: Math.round((latest.top_weight! - previous.top_weight!) * 10) / 10,
    from: previous.date,
    to: latest.date
  };
}
