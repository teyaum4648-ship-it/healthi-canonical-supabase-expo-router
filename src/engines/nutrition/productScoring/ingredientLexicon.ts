/**
 * Ingredient lexicon — specificity-ordered ingredient identity resolution.
 *
 * Replaces the flat-regex classification previously inlined in kernelV5.signalFor.
 *
 * Two mechanics matter here and neither existed before:
 *
 * 1. SPECIFICITY ORDERING. Entries are matched longest-phrase-first, so
 *    "soybean oil" resolves as a refined seed oil before "soybean" can
 *    resolve as a legume. The old flat regexes had no ordering, which is
 *    why `\bsoybeans?\b` inside CULINARY_SOURCE classified soybean oil as
 *    a whole food.
 *
 * 2. EXPLICIT UNKNOWN. An unmatched ingredient resolves to `null`, not to a
 *    middling default. Callers decide what unknown means. The old code fell
 *    through to processingIntensity 2 — the same value as added sugar — so
 *    every gap in the lexicon silently penalized real food.
 */

export type FatClass =
  | 'traditional_animal'   // butter, ghee, tallow, lard — Chek-aligned, unpenalized
  | 'traditional_plant'    // EVOO, coconut, unrefined avocado
  | 'refined_plant'        // refined avocado / high-oleic — clean source, refined process
  | 'refined_seed'         // canola, soybean, sunflower, corn, cottonseed, grapeseed
  | 'industrial';          // hydrogenated, interesterified, shortening, palm kernel

export type SweetenerClass =
  | 'whole_matrix'         // dates, whole fruit — sugar inside intact fiber/mineral matrix
  | 'traditional'          // raw honey, maple syrup, blackstrap molasses
  | 'refined'              // cane sugar, HFCS, dextrose, syrups
  | 'sugar_alcohol'        // erythritol, xylitol
  | 'plant_high_intensity' // stevia, monk fruit
  | 'synthetic_high_intensity' // sucralose, aspartame, ace-K
  | 'rare_sugar';          // allulose

export type IngredientRole =
  | 'whole_food'
  | 'reconstituted_flour'
  | 'fat'
  | 'sweetener'
  | 'refined_starch'
  | 'protein_isolate'
  | 'added_fiber'
  | 'flavor_system'
  | 'color'
  | 'emulsifier_stabilizer'
  | 'preservative';

export type LexiconEntry = {
  id: string;
  role: IngredientRole;
  /** Phrases matched as whole words. Longest phrase determines match priority. */
  phrases: string[];
  fatClass?: FatClass;
  sweetenerClass?: SweetenerClass;
  /** 1 = intact whole food … 5 = heavily engineered. */
  processingIntensity: 1 | 2 | 3 | 4 | 5;
  /**
   * Whether this ingredient counts toward the whole-food fraction in
   * foodStructure. Traditional fats and animal foods count; refined
   * anything does not.
   */
  countsAsWholeFood: boolean;
};

/**
 * ORDER DOES NOT MATTER HERE — resolution sorts by phrase length at module
 * load. Group by concept for readability.
 */
