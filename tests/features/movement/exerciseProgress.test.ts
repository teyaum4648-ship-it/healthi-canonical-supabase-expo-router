import { describe, expect, it } from 'vitest';

import {
  buildExerciseProgress,
  exerciseKey,
  recentTopSetChange
} from '../../../src/features/movement/exerciseProgress';
import {
  buildTrainingCoverage,
  coverageSummary
} from '../../../src/features/movement/trainingCoverage';
import type {
  ExerciseLibraryItemRow,
  WorkoutExerciseEntryRow,
  WorkoutSessionRow,
  WorkoutSetEntryRow
} from '../../../src/features/movement/movementPersistence';

const USER = 'user-1';

function session(id: string, date: string): WorkoutSessionRow {
  return {
    id,
    user_id: USER,
    logged_at: `${date}T17:00:00.000Z`,
    session_date: date,
    title: 'Session',
    workout_type: 'strength',
    duration_minutes: 45,
    perceived_effort: 7,
    readiness_before: null,
    session_note: null,
    source: 'manual',
    source_confidence: 'medium',
    reason_codes: [],
    created_at: `${date}T17:00:00.000Z`,
    updated_at: `${date}T17:00:00.000Z`
  };
}

function entry(
  id: string,
  sessionId: string,
  name: string,
  overrides: Partial<WorkoutExerciseEntryRow> = {}
): WorkoutExerciseEntryRow {
  return {
    id,
    user_id: USER,
    workout_session_id: sessionId,
    exercise_library_item_id: null,
    exercise_name: name,
    category: 'strength',
    order_index: 0,
    sets: null,
    reps: null,
    weight: null,
    weight_unit: null,
    distance: null,
    duration_minutes: null,
    effort: null,
    notes: null,
    source: 'manual',
    source_confidence: 'medium',
    reason_codes: [],
    created_at: '2026-09-01T00:00:00.000Z',
    updated_at: '2026-09-01T00:00:00.000Z',
    ...overrides
  };
}

function set(
  id: string,
  entryId: string,
  sessionId: string,
  index: number,
  overrides: Partial<WorkoutSetEntryRow> = {}
): WorkoutSetEntryRow {
  return {
    id,
    user_id: USER,
    workout_session_id: sessionId,
    workout_exercise_entry_id: entryId,
    set_index: index,
    weight: 135,
    weight_unit: 'lb',
    warmup: false,
    reps: 8,
    rpe: null,
    rest_seconds: 90,
    completed_at: '2026-09-01T17:10:00.000Z',
    notes: null,
    source: 'manual',
    source_confidence: 'medium',
    reason_codes: [],
    created_at: '2026-09-01T00:00:00.000Z',
    updated_at: '2026-09-01T00:00:00.000Z',
    ...overrides
  };
}

function libraryItem(id: string, name: string, pattern: ExerciseLibraryItemRow['movement_pattern']): ExerciseLibraryItemRow {
  return {
    id,
    user_id: USER,
    name,
    category: 'strength',
    movement_pattern: pattern,
    primary_muscles: [],
    equipment: [],
    is_default: true,
    source: 'default',
    source_confidence: 'medium',
    reason_codes: [],
    created_at: '2026-09-01T00:00:00.000Z',
    updated_at: '2026-09-01T00:00:00.000Z'
  };
}

describe('exercise identity', () => {
  it('keeps variants apart and never merges them on a loose match', () => {
    const barbell = entry('e1', 's1', 'Barbell Bench Press');
    const dumbbell = entry('e2', 's1', 'Dumbbell Bench Press');
    const machine = entry('e3', 's1', 'Machine Bench Press');
    expect(new Set([exerciseKey(barbell), exerciseKey(dumbbell), exerciseKey(machine)]).size).toBe(3);
  });

  it('treats casing and punctuation as the same exercise', () => {
    expect(exerciseKey(entry('e1', 's1', 'Bench Press')))
      .toBe(exerciseKey(entry('e2', 's1', '  bench   press  ')));
  });

  it('prefers the canonical library id over the typed name', () => {
    const typed = entry('e1', 's1', 'Bench Press');
    const linked = entry('e2', 's1', 'bench press', { exercise_library_item_id: 'lib-1' });
    expect(exerciseKey(linked)).toBe('library:lib-1');
    expect(exerciseKey(typed)).not.toBe(exerciseKey(linked));
  });
});

