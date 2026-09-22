import { describe, expect, it } from 'vitest';

import { generateCircadianBriefing, type CircadianBriefing, type RhythmPlan, type SleepDebtSummary, type SleepSession } from '../../../src/engines/circadian';
import type { MealLog, NutritionTargets } from '../../../src/engines/nutrition';
import { composeDashboardModel, composeDashboardNutritionSummary } from '../../../src/features/dashboard/dashboardComposer';
import { createDefaultSleepNeedEstimate, createDemoSleepSessions } from '../../../src/features/sleepRhythm/rhythmInputs';

type BriefingOverrides = Partial<Omit<CircadianBriefing, 'rhythm_plan' | 'sleep_debt_7_day'>> & {
  rhythm_plan?: Partial<RhythmPlan>;
  sleep_debt_7_day?: Partial<SleepDebtSummary>;
};

function createBriefing(overrides: BriefingOverrides = {}): CircadianBriefing {
  const sessions = createDemoSleepSessions('2026-06-12');
  const briefing = generateCircadianBriefing({
    date: '2026-06-12',
    timezone: 'UTC',
    recentSleepSessions: sessions,
    sleepNeed: createDefaultSleepNeedEstimate('2026-06-12T12:00:00.000Z'),
    preferredBedtime: '22:30',
    now: '2026-06-12T09:30:00.000Z'
  });

  return {
    ...briefing,
    ...overrides,
    sleep_debt_7_day: {
      ...briefing.sleep_debt_7_day,
      ...overrides.sleep_debt_7_day
    },
    rhythm_plan: {
      ...briefing.rhythm_plan,
      ...overrides.rhythm_plan
    }
  };
}

function createSession(overrides: Partial<SleepSession> = {}): SleepSession {
  return {
    date: '2026-06-12',
    sleep_start_at: '2026-06-11T22:35:00.000Z',
    sleep_end_at: '2026-06-12T06:35:00.000Z',
    duration_minutes: 480,
    sleep_quality: 4,
    source: 'manual',
    source_confidence: 'medium',
    corrected_by_user: false,
    reason_codes: ['user_confirmed_sleep'],
    created_at: '2026-06-12T12:00:00.000Z',
    ...overrides
  };
}

function createMeal(overrides: Partial<MealLog> = {}): MealLog {
  return {
    logged_at: '2026-06-12T12:00:00.000Z',
    meal_type: 'lunch',
    name: 'Lunch bowl',
    source: 'manual',
    source_confidence: 'medium',
    calories: 620,
    protein_g: 42,
    carbs_g: 58,
    fat_g: 22,
    fiber_g: 10,
    sugar_g: 8,
    sodium_mg: 640,
    ingredients: null,
    quality_flags: ['balanced_meal', 'whole_food_emphasis'],
    user_response: {
      digestion: 'good',
      energy: 'steady',
      appetite: 'stable',
      cravings: 'none',
      notes: null
    },
    corrected_by_user: false,
    confirmed_by_user: true,
    reason_codes: ['manual_food_log'],
    created_at: '2026-06-12T12:01:00.000Z',
    ...overrides
  };
}

const nutritionTargets: NutritionTargets = {
  calories_target: 700,
  protein_g_target: 45,
  carbs_g_target: 70,
  fat_g_target: 28,
  fiber_g_target: 10,
  sodium_mg_limit: 2300,
  confidence: 'medium',
  basis: ['manual_adjustment']
};

