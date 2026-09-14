import type { DataConfidence } from '../../types/common';
import type { ExerciseProgress } from './exerciseProgress';
import type { ProgressionSuggestion } from './exerciseProgression';
import type { CoveragePattern, TrainingCoverage } from './trainingCoverage';
import type { WeightUnit } from './weightUnits';
import type { ExerciseChange, WorkoutSummary } from './workoutSummary';

/**
 * What a finished session earned, composed for the screen that follows a save.
 *
 * Nothing here is computed from scratch: the comparison comes from
 * summarizeQuickWorkout, the records from buildExerciseProgress, the week from
 * buildTrainingCoverage and the suggestion from suggestNextSession. Three of those
 * four already ran and went unread at save time, which is why saving used to land on
 * a dismissible card.
 *
 * The composition rules are the same ones the rest of Move follows. A section with
 * nothing to say is absent rather than padded with an encouraging non-statement; a
 * record names the figure it passed so it is never unattributable; and uncovered
 * patterns are described, never diagnosed.
 */

export type SessionRecordKind = 'heaviest' | 'most_reps';

export type SessionRecord = {
  exercise_name: string;
  kind: SessionRecordKind;
  value: number;
  reps: number | null;
  /** Null for a rep record, where the load may have carried no unit. */
  unit: WeightUnit | null;
  /** The figure this passed, so the record is never a bare claim. */
  previous: number | null;
  previous_date: string | null;
};

export type SessionRecap = {
  title: string;
  working_sets: number;
  warmup_sets: number;
  exercises_logged: number;
  duration_minutes: number | null;
  /** Movements with history to compare against. Empty on a first-ever session. */
  changes: ExerciseChange[];
  /** Bests this session passed. These are the reward, so they get a card each. */
  records: SessionRecord[];
  /**
   * Movements measured for the first time. On a first-ever session every movement
   * qualifies, and a column of identical trophies is not a reward — so these are
   * acknowledged once, in a line, rather than celebrated individually.
   */
  baselines: SessionRecord[];
  /** Patterns with logged work this week, most worked first. */
  patterns: CoveragePattern[];
  /** Patterns the library knows that saw nothing this week, worth naming. */
  uncovered: CoveragePattern[];
  /** Working sets this week whose exercise matched no known pattern. */
  unclassified_sets: number;
  /**
   * Movements trained in this session that the library could not place, most sets
   * first. Naming them turns a dead-end note into one tap that teaches the library,
   * which then classifies every past and future session under that name.
   */
  unclassified_here: { exercise_name: string; working_sets: number }[];
  /** One suggestion for next time, or null when the history cannot support one. */
  next_time: ProgressionSuggestion | null;
  /** Lowest confidence among the parts that carry one. */
  confidence: DataConfidence;
};

/** Patterns excluded from a "you have not trained this" note, matching coverageSummary. */
const INCIDENTAL_PATTERNS = ['carry', 'rotation'];

const CONFIDENCE_RANK: Record<DataConfidence, number> = { low: 0, medium: 1, high: 2 };

const day = (value: string | null | undefined): string | null => value?.slice(0, 10) ?? null;

/**
 * Records this session set.
 *
 * A record counts only when its date is this session's date, so re-opening the recap
 * later never re-credits an older best. The previous figure is read from the sessions
 * before today rather than from the record itself, which only knows the winner.
 */
function recordsForSession(progress: ExerciseProgress[], sessionDate: string): SessionRecord[] {
  const today = day(sessionDate);
  const records: SessionRecord[] = [];

  for (const exercise of progress) {
    const earlier = exercise.sessions.filter((point) => day(point.date) !== null && day(point.date)! < today!);

    // A load record needs a load. Bodyweight and mobility work arrives with a weight of
    // zero, and "heaviest yet, 0 lb" is not a record — such a session falls through to
    // the rep record below, which is the figure that actually moved.
    if (exercise.heaviest && exercise.heaviest.value > 0 && day(exercise.heaviest.date) === today) {
      const previousBest = earlier
        .map((point) => point.top_weight)
        .filter((value): value is number => value !== null);
      records.push({
        exercise_name: exercise.name,
        kind: 'heaviest',
        value: exercise.heaviest.value,
        reps: exercise.heaviest.reps,
        unit: exercise.unit,
        previous: previousBest.length ? Math.max(...previousBest) : null,
        previous_date: previousBest.length
          ? earlier.filter((point) => point.top_weight === Math.max(...previousBest)).at(-1)?.date ?? null
          : null
      });
      continue;
    }

    // A rep record only earns a place when no load record already spoke for this movement.
    if (exercise.most_reps && day(exercise.most_reps.date) === today) {
      const previousReps = earlier
        .map((point) => point.top_reps)
        .filter((value): value is number => value !== null);
      records.push({
        exercise_name: exercise.name,
        kind: 'most_reps',
        value: exercise.most_reps.value,
        reps: exercise.most_reps.reps,
        unit: null,
        previous: previousReps.length ? Math.max(...previousReps) : null,
        previous_date: null
      });
    }
  }

  return records;
}

