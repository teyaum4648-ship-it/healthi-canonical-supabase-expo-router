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

/*
 * What the category check was supposed to keep out, checked on the term itself.
 *
 * The first real run showed why this has to exist. EXCLUDED_CATEGORIES keys on the
 * foodCategory field, and whatever /foods/list returned, no row matched a single
 * excluded category: the output carried Burger King, alcoholic beverage, lasagna,
 * margarine, syrup and "mixed" — every one of them from a category on that list. The
 * unit tests passed a category on every call, so they tested the API as it was assumed
 * to behave rather than as it did. A term check needs nothing from the response and
 * cannot go quiet the same way.
 *
 * It errs towards refusal. A real food refused here costs confidence, because the name
 * stays unrecognised; a non-food admitted here raises a score, because an additive starts
 * counting as a whole food. Those are not symmetric, so an ambiguous term goes.
 */

/** Words that make a term a dish, a packaged product or a drink rather than a food. */
const PRODUCT_WORDS = [
  'stew', 'stews', 'soup', 'soups', 'broth', 'pie', 'pies', 'pizza', 'pizzas', 'lasagna', 'casserole',
  'sandwich', 'sandwiches', 'burrito', 'burritos', 'taco', 'tacos', 'tamales', 'taquitos',
  'cake', 'cakes', 'cookie', 'cookies', 'candies', 'candy', 'candied', 'pudding', 'puddings',
  'dessert', 'desserts', 'gravy', 'sauce', 'sauces', 'dressing', 'dressings', 'spread', 'spreads',
  'topping', 'toppings', 'frosting', 'frostings', 'filling', 'fillings', 'filled', 'muffin',
  'muffins', 'dumpling', 'dumplings', 'hash', 'salad', 'salads', 'bagel', 'bagels', 'biscuit',
  'biscuits', 'bread', 'breads', 'roll', 'rolls', 'bun', 'buns', 'croissant', 'croissants',
  'crouton', 'croutons', 'cracker', 'crackers', 'pastry', 'pastries', 'dough', 'danish',
  'strudel', 'turnover', 'waffle', 'waffles', 'pancake', 'pancakes', 'toast', 'crust', 'entree',
  'entrees', 'novelties', 'ice cream', 'ice creams', 'sherbet', 'shake', 'shakes', 'nog',
  'custard', 'custards', 'flan', 'gelatin', 'gelatins', 'jam', 'jams', 'jelly', 'jellies',
  'marmalade', 'preserves', 'ketchup', 'catsup', 'mayonnaise', 'relish', 'pickle', 'pickles',
  'pickled', 'chips', 'pretzels', 'nuggets', 'tenders', 'patty', 'patties', 'meatball',
  'meatballs', 'loaf', 'sausage', 'sausages', 'bologna', 'salami', 'pepperoni', 'frankfurter',
  'frankfurters', 'bratwurst', 'knackwurst', 'bockwurst', 'kielbasa', 'liverwurst',
  'braunschweiger', 'mortadella', 'thuringer', 'beerwurst', 'swisswurst', 'yachtwurst',
  'headcheese', 'scrapple', 'pastrami', 'pate', 'bacon', 'ham', 'jerky', 'luncheon', 'lunchmeat',
  'sticks', 'souffle', 'stuffing', 'snack', 'snacks', 'bar', 'bars', 'gum', 'gums', 'parfait',
  'sundae', 'cone', 'cones', 'macaroon', 'fudge', 'ravioli', 'tortellini', 'pockets', 'wrappers',
  'shells', 'macaroni', 'spaghetti', 'vermicelli', 'noodles', 'pasta', 'puff', 'puffs', 'wedges',
  'crumbles', 'paste', 'refried', 'cereal', 'cereals', 'tortilla', 'tortillas', 'blends', 'mix',
  'beverage', 'beverages', 'alcoholic', 'drink', 'drinks', 'cocktail', 'lemonade', 'limeade',
  'smoothie', 'nectar', 'soda', 'cola', 'creamer', 'juice', 'juices', 'concentrate', 'water'
];

/** Words that make a term an additive, a sweetener, a fat or a processed ingredient. */
const ADDITIVE_WORDS = [
  'sugar', 'sugars', 'syrup', 'syrups', 'sweetener', 'sweeteners', 'molasses', 'honey', 'maple',
  'dextrose', 'flavor', 'flavors', 'flavoring', 'flavour', 'extract', 'extracts', 'artificial',
  'margarine', 'shortening', 'oil', 'oils', 'lard', 'suet', 'fat', 'fats', 'salt', 'baking',
  'cream of', 'pectin', 'lecithin', 'rennin', 'whey', 'isolate', 'gluten', 'extender', 'yeast',
  'malt', 'starch', 'seasoning', 'seasoned', 'spray', 'replacement', 'substitute', 'substitutes',
  'imitation', 'formula', 'formulated', 'supplement', 'dietetic', 'vinegar', 'chocolate', 'cocoa',
  'maraschino', 'process', 'processed', 'condensed', 'evaporated', 'powdered', 'cheese food'
];

