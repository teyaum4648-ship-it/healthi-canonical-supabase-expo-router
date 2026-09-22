import { describe, expect, it } from 'vitest';

import {
  micronutrientsForItems,
  micronutrientsForPortion
} from '../../../src/features/nutrition/micronutrientPortion';
import type { HealthiProductSnapshot } from '../../../src/features/nutrition/productLookup/productLookupTypes';

/**
 * One conversion, used by both ways of logging food.
 *
 * A product scanned straight into the diary and the same product added through the meal
 * builder have to produce the same numbers, or a day's totals depend on which button
 * somebody pressed. This exists so there is one place that can be wrong rather than two
 * that can disagree.
 */

const base: HealthiProductSnapshot = {
  barcode: '012345678905',
  provider: 'usda_food_data_central',
  provider_product_id: '1',
  name: 'Test food',
  brand: null,
  serving_size: '50 g',
  serving_quantity_g: 50,
  calories_per_serving: 100,
  ingredients_text: null,
  quality_flags: [],
  confidence: 'high',
  reason_codes: [],
  nutriments_per_100g: { micronutrients: { vitamin_c: 60, iron: 4 } }
} as HealthiProductSnapshot;

describe('one portion', () => {
  it('scales per 100 g onto the mass actually eaten', () => {
    expect(micronutrientsForPortion(base, 1)!.vitamin_c).toBeCloseTo(30, 3);
    expect(micronutrientsForPortion(base, 2)!.vitamin_c).toBeCloseTo(60, 3);
  });

  it('gives nothing when the portion mass is unknown', () => {
    expect(micronutrientsForPortion({ ...base, serving_quantity_g: null }, 1)).toBeNull();
  });

  it('gives nothing for a nonsensical serving count', () => {
    expect(micronutrientsForPortion(base, 0)).toBeNull();
    expect(micronutrientsForPortion(base, -1)).toBeNull();
    expect(micronutrientsForPortion(base, Number.NaN)).toBeNull();
  });

  it('gives nothing when the product carried no panel', () => {
    expect(micronutrientsForPortion({ ...base, nutriments_per_100g: {} }, 1)).toBeNull();
  });
});

describe('a meal of several foods', () => {
  it('sums the items that reported a panel', () => {
    const total = micronutrientsForItems([
      { snapshot: base, servings: 1 },
      { snapshot: base, servings: 1 }
    ])!;
    expect(total.vitamin_c).toBeCloseTo(60, 3);
    expect(total.iron).toBeCloseTo(4, 3);
  });

  it('carries the items that reported one past the items that did not', () => {
    // A meal with one unreadable item is not a meal with no vitamins.
    const total = micronutrientsForItems([
      { snapshot: base, servings: 1 },
      { snapshot: { ...base, nutriments_per_100g: {} }, servings: 1 }
    ])!;
    expect(total.vitamin_c).toBeCloseTo(30, 3);
  });

  it('gives nothing when no item reported a panel', () => {
    expect(micronutrientsForItems([{ snapshot: { ...base, nutriments_per_100g: {} }, servings: 1 }])).toBeNull();
    expect(micronutrientsForItems([])).toBeNull();
  });

  it('agrees with the single-portion path, so the route taken does not change the day', () => {
    const viaBuilder = micronutrientsForItems([{ snapshot: base, servings: 1.5 }])!;
    const viaScan = micronutrientsForPortion(base, 1.5)!;
    expect(viaBuilder).toEqual(viaScan);
  });
});
