import { describe, expect, it } from 'vitest';

import { ingredientReading } from '../../../src/engines/nutrition/productScoring/ingredientRoles';
import { repairTowardFood } from '../../../src/engines/nutrition/productScoring/ingredientAliases';
import { isVocabularyFood } from '../../../src/engines/nutrition/productScoring/foodVocabulary';
import { allTaxonomyFoods } from './foodTaxonomy';

/**
 * The vocabulary and the spelling repair exist to rescue food the table could not
 * place. Neither is allowed to do anything else.
 *
 * This matters more than it sounds. The vocabulary is about to be regenerated from ten
 * thousand USDA food descriptions by a script nobody will read line by line, so the
 * guarantee cannot be "we checked the list". It has to be structural: the rules run
 * first and alone, and a name they place is never reconsidered. These tests pin that.
 */

/** Judgments the rules make that no fallback may overturn. */
const RULE_JUDGMENTS: Array<[string, string]> = [
  ['palm kernel oil', 'industrial_fat'],
  ['partially hydrogenated soybean oil', 'industrial_fat'],
  ['paprika extract', 'color'],
  ['caramel color', 'color'],
  ['cocoa butter', 'culinary_fat'],
  ['extra virgin olive oil', 'culinary_fat'],
  ['soybean oil', 'seed_oil'],
  ['vegetable oil blend', 'seed_oil'],
  ['high fructose corn syrup', 'added_sugar'],
  ['brown rice syrup', 'added_sugar'],
  ['honey', 'added_sugar'],
  ['maltodextrin', 'refined_starch'],
  ['modified corn starch', 'refined_starch'],
  ['tapioca starch', 'refined_starch'],
  ['whey protein isolate', 'isolate'],
  ['pea protein', 'isolate'],
  ['natural flavors', 'flavor_system'],
  ['sodium benzoate', 'preservative'],
  ['carrageenan', 'texturizer'],
  ['soy lecithin', 'texturizer'],
  ['sucralose', 'high_intensity_sweetener'],
  ['erythritol', 'sugar_alcohol'],
  ['ascorbic acid', 'fortificant'],
  ['sea salt', 'neutral'],
  ['filtered water', 'neutral']
];

/** Additives with no business being read as food, however the fallbacks are tuned. */
const NOT_FOOD = [
  'sodium caseinate', 'disodium inosinate', 'disodium guanylate', 'polysorbate 80',
  'titanium dioxide', 'propylene glycol', 'sodium aluminum phosphate', 'tbhq',
  'calcium disodium edta', 'dimethylpolysiloxane', 'azodicarbonamide',
  'potassium bromate', 'butylated hydroxyanisole', 'red 40 lake', 'yellow 6 lake'
];

describe('the recognition fallbacks stay inside their lane', () => {
  it('never overturns a judgment the rules already made', () => {
    for (const [name, role] of RULE_JUDGMENTS) {
      expect(`${name} -> ${ingredientReading(name).role}`).toBe(`${name} -> ${role}`);
    }
  });

  it('never reads an additive as food', () => {
    const misread = NOT_FOOD.filter((name) => ingredientReading(name).role === 'whole_food');
    expect(misread).toEqual([]);
  });

  it('only ever repairs a word toward a food name', () => {
    // The fuzzy pass is a guess, so its output is worthless unless it lands on food.
    // Anything it changes must be recognisable food afterwards; anything it cannot
    // help must come back untouched.
    for (const name of [...NOT_FOOD, 'xanthan gum', 'sodium metabisulfite', 'lecithin']) {
      const repaired = repairTowardFood(name);
      if (repaired !== name) expect(isVocabularyFood(repaired)).toBe(true);
    }
  });

  it('reads a jar of vegetables and spices as food, not as a mystery', () => {
    // The product class that started this: whole vegetables, one culinary oil and four
    // spices. Every name here is ordinary, and before the vocabulary existed most of
    // them came back unrecognised — which is how a jar of eggplant graded F.
    const label = [
      'eggplant', 'tomato', 'onion', 'garlic', 'sunflower oil', 'cumin',
      'coriander', 'tumeric', 'ginger', 'salt'
    ];
    const unplaced = label.filter((name) => ingredientReading(name).role === 'unknown');
    expect(unplaced).toEqual([]);
    expect(ingredientReading('tumeric').role).toBe('whole_food');
  });

  it('places every food on the checklist', () => {
    const unplaced = allTaxonomyFoods().filter((food) => ingredientReading(food).role === 'unknown');
    expect(unplaced).toEqual([]);
  });

  it('reads the singular of a food as readily as the plural', () => {
    // "tomatoes?" matched tomatoe and tomatoes but never tomato, so two of the most
    // common ingredients on a label went unrecognised. The audit found it; this pins it.
    for (const [singular, plural] of [
      ['tomato', 'tomatoes'], ['potato', 'potatoes'], ['peach', 'peaches'],
      ['cherry', 'cherries'], ['berry', 'berries'], ['sweet potato', 'sweet potatoes']
    ]) {
      expect(`${singular}:${ingredientReading(singular).role}`).toBe(`${singular}:${ingredientReading(plural).role}`);
      expect(ingredientReading(singular).role).not.toBe('unknown');
    }
  });
});
