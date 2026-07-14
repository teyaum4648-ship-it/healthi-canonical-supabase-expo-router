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
  evidence_refs?: string[];
};

export const INGREDIENT_CONSIDERATION_RULES: ProductIngredientRule[] = [
  {
    id: 'hydrogenated_oil', label: 'Hydrogenated oil', severity: 'strong', points: -20, scoreCap: 30, minimumTier: 4,
    patterns: [/\b(partially )?hydrogenated\b/, /\binteresterified\b/],
    explanation: 'A hydrogenated fat appears in the ingredient list.',
    evidence_refs: ['bmj_ultraprocessed_umbrella_review']
  },
  {
    id: 'artificial_color', label: 'Artificial color', severity: 'strong', points: -18, scoreCap: 38, minimumTier: 4,
    patterns: [/\bred (dye )?(no\.? ?)?(40|3)\b/, /\byellow (dye )?(no\.? ?)?(5|6)\b/, /\bblue (dye )?(no\.? ?)?(1|2)\b/, /\bartificial colou?r(s|ing)?\b/, /\bfd&c\b/, /\btitanium dioxide\b/],
    explanation: 'A color additive appears in the ingredient list.',
    evidence_refs: ['bmj_ultraprocessed_umbrella_review']
  },
  {
    id: 'non_sugar_sweetener', label: 'Non-sugar sweetener', severity: 'moderate', points: -7, minimumTier: 3,
    patterns: [/\baspartame\b/, /\bsucralose\b/, /\bacesulfame( potassium)?\b/, /\bace-?k\b/, /\bsaccharin\b/, /\bneotame\b/, /\bstevia\b/, /\bmonk fruit\b/],
    explanation: 'A non-sugar sweetener is a watch signal, but it does not automatically make a product a low-grade choice.',
    evidence_refs: ['fda_sweeteners_safety', 'who_nss_weight_control']
  },
  {
    id: 'sugar_alcohol', label: 'Sugar alcohol', severity: 'light', points: -2, minimumTier: 3,
    patterns: [/\berythritol\b/, /\bxylitol\b/, /\bsorbitol\b/, /\bmaltitol\b/, /\bmannitol\b/, /\blactitol\b/],
    explanation: 'A sugar alcohol appears in the ingredient list, and personal digestion response can vary.',
    evidence_refs: ['fda_sugar_alcohol_notice']
  },
  {
    id: 'industrial_preservative', label: 'Added preservative', severity: 'moderate', points: -9, minimumTier: 3,
    patterns: [/\bbha\b/, /\bbht\b/, /\btbhq\b/, /\b(sodium|potassium) benzoate\b/, /\b(potassium|calcium|sodium) sorbate\b/, /\b(calcium|sodium) propionate\b/, /\bedta\b/],
    explanation: 'A shelf-life preservative appears in the ingredient list.',
    evidence_refs: ['bmj_ultraprocessed_umbrella_review']
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
    explanation: 'A refined added sugar appears in the ingredient list.',
    evidence_refs: ['fda_daily_values']
  },
  {
    id: 'refined_flour', label: 'Refined flour', severity: 'moderate', points: -7, minimumTier: 3,
    patterns: [/\benriched ([a-z ]*)?flour\b/, /\bbleached flour\b/, /(?<!whole[- ])(?<!whole grain )\bwheat flour\b/],
    explanation: 'A refined or enriched flour appears in the ingredient list.'
  },
  {
    id: 'artificial_flavor', label: 'Artificial flavor', severity: 'moderate', points: -10, scoreCap: 52, minimumTier: 4,
    patterns: [/\bartificial flavou?r(s|ing)?\b/, /\b(ethyl )?vanillin\b/],
    explanation: 'An artificial flavor appears in the ingredient list.',
    evidence_refs: ['bmj_ultraprocessed_umbrella_review']
  },
  {
    id: 'flavor_blend', label: 'Unspecified flavor blend', severity: 'light', points: -4, minimumTier: 3,
    patterns: [/\bnatural flavou?r(s|ing)?\b/],
    explanation: 'The label includes a flavor blend without listing its individual components.'
  },
  {
    id: 'emulsifier', label: 'Emulsifier or texture agent', severity: 'light', points: -5, minimumTier: 3,
    patterns: [/\bpolysorbate ?(60|80)\b/, /\bcarrageenan\b/, /\b(carboxymethyl)?cellulose( gum)?\b/, /\bmono-? ?and di-?glycerides\b/, /\bxanthan gum\b/, /\bguar gum\b/, /\bgellan gum\b/, /\bmodified (food |corn |tapioca |potato )?starch\b/],
    explanation: 'An emulsifier or texture agent appears in the ingredient list.',
    evidence_refs: ['bmj_ultraprocessed_umbrella_review']
  },
  {
    id: 'flavor_enhancer', label: 'Flavor enhancer', severity: 'moderate', points: -7, minimumTier: 3,
    patterns: [/\bmonosodium glutamate\b/, /\bmsg\b/, /\bdisodium (inosinate|guanylate)\b/, /\byeast extract\b/, /\bautolyzed yeast\b/, /\bhydrolyzed ([a-z ]*)?protein\b/],
    explanation: 'A concentrated flavor enhancer appears in the ingredient list.',
    evidence_refs: ['bmj_ultraprocessed_umbrella_review']
  }
];

export const INGREDIENT_POSITIVE_RULES: ProductIngredientRule[] = [
  {
    id: 'organic_label', label: 'Organic label', severity: 'positive', points: 1,
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
    id: 'traditional_oil', label: 'Straightforward oil source', severity: 'positive', points: 5,
    patterns: [/\bextra virgin olive oil\b/, /\bavocado oil\b/, /\b(virgin )?coconut oil\b/, /\bghee\b/], explanation: 'The label names a straightforward oil source.'
  },
  {
    id: 'prebiotic_fiber', label: 'Prebiotic fiber source', severity: 'positive', points: 6,
    patterns: [/\binulin\b/, /\bchicory root\b/, /\bcassava root fiber\b/, /\bprebiotic\b/],
    explanation: 'A prebiotic fiber source appears in the label.',
    evidence_refs: ['fda_daily_values', 'fda_sugar_alcohol_notice']
  }
];

export const MAX_INGREDIENT_BONUS = 12;
