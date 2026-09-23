import { describe, expect, it } from 'vitest';
import { goalPatternRow, goalsRowCopy } from '../../../src/features/nutrition/goalPatternCopy';
import { estimateNutritionGoals, type GoalAnswers, type GoalPatternInput } from '../../../src/features/nutrition/nutritionGoalEngine';

const adult: GoalAnswers = { age: 30, heightCm: 175, weightKg: 75, equation: 'male', activity: 'light', goal: 'maintain', needsGuidance: 'no' };
const pattern = (label: GoalPatternInput['label'], confidence: GoalPatternInput['confidence'] = 'medium'): GoalPatternInput => ({ label, confidence });
const setupWith = (p?: GoalPatternInput | null) => estimateNutritionGoals(adult, '2026-09-10T12:00:00Z', p);

describe('the Food Pattern Test as it appears beside personalized goals', () => {
  it('invites the quiz when there is no pattern yet', () => {
    const row = goalPatternRow(null, null);
    expect(row.title).toBe('Take the Food Pattern Test');
    expect(row.stale).toBe(false);
  });
  it('says which way a pattern moves the split', () => {
    expect(goalPatternRow(pattern('protein_forward'), null).detail).toContain('more protein');
    expect(goalPatternRow(pattern('carb_supported'), null).detail).toContain('more carbohydrate');
  });
  it('admits when a pattern is moving nothing rather than implying it did', () => {
    expect(goalPatternRow(pattern('calibrating', 'high'), null).detail).toContain('calibrating');
    expect(goalPatternRow(pattern('protein_forward', 'low'), null).detail).toContain('calibrating');
    expect(goalPatternRow(pattern('evening_sensitive', 'high'), null).detail).toContain('meal rhythm');
  });
  it('flags saved goals built on a pattern that would now give a different split', () => {
    const saved = setupWith(pattern('protein_forward'));
    expect(goalPatternRow(pattern('carb_supported'), saved).stale).toBe(true);
    expect(goalsRowCopy(saved, true).detail).toContain('food pattern changed');
  });
  it('stays quiet about a change that would not move a number', () => {
    const saved = setupWith(pattern('protein_forward'));
    expect(goalPatternRow(pattern('protein_forward', 'high'), saved).stale).toBe(false);
    expect(goalPatternRow(pattern('steady_balanced', 'high'), setupWith(pattern('evening_sensitive', 'high'))).stale).toBe(false);
    expect(goalPatternRow(pattern('protein_forward', 'low'), setupWith(null)).stale).toBe(false);
  });
  it('never calls a referral out of date, because it has no split to be out of date', () => {
    const referred = estimateNutritionGoals({ ...adult, needsGuidance: 'yes' }, '2026-09-10T12:00:00Z');
    expect(goalPatternRow(pattern('protein_forward'), referred).stale).toBe(false);
    expect(goalsRowCopy(referred, false).title).toBe('Your nutrition setup');
  });
  it('keeps the copy free of clinical claims', () => {
    for (const label of ['steady_balanced', 'protein_forward', 'carb_supported', 'lighter_frequent', 'evening_sensitive', 'calibrating'] as const) {
      for (const confidence of ['low', 'medium', 'high'] as const) {
        const row = goalPatternRow(pattern(label, confidence), setupWith(pattern('carb_supported')));
        expect(`${row.title} ${row.detail}`).not.toMatch(/diagnos|treat|cure|prescrib|clinical|guaranteed|hormone|cortisol|primal|chek/i);
      }
    }
  });
});
