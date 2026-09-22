import { describe, expect, it } from 'vitest';

import {
  READINESS_BASELINE,
  contributionLabel,
  generateDailyReadiness,
  missingDomainPrompt,
  readinessLedgerSummary,
  type DailyReadinessDomain,
  type GenerateDailyReadinessInput
} from '../../../src/engines/readiness';

/**
 * The ledger.
 *
 * A readiness score that cannot be taken apart is a verdict, and a verdict about how
 * someone feels is worth very little. The engine has always computed each domain's
 * contribution and then dropped it at the type boundary, so the app could say "conserve"
 * and never "because you are three hours down on sleep". These tests hold the numbers to
 * the screen: whatever the ledger shows has to add up to the score the ring displays,
 * or the explanation is a story told about a number rather than a reading of it.
 */

const DATE = '2026-07-14';

const DOMAINS: DailyReadinessDomain[] = [
  'recovery_rhythm', 'nourishment', 'movement_capacity', 'mind_life_load'
];

const depleted: GenerateDailyReadinessInput = {
  date: DATE,
  rhythm: {
    sleep_duration_hours: 4.6,
    sleep_debt_hours: 3.4,
    energy_phase: 'afternoon_dip',
    confidence: 'high'
  },
  nutrition: { meal_count: 1, readiness_adjustment: -3, food_quality_label: 'watch', confidence: 'medium' },
  movement: { workout_count_7d: 6, total_minutes_7d: 400, training_load_label: 'high_frequency', readiness_label: 'lighter_day', confidence: 'high' },
  schedule: { block_count: 9, open_window_count: 0, confidence: 'medium' }
};

const rested: GenerateDailyReadinessInput = {
  date: DATE,
  rhythm: { sleep_duration_hours: 8.2, sleep_debt_hours: 0.1, energy_phase: 'morning_peak', confidence: 'high' },
  nutrition: { meal_count: 3, readiness_adjustment: 4, food_quality_label: 'supportive', food_response_label: 'steady', confidence: 'high' },
  movement: { workout_count_7d: 3, total_minutes_7d: 150, readiness_label: 'ready_to_build', confidence: 'high' },
  schedule: { block_count: 3, open_window_count: 3, confidence: 'high' }
};

describe('the readiness ledger adds up', () => {
  it('reconciles the drivers with the score the app shows', () => {
    for (const input of [depleted, rested]) {
      const result = generateDailyReadiness(input);
      const ledger = result.driver_cards.reduce((sum, driver) => sum + driver.contribution, 0);
      expect(result.baseline_score + ledger).toBe(result.raw_score);
      expect(result.score).toBe(Math.min(100, Math.max(0, result.raw_score)));
    }
  });

  it('says the ceiling out loud when a day is better than the scale', () => {
    // A strong day sums to 111 and shows 100. Without this the rows visibly add up to
    // a number the ring is not displaying, which reads as the app not knowing its own
    // arithmetic — worse than giving no explanation at all.
    const result = generateDailyReadiness(rested);
    expect(result.raw_score).toBeGreaterThan(100);
    expect(result.score).toBe(100);

    const summary = readinessLedgerSummary(result.baseline_score, result.score, result.raw_score);
    expect(summary).toContain('the scale stops at 100');
    expect(summary).not.toContain('up to 100');
  });

  it('carries a contribution for every domain, not just the ones that moved', () => {
    const result = generateDailyReadiness(depleted);
    expect(result.driver_cards.map((driver) => driver.domain).sort()).toEqual([...DOMAINS].sort());
    for (const driver of result.driver_cards) expect(Number.isFinite(driver.contribution)).toBe(true);
  });

  it('signs the contributions the way the day actually went', () => {
    const drained = generateDailyReadiness(depleted);
    const good = generateDailyReadiness(rested);
    const recovery = (result: ReturnType<typeof generateDailyReadiness>) =>
      result.driver_cards.find((driver) => driver.domain === 'recovery_rhythm')!.contribution;

    expect(recovery(drained)).toBeLessThan(0);
    expect(recovery(good)).toBeGreaterThan(0);
    expect(drained.score).toBeLessThan(good.score);
  });
});

describe('an empty day', () => {
  it('sits exactly on the baseline, because absence is not evidence of a bad day', () => {
    // The rule the product decided on: missing data lowers confidence, never the score.
    // If this ever fails, the app is punishing people for not having logged yet.
    const result = generateDailyReadiness({ date: DATE });
    expect(result.score).toBe(READINESS_BASELINE);
    expect(result.baseline_score).toBe(READINESS_BASELINE);
    expect(result.confidence).toBe('low');
    for (const driver of result.driver_cards) {
      expect(driver.missing).toBe(true);
      expect(driver.contribution).toBe(0);
    }
  });

  it('asks for the one thing that would fill each domain', () => {
    const result = generateDailyReadiness({ date: DATE });
    for (const driver of result.driver_cards) {
      expect(driver.detail).toBe(missingDomainPrompt(driver.domain));
      // A prompt that does not tell you what to add is the old copy with new words.
      expect(driver.detail.length).toBeGreaterThan(20);
    }
  });

  it('offers to be filled rather than reporting a zero', () => {
    for (const driver of generateDailyReadiness({ date: DATE }).driver_cards) {
      expect(contributionLabel(driver)).toBe('Add');
    }
  });
});

describe('how the ledger reads', () => {
  it('signs the points and uses a real minus, not a hyphen', () => {
    expect(contributionLabel({ contribution: 6, missing: false })).toBe('+6');
    expect(contributionLabel({ contribution: -15, missing: false })).toBe('−15');
    expect(contributionLabel({ contribution: 0, missing: false })).toBe('No change');
    expect(contributionLabel({ contribution: -15, missing: true })).toBe('Add');
  });

  it('says where the day started and where the signals took it', () => {
    expect(readinessLedgerSummary(70, 61)).toContain('70');
    expect(readinessLedgerSummary(70, 61)).toContain('61');
    expect(readinessLedgerSummary(70, 61)).toContain('down to');
    expect(readinessLedgerSummary(70, 82)).toContain('up to');
    expect(readinessLedgerSummary(70, 70)).toContain('left it there');
    expect(readinessLedgerSummary(70, 100, 111)).toContain('the scale stops at 100');
    expect(readinessLedgerSummary(70, 0, -5)).toContain('the scale stops at 0');
  });

  it('never uses language that reads as a diagnosis', () => {
    const copy = [
      readinessLedgerSummary(70, 61),
      ...DOMAINS.map((domain) => missingDomainPrompt(domain))
    ].join(' ').toLowerCase();
    for (const word of ['diagnos', 'treat', 'cure', 'prescri', 'clinical', 'guaranteed', 'deficien']) {
      expect(copy).not.toContain(word);
    }
  });
});
