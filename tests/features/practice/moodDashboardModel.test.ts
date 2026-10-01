import { describe, expect, it } from 'vitest';

import type { ReadinessCheckin } from '../../../src/features/dashboard/readinessNow';
import { lastNightMinutes, moodRings, moodScoreInput, moodWeek, todaysCheckin, todaysPulseBand } from '../../../src/features/practice/moodDashboardModel';
import { summariseDaylightDay } from '../../../src/features/practice/daylightModel';
import { summarisePracticeDay } from '../../../src/features/practice/practiceModel';
import { pulseBaseline, type PulseReading } from '../../../src/features/practice/pulseModel';
import { summariseZoneDay } from '../../../src/features/practice/zoneModel';

const today = '2026-10-01';
const at = (day: string, hour: number) => new Date(`${day}T${String(hour).padStart(2, '0')}:00:00`).toISOString();
const checkin = (day: string, hour: number, overrides: Partial<ReadinessCheckin> = {}): ReadinessCheckin => ({ id: `${day}-${hour}`, at: at(day, hour), woke_at: at(day, 7), food: 'some', water: 'some', energy: 'steady', demand: 'usual', ...overrides });
const pulse = (date: string, bpm: number, hour = 7, context: PulseReading['context'] = 'waking'): PulseReading => ({ id: `${date}-${bpm}-${hour}`, date, bpm, context, method: 'counted', takenAt: at(date, hour) });

describe('the Mood tab’s day', () => {
  it('reads last night as the longest sleep that ended today', () => {
    expect(lastNightMinutes([{ date: today, duration_minutes: 30 }, { date: today, duration_minutes: 430 }, { date: '2026-09-30', duration_minutes: 500 }], today)).toBe(430);
    expect(lastNightMinutes([{ date: '2026-09-30', duration_minutes: 500 }], today)).toBeNull();
  });

  it('uses today’s latest check-in and ignores yesterday’s', () => {
    expect(todaysCheckin([checkin(today, 8), checkin(today, 13, { demand: 'demanding', energy: 'tired' })], today)).toEqual({ demand: 'demanding', energy: 'tired' });
    expect(todaysCheckin([checkin('2026-09-30', 20)], today)).toBeNull();
  });

  it('compares today’s resting pulse with the person’s own history only', () => {
    const history = [pulse('2026-09-27', 58), pulse('2026-09-28', 60), pulse('2026-09-29', 59), pulse('2026-09-30', 61)];
    const baseline = pulseBaseline(history);
    expect(todaysPulseBand([...history, pulse(today, 75)], baseline, today)).toBe('well_above');
    expect(todaysPulseBand([...history, pulse(today, 95, 15, 'after_moving')], baseline, today)).toBeNull();
    expect(todaysPulseBand([pulse(today, 75)], null, today)).toBeNull();
  });

  it('shapes rings that fill to their guidance and never past it', () => {
    const practice = summarisePracticeDay([{ id: 'b', date: today, rhythmId: 'settle', seconds: 900, finishedAt: at(today, 9) }], today);
    const daylight = summariseDaylightDay([{ id: 'l', date: today, minutes: 4, window: 'morning', estimated: false, loggedAt: at(today, 9) }], today);
    const rings = moodRings({ practice, daylight, habits: { completedIds: [], done: 0, total: 4 }, zones: summariseZoneDay([], today) });
    expect(rings.map((ring) => [ring.id, ring.fraction])).toEqual([['breathing', 1], ['light', 0.4], ['habits', 0], ['release', 0]]);
    expect(rings[0].value).toBe('15 of 5 min');
  });

  it('hands the engine every signal it found, and nothing it did not', () => {
    const input = moodScoreInput({
      today, sleepSessions: [], sleepNeedMinutes: null, scheduleBlocks: null, checkins: [], pulses: [], baseline: null,
      practice: summarisePracticeDay([], today), daylight: summariseDaylightDay([], today), zones: summariseZoneDay([], today), habits: { completedIds: [], done: 0, total: 3 }
    });
    expect(input).toMatchObject({ sleep: null, scheduleBlocks: null, checkin: null, pulseBand: null });
    expect(input.resets).toEqual({ breathingSeconds: 0, tensionReleases: 0, morningLightMinutes: 0, habitsDone: 0 });
  });

  it('lists seven days of breathing minutes, today last', () => {
    const week = moodWeek([{ id: 'a', date: today, rhythmId: 'settle', seconds: 150, finishedAt: at(today, 9) }, { id: 'b', date: '2026-09-25', rhythmId: 'settle', seconds: 600, finishedAt: at('2026-09-25', 9) }], today);
    expect(week).toHaveLength(7);
    expect(week.at(-1)).toMatchObject({ day: today, minutes: 3, isToday: true, letter: 'T' });
    expect(week[0]).toMatchObject({ day: '2026-09-25', minutes: 10 });
  });
});
