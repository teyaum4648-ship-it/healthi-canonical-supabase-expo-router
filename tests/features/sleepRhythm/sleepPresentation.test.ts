import { describe, expect, it } from 'vitest';

import type { CircadianBriefing, SleepSession } from '../../../src/engines/circadian';
import {
  buildSleepPhasePresentation,
  buildSleepProtocol,
  calculateRhythmConsistency,
  DEFAULT_WIND_DOWN_STEPS,
  formatClockMinutes,
  scheduleWindDown
} from '../../../src/features/sleepRhythm/sleepPresentation';

function session(date: string, start: string, end: string): SleepSession {
  return {
    date,
    sleep_start_at: `${date}T${start}:00.000Z`,
    sleep_end_at: `${date}T${end}:00.000Z`,
    duration_minutes: 450,
    source: 'manual',
    source_confidence: 'high',
    reason_codes: ['manual_sleep_entry'],
    created_at: `${date}T12:00:00.000Z`
  };
}

function briefing(): CircadianBriefing {
  return {
    date: '2026-08-08',
    timezone: 'UTC',
    wake_time: '2026-08-08T06:30:00.000Z',
    target_bedtime: '2026-08-08T22:30:00.000Z',
    current_phase: 'morning_peak',
    energy_curve: [
      { time: '2026-08-08T09:00:00.000Z', estimated_energy: 82, label: 'morning_peak' },
      { time: '2026-08-08T12:00:00.000Z', estimated_energy: 58, label: 'rising' }
    ],
    energy_zones: [],
    energy_extrema: [],
    rhythm_plan: {
      deep_work_windows: [{ start_at: '2026-08-08T08:30:00.000Z', end_at: '2026-08-08T10:30:00.000Z', label: 'deep work' }],
      best_exercise_windows: [{ start_at: '2026-08-08T09:30:00.000Z', end_at: '2026-08-08T11:30:00.000Z', label: 'exercise' }],
      best_walk_windows: [{ start_at: '2026-08-08T07:30:00.000Z', end_at: '2026-08-08T08:00:00.000Z', label: 'walk' }],
      nap_windows: [],
      breathing_windows: [{ start_at: '2026-08-08T14:00:00.000Z', end_at: '2026-08-08T14:15:00.000Z', label: 'reset' }],
      caffeine_cutoff: '2026-08-08T14:30:00.000Z',
      wind_down_start: '2026-08-08T21:00:00.000Z',
      target_bedtime: '2026-08-08T22:30:00.000Z',
      reason_codes: []
    },
    sleep_debt_7_day: {
      date: '2026-08-08',
      rolling_window_days: 7,
      total_sleep_debt_minutes: 120,
      weighted_sleep_debt_minutes: 100,
      nightly_average_debt_minutes: 17,
      nights: [],
      confidence: 'medium',
      reason_codes: []
    },
    sleep_debt_14_day: {
      date: '2026-08-08',
      rolling_window_days: 14,
      total_sleep_debt_minutes: 180,
      weighted_sleep_debt_minutes: 140,
      nightly_average_debt_minutes: 13,
      nights: [],
      confidence: 'medium',
      reason_codes: []
    },
    confidence: 'medium',
    reason_codes: [],
    source_summary: { sleep_source: 'manual', source_confidence: 'high' }
  };
}

describe('Sleep presentation model', () => {
  it('returns an explainable consistency score with confidence and reason codes', () => {
    const sessions = Array.from({ length: 14 }, (_, index) =>
      session(`2026-07-${String(index + 10).padStart(2, '0')}`, index % 2 === 0 ? '22:40' : '22:50', index % 2 === 0 ? '06:10' : '06:20')
    );
    const result = calculateRhythmConsistency(sessions);

    expect(result.score).not.toBeNull();
    expect(result.confidence).toBe('high');
    expect(result.reason_codes).toContain('rhythm_consistency_calculated');
    expect(result.limiting_factors).toEqual([]);
  });

  it('does not lower a score when timing evidence is missing', () => {
    const result = calculateRhythmConsistency([
      { ...session('2026-08-01', '22:40', '06:10'), sleep_start_at: null },
      { ...session('2026-08-02', '22:40', '06:10'), sleep_end_at: null }
    ]);

    expect(result.score).toBeNull();
    expect(result.confidence).toBe('low');
    expect(result.reason_codes).toEqual(['rhythm_consistency_insufficient_history']);
  });

  it('derives phase copy and deterministic protocol rows from the briefing', () => {
    const source = briefing();
    const phase = buildSleepPhasePresentation(source, '2026-08-08T09:15:00.000Z');
    const protocol = buildSleepProtocol(source);

    expect(phase.label).toBe('First peak');
    expect(phase.energy).toBe('High');
    expect(protocol).toHaveLength(6);
    expect(protocol.find((item) => item.id === 'caffeine')?.point_in_time).toBe(true);
  });

  it('schedules enabled wind-down steps backward from bedtime', () => {
    const schedule = scheduleWindDown(DEFAULT_WIND_DOWN_STEPS, 22 * 60 + 30);
    const total = schedule.reduce((sum, step) => sum + step.duration_minutes, 0);

    expect(schedule[0].start_minutes).toBe(22 * 60 + 30 - total);
    expect(schedule.at(-1)?.start_minutes).toBe(22 * 60 + 30);
    expect(formatClockMinutes(schedule[0].start_minutes)).toMatch(/PM$/);
    expect(schedule.some((step) => step.id === 'stretch')).toBe(false);
  });
});
