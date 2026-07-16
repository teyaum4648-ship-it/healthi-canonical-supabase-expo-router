import { describe, expect, it } from 'vitest';

import { generateDailyProtocol } from '../../../src/engines/protocol';
import type { GenerateDailyProtocolInput } from '../../../src/engines/protocol';
import type { SafetyReviewResult } from '../../../src/engines/safety';

const FORBIDDEN_TERMS = [
  'diagnosis', 'diagnose', 'treatment', 'cure', 'prescribe', 'prescription', 'rehab', 'rehabilitate',
  'injury treatment', 'clinical', 'medical decision', 'dysfunction', 'dysregulated', 'adrenal', 'hpa',
  'cortisol', 'hormone', 'detox', 'cleanse', 'toxic', 'bad food', 'bad body', 'bad movement',
  'cheat meal', 'guilt-free', 'metabolic type', 'metabolic typing', 'chek', 'c.h.e.k', 'hlc',
  '4 doctors', 'primal pattern', 'work-in', 'whoop strain', 'scout score', 'bobby approved',
  'fitbod', 'strong app'
];

function safety(overrides: Partial<SafetyReviewResult> = {}): SafetyReviewResult {
  return {
    status: 'clear',
    confidence: 'high',
    training_allowed: true,
    progression_allowed: true,
    blocked_domains: [],
    summary: 'No concerns from available signals.',
    allowed_actions: [],
    disallowed_actions: [],
    reason_codes: ['safety_review_complete'],
    missing_data: [],
    ...overrides
  };
}

const richInputs: Omit<GenerateDailyProtocolInput, 'readiness' | 'safety'> = {
  date: '2026-07-15',
  baseline: { baseline_mode: 'maintain', primary_focus: 'balanced', confidence: 'high' },
  circadian: {
    current_phase: 'morning_peak',
    best_movement_window: '9:00 AM',
    caffeine_cutoff: '2:00 PM',
    wind_down_start: '9:30 PM',
    sleep_debt_minutes: 15,
    confidence: 'high'
  },
  nourishment: { nutrition_readiness_label: 'supportive', hydration_low: false },
  movement: { movement_readiness_label: 'steady_maintenance' },
  schedule: { open_windows_count: 2, protected_blocks_count: 1 }
};

describe('generateDailyProtocol', () => {
  it('produces restore-oriented actions on a restore day', () => {
    const protocol = generateDailyProtocol({
      ...richInputs,
      readiness: { day_mode: 'restore', primary_focus: 'recovery_rhythm', confidence: 'high', score: 40, label: 'restore' },
      safety: safety()
    });
    expect(protocol.day_mode).toBe('restore');
    expect(protocol.actions.some((action) => action.kind === 'restore' || action.kind === 'wind_down')).toBe(true);
    expect(protocol.actions.some((action) => action.id === 'protocol_movement_strong')).toBe(false);
  });

  it('avoids a progression-style action on a correct day', () => {
    const protocol = generateDailyProtocol({
      ...richInputs,
      readiness: { day_mode: 'correct', primary_focus: 'movement_capacity', confidence: 'high', score: 50 },
      safety: safety()
    });
    expect(protocol.actions.some((action) => action.id === 'protocol_movement_strong')).toBe(false);
    expect(protocol.actions.some((action) => action.id === 'protocol_movement_simple')).toBe(true);
  });

  it('adds a stronger movement action on a build day only when safety allows progression', () => {
    const allowed = generateDailyProtocol({
      ...richInputs,
      readiness: { day_mode: 'build', primary_focus: 'movement_capacity', confidence: 'high', score: 82, label: 'primed' },
      safety: safety({ progression_allowed: true })
    });
    expect(allowed.actions.some((action) => action.id === 'protocol_movement_strong')).toBe(true);

    const blocked = generateDailyProtocol({
      ...richInputs,
      readiness: { day_mode: 'build', primary_focus: 'movement_capacity', confidence: 'high', score: 82, label: 'primed' },
      safety: safety({ status: 'caution', progression_allowed: false, reason_codes: ['under_fueled'] })
    });
    expect(blocked.actions.some((action) => action.id === 'protocol_movement_strong')).toBe(false);
  });

  it('blocks the normal protocol when safety returns professional_guidance', () => {
    const protocol = generateDailyProtocol({
      ...richInputs,
      readiness: { day_mode: 'build', confidence: 'high', score: 82 },
      safety: safety({ status: 'professional_guidance', training_allowed: false, progression_allowed: false })
    });
    expect(protocol.status).toBe('professional_guidance');
    expect(protocol.day_mode).toBe('professional_guidance');
    expect(protocol.actions.some((action) => action.kind === 'movement')).toBe(false);
  });

  it('produces calibrating copy and low confidence on sparse input', () => {
    const protocol = generateDailyProtocol({ date: '2026-07-15' });
    expect(protocol.status).toBe('calibrating');
    expect(protocol.confidence).toBe('low');
    expect(protocol.actions.length).toBeGreaterThanOrEqual(3);
  });

  it('gives every action reason codes and stays serializable', () => {
    const protocol = generateDailyProtocol({
      ...richInputs,
      readiness: { day_mode: 'maintain', confidence: 'high', score: 65 },
      safety: safety()
    });
    expect(protocol.actions.length).toBeGreaterThanOrEqual(3);
    expect(protocol.actions.length).toBeLessThanOrEqual(5);
    for (const action of protocol.actions) {
      expect(action.reason_codes.length).toBeGreaterThan(0);
    }
    expect(JSON.parse(JSON.stringify(protocol))).toEqual(protocol);
  });

  it('does not use forbidden language across day modes', () => {
    const modes = ['build', 'maintain', 'correct', 'restore'] as const;
    for (const mode of modes) {
      const protocol = generateDailyProtocol({
        ...richInputs,
        readiness: { day_mode: mode, confidence: 'high', score: 70 },
        safety: safety()
      });
      const output = JSON.stringify(protocol).toLowerCase();
      for (const term of FORBIDDEN_TERMS) {
        expect(output).not.toContain(term);
      }
    }
  });
});