/**
 * Words that describe how a food was cut, labelled, sold or measured rather than which food
 * it is. USDA descriptions are full of them, and each reads as a food name once it is split
 * off its segment — which is how "plain", "mixed" and "restaurant" reached the table.
 */
const QUALIFIER_WORDS = [
  'composite', 'separable', 'mechanically', 'retail', 'unspecified', 'restaurant', 'school lunch',
  'fast food', 'fast foods', 'home prepared', 'homemade', 'microwavable', 'microwaveable',
  'reduced', 'low', 'lowfat', 'nonfat', 'free', 'no', 'non', 'vegetarian', 'veggie', 'meatless',
  'variety', 'fresh-refrigerated', 'boxed', 'bottled', 'canned', 'frozen', 'iced', 'baked',
  'pan-broiled', 'pan-fried', 'roasting', 'stewing', 'dry', 'dark meat', 'light meat', 'carcass',
  'deboned', 'separated', 'trimmed', 'cuts', 'parts', 'products', 'foods', 'based', 'classic',
  'original', 'premium', 'ultimate', 'luxury', 'regular', 'plus', 'plain', 'american', 'enhanced',
  'domesticated', 'grass-fed', 'commodity', 'producer', 'industrial', 'all classes', 'style'
];

/** Terms that are only wrong on their own; inside a longer name they are fine. */
const EXACT_REJECTS = new Set([
  'light', 'mixed', 'blue', 'pink', 'round', 'back', 'plate', 'tail', 'blade', 'chop', 'leg', 'neck',
  'breast', 'wing', 'thigh', 'thighs', 'skin', 'ears', 'feet', 'stick', 'tub', 'dip', 'fluid',
  'creamy', 'cured', 'greek', 'australian', 'new zealand', 'pine', 'palm', 'poppy', 'vegetable',
  'fruit', 'flour', 'whole grain', 'whole-wheat', 'winged', 'small white', 'white turkey', 'bay',
  'cottage', 'brick', 'swiss', 'monterey', 'human', 'mouse', 'curry', 'chili', 'mustard', 'vanilla',
  'canola', 'tapioca', 'agave', 'tart', 'mush', 'powder', 'agutuk', 'chilchen', 'grenadine',
  'yokan', 'dulce de leche', 'eggnog', 'doughnuts', 'focaccia', 'popovers', 'zwieback', 'frybread',
  'pan dulce', 'cheesefurter', 'gefiltefish', 'surimi', 'cornstarch', 'backfat', 'meatloaf',
  'oatmeal raisin', 'liver cheese', 'nutmeg butter', 'ucuhuba butter', 'fruit butters',
  'onion rings', 'hush puppies', 'corn dogs', 'falafel', 'hot pockets', 'boneless', 'meat only'
]);

/**
 * Manufacturers, brands and restaurants. A full build also drops any description with an
 * all-capitals segment, which is how USDA writes a brand; this list covers terms already
 * lowercased, where that signal is gone.
 */
const BRANDS = [
  'abbott', 'burger king', 'chick-fil-a', 'clif', 'continental mills', 'cracker barrel',
  'crunchmaster', 'digiorno', 'enova', 'george weston', 'gerber', 'glutino', 'heinz', 'hormel',
  'house foods', 'hungry man', 'interstate brands', 'jimmy dean', 'keebler', 'kfc', 'kraft',
  'lean pockets', 'malt-o-meal', 'martha white', 'mckee', 'mead johnson', 'mission foods',
  'mori-nu', 'nabisco', 'nestle', 'olive garden', 'on the border', 'oscar mayer', 'pam',
  'pbm products', 'pepperidge farm', 'pillsbury', 'pizza hut', 'popeyes', 'quaker', 'rice-a-roni',
  'schar', 'schiff', 'silk', 'subway', 'taco bell', 'vitasoy', 'wheatena', 'banquet', 'sage valley',
  'gentle plus', 'frosty lemon', 'oopah', 'keikitos', 'dutch brand', 'smart soup', 'incaparina',
  'tofu plus', 'babyfood', "wend'ys"
];

