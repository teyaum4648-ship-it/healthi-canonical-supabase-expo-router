import { describe, expect, it } from 'vitest';
import { coreIngredientName, isVocabularyFood } from '../../../src/engines/nutrition/productScoring/foodVocabulary';
import { ingredientReading } from '../../../src/engines/nutrition/productScoring/ingredientRoles';

/**
 * How generated names are allowed to match.
 *
 * Measured before this rule: of 84 ingredient names chosen to be suspicious, the USDA list
 * changed 29 readings and only 2 of the changes were right. The rest promoted additives
 * and packaged products — mixed tocopherols, whipped topping, ketchup, syrup, cooking
 * spray — from unrecognised to whole food. Curated terms may still match anywhere in a
 * name; generated ones only match an ingredient that is the food they name.
 */
describe('generated names match the ingredient, not a word inside it', () => {
  it('reduces a name to the food it names', () => {
    expect(coreIngredientName('Organic Dried Abalone (wild caught).')).toBe('abalone');
    expect(coreIngredientName('freeze-dried soursop')).toBe('soursop');
  });

  it('credits a food from the USDA list however the label dresses it', () => {
    for (const name of ['abalone', 'dried abalone', 'abalone (wild caught)', 'nopales', 'organic nopales', 'sapodilla', 'mangosteen', 'lingcod', 'sablefish', 'roselle', "jew's ear"]) {
      expect(ingredientReading(name).role, name).toBe('whole_food');
    }
  });

  it('does not credit a longer ingredient that merely contains one', () => {
    for (const name of ['abalone sauce', 'nopales powder', 'mangosteen extract']) {
      expect(isVocabularyFood(name), name).toBe(false);
    }
  });

  it('no longer promotes the additives and products the first list did', () => {
    for (const name of ['mixed tocopherols', 'dietetic sweetener', 'whipped topping', 'dessert topping', 'gums', 'malt', 'rennin', 'gelatins', 'syrup', 'candies', 'crackers', 'ketchup', 'mayonnaise', 'chewing gum', 'frostings', 'pam cooking spray', 'silk plain', 'reduced fat', 'low sodium', 'gluten-free', 'school lunch', 'restaurant', 'snack', 'mixed', 'plain', 'light', 'fat']) {
      expect(ingredientReading(name).role, name).not.toBe('whole_food');
    }
  });

  it('does not let a typo repair land on a name nobody vetted', () => {
    // "fixed" is one edit from "mixed"; "mangosteem" one from a generated-only fruit.
    expect(ingredientReading('fixed').role).not.toBe('whole_food');
    expect(ingredientReading('mangosteem').role).not.toBe('whole_food');
  });
});
