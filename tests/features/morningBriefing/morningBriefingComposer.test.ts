import { describe, expect, it } from 'vitest';

import { generateCircadianBriefing } from '../../../src/engines/circadian';
import { generateDayPlan } from '../../../src/engines/dayPlan';
import { calculateMovementSummary, generateMovementReadinessSignal } from '../../../src/engines/movement';
import { composeDashboardNutritionSummary } from '../../../src/features/dashboard/dashboardComposer';
import {
  composeMorningBriefing,
  morningBriefingToDashboardHero,
  readinessToDayPlanInput
} from '../../../src/features/morningBriefing';
import { createDefaultSleepNeedEstimate, createDemoSleepSessions } from '../../../src/features/sleepRhythm/rhythmInputs';

const date = '2026-07-14';

function completeBriefing() {
  const sessions = createDemoSleepSessions(date);
  const rhythm = generateCircadianBriefing({
    date,
    timezone: 'UTC',
    recentSleepSessions: sessions,
    sleepNeed: createDefaultSleepNeedEstimate(`${date}T12:00:00.000Z`),
    preferredBedtime: '22:30',
    now: `${date}T09:00:00.000Z`
  });
  const nutrition = composeDashboardNutritionSummary({
    date,
    meals: [{
      id: 'meal-1',
      logged_at: `${date}T08:00:00.000Z`,
      meal_type: 'breakfast',
      name: 'Breakfast bowl',
      source: 'demo',
      source_confidence: 'medium',
      calories: 520,
      protein_g: 32,
      carbs_g: 55,
      fat_g: 18,
      fiber_g: 9,
      sugar_g: 8,
      sodium_mg: 420,
      ingredients: null,
      quality_flags: ['balanced_meal'],
      user_response: { digestion: 'good', energy: 'steady', appetite: 'stable', cravings: 'none' },
      reason_codes: ['demo_food_data'],
      created_at: `${date}T08:00:00.000Z`
    }],
    demoMode: true
  });
  const movementSummary = calculateMovementSummary({
    date,
    sessions: [{
      id: 'session-1',
      session_date: '2026-07-13',
      logged_at: '2026-07-13T17:00:00.000Z',
      title: 'Steady strength',
      workout_type: 'strength',
      duration_minutes: 45,
      perceived_effort: 6,
      source_confidence: 'medium',
      reason_codes: ['demo_movement_data']
    }]
  });
  const movementSignal = generateMovementReadinessSignal({ summary: movementSummary, readiness_mode: 'maintain' });
  const dayPlan = generateDayPlan({
    date,
    schedule_blocks: [{
      id: 'work-1',
      type: 'work',
      label: 'Work',
      start: `${date}T09:00:00.000Z`,
      end: `${date}T12:00:00.000Z`,
      flexibility: 'fixed',
      source: 'demo',
      confidence: 'medium',
      reason_codes: ['demo_schedule_data']
    }]
  });

  return composeMorningBriefing({
    date,
    rhythm: { briefing: rhythm, recent_sleep_session: sessions[0] },
    nutrition,
    movement: { summary: movementSummary, signal: movementSignal },
    schedule: { block_count: 1, day_plan: dayPlan },
    sources: { rhythm: 'demo', nutrition: 'demo', movement: 'demo', schedule: 'demo' }
  });
}

