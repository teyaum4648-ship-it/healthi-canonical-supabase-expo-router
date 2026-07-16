import { describe, expect, it } from 'vitest';

import { evaluateEveningCloseout } from '../../../src/features/eveningCloseout/eveningCloseoutModel';
import type { EveningCloseoutAnswers } from '../../../src/features/eveningCloseout/eveningCloseoutTypes';

const FORBIDDEN_TERMS = [
  'diagnosis', 'diagnose', 'treatment', 'cure', 'prescribe', 'prescription', 'rehab', 'rehabilitate',
  'injury treatment', 'clinical', 'medical decision', 'dysfunction', 'dysregulated', 'adrenal', 'hpa',
  'cortisol', 'hormone', 'detox', 'cleanse', 'toxic', 'bad food', 'bad body', 'bad movement',
  'cheat meal', 'guilt-free', 'metabolic type', 'metabolic typing', 'chek', 'c.h.e.k', 'hlc',
  '4 doctors', 'primal pattern', 'work-in', 'whoop strain', 'scout score', 'bobby approved',
  'fitbod', 'strong app', 'lazy', 'failure'
];

const DATE = '2026-07-15';

describe('evaluateEveningCloseout', () => {
  it('reads a fully positive closeout as followed and supported', () => {
    const answers: EveningCloseoutAnswers = {
      followed_plan: 'yes',
      body_response: 'better',
      movement_discomfort: 'no',
      digestion: 'comfortable',
      caffeine_after_cutoff: 'no',
      outdoor_light_or_walk: 'yes'
    };
    const result = evaluateEveningCloseout(DATE, answers);
    expect(result.adherence_label).toBe('followed');
    expect(result.response_label).toBe('supported');
    expect(result.confidence).toBe('high');
    expect(result.safety_flags).toHaveLength(0);
  });

  it('reads a partial closeout as partial without shame language', () => {
    const result = evaluateEveningCloseout(DATE, { followed_plan: 'partly', body_response: 'same' });
    expect(result.adherence_label).toBe('partial');
    const output = JSON.stringify(result).toLowerCase();
    for (const term of FORBIDDEN_TERMS) {
      expect(output).not.toContain(term);
    }
  });

  it('creates a next-day movement caution and safety flag when pain is reported', () => {
    const result = evaluateEveningCloseout(DATE, { movement_discomfort: 'pain' });
    expect(result.safety_flags).toContain('movement_pain_reported');
    expect(result.response_label).toBe('needs_attention');
    expect(result.next_day_adjustments.some((a) => a.domain === 'movement_capacity')).toBe(true);
  });

  it('creates a rhythm adjustment when caffeine landed after the cutoff', () => {
    const result = evaluateEveningCloseout(DATE, { caffeine_after_cutoff: 'yes' });
    expect(result.reason_codes).toContain('caffeine_after_cutoff');
    expect(result.next_day_adjustments.some((a) => a.domain === 'recovery_rhythm')).toBe(true);
  });

  it('creates a nourishment adjustment when digestion was off', () => {
    const result = evaluateEveningCloseout(DATE, { digestion: 'off' });
    expect(result.reason_codes).toContain('digestion_off');
    expect(result.next_day_adjustments.some((a) => a.domain === 'nourishment')).toBe(true);
  });

  it('lowers confidence when answers are missing', () => {
    const sparse = evaluateEveningCloseout(DATE, {});
    const full = evaluateEveningCloseout(DATE, {
      followed_plan: 'yes',
      body_response: 'better',
      movement_discomfort: 'no',
      digestion: 'comfortable',
      caffeine_after_cutoff: 'no',
      outdoor_light_or_walk: 'yes'
    });
    expect(sparse.confidence).toBe('low');
    expect(full.confidence).toBe('high');
  });

  it('stays serializable', () => {
    const result = evaluateEveningCloseout(DATE, { followed_plan: 'no', movement_discomfort: 'mild_discomfort' });
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
  });

  it('does not use forbidden or shaming language on a missed day', () => {
    const result = evaluateEveningCloseout(DATE, { followed_plan: 'no', body_response: 'lower_energy' });
    const output = JSON.stringify(result).toLowerCase();
    for (const term of FORBIDDEN_TERMS) {
      expect(output).not.toContain(term);
    }
  });
});
