import type { ProductForm } from './categories';
import { resolveProductCategory, type CategoryResolution } from './categoryResolution';
import { resolveProductEvidence, type ProductEvidenceRef } from './evidence';
import {
  getCategoryProfile,
  type CategoryProfile,
  type NutrientBasisPreference,
  type RuleFamily,
  type RulePolicyStatus
} from './profiles';
import {
  INGREDIENT_CONSIDERATION_RULES,
  INGREDIENT_POSITIVE_RULES,
  type ProductIngredientRule,
  type ProductRuleSeverity
} from './rules';

export type ProductProcessingTier = 1 | 2 | 3 | 4;
export type ProductScoreLabel = 'supportive' | 'steady' | 'watch' | 'calibrating';
export type ProductLetterGrade = 'A' | 'B' | 'C' | 'D' | 'F';
export type ProductGradeBand = 'strong' | 'solid' | 'mixed' | 'cautious' | 'avoid' | 'calibrating';
export type DataConfidence = 'low' | 'medium' | 'high';

export type ProductBetterOption = {
  title: 'What to Compare';
  summary: string;
  criteria: string[];
  reason_codes: string[];
};

export type ProductNutrients = {
  calories?: number | null;
  sugar_g?: number | null;
  carbs_g?: number | null;
  protein_g?: number | null;
  fat_g?: number | null;
  fiber_g?: number | null;
  sodium_mg?: number | null;
  saturated_fat_g?: number | null;
};

export type ProductMacroContext = {
  summary: string;
  highlights: string[];
};

export type ProductNutrientBasis = {
  type: 'provider_serving' | 'prepared_serving' | 'per_100g' | 'pantry_context' | 'unknown';
  source: 'provided' | 'fallback' | 'context_only' | 'unavailable';
  confidence: DataConfidence;
  nutrients: ProductNutrients;
};

export type ProductScoringInput = {
  name: string;
  ingredientsText?: string | null;
  labels?: string[];
  category?: string | null;
  categoryTags?: string[];
  packaging?: string[];
  nutrimentsPer100g?: ProductNutrients;
  servingNutrients?: ProductNutrients & { serving_quantity_g?: number | null };
  preparedServingNutrients?: ProductNutrients;
  sourceConfidence?: DataConfidence;
  ingredientEvidenceStatus?: 'complete' | 'partial' | 'reconstructed' | 'absent';
};

export type ProductScoreLedgerStatus = 'applied' | 'suppressed' | 'context_only' | 'unavailable';
export type ProductExplanationPolarity = 'help' | 'consideration' | 'neutral_detail' | 'hidden';
export type ProductScoreLedgerEntry = {
  ruleId: string;
  ruleFamily: RuleFamily;
  label: string;
  status: ProductScoreLedgerStatus;
  delta: number;
  evidence: string[];
  reasonCode: string;
  presentation: ProductExplanationPolarity;
  visibility: 'helps' | 'consider' | 'none';
  userVisibleExplanation: string | null;
  hiddenReason?: string;
  transformation?: 'clamp' | 'grade_eligibility';
};

export type ProductGradeEligibility = {
  aEligible: boolean;
  ingredientIntegrity: boolean;
  formulationComplexity: boolean;
  categoryStandardQuality: boolean;
  majorWatchSignals: boolean;
  labelTransparency: boolean;
  deniedReasons: string[];
};

export type ProductScoreFactor = {
  id: string;
  label: string;
  points: number;
  rawPoints: number;
  severity: ProductRuleSeverity;
  matched: string[];
  explanation: string;
  evidence_refs?: string[];
};

export type ProductScoringResult = {
  absoluteScore: number | null;
  rawScore: number | null;
  categoryScore: number | null;
  categoryComparisonAvailable: boolean;
  displayScore: number | null;
  letterGrade: ProductLetterGrade | null;
  gradeBand: ProductGradeBand;
  gradeLabel: string;
  label: ProductScoreLabel;
  tier: ProductProcessingTier | null;
  tierLabel: string;
  categoryId: string | null;
  categoryLabel: string | null;
  categoryResolution: CategoryResolution;
  productForm: ProductForm | null;
  preparedUse: string | null;
  nutrientBasis: ProductNutrientBasis;
  macroContext: ProductMacroContext;
  factors: ProductScoreFactor[];
  topDrivers: ProductScoreFactor[];
  scoreLedger: ProductScoreLedgerEntry[];
  scoreBaseline: number | null;
  scoreCap: { ruleId: string; label: string; cap: number } | null;
  gradeEligibility: ProductGradeEligibility | null;
  sourceConfidence: DataConfidence;
  interpretationConfidence: DataConfidence;
  confidence: DataConfidence;
  summary: string;
  positives: string[];
  considerations: string[];
  better_options: ProductBetterOption[];
  evidence_refs: ProductEvidenceRef[];
  reasonCodes: string[];
};

const SHARED_BASELINE = 75;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/\band\/or\b/g, ',').replace(/\d+(\.\d+)?\s?%/g, '').replace(/\s+/g, ' ').trim();
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function lowerConfidence(left: DataConfidence, right: DataConfidence): DataConfidence {
  const order: Record<DataConfidence, number> = { low: 0, medium: 1, high: 2 };
  return order[left] <= order[right] ? left : right;
}

function hasNutrients(nutrients: ProductNutrients | null | undefined): boolean {
  return Object.values(nutrients ?? {}).some((value) => typeof value === 'number' && Number.isFinite(value));
}

export function splitIngredientList(text: string): string[] {
  const tokens: string[] = [];
  let depth = 0;
  let current = '';
  for (const character of text) {
    if (character === '(' || character === '[') depth += 1;
    if (character === ')' || character === ']') depth = Math.max(0, depth - 1);
    if ((character === ',' || character === ';') && depth === 0) {
      if (current.trim()) tokens.push(current.trim());
      current = '';
    } else current += character;
  }
  if (current.trim()) tokens.push(current.trim());
  return tokens.filter((token) => token.replace(/[^a-z]/gi, '').length > 0);
}