describe('composeDashboardModel', () => {
  it('produces a serializable dashboard model', () => {
    const model = composeDashboardModel({
      date: '2026-06-12',
      circadianBriefing: createBriefing(),
      recentSleepSession: createSession(),
      demoMode: true
    });

    expect(JSON.parse(JSON.stringify(model))).toEqual(model);
  });

  it('maps readiness score to the correct readiness state', () => {
    const primed = composeDashboardModel({
      date: '2026-06-12',
      circadianBriefing: createBriefing({
        current_phase: 'morning_peak',
        sleep_debt_7_day: { nightly_average_debt_minutes: 0 }
      }),
      recentSleepSession: createSession({ duration_minutes: 500 })
    });

    expect(primed.readiness.state).toBe('primed');
    expect(primed.readiness.label).toBe("You're primed");
  });

  it('lowers confidence when key data is missing', () => {
    const model = composeDashboardModel({ date: '2026-06-12' });

    expect(model.readiness.confidence).toBe('low');
    expect(model.readiness.reason_codes).toContain('sleep_signal_missing');
  });

  it("lets sleep and circadian data influence Today's Focus", () => {
    const model = composeDashboardModel({
      date: '2026-06-12',
      circadianBriefing: createBriefing({
        current_phase: 'morning_peak',
        sleep_debt_7_day: { nightly_average_debt_minutes: 0 }
      }),
      recentSleepSession: createSession({ duration_minutes: 500 })
    });

    expect(model.focus.directive).toBe('stronger_output');
    expect(model.focus.title).toBe('High-output window');
    expect(model.focus.why).toContain('Favorable rhythm phase');
  });

  it('uses high sleep debt to create a recovery or maintain style directive', () => {
    const model = composeDashboardModel({
      date: '2026-06-12',
      circadianBriefing: createBriefing({
        sleep_debt_7_day: { nightly_average_debt_minutes: 130 }
      }),
      recentSleepSession: createSession({ duration_minutes: 390 })
    });

    expect(['controlled_output', 'recovery_led']).toContain(model.focus.directive);
    expect(model.focus.why).toContain('Sleep debt is asking for control');
  });

  it('keeps recovery tile honest when live wearable data is unavailable', () => {
    const model = composeDashboardModel({
      date: '2026-06-12',
      circadianBriefing: createBriefing(),
      recentSleepSession: createSession()
    });
    const recovery = model.drivers.find((driver) => driver.id === 'recovery');

    expect(recovery?.source).toBe('No live HRV data');
  });

  it('includes the expected quick actions', () => {
    const model = composeDashboardModel({ date: '2026-06-12' });

    expect(model.quickActions.map((action) => action.id)).toEqual(['log_meal', 'start_workout', 'log_sleep']);
  });

  it('maps real nutrition engine outputs into the dashboard nutrition summary', () => {
    const summary = composeDashboardNutritionSummary({
      date: '2026-06-12',
      meals: [createMeal()],
      targets: nutritionTargets
    });

    expect(summary.meal_count).toBe(1);
    expect(summary.calorie_label).toBe('620 / 700');
    expect(summary.protein_label).toBe('42g / 45g');
    expect(summary.food_quality_label).toBe('Supportive');
    expect(summary.food_response_label).toBe('Steady');
    expect(summary.readiness_support_label).toBe("Logged meals are supporting today's readiness.");
    expect(summary.confidence).toBe('medium');
    expect(summary.source_label).toBe('logged');
  });

  it('returns a calibrating nutrition state when meal data is missing', () => {
    const summary = composeDashboardNutritionSummary({
      date: '2026-06-12',
      meals: [],
      targets: nutritionTargets
    });

    expect(summary.meal_count).toBe(0);
    expect(summary.calorie_label).toBe('Calibrating');
    expect(summary.protein_label).toBe('Calibrating');
    expect(summary.food_quality_label).toBe('Calibrating');
    expect(summary.food_response_label).toBe('Calibrating');
    expect(summary.confidence).toBe('low');
    expect(summary.readiness_adjustment).toBe(0);
    expect(summary.next_action).toBe('Log a meal to improve today’s fueling signal.');
  });

  it('keeps missing nutrition data from sharply lowering dashboard readiness', () => {
    const withoutMeals = composeDashboardModel({
      date: '2026-06-12',
      circadianBriefing: createBriefing(),
      recentSleepSession: createSession(),
      nutritionMeals: [],
      nutritionTargets
    });
    const withMeals = composeDashboardModel({
      date: '2026-06-12',
      circadianBriefing: createBriefing(),
      recentSleepSession: createSession(),
      nutritionMeals: [createMeal()],
      nutritionTargets
    });

    /*
     * The claim in the name is about the missing case, and it still holds: nothing
     * logged contributes nothing and lowers confidence instead. The two bounds that
     * used to follow pinned a [-3, +2] squash applied to days that DID have data, which
     * is the thing that kept food from ever moving readiness — a week of eating badly
     * moved the day less than one short night. That clamp is gone, so what is asserted
     * now is the rule rather than the old constant.
     */
    expect(withoutMeals.nutrition.summary.confidence).toBe('low');
    expect(withoutMeals.nutrition.summary.readiness_adjustment).toBe(0);
    expect(withoutMeals.nutrition.summary.nourishment_score).toBeNull();

    expect(withMeals.nutrition.summary.readiness_adjustment).not.toBe(0);
    expect(withMeals.nutrition.summary.nourishment_score).not.toBeNull();
  });

  it('does not introduce blocked language in generated dashboard copy', () => {
    const model = composeDashboardModel({
      date: '2026-06-12',
      circadianBriefing: createBriefing(),
      recentSleepSession: createSession()
    });
    const output = JSON.stringify(model).toLowerCase();
    const blockedTerms = [
      'che' + 'k',
      'h' + 'lc',
      'primal ' + 'pattern',
      'work-' + 'in',
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
      'de' + 'tox',
      'tox' + 'in',
      'tox' + 'ic',
      'clean' + 'se',
      'cheat ' + 'meal',
      'guilt-' + 'free',
      'bad ' + 'food',
      'metabolic ' + 'type',
      'metabolic ' + 'typing',
      '4 doc' + 'tors'
    ];

    for (const term of blockedTerms) {
      expect(output).not.toContain(term);
    }
  });
});
