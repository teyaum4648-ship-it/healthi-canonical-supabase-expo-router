import { describe, expect, it } from 'vitest';

import type { SleepSession } from '../../../src/engines/circadian';
import type { MealLog } from '../../../src/engines/nutrition';
import {
  aggregateDashboardMacros,
  boundedProgress,
  driverStatusProgress,
  greetingForHour,
  greetingName,
  homeGreeting,
  recentSleepTrend
} from '../../../src/features/dashboard/homeDashboardPresentation';

function meal(overrides: Partial<MealLog> = {}): MealLog {
  return {
    logged_at: '2026-09-07T12:00:00.000Z',
    meal_type: 'lunch',
    name: 'Lunch',
    source: 'manual',
    source_confidence: 'medium',
    calories: 500,
    protein_g: 30,
    carbs_g: 55,
    fat_g: 18,
    fiber_g: 8,
    sugar_g: 6,
    sodium_mg: 450,
    ingredients: null,
    quality_flags: [],
    user_response: null,
    corrected_by_user: false,
    confirmed_by_user: true,
    reason_codes: ['manual_food_log'],
    created_at: '2026-09-07T12:00:00.000Z',
    ...overrides
  };
}

function sleep(date: string, duration: number | null): SleepSession {
  return {
    date,
    sleep_start_at: null,
    sleep_end_at: null,
    duration_minutes: duration,
    source: 'manual',
    source_confidence: 'medium',
    reason_codes: [],
    created_at: `${date}T12:00:00.000Z`
  };
}

describe('home dashboard presentation', () => {
  it('maps local time to a human greeting', () => {
    expect(greetingForHour(8)).toBe('Good morning');
    expect(greetingForHour(14)).toBe('Good afternoon');
    expect(greetingForHour(20)).toBe('Good evening');
  });

  it('aggregates only available logged macro evidence', () => {
    expect(aggregateDashboardMacros([
      meal(),
      meal({ calories: 250, protein_g: null, carbs_g: 20, fat_g: 6 })
    ])).toEqual({
      calories: 750,
      protein_g: 30,
      carbs_g: 75,
      fat_g: 24,
      has_nutrition: true
    });
    expect(aggregateDashboardMacros([]).has_nutrition).toBe(false);
  });

  it('bounds target progress and treats missing targets as unavailable', () => {
    expect(boundedProgress(50, 100)).toBe(0.5);
    expect(boundedProgress(150, 100)).toBe(1);
    expect(boundedProgress(50, null)).toBe(0);
  });

  it('uses semantic driver status rather than inventing foundation scores', () => {
    expect(driverStatusProgress('supportive')).toBe(1);
    expect(driverStatusProgress('calibrating')).toBeLessThan(driverStatusProgress('watch'));
  });

  it('builds a chronological trend from recorded sleep durations only', () => {
    expect(recentSleepTrend([
      sleep('2026-09-07', 470),
      sleep('2026-09-05', 440),
      sleep('2026-09-06', null)
    ])).toEqual([440, 470]);
  });
});

describe('greeting', () => {
  it('uses the first name given at sign-up', () => {
    expect(greetingName('  Maya ', 'Maya Lopez', false)).toBe('Maya');
    expect(homeGreeting('Good morning', 'Maya')).toBe('Good morning, Maya');
  });

  it('falls back to an account display name, but not the demo placeholder', () => {
    expect(greetingName(undefined, 'Sam Rivera', false)).toBe('Sam');
    expect(greetingName(undefined, 'Demo User', true)).toBeNull();
  });

  it('greets without a name rather than "there"', () => {
    expect(homeGreeting('Good evening', greetingName(null, null, false))).toBe('Good evening');
  });
});
