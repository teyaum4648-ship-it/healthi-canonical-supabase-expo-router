import { describe, expect, it } from 'vitest';

import type { SleepNeedEstimate, SleepSession } from '../../../src/engines/circadian';
import type { FoodPatternProfile, MealLog } from '../../../src/engines/nutrition';
import type { WorkoutSessionRow } from '../../../src/features/movement/movementPersistence';
import { buildPersonalBlueprint } from '../../../src/features/profile/personalBlueprint';

const sleepNeed: SleepNeedEstimate = {
  minutes: 480,
  confidence: 'medium',
  basis: ['onboarding'],
  updated_at: '2026-07-15T12:00:00.000Z'
};

const foodPattern: FoodPatternProfile = {
  created_at: '2026-07-01T12:00:00.000Z',
  updated_at: '2026-07-15T12:00:00.000Z',
  source: 'food_pattern_test',
  confidence: 'medium',
  pattern_label: 'protein_forward',
  scores: {
    steady_balanced: 42,
    protein_forward: 76,
    carb_supported: 34,
    lighter_frequent: 28,
    evening_sensitive: 25
  },
  macro_tendency: { protein: 'higher', carbs: 'moderate', fat: 'moderate' },
  meal_timing_tendency: { breakfast: 'helpful', meal_spacing: 'moderate', late_meal_sensitivity: 'medium' },
  response_tendencies: { digestion: 'steady', energy: 'steady', appetite: 'stable' },
  reason_codes: ['protein_forward_signal']
};

function meal(name: string): MealLog {
  return {
    logged_at: '2026-07-15T12:00:00.000Z',
    meal_type: 'breakfast',
    name,
    source: 'manual',
    source_confidence: 'medium',
    quality_flags: [],
    reason_codes: ['manual_food_log'],
    created_at: '2026-07-15T12:00:00.000Z'
  };
}

function sleep(date: string, durationMinutes: number): SleepSession {
  return {
    date,
    sleep_start_at: null,
    sleep_end_at: null,
    duration_minutes: durationMinutes,
    source: 'manual',
    source_confidence: 'medium',
    reason_codes: ['user_confirmed_sleep'],
    created_at: `${date}T12:00:00.000Z`
  };
}

function workout(overrides: Partial<WorkoutSessionRow> = {}): WorkoutSessionRow {
  return {
    id: 'workout-1',
    user_id: 'user-1',
    logged_at: '2026-07-15T12:00:00.000Z',
    session_date: '2026-07-15',
    title: 'Mobility reset',
    workout_type: 'mobility',
    duration_minutes: 35,
    perceived_effort: 4,
    readiness_before: null,
    session_note: null,
    source: 'manual',
    source_confidence: 'medium',
    reason_codes: ['manual_workout_log'],
    created_at: '2026-07-15T12:00:00.000Z',
    updated_at: '2026-07-15T12:00:00.000Z',
    ...overrides
  };
}

describe('personal blueprint', () => {
  it('summarizes logged nourishment patterns without presenting a macro target', () => {
    const blueprint = buildPersonalBlueprint({
      today: '2026-07-15',
      foodPattern,
      meals: [meal('Greek yogurt bowl'), meal('Egg wrap'), meal('Greek yogurt bowl')],
      sleepNeed
    });

    expect(blueprint.nourishment.status).toBe('ready');
    expect(blueprint.nourishment.macro_tendency).toEqual([
      { nutrient: 'Protein', tendency: 'higher', weight: 40 },
      { nutrient: 'Carbs', tendency: 'moderate', weight: 30 },
      { nutrient: 'Fat', tendency: 'moderate', weight: 30 }
    ]);
    expect(blueprint.nourishment.often_logged_meals).toEqual(['Greek yogurt bowl', 'Egg wrap']);
    expect(blueprint.nourishment.detail).toContain('not a macro target');
  });

  it('keeps absent nourishment data in a calibrating state', () => {
    const blueprint = buildPersonalBlueprint({ today: '2026-07-15', sleepNeed });

    expect(blueprint.nourishment.status).toBe('calibrating');
    expect(blueprint.nourishment.often_logged_meals).toEqual([]);
    expect(blueprint.nourishment.macro_tendency.every((slice) => slice.tendency === 'moderate')).toBe(true);
  });

  it('uses recent sleep entries and saved bedtime timing for calm rhythm cues', () => {
    const blueprint = buildPersonalBlueprint({
      today: '2026-07-15',
      sleepNeed,
      sleepSessions: [sleep('2026-07-15', 380), sleep('2026-07-14', 400), sleep('2026-07-13', 410)],
      preferredBedtime: '22:45:00'
    });

    expect(blueprint.sleep.biggest_friction).toContain('Recent sleep duration sits below your current estimated need.');
    expect(blueprint.sleep.rhythm_tips).toEqual([
      { title: 'Wind-down cue', detail: 'Start easing the day around 9:15 PM, based on your preferred bedtime.' },
      { title: 'Caffeine boundary', detail: 'Consider wrapping caffeine around 2:45 PM to protect your preferred sleep window.' }
    ]);
  });

  it('uses recorded movement and explicit baseline notes without inferring limitations', () => {
    const blueprint = buildPersonalBlueprint({
      today: '2026-07-15',
      sleepNeed,
      movementSessions: [workout(), workout({ id: 'workout-2', workout_type: 'strength', duration_minutes: 45, perceived_effort: 7 })],
      movementFlags: ['knee comfort'],
      postureFlags: ['desk stiffness']
    });

    expect(blueprint.movement.total_minutes).toBe(80);
    expect(blueprint.movement.average_effort).toBe(5.5);
    expect(blueprint.movement.mobility_recovery_sessions).toBe(1);
    expect(blueprint.movement.movement_notes).toEqual(['Knee Comfort', 'Desk Stiffness']);
    expect(JSON.parse(JSON.stringify(blueprint))).toEqual(blueprint);
  });
});
