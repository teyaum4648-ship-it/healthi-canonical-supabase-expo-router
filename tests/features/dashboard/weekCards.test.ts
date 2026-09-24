import { describe, expect, it } from 'vitest';

import type { SleepSession } from '../../../src/engines/circadian';
import type { NutritionTargets } from '../../../src/engines/nutrition';
import {
  dietOnTarget,
  dietWeekCard,
  isRecapDay,
  lastSevenDays,
  recapWeekKey,
  weeklyRecap,
  moodWeekCard,
  moveWeekCard,
  sleepWeekCard,
  type WeekCard
} from '../../../src/features/dashboard/weekCards';
import type { DaylightBout } from '../../../src/features/practice/daylightModel';
import type { PracticeSession } from '../../../src/features/practice/practiceModel';

const today = '2026-09-24';
const days = lastSevenDays(today);

function night(date: string, minutes: number, wake = '07:00'): SleepSession {
  const end = `${date}T${wake}:00.000Z`;
  return {
    date,
    sleep_start_at: new Date(Date.parse(end) - minutes * 60000).toISOString(),
    sleep_end_at: end,
    duration_minutes: minutes,
    source: 'manual',
    source_confidence: 'medium',
    reason_codes: [],
    created_at: end
  };
}

/* Midday local time, so the meal stays on its day in any timezone the tests run in. */
const meal = (date: string, calories: number | null, protein: number | null, carbs: number | null, fat: number | null) => ({
  logged_at: new Date(`${date}T12:00:00`).toISOString(), calories, protein_g: protein, carbs_g: carbs, fat_g: fat
});

const targets: NutritionTargets = { calories_target: 2000, protein_g_target: 120, carbs_g_target: 220, fat_g_target: 70, confidence: 'medium', basis: ['onboarding'] };

function allText(card: WeekCard): string {
  return [card.front.value, card.front.label, card.front.caption, card.back.headline, card.back.detail, card.back.actionLabel].join(' ');
}

describe('lastSevenDays', () => {
  it('ends on today and reads oldest first', () => {
    expect(days).toEqual(['2026-09-18', '2026-09-19', '2026-09-20', '2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24']);
  });
});

describe('sleepWeekCard', () => {
  it('shows average sleep and debt on the front, and leaves unlogged nights as gaps', () => {
    const card = sleepWeekCard({ today, sessions: [night(days[4]!, 420), night(days[5]!, 480), night(days[6]!, 450)], needMinutes: 480, debtMinutes: 90, targetBedtime: null });
    expect(card.front.value).toBe('7h 30m');
    expect(card.front.label).toBe('avg sleep · 3 of 7 nights');
    expect(card.front.caption).toBe('Sleep debt 1h 30m');
    expect(card.front.bars.map((bar) => bar.fraction === null)).toEqual([true, true, true, true, false, false, false]);
  });

  it('asks for last night before anything else once there is a week to average', () => {
    const card = sleepWeekCard({ today, sessions: [night(days[4]!, 300), night(days[5]!, 300)], needMinutes: 480, debtMinutes: 360, targetBedtime: null });
    expect(card.back).toMatchObject({ headline: 'Add last night', quickEntry: 'sleep' });
  });

  it('points at sleep debt when last night is in and the week runs short', () => {
    const card = sleepWeekCard({ today, sessions: [night(days[5]!, 360), night(days[6]!, 390)], needMinutes: 480, debtMinutes: 210, targetBedtime: '2026-09-24T22:15:00.000Z' });
    expect(card.back.headline).toBe('Ease the sleep debt');
    expect(card.back.detail).toContain('Try bed around 10:15 PM');
    expect(card.back.route).toBe('/rhythm');
  });

  it('points at a moving wake time when debt is small', () => {
    const sessions = [night(days[4]!, 480, '06:00'), night(days[5]!, 480, '08:30'), night(days[6]!, 480, '07:00')];
    const card = sleepWeekCard({ today, sessions, needMinutes: 480, debtMinutes: 0, targetBedtime: null });
    expect(card.front.caption).toBe('No sleep debt');
    expect(card.back.headline).toBe('Steady your wake time');
    expect(card.back.detail).toContain('2h 30m');
  });

  it('does not invent an average or a debt from nothing', () => {
    const card = sleepWeekCard({ today, sessions: [], needMinutes: 480, debtMinutes: 480, targetBedtime: null });
    expect(card.front.value).toBe('—');
    expect(card.front.caption).toBe('No nights logged yet');
    expect(card.back.headline).toBe('Log a night');
  });
});

