import { describe, expect, it } from 'vitest';

import {
  baselineNames,
  buildSessionRecap,
  notableUncovered,
  recapMeta,
  recordDetail
} from '../../../src/features/movement/sessionRecap';
import type { ExerciseProgress } from '../../../src/features/movement/exerciseProgress';
import type { ProgressionSuggestion } from '../../../src/features/movement/exerciseProgression';
import type { CoveragePattern, TrainingCoverage } from '../../../src/features/movement/trainingCoverage';
import type { WorkoutSummary } from '../../../src/features/movement/workoutSummary';

const TODAY = '2026-09-14';

function summary(overrides: Partial<WorkoutSummary> = {}): WorkoutSummary {
  return {
    title: 'Upper push',
    working_sets: 11,
    warmup_sets: 2,
    exercises_logged: 3,
    duration_minutes: 47,
    changes: [
      { exercise_id: 'a', exercise_name: 'Bench Press', direction: 'up', detail: '+5 lb' },
      { exercise_id: 'b', exercise_name: 'New Lift', direction: 'new', detail: 'first time' }
    ],
    headline: 'Bench Press went up',
    ...overrides
  };
}

function progress(overrides: Partial<ExerciseProgress> = {}): ExerciseProgress {
  return {
    key: 'library:bench',
    name: 'Bench Press',
    library_item_id: 'bench',
    unit: 'lb',
    sessions: [
      { session_id: 's1', date: '2026-08-29', top_weight: 135, top_reps: 8, working_sets: 3, volume: 3240 },
      { session_id: 's2', date: TODAY, top_weight: 140, top_reps: 8, working_sets: 3, volume: 3360 }
    ],
    last_performed: TODAY,
    total_working_sets: 6,
    heaviest: { value: 140, reps: 8, date: TODAY },
    most_reps: { value: 8, reps: 8, date: '2026-08-29' },
    estimated_one_rep_max: null,
    sets_without_unit: 0,
    ...overrides
  };
}

// Real coverage rows carry a lowercase pattern id and a display label.
function pattern(id: string, label: string, sets: number): CoveragePattern {
  return { pattern: id as CoveragePattern['pattern'], label, working_sets: sets, sessions: 1, last_trained: TODAY, exercises: [] };
}

function coverage(overrides: Partial<TrainingCoverage> = {}): TrainingCoverage {
  return {
    window_days: 7,
    from_date: '2026-09-08',
    to_date: TODAY,
    patterns: [pattern('push', 'Push', 11), pattern('squat', 'Squat', 6)],
    uncovered: [pattern('pull', 'Pull', 0), pattern('carry', 'Carry', 0)],
    total_working_sets: 17,
    unclassified_sets: 0,
    unclassified_exercises: [],
    ...overrides
  };
}

function suggestion(overrides: Partial<ProgressionSuggestion> = {}): ProgressionSuggestion {
  return {
    exercise_key: 'library:bench',
    exercise_name: 'Bench Press',
    action: 'add_rep',
    headline: 'Try 140 lb × 9',
    target_weight: 140,
    target_reps: 9,
    target_sets: 3,
    unit: 'lb',
    rationale: ['Adds a rep before adding weight.'],
    confidence: 'medium',
    ...overrides
  };
}

function recap(over: Partial<Parameters<typeof buildSessionRecap>[0]> = {}) {
  return buildSessionRecap({
    summary: summary(),
    progress: [progress()],
    coverage: coverage(),
    sessionDate: TODAY,
    suggestions: [suggestion()],
    ...over
  });
}

