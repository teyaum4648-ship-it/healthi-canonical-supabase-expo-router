import { describe, expect, it } from 'vitest';
import { ingredientReading } from '../../../src/engines/nutrition/productScoring/ingredientRoles';

/**
 * A food named with a fraction after it is the fraction.
 *
 * The whole-food rules match a food's name anywhere in an ingredient, so before the
 * fraction rules existed anything processed that no earlier rule named explicitly was
 * credited as the food it came from. Probed: 31 of 35 such names read as whole food —
 * fish oil, almond oil, apple juice concentrate, hydrolyzed vegetable protein, pea
 * starch, and every spice, herb and mushroom extract. The 52-product calibration corpus
 * contains none of them, which is why no report ever moved; these tests are the record.
 */
describe('fractions of a food are not the food', () => {
  it.each([
    ['isolate', ['hydrolyzed vegetable protein', 'vegetable protein', 'potato protein', 'rice protein', 'pea fiber', 'oat fiber', 'citrus fiber', 'vegetable fiber']],
    ['refined_starch', ['pea starch', 'wheat starch', 'mung bean starch']],
    ['sugar_alcohol', ['vegetable glycerin', 'glycerin']],
    ['texturizer', ['vegetable gum']],
    ['flavor_system', ['spice extractives', 'spice extract', 'herb extract', 'ginger extract', 'mushroom extract', 'cinnamon extract', 'vanilla extract']],
    ['preservative', ['rosemary extract', 'green tea extract', 'mixed tocopherols']],
    ['added_sugar', ['malt extract', 'barley malt extract', 'apple juice concentrate', 'grape juice concentrate', 'pear juice concentrate']],
    ['color', ['carrot juice concentrate', 'beet juice concentrate']],
    ['seed_oil', ['almond oil', 'walnut oil', 'flaxseed oil', 'fish oil', 'pumpkin seed oil', 'mct oil']]
  ])('reads each as %s', (role, names) => {
    for (const name of names) expect(ingredientReading(name).role, name).toBe(role);
  });

  it('leaves the foods themselves alone', () => {
    for (const name of [
      'almonds', 'almond flour', 'green peas', 'peas', 'spinach', 'vegetables', 'dehydrated vegetables',
      'garlic powder', 'onion powder', 'beet powder', 'spices', 'natural spices', 'herbs', 'sweet potatoes',
      'potatoes', 'potato flakes', 'chickpea flour', 'oat flour', 'tomato paste', 'vegetable broth',
      'cinnamon', 'ginger', 'turmeric', 'mushrooms', 'salmon', 'fish', 'cocoa', 'milk', 'apple juice',
      'whole wheat flour', 'rolled oats', 'black beans', 'pumpkin seeds', 'flaxseed', 'ground flaxseed', 'egg whites'
    ]) {
      expect(ingredientReading(name).role, name).toBe('whole_food');
    }
  });

  it('keeps every specific rule ahead of the general ones', () => {
    // Each of these is named by an earlier rule and must not be re-read by the fraction block.
    expect(ingredientReading('yeast extract').role).toBe('isolate');
    expect(ingredientReading('paprika extract').role).toBe('color');
    expect(ingredientReading('stevia leaf extract').role).toBe('high_intensity_sweetener');
    expect(ingredientReading('modified corn starch').foodValue).toBe(0.4);
    expect(ingredientReading('vegetable oil').foodValue).toBe(0.32);
    expect(ingredientReading('extra virgin olive oil').role).toBe('culinary_fat');
    expect(ingredientReading('xanthan gum').role).toBe('texturizer');
    expect(ingredientReading('fruit juice concentrate').role).toBe('added_sugar');
  });
});

describe('nut and seed butters are the nut', () => {
  it('reads them as whole food rather than as butter', () => {
    for (const name of ['almond butter', 'peanut butter', 'cashew butter', 'sunflower seed butter', 'sesame butter']) {
      expect(ingredientReading(name).role, name).toBe('whole_food');
    }
  });
  it('still reads butter and cocoa butter as fats', () => {
    expect(ingredientReading('butter').role).toBe('culinary_fat');
    expect(ingredientReading('cocoa butter').role).toBe('culinary_fat');
  });
});
