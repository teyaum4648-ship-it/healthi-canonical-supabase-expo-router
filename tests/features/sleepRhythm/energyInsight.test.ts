import { describe, expect, it } from 'vitest';

import { generateCircadianBriefing } from '../../../src/engines/circadian';
import type { CircadianBriefing, SleepNeedEstimate, SleepSession } from '../../../src/engines/circadian';
import { describeEnergyInsight, describeWeekPattern, formatSleepTime } from '../../../src/features/sleepRhythm/sleepPresentation';

const need: SleepNeedEstimate = { minutes: 480, confidence: 'high', basis: ['onboarding'], updated_at: '2026-09-01T00:00:00.000Z' };

function night(date: string, bedHour: number, wakeHour: number): SleepSession {
  const prev = new Date(`${date}T00:00:00`);
  prev.setDate(prev.getDate() - 1);
  const pad = (n: number) => String(n).padStart(2, '0');
  const startDay = bedHour >= 12 ? `${prev.getFullYear()}-${pad(prev.getMonth() + 1)}-${pad(prev.getDate())}` : date;
  return { date, sleep_start_at: `${startDay}T${pad(bedHour)}:00:00`, sleep_end_at: `${date}T${pad(wakeHour)}:00:00`, duration_minutes: null, sleep_quality: 4, source: 'manual', source_confidence: 'high' } as SleepSession;
}

const steady = Array.from({ length: 12 }, (_, i) => night(`2026-09-${String(i + 1).padStart(2, '0')}`, 23, 7));
const briefingFor = (sessions: SleepSession[], date: string) =>
  generateCircadianBriefing({ date, timezone: 'UTC', recentSleepSessions: sessions, sleepNeed: need, refreshment: 4, now: `${date}T11:00:00` });

describe('the energy insight under the Sleep score', () => {
  it('names the kind of day and the times to plan around, from the curve itself', () => {
    const briefing = briefingFor(steady, '2026-09-12');
    const insight = describeEnergyInsight(briefing)!;
    expect(insight.headline).toMatch(/^(Sharp|Steady|Slow|Flat) energy today/);
    const peak = [...briefing.energy_extrema].sort((a, b) => a.time.localeCompare(b.time)).find((e) => e.type === 'peak')!;
    expect(insight.detail).toContain(`Plan focused work around ${formatSleepTime(peak.time)}`);
    expect(insight.detail).toMatch(/keep .* light/);
  });

  it('carries the morning check-in through as a share of a fully rested day', () => {
    const briefing = briefingFor(steady, '2026-09-12');
    const withRecovery: CircadianBriefing = {
      ...briefing,
      sleep_recovery: { score: 84, multiplier: 0.92, confidence: 70, contributors: [], notes: [], estimated_sleep_minutes: 430, sleep_efficiency: 0.9, weighted_debt_minutes: null, morning_hr_deviation_percent: null, reason_codes: [] }
    };
    expect(describeEnergyInsight(withRecovery)!.headline).toContain('about 92% of a fully rested day');
  });

  it('says when it is still calibrating instead of sounding sure', () => {
    const insight = describeEnergyInsight(briefingFor([night('2026-09-12', 23, 7)], '2026-09-12'));
    if (insight?.calibrating) expect(insight.detail).toContain('Still calibrating');
  });

  it('says nothing when there is no curve to read', () => {
    const briefing = briefingFor(steady, '2026-09-12');
    expect(describeEnergyInsight({ ...briefing, day_outlook: null })).toBeNull();
  });

  it('stays in wellness language', () => {
    const text = JSON.stringify(describeEnergyInsight(briefingFor(steady, '2026-09-12')));
    expect(text).not.toMatch(/diagnos|treat(ment)?\b|cure|cortisol|hormone/i);
  });
});

describe('the week pattern line', () => {
  const nightAt = (bed: number | null, wake: number | null) => ({ date: '2026-09-01', bedtime_minutes: bed, wake_minutes: wake, duration_minutes: null, source_confidence: 'high' as const });

  it('waits for enough nights', () => {
    expect(describeWeekPattern([nightAt(1380, 420), nightAt(1390, 425)])).toMatch(/few more nights/);
  });

  it('says the night was steady when it was', () => {
    expect(describeWeekPattern([nightAt(1380, 420), nightAt(1400, 425), nightAt(1390, 430)])).toBe('Bedtime and wake time held steady this week.');
  });

  it('points at bedtime when bedtime is what moved', () => {
    expect(describeWeekPattern([nightAt(1350, 420), nightAt(1500, 425), nightAt(1390, 430)])).toMatch(/^Bedtime moved across 2h 30m/);
  });

  it('points at wake time when wake time is what moved', () => {
    expect(describeWeekPattern([nightAt(1380, 360), nightAt(1390, 520), nightAt(1385, 430)])).toMatch(/^Wake time moved/);
  });
});
