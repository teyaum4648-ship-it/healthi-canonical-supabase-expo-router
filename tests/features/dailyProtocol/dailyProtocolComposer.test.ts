import { describe, expect, it } from 'vitest';

import type { CircadianBriefing } from '../../../src/engines/circadian';
import type { DayPlanResult } from '../../../src/engines/dayPlan';
import type { MovementReadinessSignal } from '../../../src/engines/movement';
import type { DailyReadinessResult } from '../../../src/engines/readiness';
import type { DashboardNutritionSummary } from '../../../src/features/dashboard/dashboardComposer';
import {
  buildProtocolInput,
  buildSafetyInput,
  composeDailyProtocol
} from '../../../src/features/dailyProtocol/dailyProtocolComposer';

const DATE = '2026-07-15';

function readiness(overrides: Partial<DailyReadinessResult> = {}): DailyReadinessResult {
  return {
    date: DATE,
    score: 65,
    label: 'steady',
    mode: 'maintain',
    confidence: 'high',
    primary_focus: 'balanced',
    summary: 'A steady day.',
    recommended_actions: [],
    driver_cards: [],
    reason_codes: ['readiness_composed'],
    missing_data: [],
    ...overrides
  };
}

function circadian(overrides: Partial<CircadianBriefing> = {}): CircadianBriefing {
  return {
    current_phase: 'morning_peak',
    confidence: 'high',
    reason_codes: ['rhythm_composed'],
    rhythm_plan: {
      best_exercise_windows: [{ start_at: `${DATE}T09:00:00.000Z`, end_at: `${DATE}T10:00:00.000Z`, label: 'window' }],
      caffeine_cutoff: `${DATE}T14:00:00.000Z`,
      wind_down_start: `${DATE}T21:30:00.000Z`
    },
    sleep_debt_7_day: { nightly_average_debt_minutes: 15 }
  } as unknown as CircadianBriefing;
}

function movementSignal(overrides: Partial<MovementReadinessSignal> = {}): MovementReadinessSignal {
  return {
    label: 'steady_maintenance',
    score: 64,
    training_readiness: 'medium',
    confidence: 'medium',
    summary: 'Steady.',
    suggested_next_action: 'Keep today useful.',
    reason_codes: []
  } as unknown as MovementReadinessSignal;
}

function nutrition(overrides: Partial<DashboardNutritionSummary> = {}): DashboardNutritionSummary {
  return {
    meal_count: 2,
    readiness_support_label: 'Supportive',
    food_response_label: 'Steady',
    food_quality_label: 'Steady',
    reason_codes: [],
    confidence: 'medium',
    ...overrides
  } as unknown as DashboardNutritionSummary;
}

function dayPlan(): DayPlanResult {
  return {
    open_windows: [{ start: '', end: '', duration_minutes: 60, reason_codes: [] }, { start: '', end: '', duration_minutes: 45, reason_codes: [] }],
    protected_blocks: [{ start: '', end: '' }],
    reason_codes: ['schedule_composed']
  } as unknown as DayPlanResult;
}

describe('composeDailyProtocol', () => {
  it('produces a usable protocol model in demo mode', () => {
    const model = composeDailyProtocol({ date: DATE, source: 'demo', readiness: readiness(), circadian: circadian() });
    expect(model.is_demo).toBe(true);
    expect(model.source_label).toBe('demo');
    expect(model.protocol.actions.length).toBeGreaterThanOrEqual(3);
  });

  it('does not crash on signed-out / sparse state', () => {
    const model = composeDailyProtocol({ date: DATE });
    expect(model.protocol.status).toBe('calibrating');
    expect(model.source_label).toBe('calibrating');
    expect(() => JSON.stringify(model)).not.toThrow();
  });

  it('maps Home readiness inputs into the protocol day mode', () => {
    const model = composeDailyProtocol({ date: DATE, readiness: readiness({ mode: 'restore', primary_focus: 'recovery_rhythm' }) });
    expect(model.protocol.day_mode).toBe('restore');
  });

  it('maps Sleep / circadian inputs into protocol actions', () => {
    const model = composeDailyProtocol({ date: DATE, readiness: readiness(), circadian: circadian() });
    const windDown = model.protocol.actions.find((action) => action.kind === 'wind_down');
    expect(windDown?.time_hint).toBeTruthy();
    // The circadian caffeine cutoff maps into the protocol input (it may be trimmed
    // from the final 3–5 actions by priority, but the mapping is present).
    const mapped = buildProtocolInput({ date: DATE, circadian: circadian() });
    expect(mapped.circadian?.caffeine_cutoff).toBeTruthy();
    expect(mapped.circadian?.wind_down_start).toBeTruthy();
  });

  it('maps Diet / nutrition inputs into protocol actions', () => {
    const model = composeDailyProtocol({
      date: DATE,
      readiness: readiness(),
      circadian: circadian(),
      nutrition: nutrition({ reason_codes: ['under_fueled'], readiness_support_label: 'Watch' })
    });
    const meal = model.protocol.actions.find((action) => action.kind === 'meal');
    expect(meal?.reason_codes).toContain('under_fueled');
    expect(model.safety.status).toBe('caution');
  });

  it('maps Move inputs into the protocol input', () => {
    const input = buildProtocolInput({ date: DATE, movement: { signal: movementSignal() } });
    expect(input.movement?.movement_readiness_label).toBe('steady_maintenance');
    const safetyInput = buildSafetyInput({ date: DATE, movement: { signal: movementSignal(), pain_present: true } });
    expect(safetyInput.movement?.pain_present).toBe(true);
  });

  it('maps Plan / schedule inputs into the protocol input', () => {
    const input = buildProtocolInput({ date: DATE, dayPlan: dayPlan() });
    expect(input.schedule?.open_windows_count).toBe(2);
    expect(input.schedule?.protected_blocks_count).toBe(1);
  });

  it('maps baseline / onboarding inputs into the protocol', () => {
    const model = composeDailyProtocol({
      date: DATE,
      baseline: { baseline_mode: 'build', primary_focus: 'movement_capacity', confidence: 'high' },
      circadian: circadian()
    });
    expect(model.protocol.day_mode).toBe('build');
    expect(model.protocol.primary_focus).toBe('movement_capacity');
  });
});