describe('dietWeekCard', () => {
  it('counts the finished days calories and every targeted macro landed', () => {
    const meals = [
      meal(days[3]!, 1980, 125, 215, 72),
      meal(days[4]!, 2050, 90, 230, 68),
      meal(days[5]!, 1600, 80, 200, 50)
    ];
    const card = dietWeekCard({ today, meals, targets });
    expect(card.front.value).toBe('1 of 3');
    expect(card.front.label).toBe('days calories + macros hit');
    expect(card.front.caption).toBe('3 days logged this week');
    expect(card.front.bars.map((bar) => bar.strong)).toEqual([false, false, false, true, false, false, false]);
  });

  it('shows today filling in without judging it before it is over', () => {
    const card = dietWeekCard({ today, meals: [meal(days[5]!, 2000, 120, 220, 70), meal(days[6]!, 600, 30, 80, 20)], targets });
    expect(card.front.value).toBe('1 of 1');
    expect(card.front.caption).toBe('2 days logged this week');
    expect(card.front.bars[6]).toMatchObject({ strong: false });
    expect(card.front.bars[6]?.fraction).toBeGreaterThan(0);
    expect(card.back.headline).toBe('Every logged day landed');
  });

  it('waits for tonight when today is the only day logged', () => {
    const card = dietWeekCard({ today, meals: [meal(days[6]!, 600, 30, 80, 20)], targets });
    expect(card.front.value).toBe('—');
    expect(card.back).toMatchObject({ headline: 'Today counts tonight', quickEntry: 'food' });
  });

  it('flips to the metric missed most often, with its direction and average', () => {
    const meals = [meal(days[3]!, 2000, 70, 220, 70), meal(days[4]!, 2000, 80, 220, 70), meal(days[6]!, 1700, 60, 220, 70)];
    const card = dietWeekCard({ today, meals, targets });
    expect(card.back.headline).toBe('Protein');
    expect(card.back.detail).toBe('Under on 2 of 2 logged days · averaging 75 of 120 g.');
  });

  it('does not count protein above target as a miss', () => {
    expect(dietOnTarget('protein', 180, 120)).toBe(true);
    expect(dietOnTarget('protein', 100, 120)).toBe(false);
    expect(dietOnTarget('calories', 2250, 2000)).toBe(false);
    expect(dietOnTarget('fat', 78, 70)).toBe(true);
  });

  it('treats a meal without amounts as logged but not measured', () => {
    const card = dietWeekCard({ today, meals: [meal(days[5]!, null, null, null, null)], targets });
    expect(card.front.value).toBe('—');
    expect(card.front.caption).toBe('1 day logged this week');
    expect(card.back.headline).toBe('Add amounts');
  });

  it('asks for goals rather than scoring against a target that does not exist', () => {
    const card = dietWeekCard({ today, meals: [meal(days[6]!, 1800, 100, 200, 60)], targets: { confidence: 'low', basis: [], calories_target: null, protein_g_target: null } });
    expect(card.front.value).toBe('1 of 7');
    expect(card.front.label).toBe('days logged');
    expect(card.back.headline).toBe('Set your goals');
    expect(card.front.label).not.toMatch(/hit/i);
    expect(card.front.bars.every((bar) => !bar.strong)).toBe(true);
  });

  it('ignores meals from before the week', () => {
    const card = dietWeekCard({ today, meals: [meal('2026-09-10', 2000, 120, 220, 70)], targets });
    expect(card.front.caption).toBe('Nothing logged this week');
    expect(card.back).toMatchObject({ headline: 'Log a meal', quickEntry: 'food' });
  });
});

describe('moveWeekCard', () => {
  const session = (date: string, workout_type: 'strength' | 'cardio' | 'mobility', duration_minutes: number) => ({ session_date: date, workout_type, duration_minutes });

  it('counts sessions against the weekly target and totals minutes', () => {
    const card = moveWeekCard({ today, sessions: [session(days[1]!, 'cardio', 30), session(days[3]!, 'strength', 40)] });
    expect(card.front.value).toBe('2 of 4');
    expect(card.front.caption).toBe('70 min in total');
    expect(card.front.bars.filter((bar) => bar.fraction !== null)).toHaveLength(2);
  });

  it('names the missing kind of session before asking for more of them', () => {
    expect(moveWeekCard({ today, sessions: [session(days[2]!, 'cardio', 30)] }).back.headline).toBe('Add strength');
    expect(moveWeekCard({ today, sessions: [session(days[2]!, 'strength', 30)] }).back.headline).toBe('Add mobility');
    expect(moveWeekCard({ today, sessions: [session(days[2]!, 'strength', 30), session(days[4]!, 'mobility', 15)] }).back.headline).toBe('2 more sessions');
  });

  it('starts from an empty week without calling it a failure', () => {
    const card = moveWeekCard({ today, sessions: [session('2026-09-01', 'strength', 30)] });
    expect(card.front.value).toBe('0 of 4');
    expect(card.back).toMatchObject({ headline: 'Start the week', quickEntry: 'workout' });
  });
});

