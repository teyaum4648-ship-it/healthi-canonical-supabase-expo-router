#!/usr/bin/env node
/**
 * Regenerates the food vocabulary from USDA FoodData Central.
 *
 * The role table began as a hand-written list, which meant its blind spots were
 * whoever wrote it: it knew broccoli and kale but not bok choy, zucchini but not bottle
 * gourd, and it could not place 58% of a 519-item checklist of ordinary foods. Curating
 * harder does not fix that — the next gap is always the one nobody thought of. So the
 * vocabulary comes from a food database instead.
 *
 * USDA publishes Foundation and SR Legacy as generic, unbranded foods, and as a work of
 * the US government the data is public domain: no attribution obligation, no share-alike,
 * safe to derive from and check in. That last part is why this reads USDA rather than
 * Open Food Facts, which is larger but carries ODbL share-alike on derived databases.
 *
 *   USDA_API_KEY=... npm run vocab:build
 *
 * A key is free from https://fdc.nal.usda.gov/api-key-signup.html. Output is written to
 * src/engines/nutrition/productScoring/generatedFoodVocabulary.ts; the curated list is
 * never touched, so a bad run degrades to the floor rather than below it.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const OUTPUT = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..', 'src', 'engines', 'nutrition', 'productScoring', 'generatedFoodVocabulary.ts'
);

/**
 * Categories whose members are products rather than foods. A description in one of
 * these is a recipe, a formulation or a brand, and admitting it would teach the table
 * to read "chocolate cake" as a whole food.
 */
const EXCLUDED_CATEGORIES = new Set([
  'baby foods', 'baked products', 'beverages', 'breakfast cereals',
  'fast foods', 'fats and oils', 'meals, entrees, and side dishes',
  'restaurant foods', 'snacks', 'soups, sauces, and gravies', 'sweets',
  'alcoholic beverages'
]);

/** Leading words that name a group rather than a food, so the useful term is the next one. */
const GROUP_HEADS = new Set([
  'spices', 'herbs', 'beans', 'nuts', 'seeds', 'cheese', 'fish', 'crustaceans',
  'mollusks', 'beef', 'pork', 'lamb', 'veal', 'game meat', 'poultry', 'chicken',
  'turkey', 'duck', 'milk', 'yogurt', 'cereals', 'grains', 'pasta', 'vegetables',
  'fruits', 'juice', 'oil', 'syrups', 'leavening agents', 'gelatin desserts'
]);

/** Words describing state or preparation rather than identity. */
const PREPARATION = new Set([
  'raw', 'cooked', 'boiled', 'steamed', 'baked', 'broiled', 'roasted', 'grilled',
  'fried', 'stewed', 'braised', 'canned', 'frozen', 'dried', 'dehydrated', 'fresh',
  'drained', 'undrained', 'unprepared', 'prepared', 'ready-to-eat', 'ready to eat',
  'with salt', 'without salt', 'salted', 'unsalted', 'sweetened', 'unsweetened',
  'enriched', 'unenriched', 'fortified', 'bleached', 'unbleached', 'peeled',
  'unpeeled', 'sliced', 'chopped', 'diced', 'shredded', 'ground', 'whole',
  'solids and liquids', 'liquid', 'solids', 'all varieties', 'commodity',
  'includes usda commodity', 'year round average', 'unspecified'
]);

/** Form words that trail a name without changing which food it is. */
const TRAILING_FORMS = /\s+(seed|seeds|leaf|leaves|root|roots|bulb|nut|nuts|bean|beans|powder|flakes|meal|flour)$/;

/**
 * Words that qualify a food without being one. USDA narrows by them — "Beans, snap,
 * green, raw" — so taking the segment after the group header blindly yields "snap",
 * which is not a food and would match anything containing that word.
 */
const MODIFIERS = new Set([
  'snap', 'green', 'red', 'white', 'yellow', 'purple', 'black', 'brown', 'golden',
  'wild', 'sweet', 'sour', 'bitter', 'hot', 'mild', 'baby', 'young', 'mature',
  'large', 'small', 'giant', 'common', 'summer', 'winter', 'spring', 'italian',
  'spanish', 'french', 'chinese', 'japanese', 'mexican', 'atlantic', 'pacific'
]);

