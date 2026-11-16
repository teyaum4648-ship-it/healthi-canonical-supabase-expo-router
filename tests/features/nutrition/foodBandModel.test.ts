import { describe, expect, it } from 'vitest';

import { energyLine, foodHeadline, intakeBars } from '../../../src/features/nutrition/foodBandModel';

const noTargets = { calories_target: null, protein_g_target: null, carbs_g_target: null, fat_g_target: null };
const targets = { calories_target: 2000, protein_g_target: 120, carbs_g_target: 220, fat_g_target: 70 };

describe('the Food band', () => {
  it('fills each bar against the working target and marks where the target sits', () => {
    const [energy, protein] = intakeBars({ calories: 1000, protein_g: 138, carbs_g: null, fat_g: 20 }, targets);
    expect(energy).toMatchObject({ value: '1,000 kcal', target: 'of 2,000 kcal' });
    expect(energy!.fill).toBeCloseTo(1000 / 2300, 5);
    expect(energy!.targetMark).toBeCloseTo(1 / 1.15, 5);
    // Over target: the bar grows to the amount, so the overshoot is visible, not clipped.
    expect(protein!.fill).toBe(1);
    expect(protein!.targetMark).toBeCloseTo(120 / 138, 5);
  });

  it('shows a missing value as not logged, never as zero', () => {
    const carbs = intakeBars({ calories: 1000, protein_g: 30, carbs_g: null, fat_g: 20 }, targets)[2]!;
    expect(carbs).toMatchObject({ value: 'Not logged', fill: null });
  });

  it('draws nothing to fill against when no target is set', () => {
    for (const bar of intakeBars({ calories: 520, protein_g: 31, carbs_g: null, fat_g: null }, noTargets)) {
      expect(bar.fill).toBeNull();
      expect(bar.targetMark).toBeNull();
      expect(bar.target).toBe('No target set');
    }
  });

  it('counts the diary, for today or another day', () => {
    expect(foodHeadline(0, true, 'Monday')).toBe('Nothing logged today yet.');
    expect(foodHeadline(1, true, 'Monday')).toBe('1 meal logged today.');
    expect(foodHeadline(3, false, 'Sunday')).toBe('3 meals logged on Sunday.');
  });

  it('keeps the intake summary’s own words', () => {
    expect(energyLine({ calories: null, reason_codes: [] }, 2000)).toBe('Log a food to begin.');
    expect(energyLine({ calories: 1500, reason_codes: [] }, 2000)).toBe('500 kcal to your working target.');
    expect(energyLine({ calories: 2300, reason_codes: [] }, 2000)).toBe('300 kcal above your working target.');
    expect(energyLine({ calories: 1500, reason_codes: ['partial_nutrition_data'] }, 2000)).toMatch(/partial/);
    expect(energyLine({ calories: 520, reason_codes: [] }, null)).toMatch(/^No working calorie target set/);
  });
});