describe('moodWeekCard', () => {
  const reset = (date: string, seconds: number): PracticeSession => ({ id: `${date}-${seconds}`, date, rhythmId: 'settle', seconds, finishedAt: `${date}T09:00:00.000Z` });
  const light = (date: string, window: DaylightBout['window']): DaylightBout => ({ id: `${date}-${window}`, date, minutes: 15, window, estimated: false, loggedAt: `${date}T08:00:00.000Z` });

  it('counts breathing resets and their minutes', () => {
    const card = moodWeekCard({ today, practice: [reset(days[5]!, 120), reset(days[6]!, 180)], daylight: [] });
    expect(card.front.value).toBe('2');
    expect(card.front.label).toBe('breathing resets');
    expect(card.front.caption).toBe('5 min this week');
  });

  it('turns to morning light when it is the gap, counting only light before noon', () => {
    const card = moodWeekCard({ today, practice: [reset(days[6]!, 60)], daylight: [light(days[5]!, 'early'), light(days[6]!, 'evening')] });
    expect(card.back.headline).toBe('Morning light');
    expect(card.back.detail).toContain('1 of 7 days');
  });

  it('starts small when nothing is logged', () => {
    const card = moodWeekCard({ today, practice: [], daylight: [] });
    expect(card.front.caption).toBe('None yet this week');
    expect(card.back.headline).toBe('Start with one minute');
  });
});

describe('week card language', () => {
  it('stays in wellness terms on every face', () => {
    const cards = [
      sleepWeekCard({ today, sessions: [night(days[6]!, 300)], needMinutes: 480, debtMinutes: 400, targetBedtime: null }),
      dietWeekCard({ today, meals: [meal(days[6]!, 3000, 40, 400, 120)], targets }),
      moveWeekCard({ today, sessions: [] }),
      moodWeekCard({ today, practice: [], daylight: [] })
    ];
    for (const card of cards) {
      expect(allText(card)).not.toMatch(/diagnos|treatment|cure|prescri|guarantee|fail|bad|should have/i);
      expect(card.front.bars).toHaveLength(7);
    }
  });
});

describe('weeklyRecap', () => {
  it('describes each pillar in a line and picks the first one with something to change', () => {
    const cards = [
      sleepWeekCard({ today, sessions: days.map((day) => night(day, 480)), needMinutes: 480, debtMinutes: 0, targetBedtime: null }),
      dietWeekCard({ today, meals: [], targets }),
      moveWeekCard({ today, sessions: [] }),
      moodWeekCard({ today, practice: [], daylight: [] })
    ];
    const recap = weeklyRecap(cards);
    expect(recap.lines.map((line) => line.title)).toEqual(['Sleep', 'Diet', 'Movement', 'Mood']);
    expect(recap.lines[0]?.text).toBe('8h avg sleep · 7 of 7 nights · No sleep debt');
    expect(recap.lines[1]?.text).toBe('Nothing logged this week');
    expect(recap.focus?.id).toBe('diet');
  });

  it('has no focus when every card is on track, and never mentions a streak', () => {
    const cards = [sleepWeekCard({ today, sessions: days.map((day) => night(day, 480)), needMinutes: 480, debtMinutes: 0, targetBedtime: null })];
    const recap = weeklyRecap(cards);
    expect(recap.focus).toBeNull();
    expect(JSON.stringify(recap)).not.toMatch(/streak/i);
  });

  it('shows on Sunday and Monday, and one dismissal covers both', () => {
    expect(isRecapDay(new Date('2026-09-27T12:00:00'))).toBe(true);
    expect(isRecapDay(new Date('2026-09-28T12:00:00'))).toBe(true);
    expect(isRecapDay(new Date('2026-09-24T12:00:00'))).toBe(false);
    expect(recapWeekKey('2026-09-27')).toBe(recapWeekKey('2026-09-28'));
  });
});

