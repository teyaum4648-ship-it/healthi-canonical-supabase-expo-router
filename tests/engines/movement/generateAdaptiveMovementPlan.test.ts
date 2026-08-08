import { describe, expect, it } from 'vitest';

import {
  generateAdaptiveMovementPlan,
  type MovementReadinessSignal,
  type MovementSummary
} from '../../../src/engines/movement';

function summary(overrides: Partial<MovementSummary> = {}): MovementSummary {
  return {
    date: '2026-08-04',
    window_start: '2026-07-29',
    workout_count: 3,
    total_minutes: 120,
    strength_session_count: 2,
    cardio_session_count: 1,
    mobility_recovery_session_count: 0,
    estimated_training_load: 720,
    recent_high_effort_count: 0,
    exercise_entry_count: 6,
    consistency: 'steady',
    confidence: 'high',
    reason_codes: ['weekly_workouts_available'],
    ...overrides
  };
}

function signal(overrides: Partial<MovementReadinessSignal> = {}): MovementReadinessSignal {
  return {
    label: 'steady_maintenance',
    score: 72,
    training_readiness: 'medium',
    confidence: 'high',
    summary: 'Your recent training pattern supports a steady session today.',
    suggested_next_action: 'Keep today useful and leave a little capacity in reserve.',
    reason_codes: ['weekly_workouts_available'],
    ...overrides
  };
}

describe('generateAdaptiveMovementPlan', () => {
  it('maps the deterministic readiness signal into a bounded useful range', () => {
    const plan = generateAdaptiveMovementPlan({
      signal: signal(),
      summary: summary(),
      sleep_signal: 'supportive',
      nutrition_signal: 'supportive'
    });

    expect(plan.capacity).toBe('build');
    expect(plan.readiness_score).toBe(72);
    expect(plan.effort_range).toEqual({ min: 5, max: 7 });
    expect(plan.reason_codes).toContain('adaptive_plan_from_readiness');
  });

  it('lets a safety limit override a build-capable signal', () => {
    const plan = generateAdaptiveMovementPlan({
      signal: signal({ label: 'ready_to_build', score: 84, training_readiness: 'high' }),
      summary: summary(),
      training_allowed: false,
      sleep_signal: 'supportive',
      nutrition_signal: 'supportive'
    });

    expect(plan.capacity).toBe('restore');
    expect(plan.training_allowed).toBe(false);
    expect(plan.recommended_session_types).toEqual(['recovery', 'mobility']);
    expect(plan.reason_codes).toContain('training_limited_by_safety');
  });

  it('uses a low-load technique range while movement history calibrates', () => {
    const plan = generateAdaptiveMovementPlan({
      signal: signal({
        label: 'calibrating',
        score: 50,
        confidence: 'low',
        reason_codes: ['movement_data_calibrating']
      }),
      summary: summary({
        workout_count: 0,
        total_minutes: 0,
        strength_session_count: 0,
        cardio_session_count: 0,
        confidence: 'low'
      })
    });

    expect(plan.capacity).toBe('technique');
    expect(plan.effort_range.max).toBeLessThanOrEqual(5);
    expect(plan.reason_codes).toContain('calibration_session_recommended');
    expect(plan.movement_mix_insight).toContain('logged');
  });

  it('keeps unknown sleep and nutrition context explicit', () => {
    const plan = generateAdaptiveMovementPlan({ signal: signal(), summary: summary() });

    expect(plan.support.find((item) => item.key === 'sleep')?.state).toBe('unknown');
    expect(plan.support.find((item) => item.key === 'nutrition')?.state).toBe('unknown');
    expect(plan.reason_codes).toContain('sleep_context_unknown');
    expect(plan.reason_codes).toContain('nutrition_context_unknown');
  });

  it('identifies a missing mobility and recovery lane without lowering the readiness score', () => {
    const plan = generateAdaptiveMovementPlan({ signal: signal(), summary: summary() });

    expect(plan.readiness_score).toBe(72);
    expect(plan.movement_mix_insight).toContain('Mobility and recovery');
    expect(plan.reason_codes).toContain('mobility_recovery_underrepresented');
  });

  it('returns serializable, non-medical guidance with confidence and reasons', () => {
    const plan = generateAdaptiveMovementPlan({ signal: signal(), summary: summary() });
    const output = JSON.stringify(plan).toLowerCase();

    expect(JSON.parse(JSON.stringify(plan))).toEqual(plan);
    expect(plan.confidence).toBe('high');
    expect(plan.reason_codes.length).toBeGreaterThan(0);
    for (const blocked of ['diagnosis', 'treatment', 'cure', 'prescribe', 'cortisol', 'hormone']) {
      expect(output).not.toContain(blocked);
    }
  });
});
