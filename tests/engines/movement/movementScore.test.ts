import { describe, expect, it } from 'vitest';

import {
  calculateMovementScore,
  explainMovementLimiter,
  type ProgressionTally
} from '../../../src/engines/movement/calculateMovementScore';
import { MOBILITY_TESTS, type MovementScreen } from '../../../src/engines/movement/movementScreenModel';
import type { MovementSummary } from '../../../src/engines/movement/movementTypes';

const clearScreen: MovementScreen = {
  date: '2026-08-19',
  findings: Object.fromEntries(MOBILITY_TESTS.map((test) => [test.id, 'clear' as const])),
  postureFlags: []
};

/**
 * The movement pillar.
 *
 * The app could already say what to train today and how much was trained this week, but
 * not whether movement as a whole is going anywhere. Those are different questions: four
 * easy sessions a week reads as "ready to build" every morning while nothing gets
 * stronger, and progression is the only term that tells them apart.
 *
 * The other thing tested here is the part that makes the score worth showing — when
 * progression stalls, the explanation is allowed to look at sleep and food, because that
 * is usually where the cause is. It explains; it never scores.
 */

const DATE = '2026-08-19';

function summary(overrides: Partial<MovementSummary> = {}): MovementSummary {
  return {
    date: DATE,
    window_start: '2026-08-12',
    workout_count: 4,
    total_minutes: 180,
    strength_session_count: 2,
    cardio_session_count: 1,
    mobility_recovery_session_count: 1,
    estimated_training_load: 40,
    recent_high_effort_count: 1,
    exercise_entry_count: 18,
    consistency: 'steady',
    confidence: 'high',
    reason_codes: [],
    ...overrides
  };
}

const tally = (over: Partial<ProgressionTally> = {}): ProgressionTally =>
  ({ progressing: 4, holding: 1, regressing: 0, unknown: 0, ...over });

describe('the movement pillar', () => {
  it('scores a full, progressing week high', () => {
    // Genuinely full: five sessions covering all three disciplines, two of them mobility.
    // The default fixture logs one mobility session, which is half the term and therefore
    // a real limiter — the pillar is right to say so, so the fixture says the other thing.
    const result = calculateMovementScore({
      date: DATE,
      summary: summary({ workout_count: 5, total_minutes: 220, mobility_recovery_session_count: 2 }),
      progression: tally(),
      restDays7d: 3,
      screen: clearScreen
    });
    expect(result.score).toBeGreaterThanOrEqual(80);
    expect(result.coverage).toBe(1);
    expect(result.limiters).toEqual([]);
  });

  it('separates training from attendance', () => {
    // Same four sessions, same minutes, same variety. The only difference is that
    // nothing moved — and that has to show, or the pillar is a register of attendance.
    const progressing = calculateMovementScore({ date: DATE, summary: summary(), progression: tally(), restDays7d: 3 });
    const stalled = calculateMovementScore({
      date: DATE,
      summary: summary(),
      progression: tally({ progressing: 0, holding: 1, regressing: 4 }),
      restDays7d: 3
    });

    expect(stalled.score!).toBeLessThan(progressing.score!);
    expect(stalled.limiters.map((limiter) => limiter.id)).toContain('progression');
  });

  it('treats holding as maintenance rather than as failure', () => {
    const holding = calculateMovementScore({ date: DATE, summary: summary(), progression: tally({ progressing: 0, holding: 5 }), restDays7d: 3 });
    const regressing = calculateMovementScore({ date: DATE, summary: summary(), progression: tally({ progressing: 0, holding: 0, regressing: 5 }), restDays7d: 3 });
    expect(holding.score!).toBeGreaterThan(regressing.score!);
  });

  it('withholds progression rather than scoring a lift with no history', () => {
    const result = calculateMovementScore({
      date: DATE,
      summary: summary(),
      progression: { progressing: 0, holding: 0, regressing: 0, unknown: 6 },
      restDays7d: 3
    });
    const term = result.contributors.find((c) => c.id === 'progression')!;
    expect(term.value).toBeNull();
    expect(result.coverage).toBeLessThan(1);
    // Six unreadable lifts is missing data, and missing data does not lower a score.
    expect(result.score).toBeGreaterThan(70);
  });

  it('returns no score when nothing was logged', () => {
    const result = calculateMovementScore({
      date: DATE,
      summary: summary({ workout_count: 0, total_minutes: 0, strength_session_count: 0, cardio_session_count: 0, mobility_recovery_session_count: 0, consistency: 'calibrating', confidence: 'low' }),
      progression: null,
      restDays7d: null
    });
    expect(result.score).toBeNull();
    expect(result.reason_codes).toContain('movement_capacity_not_yet_measurable');
  });
});

describe('why a limiter is a limiter', () => {
  it('reaches into recovery when progression has stalled', () => {
    const cause = explainMovementLimiter('progression', { sleep_debt_hours: 3.4 });
    expect(cause).toContain('3 hours');
    expect(cause!.toLowerCase()).toContain('between sessions');
  });

  it('reaches into food when there is nothing to build with', () => {
    const cause = explainMovementLimiter('progression', { nourishment_score: 41 });
    expect(cause!.toLowerCase()).toContain('food');
  });

  it('blames the programme rather than the person when nothing else explains it', () => {
    const cause = explainMovementLimiter('progression', { sleep_debt_hours: 0.2, nourishment_score: 88 });
    expect(cause!.toLowerCase()).toContain('programme');
  });

  it('surfaces the cause alongside the limiter it explains', () => {
    const result = calculateMovementScore({
      date: DATE,
      summary: summary(),
      progression: tally({ progressing: 0, holding: 0, regressing: 5 }),
      restDays7d: 3,
      context: { sleep_debt_hours: 4 }
    });
    expect(result.limiter_causes.length).toBeGreaterThan(0);
    expect(result.limiter_causes.join(' ')).toContain('sleep debt');
  });

  it('explains without scoring, so another pillar cannot move this one', () => {
    // Otherwise the same bad night would be counted twice, once in recovery and again here.
    const rested = calculateMovementScore({ date: DATE, summary: summary(), progression: tally(), restDays7d: 3, context: { sleep_debt_hours: 0 } });
    const wrecked = calculateMovementScore({ date: DATE, summary: summary(), progression: tally(), restDays7d: 3, context: { sleep_debt_hours: 6, nourishment_score: 20 } });
    expect(wrecked.score).toBe(rested.score);
  });

  it('never speaks in the language of diagnosis', () => {
    const copy = [
      explainMovementLimiter('progression', { sleep_debt_hours: 4 }),
      explainMovementLimiter('progression', { nourishment_score: 30 }),
      explainMovementLimiter('recovery_balance', {}),
      explainMovementLimiter('consistency', { sleep_debt_hours: 5 })
    ].join(' ').toLowerCase();
    for (const word of ['diagnos', 'treat', 'cure', 'prescri', 'clinical', 'guaranteed', 'overtrain']) {
      expect(copy).not.toContain(word);
    }
    // And never tells anyone to push through.
    expect(copy).not.toContain('push through');
  });
});
