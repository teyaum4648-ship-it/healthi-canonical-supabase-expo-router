import { describe, expect, it } from 'vitest';

import type { SleepSession } from '../../../src/engines/circadian';
import { formatHoursMinutes, readinessHeadline, readinessZone, sleepGlance } from '../../../src/features/dashboard/dashboardZones';

const today = '2026-09-26';

function night(date: string, minutes: number | null): SleepSession {
  return {
    date,
    sleep_start_at: null,
    sleep_end_at: null,
    duration_minutes: minutes,
    source: 'manual',
    source_confidence: 'high',
    reason_codes: [],
    created_at: `${date}T08:00:00.000Z`
  };
}

describe('readinessZone', () => {
  it('bands the estimate, with the day-one baseline of 70 in the middle band', () => {
    expect(readinessZone(82, false)).toBe('optimal');
    expect(readinessZone(75, false)).toBe('optimal');
    expect(readinessZone(70, false)).toBe('warning');
    expect(readinessZone(55, false)).toBe('warning');
    expect(readinessZone(48, false)).toBe('critical');
  });

  it('shows no zone without a number or while safety guidance is active', () => {
    expect(readinessZone(null, false)).toBe('neutral');
    expect(readinessZone(90, true)).toBe('neutral');
  });
});

describe('readinessHeadline', () => {
  it('uses the engine’s own sentence when there is no zone', () => {
    expect(readinessHeadline('neutral', 'Building your picture.')).toEqual({ word: 'No estimate', insight: 'Building your picture.' });
  });

  it('gives each zone calm, non-clinical guidance', () => {
    for (const zone of ['optimal', 'warning', 'critical'] as const) {
      const { insight } = readinessHeadline(zone, '');
      expect(insight.length).toBeGreaterThan(20);
      expect(insight).not.toMatch(/pain|diagnos|clinical|guarantee|limits/i);
    }
  });
});

describe('sleepGlance', () => {
  it('compares last night — the night dated today — with the need', () => {
    const glance = sleepGlance({ sessions: [night('2026-09-24', 400), night('2026-09-25', 420), night(today, 460)], today, needMinutes: 480 });
    expect(glance.lastNight).toEqual({ minutes: 460, date: today });
    expect(glance.fraction).toBeCloseTo(0.958, 2);
    expect(glance.zone).toBe('optimal');
    expect(glance.label).toBe('Met your need');
    expect(glance.averageMinutes).toBe(427);
    expect(glance.nightsLogged).toBe(3);
    expect(glance.confidence).toBe('medium');
  });

  it('bands a short night as warning, then critical', () => {
    expect(sleepGlance({ sessions: [night(today, 400)], today, needMinutes: 480 }).zone).toBe('warning');
    expect(sleepGlance({ sessions: [night(today, 330)], today, needMinutes: 480 }).zone).toBe('critical');
  });

  it('shows a missing night as missing, not as zero hours', () => {
    const glance = sleepGlance({ sessions: [night('2026-09-25', 420)], today, needMinutes: 480 });
    expect(glance.lastNight).toBeNull();
    expect(glance.zone).toBe('neutral');
    expect(glance.label).toBe('Not logged');
    expect(glance.series.at(-1)).toEqual({ date: today, minutes: null });
    expect(glance.reason_codes).toEqual(['sleep_last_night_missing']);
  });
});

describe('formatHoursMinutes', () => {
  it('pads minutes and drops empty hours', () => {
    expect(formatHoursMinutes(425)).toBe('7h 05m');
    expect(formatHoursMinutes(45)).toBe('45m');
  });
});
