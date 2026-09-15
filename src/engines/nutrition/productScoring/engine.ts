import type { ProductForm } from './categories';
import { resolveProductArchetype, type ProductArchetype } from './archetypes';
import { resolveProductCategory, type CategoryResolution } from './categoryResolution';
import {
  type ProductDimensionScore,
  type ProductScoreDimension,
  type ProductScoreScope
} from './dimensions';
import { ingredientTextForMatching, parseIngredients } from './ingredientParser';
import { resolveProductEvidence, type ProductEvidenceRef } from './evidence';
import { scoreProductDimensionsV5 } from './kernelV5';
import { scoreProductDimensionsV5 as scoreProductDimensionsV5Experimental } from './kernelV5Experimental';
import { scoreProductDimensionsV6 } from './kernelV6';
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
export const PRODUCT_QUALITY_ENGINE_VERSION = 'product_quality_v5' as const;
export type ProductQualityEngineVersion = 'product_quality_v2' | 'product_quality_v3' | 'product_quality_v4' | typeof PRODUCT_QUALITY_ENGINE_VERSION;

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
  added_sugar_g?: number | null;
  caffeine_mg?: number | null;
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
  servingQuantity?: number | null;
  servingUnit?: 'g' | 'ml' | null;
  preparedServingNutrients?: ProductNutrients;
  sourceConfidence?: DataConfidence;
  ingredientEvidenceStatus?: 'complete' | 'partial' | 'reconstructed' | 'absent';
  evidenceContext?: {
    identityConfidence?: DataConfidence;
    nutritionConfidence?: DataConfidence;
    servingConfidence?: DataConfidence;
    productFormConfidence?: DataConfidence;
    providerConflict?: boolean;
    ingredientConflict?: boolean;
    fieldReliability?: Partial<Record<keyof ProductNutrients, 'KNOWN' | 'ESTIMATED' | 'CONFLICTED' | 'UNRELIABLE' | 'MISSING'>>;
    validationIssueCount?: number;
  };
};

export type ProductScoreEligibility = {
  eligible: boolean;
  exactIdentityEstablished: boolean;
  generalizedFallbackUsed: boolean;
  supportedDimensionCount: number;
  supportedRawWeight: number;
  directEvidenceStrength: number;
  directEvidenceKinds: Array<'ingredients' | 'nutrition' | 'serving'>;
  maximumEffectiveWeight: number;
  rangeWidth: number | null;
  thresholds: {
    minimumSupportedDimensions: 3;
    minimumSupportedRawWeight: 0.5;
    minimumDirectEvidenceStrength: 2;
    maximumEffectiveWeight: 0.6;
  };
  deniedReasons: string[];
};

export const PRODUCT_SCORE_ELIGIBILITY_POLICY = {
  minimumSupportedDimensions: 3,
  minimumSupportedRawWeight: 0.5,
  minimumDirectEvidenceStrength: 2,
  maximumEffectiveWeight: 0.6
} as const;

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

