import { describe, expect, it } from 'vitest';

import {
  readOpenFoodFactsMicronutrients,
  readUsdaMicronutrients
} from '../../../src/features/nutrition/productLookup/micronutrientReaders';

/**
 * Reading the panel, and refusing to guess at it.
 *
 * The dangerous failure here is not a missing row. It is a number off by a factor of a
 * thousand shown under a heading that says "honestly reported" — milligrams of selenium
 * read as micrograms, a vitamin C figure that says a tin of beans holds thirty days'
 * worth. Both readers therefore require the payload to state its own unit, and a value
 * that survives conversion still has to be plausible per 100 g before it is kept.
 */

const usdaRow = (nutrientId: number, value: number, unitName: string) => ({ nutrientId, value, unitName });

describe('reading the USDA panel', () => {
  it('reads the nutrients the food reported', () => {
    const amounts = readUsdaMicronutrients([
      usdaRow(1162, 53.2, 'MG'),   // vitamin C
      usdaRow(1087, 120, 'MG'),    // calcium
      usdaRow(1190, 58, 'UG')      // folate
    ]);
    expect(amounts.vitamin_c).toBeCloseTo(53.2, 6);
    expect(amounts.calcium).toBeCloseTo(120, 6);
    expect(amounts.folate).toBeCloseTo(58, 6);
  });

  it('converts into the unit the panel is defined in', () => {
    // Selenium is tracked in micrograms; a milligram figure has to come down by 1000.
    expect(readUsdaMicronutrients([usdaRow(1103, 0.055, 'MG')]).selenium).toBeCloseTo(55, 6);
    // Vitamin C is tracked in milligrams; a gram figure has to come up.
    expect(readUsdaMicronutrients([usdaRow(1162, 0.09, 'G')]).vitamin_c).toBeCloseTo(90, 6);
  });

  it('skips a row that does not say what unit it is in', () => {
    expect(readUsdaMicronutrients([usdaRow(1162, 53.2, '')]).vitamin_c).toBeUndefined();
    expect(readUsdaMicronutrients([{ nutrientId: 1162, value: 53.2 }]).vitamin_c).toBeUndefined();
  });

  it('skips a row whose unit it does not recognise', () => {
    // International units are not interchangeable with mass without knowing the compound.
    expect(readUsdaMicronutrients([usdaRow(1114, 400, 'IU')]).vitamin_d).toBeUndefined();
  });

  it('refuses an implausible amount rather than printing it', () => {
    // 90 g of vitamin C per 100 g is a unit error wearing a number's clothes.
    expect(readUsdaMicronutrients([usdaRow(1162, 90, 'G')]).vitamin_c).toBeUndefined();
  });

  it('leaves untracked nutrients alone and survives a junk payload', () => {
    expect(readUsdaMicronutrients([usdaRow(1003, 12, 'G')])).toEqual({});
    expect(readUsdaMicronutrients(null)).toEqual({});
    expect(readUsdaMicronutrients('not an array')).toEqual({});
    expect(readUsdaMicronutrients([null, 7, usdaRow(1089, 2.1, 'MG')]).iron).toBeCloseTo(2.1, 6);
  });
});

describe('reading the Open Food Facts panel', () => {
  it('reads a nutrient that stated its unit', () => {
    const amounts = readOpenFoodFactsMicronutrients({
      'vitamin-c_100g': 32, 'vitamin-c_unit': 'mg',
      'iron_100g': 0.0021, 'iron_unit': 'g'
    });
    expect(amounts.vitamin_c).toBeCloseTo(32, 6);
    expect(amounts.iron).toBeCloseTo(2.1, 6);
  });

  it('skips a nutrient with no unit rather than assuming one', () => {
    // OFF's _100g values are not reliably in the unit a reader would expect, and the
    // companion _unit key is the only thing in the payload that settles it. A gap is
    // recoverable; a milligram read as a gram is not.
    expect(readOpenFoodFactsMicronutrients({ 'vitamin-c_100g': 32 }).vitamin_c).toBeUndefined();
  });

  it('survives a payload that is not a record', () => {
    expect(readOpenFoodFactsMicronutrients(null)).toEqual({});
    expect(readOpenFoodFactsMicronutrients([1, 2, 3])).toEqual({});
  });
});
