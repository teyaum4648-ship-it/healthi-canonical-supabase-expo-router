import type { RuleFamily } from './profiles';

export type ProductRuleSeverity = 'strong' | 'moderate' | 'light' | 'positive';

export type ProductIngredientRule = {
  id: string;
  family: RuleFamily;
  label: string;
  severity: ProductRuleSeverity;
  points: number;
  patterns: RegExp[];
  explanation: string;
  minimumIngredients?: number;
  firstIngredientsAdjustment?: number;
  evidence_refs?: string[];
  userVisible?: boolean;
};

export const INGREDIENT_CONSIDERATION_RULES: ProductIngredientRule[] = [
  {
    id: 'hydrogenated_oil', family: 'oils', label: 'Hydrogenated oil', severity: 'strong', points: -16,
    patterns: [/\b(partially )?hydrogenated\b/, /\binteresterified\b/],
    explanation: 'A hydrogenated fat appears in the ingredient list.', evidence_refs: ['bmj_ultraprocessed_umbrella_review']
  },
  {
    id: 'artificial_color', family: 'colors', label: 'Color additive', severity: 'strong', points: -14,
    patterns: [/\bred (dye )?(no\.? ?)?(40|3)\b/, /\byellow (dye )?(no\.? ?)?(5|6)\b/, /\bblue (dye )?(no\.? ?)?(1|2)\b/, /\bartificial colou?r(s|ing)?\b/, /\bfd&c\b/, /\btitanium dioxide\b/],
    explanation: 'A color additive appears in the ingredient list.', evidence_refs: ['bmj_ultraprocessed_umbrella_review']
  },
  {
    id: 'sucralose', family: 'sweeteners', label: 'Sucralose', severity: 'moderate', points: -5,
    patterns: [/\bsucralose\b/], explanation: 'Sucralose appears in the ingredient list.', evidence_refs: ['fda_sweeteners_safety']
  },
  {
    id: 'aspartame', family: 'sweeteners', label: 'Aspartame', severity: 'moderate', points: -5,
    patterns: [/\baspartame\b/], explanation: 'Aspartame appears in the ingredient list.', evidence_refs: ['fda_sweeteners_safety']
  },
  {
    id: 'acesulfame_potassium', family: 'sweeteners', label: 'Acesulfame potassium', severity: 'moderate', points: -5,
    patterns: [/\bacesulfame( potassium)?\b/, /\bace-?k\b/], explanation: 'Acesulfame potassium appears in the ingredient list.', evidence_refs: ['fda_sweeteners_safety']
  },
  {
    id: 'saccharin', family: 'sweeteners', label: 'Saccharin', severity: 'moderate', points: -5,
    patterns: [/\bsaccharin\b/], explanation: 'Saccharin appears in the ingredient list.', evidence_refs: ['fda_sweeteners_safety']
  },
  {
    id: 'stevia_context', family: 'sweeteners', label: 'Stevia context', severity: 'light', points: 0,
    patterns: [/\bstevia\b/], explanation: 'Stevia appears in the ingredient list.', userVisible: false
  },
  {
    id: 'monk_fruit_context', family: 'sweeteners', label: 'Monk fruit context', severity: 'light', points: 0,
    patterns: [/\bmonk fruit\b/], explanation: 'Monk fruit appears in the ingredient list.', userVisible: false
  },
  {
    id: 'allulose_context', family: 'sweeteners', label: 'Allulose context', severity: 'light', points: 0,
    patterns: [/\ballulose\b/], explanation: 'Allulose appears in the ingredient list.', userVisible: false
  },
  {
    id: 'maltitol', family: 'sweeteners', label: 'Maltitol', severity: 'moderate', points: -5,
    patterns: [/\bmaltitol\b/], explanation: 'Maltitol appears in the ingredient list, and personal digestion response can vary.', evidence_refs: ['fda_sugar_alcohol_notice']
  },
  {
    id: 'xylitol', family: 'sweeteners', label: 'Xylitol', severity: 'light', points: -2,
    patterns: [/\bxylitol\b/], explanation: 'Xylitol appears in the ingredient list, and personal digestion response can vary.', evidence_refs: ['fda_sugar_alcohol_notice']
  },
  {
    id: 'other_sugar_alcohol', family: 'sweeteners', label: 'Sugar alcohol', severity: 'light', points: -3,
    patterns: [/\bsorbitol\b/, /\bmannitol\b/, /\blactitol\b/],
    explanation: 'A sugar alcohol appears in the ingredient list, and personal digestion response can vary.', evidence_refs: ['fda_sugar_alcohol_notice']
  },
  {
    id: 'erythritol_context', family: 'sweeteners', label: 'Erythritol context', severity: 'light', points: -2,
    patterns: [/\berythritol\b/], explanation: 'Erythritol appears in the ingredient list, and personal response can vary.'
  },
  {
    id: 'industrial_preservative', family: 'flavor_systems', label: 'Added preservative', severity: 'moderate', points: -6,
    patterns: [/\bbha\b/, /\bbht\b/, /\btbhq\b/, /\b(sodium|potassium) benzoate\b/, /\b(potassium|calcium|sodium) sorbate\b/, /\b(calcium|sodium) propionate\b/, /\bedta\b/],
    explanation: 'A shelf-life preservative appears in the ingredient list.', evidence_refs: ['bmj_ultraprocessed_umbrella_review']
  },
  {
    id: 'added_nitrite', family: 'flavor_systems', label: 'Added nitrite or nitrate', severity: 'moderate', points: -8,
    patterns: [/\b(sodium|potassium) (nitrite|nitrate)\b/, /\bcultured celery (powder|juice|extract)\b/],
    explanation: 'A curing ingredient appears in the ingredient list.'
  },
  {
    id: 'refined_oil_blend', family: 'oils', label: 'Oil blend', severity: 'moderate', points: -6,
    patterns: [/\bvegetable oils?\b/, /\bblend of [a-z ,]*(canola|soybean|sunflower|safflower|corn|cottonseed|grapeseed) oils?\b/, /\b(canola|soybean|sunflower|safflower|corn|cottonseed|grapeseed) oil blend\b/],
    firstIngredientsAdjustment: -2, explanation: 'An oil blend adds formulation complexity to the ingredient pattern.'
  },
  {
    id: 'multiple_named_oils', family: 'oils', label: 'Multiple-oil system', severity: 'light', points: -4,
    patterns: [/\b(?:canola|rapeseed|soybean|sunflower|safflower|corn|cottonseed|grapeseed|palm|coconut|avocado|olive) oil\b[^;]{0,120}\b(?:canola|rapeseed|soybean|sunflower|safflower|corn|cottonseed|grapeseed|palm|coconut|avocado|olive) oil\b/],
    explanation: 'Multiple named oils create a broader oil system than a single-source formula.'
  },
  {
    id: 'explicit_refined_oil', family: 'oils', label: 'Explicitly refined oil', severity: 'light', points: -3,
    patterns: [/\brefined (canola|rapeseed|soybean|sunflower|safflower|corn|cottonseed|grapeseed|palm) oil\b/],
    explanation: 'The label explicitly identifies a refined oil.'
  },
  {
    id: 'formulated_fat', family: 'oils', label: 'Formulated fat', severity: 'moderate', points: -6,
    patterns: [/\bvegetable shortening\b/, /\bmargarine\b/], explanation: 'A formulated fat appears in the ingredient list.'
  },
  {
    id: 'added_sugar', family: 'refined_syrups', label: 'Refined sugar or syrup', severity: 'moderate', points: -6,
    patterns: [/\bhigh[- ]fructose corn syrup\b/, /\bhfcs\b/, /(?<!coconut )(?<!date )\bsugar\b/, /\bcane sugar\b/, /\bcorn syrup\b/, /(?<!cultured )\bdextrose\b/, /\bsucrose\b/, /\binvert sugar\b/, /\bmaltodextrin\b/],
    minimumIngredients: 2, firstIngredientsAdjustment: -2,
    explanation: 'A refined sugar or syrup appears in the ingredient list.', evidence_refs: ['fda_daily_values']
  },
  {
    id: 'refined_flour', family: 'ingredient_simplicity', label: 'Refined flour', severity: 'moderate', points: -5,
    patterns: [/\benriched ([a-z ]*)?flour\b/, /\bbleached flour\b/, /(?<!whole[- ])(?<!whole grain )\bwheat flour\b/],
    explanation: 'A refined or enriched flour appears in the ingredient list.'
  },
  {
    id: 'artificial_flavor', family: 'flavor_systems', label: 'Artificial flavor', severity: 'moderate', points: -7,
    patterns: [/\bartificial flavou?r(s|ing)?\b/, /\b(ethyl )?vanillin\b/],
    explanation: 'An artificial flavor appears in the ingredient list.', evidence_refs: ['bmj_ultraprocessed_umbrella_review']
  },
  {
    id: 'flavor_blend', family: 'flavor_systems', label: 'Unspecified flavor blend', severity: 'light', points: -2,
    patterns: [/\bnatural flavou?r(s|ing)?\b/], explanation: 'The label includes a flavor blend without listing its individual components.'
  },
  {
    id: 'emulsifier', family: 'emulsifiers_gums', label: 'Emulsifier or texture agent', severity: 'light', points: -4,
    patterns: [/\bpolysorbate ?(60|80)\b/, /\bcarrageenan\b/, /\b(carboxymethyl)?cellulose( gum)?\b/, /\bmono-? ?and di-?glycerides\b/, /\bxanthan gum\b/, /\bguar gum\b/, /\bgellan gum\b/, /\bmodified (food |corn |tapioca |potato )?starch\b/],
    explanation: 'An emulsifier or texture agent appears in the ingredient list.', evidence_refs: ['bmj_ultraprocessed_umbrella_review']
  },
  {
    id: 'flavor_enhancer', family: 'flavor_systems', label: 'Flavor enhancer', severity: 'moderate', points: -6,
    patterns: [/\bmonosodium glutamate\b/, /\bmsg\b/, /\bdisodium (inosinate|guanylate)\b/, /\byeast extract\b/, /\bautolyzed yeast\b/, /\bhydrolyzed ([a-z ]*)?protein\b/],
    explanation: 'A concentrated flavor enhancer appears in the ingredient list.', evidence_refs: ['bmj_ultraprocessed_umbrella_review']
  }
];