const ENTRIES: LexiconEntry[] = [
  // ---------------------------------------------------------------- FATS
  // Traditional animal fats. Previously invisible: "butter", "ghee", "lard"
  // matched nothing at all and fell through to intensity 2.
  {
    id: 'fat_traditional_animal',
    role: 'fat',
    fatClass: 'traditional_animal',
    phrases: [
      'grass fed butter', 'grass-fed butter', 'cultured butter', 'butter', 'butterfat',
      'ghee', 'clarified butter', 'beef tallow', 'tallow', 'lard', 'duck fat',
      'schmaltz', 'suet', 'heavy cream', 'cream', 'egg yolk', 'egg yolks'
    ],
    processingIntensity: 1,
    countsAsWholeFood: true
  },
  {
    id: 'fat_traditional_plant',
    role: 'fat',
    fatClass: 'traditional_plant',
    phrases: [
      'extra virgin olive oil', 'virgin olive oil', 'cold pressed olive oil', 'olive oil',
      'virgin coconut oil', 'unrefined coconut oil', 'coconut oil', 'coconut milk',
      'cold pressed avocado oil', 'unrefined avocado oil', 'extra virgin avocado oil',
      'palm fruit oil', 'red palm oil', 'cocoa butter', 'olives',
      'cold pressed culinary oil', 'culinary oil', 'cold pressed oil'
    ],
    processingIntensity: 1,
    countsAsWholeFood: true
  },
  {
    id: 'fat_refined_plant',
    role: 'fat',
    fatClass: 'refined_plant',
    phrases: [
      'avocado oil', 'refined avocado oil', 'refined coconut oil',
      'high oleic sunflower oil', 'high-oleic sunflower oil',
      'high oleic safflower oil', 'high-oleic safflower oil',
      'high oleic canola oil', 'refined olive oil', 'olive pomace oil', 'palm oil'
    ],
    processingIntensity: 3,
    countsAsWholeFood: false
  },
  // THE MAIN FIX. None of these were detected anywhere in the V5 kernel.
  {
    id: 'fat_refined_seed',
    role: 'fat',
    fatClass: 'refined_seed',
    phrases: [
      'canola oil', 'rapeseed oil', 'soybean oil', 'soy oil', 'sunflower oil',
      'safflower oil', 'corn oil', 'cottonseed oil', 'grapeseed oil', 'grape seed oil',
      'rice bran oil', 'peanut oil', 'sesame oil', 'vegetable oil', 'vegetable oils',
      'seed oil', 'seed oils', 'sunflower seed oil', 'expeller pressed canola oil'
    ],
    processingIntensity: 4,
    countsAsWholeFood: false
  },
  {
    id: 'fat_industrial',
    role: 'fat',
    fatClass: 'industrial',
    phrases: [
      'partially hydrogenated oil', 'partially hydrogenated', 'fully hydrogenated',
      'hydrogenated', 'interesterified', 'shortening', 'palm kernel oil', 'margarine'
    ],
    processingIntensity: 5,
    countsAsWholeFood: false
  },

  // ---------------------------------------------------------- SWEETENERS
  // The ladder you specified: dates 76 / honey 72 / cane sugar 12 requires
  // three distinct classes, not one ADDED_SUGAR bucket.
  {
    id: 'sweetener_whole_matrix',
    role: 'sweetener',
    sweetenerClass: 'whole_matrix',
    phrases: ['dates', 'date paste', 'medjool dates', 'date', 'raisins', 'figs', 'whole fruit puree', 'banana puree'],
    processingIntensity: 1,
    countsAsWholeFood: true
  },
  {
    id: 'sweetener_traditional',
    role: 'sweetener',
    sweetenerClass: 'traditional',
    phrases: ['raw honey', 'honey', 'pure maple syrup', 'maple syrup', 'blackstrap molasses', 'molasses', 'coconut sugar', 'date syrup'],
    processingIntensity: 2,
    countsAsWholeFood: false
  },
  {
    id: 'sweetener_refined',
    role: 'sweetener',
    sweetenerClass: 'refined',
    phrases: [
      'high fructose corn syrup', 'corn syrup solids', 'corn syrup', 'cane sugar',
      'organic cane sugar', 'brown sugar', 'invert sugar', 'raw sugar', 'sugar',
      'granulated sweetener', 'concentrated sweetener', 'sweetener',
      'sucrose', 'glucose', 'dextrose', 'fructose', 'maltose', 'agave nectar', 'agave',
      'rice syrup', 'brown rice syrup', 'tapioca syrup', 'fruit juice concentrate'
    ],
    processingIntensity: 3,
    countsAsWholeFood: false
  },
  {
    id: 'sweetener_sugar_alcohol',
    role: 'sweetener',
    sweetenerClass: 'sugar_alcohol',
    phrases: ['erythritol', 'xylitol', 'sorbitol', 'maltitol', 'mannitol', 'isomalt', 'lactitol', 'sugar alcohol', 'sugar alcohols'],
    processingIntensity: 3,
    countsAsWholeFood: false
  },
  {
    id: 'sweetener_plant_high_intensity',
    role: 'sweetener',
    sweetenerClass: 'plant_high_intensity',
    phrases: ['steviol glycosides', 'stevia leaf extract', 'stevia', 'monk fruit extract', 'monk fruit', 'luo han guo'],
    processingIntensity: 3,
    countsAsWholeFood: false
  },
  {
    id: 'sweetener_synthetic_high_intensity',
    role: 'sweetener',
    sweetenerClass: 'synthetic_high_intensity',
    phrases: ['aspartame', 'sucralose', 'acesulfame potassium', 'acesulfame k', 'ace-k', 'acesulfame', 'saccharin', 'neotame', 'advantame'],
    processingIntensity: 5,
    countsAsWholeFood: false
  },
  {
    id: 'sweetener_rare_sugar',
    role: 'sweetener',
    sweetenerClass: 'rare_sugar',
    phrases: ['allulose'],
    processingIntensity: 3,
    countsAsWholeFood: false
  },

  // ------------------------------------------------------- WHOLE FOODS
  {
    id: 'whole_animal_protein',
    role: 'whole_food',
    phrases: [
      'beef liver', 'chicken liver', 'liver', 'grass fed beef', 'grass-fed beef', 'beef',
      'bison', 'lamb', 'venison', 'pork', 'chicken', 'chicken breast', 'turkey',
      'wild salmon', 'salmon', 'sardines', 'sardine', 'anchovies', 'anchovy', 'mackerel',
      'tuna', 'cod', 'shrimp', 'oysters', 'fish', 'bone broth', 'bone marrow',
      'eggs', 'egg', 'whole eggs', 'gelatin', 'collagen'
    ],
    processingIntensity: 1,
    countsAsWholeFood: true
  },
  {
    id: 'whole_dairy',
    role: 'whole_food',
    phrases: [
      'whole milk', 'raw milk', 'milk', 'plain yogurt', 'whole milk yogurt', 'yogurt',
      'greek yogurt', 'kefir', 'cottage cheese', 'cheese', 'parmesan', 'live cultures', 'cultures'
    ],
    processingIntensity: 1,
    countsAsWholeFood: true
  },
  {
    id: 'whole_plant',
    role: 'whole_food',
    phrases: [
      'water', 'sea salt', 'salt', 'himalayan salt', 'kosher salt',
      'sweet potatoes', 'sweet potato', 'potatoes', 'potato', 'tomatoes', 'tomato',
      'vegetables', 'onion', 'garlic', 'carrots', 'spinach', 'kale', 'broccoli',
      'avocado', 'blueberries', 'strawberries', 'berries', 'apples', 'apple',
      'bananas', 'banana', 'oranges', 'lemon', 'lime', 'fruit',
      'black beans', 'beans', 'chickpeas', 'lentils', 'peas',
      'almonds', 'cashews', 'walnuts', 'pecans', 'macadamia', 'pistachios', 'nuts',
      'peanuts', 'chia seeds', 'flax seeds', 'pumpkin seeds', 'sunflower seeds', 'seeds', 'seed',
      'whole intact seed', 'intact seed', 'whole grain', 'legumes', 'legume',
      'rolled oats', 'steel cut oats', 'whole oats', 'oats', 'quinoa', 'barley', 'millet',
      'brown rice', 'white rice', 'rice', 'buckwheat', 'sprouted wheat', 'whole wheat',
      'cocoa', 'cacao', 'cacao nibs', 'coffee', 'green tea', 'tea', 'herbs', 'spices',
      'cinnamon', 'turmeric', 'ginger', 'vanilla bean', 'cassava', 'plantains', 'corn'
    ],
    processingIntensity: 1,
    countsAsWholeFood: true
  },

  // ------------------------------------------------- REFINED / ENGINEERED
  // Whole-grain and nut flours sit between intact food and refined starch.
  // The source is real, but milling destroys the food matrix, so they must
  // not earn the whole-food matrix bonus that intact ingredients do.
  {
    id: 'reconstituted_flour',
    role: 'reconstituted_flour',
    phrases: [
      'cassava flour', 'almond flour', 'coconut flour', 'tapioca flour', 'chickpea flour',
      'oat flour', 'rice flour', 'brown rice flour', 'corn flour', 'masa harina',
      'whole wheat flour', 'spelt flour', 'buckwheat flour', 'potato flour'
    ],
    processingIntensity: 3,
    countsAsWholeFood: false
  },
  {
    id: 'refined_starch',
    role: 'refined_starch',
    phrases: [
      'starch', 'isolated starch', 'refined isolated starch',
      'enriched wheat flour', 'enriched flour', 'white flour', 'refined wheat flour',
      'refined flour', 'wheat flour', 'modified food starch', 'modified corn starch',
      'modified starch', 'corn starch', 'cornstarch', 'tapioca starch', 'potato starch',
      'rice starch', 'maltodextrin', 'dextrin', 'refined flour'
    ],
    processingIntensity: 4,
    countsAsWholeFood: false
  },
  {
    id: 'protein_isolate',
    role: 'protein_isolate',
    phrases: [
      'whey protein isolate', 'whey protein concentrate', 'whey protein', 'milk protein isolate',
      'milk protein', 'soy protein isolate', 'soy protein', 'pea protein isolate', 'pea protein',
      'protein isolate', 'protein concentrate', 'hydrolyzed protein', 'hydrolysed protein', 'collagen peptides'
    ],
    processingIntensity: 4,
    countsAsWholeFood: false
  },
  {
    id: 'added_fiber',
    role: 'added_fiber',
    phrases: ['chicory root fiber', 'cassava root fiber', 'soluble corn fiber', 'soluble fiber', 'acacia fiber', 'inulin', 'added fiber', 'fiber isolate', 'polydextrose'],
    processingIntensity: 4,
    countsAsWholeFood: false
  },
  {
    id: 'flavor_system',
    role: 'flavor_system',
    phrases: ['natural flavors', 'natural flavour', 'natural flavor', 'artificial flavors', 'artificial flavor', 'flavoring', 'flavouring', 'yeast extract'],
    processingIntensity: 3,
    countsAsWholeFood: false
  },
  {
    id: 'color',
    role: 'color',
    phrases: ['caramel color', 'color added', 'red 40', 'red dye 40', 'yellow 5', 'yellow 6', 'blue 1', 'artificial colors', 'artificial color', 'titanium dioxide'],
    processingIntensity: 5,
    countsAsWholeFood: false
  },
  {
    id: 'emulsifier_stabilizer',
    role: 'emulsifier_stabilizer',
    phrases: [
      'carrageenan', 'cellulose gum', 'carboxymethylcellulose', 'xanthan gum', 'guar gum',
      'gellan gum', 'locust bean gum', 'soy lecithin', 'sunflower lecithin', 'lecithin',
      'mono and diglycerides', 'monoglycerides', 'diglycerides', 'polysorbate 80',
      'sodium citrate', 'sodium phosphate', 'sodium phosphates', 'calcium silicate',
      'silicon dioxide', 'tricalcium phosphate', 'emulsifier', 'stabilizer', 'thickener',
      'gum', 'gums', 'technical thickener gum'
    ],
    processingIntensity: 4,
    countsAsWholeFood: false
  },
  {
    id: 'preservative',
    role: 'preservative',
    phrases: [
      'potassium sorbate', 'sodium benzoate', 'calcium propionate', 'sorbic acid',
      'sodium nitrite', 'sodium nitrate', 'cultured celery powder', 'bha', 'bht',
      'tbhq', 'edta', 'preservative', 'phosphoric acid', 'citric acid'
    ],
    processingIntensity: 4,
    countsAsWholeFood: false
  }
];

