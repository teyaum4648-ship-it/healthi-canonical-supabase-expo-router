import { describe, expect, it } from 'vitest';

import { generateCircadianBriefing } from '../../../src/engines/circadian';
import type { SleepNeedEstimate, SleepSession } from '../../../src/engines/circadian';

const sleepNeed: SleepNeedEstimate = {
  minutes: 480,
  confidence: 'high',
  basis: ['onboarding'],
  updated_at: '2026-06-10T12:00:00.000Z'
};

function session(date: string, durationMinutes: number, wakeHour = 6): SleepSession {
  return {
    date,
    sleep_start_at: `${date}T22:00:00.000Z`,
    sleep_end_at: `${date}T${String(wakeHour).padStart(2, '0')}:00:00.000Z`,
    duration_minutes: durationMinutes,
    sleep_quality: 7,
    source: 'demo',
    source_confidence: 'high',
    reason_codes: [],
    created_at: `${date}T12:00:00.000Z`
  };
}

function recentSessions(durationMinutes: number): SleepSession[] {
  return Array.from({ length: 14 }, (_, index) => {
    const day = String(10 - index).padStart(2, '0');
    return session(`2026-06-${day}`, durationMinutes);
  });
}

describe('generateCircadianBriefing', () => {
  it('uses wake time to generate deterministic energy windows', () => {
    const briefing = generateCircadianBriefing({
      date: '2026-06-10',
      timezone: 'UTC',
      recentSleepSessions: recentSessions(480),
      sleepNeed,
      preferredBedtime: '22:00',
      now: '2026-06-10T08:30:00.000Z'
    });

    expect(briefing.current_phase).toBe('morning_peak');
    expect(briefing.energy_curve[0]).toEqual({
      time: '2026-06-10T06:00:00.000Z',
      estimated_energy: 44,
      label: 'wake_grogginess'
    });
    expect(briefing.rhythm_plan.deep_work_windows[0]?.start_at).toBe('2026-06-10T08:00:00.000Z');
  });

  it('reduces estimated energy amplitude when sleep debt is high', () => {
    const rested = generateCircadianBriefing({
      date: '2026-06-10',
      timezone: 'UTC',
      recentSleepSessions: recentSessions(480),
      sleepNeed,
      preferredBedtime: '22:00'
    });
    const highDebt = generateCircadianBriefing({
      date: '2026-06-10',
      timezone: 'UTC',
      recentSleepSessions: recentSessions(240),
      sleepNeed,
      preferredBedtime: '22:00'
    });

    const restedPeak = Math.max(...rested.energy_curve.map((point) => point.estimated_energy));
    const highDebtPeak = Math.max(...highDebt.energy_curve.map((point) => point.estimated_energy));

    expect(highDebtPeak).toBeLessThan(restedPeak);
    expect(highDebt.sleep_debt_7_day.reason_codes).toContain('sleep_debt_high');
  });

  it('sets caffeine cutoff eight hours before target bedtime', () => {
    const briefing = generateCircadianBriefing({
      date: '2026-06-10',
      timezone: 'UTC',
      recentSleepSessions: recentSessions(480),
      sleepNeed,
      preferredBedtime: '22:00'
    });

    expect(briefing.rhythm_plan.caffeine_cutoff).toBe('2026-06-10T14:00:00.000Z');
  });

  it('sets wind-down start ninety minutes before target bedtime', () => {
    const briefing = generateCircadianBriefing({
      date: '2026-06-10',
      timezone: 'UTC',
      recentSleepSessions: recentSessions(480),
      sleepNeed,
      preferredBedtime: '22:00'
    });

    expect(briefing.rhythm_plan.wind_down_start).toBe('2026-06-10T20:30:00.000Z');
  });

  it('returns unknown phase and low confidence when wake time is missing', () => {
    const briefing = generateCircadianBriefing({
      date: '2026-06-10',
      timezone: 'UTC',
      recentSleepSessions: [
        {
          ...session('2026-06-10', 420),
          sleep_end_at: null
        }
      ],
      sleepNeed,
      preferredBedtime: '22:00'
    });

    expect(briefing.current_phase).toBe('unknown');
    expect(briefing.confidence).toBe('low');
    expect(briefing.energy_curve).toEqual([]);
    expect(briefing.reason_codes).toContain('sleep_data_missing');
  });

  it('includes day organization windows when debt is high', () => {
    const briefing = generateCircadianBriefing({
      date: '2026-06-10',
      timezone: 'UTC',
      recentSleepSessions: recentSessions(240),
      sleepNeed,
      preferredBedtime: '22:00'
    });

    expect(briefing.rhythm_plan.deep_work_windows.length).toBeGreaterThan(0);
    expect(briefing.rhythm_plan.best_exercise_windows.length).toBeGreaterThan(0);
    expect(briefing.rhythm_plan.best_walk_windows.length).toBeGreaterThan(0);
    expect(briefing.rhythm_plan.breathing_windows.length).toBeGreaterThan(0);
    expect(briefing.rhythm_plan.nap_windows.length).toBeGreaterThan(0);
  });

  it('keeps briefing output serializable', () => {
    const briefing = generateCircadianBriefing({
      date: '2026-06-10',
      timezone: 'UTC',
      recentSleepSessions: recentSessions(480),
      sleepNeed,
      preferredBedtime: '22:00'
    });

    expect(() => JSON.stringify(briefing)).not.toThrow();
    expect(JSON.parse(JSON.stringify(briefing))).toEqual(briefing);
  });

  it('preserves source and confidence', () => {
    const briefing = generateCircadianBriefing({
      date: '2026-06-10',
      timezone: 'UTC',
      recentSleepSessions: [
        {
          ...session('2026-06-10', 480),
          source: 'user_corrected',
          source_confidence: 'high',
          corrected_by_user: true
        }
      ],
      sleepNeed,
      preferredBedtime: '22:00'
    });

    expect(briefing.source_summary).toEqual({
      sleep_source: 'user_corrected',
      source_confidence: 'high'
    });
    expect(briefing.reason_codes).toContain('user_corrected_sleep');
  });

  it('does not introduce blocked language in generated output', () => {
    const briefing = generateCircadianBriefing({
      date: '2026-06-10',
      timezone: 'UTC',
      recentSleepSessions: recentSessions(240),
      sleepNeed,
      preferredBedtime: '22:00'
    });
    const blockedTerms = [
      'diag' + 'nosis',
      'diag' + 'nose',
      'treat' + 'ment',
      'c' + 'ure',
      'pre' + 'scribe',
      'pre' + 'scription',
      'ad' + 'renal',
      'h' + 'pa',
      'cor' + 'tisol',
      'hor' + 'mone',
      'clin' + 'ical',
      'medical ' + 'decision',
      'dys' + 'regulated',
      'dys' + 'function',
      'de' + 'tox'
    ];
    const output = JSON.stringify(briefing).toLowerCase();

    for (const term of blockedTerms) {
      expect(output).not.toContain(term);
    }
  });
});