describe('what the session earned', () => {
  it('carries the comparison but drops movements with nothing to compare', () => {
    // A first-ever movement has no story yet; padding the list with it would imply one.
    expect(recap().changes.map((change) => change.exercise_name)).toEqual(['Bench Press']);
  });

  it('credits a record set today and names the figure it passed', () => {
    const [record] = recap().records;
    expect(record).toMatchObject({ exercise_name: 'Bench Press', kind: 'heaviest', value: 140, previous: 135 });
    expect(recordDetail(record)).toBe('140 lb × 8 — past 135 lb.');
  });

  it('never re-credits a record from an earlier session', () => {
    // Re-opening the recap later must not keep announcing an old best as new.
    const older = progress({ heaviest: { value: 140, reps: 8, date: '2026-08-29' }, most_reps: { value: 8, reps: 8, date: '2026-08-29' } });
    expect(recap({ progress: [older] }).records).toEqual([]);
  });

  it('treats a first measurement as a baseline rather than a beaten record', () => {
    // Nothing was passed, so it is not a card; it is the line that says a bar now exists.
    const first = progress({
      sessions: [{ session_id: 's2', date: TODAY, top_weight: 140, top_reps: 8, working_sets: 3, volume: 3360 }]
    });
    const result = recap({ progress: [first] });
    expect(result.records).toEqual([]);
    expect(recordDetail(result.baselines[0]))
      .toBe('140 lb × 8 — your first recorded load for this movement.');
  });

  it('names first measurements once instead of repeating a trophy per movement', () => {
    // A first-ever session makes every movement a record, which is not a reward.
    const names = ['Goblet Squat', 'Dumbbell Row', 'Push-Up', 'Plank'];
    const firsts = names.map((name, index) => progress({
      key: `library:${index}`,
      name,
      sessions: [{ session_id: `s${index}`, date: TODAY, top_weight: 100, top_reps: 8, working_sets: 3, volume: 2400 }],
      heaviest: { value: 100, reps: 8, date: TODAY },
      most_reps: { value: 8, reps: 8, date: TODAY }
    }));
    const result = recap({ progress: firsts });
    expect(result.records).toEqual([]);
    expect(result.baselines).toHaveLength(4);
    expect(baselineNames(result.baselines)).toBe('Goblet Squat, Dumbbell Row, Push-Up and 1 more');
    expect(baselineNames(result.baselines.slice(0, 2))).toBe('Goblet Squat and Dumbbell Row');
    expect(baselineNames(result.baselines.slice(0, 1))).toBe('Goblet Squat');
    expect(baselineNames([])).toBe('');
  });

  it('reports a rep record without inventing a unit for it', () => {
    const reps = progress({
      unit: 'lb',
      heaviest: null,
      most_reps: { value: 12, reps: 12, date: TODAY }
    });
    const [record] = recap({ progress: [reps] }).records;
    expect(record).toMatchObject({ kind: 'most_reps', value: 12, unit: null });
    expect(recordDetail(record)).toContain('reps');
  });

  it('does not call an unloaded movement a heaviest-ever', () => {
    // Bodyweight and mobility work logs a weight of zero. "Heaviest yet, 0 lb" is not a
    // record; the rep count is the figure that actually moved, so that is what shows.
    const unloaded = progress({
      name: 'Mobility Flow',
      sessions: [{ session_id: 's2', date: TODAY, top_weight: 0, top_reps: 10, working_sets: 1, volume: 0 }],
      heaviest: { value: 0, reps: 10, date: TODAY },
      most_reps: { value: 10, reps: 10, date: TODAY }
    });
    const [record] = recap({ progress: [unloaded] }).baselines;
    expect(record).toMatchObject({ kind: 'most_reps', value: 10 });
    expect(recordDetail(record)).toBe('10 reps — your first recorded rep count for this movement.');
  });

  it('gives a movement one record, not two', () => {
    const both = progress({
      heaviest: { value: 140, reps: 8, date: TODAY },
      most_reps: { value: 8, reps: 8, date: TODAY }
    });
    expect(recap({ progress: [both] }).records).toHaveLength(1);
  });
});

describe('the week, described rather than diagnosed', () => {
  it('names patterns with no logged work, skipping the incidental ones', () => {
    // Carry and rotation are excluded here exactly as coverageSummary excludes them.
    expect(recap().uncovered.map((item) => item.label)).toEqual(['Pull']);
    expect(notableUncovered(coverage()).map((item) => item.label)).toEqual(['Pull']);
  });

  it('names what it could not place, but only from this session', () => {
    // An older unplaced movement is not this session's business to clear up.
    const result = recap({
      coverage: coverage({
        unclassified_sets: 5,
        unclassified_exercises: [
          { exercise_name: 'bench', working_sets: 3, last_trained: TODAY },
          { exercise_name: 'sled drag', working_sets: 2, last_trained: '2026-09-09' }
        ]
      })
    });
    expect(result.unclassified_here).toEqual([{ exercise_name: 'bench', working_sets: 3 }]);
  });

  it('counts sets it could not classify rather than quietly dropping them', () => {
    const result = recap({ coverage: coverage({ unclassified_sets: 4 }) });
    expect(result.unclassified_sets).toBe(4);
    // Unclassified work means the week's read is less certain, and it says so.
    expect(result.confidence).toBe('low');
  });
});

describe('what it suggests for next time', () => {
  it('surfaces the most confident usable suggestion', () => {
    const result = recap({
      suggestions: [suggestion({ confidence: 'low' }), suggestion({ exercise_name: 'Row', confidence: 'high' })]
    });
    expect(result.next_time?.exercise_name).toBe('Row');
  });

  it('shows nothing rather than a placeholder when there is no history to stand on', () => {
    const empty = suggestion({ action: 'no_history', target_weight: null, target_reps: null, headline: 'Log a set' });
    expect(recap({ suggestions: [empty] }).next_time).toBeNull();
    expect(recap({ suggestions: [] }).next_time).toBeNull();
  });
});

describe('the meta line', () => {
  it('skips what it does not know instead of printing a zero', () => {
    expect(recapMeta(recap())).toBe('11 working sets · 2 warm-up · 47 min');
    expect(recapMeta(recap({ summary: summary({ warmup_sets: 0, duration_minutes: null }) })))
      .toBe('11 working sets');
    expect(recapMeta(recap({ summary: summary({ working_sets: 1, warmup_sets: 0, duration_minutes: null }) })))
      .toBe('1 working set');
  });

  it('leaves out a duration that rounds to nothing', () => {
    // A session logged in under a minute reads as a defect if it announces "0 min".
    expect(recapMeta(recap({ summary: summary({ warmup_sets: 0, duration_minutes: 0 }) })))
      .toBe('11 working sets');
  });
});