/** Uncovered patterns worth naming: the ones a person would plan around. */
export function notableUncovered(coverage: TrainingCoverage): CoveragePattern[] {
  return coverage.uncovered.filter((item) => !INCIDENTAL_PATTERNS.includes(item.pattern));
}

export function buildSessionRecap(params: {
  summary: WorkoutSummary;
  progress: ExerciseProgress[];
  coverage: TrainingCoverage;
  sessionDate: string;
  /** Suggestions for the movements just trained; the strongest is surfaced. */
  suggestions?: ProgressionSuggestion[];
}): SessionRecap {
  const measured = recordsForSession(params.progress, params.sessionDate);

  // Only a suggestion that can name a target is worth showing on a recap; a
  // no-history placeholder belongs in the next session, not in this one's result.
  const usable = (params.suggestions ?? []).filter(
    (item) => item.action !== 'no_history' && (item.target_weight !== null || item.target_reps !== null)
  );
  const nextTime = [...usable].sort(
    (left, right) => CONFIDENCE_RANK[right.confidence] - CONFIDENCE_RANK[left.confidence]
  )[0] ?? null;

  const confidences: DataConfidence[] = [nextTime?.confidence ?? 'low'];
  if (params.coverage.unclassified_sets > 0) confidences.push('low');

  return {
    title: params.summary.title,
    working_sets: params.summary.working_sets,
    warmup_sets: params.summary.warmup_sets,
    exercises_logged: params.summary.exercises_logged,
    duration_minutes: params.summary.duration_minutes,
    changes: params.summary.changes.filter((change) => change.direction !== 'new'),
    records: measured.filter((record) => record.previous !== null),
    baselines: measured.filter((record) => record.previous === null),
    patterns: params.coverage.patterns,
    uncovered: notableUncovered(params.coverage),
    unclassified_sets: params.coverage.unclassified_sets,
    // Only the ones trained today: an older unplaced movement is not this session's
    // business, and a list of everything the library never learned is a chore.
    unclassified_here: params.coverage.unclassified_exercises
      .filter((item) => day(item.last_trained) === day(params.sessionDate))
      .map((item) => ({ exercise_name: item.exercise_name, working_sets: item.working_sets })),
    next_time: nextTime,
    confidence: confidences.reduce(
      (lowest, item) => (CONFIDENCE_RANK[item] < CONFIDENCE_RANK[lowest] ? item : lowest),
      'high' as DataConfidence
    )
  };
}

/** "140 lb × 8, past 135 lb" — the record and what it beat, in one line. */
export function recordDetail(record: SessionRecord): string {
  const unit = record.unit ? ` ${record.unit}` : '';
  const head = record.kind === 'heaviest'
    ? `${record.value}${unit}${record.reps === null ? '' : ` × ${record.reps}`}`
    : `${record.value} reps`;
  if (record.previous === null) {
    return `${head} — your first recorded ${record.kind === 'heaviest' ? 'load' : 'rep count'} for this movement.`;
  }
  const previousUnit = record.kind === 'heaviest' ? unit : ' reps';
  return `${head} — past ${record.previous}${previousUnit}.`;
}

/**
 * "Goblet Squat, Dumbbell Row and Push-Up" — first measurements, named once.
 *
 * Names rather than counts, because "3 new movements" is a statistic and the names are
 * what the lifter recognises. Past three, the tail is counted so the line stays readable.
 */
export function baselineNames(baselines: SessionRecord[]): string {
  const names = baselines.map((record) => record.exercise_name);
  if (names.length <= 1) return names[0] ?? '';
  const shown = names.slice(0, 3);
  const rest = names.length - shown.length;
  const joined = shown.length === 2
    ? `${shown[0]} and ${shown[1]}`
    : `${shown.slice(0, -1).join(', ')} and ${shown.at(-1)}`;
  return rest > 0 ? `${shown.join(', ')} and ${rest} more` : joined;
}

/** "11 working sets · 2 warm-up · 47 min", skipping anything unknown. */
export function recapMeta(recap: SessionRecap): string {
  const parts = [`${recap.working_sets} working set${recap.working_sets === 1 ? '' : 's'}`];
  if (recap.warmup_sets > 0) parts.push(`${recap.warmup_sets} warm-up`);
  // A session whose duration rounds to nothing says "0 min", which reads as a defect
  // rather than a short workout; leaving it out is the honest rendering.
  if (recap.duration_minutes !== null && recap.duration_minutes > 0) {
    parts.push(`${recap.duration_minutes} min`);
  }
  return parts.join(' · ');
}
