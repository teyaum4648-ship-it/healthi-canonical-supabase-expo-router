import { describe, expect, it } from 'vitest';

import { generateCircadianBriefing } from '../../../src/engines/circadian';
import type { SleepNeedEstimate, SleepSession } from '../../../src/engines/circadian';

const need: SleepNeedEstimate = { minutes: 480, confidence: 'high', basis: ['onboarding'], updated_at: '2026-09-01T00:00:00.000Z' };

function day(offset: number): string {
  return new Date(Date.UTC(2026, 8, 28 + offset)).toISOString().slice(0, 10);
}

/** A night ending on `date`: asleep at `bed` the evening before, awake at `wake`. */
function night(date: string, bed = '23:00', wake = '07:00', minutes?: number): SleepSession {
  const previous = new Date(Date.parse(`${date}T00:00:00.000Z`) - 86_400_000).toISOString().slice(0, 10);
  const startDay = Number(bed.slice(0, 2)) >= 12 ? previous : date;
  const start = `${startDay}T${bed}:00.000Z`;
  const end = `${date}T${wake}:00.000Z`;
  return {
    date,
    sleep_start_at: start,
    sleep_end_at: end,
    duration_minutes: minutes ?? (Date.parse(end) - Date.parse(start)) / 60000,
    sleep_quality: null,
    source: 'manual',
    source_confidence: 'high',
    reason_codes: [],
    created_at: end
  };
}

const week = Array.from({ length: 7 }, (_, index) => night(day(-7 + index)));

function briefing(lastNight: SleepSession, overrides: Partial<Parameters<typeof generateCircadianBriefing>[0]> = {}) {
  return generateCircadianBriefing({
    date: day(0),
    timezone: 'UTC',
    recentSleepSessions: [...week, lastNight],
    sleepNeed: need,
    now: `${day(0)}T10:00:00.000Z`,
    ...overrides
  });
}

const peak = (points: { estimated_energy: number }[]) => Math.max(...points.map((point) => point.estimated_energy));
const peakTime = (points: { time: string; estimated_energy: number }[]) => points.reduce((best, point) => (point.estimated_energy > best.estimated_energy ? point : best)).time;

describe('the briefing predicts from last night when there is one', () => {
  it('carries a sleep recovery summary and reads the curve from it', () => {
    const result = briefing(night(day(0)), { morningReport: { morningRestedness: 4, sleepLatencyMinutes: 10, awakeDuringNightMinutes: 5, awakeningCount: 1 } });
    expect(result.sleep_recovery).not.toBeNull();
    expect(result.sleep_recovery!.score).toBeGreaterThan(85);
    expect(result.reason_codes).toContain('sleep_recovery_predicted');
    expect(result.input_coverage).toBeCloseTo(result.sleep_recovery!.confidence / 100, 5);
  });

  it('lets a poor night lower the whole day without moving when it peaks', () => {
    /*
     * A night that starts at 3 AM does move the peak, and should: that is the circadian
     * half responding to timing. What recovery must never do is move it on its own.
     */
    const good = briefing(night(day(0)), { morningReport: { morningRestedness: 5, sleepLatencyMinutes: 5, awakeDuringNightMinutes: 0, awakeningCount: 0 } });
    /* Same window as the good night, so the clock has no reason to move: only recovery differs. */
    const poor = briefing(night(day(0), '23:00', '07:00', 300), { morningReport: { morningRestedness: 1, sleepLatencyMinutes: 60, awakeDuringNightMinutes: 180, awakeningCount: 6 } });
    expect(poor.sleep_recovery!.score).toBeLessThan(good.sleep_recovery!.score - 30);
    expect(peak(poor.energy_curve)).toBeLessThan(peak(good.energy_curve) * 0.8);
    expect(peakTime(poor.energy_curve)).toBe(peakTime(good.energy_curve));
    expect(poor.day_outlook!.score).toBeLessThan(good.day_outlook!.score);
    expect(poor.limiter).not.toBeNull();
  });

  it('uses awake periods marked on the window ahead of a remembered total', () => {
    const marked: SleepSession = {
      ...night(day(0)),
      sleep_intervals: [
        { id: 'a', state: 'asleep', start_at: `${day(-1)}T23:00:00.000Z`, end_at: `${day(0)}T02:00:00.000Z` },
        { id: 'b', state: 'awake', start_at: `${day(0)}T02:00:00.000Z`, end_at: `${day(0)}T03:00:00.000Z` },
        { id: 'c', state: 'asleep', start_at: `${day(0)}T03:00:00.000Z`, end_at: `${day(0)}T07:00:00.000Z` }
      ]
    };
    const result = briefing(marked, { morningReport: { awakeDuringNightMinutes: 0, awakeningCount: 0, morningRestedness: 3 } });
    const fragmentation = result.sleep_recovery!.contributors.find((contributor) => contributor.id === 'fragmentation');
    expect(fragmentation!.score).toBe(60);
  });

  it('compares a morning pulse only once five earlier readings exist', () => {
    const pulses = week.map((entry) => ({ date: entry.date, bpm: 55 }));
    const elevated = briefing(night(day(0)), { morningReport: { morningRestedness: 4 }, morningPulses: [...pulses, { date: day(0), bpm: 64 }] });
    expect(elevated.sleep_recovery!.contributors.some((contributor) => contributor.id === 'heartRate')).toBe(true);
    expect(elevated.sleep_recovery!.morning_hr_deviation_percent).toBeCloseTo(16.4, 1);
    const early = briefing(night(day(0)), { morningReport: { morningRestedness: 4 }, morningPulses: [...pulses.slice(0, 3), { date: day(0), bpm: 64 }] });
    expect(early.sleep_recovery!.contributors.some((contributor) => contributor.id === 'heartRate')).toBe(false);
    expect(early.sleep_recovery!.reason_codes).toContain('morning_hr_calibrating');
  });

  it('falls back to the older path when last night is stale', () => {
    const stale = generateCircadianBriefing({ date: day(10), timezone: 'UTC', recentSleepSessions: week, sleepNeed: need, now: `${day(10)}T10:00:00.000Z` });
    expect(stale.sleep_recovery).toBeNull();
    expect(stale.energy_curve.length).toBeGreaterThan(0);
  });

  it('uses the older refreshment answer when the morning report has none', () => {
    const tired = briefing(night(day(0)), { refreshment: 2 });
    expect(tired.sleep_recovery!.contributors.find((contributor) => contributor.id === 'subjective')!.message).toBe('You reported feeling tired this morning.');
  });
});