const isDiscardable = (segment) =>
  segment.length < 3
  || segment.length > 32
  || /\d/.test(segment)
  || /\b(?:and|with|without|from|style|flavored|flavoured|mix|blend|product|substitute|imitation|infant|formula)\b/.test(segment)
  || PREPARATION.has(segment);

/**
 * The food names carried by one USDA description.
 *
 * Descriptions read as a narrowing path — "Spices, cumin seed", "Fish, salmon, Atlantic,
 * farmed, raw" — so the identity is the first segment that is neither a group header nor
 * a preparation note. Exported for its own test, because the parsing is the part of this
 * script that can be wrong quietly.
 */
export function descriptionToTerms(description, foodCategory) {
  const category = String(foodCategory?.description ?? foodCategory ?? '').toLowerCase().trim();
  if (EXCLUDED_CATEGORIES.has(category)) return [];

  const segments = String(description ?? '')
    .toLowerCase()
    .split(',')
    .map((segment) => segment.replace(/\(.*?\)/g, ' ').replace(/\s+/g, ' ').trim());

  if (segments.length === 0) return [];

  const usable = segments.filter((segment) => !isDiscardable(segment));
  if (usable.length === 0) return [];

  const head = usable[0];
  const grouped = GROUP_HEADS.has(head) && usable.length > 1;
  let identity = grouped ? usable[1] : head;
  if (!identity || GROUP_HEADS.has(identity)) return [];

  // A qualifier only means something attached to what it qualifies: snap -> snap beans.
  if (grouped && MODIFIERS.has(identity)) identity = `${identity} ${head}`;
  if (MODIFIERS.has(identity)) return [];

  const terms = new Set([identity]);
  const stripped = identity.replace(TRAILING_FORMS, '').trim();
  if (stripped.length >= 3 && stripped !== identity && !MODIFIERS.has(stripped)) terms.add(stripped);
  return [...terms];
}

async function fetchFoods(apiKey) {
  const collected = [];
  for (const dataType of ['Foundation', 'SR Legacy']) {
    for (let pageNumber = 1; pageNumber <= 60; pageNumber += 1) {
      const url = new URL('https://api.nal.usda.gov/fdc/v1/foods/list');
      url.searchParams.set('api_key', apiKey);
      url.searchParams.set('dataType', dataType);
      url.searchParams.set('pageSize', '200');
      url.searchParams.set('pageNumber', String(pageNumber));

      const response = await fetch(url);
      if (!response.ok) throw new Error(`USDA responded ${response.status} for ${dataType} page ${pageNumber}`);
      const page = await response.json();
      if (!Array.isArray(page) || page.length === 0) break;
      collected.push(...page);
      process.stdout.write(`\r${dataType}: ${collected.length} foods`);
    }
    process.stdout.write('\n');
  }
  return collected;
}

function render(terms) {
  const body = terms.map((term) => `  '${term.replace(/'/g, "\\'")}'`).join(',\n');
  return `/**
 * Food names generated from USDA FoodData Central by scripts/build-food-vocabulary.mjs.
 *
 * Do not edit by hand — run \`npm run vocab:build\` with USDA_API_KEY set. USDA
 * Foundation and SR Legacy are works of the US government and therefore public domain,
 * which is why this data can be checked in without an attribution or share-alike
 * obligation.
 *
 * Nothing here can lower a score. These names are consulted only after every hand rule
 * has missed, and can move an ingredient from unrecognised to food and nowhere else.
 *
 * Generated ${new Date().toISOString().slice(0, 10)} from ${terms.length} food names.
 */
export const GENERATED_FOOD_VOCABULARY: readonly string[] = [
${body}
];
`;
}

async function main() {
  const apiKey = process.env.USDA_API_KEY;
  if (!apiKey) {
    console.error('USDA_API_KEY is not set. Get a free key at https://fdc.nal.usda.gov/api-key-signup.html');
    process.exit(1);
  }

  const foods = await fetchFoods(apiKey);
  const terms = new Set();
  for (const food of foods) {
    for (const term of descriptionToTerms(food.description, food.foodCategory)) terms.add(term);
  }

  const sorted = [...terms].sort();
  fs.writeFileSync(OUTPUT, render(sorted));
  console.log(`Wrote ${sorted.length} food names to ${path.relative(process.cwd(), OUTPUT)}`);
  console.log('Now run: npm run lexicon:coverage');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  await main();
}
