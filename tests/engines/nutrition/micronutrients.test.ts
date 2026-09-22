import { describe, expect, it } from 'vitest';

import {
  MICRONUTRIENTS,
  MICRONUTRIENT_IDS,
  addMicronutrients,
  dailyValueFraction,
  formatMicronutrientAmount,
  micronutrientCoverage
} from '../../../src/engines/nutrition/micronutrients';

/**
 * The panel, and the one distinction it has to keep straight.
 *
 * A nutrient nobody reported is not a nutrient nobody ate. Every function here has to
 * preserve that difference, because the moment absence starts summing as zero the app is
 * telling people they got none of something when it simply could not read the label —
 * and the product rule is that missing data lowers confidence, never a result.
 */

describe('the tracked panel', () => {
  it('has no duplicate ids or provider keys', () => {
    // A duplicated USDA id would silently shadow one nutrient with another's value.
    expect(new Set(MICRONUTRIENT_IDS).size).toBe(MICRONUTRIENTS.length);
    expect(new Set(MICRONUTRIENTS.map((item) => item.usdaNutrientId)).size).toBe(MICRONUTRIENTS.length);
    expect(new Set(MICRONUTRIENTS.map((item) => item.offKey)).size).toBe(MICRONUTRIENTS.length);
  });

  it('gives every nutrient a usable reference amount and unit', () => {
    for (const definition of MICRONUTRIENTS) {
      expect(definition.dailyValue).toBeGreaterThan(0);
      expect(['g', 'mg', 'ug']).toContain(definition.unit);
      expect(definition.label.length).toBeGreaterThan(2);
    }
  });

  it('covers both vitamins and minerals', () => {
    const vitamins = MICRONUTRIENTS.filter((item) => item.group === 'vitamin');
    const minerals = MICRONUTRIENTS.filter((item) => item.group === 'mineral');
    expect(vitamins.length).toBeGreaterThanOrEqual(13);
    expect(minerals.length).toBeGreaterThanOrEqual(13);
  });

  it('leaves sodium to the macros so a day is not counted twice', () => {
    expect(MICRONUTRIENT_IDS).not.toContain('sodium');
  });
});

describe('absence versus zero', () => {
  it('counts only what was actually reported', () => {
    const coverage = micronutrientCoverage({ vitamin_c: 40, iron: 2 });
    expect(coverage.reported).toBe(2);
    expect(coverage.tracked).toBe(MICRONUTRIENTS.length);
    expect(coverage.fraction).toBeCloseTo(2 / MICRONUTRIENTS.length, 6);
  });

  it('treats a reported zero as reported', () => {
    // Zero grams of vitamin D on a label is a measurement. Silence is not.
    expect(micronutrientCoverage({ vitamin_d: 0 }).reported).toBe(1);
    expect(micronutrientCoverage({}).reported).toBe(0);
  });

  it('adds sparse sets without inventing zeroes', () => {
    const total = addMicronutrients({ vitamin_c: 30 }, { vitamin_c: 12, iron: 4 });
    expect(total.vitamin_c).toBe(42);
    expect(total.iron).toBe(4);
    expect(Object.keys(total)).not.toContain('folate');
  });

  it('ignores values that are not finite numbers', () => {
    const total = addMicronutrients({}, { vitamin_c: Number.NaN, iron: 3 } as Record<string, number>);
    expect(Object.keys(total)).toEqual(['iron']);
  });
});

describe('reading an amount', () => {
  it('gives a share of the day only when there is something to share', () => {
    expect(dailyValueFraction('vitamin_c', 45)).toBeCloseTo(0.5, 6);
    expect(dailyValueFraction('vitamin_c', null)).toBeNull();
    expect(dailyValueFraction('not_a_nutrient', 10)).toBeNull();
  });

  it('carries decimals only where the magnitude needs them', () => {
    expect(formatMicronutrientAmount('phosphorus', 1250)).toBe('1250 mg');
    expect(formatMicronutrientAmount('copper', 0.92)).toBe('0.92 mg');
    expect(formatMicronutrientAmount('selenium', 55)).toBe('55 µg');
    expect(formatMicronutrientAmount('vitamin_c', null)).toBeNull();
  });

  it('writes micrograms the way a label does', () => {
    expect(formatMicronutrientAmount('folate', 400)).toContain('µg');
    expect(formatMicronutrientAmount('folate', 400)).not.toContain('ug');
  });
});