type CompiledPhrase = {
  entry: LexiconEntry;
  phrase: string;
  pattern: RegExp;
  /** Longer phrases win. Word count first, then character length. */
  specificity: number;
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const COMPILED: CompiledPhrase[] = ENTRIES.flatMap((entry) =>
  entry.phrases.map((phrase) => ({
    entry,
    phrase,
    pattern: new RegExp(`\\b${escapeRegExp(phrase).replace(/\s+/g, '[\\s-]+')}\\b`, 'i'),
    specificity: phrase.split(/\s+/).length * 1000 + phrase.length
  }))
).sort((left, right) => right.specificity - left.specificity);

export type LexiconMatch = {
  entryId: string;
  role: IngredientRole;
  fatClass: FatClass | null;
  sweetenerClass: SweetenerClass | null;
  processingIntensity: 1 | 2 | 3 | 4 | 5;
  countsAsWholeFood: boolean;
  matchedPhrase: string;
};

/**
 * Resolve a single ingredient token to its most specific lexicon entry.
 * Returns null when nothing matches — callers must handle unknown explicitly
 * rather than defaulting it to a score-affecting value.
 */
export function resolveIngredient(text: string): LexiconMatch | null {
  const normalized = text.toLowerCase().trim();
  if (!normalized) return null;
  for (const candidate of COMPILED) {
    if (candidate.pattern.test(normalized)) {
      return {
        entryId: candidate.entry.id,
        role: candidate.entry.role,
        fatClass: candidate.entry.fatClass ?? null,
        sweetenerClass: candidate.entry.sweetenerClass ?? null,
        processingIntensity: candidate.entry.processingIntensity,
        countsAsWholeFood: candidate.entry.countsAsWholeFood,
        matchedPhrase: candidate.phrase
      };
    }
  }
  return null;
}

/** Exposed for tests and for a future lexicon-coverage report. */
export const LEXICON_ENTRIES = ENTRIES;
export const LEXICON_PHRASE_COUNT = COMPILED.length;
