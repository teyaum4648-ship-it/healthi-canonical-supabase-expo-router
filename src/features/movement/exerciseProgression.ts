import type { AdaptiveMovementCapacity, DataConfidence } from '../../engines/movement';
import type { ExerciseProgress } from './exerciseProgress';
import { stepWeight, type WeightUnit } from './weightUnits';

/**
 * What to aim for next on one exercise.
 *
 * Four rules hold everywhere in this file:
 *
 * A suggestion always states its basis. Nothing is proposed that cannot be
 * explained from the sets actually logged.
 *
 * Safety outranks progression. When the day's protocol withholds training, the
 * only suggestions available are to hold or reduce — never to add load.
 *
 * Missing logs lower confidence; they are never read as poor recovery. A gap in
 * the record means we know less, not that something went wrong.
 *
 * Nothing here is applied. A suggestion is a proposal the lifter accepts or
 * edits, and it is computed once when a session starts so targets never change
 * under someone mid-workout.
 */

export type ProgressionAction =
  | 'add_load'
  | 'add_rep'
  | 'repeat'
  | 'reduce'
  | 'hold_technique'
  | 'no_history';

export type ProgressionSuggestion = {
  exercise_key: string;
  exercise_name: string;
  action: ProgressionAction;
  headline: string;
  /** Null where the history cannot support a figure. */
  target_weight: number | null;
  target_reps: number | null;
  target_sets: number | null;
  unit: WeightUnit;
  /** Every reason the suggestion rests on, in plain language. */
  rationale: string[];
  confidence: DataConfidence;
};

/** Sessions older than this stop supporting a confident suggestion. */
const STALE_AFTER_DAYS = 21;
/** Fewer than this and a load change is a guess rather than a reading. */
const MIN_SESSIONS_FOR_LOAD_CHANGE = 2;

function daysBetween(from: string, to: string): number {
  const start = new Date(`${from}T12:00:00Z`).getTime();
  const end = new Date(`${to}T12:00:00Z`).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return Number.POSITIVE_INFINITY;
  return Math.round((end - start) / 86_400_000);
}

function describeAge(days: number): string {
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 14) return `${days} days ago`;
  return `${Math.round(days / 7)} weeks ago`;
}

