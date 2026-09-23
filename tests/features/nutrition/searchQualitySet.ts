import type { HealthiProductSnapshot } from '../../../src/features/nutrition/productLookup/productLookupTypes';

/**
 * Real queries, and the food that should come back first.
 *
 * This exists for the same reason the ingredient calibration set does: tuning search by
 * trying one query at a time is unconstrained, so a change that rescues "chipolte"
 * quietly buries "greek yogurt" and nobody notices until someone reports it.
 *
 * What it measures is what the app does with a query and a result set — the correction
 * applied to the query, and the order the rows come back in. What it cannot measure is
 * whether the providers return any rows at all, because that needs the network. That
 * limit matters: the most common real failure is USDA being switched off, which no
 * amount of ranking work fixes.
 *
 * The fast-food rows are shaped the way USDA's Survey (FNDDS) set actually names them,
 * apostrophes and leading brand included, because that punctuation is the whole problem
 * in half these cases.
 */

export type SearchCase = {
  id: string;
  /** What somebody typed, typos and all. */
  query: string;
  /** The name that should rank first. */
  expectTop: string;
  /** Why this case is here. */
  why: string;
  rows: HealthiProductSnapshot[];
};

/** A provider row with enough nutrition to be loggable, so completeness never decides alone. */
function food(name: string, over: Partial<HealthiProductSnapshot> = {}): HealthiProductSnapshot {
  return {
    barcode: '',
    provider: 'usda_food_data_central',
    provider_product_id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    name,
    brand: null,
    ingredients_text: null,
    image_url: null,
    serving_size: '100 g',
    serving_quantity_g: 100,
    calories_per_serving: 250,
    protein_g: 10,
    carbs_g: 30,
    fat_g: 9,
    quality_flags: [],
    confidence: 'medium',
    reason_codes: [],
    ...over
  } as HealthiProductSnapshot;
}

/** Foods that turn up as noise on almost any query, so ranking has something to beat. */
const NOISE = [
  food('Sauce, cheese, ready-to-serve'),
  food('Beverages, tea, instant, sweetened'),
  food('Snacks, tortilla chips, nacho cheese'),
  food('Cereals ready-to-eat, frosted flakes')
];

export const SEARCH_CASES: readonly SearchCase[] = [
  {
    id: 'chain_exact',
    query: 'big mac',
    expectTop: "McDonald's, Big Mac",
    why: 'Both terms are present as words. This one should already work.',
    rows: [...NOISE, food("McDonald's, Big Mac"), food("McDonald's, hamburger")]
  },
  {
    id: 'chain_no_apostrophe',
    query: 'mcdonalds french fries',
    expectTop: "McDonald's, French fries",
    why: 'Nobody types the apostrophe. Normalising it to "mcdonald s" makes the brand term miss entirely.',
    rows: [...NOISE, food("McDonald's, French fries"), food('Fast foods, potato, french fried')]
  },
  {
    id: 'chain_possessive_short',
    query: 'wendys chili',
    expectTop: "Wendy's, chili",
    why: 'Same apostrophe problem on a shorter brand.',
    rows: [...NOISE, food("Wendy's, chili"), food('Chili con carne, canned')]
  },
  {
    id: 'chain_misspelled',
    query: 'chipolte chicken bowl',
    expectTop: 'Chipotle, chicken burrito bowl',
    why: 'A chain name people reliably misspell.',
    rows: [...NOISE, food('Chipotle, chicken burrito bowl'), food('Chicken, roasted, breast')]
  },
  {
    id: 'chain_two_words',
    query: 'taco bell bean burrito',
    expectTop: 'Taco Bell, bean burrito',
    why: 'A two-word chain name, where the terms are spread across the row.',
    rows: [...NOISE, food('Taco Bell, bean burrito'), food('Burrito, beans and cheese')]
  },
  {
    id: 'food_misspelled',
    query: 'brocolli',
    expectTop: 'Broccoli, raw',
    why: 'The most-misspelled vegetable there is.',
    rows: [...NOISE, food('Broccoli, raw'), food('Broccoli rabe, cooked')]
  },
  {
    id: 'food_misspelled_two',
    query: 'avacado',
    expectTop: 'Avocado, raw',
    why: 'Second commonest food misspelling.',
    rows: [...NOISE, food('Avocado, raw'), food('Guacamole, prepared')]
  },
  {
    id: 'plain_beats_flavoured',
    query: 'greek yogurt',
    expectTop: 'Yogurt, Greek, plain, nonfat',
    why: 'Both terms match both rows, so the plainer food should win rather than a flavoured tub.',
    rows: [...NOISE, food('Yogurt, Greek, strawberry, lowfat'), food('Yogurt, Greek, plain, nonfat')]
  },
  {
    id: 'singular_query_plural_row',
    query: 'oat',
    expectTop: 'Oats, whole grain, rolled',
    why: 'Whole-word matching misses a plural row on a singular query.',
    rows: [...NOISE, food('Oats, whole grain, rolled'), food('Bread, oat bran')]
  },
  {
    id: 'typo_is_the_only_term',
    query: 'brocolli',
    expectTop: 'Broccoli, raw',
    why: 'One misspelled word and nothing else to carry it. Against same-length rows, ranking has nothing to go on.',
    rows: [
      food('Bread, rye'),
      food('Bacon, raw'),
      food('Broccoli, raw'),
      food('Butter, salted')
    ]
  },
  {
    id: 'chain_is_the_only_term',
    query: 'mcdonalds',
    expectTop: "McDonald's, Big Mac",
    why: 'The brand is the entire query, and the apostrophe makes it miss.',
    rows: [
      food('Milk, whole'),
      food('Mustard, yellow'),
      food("McDonald's, Big Mac"),
      food('Muffin, plain')
    ]
  },
  {
    id: 'chain_misspelled_alone',
    query: 'chipolte',
    expectTop: 'Chipotle, chicken burrito bowl',
    why: 'A misspelled chain with nothing else in the query.',
    rows: [
      food('Chips, potato'),
      food('Cheese, cheddar'),
      food('Chipotle, chicken burrito bowl'),
      food('Chicken, raw')
    ]
  },
  {
    id: 'brand_field_match',
    query: 'starbucks latte',
    expectTop: 'Caffe latte, whole milk',
    why: 'The chain lives in the brand field rather than the name.',
    rows: [...NOISE, food('Caffe latte, whole milk', { brand: 'Starbucks' }), food('Milk, whole')]
  }
];