function sourceConfidence(input: ProductScoringInput): DataConfidence {
  if (!input.ingredientsText?.trim() && (input.ingredientEvidenceStatus ?? 'absent') === 'absent') return 'low';
  if (input.sourceConfidence) return input.sourceConfidence;
  const count = [
    ...Object.values(input.nutrimentsPer100g ?? {}),
    ...Object.values(input.servingNutrients ?? {}),
    ...Object.values(input.preparedServingNutrients ?? {})
  ].filter((value) => typeof value === 'number' && Number.isFinite(value)).length;
  if (count >= 5 && input.ingredientsText?.trim()) return 'high';
  if (count >= 2 || input.ingredientsText?.trim()) return 'medium';
  return 'low';
}

function selectNutrientBasis(input: ProductScoringInput, preference: NutrientBasisPreference): ProductNutrientBasis {
  if (preference === 'pantry_context') {
    if (hasNutrients(input.servingNutrients)) return {
      type: 'pantry_context',
      source: 'context_only',
      confidence: 'medium',
      nutrients: { ...(input.servingNutrients ?? {}) }
    };
    if (hasNutrients(input.nutrimentsPer100g)) return {
      type: 'per_100g', source: 'fallback', confidence: 'medium', nutrients: { ...input.nutrimentsPer100g }
    };
    return { type: 'unknown', source: 'unavailable', confidence: 'low', nutrients: {} };
  }
  if (preference === 'prepared_serving') {
    if (hasNutrients(input.preparedServingNutrients)) return {
      type: 'prepared_serving', source: 'provided', confidence: 'high', nutrients: { ...input.preparedServingNutrients }
    };
    if (hasNutrients(input.servingNutrients)) return {
      type: 'prepared_serving', source: 'fallback', confidence: 'medium', nutrients: { ...input.servingNutrients }
    };
    if (hasNutrients(input.nutrimentsPer100g)) return {
      type: 'per_100g', source: 'fallback', confidence: 'medium', nutrients: { ...input.nutrimentsPer100g }
    };
    return { type: 'unknown', source: 'unavailable', confidence: 'low', nutrients: {} };
  }
  if (preference === 'per_100g') {
    if (hasNutrients(input.nutrimentsPer100g)) return {
      type: 'per_100g', source: 'provided', confidence: 'high', nutrients: { ...input.nutrimentsPer100g }
    };
    return { type: 'unknown', source: 'unavailable', confidence: 'low', nutrients: {} };
  }
  if (hasNutrients(input.servingNutrients)) return {
    type: 'provider_serving', source: 'provided', confidence: 'high', nutrients: { ...input.servingNutrients }
  };
  if (hasNutrients(input.nutrimentsPer100g)) return {
    type: 'per_100g', source: 'fallback', confidence: 'medium', nutrients: { ...input.nutrimentsPer100g }
  };
  return { type: 'unknown', source: 'unavailable', confidence: 'low', nutrients: {} };
}

function macroContext(basis: ProductNutrientBasis, profile: CategoryProfile | null): ProductMacroContext {
  const nutrients = basis.nutrients;
  const highlights: string[] = [];
  if (typeof nutrients.calories === 'number') highlights.push(`${nutrients.calories} calories on the selected ${basis.type.replaceAll('_', ' ')} basis.`);
  if (typeof nutrients.protein_g === 'number') highlights.push(`${nutrients.protein_g} g protein.`);
  if (typeof nutrients.carbs_g === 'number') highlights.push(`${nutrients.carbs_g} g carbohydrate.`);
  if (typeof nutrients.fat_g === 'number') highlights.push(`${nutrients.fat_g} g fat.`);
  if (typeof nutrients.fiber_g === 'number') highlights.push(`${nutrients.fiber_g} g fiber.`);
  if (typeof nutrients.sodium_mg === 'number' && profile?.rulePolicy.sodium_density === 'context_only') {
    highlights.push('Sodium is interpreted as category context rather than a generic quality penalty.');
  }
  return {
    summary: 'Macros describe the selected product-use basis and do not automatically determine label quality.',
    highlights
  };
}

