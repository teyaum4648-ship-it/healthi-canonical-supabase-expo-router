import { describe, expect, it } from 'vitest';

import { generateCircadianBriefing, type SleepNeedEstimate, type SleepSession } from '../../../src/engines/circadian';
import { energyCardModel, hoursAndMinutes, readinessSeries, readinessTrend, readinessWeek } from '../../../src/features/dashboard/todayModel';
import type { ReadinessHistoryEntry } from '../../../src/features/trends/readinessHistoryStore';

const entry = (date: string, score: number): ReadinessHistoryEntry => ({ date, score, label: 'steady', confidence: 'medium', recordedAt: `${date}T08:00:00Z` });

describe('readinessWeek', () => {
  it('gives seven days ending today, with empty rings for days not recorded', () => {
    const week = readinessWeek([entry('2026-11-12', 80)], '2026-11-14', 70);
    expect(week).toHaveLength(7);
    expect(week[6]).toMatchObject({ date: '2026-11-14', today: true, fraction: 0.7 });
    expect(week.find((day) => day.date === '2026-11-12')!.fraction).toBe(0.8);
    expect(week.find((day) => day.date === '2026-11-13')!.fraction).toBeNull();
  });

  it('uses the number on screen for today, not a stored one', () => {
    const week = readinessWeek([entry('2026-11-14', 50)], '2026-11-14', 77);
    expect(week[6]!.fraction).toBe(0.77);
  });
});

describe('readinessTrend', () => {
  const history = ['2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13'].map((date) => entry(date, 73));

  it('compares today with the average of earlier days', () => {
    expect(readinessTrend(77, history, '2026-11-14')).toMatchObject({ text: '4 above your 14-day baseline', direction: 'up', baseline: 73 });
    expect(readinessTrend(70, history, '2026-11-14')).toMatchObject({ direction: 'down', text: '3 below your 14-day baseline' });
  });

  it('leaves today out of its own baseline', () => {
    expect(readinessTrend(90, [...history, entry('2026-11-14', 90)], '2026-11-14')!.baseline).toBe(73);
  });

  it('shows nothing until there are enough days, and nothing without a score', () => {
    expect(readinessTrend(77, history.slice(0, 2), '2026-11-14')).toBeNull();
    expect(readinessTrend(null, history, '2026-11-14')).toBeNull();
  });
});

describe('readinessSeries', () => {
  it('fills days not recorded with null rather than a number', () => {
    const series = readinessSeries([entry('2026-11-12', 60)], '2026-11-14', 77, 7);
    expect(series.map((day) => day.score)).toEqual([null, null, null, null, 60, null, 77]);
  });
});

describe('energyCardModel', () => {
  const need: SleepNeedEstimate = { minutes: 480, confidence: 'high', basis: ['onboarding'], updated_at: '2026-09-01T00:00:00.000Z' };
  const sessions = Array.from({ length: 7 }, (_, index) => {
    const day = String(index + 6).padStart(2, '0');
    return {
      date: `2026-09-${day}`,
      sleep_start_at: `2026-09-${String(index + 5).padStart(2, '0')}T23:00:00`,
      sleep_end_at: `2026-09-${day}T07:00:00`,
      duration_minutes: null,
      sleep_quality: 4,
      source: 'manual',
      source_confidence: 'high'
    } as SleepSession;
  });
  const briefing = generateCircadianBriefing({ date: '2026-09-12', timezone: 'UTC', recentSleepSessions: sessions, sleepNeed: need, now: '2026-09-12T09:00:00' });

  it('names the next turn in the curve and how far off it is', () => {
    const model = energyCardModel(briefing, '2026-09-12T09:00:00', 'Morning rise')!;
    expect(model).not.toBeNull();
    expect(model.title).toMatch(/^(Dip|Peak) expected around \d/);
    expect(model.subtitle).toMatch(/^Morning rise now\. Next shift in /);
    expect(model.points.length).toBeGreaterThan(5);
    expect(Math.max(...model.points)).toBeLessThanOrEqual(1);
  });

  it('has nothing to draw without a curve', () => {
    const empty = generateCircadianBriefing({ date: '2026-09-12', timezone: 'UTC', recentSleepSessions: [], sleepNeed: need, now: '2026-09-12T09:00:00' });
    if (empty.energy_curve.length < 2) expect(energyCardModel(empty, '2026-09-12T09:00:00', 'Waking')).toBeNull();
  });

  it('keeps to estimative language', () => {
    const model = energyCardModel(briefing, '2026-09-12T09:00:00', 'Morning rise')!;
    expect(`${model.title} ${model.subtitle}`).not.toMatch(/diagnos|treat|cure|prescrib|clinical|guarantee|cortisol/i);
  });
});

describe('hoursAndMinutes', () => {
  it('formats minutes as hours and minutes, or a dash', () => {
    expect(hoursAndMinutes(430).value).toBe('7h 10m');
    expect(hoursAndMinutes(null).value).toBe('—');
  });
});