export type ProductGradeCertaintyState = 'stable' | 'provisional' | 'unresolved';
export type ProductGradeCertainty = {
  state: ProductGradeCertaintyState;
  centralGrade: ProductLetterGrade;
  boundariesCrossed: number;
  gradesSpanned: ProductLetterGrade[];
  explanation: string;
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
  engineVersion: typeof PRODUCT_QUALITY_ENGINE_VERSION;
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
  archetype: ProductArchetype | null;
  dimensions: ProductScoreDimension[];
  scoreRange: [number, number] | null;
  supportedDimensionWeight: number;
  scoreScope: ProductScoreScope;
  dimensionAggregation: ProductDimensionScore['aggregation'];
  scoreEligibility: ProductScoreEligibility;
  generalizedFallbackUsed: boolean;
  scoreBaseline: number | null;
  scoreCap: { ruleId: string; label: string; cap: number } | null;
  gradeEligibility: ProductGradeEligibility | null;
  gradeCertainty: ProductGradeCertainty | null;
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

function nutrientBasisConfidence(
  input: ProductScoringInput,
  ceiling: DataConfidence,
  requiresServing: boolean
): DataConfidence {
  const nutrition = input.evidenceContext?.nutritionConfidence ?? ceiling;
  const serving = requiresServing ? input.evidenceContext?.servingConfidence ?? ceiling : ceiling;
  return lowerConfidence(ceiling, lowerConfidence(nutrition, serving));
}

export function splitIngredientList(text: string): string[] {
  return parseIngredients(text).topLevelIngredients;
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
      confidence: nutrientBasisConfidence(input, 'medium', true),
      nutrients: { ...(input.servingNutrients ?? {}) }
    };
    if (hasNutrients(input.nutrimentsPer100g)) return {
      type: 'per_100g', source: 'fallback', confidence: nutrientBasisConfidence(input, 'medium', false), nutrients: { ...input.nutrimentsPer100g }
    };
    return { type: 'unknown', source: 'unavailable', confidence: 'low', nutrients: {} };
  }
  if (preference === 'prepared_serving') {
    if (hasNutrients(input.preparedServingNutrients)) return {
      type: 'prepared_serving', source: 'provided', confidence: nutrientBasisConfidence(input, 'high', true), nutrients: { ...input.preparedServingNutrients }
    };
    if (hasNutrients(input.servingNutrients)) return {
      type: 'prepared_serving', source: 'fallback', confidence: nutrientBasisConfidence(input, 'medium', true), nutrients: { ...input.servingNutrients }
    };
    if (hasNutrients(input.nutrimentsPer100g)) return {
      type: 'per_100g', source: 'fallback', confidence: nutrientBasisConfidence(input, 'medium', false), nutrients: { ...input.nutrimentsPer100g }
    };
    return { type: 'unknown', source: 'unavailable', confidence: 'low', nutrients: {} };
  }
  if (preference === 'per_100g') {
    if (hasNutrients(input.nutrimentsPer100g)) return {
      type: 'per_100g', source: 'provided', confidence: nutrientBasisConfidence(input, 'high', false), nutrients: { ...input.nutrimentsPer100g }
    };
    return { type: 'unknown', source: 'unavailable', confidence: 'low', nutrients: {} };
  }
  if (hasNutrients(input.servingNutrients)) return {
    type: 'provider_serving', source: 'provided', confidence: nutrientBasisConfidence(input, 'high', true), nutrients: { ...input.servingNutrients }
  };
  if (hasNutrients(input.nutrimentsPer100g)) return {
    type: 'per_100g', source: 'fallback', confidence: nutrientBasisConfidence(input, 'medium', false), nutrients: { ...input.nutrimentsPer100g }
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

function scoreEligibility(
  input: ProductScoringInput,
  basis: ProductNutrientBasis,
  profile: CategoryProfile | null,
  dimensionScore: ProductDimensionScore
): ProductScoreEligibility {
  const declaredIngredientStatus = input.ingredientEvidenceStatus ?? (input.ingredientsText?.trim() ? 'complete' : 'absent');
  const ingredientStatus = declaredIngredientStatus === 'complete' && input.evidenceContext?.ingredientConflict
    ? 'partial'
    : declaredIngredientStatus;
  const nutritionFieldCount = Object.values(basis.nutrients).filter((value) => (
    typeof value === 'number' && Number.isFinite(value)
  )).length;
  const servingNormalized = ['provider_serving', 'prepared_serving', 'pantry_context'].includes(basis.type) &&
    input.evidenceContext?.servingConfidence !== 'low';
  const directEvidenceKinds: ProductScoreEligibility['directEvidenceKinds'] = [];
  let directEvidenceStrength = 0;
  if (ingredientStatus === 'complete' && input.ingredientsText?.trim()) {
    directEvidenceKinds.push('ingredients');
    directEvidenceStrength += 2;
  } else if ((ingredientStatus === 'partial' || ingredientStatus === 'reconstructed') && input.ingredientsText?.trim()) {
    directEvidenceKinds.push('ingredients');
    directEvidenceStrength += 1;
  }
  if (nutritionFieldCount >= 2) {
    directEvidenceKinds.push('nutrition');
    directEvidenceStrength += 1;
  }
  if (servingNormalized) {
    directEvidenceKinds.push('serving');
    directEvidenceStrength += 1;
  }

  const supported = dimensionScore.dimensions.filter((dimension) => dimension.score !== null && dimension.weight > 0);
  const supportedRawWeight = supported.reduce((sum, dimension) => sum + dimension.weight, 0);
  const maximumEffectiveWeight = supportedRawWeight > 0
    ? supported.reduce((maximum, dimension) => Math.max(
      maximum,
      dimension.weight / supportedRawWeight
    ), 0)
    : 0;
  const rangeWidth = dimensionScore.range ? dimensionScore.range[1] - dimensionScore.range[0] : null;
  const exactIdentityEstablished = input.evidenceContext?.identityConfidence !== 'low';
  const deniedReasons: string[] = [];
  if (!exactIdentityEstablished) deniedReasons.push('exact_identity_not_established');
  if (supported.length < PRODUCT_SCORE_ELIGIBILITY_POLICY.minimumSupportedDimensions) {
    deniedReasons.push('insufficient_supported_dimension_count');
  }
  if (supportedRawWeight < PRODUCT_SCORE_ELIGIBILITY_POLICY.minimumSupportedRawWeight) {
    deniedReasons.push('insufficient_supported_dimension_weight');
  }
  if (directEvidenceStrength < PRODUCT_SCORE_ELIGIBILITY_POLICY.minimumDirectEvidenceStrength) {
    deniedReasons.push('insufficient_direct_product_evidence');
  }
  if (maximumEffectiveWeight > PRODUCT_SCORE_ELIGIBILITY_POLICY.maximumEffectiveWeight) {
    deniedReasons.push('central_estimate_dominated_by_one_dimension');
  }
  // Range width is retained for compatibility and result-state disclosure. It
  // must not turn confidence into a score-eligibility or grade gate.
  if (dimensionScore.score === null) deniedReasons.push('no_supported_dimension_score');

  return {
    eligible: deniedReasons.length === 0,
    exactIdentityEstablished,
    generalizedFallbackUsed: profile === null,
    supportedDimensionCount: supported.length,
    supportedRawWeight: Math.round(supportedRawWeight * 1000) / 1000,
    directEvidenceStrength,
    directEvidenceKinds: [...new Set(directEvidenceKinds)],
    maximumEffectiveWeight: Math.round(maximumEffectiveWeight * 1000) / 1000,
    rangeWidth,
    thresholds: { ...PRODUCT_SCORE_ELIGIBILITY_POLICY },
    deniedReasons
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
  if ((categoryId === 'electrolyte' || categoryId === 'electrolyte_beverage') && /\b(sodium|potassium|magnesium|calcium|salt)\b/.test(ingredients)) {
    add('electrolyte_alignment', 'claim_alignment', 'Electrolyte formula alignment', 5, ['named electrolyte mineral'], 'Named electrolyte minerals align with the intended hydration-mix use.');
  }
  if (categoryId === 'sparkling_water' && /\bcarbonated water\b/.test(ingredients) &&
    !/\b(aspartame|acesulfame potassium|ace-?k|sucralose|saccharin|stevia|monk fruit|allulose|sugar|syrup)\b/.test(ingredients)) {
    add('sparkling_water_alignment', 'claim_alignment', 'Sparkling-water formula alignment', 0, ['carbonated water without a sweetener system'], 'The formulation is aligned with an unsweetened sparkling water.', 'help');
  }
  if ((categoryId === 'soda' || categoryId === 'energy_drink') && /\bcaffeine\b/.test(ingredients)) {
    add('caffeine_context', 'claim_alignment', 'Caffeine context', 0, ['caffeine declared in ingredients'], 'Caffeine is declared in the available ingredient list.', 'consideration');
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
  const sweetnessExpected = ['prebiotic_soda', 'soda', 'energy_drink', 'electrolyte_beverage', 'yogurt', 'protein_bar', 'protein_powder', 'ready_to_drink_protein', 'chocolate'].includes(categoryId);
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
    const electrolyteSodiumContext = signal.id === 'higher_sodium_density' && (
      (categoryId === 'electrolyte' && basis.type === 'prepared_serving') ||
      categoryId === 'electrolyte_beverage'
    );
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

function processingTier(tokens: string[], dimensions: ProductScoreDimension[]): ProductProcessingTier {
  const formulation = dimensions.find((dimension) => dimension.id === 'formulation_burden');
  const formulationSignals = formulation?.negativeContributions.length ?? 0;
  if ((formulation?.score ?? 100) < 45 || formulationSignals >= 3) return 4;
  if ((formulation?.score ?? 100) < 75 || formulationSignals > 0 || tokens.length > 8) return 3;
  return tokens.length <= 1 ? 1 : 2;
}

function factorFromDimension(dimension: ProductScoreDimension): ProductScoreFactor {
  const score = dimension.score ?? 0;
  const contributionLabels = [...dimension.positiveContributions, ...dimension.negativeContributions]
    .map((item) => item.label);
  return {
    id: `dimension_${dimension.id}`,
    label: dimension.label,
    points: dimension.contribution,
    rawPoints: score,
    severity: score >= 80 ? 'positive' : score < 40 ? 'strong' : score < 55 ? 'moderate' : 'light',
    matched: dimension.evidence,
    explanation: `${dimension.label} contributes ${dimension.contribution.toFixed(1)} points from a ${score}/100 dimension score${contributionLabels.length ? ` (${contributionLabels.join('; ')})` : ''}.`,
    evidence_refs: []
  };
}

function legacyLedgerAsContext(entries: ProductScoreLedgerEntry[]): ProductScoreLedgerEntry[] {
  return entries.map((entry) => {
    if (entry.status !== 'applied') return entry;
    const explicitZeroPointContext = entry.delta === 0 && entry.visibility !== 'none' && entry.userVisibleExplanation !== null;
    return {
      ...entry,
      status: 'context_only',
      delta: 0,
      presentation: explicitZeroPointContext ? entry.presentation : 'hidden',
      visibility: explicitZeroPointContext ? entry.visibility : 'none',
      userVisibleExplanation: explicitZeroPointContext ? entry.userVisibleExplanation : null,
      hiddenReason: explicitZeroPointContext
        ? undefined
        : 'Legacy category-ledger match retained for trace context; Product Quality V4 score math is dimension-only.',
      transformation: undefined
    };
  });
}

function dimensionExplanations(dimensions: ProductScoreDimension[]): { positives: string[]; considerations: string[] } {
  const positives: string[] = [];
  const considerations: string[] = [];
  for (const dimension of dimensions) {
    if (dimension.score === null) {
      considerations.push(`${dimension.label} is unsupported: ${dimension.missingEvidence.join('; ') || 'required evidence is unavailable'}.`);
      continue;
    }
    if (dimension.anchor && dimension.anchor.score >= 80) {
      positives.push(`${dimension.label}: ${dimension.anchor.label}.`);
    } else if (dimension.anchor && dimension.anchor.score < 60) {
      considerations.push(`${dimension.label}: ${dimension.anchor.label}.`);
    }
    for (const item of dimension.positiveContributions) positives.push(`${dimension.label}: ${item.label}.`);
    for (const item of dimension.negativeContributions) considerations.push(`${dimension.label}: ${item.label}.`);
  }
  return { positives: unique(positives), considerations: unique(considerations) };
}

function evaluateAGradeEligibility(
  input: ProductScoringInput,
  dimensions: ProductScoreDimension[]
): ProductGradeEligibility {
  const scoreFor = (id: ProductScoreDimension['id']): number | null => (
    dimensions.find((dimension) => dimension.id === id)?.score ?? null
  );
  const ingredientIntegrity = (scoreFor('ingredient_integrity') ?? 0) >= 85;
  const formulationComplexity = (scoreFor('formulation_burden') ?? 0) >= 85 && (scoreFor('processing_purpose') ?? 0) >= 80;
  const categoryStandardQuality = (scoreFor('category_nutrition_fit') ?? 0) >= 70;
  const majorWatchRules = new Set([
    'measured_added_sugar',
    'measured_total_sugar_with_added_sugar_ingredient',
    'industrial_fat_ingredient_order',
    'industrial_fat_system',
    'processed_meat_context',
    'cumulative_additive_burden'
  ]);
  const unresolvedMajorWatch = dimensions.some((dimension) => (
    dimension.score !== null && dimension.score < 55 ||
    dimension.negativeContributions.some((item) => majorWatchRules.has(item.ruleId) && item.delta <= -10)
  ));
  const majorWatchSignals = !unresolvedMajorWatch;
  const declaredStatus = input.ingredientEvidenceStatus ?? (input.ingredientsText?.trim() ? 'complete' : 'absent');
  const labelTransparency = declaredStatus === 'complete' && !input.evidenceContext?.ingredientConflict;
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

export function productLetterGrade(score: number): ProductLetterGrade {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

export function productGradeCertainty(
  centralScore: number,
  scoreRange: [number, number]
): ProductGradeCertainty {
  const low = clamp(Math.min(scoreRange[0], centralScore), 0, 100);
  const high = clamp(Math.max(scoreRange[1], centralScore), 0, 100);
  const gradeOrder: ProductLetterGrade[] = ['F', 'D', 'C', 'B', 'A'];
  const lowGrade = productLetterGrade(low);
  const highGrade = productLetterGrade(high);
  const lowIndex = gradeOrder.indexOf(lowGrade);
  const highIndex = gradeOrder.indexOf(highGrade);
  const boundariesCrossed = Math.max(0, highIndex - lowIndex);
  const gradesSpanned = gradeOrder.slice(lowIndex, highIndex + 1);
  const nearestBoundaryDistance = Math.min(...[60, 70, 80, 90].map((boundary) => Math.abs(centralScore - boundary)));
  const oneBoundaryHasStrongCentralSupport = boundariesCrossed === 1 && nearestBoundaryDistance >= 3;
  const state: ProductGradeCertaintyState = boundariesCrossed === 0 || oneBoundaryHasStrongCentralSupport
    ? 'stable'
    : boundariesCrossed >= 3
      ? 'unresolved'
      : 'provisional';
  const explanation = state === 'stable'
    ? boundariesCrossed === 0
      ? `The supported range remains within grade ${lowGrade}.`
      : `The range touches one adjacent grade, while the central score strongly supports grade ${productLetterGrade(centralScore)}.`
    : state === 'unresolved'
      ? `The supported range spans ${gradesSpanned[0]} through ${gradesSpanned.at(-1)}, so the letter grade is uncertain.`
      : `The supported range crosses ${boundariesCrossed} grade ${boundariesCrossed === 1 ? 'boundary' : 'boundaries'}, so the letter grade is provisional.`;
  return {
    state,
    centralGrade: productLetterGrade(centralScore),
    boundariesCrossed,
    gradesSpanned,
    explanation
  };
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

function productFormFromArchetype(archetype: ProductArchetype | null): ProductForm | null {
  if (!archetype) return null;
  if (archetype.form === 'beverage') return 'beverage';
  if (archetype.form === 'powder') return 'powder_mix';
  if (archetype.form === 'pantry') return 'pantry_staple';
  if (archetype.intent === 'condiment') return 'condiment_or_sauce';
  return 'ready_to_eat';
}

export function productBetterOptions(score: number | null, categoryId: string | null): ProductBetterOption[] {
  if (score === null || score >= 80) return [];
  const title = 'What to Compare' as const;
  if (!categoryId) return [{
    title,
    summary: 'Compare products with a similar intended use when that context is available.',
    criteria: ['Complete ingredient evidence', 'Fewer directly observed formulation signals', 'Clear serving and nutrition information'],
    reason_codes: ['compare_direct_label_evidence']
  }];
  if (categoryId === 'salt' || categoryId === 'low_sodium_salt') return [{ title, summary: 'Compare salts within the same pantry use.', criteria: ['Simple ingredient list', 'Additive use', 'Transparent sourcing', 'Documented quality testing when available'], reason_codes: ['compare_salt_label'] }];
  if (categoryId === 'marinara' || categoryId === 'condiments') return [{ title, summary: 'Compare sauces intended for the same meal use.', criteria: ['Straightforward tomato, oil, and seasoning pattern', 'Sodium in serving context', 'Fewer formulation signals'], reason_codes: ['compare_sauce_label'] }];
  if (categoryId === 'ice_cream' || categoryId === 'frozen_dairy_dessert' || categoryId === 'cookies' || categoryId === 'chocolate') return [{ title, summary: 'Compare a similar dessert or frozen treat.', criteria: ['Straightforward category-standard base', 'Fewer flavor, color, or texture systems', 'Clear serving information'], reason_codes: ['compare_dessert_label'] }];
  if (categoryId === 'electrolyte' || categoryId === 'electrolyte_beverage') return [{ title, summary: 'Compare hydration products intended for the same use.', criteria: ['Clear serving instructions', 'Mineral amounts shown per intended use', 'Simpler flavor and sweetener system'], reason_codes: ['compare_electrolyte_label'] }];
  if (categoryId === 'soda' || categoryId === 'energy_drink') return [{ title, summary: 'Compare beverages intended for the same use.', criteria: ['Declared sweetener system', 'Fewer color, preservative, and flavor-system signals', 'Clear serving and caffeine information when applicable'], reason_codes: ['compare_formulated_beverage_label'] }];
  return [{ title, summary: 'Compare products intended for the same use.', criteria: ['Category-standard ingredient base', 'Fewer formulation signals', 'Claims supported by the available label'], reason_codes: ['compare_product_label'] }];
}

function summaryFor(categoryId: string | null, band: ProductGradeBand): string {
  if (!categoryId) {
    if (band === 'strong' || band === 'solid') return 'Direct label evidence supports a strong provisional result, but category-specific comparison is unavailable.';
    if (band === 'mixed') return 'Direct label evidence supports a mixed provisional result without category-specific comparison.';
    return 'Direct label evidence supports a bounded provisional result, with important uncertainty because category-specific comparison is unavailable.';
  }
  if (categoryId === 'salt' || categoryId === 'low_sodium_salt') return 'Sodium is expected for salt. This result focuses on ingredient simplicity and label transparency.';
  if (categoryId === 'electrolyte') return 'This hydration mix is interpreted for its intended prepared use.';
  if (categoryId === 'electrolyte_beverage') return 'This electrolyte beverage is interpreted for its intended hydration use.';
  if (categoryId === 'sparkling_water') return 'This is interpreted as sparkling water rather than as a sweetened soft drink.';
  if (categoryId === 'energy_drink') return 'This is interpreted within the energy-drink category, including its caffeine and formulation context.';
  if (categoryId === 'ice_cream' || categoryId === 'frozen_dairy_dessert' || categoryId === 'cookies' || categoryId === 'chocolate') return 'This is a label-quality result within its dessert category, not a universal frequency judgment.';
  if (band === 'strong') return 'The available label shows strong quality within this product category.';
  if (band === 'solid') return 'The available label shows good quality within this product category.';
  if (band === 'mixed') return 'The available label has a mix of supportive and watch signals for this category.';
  if (band === 'cautious') return 'Several label signals are worth comparing within this product category.';
  return 'The available label shows a more complex pattern for this product category.';
}

function emptyDimensionScore(): ProductDimensionScore {
  return {
    score: null,
    range: null,
    dimensions: [],
    supportedWeight: 0,
    scoreScope: 'supported_evidence',
    aggregation: {
      method: 'conditional_supported_evidence_with_unknown_interval',
      formula: 'sum(weight * supported score) / supported weight',
      supportedWeightedSum: 0,
      supportedWeight: 0,
      unknownWeight: 1,
      supportedDimensionCount: 0,
      conditionalCentralScore: null,
      scoreScope: 'supported_evidence',
      materialUnknownDimensions: []
    }
  };
}

function unresolvedResult(
  input: ProductScoringInput,
  resolution: CategoryResolution,
  source: DataConfidence,
  basis: ProductNutrientBasis,
  archetype: ProductArchetype | null,
  dimensionScore: ProductDimensionScore,
  eligibility: ProductScoreEligibility
): ProductScoringResult {
  const form = resolution.productForm ?? productFormFromArchetype(archetype);
  const identityMissing = eligibility.deniedReasons.includes('exact_identity_not_established');
  const ingredientsMissing = !input.ingredientsText?.trim();
  return {
    engineVersion: PRODUCT_QUALITY_ENGINE_VERSION,
    absoluteScore: null, rawScore: null, categoryScore: null, categoryComparisonAvailable: false, displayScore: null, letterGrade: null,
    gradeBand: 'calibrating', gradeLabel: 'Not enough data', label: 'calibrating', tier: null,
    tierLabel: ingredientsMissing ? 'Ingredient data unavailable' : 'Insufficient direct scoring evidence',
    categoryId: resolution.selectedCategoryId, categoryLabel: resolution.selectedCategoryLabel,
    categoryResolution: resolution, productForm: form, preparedUse: productFormCopy(form, basis), nutrientBasis: basis,
    macroContext: macroContext(basis, getCategoryProfile(resolution.selectedCategoryId)), factors: [], topDrivers: [], scoreLedger: [],
    archetype, dimensions: dimensionScore.dimensions, scoreRange: null, supportedDimensionWeight: dimensionScore.supportedWeight,
    scoreScope: dimensionScore.scoreScope,
    dimensionAggregation: dimensionScore.aggregation,
    scoreEligibility: eligibility,
    generalizedFallbackUsed: eligibility.generalizedFallbackUsed,
    scoreBaseline: null, scoreCap: null, gradeEligibility: null, gradeCertainty: null, sourceConfidence: source, interpretationConfidence: resolution.interpretationConfidence,
    confidence: ingredientsMissing || identityMissing
      ? 'low'
      : lowerConfidence(lowerConfidence(source, resolution.interpretationConfidence), basis.confidence),
    summary: identityMissing
      ? 'The exact product identity is not established, so no Product Quality grade is assigned.'
      : ingredientsMissing
      ? 'Ingredient data is incomplete, so no Product Quality grade is assigned.'
      : 'The available direct evidence does not yet support enough material dimensions for a useful bounded result.',
    positives: [], considerations: ['More direct label evidence will make this interpretation clearer.'], better_options: [], evidence_refs: [],
    reasonCodes: unique([
      ...(identityMissing ? ['product_identity_unresolved'] : []),
      ...(ingredientsMissing ? ['ingredient_data_missing'] : []),
      ...eligibility.deniedReasons,
      'product_score_more_data_needed'
    ])
  };
}

export function scoreProductLabel(input: ProductScoringInput): ProductScoringResult {
  const parsedIngredients = parseIngredients(input.ingredientsText, input.ingredientEvidenceStatus ?? 'unknown');
  const ingredients = normalize(ingredientTextForMatching(parsedIngredients));
  const tokens = parsedIngredients.topLevelIngredients;
  const source = sourceConfidence(input);
  const resolution = resolveProductCategory({
    name: input.name,
    explicitCategory: input.category,
    categoryTags: input.categoryTags,
    ingredientsText: ingredients,
    ingredientEvidenceStatus: input.ingredientEvidenceStatus,
    servingNutrients: input.servingNutrients
  });
  const profile = getCategoryProfile(resolution.selectedCategoryId);
  const fallbackPreference: NutrientBasisPreference = resolution.productForm === 'salt' ? 'pantry_context' : 'per_serving';
  const basis = selectNutrientBasis(input, profile?.nutrientBasis ?? fallbackPreference);
  const archetype = resolveProductArchetype(input, resolution);

  if (!archetype) {
    const dimensionScore = emptyDimensionScore();
    const scoreEligibilityResult = scoreEligibility(input, basis, profile, dimensionScore);
    return unresolvedResult(input, resolution, source, basis, null, dimensionScore, scoreEligibilityResult);
  }

  const legacyLedger = profile ? [
    ...ingredientLedger(profile, ingredients, tokens, input.labels ?? []),
    ...categoryLedger(profile, input, ingredients, tokens, basis, tokens.length > 0)
  ] : [];
  const ledger = legacyLedgerAsContext(legacyLedger);
  const experiment = process.env.EXPO_PUBLIC_PRODUCT_QUALITY_EXPERIMENT;
  const dimensionScorer = experiment === 'v6_composition'
    ? scoreProductDimensionsV6
    : experiment === 'v5_two_axis'
      ? scoreProductDimensionsV5Experimental
      : scoreProductDimensionsV5;
  const dimensionScore = dimensionScorer({ input, archetype, basis, sourceConfidence: source, profile });
  const scoreEligibilityResult = scoreEligibility(input, basis, profile, dimensionScore);
  if (!scoreEligibilityResult.eligible || dimensionScore.score === null) {
    return unresolvedResult(input, resolution, source, basis, archetype, dimensionScore, scoreEligibilityResult);
  }
  const rawScore = dimensionScore.score;
  const gradeEligibility = rawScore >= 90
    ? evaluateAGradeEligibility(input, dimensionScore.dimensions)
    : null;
  const deniedTopGrade = gradeEligibility !== null && !gradeEligibility.aEligible;
  const displayScore = deniedTopGrade ? 89 : rawScore;
  if (deniedTopGrade) {
    ledger.push({
      ruleId: 'grade_eligibility_adjustment',
      ruleFamily: 'claim_alignment',
      label: 'Multidimensional A-grade eligibility',
      status: 'applied',
      delta: displayScore - rawScore,
      evidence: [...gradeEligibility.deniedReasons],
      reasonCode: 'grade_eligibility_adjustment',
      presentation: 'hidden',
      visibility: 'none',
      userVisibleExplanation: null,
      hiddenReason: 'An A grade requires strong ingredient integrity, low formulation complexity, strong nutrition evidence, no major watch signal, and sufficient label transparency.',
      transformation: 'grade_eligibility'
    });
  }
  const letterGrade = productLetterGrade(displayScore);
  const gradeBand = productGradeBand(letterGrade);
  const supportedDimensions = dimensionScore.dimensions.filter((dimension) => dimension.score !== null);
  const factors = supportedDimensions.map(factorFromDimension);
  const topDrivers = [...supportedDimensions]
    .sort((left, right) => Math.abs((right.score ?? 70) - 70) * right.effectiveWeight - Math.abs((left.score ?? 70) - 70) * left.effectiveWeight)
    .slice(0, 3)
    .map(factorFromDimension);
  const dimensionCopy = dimensionExplanations(dimensionScore.dimensions);
  const positives = [...dimensionCopy.positives];
  const considerations = [
    ...dimensionCopy.considerations,
    ...(deniedTopGrade ? ['An A grade requires strong ingredient integrity, low formulation complexity, strong nutrition evidence, and sufficient label transparency.'] : []),
    ...ledger.filter((entry) => entry.status === 'context_only' && entry.visibility !== 'none' && entry.userVisibleExplanation)
      .map((entry) => `Context only — ${entry.userVisibleExplanation}`)
  ];
  const evidence_refs = resolveProductEvidence(ledger.flatMap((entry) => entry.evidence.filter((item) => item.includes('_') && !item.includes(' '))));
  const reasonCodes = unique([
    ...(profile ? [`category_${profile.categoryId}`] : ['generalized_evidence_fallback']),
    ...supportedDimensions.flatMap((dimension) => dimension.rulesFired),
    ...ledger.filter((entry) => entry.status === 'context_only' && entry.visibility !== 'none').map((entry) => `context_${entry.reasonCode}`)
  ]);
  const tier = processingTier(tokens, dimensionScore.dimensions);
  const resolvedForm = profile?.productForm ?? resolution.productForm ?? productFormFromArchetype(archetype);
  const resultConfidence = lowerConfidence(lowerConfidence(source, resolution.interpretationConfidence), basis.confidence);
  const scoreRange: [number, number] = dimensionScore.range
    ? [Math.min(dimensionScore.range[0], displayScore), Math.max(dimensionScore.range[1], displayScore)]
    : [displayScore, displayScore];
  const gradeCertainty = productGradeCertainty(displayScore, scoreRange);

  return {
    engineVersion: PRODUCT_QUALITY_ENGINE_VERSION,
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
    categoryId: profile?.categoryId ?? resolution.selectedCategoryId,
    categoryLabel: resolution.selectedCategoryLabel,
    categoryResolution: resolution,
    productForm: resolvedForm,
    preparedUse: productFormCopy(resolvedForm, basis),
    nutrientBasis: basis,
    macroContext: macroContext(basis, profile),
    factors,
    topDrivers,
    scoreLedger: ledger,
    archetype,
    dimensions: dimensionScore.dimensions,
    scoreRange,
    supportedDimensionWeight: dimensionScore.supportedWeight,
    scoreScope: dimensionScore.scoreScope,
    dimensionAggregation: dimensionScore.aggregation,
    scoreEligibility: scoreEligibilityResult,
    generalizedFallbackUsed: scoreEligibilityResult.generalizedFallbackUsed,
    scoreBaseline: null,
    scoreCap: null,
    gradeEligibility,
    gradeCertainty,
    sourceConfidence: source,
    interpretationConfidence: resolution.interpretationConfidence,
    confidence: resultConfidence,
    summary: `${summaryFor(profile?.categoryId ?? null, gradeBand)}${dimensionScore.scoreScope === 'supported_evidence'
      ? ' This conditional score summarizes supported Product Quality dimensions only; the deterministic range shows what missing material evidence could change.'
      : ''}`,
    positives: unique(positives),
    considerations: unique(considerations),
    better_options: productBetterOptions(displayScore, profile?.categoryId ?? null),
    evidence_refs,
    reasonCodes
  };
}
