import { describe, expect, it } from 'vitest';

import { suggestNextSession } from '../../../src/features/movement/exerciseProgression';
import type { ExerciseProgress, ExerciseSessionPoint } from '../../../src/features/movement/exerciseProgress';

const TODAY = '2026-09-20';

function point(date: string, weight: number | null, reps: number | null, sets = 3): ExerciseSessionPoint {
  return {
    session_id: `s-${date}`,
    date,
    top_weight: weight,
    top_reps: reps,
    working_sets: sets,
    volume: weight !== null && reps !== null ? weight * reps * sets : null
  };
}

function progress(sessions: ExerciseSessionPoint[], overrides: Partial<ExerciseProgress> = {}): ExerciseProgress {
  return {
    key: 'library:bench',
    name: 'Bench Press',
    library_item_id: 'bench',
    unit: 'lb',
    sessions,
    last_performed: sessions[sessions.length - 1]?.date ?? null,
    total_working_sets: sessions.reduce((n, s) => n + s.working_sets, 0),
    heaviest: null,
    most_reps: null,
    estimated_one_rep_max: null,
    sets_without_unit: 0,
    ...overrides
  };
}

const build = { capacity: 'build' as const, trainingAllowed: true, today: TODAY, unit: 'lb' as const };

describe('safety outranks progression', () => {
  const history = [point('2026-09-12', 135, 8), point('2026-09-16', 135, 9)];

  it('never suggests adding load when training is withheld', () => {
    const suggestion = suggestNextSession({ ...build, progress: progress(history), trainingAllowed: false });
    expect(suggestion.action).toBe('reduce');
    expect(suggestion.target_weight).toBe(135);
    expect(suggestion.target_sets).toBe(2);
    expect(suggestion.rationale[0]).toContain("protocol keeps training easy");
  });

  it('holds rather than builds on a restore day', () => {
    const suggestion = suggestNextSession({ ...build, progress: progress(history), capacity: 'restore' });
    expect(suggestion.action).toBe('reduce');
    expect(suggestion.target_weight).toBe(135);
  });

  it('repeats on a technique day even when reps improved', () => {
    const suggestion = suggestNextSession({ ...build, progress: progress(history), capacity: 'technique' });
    expect(suggestion.action).toBe('hold_technique');
    expect(suggestion.target_weight).toBe(135);
  });
});

describe('progression from the logged sets', () => {
  it('adds a rep before adding weight when load held', () => {
    const suggestion = suggestNextSession({
      ...build,
      progress: progress([point('2026-09-12', 135, 8), point('2026-09-16', 135, 8)])
    });
    expect(suggestion.action).toBe('add_rep');
    expect(suggestion.target_weight).toBe(135);
    expect(suggestion.target_reps).toBe(9);
    expect(suggestion.rationale.join(' ')).toContain('adds a rep before adding weight');
  });

  it('adds one increment on a push day once reps have risen', () => {
    const suggestion = suggestNextSession({
      ...build,
      capacity: 'push',
      progress: progress([point('2026-09-12', 135, 8), point('2026-09-16', 135, 10)])
    });
    expect(suggestion.action).toBe('add_load');
    // One plate-pair increment, not an invented jump.
    expect(suggestion.target_weight).toBe(140);
    expect(suggestion.headline).toBe('Try 140 lb');
  });

  it('repeats rather than builds when reps went backwards', () => {
    const suggestion = suggestNextSession({
      ...build,
      progress: progress([point('2026-09-12', 135, 9), point('2026-09-16', 135, 7)])
    });
    expect(suggestion.action).toBe('repeat');
    expect(suggestion.target_weight).toBe(135);
    expect(suggestion.rationale.join(' ')).toContain('9 to 7 reps');
  });

  it('consolidates after a load increase instead of stacking another', () => {
    const suggestion = suggestNextSession({
      ...build,
      progress: progress([point('2026-09-12', 135, 8), point('2026-09-16', 145, 8)])
    });
    expect(suggestion.action).toBe('repeat');
    expect(suggestion.target_weight).toBe(145);
  });

  it('uses kilogram increments when that is the unit', () => {
    const suggestion = suggestNextSession({
      ...build,
      capacity: 'push',
      unit: 'kg',
      progress: progress([point('2026-09-12', 60, 8), point('2026-09-16', 60, 10)], { unit: 'kg' })
    });
    expect(suggestion.target_weight).toBe(62.5);
  });
});

describe('what it refuses to claim', () => {
  it('offers nothing when there is no history', () => {
    const suggestion = suggestNextSession({ ...build, progress: progress([]) });
    expect(suggestion.action).toBe('no_history');
    expect(suggestion.target_weight).toBeNull();
    expect(suggestion.confidence).toBe('low');
  });

  it('establishes a baseline before changing anything', () => {
    const suggestion = suggestNextSession({ ...build, progress: progress([point('2026-09-16', 135, 8)]) });
    expect(suggestion.action).toBe('repeat');
    expect(suggestion.confidence).toBe('low');
    expect(suggestion.rationale.join(' ')).toContain('establish a baseline');
  });

  it('suggests only reps when the load has no unit to compare', () => {
    const suggestion = suggestNextSession({
      ...build,
      progress: progress([point('2026-09-12', null, 10), point('2026-09-16', null, 12)], { sets_without_unit: 4 })
    });
    expect(suggestion.target_weight).toBeNull();
    expect(suggestion.target_reps).toBe(12);
    expect(suggestion.rationale.join(' ')).toContain('without a unit');
  });

  it('treats a long gap as knowing less, never as poor recovery', () => {
    const suggestion = suggestNextSession({
      ...build,
      progress: progress([point('2026-07-01', 135, 8), point('2026-07-08', 135, 9)])
    });
    expect(suggestion.action).toBe('repeat');
    expect(suggestion.confidence).toBe('low');
    const reasons = suggestion.rationale.join(' ');
    expect(reasons).toContain('weeks ago');
    // A gap is missing information, not evidence about the body.
    expect(reasons).not.toMatch(/recovery|detrain|lost|weaker|fatigue/i);
  });

  it('lowers confidence when part of the record has no unit', () => {
    const suggestion = suggestNextSession({
      ...build,
      progress: progress(
        [point('2026-09-08', 135, 8), point('2026-09-12', 135, 8), point('2026-09-16', 135, 8)],
        { sets_without_unit: 2 }
      )
    });
    // Three sessions would otherwise read as high confidence.
    expect(suggestion.confidence).toBe('medium');
    expect(suggestion.rationale.join(' ')).toContain('no unit recorded');
  });

  it('always explains itself', () => {
    const cases: ExerciseProgress[] = [
      progress([]),
      progress([point('2026-09-16', 135, 8)]),
      progress([point('2026-09-12', 135, 8), point('2026-09-16', 135, 8)])
    ];
    for (const item of cases) {
      const suggestion = suggestNextSession({ ...build, progress: item });
      expect(suggestion.rationale.length).toBeGreaterThan(0);
      expect(suggestion.rationale.every((line) => line.trim().length > 0)).toBe(true);
    }
  });
});
