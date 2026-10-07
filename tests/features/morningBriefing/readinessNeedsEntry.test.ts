import { describe, expect, it } from 'vitest';

import { generateCircadianBriefing } from '../../../src/engines/circadian';
import type { SleepSession } from '../../../src/engines/circadian/types';
import { generateDayPlan } from '../../../src/engines/dayPlan';
import { calculateMovementSummary, generateMovementReadinessSignal } from '../../../src/engines/movement';
import { composeDashboardNutritionSummary } from '../../../src/features/dashboard/dashboardComposer';
import { evaluateReadinessNow } from '../../../src/features/dashboard/readinessNow';
import { composeMorningBriefing, morningBriefingToDashboardHero } from '../../../src/features/morningBriefing';
import { createDefaultSleepNeedEstimate } from '../../../src/features/sleepRhythm/rhythmInputs';

/*
 * The readiness number has to come from something the person entered. These build the morning
 * briefing the way Home does for an account, where every lookup succeeds but may return nothing,
 * and check that defaults (a clock-based rhythm, a generated day plan, an old sleep log) never
 * produce a score on their own.
 */
const date = '2026-07-14';

function sleepSession(day: string, minutes: number): SleepSession {
  const end = `${day}T07:00:00.000Z`;
  return {
    id: `sleep-${day}`,
    date: day,
    sleep_start_at: new Date(Date.parse(end) - minutes * 60_000).toISOString(),
    sleep_end_at: end,
    duration_minutes: minutes,
    source: 'manual',
    source_confidence: 'medium',
    reason_codes: [],
    created_at: end
  };
}

function briefing({ sleep = [] as SleepSession[], meals = 0, workouts = 0, blocks = 0 } = {}) {
  const rhythm = generateCircadianBriefing({
    date,
    timezone: 'UTC',
    recentSleepSessions: sleep,
    sleepNeed: createDefaultSleepNeedEstimate(`${date}T12:00:00.000Z`),
    now: `${date}T09:00:00.000Z`
  });
  const nutrition = composeDashboardNutritionSummary({
    date,
    meals: Array.from({ length: meals }, (_, i) => ({
      id: `meal-${i}`,
      logged_at: `${date}T0${8 + i}:00:00.000Z`,
      meal_type: 'breakfast' as const,
      name: 'Breakfast bowl',
      source: 'manual' as const,
      source_confidence: 'medium' as const,
      calories: 520,
      protein_g: 32,
      carbs_g: 55,
      fat_g: 18,
      fiber_g: 9,
      sugar_g: 8,
      sodium_mg: 420,
      ingredients: null,
      quality_flags: ['balanced_meal'],
      user_response: null,
      reason_codes: [],
      created_at: `${date}T08:00:00.000Z`
    })),
    demoMode: false
  });
  const movementSummary = calculateMovementSummary({
    date,
    sessions: Array.from({ length: workouts }, (_, i) => ({
      id: `session-${i}`,
      session_date: '2026-07-13',
      logged_at: '2026-07-13T17:00:00.000Z',
      title: 'Steady strength',
      workout_type: 'strength',
      duration_minutes: 45,
      perceived_effort: 6,
      source_confidence: 'medium' as const,
      reason_codes: []
    }))
  });
  const dayPlan = generateDayPlan({
    date,
    wake_time: rhythm.wake_time ?? undefined,
    target_bedtime: rhythm.target_bedtime ?? undefined,
    schedule_blocks: Array.from({ length: blocks }, (_, i) => ({
      id: `work-${i}`,
      type: 'work' as const,
      label: 'Work',
      start: `${date}T${String(9 + i * 2).padStart(2, '0')}:00:00.000Z`,
      end: `${date}T${String(10 + i * 2).padStart(2, '0')}:00:00.000Z`,
      flexibility: 'fixed' as const,
      source: 'user_entered' as const,
      confidence: 'medium' as const,
      reason_codes: []
    }))
  });
  return composeMorningBriefing({
    date,
    rhythm: { briefing: rhythm, recent_sleep_session: sleep[0] ?? null },
    nutrition,
    movement: { summary: movementSummary, signal: generateMovementReadinessSignal({ summary: movementSummary }) },
    schedule: { block_count: blocks, day_plan: dayPlan },
    // Home reports a lookup that succeeded as logged, even when it found nothing.
    sources: { rhythm: 'logged', nutrition: 'logged', movement: 'logged', schedule: 'logged' }
  });
}

describe('readiness needs at least one real entry', () => {
  it('shows no number when nothing has been logged', () => {
    const result = briefing();
    expect(result.readiness.label).toBe('calibrating');
    expect(result.readiness.missing_data).toHaveLength(4);
    expect(result.readiness.reason_codes).toContain('readiness_needs_entry');
    expect(result.source_label).toBe('calibrating');
    expect(morningBriefingToDashboardHero(result).source_label).toBe('calibrating');
  });

  it('does not count a generated day plan as a schedule entry', () => {
    const schedule = briefing().readiness.contributions?.domains.find((d) => d.domain === 'mind_life_load');
    expect(schedule?.missing).toBe(true);
    expect(schedule?.contribution).toBe(0);
  });

  it('does not count sleep logged long ago as last night', () => {
    const result = briefing({ sleep: [sleepSession('2026-06-20', 480)] });
    expect(result.readiness.missing_data).toContain('recovery_rhythm');
    expect(result.readiness.label).toBe('calibrating');
  });

  it('gives a low-confidence estimate from a single entry', () => {
    const result = briefing({ meals: 1 });
    expect(result.readiness.label).not.toBe('calibrating');
    expect(result.readiness.missing_data).toHaveLength(3);
    expect(result.readiness.confidence).toBe('low');
    expect(result.source_label).toBe('logged');
  });

  it('counts last night\'s sleep, and moves the number with it', () => {
    const rested = briefing({ sleep: [sleepSession(date, 480)] });
    const short = briefing({ sleep: [sleepSession(date, 280)] });
    expect(rested.readiness.label).not.toBe('calibrating');
    expect(short.readiness.label).not.toBe('calibrating');
    expect(rested.readiness.score).toBeGreaterThan(short.readiness.score);
  });

  it('counts a workout or a schedule entry on its own', () => {
    expect(briefing({ workouts: 1 }).readiness.label).not.toBe('calibrating');
    expect(briefing({ blocks: 2 }).readiness.label).not.toBe('calibrating');
  });

  it('lets the demo card show a number after one entry, and not before', () => {
    const now = new Date(2026, 6, 14, 12).toISOString();
    const card = (base: ReturnType<typeof briefing>['readiness']) =>
      evaluateReadinessNow({ now, base: { ...base, date }, checkins: [], mealTimes: [], waterTimes: [] });
    expect(card(briefing().readiness).publicScore).toBeNull();
    expect(card(briefing({ meals: 1 }).readiness).publicScore).toEqual(expect.any(Number));
  });
});