describe('exercise progress', () => {
  const sessions = [session('s1', '2026-09-01'), session('s2', '2026-09-08')];
  const entries = [
    entry('e1', 's1', 'Bench Press', { exercise_library_item_id: 'lib-bench' }),
    entry('e2', 's2', 'Bench Press', { exercise_library_item_id: 'lib-bench' })
  ];
  const sets = [
    set('x1', 'e1', 's1', 1, { weight: 95, reps: 10, warmup: true }),
    set('x2', 'e1', 's1', 2, { weight: 135, reps: 8 }),
    set('x3', 'e1', 's1', 3, { weight: 135, reps: 7 }),
    set('x4', 'e2', 's2', 1, { weight: 140, reps: 8 }),
    set('x5', 'e2', 's2', 2, { weight: 140, reps: 6 })
  ];

  it('groups sessions, excludes warm-ups, and tracks the top set', () => {
    const [progress] = buildExerciseProgress({ sessions, entries, sets, unit: 'lb' });
    expect(progress.name).toBe('Bench Press');
    expect(progress.sessions).toHaveLength(2);
    // The 95 lb warm-up is not counted as a working set and is not the top set.
    expect(progress.sessions[0]).toMatchObject({ date: '2026-09-01', top_weight: 135, working_sets: 2 });
    expect(progress.total_working_sets).toBe(4);
    expect(progress.last_performed).toBe('2026-09-08');
  });

  it('records the heaviest working set and the best rep count', () => {
    const [progress] = buildExerciseProgress({ sessions, entries, sets, unit: 'lb' });
    expect(progress.heaviest).toMatchObject({ value: 140, date: '2026-09-08' });
    // 10 reps came from a warm-up, so the rep record is the best working set.
    expect(progress.most_reps).toMatchObject({ value: 8 });
  });

  it('computes volume from comparable sets only', () => {
    const [progress] = buildExerciseProgress({ sessions, entries, sets, unit: 'lb' });
    expect(progress.sessions[0].volume).toBe(135 * 8 + 135 * 7);
  });

  it('reports the most recent change between sessions', () => {
    const [progress] = buildExerciseProgress({ sessions, entries, sets, unit: 'lb' });
    expect(recentTopSetChange(progress)).toMatchObject({ delta: 5, from: '2026-09-01', to: '2026-09-08' });
  });

  it('converts into the requested unit rather than comparing raw numbers', () => {
    const [progress] = buildExerciseProgress({ sessions, entries, sets, unit: 'kg' });
    // 140 lb is about 63.5 kg — not 140.
    expect(progress.heaviest!.value).toBeCloseTo(63.5, 1);
  });
});

describe('weights with no unit', () => {
  const sessions = [session('s1', '2026-09-01')];
  const entries = [entry('e1', 's1', 'Bench Press')];
  const sets = [
    set('x1', 'e1', 's1', 1, { weight: 200, weight_unit: null, reps: 5 }),
    set('x2', 'e1', 's1', 2, { weight: 135, weight_unit: 'lb', reps: 8 })
  ];

  it('excludes them from load records and counts the exclusion', () => {
    const [progress] = buildExerciseProgress({ sessions, entries, sets, unit: 'lb' });
    // 200 is heavier as a bare number but its unit is unknown, so it cannot win.
    expect(progress.heaviest).toMatchObject({ value: 135 });
    expect(progress.sets_without_unit).toBe(1);
    expect(progress.sessions[0].volume).toBe(135 * 8);
  });

  it('still counts them where the unit does not matter', () => {
    const [progress] = buildExerciseProgress({ sessions, entries, sets, unit: 'lb' });
    expect(progress.total_working_sets).toBe(2);
    expect(progress.most_reps).toMatchObject({ value: 8 });
  });
});

describe('one-rep-max estimates', () => {
  const sessions = [session('s1', '2026-09-01')];
  const entries = [entry('e1', 's1', 'Bench Press')];

  it('estimates from a set the formula holds for, and says where it came from', () => {
    const sets = [set('x1', 'e1', 's1', 1, { weight: 200, reps: 5 })];
    const [progress] = buildExerciseProgress({ sessions, entries, sets, unit: 'lb' });
    // Epley: 200 * (1 + 5/30) = 233.3
    expect(progress.estimated_one_rep_max!.value).toBeCloseTo(233.3, 1);
    expect(progress.estimated_one_rep_max!.basis).toContain('200 lb × 5');
  });

  it('refuses to estimate from a high-rep set', () => {
    const sets = [set('x1', 'e1', 's1', 1, { weight: 95, reps: 25 })];
    const [progress] = buildExerciseProgress({ sessions, entries, sets, unit: 'lb' });
    expect(progress.estimated_one_rep_max).toBeNull();
  });

  it('refuses to estimate when the unit is unknown', () => {
    const sets = [set('x1', 'e1', 's1', 1, { weight: 200, weight_unit: null, reps: 5 })];
    const [progress] = buildExerciseProgress({ sessions, entries, sets, unit: 'lb' });
    expect(progress.estimated_one_rep_max).toBeNull();
  });
});

