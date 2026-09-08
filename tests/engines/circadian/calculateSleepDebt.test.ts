import { describe, expect, it } from 'vitest';

import { calculateSleepDebt } from '../../../src/engines/circadian';
import type { SleepNeedEstimate, SleepSession } from '../../../src/engines/circadian';

const sleepNeed: SleepNeedEstimate = {
  minutes: 480,
  confidence: 'high',
  basis: ['onboarding'],
  updated_at: '2026-06-10T12:00:00.000Z'
};

function session(date: string, durationMinutes: number | null, sourceConfidence: SleepSession['source_confidence'] = 'high'): SleepSession {
  return {
    date,
    sleep_start_at: null,
    sleep_end_at: null,
    duration_minutes: durationMinutes,
    source: 'demo',
    source_confidence: sourceConfidence,
    reason_codes: [],
    created_at: `${date}T12:00:00.000Z`
  };
}

function datedSessions(count: number): SleepSession[] {
  return Array.from({ length: count }, (_, index) => {
    const day = String(14 - index).padStart(2, '0');
    return session(`2026-06-${day}`, 420);
  });
}

describe('calculateSleepDebt', () => {
  it('uses a rolling 14-night window', () => {
    const result = calculateSleepDebt({
      date: '2026-06-14',
      sessions: [...datedSessions(16), session('2026-05-20', 120)],
      sleepNeed,
      rollingWindowDays: 14
    });

    expect(result.nights).toHaveLength(14);
    expect(result.nights[0]?.date).toBe('2026-06-14');
    expect(result.nights.at(-1)?.date).toBe('2026-06-01');
  });

  it('uses a rolling 7-night window', () => {
    const result = calculateSleepDebt({
      date: '2026-06-14',
      sessions: datedSessions(14),
      sleepNeed,
      rollingWindowDays: 7
    });

    expect(result.nights).toHaveLength(7);
    expect(result.nights[0]?.date).toBe('2026-06-14');
    expect(result.nights.at(-1)?.date).toBe('2026-06-08');
  });

  it('weights recent nights higher than older nights', () => {
    const result = calculateSleepDebt({
      date: '2026-06-14',
      sessions: datedSessions(7),
      sleepNeed,
      rollingWindowDays: 7
    });

    expect(result.nights[0]?.weight).toBeGreaterThan(result.nights.at(-1)?.weight ?? 0);
  });

  it('credits repayment and never returns debt below zero', () => {
    const result = calculateSleepDebt({
      date: '2026-06-14',
      sessions: [session('2026-06-14', 600), session('2026-06-13', 600), session('2026-06-12', 600)],
      sleepNeed,
      rollingWindowDays: 7
    });

    expect(result.total_sleep_debt_minutes).toBe(0);
    expect(result.weighted_sleep_debt_minutes).toBe(0);
  });

  it('lowers confidence when fewer than three usable nights exist', () => {
    const result = calculateSleepDebt({
      date: '2026-06-14',
      sessions: [session('2026-06-14', 420), session('2026-06-13', null)],
      sleepNeed,
      rollingWindowDays: 7
    });

    expect(result.confidence).toBe('low');
    expect(result.reason_codes).toContain('calibrating');
  });

  it('returns low confidence and missing-data reason codes with no usable nights', () => {
    const result = calculateSleepDebt({
      date: '2026-06-14',
      sessions: [session('2026-06-14', null)],
      sleepNeed,
      rollingWindowDays: 7
    });

    expect(result.confidence).toBe('low');
    expect(result.total_sleep_debt_minutes).toBeNull();
    expect(result.reason_codes).toEqual(expect.arrayContaining(['sleep_data_missing']));
  });

  it('tracks low source confidence as a reason code', () => {
    const result = calculateSleepDebt({
      date: '2026-06-14',
      sessions: [session('2026-06-14', 420, 'low'), session('2026-06-13', 420), session('2026-06-12', 420)],
      sleepNeed,
      rollingWindowDays: 7
    });

    expect(result.reason_codes).toContain('source_confidence_low');
  });
});