/** Real foods whose names contain one of the words above. */
const ALLOWED = new Set(['custard-apple', 'sugar-apples', 'sugar-apple', 'sugar apple', 'tart cherry', 'new zealand spinach', "jew's ear"]);

const wordPattern = (words) => new RegExp(`\\b(?:${words.map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`);
const PRODUCT_PATTERN = wordPattern(PRODUCT_WORDS);
const ADDITIVE_PATTERN = wordPattern(ADDITIVE_WORDS);
const QUALIFIER_PATTERN = wordPattern(QUALIFIER_WORDS);
const BRAND_PATTERN = wordPattern(BRANDS);

/**
 * Whether a generated term may be taught to the table as a food.
 *
 * Exported for its own test, and applied both when terms are generated and when an
 * existing file is refiltered, so a checked-in list is held to the same rule as a new one.
 */
export function isAdmissibleTerm(term) {
  const text = String(term ?? '').toLowerCase().trim();
  if (text.length < 3) return false;
  if (ALLOWED.has(text)) return true;
  // A leftover bracket is a parenthetical cut in half; " or " and "/" are USDA alternations.
  if (/[()/]/.test(text) || /\bor\b/.test(text)) return false;
  // In USDA's data a possessive is a restaurant or a brand: McDonald's, Campbell's, Udi's.
  if (/[a-z]'s\b/.test(text)) return false;
  if (EXACT_REJECTS.has(text)) return false;
  return !(PRODUCT_PATTERN.test(text) || ADDITIVE_PATTERN.test(text) || QUALIFIER_PATTERN.test(text) || BRAND_PATTERN.test(text));
}

/** Whether a description names a brand. USDA writes brands and restaurants in capitals. */
export function isBrandedDescription(description) {
  return String(description ?? '')
    .replace(/\(.*?\)/g, ' ')
    .split(',')
    .some((segment) => {
      const letters = segment.replace(/[^A-Za-z]/g, '');
      return letters.length >= 3 && letters === letters.toUpperCase();
    });
}

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
  if (isBrandedDescription(description)) return [];

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
  return [...terms].filter(isAdmissibleTerm);
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
      if (response.status === 401 || response.status === 403) {
        throw new Error(`USDA rejected the API key (${response.status}). Check it was copied whole, or get a new one at https://fdc.nal.usda.gov/api-key-signup.html`);
      }
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

function render(terms, provenance = `Generated ${new Date().toISOString().slice(0, 10)} from ${terms.length} food names.`) {
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
 * has missed, only when the ingredient is the named food rather than merely mentioning
 * it, and can move an ingredient from unrecognised to food and nowhere else. Every term
 * has passed isAdmissibleTerm in the generator.
 *
 * ${provenance}
 */
export const GENERATED_FOOD_VOCABULARY: readonly string[] = [
${body}
];
`;
}

/** The terms in an already generated file, so they can be held to the current rule. */
export function readGeneratedTerms(source) {
  const terms = [];
  for (const match of String(source).matchAll(/^\s*'((?:[^'\\]|\\.)*)',?\s*$/gm)) {
    terms.push(match[1].replace(/\\'/g, "'"));
  }
  return terms;
}

/**
 * Hold the checked-in file to the current rule without calling USDA.
 *
 * A key is needed to fetch, not to filter. This makes a tightened rule take effect on the
 * list that is already in the repository, by whoever has the change and not only by
 * whoever has a key.
 */
function refilter() {
  const before = readGeneratedTerms(fs.readFileSync(OUTPUT, 'utf8'));
  const kept = [...new Set(before.filter(isAdmissibleTerm))].sort();
  const removed = before.length - kept.length;
  fs.writeFileSync(OUTPUT, render(kept, `Refiltered ${new Date().toISOString().slice(0, 10)}: ${kept.length} of ${before.length} generated names kept, ${removed} refused by isAdmissibleTerm.`));
  console.log(`Kept ${kept.length} of ${before.length} terms; refused ${removed}.`);
}

async function main() {
  if (process.argv.includes('--refilter')) {
    refilter();
    return;
  }
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

  /* The category check failed silently once. If it has nothing to check, say so. */
  const categorised = foods.filter((food) => food.foodCategory).length;
  if (categorised === 0) {
    console.warn('Warning: no USDA row carried a foodCategory, so category exclusion did nothing. The term filter still applied.');
  }

  const sorted = [...terms].sort();
  fs.writeFileSync(OUTPUT, render(sorted));
  console.log(`Wrote ${sorted.length} food names to ${path.relative(process.cwd(), OUTPUT)}`);
  console.log('Now run: npm run lexicon:coverage');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  await main();
}
