import { describe, expect, it } from 'vitest';

import { reviewSafetySignals } from '../../../src/engines/safety';
import type { SafetyReviewInput } from '../../../src/engines/safety';

const FORBIDDEN_TERMS = [
  'diagnosis', 'diagnose', 'treatment', 'cure', 'prescribe', 'prescription', 'rehab', 'rehabilitate',
  'injury treatment', 'clinical', 'medical decision', 'dysfunction', 'dysregulated', 'adrenal', 'hpa',
  'cortisol', 'hormone', 'detox', 'cleanse', 'toxic', 'bad food', 'bad body', 'bad movement',
  'cheat meal', 'guilt-free', 'metabolic type', 'metabolic typing', 'chek', 'c.h.e.k', 'hlc',
  '4 doctors', 'primal pattern', 'work-in', 'whoop strain', 'scout score', 'bobby approved',
  'fitbod', 'strong app'
];

function expectNoForbiddenLanguage(value: unknown): void {
  const output = JSON.stringify(value).toLowerCase();
  for (const term of FORBIDDEN_TERMS) {
    expect(output).not.toContain(term);
  }
}

describe('reviewSafetySignals', () => {
  it('returns clear or caution with low confidence and missing data on empty input', () => {
    const result = reviewSafetySignals({});
    expect(['clear', 'caution']).toContain(result.status);
    expect(result.confidence).toBe('low');
    expect(result.missing_data.length).toBeGreaterThan(0);
    expect(result.training_allowed).toBe(true);
  });

  it('routes an explicit serious user-reported flag to professional_guidance', () => {
    const result = reviewSafetySignals({ userReportedFlags: { chest_pain: true } });
    expect(result.status).toBe('professional_guidance');
    expect(result.training_allowed).toBe(false);
    expect(result.progression_allowed).toBe(false);
    expect(result.reason_codes).toContain('flagged_for_professional_guidance');
  });

  it('limits training and progression when movement pain is present', () => {
    const result = reviewSafetySignals({ movement: { pain_present: true } });
    expect(result.status).toBe('limit_guidance');
    expect(result.training_allowed).toBe(false);
    expect(result.progression_allowed).toBe(false);
    expect(result.reason_codes).toContain('movement_pain_reported');
  });

  it('returns caution (not professional_guidance) for low hydration or under-fueled', () => {
    const hydration = reviewSafetySignals({ nourishment: { hydration_low: true, nutrition_readiness_label: 'watch' } });
    expect(hydration.status).toBe('caution');
    expect(hydration.status).not.toBe('professional_guidance');

    const underFueled = reviewSafetySignals({ nourishment: { under_fueled: true, nutrition_readiness_label: 'watch' } });
    expect(underFueled.status).toBe('caution');
    expect(underFueled.status).not.toBe('professional_guidance');
    expect(underFueled.progression_allowed).toBe(false);
  });

  it('lowers progression support when sleep is poor', () => {
    const result = reviewSafetySignals({ recoveryRhythm: { poor_sleep_quality: true } });
    expect(result.status).toBe('caution');
    expect(result.progression_allowed).toBe(false);
    expect(result.training_allowed).toBe(true);
    expect(result.reason_codes).toContain('poor_sleep_quality');
  });

  it('lowers confidence when data is missing', () => {
    const sparse = reviewSafetySignals({ readiness: { score: 70 } });
    const richer = reviewSafetySignals({
      readiness: { score: 70, label: 'steady', confidence: 'high' },
      movement: { discomfort_level: 'none', movement_readiness_label: 'steady_maintenance' },
      nourishment: { hydration_low: false, nutrition_readiness_label: 'supportive' },
      recoveryRhythm: { sleep_debt_minutes: 20, poor_sleep_quality: false }
    });
    expect(sparse.confidence).toBe('low');
    expect(richer.confidence).not.toBe('low');
  });

  it('always includes reason codes and stays serializable', () => {
    const result = reviewSafetySignals({ movement: { soreness_level: 8 } });
    expect(result.reason_codes.length).toBeGreaterThan(0);
    expect(() => JSON.stringify(result)).not.toThrow();
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
  });

  it('does not use forbidden language across representative outputs', () => {
    const inputs: SafetyReviewInput[] = [
      {},
      { userReportedFlags: { severe_low_mood_or_self_harm_signal: true } },
      { movement: { pain_present: true }, nourishment: { under_fueled: true } },
      { readiness: { score: 20, label: 'restore' }, mindLifeLoad: { life_load_level: 'high' } }
    ];
    for (const input of inputs) {
      expectNoForbiddenLanguage(reviewSafetySignals(input));
    }
  });
});
