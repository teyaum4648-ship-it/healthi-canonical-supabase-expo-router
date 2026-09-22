import { describe, expect, it } from 'vitest';

// A build script, deliberately plain JS and outside the app's module graph.
import { descriptionToTerms } from '../../../scripts/build-food-vocabulary.mjs';

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
