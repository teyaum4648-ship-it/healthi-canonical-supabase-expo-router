import { describe, expect, it } from 'vitest';

import { generateMovementReadinessSignal } from '../../../src/engines/movement';
import type { MovementSummary } from '../../../src/engines/movement';

function summary(overrides: Partial<MovementSummary> = {}): MovementSummary {
  return {
    date: '2026-07-15',
    window_start: '2026-07-09',
    workout_count: 3,
    total_minutes: 150,
    strength_session_count: 2,
    cardio_session_count: 1,
    mobility_recovery_session_count: 0,
    estimated_training_load: 40,
    recent_high_effort_count: 0,
    exercise_entry_count: 6,
    consistency: 'steady',
    confidence: 'medium',
    reason_codes: [],
    ...overrides
  };
}

describe('generateMovementReadinessSignal — sleep & diet influence', () => {
  it('lowers the score and flags reasons when sleep is limited and diet needs watching', () => {
    const base = generateMovementReadinessSignal({ summary: summary() });
    const constrained = generateMovementReadinessSignal({
      summary: summary(),
      sleep_signal: 'limited',
      nutrition_signal: 'watch'
    });

    expect(constrained.score).toBeLessThan(base.score);
    expect(constrained.reason_codes).toContain('sleep_signal_limited');
    expect(constrained.reason_codes).toContain('nutrition_signal_watch');
  });

  it('raises the score when both sleep and diet are supportive', () => {
    const base = generateMovementReadinessSignal({ summary: summary() });
    const supported = generateMovementReadinessSignal({
      summary: summary(),
      sleep_signal: 'supportive',
      nutrition_signal: 'supportive'
    });

    expect(supported.score).toBeGreaterThan(base.score);
    expect(supported.reason_codes).toContain('sleep_signal_supportive');
    expect(supported.reason_codes).toContain('nutrition_signal_supportive');
  });

  it('leaves the score unchanged when sleep and diet are unknown', () => {
    const base = generateMovementReadinessSignal({ summary: summary() });
    const unknown = generateMovementReadinessSignal({
      summary: summary(),
      sleep_signal: 'unknown',
      nutrition_signal: 'unknown'
    });

    expect(unknown.score).toBe(base.score);
  });
});
