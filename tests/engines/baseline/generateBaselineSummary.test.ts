import { describe, expect, it } from 'vitest';

import { generateBaselineSummary } from '../../../src/engines/baseline';

const profile = { display_name: 'Taylor', goal: 'sleep_optimization', baseline_mode: 'restore' as const };
const onboarding = { completed: true, baseline_profile: { primary_goal: 'sleep_optimization', hydration_target_ml: 2600 } };

describe('generateBaselineSummary', () => {
  it('returns needs setup when profile details are missing', () => {
    const result = generateBaselineSummary({});

    expect(result.status).toBe('needs_setup');
    expect(result.confidence).toBe('low');
    expect(result.next_steps[0]?.id).toBe('complete_setup');
  });

  it('keeps a completed profile with sparse coverage calibrating', () => {
    const result = generateBaselineSummary({
      profile,
      onboarding,
      dataCoverage: { recovery_rhythm_days: 2, nourishment_days: 1 }
    });

    expect(result.status).toBe('calibrating');
    expect(result.confidence).toBe('low');
    expect(result.calibration.domains.find((domain) => domain.domain === 'recovery_rhythm')?.status).toBe('calibrating');
  });

  it('returns ready when multiple domains have coverage', () => {
    const result = generateBaselineSummary({
      profile,
      onboarding,
      dataCoverage: {
        recovery_rhythm_days: 8,
        nourishment_days: 5,
        movement_capacity_days: 4,
        mind_life_load_days: 0,
        readiness_days: 0
      },
      currentSignals: { food_pattern_label: 'steady_balanced', rhythm_confidence: 'medium' }
    });

    expect(result.status).toBe('ready');
    expect(result.confidence).toBe('medium');
    expect(result.profile_cards.map((card) => card.id)).toEqual(expect.arrayContaining(['goal', 'mode', 'food_pattern', 'rhythm']));
  });

  it('maps coverage into clear domain statuses', () => {
    const result = generateBaselineSummary({
      profile,
      onboarding,
      dataCoverage: { recovery_rhythm_days: 7, nourishment_days: 3, movement_capacity_days: 0 }
    });

    expect(result.calibration.domains.find((domain) => domain.domain === 'recovery_rhythm')?.status).toBe('ready');
    expect(result.calibration.domains.find((domain) => domain.domain === 'nourishment')?.status).toBe('partial');
    expect(result.calibration.domains.find((domain) => domain.domain === 'movement_capacity')?.status).toBe('calibrating');
  });

  it('preserves a supplied guided mode without escalating its meaning', () => {
    const result = generateBaselineSummary({
      profile: { ...profile, baseline_mode: 'professional_guidance' },
      onboarding
    });

    expect(result.profile_cards.find((card) => card.id === 'mode')?.value).toBe('Guided');
  });

  it('returns serializable output with practical next steps and reason codes', () => {
    const result = generateBaselineSummary({ profile, onboarding, source_label: 'logged' });

    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
    expect(result.reason_codes.length).toBeGreaterThan(0);
    expect(result.next_steps.every((step) => step.reason_codes.length > 0)).toBe(true);
  });
});