export function suggestNextSession(params: {
  progress: ExerciseProgress;
  capacity: AdaptiveMovementCapacity;
  trainingAllowed: boolean;
  today: string;
  unit: WeightUnit;
}): ProgressionSuggestion {
  const { progress, capacity, trainingAllowed, today, unit } = params;
  const base = { exercise_key: progress.key, exercise_name: progress.name, unit };

  const comparable = progress.sessions.filter((point) => point.top_weight !== null);
  const latest = progress.sessions[progress.sessions.length - 1] ?? null;
  const latestComparable = comparable[comparable.length - 1] ?? null;
  const previousComparable = comparable[comparable.length - 2] ?? null;

  if (!latest) {
    return {
      ...base,
      action: 'no_history',
      headline: 'No target yet',
      target_weight: null,
      target_reps: null,
      target_sets: null,
      rationale: ['Nothing logged for this movement yet, so there is nothing to base a target on.'],
      confidence: 'low'
    };
  }

  const age = daysBetween(latest.date, today);
  const rationale: string[] = [];
  const stale = age > STALE_AFTER_DAYS;

  // Safety first: a withheld-training day can only hold or reduce.
  if (!trainingAllowed) {
    return {
      ...base,
      action: 'reduce',
      headline: 'Keep it easy today',
      target_weight: latestComparable?.top_weight ?? null,
      target_reps: latestComparable?.top_reps ?? null,
      target_sets: Math.max(1, (latest.working_sets ?? 2) - 1),
      rationale: [
        "Today's protocol keeps training easy, so no load increase is suggested.",
        `Last logged ${describeAge(age)} at ${latestComparable?.top_weight ?? '—'} ${unit}.`
      ],
      confidence: 'high'
    };
  }

  if (capacity === 'restore') {
    return {
      ...base,
      action: 'reduce',
      headline: 'Lighter than last time',
      target_weight: latestComparable?.top_weight ?? null,
      target_reps: latestComparable?.top_reps ?? null,
      target_sets: Math.max(1, (latest.working_sets ?? 2) - 1),
      rationale: [
        "Today reads as a restore day, so the suggestion holds load and trims a set.",
        `Last logged ${describeAge(age)}.`
      ],
      confidence: 'medium'
    };
  }

  if (capacity === 'technique') {
    return {
      ...base,
      action: 'hold_technique',
      headline: 'Repeat at the same load',
      target_weight: latestComparable?.top_weight ?? null,
      target_reps: latestComparable?.top_reps ?? null,
      target_sets: latest.working_sets,
      rationale: [
        'Today reads as a technique day, so the suggestion repeats last session rather than adding to it.',
        `Last logged ${describeAge(age)}.`
      ],
      confidence: 'medium'
    };
  }

  // Without a comparable load there is still a rep target to offer.
  if (!latestComparable) {
    rationale.push(
      progress.sets_without_unit > 0
        ? 'Earlier sets were logged without a unit, so no load target can be compared.'
        : 'No load has been recorded for this movement, so only a rep target is suggested.'
    );
    return {
      ...base,
      action: 'repeat',
      headline: 'Match last time',
      target_weight: null,
      target_reps: latest.top_reps,
      target_sets: latest.working_sets,
      rationale,
      confidence: 'low'
    };
  }

  const lastWeight = latestComparable.top_weight!;
  const lastReps = latestComparable.top_reps;

  if (stale) {
    rationale.push(`Last logged ${describeAge(age)}, so the suggestion repeats rather than builds.`);
    return {
      ...base,
      action: 'repeat',
      headline: 'Ease back in at the same load',
      target_weight: lastWeight,
      target_reps: lastReps,
      target_sets: latestComparable.working_sets,
      rationale,
      confidence: 'low'
    };
  }

  if (comparable.length < MIN_SESSIONS_FOR_LOAD_CHANGE) {
    rationale.push('Only one comparable session so far, so the suggestion repeats it to establish a baseline.');
    return {
      ...base,
      action: 'repeat',
      headline: 'Repeat to set a baseline',
      target_weight: lastWeight,
      target_reps: lastReps,
      target_sets: latestComparable.working_sets,
      rationale,
      confidence: 'low'
    };
  }

  const previousWeight = previousComparable!.top_weight!;
  const previousReps = previousComparable!.top_reps;
  const held = Math.abs(lastWeight - previousWeight) < 1e-9;
  const repsImproved = lastReps !== null && previousReps !== null && lastReps > previousReps;
  const repsDropped = lastReps !== null && previousReps !== null && lastReps < previousReps;

  // Confidence reflects how much record there is, never how the body is assumed
  // to be doing.
  let confidence: DataConfidence = comparable.length >= 3 ? 'high' : 'medium';
  if (progress.sets_without_unit > 0) {
    confidence = 'medium';
    rationale.push(`${progress.sets_without_unit} earlier set${progress.sets_without_unit === 1 ? '' : 's'} had no unit recorded and are left out.`);
  }

  if (repsDropped) {
    rationale.push(`Top set went from ${previousReps} to ${lastReps} reps at ${lastWeight} ${unit}, so the suggestion repeats rather than adds.`);
    return {
      ...base,
      action: 'repeat',
      headline: `Repeat ${lastWeight} ${unit}`,
      target_weight: lastWeight,
      target_reps: previousReps,
      target_sets: latestComparable.working_sets,
      rationale,
      confidence
    };
  }

  if (held && repsImproved && capacity === 'push') {
    const next = stepWeight(lastWeight, unit, 1);
    rationale.push(`Reps rose from ${previousReps} to ${lastReps} at the same ${lastWeight} ${unit}.`);
    rationale.push(`Today reads as a push day, so the suggestion adds one increment to ${next} ${unit}.`);
    return {
      ...base,
      action: 'add_load',
      headline: `Try ${next} ${unit}`,
      target_weight: next,
      target_reps: previousReps,
      target_sets: latestComparable.working_sets,
      rationale,
      confidence
    };
  }

  if (held) {
    rationale.push(`Load held at ${lastWeight} ${unit} across the last two sessions.`);
    rationale.push('The suggestion adds a rep before adding weight.');
    return {
      ...base,
      action: 'add_rep',
      headline: `One more rep at ${lastWeight} ${unit}`,
      target_weight: lastWeight,
      target_reps: lastReps === null ? null : lastReps + 1,
      target_sets: latestComparable.working_sets,
      rationale,
      confidence
    };
  }

  if (lastWeight > previousWeight) {
    rationale.push(`Load already rose from ${previousWeight} to ${lastWeight} ${unit} last session.`);
    rationale.push('The suggestion repeats it before adding more.');
    return {
      ...base,
      action: 'repeat',
      headline: `Repeat ${lastWeight} ${unit}`,
      target_weight: lastWeight,
      target_reps: lastReps,
      target_sets: latestComparable.working_sets,
      rationale,
      confidence
    };
  }

  rationale.push(`Load came down from ${previousWeight} to ${lastWeight} ${unit} last session, so the suggestion holds there.`);
  return {
    ...base,
    action: 'repeat',
    headline: `Repeat ${lastWeight} ${unit}`,
    target_weight: lastWeight,
    target_reps: lastReps,
    target_sets: latestComparable.working_sets,
    rationale,
    confidence
  };
}

export function suggestionsForSession(params: {
  progress: ExerciseProgress[];
  exerciseKeys: string[];
  capacity: AdaptiveMovementCapacity;
  trainingAllowed: boolean;
  today: string;
  unit: WeightUnit;
}): Map<string, ProgressionSuggestion> {
  const byKey = new Map(params.progress.map((item) => [item.key, item]));
  const suggestions = new Map<string, ProgressionSuggestion>();
  for (const key of params.exerciseKeys) {
    const progress = byKey.get(key);
    if (!progress) continue;
    suggestions.set(key, suggestNextSession({
      progress,
      capacity: params.capacity,
      trainingAllowed: params.trainingAllowed,
      today: params.today,
      unit: params.unit
    }));
  }
  return suggestions;
}