describe('training coverage', () => {
  const library = [
    libraryItem('lib-squat', 'Goblet Squat', 'squat'),
    libraryItem('lib-push', 'Push-Up', 'push'),
    libraryItem('lib-pull', 'Dumbbell Row', 'pull')
  ];
  const sessions = [session('s1', '2026-09-10'), session('s2', '2026-09-12')];
  const entries = [
    entry('e1', 's1', 'Push-Up', { exercise_library_item_id: 'lib-push' }),
    entry('e2', 's2', 'Push-Up', { exercise_library_item_id: 'lib-push' }),
    entry('e3', 's2', 'Goblet Squat', { exercise_library_item_id: 'lib-squat' })
  ];
  const sets = [
    set('x1', 'e1', 's1', 1, {}),
    set('x2', 'e1', 's1', 2, {}),
    set('x3', 'e2', 's2', 1, {}),
    set('x4', 'e3', 's2', 1, { warmup: true }),
    set('x5', 'e3', 's2', 2, {})
  ];

  it('counts working sets per pattern and names what was missing', () => {
    const coverage = buildTrainingCoverage({ sessions, entries, sets, library, today: '2026-09-12', windowDays: 7 });
    const push = coverage.patterns.find((item) => item.pattern === 'push');
    expect(push).toMatchObject({ working_sets: 3, sessions: 2, last_trained: '2026-09-12' });
    // The squat warm-up is not a working set.
    expect(coverage.patterns.find((item) => item.pattern === 'squat')?.working_sets).toBe(1);
    expect(coverage.uncovered.map((item) => item.pattern)).toContain('pull');
  });

  it('ignores sessions outside the window', () => {
    const coverage = buildTrainingCoverage({ sessions, entries, sets, library, today: '2026-09-30', windowDays: 7 });
    expect(coverage.total_working_sets).toBe(0);
    expect(coverageSummary(coverage)).toBe('No working sets logged in the last 7 days.');
  });

  it('counts an unmatched exercise rather than guessing its pattern', () => {
    const mystery = entry('e9', 's2', 'Some Custom Thing');
    const coverage = buildTrainingCoverage({
      sessions,
      entries: [...entries, mystery],
      sets: [...sets, set('x9', 'e9', 's2', 1, {})],
      library,
      today: '2026-09-12',
      windowDays: 7
    });
    expect(coverage.unclassified_sets).toBe(1);
    expect(coverage.patterns.every((item) => item.pattern !== 'other')).toBe(true);
    // Named as well as counted, so a screen can offer to learn it.
    expect(coverage.unclassified_exercises).toEqual([
      { exercise_name: 'Some Custom Thing', working_sets: 1, last_trained: '2026-09-12' }
    ]);
  });

  it('gathers one unmatched movement across the sessions it appears in', () => {
    // The same name typed twice is one thing to be told about, not two.
    const first = entry('e9', 's1', 'Some Custom Thing');
    const again = entry('e10', 's2', 'some custom thing');
    const coverage = buildTrainingCoverage({
      sessions,
      entries: [...entries, first, again],
      sets: [...sets, set('x9', 'e9', 's1', 1, {}), set('x10', 'e10', 's2', 1, {}), set('x11', 'e10', 's2', 2, {})],
      library,
      today: '2026-09-12',
      windowDays: 7
    });
    expect(coverage.unclassified_exercises).toHaveLength(1);
    expect(coverage.unclassified_exercises[0]).toMatchObject({ working_sets: 3, last_trained: '2026-09-12' });
  });

  it('describes the window without judging it', () => {
    const coverage = buildTrainingCoverage({ sessions, entries, sets, library, today: '2026-09-12', windowDays: 7 });
    const summary = coverageSummary(coverage);
    expect(summary).toContain('4 working sets');
    expect(summary).toContain('No logged work in');
    // Never a verdict about the body.
    expect(summary).not.toMatch(/weak|behind|deficit|imbalance/i);
  });
});
