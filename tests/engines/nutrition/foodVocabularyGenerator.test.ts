import { describe, expect, it } from 'vitest';

// A build script, deliberately plain JS and outside the app's module graph.
import { descriptionToTerms, isAdmissibleTerm, isBrandedDescription, readGeneratedTerms } from '../../../scripts/build-food-vocabulary.mjs';
import { GENERATED_FOOD_VOCABULARY } from '../../../src/engines/nutrition/productScoring/generatedFoodVocabulary';

/**
 * The generator's parsing, tested apart from its fetching.
 *
 * `npm run vocab:build` reads ten thousand USDA descriptions and nobody will check the
 * output line by line, so the failure mode is silent: a parser that yields "snap" from
 * "Beans, snap, green, raw" teaches the table a word that matches anything, and a parser
 * that lets "Cake, chocolate, prepared" through teaches it that cake is a whole food.
 * These are real USDA description strings and the shapes they come in.
 */

describe('USDA description parsing', () => {
  it('takes the food out of a narrowing description', () => {
    expect(descriptionToTerms('Eggplant, raw', 'Vegetables and Vegetable Products')).toEqual(['eggplant']);
    expect(descriptionToTerms('Fish, salmon, Atlantic, farmed, raw', 'Finfish and Shellfish Products')).toEqual(['salmon']);
    expect(descriptionToTerms('Cheese, cheddar', 'Dairy and Egg Products')).toEqual(['cheddar']);
    expect(descriptionToTerms('Bottle gourd (calabash), raw', 'Vegetables and Vegetable Products')).toEqual(['bottle gourd']);
  });

  it('keeps the form and the bare name, since a label may say either', () => {
    expect(descriptionToTerms('Spices, cumin seed', 'Spices and Herbs')).toEqual(['cumin seed', 'cumin']);
    expect(descriptionToTerms('Nuts, cashew nuts, raw', 'Nut and Seed Products')).toEqual(['cashew nuts', 'cashew']);
  });

  it('attaches a qualifier to what it qualifies rather than emitting it alone', () => {
    // "snap" on its own would match any ingredient containing the word.
    expect(descriptionToTerms('Beans, snap, green, raw', 'Vegetables and Vegetable Products')).toEqual(['snap beans']);
  });

  it('refuses categories that hold products rather than foods', () => {
    expect(descriptionToTerms('Cake, chocolate, prepared', 'Sweets')).toEqual([]);
    expect(descriptionToTerms('Oil, olive, salad or cooking', 'Fats and Oils')).toEqual([]);
    expect(descriptionToTerms('Beverages, tea, green, brewed', 'Beverages')).toEqual([]);
    expect(descriptionToTerms('Cereals ready-to-eat, frosted flakes', 'Breakfast Cereals')).toEqual([]);
  });

  it('accepts the category as USDA sends it, object or string', () => {
    expect(descriptionToTerms('Kale, raw', { description: 'Vegetables and Vegetable Products' })).toEqual(['kale']);
    expect(descriptionToTerms('Candies, milk chocolate', { description: 'Sweets' })).toEqual([]);
  });

  it('drops descriptions with nothing usable in them', () => {
    expect(descriptionToTerms('', 'Vegetables and Vegetable Products')).toEqual([]);
    expect(descriptionToTerms('raw', 'Vegetables and Vegetable Products')).toEqual([]);
  });
});

/**
 * The run that shipped Burger King as a food.
 *
 * Every test above passes a category, and the first real run showed the endpoint does not
 * deliver one the exclusion list recognises: brands, drinks, dishes and fats all came
 * through. These pass no category at all, which is the shape that actually arrives, so the
 * refusal has to come from the description and the term alone.
 */
describe('refusing products when no category arrives', () => {
  it('refuses what the first run let through', () => {
    for (const description of [
      'BURGER KING, french fries',
      'Beverages, ABBOTT NUTRITION, ENSURE, vanilla',
      'KRAFT, VELVEETA Pasteurized Process Cheese Spread',
      'Alcoholic beverage, beer, regular',
      'Margarine, regular, hard',
      'Syrups, maple',
      'Lasagna, cheese, frozen',
      'Candies, milk chocolate',
      'Sugars, granulated',
      'Salad dressing, ranch'
    ]) {
      expect(descriptionToTerms(description, undefined)).toEqual([]);
    }
  });
  it('still reads foods', () => {
    expect(descriptionToTerms('Eggplant, raw', undefined)).toEqual(['eggplant']);
    expect(descriptionToTerms('Abalone, mixed species, raw', undefined)).toEqual(['abalone']);
    expect(descriptionToTerms('Fish, salmon, Atlantic, farmed, raw', undefined)).toEqual(['salmon']);
  });
  it('recognises a brand the way USDA writes one', () => {
    expect(isBrandedDescription('BURGER KING, french fries')).toBe(true);
    expect(isBrandedDescription("McDONALD'S, Big Mac")).toBe(false); // mixed case: caught by the term rule instead
    expect(isBrandedDescription('Beef, ground, 80% lean, USDA commodity')).toBe(false);
    expect(isBrandedDescription('Eggplant, raw')).toBe(false);
  });
});

describe('what may be taught to the table as a food', () => {
  it.each([
    ['a brand', ['burger king', 'kraft', 'silk plain', 'pam cooking spray', 'pillsbury grands']],
    ['a restaurant in the possessive', ["mcdonald's", "wendy's", "campbell's chunky", "t.g.i. friday's", "udi's"]],
    ['a dish or product', ['lasagna', 'pizza rolls', 'ice cream sandwich', 'chewing gum', 'toaster pastries', 'ketchup', 'candies', 'crackers']],
    ['a drink', ['alcoholic beverage', 'toddler drink', 'cranberry juice cocktail', 'lemonade', 'apricot nectar']],
    ['an additive or processed fat', ['sugar', 'syrup', 'artificial flavor', 'margarine', 'shortening industrial', 'vegetable oil', 'soybean lecithin', 'pectin', 'gums']],
    ['a qualifier', ['mixed', 'plain', 'light', 'dry', 'fat', 'reduced sodium', 'gluten-free', 'restaurant', 'school lunch', 'human', 'boneless']],
    ['a USDA alternation or a cut parenthetical', ['hazelnuts or filberts', 'stew/soup', 'chickpeas (garbanzo']]
  ])('refuses %s', (_kind, terms) => {
    for (const term of terms) expect(isAdmissibleTerm(term), term).toBe(false);
  });

  it('keeps foods whose names contain a refused word', () => {
    for (const term of ['custard-apple', 'watercress', 'honeydew', 'breadfruit', 'cornsalad', "jew's ear", 'new zealand spinach', 'tart cherry', 'mixed nuts', 'applesauce', 'mustard greens', 'hearts of palm']) {
      expect(isAdmissibleTerm(term), term).toBe(true);
    }
  });

  it('holds the checked-in file to the current rule', () => {
    const refused = GENERATED_FOOD_VOCABULARY.filter((term) => !isAdmissibleTerm(term));
    expect(refused).toEqual([]);
  });

  it('reads a generated file back, apostrophes included', () => {
    expect(readGeneratedTerms("export const X = [\n  'abalone',\n  'jew\\'s ear',\n  'yam'\n];")).toEqual(['abalone', "jew's ear", 'yam']);
  });
});