describe('composeMorningBriefing', () => {
  it('does not turn a default circadian schedule into observed recovery for a fresh profile', () => {
    const clockOnly = generateCircadianBriefing({
      date, timezone: 'UTC', recentSleepSessions: [],
      sleepNeed: createDefaultSleepNeedEstimate(`${date}T12:00:00.000Z`), now: `${date}T09:00:00.000Z`
    });
    const empty = composeMorningBriefing({ date });
    const fresh = composeMorningBriefing({ date, rhythm: { briefing: clockOnly, recent_sleep_session: null } });
    expect(fresh.readiness.score).toBe(empty.readiness.score);
    expect(fresh.readiness.missing_data).toContain('recovery_rhythm');
    expect(fresh.driver_cards.find((driver) => driver.domain === 'recovery_rhythm')?.status).toBe('calibrating');
    expect(fresh.confidence).toBe('low');
  });

  it('maps rhythm, nutrition, movement, and schedule into one briefing', () => {
    const briefing = completeBriefing();
    expect(briefing.readiness.missing_data).toEqual([]);
    expect(briefing.driver_cards.map((driver) => driver.domain)).toEqual([
      'recovery_rhythm', 'nourishment', 'movement_capacity', 'mind_life_load'
    ]);
    expect(briefing.top_actions.length).toBeGreaterThan(0);
    expect(briefing.source_label).toBe('demo');
  });

  it('maps nutrition readiness and reason codes', () => {
    const briefing = completeBriefing();
    const nutrition = briefing.driver_cards.find((driver) => driver.domain === 'nourishment');
    expect(nutrition?.detail).toContain('1 meals logged');
    expect(nutrition?.reason_codes.length).toBeGreaterThan(0);
  });

  it('maps movement totals and readiness', () => {
    const briefing = completeBriefing();
    const movement = briefing.driver_cards.find((driver) => driver.domain === 'movement_capacity');
    expect(movement?.detail).toContain('1 workouts');
    expect(movement?.detail).toContain('45 minutes');
  });

  it('maps schedule blocks and open windows', () => {
    const briefing = completeBriefing();
    const schedule = briefing.driver_cards.find((driver) => driver.domain === 'mind_life_load');
    expect(schedule?.detail).toContain('1 blocks');
    expect(schedule?.detail).toContain('open windows');
  });

  it('gives a low-confidence demo estimate from a single local entry', () => {
    const briefing = composeMorningBriefing({
      date,
      schedule: { block_count: 1 },
      sources: { schedule: 'demo' }
    });
    expect(briefing.source_label).toBe('demo');
    expect(briefing.readiness.label).not.toBe('calibrating');
    expect(briefing.readiness.missing_data).toHaveLength(3);
    expect(briefing.confidence).toBe('low');
  });

  it('returns a calibrating source when local demo data has no entries', () => {
    const briefing = composeMorningBriefing({
      date,
      schedule: { block_count: 0 },
      sources: { schedule: 'demo' }
    });
    expect(briefing.source_label).toBe('calibrating');
    expect(briefing.readiness.label).toBe('calibrating');
  });

  it('treats empty feature summaries as calibrating rather than available signals', () => {
    const nutrition = composeDashboardNutritionSummary({ date, meals: [], demoMode: true });
    const movementSummary = calculateMovementSummary({ date, sessions: [] });
    const movementSignal = generateMovementReadinessSignal({ summary: movementSummary });
    const dayPlan = generateDayPlan({ date, schedule_blocks: [] });
    const briefing = composeMorningBriefing({
      date,
      nutrition,
      movement: { summary: movementSummary, signal: movementSignal },
      schedule: { block_count: 0, day_plan: dayPlan },
      sources: { nutrition: 'demo', movement: 'demo', schedule: 'demo' }
    });

    expect(briefing.readiness.missing_data).toEqual([
      'recovery_rhythm',
      'nourishment',
      'movement_capacity',
      'mind_life_load'
    ]);
    expect(briefing.readiness.label).toBe('calibrating');
    expect(briefing.source_label).toBe('calibrating');
  });

  it('falls back safely when rhythm data is missing', () => {
    const briefing = composeMorningBriefing({ date });
    expect(briefing.readiness.missing_data).toContain('recovery_rhythm');
    expect(briefing.top_actions.length).toBeGreaterThanOrEqual(2);
  });

  it('maps the briefing into dashboard hero fields', () => {
    const briefing = completeBriefing();
    const hero = morningBriefingToDashboardHero(briefing);
    expect(hero.score).toBe(briefing.readiness.score);
    expect(hero.label).toBe(briefing.headline);
    expect(hero.focus).toBe(briefing.today_focus);
    expect(hero.top_action).toBe(briefing.top_actions[0]?.title);
  });

  it('maps readiness mode, confidence, and reasons into Day Plan input', () => {
    const readiness = completeBriefing().readiness;
    const input = readinessToDayPlanInput(readiness);
    expect(input.score).toBe(readiness.score);
    expect(input.mode).toBe(readiness.mode);
    expect(input.confidence).toBe(readiness.confidence);
    expect(input.reason_codes).toEqual(readiness.reason_codes);
  });

  it('keeps output serializable', () => {
    const briefing = completeBriefing();
    expect(JSON.parse(JSON.stringify(briefing))).toEqual(briefing);
  });
});