export const INGREDIENT_POSITIVE_RULES: ProductIngredientRule[] = [
  {
    id: 'organic_label', family: 'claim_alignment', label: 'Organic label', severity: 'positive', points: 1,
    patterns: [/\borganic\b/], explanation: 'An organic claim appears in the available label data.'
  },
  {
    id: 'whole_grain', family: 'claim_alignment', label: 'Whole-grain ingredient', severity: 'positive', points: 4,
    patterns: [/\bwhole[- ]grain\b/, /\bwhole[- ]wheat\b/, /\bwhole oats?\b/], explanation: 'A whole-grain ingredient appears in the label.'
  },
  {
    id: 'fermented_food', family: 'claim_alignment', label: 'Cultured or fermented food', severity: 'positive', points: 3,
    patterns: [/\bfermented\b/, /\bcultured(?! (dextrose|celery))\b/, /\bkefir\b/, /\bsauerkraut\b/, /\bkimchi\b/, /\blive (and )?active cultures\b/],
    explanation: 'A cultured or fermented ingredient signal appears in the label.'
  },
  {
    id: 'traditional_oil', family: 'oils', label: 'Straightforward oil source', severity: 'positive', points: 5,
    patterns: [/\bextra virgin olive oil\b/, /\bavocado oil\b/, /\b(virgin )?coconut oil\b/, /\bghee\b/],
    explanation: 'The label names a straightforward oil source.'
  },
  {
    id: 'high_oleic_oil', family: 'oils', label: 'Explicit high-oleic oil', severity: 'positive', points: 2,
    patterns: [/\bhigh[- ]oleic (sunflower|safflower|canola) oil\b/],
    explanation: 'The label identifies a specific high-oleic oil rather than an unspecified blend.'
  },
  {
    id: 'prebiotic_fiber', family: 'claim_alignment', label: 'Prebiotic fiber source', severity: 'positive', points: 5,
    patterns: [/\binulin\b/, /\bchicory root\b/, /\bcassava root fiber\b/, /\bacacia fiber\b/],
    explanation: 'A named prebiotic fiber source appears in the label.', evidence_refs: ['fda_daily_values']
  }
];

export const MAX_INGREDIENT_BONUS = 12;
