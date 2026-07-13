export type ProductRuleSeverity = 'strong' | 'moderate' | 'light' | 'positive';

export type ProductIngredientRule = {
  id: string;
  label: string;
  severity: ProductRuleSeverity;
  points: number;
  patterns: RegExp[];
  explanation: string;
  scoreCap?: number;
  minimumTier?: 3 | 4;
  minimumIngredients?: number;
  firstIngredientsAdjustment?: number;
};

export const INGREDIENT_CONSIDERATION_RULES: ProductIngredientRule[] = [
  {
    id: 'hydrogenated_oil', label: 'Hydrogenated oil', severity: 'strong', points: -20, scoreCap: 30, minimumTier: 4,
    patterns: [/\b(partially )?hydrogenated\b/, /\binteresterified\b/],
    explanation: 'A hydrogenated fat appears in the ingredient list.'
  },
  {
    id: 'artificial_color', label: 'Artificial color', severity: 'strong', points: -18, scoreCap: 38, minimumTier: 4,
    patterns: [/\bred (dye )?(no\.? ?)?(40|3)\b/, /\byellow (dye )?(no\.? ?)?(5|6)\b/, /\bblue (dye )?(no\.? ?)?(1|2)\b/, /\bartificial colou?r(s|ing)?\b/, /\bfd&c\b/, /\btitanium dioxide\b/],
    explanation: 'A color additive appears in the ingredient list.'
  },
  {
    id: 'artificial_sweetener', label: 'Artificial sweetener', severity: 'strong', points: -16, scoreCap: 42, minimumTier: 4,
    patterns: [/\baspartame\b/, /\bsucralose\b/, /\bacesulfame\b/, /\bace-?k\b/, /\bsaccharin\b/, /\bneotame\b/],
    explanation: 'A non-sugar sweetener appears in the ingredient list.'
  },
  {
    id: 'industrial_preservative', label: 'Added preservative', severity: 'moderate', points: -9, minimumTier: 3,
    patterns: [/\bbha\b/, /\bbht\b/, /\btbhq\b/, /\b(sodium|potassium) benzoate\b/, /\b(potassium|calcium|sodium) sorbate\b/, /\b(calcium|sodium) propionate\b/, /\bedta\b/],
    explanation: 'A shelf-life preservative appears in the ingredient list.'
  },
  {
    id: 'added_nitrite', label: 'Added nitrite or nitrate', severity: 'moderate', points: -10, scoreCap: 55, minimumTier: 3,
    patterns: [/\b(sodium|potassium) (nitrite|nitrate)\b/, /\bcultured celery (powder|juice|extract)\b/],
    explanation: 'A curing ingredient appears in the ingredient list.'
  },
  {
    id: 'refined_oil_blend', label: 'Refined oil blend', severity: 'moderate', points: -8, minimumTier: 3,
    patterns: [/\bcanola( oil)?\b/, /\brapeseed oil\b/, /\bsoy(bean)? oil\b/, /\bvegetable oils?\b/, /\bcorn oil\b/, /\bcottonseed oil\b/, /\bsafflower oil\b/, /\bgrapeseed oil\b/, /\bvegetable shortening\b/, /\bmargarine\b/],
    explanation: 'A refined oil or oil blend appears in the ingredient list.'
  },
  {
    id: 'added_sugar', label: 'Refined added sugar', severity: 'moderate', points: -7, minimumTier: 3, minimumIngredients: 2, firstIngredientsAdjustment: -4,
    patterns: [/\bhigh[- ]fructose corn syrup\b/, /\bhfcs\b/, /(?<!coconut )(?<!date )\bsugar\b/, /\bcane sugar\b/, /\bcorn syrup\b/, /\bdextrose\b/, /\bsucrose\b/, /\binvert sugar\b/, /\bmaltodextrin\b/],
    explanation: 'A refined added sugar appears in the ingredient list.'
  },
  {
    id: 'refined_flour', label: 'Refined flour', severity: 'moderate', points: -7, minimumTier: 3,
    patterns: [/\benriched ([a-z ]*)?flour\b/, /\bbleached flour\b/, /(?<!whole[- ])(?<!whole grain )\bwheat flour\b/],
    explanation: 'A refined or enriched flour appears in the ingredient list.'
  },
  {
    id: 'artificial_flavor', label: 'Artificial flavor', severity: 'moderate', points: -10, scoreCap: 52, minimumTier: 4,
    patterns: [/\bartificial flavou?r(s|ing)?\b/, /\b(ethyl )?vanillin\b/],
    explanation: 'An artificial flavor appears in the ingredient list.'
  },
  {
    id: 'flavor_blend', label: 'Unspecified flavor blend', severity: 'light', points: -4, minimumTier: 3,
    patterns: [/\bnatural flavou?r(s|ing)?\b/],
    explanation: 'The label includes a flavor blend without listing its individual components.'
  },
  {
    id: 'emulsifier', label: 'Emulsifier or texture agent', severity: 'light', points: -5, minimumTier: 3,
    patterns: [/\bpolysorbate ?(60|80)\b/, /\bcarrageenan\b/, /\b(carboxymethyl)?cellulose( gum)?\b/, /\bmono-? ?and di-?glycerides\b/, /\bxanthan gum\b/, /\bguar gum\b/, /\bgellan gum\b/, /\bmodified (food |corn |tapioca |potato )?starch\b/],
    explanation: 'An emulsifier or texture agent appears in the ingredient list.'
  },
  {
    id: 'flavor_enhancer', label: 'Flavor enhancer', severity: 'moderate', points: -7, minimumTier: 3,
    patterns: [/\bmonosodium glutamate\b/, /\bmsg\b/, /\bdisodium (inosinate|guanylate)\b/, /\byeast extract\b/, /\bautolyzed yeast\b/, /\bhydrolyzed ([a-z ]*)?protein\b/],
    explanation: 'A concentrated flavor enhancer appears in the ingredient list.'
  }
];

export const INGREDIENT_POSITIVE_RULES: ProductIngredientRule[] = [
  {
    id: 'organic_label', label: 'Organic label', severity: 'positive', points: 5,
    patterns: [/\borganic\b/], explanation: 'An organic claim appears in the available label data.'
  },
  {
    id: 'whole_grain', label: 'Whole-grain ingredient', severity: 'positive', points: 4,
    patterns: [/\bwhole[- ]grain\b/, /\bwhole[- ]wheat\b/, /\bwhole oats?\b/], explanation: 'A whole-grain ingredient appears in the label.'
  },
  {
    id: 'fermented_food', label: 'Cultured or fermented food', severity: 'positive', points: 3,
    patterns: [/\bfermented\b/, /\bcultured\b/, /\bkefir\b/, /\bsauerkraut\b/, /\bkimchi\b/, /\blive (and )?active cultures\b/], explanation: 'A cultured or fermented ingredient signal appears in the label.'
  },
  {
    id: 'traditional_oil', label: 'Straightforward oil source', severity: 'positive', points: 2,
    patterns: [/\bextra virgin olive oil\b/, /\bavocado oil\b/, /\b(virgin )?coconut oil\b/, /\bghee\b/], explanation: 'The label names a straightforward oil source.'
  },
  {
    id: 'prebiotic_fiber', label: 'Added fiber source', severity: 'positive', points: 2,
    patterns: [/\binulin\b/, /\bchicory root\b/, /\bcassava root fiber\b/, /\bprebiotic\b/], explanation: 'An added fiber source appears in the label.'
  }
];

export const MAX_INGREDIENT_BONUS = 10;