function matchRule(rule: ProductIngredientRule, text: string, tokens: string[]): { matched: string[]; points: number } | null {
  if (rule.minimumIngredients && tokens.length < rule.minimumIngredients) return null;
  const matched = new Set<string>();
  for (const pattern of rule.patterns) {
    const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`;
    text.match(new RegExp(pattern.source, flags))?.forEach((value) => matched.add(value.trim()));
  }
  if (matched.size === 0) return null;
  let points = rule.points;
  if (rule.firstIngredientsAdjustment) {
    const firstThree = tokens.slice(0, 3).join(' | ');
    if (rule.patterns.some((pattern) => new RegExp(pattern.source, pattern.flags.replace('g', '')).test(firstThree))) points += rule.firstIngredientsAdjustment;
  }
  return { matched: [...matched], points };
}

function ledgerEntry(input: {
  ruleId: string;
  family: RuleFamily;
  label: string;
  policy: RulePolicyStatus;
  requestedDelta: number;
  evidence?: string[];
  explanation?: string;
  hiddenReason?: string;
  showContext?: boolean;
  presentation?: ProductExplanationPolarity;
}): ProductScoreLedgerEntry {
  const status: ProductScoreLedgerStatus = input.policy === 'apply'
    ? 'applied'
    : input.policy === 'suppress'
      ? 'suppressed'
      : input.policy;
  const delta = status === 'applied' ? input.requestedDelta : 0;
  const canPresentContext = status !== 'context_only' || input.showContext !== false;
  const presentation = input.presentation ?? (
    !canPresentContext
      ? 'hidden'
      : input.requestedDelta > 0
        ? 'help'
        : input.requestedDelta < 0
          ? 'consideration'
          : 'hidden'
  );
  const visibility = presentation === 'help'
    ? 'helps'
    : presentation === 'consideration'
      ? 'consider'
      : 'none';
  const userVisibleExplanation = visibility === 'none' ? null : input.explanation ?? null;
  return {
    ruleId: input.ruleId,
    ruleFamily: input.family,
    label: input.label,
    status,
    delta,
    evidence: [...(input.evidence ?? [])],
    reasonCode: input.ruleId,
    presentation,
    visibility,
    userVisibleExplanation,
    ...(visibility === 'none' ? { hiddenReason: input.hiddenReason ?? `The ${input.family} family is ${status} by the selected category profile.` } : {})
  };
}

function policyFor(profile: CategoryProfile, rule: ProductIngredientRule): RulePolicyStatus {
  return profile.ruleOverrides?.[rule.id] ?? profile.rulePolicy[rule.family];
}

function ingredientLedger(
  profile: CategoryProfile,
  ingredients: string,
  tokens: string[],
  labels: string[]
): ProductScoreLedgerEntry[] {
  const textWithLabels = normalize(`${ingredients} ${labels.join(' ')}`);
  const considerationMatches = INGREDIENT_CONSIDERATION_RULES.flatMap((rule) => {
    const match = matchRule(rule, ingredients, tokens);
    return match ? [{ rule, match }] : [];
  });
  const hasConflictingOilSystem = considerationMatches.some(({ rule }) => ['refined_oil_blend', 'multiple_named_oils', 'formulated_fat'].includes(rule.id));
  const positiveMatches = INGREDIENT_POSITIVE_RULES.flatMap((rule) => {
    const match = matchRule(rule, textWithLabels, tokens);
    return match ? [{ rule, match }] : [];
  });
  return [...considerationMatches, ...positiveMatches].map(({ rule, match }) => {
    const conflictSuppressed = ['traditional_oil', 'high_oleic_oil'].includes(rule.id) && hasConflictingOilSystem;
    const selectedPolicy = conflictSuppressed ? 'suppress' : policyFor(profile, rule);
    return ledgerEntry({
      ruleId: rule.id,
      family: rule.family,
      label: rule.label,
      policy: selectedPolicy,
      requestedDelta: match.points,
      evidence: [...match.matched, ...(rule.evidence_refs ?? [])],
      explanation: rule.explanation,
      showContext: rule.userVisible,
      hiddenReason: conflictSuppressed
        ? 'A broader refined-oil system contradicts the straightforward-oil signal.'
        : undefined
    });
  });
}

function addCategoryRule(
  ledger: ProductScoreLedgerEntry[],
  profile: CategoryProfile,
  input: {
    id: string;
    family: RuleFamily;
    label: string;
    delta: number;
    evidence: string[];
    explanation: string;
    presentation?: ProductExplanationPolarity;
  }
): void {
  ledger.push(ledgerEntry({
    ruleId: input.id,
    family: input.family,
    label: input.label,
    policy: profile.ruleOverrides?.[input.id] ?? profile.rulePolicy[input.family],
    requestedDelta: input.delta,
    evidence: input.evidence,
    explanation: input.explanation,
    presentation: input.presentation
  }));
}

function categoryLedger(
  profile: CategoryProfile,
  input: ProductScoringInput,
  ingredients: string,
  tokens: string[],
  basis: ProductNutrientBasis,
  ingredientEvidenceAvailable = true
): ProductScoreLedgerEntry[] {
  const ledger: ProductScoreLedgerEntry[] = [];
  const nutrients = basis.nutrients;
  const categoryId = profile.categoryId;
  const supportsServingRules = basis.type === 'provider_serving' || basis.type === 'prepared_serving';
  const supportsCategoryNutrientRules = supportsServingRules || (
    basis.type === 'per_100g' && profile.nutrientBasis === 'per_100g'
  );
  const short = tokens.length <= 5;
  const moderate = tokens.length > 5 && tokens.length <= 8;
  const complexityDelta = short ? 8 : moderate ? 3 : tokens.length > 12 ? -4 : 0;
  if (complexityDelta !== 0) addCategoryRule(ledger, profile, {
    id: complexityDelta > 0 ? 'ingredient_simplicity' : 'ingredient_complexity',
    family: 'ingredient_simplicity',
    label: complexityDelta > 0 ? 'Straightforward ingredient pattern' : 'Complex ingredient pattern',
    delta: complexityDelta,
    evidence: [`${tokens.length} top-level ingredients`],
    explanation: complexityDelta > 0 ? 'The ingredient pattern is straightforward for this product category.' : 'The ingredient pattern is more complex for this product category.'
  });

  const add = (
    id: string,
    family: RuleFamily,
    label: string,
    delta: number,
    evidence: string[],
    explanation: string,
    presentation?: ProductExplanationPolarity
  ) => addCategoryRule(ledger, profile, { id, family, label, delta, evidence, explanation, presentation });

  if (categoryId === 'ice_cream' && /\b(cream|milk)\b/.test(ingredients) && /\b(egg yolks?|vanilla|cocoa|chocolate)\b/.test(ingredients)) {
    add('traditional_ice_cream_base', 'claim_alignment', 'Traditional ice-cream base', 8, ['cream/milk base', 'traditional flavor base'], 'The label uses a traditional ice-cream base for this category.');
  }
  if (categoryId === 'plant_milk' && /\b(filtered )?water\b/.test(ingredients) && /\b(almonds?|oats?|cashews?|coconut)\b/.test(ingredients)) {
    add('plant_milk_base', 'claim_alignment', 'Plant-milk base', 6, ['water + named plant base'], 'The label has a straightforward water and plant base.');
  }
  if (categoryId === 'marinara' && /\btomato(es)?\b/.test(ingredients) && /\b(olive oil|onion|garlic|basil|oregano)\b/.test(ingredients)) {
    add('marinara_base', 'claim_alignment', 'Marinara base', 7, ['tomato + culinary oil/seasoning'], 'The label has a straightforward tomato, oil, and seasoning pattern.');
  }
  if (categoryId === 'electrolyte' && /\b(sodium|potassium|magnesium)\b/.test(ingredients)) {
    add('electrolyte_alignment', 'claim_alignment', 'Electrolyte formula alignment', 5, ['named electrolyte mineral'], 'Named electrolyte minerals align with the intended hydration-mix use.');
  }
  if ((categoryId === 'chips' || categoryId === 'crackers') && /\b(avocado oil|extra virgin olive oil|olive oil|coconut oil)\b/.test(ingredients)) {
    add('clear_oil_category_fit', 'oils', 'Clear oil source', 5, ['named oil source'], 'The label names a straightforward oil source for this snack category.');
  }
  if (categoryId === 'protein_bar') {
    const wholeFruitBinder = /\b(dates?|date paste|figs?|prunes?|raisins?)\b/.test(ingredients);
    const recognizableProtein = /\b(egg whites?|eggs?)\b/.test(ingredients);
    const nutsOrSeeds = /\b(almonds?|cashews?|peanuts?|walnuts?|pecans?|pistachios?|hazelnuts?|sunflower seeds?|pumpkin seeds?|chia seeds?|flax seeds?)\b/.test(ingredients);
    const formulationSystem = /\b(protein isolate|protein concentrate|corn syrup|rice syrup|tapioca syrup|natural flavou?r|artificial flavou?r|vegetable oils?|xanthan gum|guar gum|carrageenan|lecithin)\b/.test(ingredients);
    if (wholeFruitBinder && recognizableProtein && nutsOrSeeds && tokens.length <= 7 && !formulationSystem) {
      add('whole_ingredient_bar_pattern', 'claim_alignment', 'Whole-ingredient bar pattern', 7,
        ['whole-fruit binder', 'recognizable protein source', 'nuts or seeds'],
        'The bar uses a whole-fruit binder, a recognizable protein source, and nuts or seeds without a broader formulation system.');
    }
  }
  const isolatedProteinOrFiber = /\b(whey protein|milk protein|pea protein|protein isolate|protein concentrate|inulin|chicory root|cassava root fiber|acacia fiber)\b/.test(ingredients);
  if (isolatedProteinOrFiber && ['cereal', 'protein_bar', 'protein_chip', 'protein_powder', 'ready_to_drink_protein'].includes(categoryId)) {
    add('isolated_nutrition_system', 'ingredient_simplicity', 'Isolated protein or fiber system', -8, ['isolated protein or fiber ingredient'], 'An isolated protein or fiber system adds formulation complexity.');
  }
  if (categoryId === 'prebiotic_soda') {
    const hasPrebiotic = /\b(inulin|chicory root|cassava root fiber|acacia fiber)\b/.test(ingredients);
    if (hasPrebiotic && supportsCategoryNutrientRules && (nutrients.fiber_g ?? 0) >= 5) {
      add('prebiotic_category_fit', 'claim_alignment', 'Prebiotic category fit', 6, ['named prebiotic ingredient', `${nutrients.fiber_g} g fiber`], 'A named prebiotic ingredient and meaningful fiber amount support this category.');
      add('isolated_fiber_system', 'ingredient_simplicity', 'Added fiber system', -3, ['named added fiber ingredient'], 'An added fiber system contributes to a more formulated beverage pattern.');
    } else if (hasPrebiotic) {
      add('prebiotic_ingredient_context', 'claim_alignment', 'Named prebiotic ingredient', 3, ['named prebiotic ingredient'], 'A named prebiotic ingredient supports this category.');
    }
    else if (ingredientEvidenceAvailable) add('prebiotic_claim_gap', 'claim_alignment', 'Prebiotic claim gap', -6, ['no named prebiotic ingredient'], 'The available ingredient list does not show a named prebiotic ingredient.');
    if (supportsCategoryNutrientRules && typeof nutrients.sugar_g === 'number' && nutrients.sugar_g <= 8) add('lower_sugar_beverage', 'sugar_density', 'Lower-sugar beverage', 4, [`${nutrients.sugar_g} g sugar`], 'Sugar is lower than a typical sugar-sweetened soda serving.');
  }
  if (categoryId === 'salt' || categoryId === 'low_sodium_salt') {
    const antiCaking = /\b(calcium silicate|sodium aluminosilicate|silicon dioxide|tricalcium phosphate|yellow prussiate)\b/.test(ingredients);
    if (antiCaking) add('anti_caking_additive', 'emulsifiers_gums', 'Anti-caking additive', -10, ['anti-caking ingredient'], 'Anti-caking additives appear in the ingredient list.');
    if (short && !antiCaking) add('simple_salt_label', 'ingredient_simplicity', 'Simple salt label', 5, ['simple label without anti-caking additives'], 'The available salt label is simple.');
    if (/\b(potassium iodide|potassium iodate|iodized)\b/.test(ingredients)) add('iodine_context', 'claim_alignment', 'Iodine context', 0, ['iodine source'], 'Iodine can be useful if you rely on iodized salt.');
  }
  if ((categoryId === 'yogurt' || categoryId === 'cottage_cheese') && /\b(milk|cream)\b/.test(ingredients) && /\b(cultures?|cultured)\b/.test(ingredients)) {
    add('cultured_dairy_base', 'claim_alignment', 'Cultured dairy base', 5, ['milk/cream + culture'], 'The label includes a straightforward cultured dairy base.');
  }
  if (categoryId === 'chocolate' && /\b(cacao|cocoa)\b/.test(ingredients) && /\bcocoa butter\b/.test(ingredients)) {
    add('traditional_chocolate_base', 'claim_alignment', 'Traditional chocolate base', 6, ['cacao/cocoa + cocoa butter'], 'The label uses a traditional chocolate base.');
  }
  const categoryIsProteinPositioned = ['protein_bar', 'protein_powder', 'ready_to_drink_protein', 'protein_chip'].includes(categoryId);
  const providerTagsProteinPositioning = /\bprotein\b/.test(normalize((input.categoryTags ?? []).join(' ')));
  const cerealHasProteinEvidence = categoryId === 'cereal' && (providerTagsProteinPositioning || isolatedProteinOrFiber);
  if (supportsCategoryNutrientRules && (categoryIsProteinPositioned || cerealHasProteinEvidence) && (nutrients.protein_g ?? 0) >= 10) {
    add('protein_claim_alignment', 'claim_alignment', 'Protein category alignment', 4, [`${nutrients.protein_g} g protein`], 'The selected serving basis supports the category’s protein positioning.');
  }
  const plantSweetenerSystem = /\b(allulose|stevia|monk fruit)\b/.test(ingredients);
  const refinedSweetenerSystem = /\b(high[- ]fructose corn syrup|cane sugar|corn syrup|glucose syrup|dextrose|rice syrup|tapioca syrup|agave syrup|sucrose)\b/.test(ingredients);
  const sweetnessExpected = ['prebiotic_soda', 'soda', 'yogurt', 'protein_bar', 'protein_powder', 'ready_to_drink_protein', 'chocolate'].includes(categoryId);
  if (supportsCategoryNutrientRules && plantSweetenerSystem && !refinedSweetenerSystem && sweetnessExpected && categoryId !== 'prebiotic_soda' && (nutrients.sugar_g ?? 0) <= 8) {
    add('reduced_refined_sugar_sweetener_system', 'claim_alignment', 'Reduced refined-sugar alignment', 1,
      ['one plant-derived sweetener system', 'no refined sweetener detected'],
      'The sweetener system supports a lower refined-sugar pattern for this category.');
  }

  const densitySignals: Array<{ id: string; family: RuleFamily; label: string; active: boolean; delta: number; evidence: string; explanation: string }> = [
    { id: 'higher_sugar_density', family: 'sugar_density', label: 'Higher sugar', active: (nutrients.sugar_g ?? 0) >= 20, delta: -8, evidence: `${nutrients.sugar_g} g sugar`, explanation: 'Sugar is higher on the category-selected nutrient basis.' },
    { id: 'higher_sodium_density', family: 'sodium_density', label: 'Higher sodium', active: (nutrients.sodium_mg ?? 0) >= 700, delta: -5, evidence: `${nutrients.sodium_mg} mg sodium`, explanation: 'Sodium is higher on the category-selected nutrient basis.' },
    { id: 'higher_calorie_density', family: 'calorie_density', label: 'Higher calorie amount', active: (nutrients.calories ?? 0) >= 300, delta: -4, evidence: `${nutrients.calories} calories`, explanation: 'Calories are higher on the category-selected nutrient basis.' },
    { id: 'higher_fat_density', family: 'fat_density', label: 'Higher saturated fat', active: (nutrients.saturated_fat_g ?? 0) >= 10, delta: -4, evidence: `${nutrients.saturated_fat_g} g saturated fat`, explanation: 'Saturated fat is higher on the category-selected nutrient basis.' },
    { id: 'protein_density_context', family: 'protein_density', label: 'Protein amount', active: (nutrients.protein_g ?? 0) >= 15, delta: 3, evidence: `${nutrients.protein_g} g protein`, explanation: 'Protein is meaningful on the category-selected nutrient basis.' },
    { id: 'fiber_density_context', family: 'fiber_density', label: 'Fiber amount', active: (nutrients.fiber_g ?? 0) >= 5, delta: 3, evidence: `${nutrients.fiber_g} g fiber`, explanation: 'Fiber is meaningful on the category-selected nutrient basis.' }
  ];
  for (const signal of densitySignals) if (supportsCategoryNutrientRules && signal.active) {
    const fiberContextAlreadyExplained = signal.id === 'fiber_density_context' && ledger.some((entry) => (
      ['prebiotic_category_fit', 'whole_ingredient_bar_pattern', 'protein_claim_alignment', 'isolated_nutrition_system'].includes(entry.ruleId)
    ));
    const electrolyteSodiumContext = signal.id === 'higher_sodium_density' &&
      categoryId === 'electrolyte' && basis.type === 'prepared_serving';
    add(
      signal.id,
      signal.family,
      signal.label,
      signal.delta,
      [signal.evidence],
      signal.explanation,
      electrolyteSodiumContext || fiberContextAlreadyExplained ? 'neutral_detail' : undefined
    );
  }
  return ledger;
}

function processingTier(tokens: string[], ledger: ProductScoreLedgerEntry[]): ProductProcessingTier {
  const strong = ledger.some((entry) => entry.status === 'applied' && entry.delta <= -10);
  const formulationCount = ledger.filter((entry) => entry.status === 'applied' && entry.delta < 0 && ['flavor_systems', 'emulsifiers_gums', 'colors', 'oils'].includes(entry.ruleFamily)).length;
  if (strong || formulationCount >= 3) return 4;
  if (formulationCount > 0 || tokens.length > 8) return 3;
  return tokens.length <= 1 ? 1 : 2;
}

function factorFromLedger(entry: ProductScoreLedgerEntry): ProductScoreFactor {
  return {
    id: entry.ruleId,
    label: entry.label,
    points: entry.delta,
    rawPoints: entry.delta,
    severity: entry.delta > 0 ? 'positive' : entry.delta <= -10 ? 'strong' : entry.delta <= -5 ? 'moderate' : 'light',
    matched: entry.evidence.filter((item) => !item.startsWith('http')),
    explanation: entry.userVisibleExplanation ?? entry.hiddenReason ?? entry.label,
    evidence_refs: entry.evidence.filter((item) => item.includes('_') && !item.includes(' '))
  };
}

type ExplanationConcept =
  | 'protein_amount'
  | 'fiber_amount'
  | 'lower_sugar_system'
  | 'ingredient_integrity'
  | 'oil_system'
  | 'flavor_complexity';

function explanationConcept(entry: ProductScoreLedgerEntry): ExplanationConcept | null {
  if (['protein_claim_alignment', 'protein_density_context'].includes(entry.ruleId)) return 'protein_amount';
  if (['prebiotic_category_fit', 'fiber_density_context'].includes(entry.ruleId)) return 'fiber_amount';
  if (['lower_sugar_beverage', 'reduced_refined_sugar_sweetener_system'].includes(entry.ruleId)) return 'lower_sugar_system';
  if (['ingredient_simplicity', 'whole_ingredient_bar_pattern'].includes(entry.ruleId)) return 'ingredient_integrity';
  if (['refined_oil_blend', 'multiple_named_oils', 'formulated_fat'].includes(entry.ruleId)) return 'oil_system';
  if (['flavor_blend', 'ingredient_complexity'].includes(entry.ruleId)) return 'flavor_complexity';
  return null;
}

function explanationSpecificity(entry: ProductScoreLedgerEntry): number {
  const specific: Record<string, number> = {
    whole_ingredient_bar_pattern: 5,
    prebiotic_category_fit: 5,
    protein_claim_alignment: 5,
    lower_sugar_beverage: 5,
    reduced_refined_sugar_sweetener_system: 5,
    refined_oil_blend: 5,
    formulated_fat: 5,
    flavor_blend: 5,
    multiple_named_oils: 4,
    protein_density_context: 2,
    fiber_density_context: 2,
    ingredient_simplicity: 2,
    ingredient_complexity: 1
  };
  return specific[entry.ruleId] ?? 3;
}

function explanationPriority(entry: ProductScoreLedgerEntry): number {
  return explanationSpecificity(entry) * 100 + Math.abs(entry.delta);
}

function dedupeVisibleLedger(entries: ProductScoreLedgerEntry[]): ProductScoreLedgerEntry[] {
  const selected = new Set<ProductScoreLedgerEntry>();
  const byConcept = new Map<ExplanationConcept, ProductScoreLedgerEntry[]>();
  for (const entry of entries) {
    const concept = explanationConcept(entry);
    if (!concept) {
      selected.add(entry);
      continue;
    }
    const choices = byConcept.get(concept) ?? [];
    const oppositeApplied = choices.find((candidate) => candidate.delta * entry.delta < 0);
    if (oppositeApplied) {
      choices.push(entry);
      selected.add(entry);
      byConcept.set(concept, choices);
      continue;
    }
    const current = choices[0];
    if (!current || explanationPriority(entry) > explanationPriority(current)) {
      if (current) selected.delete(current);
      choices[0] = entry;
      selected.add(entry);
    }
    byConcept.set(concept, choices);
  }
  return entries.filter((entry) => selected.has(entry));
}

function gradeEligibility(
  categoryId: string,
  ledger: ProductScoreLedgerEntry[],
  tokens: string[],
  sourceConfidence: DataConfidence,
  interpretationConfidence: DataConfidence
): ProductGradeEligibility {
  const applied = ledger.filter((entry) => entry.status === 'applied');
  const appliedNegatives = applied.filter((entry) => entry.delta < 0);
  const ingredientIntegrity = Boolean(
    applied.find((entry) => entry.ruleId === 'ingredient_simplicity' && entry.delta >= 8) &&
    !appliedNegatives.some((entry) => ['ingredient_simplicity', 'oils', 'colors', 'emulsifiers_gums', 'refined_syrups'].includes(entry.ruleFamily))
  );
  const formulationWatchFamilies = ['flavor_systems', 'sweeteners', 'oils', 'emulsifiers_gums', 'colors'];
  const contextualFormulationSignals = ledger.some((entry) => (
    entry.status === 'context_only' &&
    entry.visibility !== 'none' &&
    formulationWatchFamilies.includes(entry.ruleFamily)
  ));
  const formulationComplexity = Boolean(
    tokens.length <= 5 &&
    !appliedNegatives.some((entry) => formulationWatchFamilies.includes(entry.ruleFamily)) &&
    !contextualFormulationSignals
  );
  const topGradeExcludedSignals = ['ingredient_simplicity', 'organic_label', 'reduced_refined_sugar_sweetener_system', 'protein_claim_alignment'];
  const categoryStandardQuality = applied.some((entry) => (
    entry.delta > 0 && ['claim_alignment', 'ingredient_simplicity', 'oils'].includes(entry.ruleFamily) && !topGradeExcludedSignals.includes(entry.ruleId)
  ));
  const expectedContextFamilies = categoryId === 'ice_cream' || categoryId === 'frozen_dairy_dessert' || categoryId === 'chocolate'
    ? ['refined_syrups']
    : [];
  const unresolvedMajorWatch = appliedNegatives.some((entry) => entry.delta <= -6) || ledger.some((entry) => (
    entry.status === 'context_only' &&
    entry.ruleFamily === 'refined_syrups' &&
    !expectedContextFamilies.includes(entry.ruleFamily)
  ));
  const majorWatchSignals = !unresolvedMajorWatch;
  const labelTransparency = sourceConfidence === 'high' && interpretationConfidence === 'high';
  const deniedReasons: string[] = [];
  if (!ingredientIntegrity) deniedReasons.push('ingredient_integrity_not_strong');
  if (!formulationComplexity) deniedReasons.push('formulation_complexity_not_low');
  if (!categoryStandardQuality) deniedReasons.push('category_standard_quality_not_strong');
  if (!majorWatchSignals) deniedReasons.push('unresolved_major_watch_signal');
  if (!labelTransparency) deniedReasons.push('label_transparency_or_confidence_insufficient');
  return {
    aEligible: deniedReasons.length === 0,
    ingredientIntegrity,
    formulationComplexity,
    categoryStandardQuality,
    majorWatchSignals,
    labelTransparency,
    deniedReasons
  };
}

function deniedTopGradeCopy(eligibility: ProductGradeEligibility): string {
  const clauses: Record<string, string> = {
    ingredient_integrity_not_strong: 'the ingredient profile is not strong enough for the top tier',
    formulation_complexity_not_low: 'the formula includes added systems that keep it below the top tier',
    category_standard_quality_not_strong: 'the strongest qualities expected in this category are not present',
    unresolved_major_watch_signal: 'a significant label consideration remains',
    label_transparency_or_confidence_insufficient: 'the available label evidence is not complete enough for a top-tier grade'
  };
  const reasons = eligibility.deniedReasons.map((reason) => clauses[reason]).filter((reason): reason is string => Boolean(reason));
  if (reasons.length === 0) return 'The available label does not provide enough support for a top-tier grade.';
  if (reasons.length === 1) return `${reasons[0]![0]!.toUpperCase()}${reasons[0]!.slice(1)}.`;
  return `This remains below the top tier because ${reasons.slice(0, -1).join(', ')}, and ${reasons.at(-1)}.`;
}

export function productLetterGrade(score: number): ProductLetterGrade {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

export function productGradeBand(grade: ProductLetterGrade | null): ProductGradeBand {
  if (grade === null) return 'calibrating';
  if (grade === 'A') return 'strong';
  if (grade === 'B') return 'solid';
  if (grade === 'C') return 'mixed';
  if (grade === 'D') return 'cautious';
  return 'avoid';
}

export function productGradeLabel(band: ProductGradeBand): string {
  if (band === 'strong') return 'Strong fit';
  if (band === 'solid') return 'Good fit';
  if (band === 'mixed') return 'Mixed fit';
  if (band === 'cautious') return 'Limit often';
  if (band === 'avoid') return 'Seek better option';
  return 'Not enough data';
}

function compatibilityLabel(band: ProductGradeBand): ProductScoreLabel {
  if (band === 'calibrating') return 'calibrating';
  if (band === 'strong' || band === 'solid') return 'supportive';
  if (band === 'mixed') return 'steady';
  return 'watch';
}

function productFormCopy(form: ProductForm | null, basis: ProductNutrientBasis): string | null {
  if (basis.type === 'per_100g') return 'Serving data is unavailable. Nutrition context is shown per 100 g, and serving-level rules are withheld.';
  if (basis.type === 'unknown') return 'Serving nutrition is unavailable, so serving-level nutrient rules are withheld.';
  if (form === 'powder_mix') return basis.source === 'provided'
    ? 'Nutrition is interpreted on the explicitly available prepared serving basis.'
    : 'Prepared serving data is unavailable, so available serving data is used with lower basis confidence.';
  if (form === 'salt') return 'This is interpreted as a pantry staple rather than a ready-to-eat food.';
  if (form === 'condiment_or_sauce') return 'This is interpreted per sauce or condiment serving.';
  if (form === 'frozen_dessert') return 'This is interpreted per frozen-dessert serving.';
  if (form === 'beverage') return 'This is interpreted per beverage serving.';
  return null;
}

export function productBetterOptions(score: number | null, categoryId: string | null): ProductBetterOption[] {
  if (score === null || score >= 80) return [];
  const title = 'What to Compare' as const;
  if (categoryId === 'salt' || categoryId === 'low_sodium_salt') return [{ title, summary: 'Compare salts within the same pantry use.', criteria: ['Simple ingredient list', 'Additive use', 'Transparent sourcing', 'Documented quality testing when available'], reason_codes: ['compare_salt_label'] }];
  if (categoryId === 'marinara' || categoryId === 'condiments') return [{ title, summary: 'Compare sauces intended for the same meal use.', criteria: ['Straightforward tomato, oil, and seasoning pattern', 'Sodium in serving context', 'Fewer formulation signals'], reason_codes: ['compare_sauce_label'] }];
  if (categoryId === 'ice_cream' || categoryId === 'frozen_dairy_dessert' || categoryId === 'cookies' || categoryId === 'chocolate') return [{ title, summary: 'Compare a similar dessert or frozen treat.', criteria: ['Straightforward category-standard base', 'Fewer flavor, color, or texture systems', 'Clear serving information'], reason_codes: ['compare_dessert_label'] }];
  if (categoryId === 'electrolyte') return [{ title, summary: 'Compare hydration mixes intended for the same use.', criteria: ['Clear serving instructions', 'Mineral amounts shown per intended use', 'Simpler flavor and sweetener system'], reason_codes: ['compare_electrolyte_label'] }];
  return [{ title, summary: 'Compare products intended for the same use.', criteria: ['Category-standard ingredient base', 'Fewer formulation signals', 'Claims supported by the available label'], reason_codes: ['compare_product_label'] }];
}

function summaryFor(categoryId: string, band: ProductGradeBand): string {
  if (categoryId === 'salt' || categoryId === 'low_sodium_salt') return 'Sodium is expected for salt. This result focuses on ingredient simplicity and label transparency.';
  if (categoryId === 'electrolyte') return 'This hydration mix is interpreted for its intended prepared use.';
  if (categoryId === 'ice_cream' || categoryId === 'frozen_dairy_dessert' || categoryId === 'cookies' || categoryId === 'chocolate') return 'This is a label-quality result within its dessert category, not a universal frequency judgment.';
  if (band === 'strong') return 'The available label shows strong quality within this product category.';
  if (band === 'solid') return 'The available label shows good quality within this product category.';
  if (band === 'mixed') return 'The available label has a mix of supportive and watch signals for this category.';
  if (band === 'cautious') return 'Several label signals are worth comparing within this product category.';
  return 'The available label shows a more complex pattern for this product category.';
}

function calibratingResult(input: ProductScoringInput, resolution: CategoryResolution, source: DataConfidence, basis: ProductNutrientBasis): ProductScoringResult {
  const form = resolution.productForm;
  return {
    absoluteScore: null, rawScore: null, categoryScore: null, categoryComparisonAvailable: false, displayScore: null, letterGrade: null,
    gradeBand: 'calibrating', gradeLabel: 'Not enough data', label: 'calibrating', tier: null,
    tierLabel: 'Ingredient data unavailable', categoryId: resolution.selectedCategoryId, categoryLabel: resolution.selectedCategoryLabel,
    categoryResolution: resolution, productForm: form, preparedUse: productFormCopy(form, basis), nutrientBasis: basis,
    macroContext: macroContext(basis, getCategoryProfile(resolution.selectedCategoryId)), factors: [], topDrivers: [], scoreLedger: [],
    scoreBaseline: null, scoreCap: null, gradeEligibility: null, sourceConfidence: source, interpretationConfidence: resolution.interpretationConfidence,
    confidence: !input.ingredientsText?.trim()
      ? 'low'
      : lowerConfidence(lowerConfidence(source, resolution.interpretationConfidence), basis.confidence),
    summary: !input.ingredientsText?.trim()
      ? 'Ingredient data is incomplete, so no Product Quality grade is assigned.'
      : 'Category interpretation is incomplete, so no Product Quality grade is assigned.',
    positives: [], considerations: ['More label or category data will make this interpretation clearer.'], better_options: [], evidence_refs: [],
    reasonCodes: [!input.ingredientsText?.trim() ? 'ingredient_data_missing' : 'category_interpretation_missing', 'product_score_calibrating']
  };
}

export function scoreProductLabel(input: ProductScoringInput): ProductScoringResult {
  const ingredients = normalize(input.ingredientsText ?? '');
  const tokens = splitIngredientList(ingredients);
  const source = sourceConfidence(input);
  const resolution = resolveProductCategory({
    name: input.name,
    explicitCategory: input.category,
    categoryTags: input.categoryTags,
    ingredientsText: ingredients,
    servingNutrients: input.servingNutrients
  });
  const profile = getCategoryProfile(resolution.selectedCategoryId);
  const fallbackPreference: NutrientBasisPreference = resolution.productForm === 'salt' ? 'pantry_context' : 'per_serving';
  const basis = selectNutrientBasis(input, profile?.nutrientBasis ?? fallbackPreference);

  if (!profile || resolution.interpretationConfidence === 'low') {
    return calibratingResult(input, resolution, source, basis);
  }

  const ledger = [
    ...ingredientLedger(profile, ingredients, tokens, input.labels ?? []),
    ...categoryLedger(profile, input, ingredients, tokens, basis, tokens.length > 0)
  ];
  const unboundedRawScore = SHARED_BASELINE + ledger.reduce((sum, entry) => sum + entry.delta, 0);
  const rawScore = Math.round(clamp(unboundedRawScore, 0, 100));
  if (rawScore !== Math.round(unboundedRawScore)) {
    ledger.push({
      ruleId: 'score_range_clamp', ruleFamily: 'claim_alignment', label: 'Score range boundary', status: 'applied',
      delta: rawScore - unboundedRawScore, evidence: [`unbounded score ${unboundedRawScore}`], reasonCode: 'score_range_clamp', presentation: 'hidden', visibility: 'none',
      userVisibleExplanation: null, hiddenReason: 'The internal score was bounded to the supported 0–100 range.', transformation: 'clamp'
    });
  }
  const numericGrade = productLetterGrade(rawScore);
  const eligibility = gradeEligibility(profile.categoryId, ledger, tokens, source, resolution.interpretationConfidence);
  const deniedTopGrade = numericGrade === 'A' && !eligibility.aEligible;
  const displayScore = deniedTopGrade ? 89 : rawScore;
  if (deniedTopGrade) {
    ledger.push({
      ruleId: 'grade_eligibility_adjustment', ruleFamily: 'claim_alignment', label: 'Public grade consistency adjustment', status: 'applied',
      delta: displayScore - rawScore, evidence: [...eligibility.deniedReasons], reasonCode: 'grade_eligibility_adjustment', presentation: 'hidden', visibility: 'none',
      userVisibleExplanation: null, hiddenReason: 'Top-grade requirements were not met across the available label pattern.', transformation: 'grade_eligibility'
    });
  }
  const letterGrade = productLetterGrade(displayScore);
  const gradeBand = productGradeBand(letterGrade);
  const hasVisibleNegative = ledger.some((entry) => entry.status === 'applied' && entry.delta < 0 && entry.visibility === 'consider');
  if (displayScore < 80 && !hasVisibleNegative) {
    ledger.push({
      ruleId: 'limited_category_strength', ruleFamily: 'claim_alignment', label: 'Limited category-specific strength', status: 'context_only',
      delta: 0, evidence: ['public result below B without a visible negative rule'], reasonCode: 'limited_category_strength', presentation: 'consideration', visibility: 'consider',
      userVisibleExplanation: 'The available label shows limited category-strengthening qualities.'
    });
  }
  const visibleApplied = dedupeVisibleLedger(ledger.filter((entry) => (
    (entry.status === 'applied' || entry.status === 'context_only') && entry.visibility !== 'none'
  )));
  const factors = visibleApplied.map(factorFromLedger);
  const topDrivers = dedupeVisibleLedger(ledger
    .filter((entry) => entry.status === 'applied' && entry.delta !== 0 && entry.visibility !== 'none')
  )
    .sort((left, right) => Math.abs(right.delta) - Math.abs(left.delta))
    .slice(0, 3)
    .map(factorFromLedger);
  const positives = unique(visibleApplied.filter((entry) => entry.visibility === 'helps' && entry.userVisibleExplanation).map((entry) => entry.userVisibleExplanation!));
  const considerations = unique(visibleApplied.filter((entry) => entry.visibility === 'consider' && entry.userVisibleExplanation).map((entry) => entry.userVisibleExplanation!));
  if (deniedTopGrade) {
    considerations.push(deniedTopGradeCopy(eligibility));
  }
  const evidence_refs = resolveProductEvidence(ledger.flatMap((entry) => entry.evidence.filter((item) => item.includes('_') && !item.includes(' '))));
  const reasonCodes = unique([
    `category_${profile.categoryId}`,
    ...ledger
      .filter((entry) => (
        (entry.status === 'applied' || entry.status === 'context_only') &&
        entry.visibility !== 'none'
      ))
      .map((entry) => entry.reasonCode)
  ]);
  const tier = processingTier(tokens, ledger);

  return {
    absoluteScore: displayScore,
    rawScore,
    categoryScore: null,
    categoryComparisonAvailable: false,
    displayScore,
    letterGrade,
    gradeBand,
    gradeLabel: productGradeLabel(gradeBand),
    label: compatibilityLabel(gradeBand),
    tier,
    tierLabel: tier <= 2 ? 'Straightforward ingredient pattern' : 'More formulated ingredient pattern',
    categoryId: profile.categoryId,
    categoryLabel: resolution.selectedCategoryLabel,
    categoryResolution: resolution,
    productForm: profile.productForm,
    preparedUse: productFormCopy(profile.productForm, basis),
    nutrientBasis: basis,
    macroContext: macroContext(basis, profile),
    factors,
    topDrivers,
    scoreLedger: ledger,
    scoreBaseline: SHARED_BASELINE,
    scoreCap: null,
    gradeEligibility: eligibility,
    sourceConfidence: source,
    interpretationConfidence: resolution.interpretationConfidence,
    confidence: lowerConfidence(lowerConfidence(source, resolution.interpretationConfidence), basis.confidence),
    summary: summaryFor(profile.categoryId, gradeBand),
    positives,
    considerations,
    better_options: productBetterOptions(displayScore, profile.categoryId),
    evidence_refs,
    reasonCodes
  };
}
