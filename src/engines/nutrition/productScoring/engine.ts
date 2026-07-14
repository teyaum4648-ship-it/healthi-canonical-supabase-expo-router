import { CATEGORY_SCORE_SLOPE, detectProductCategory } from './categories';
import { resolveProductEvidence, type ProductEvidenceRef } from './evidence';
import {
  INGREDIENT_CONSIDERATION_RULES,
  INGREDIENT_POSITIVE_RULES,
  MAX_INGREDIENT_BONUS,
  type ProductIngredientRule,
  type ProductRuleSeverity
} from './rules';

export type ProductProcessingTier = 1 | 2 | 3 | 4;
export type ProductScoreLabel = 'supportive' | 'steady' | 'watch' | 'calibrating';
export type ProductLetterGrade = 'A' | 'A-' | 'B+' | 'B' | 'B-' | 'C+' | 'C' | 'C-' | 'D+' | 'D' | 'D-' | 'F';
export type ProductGradeBand = 'strong' | 'solid' | 'mixed' | 'cautious' | 'avoid' | 'calibrating';

export type ProductBetterOption = {
  title: string;
  summary: string;
  criteria: string[];
  reason_codes: string[];
};

export type ProductNutrients = {
  calories?: number | null;
  sugar_g?: number | null;
  protein_g?: number | null;
  fiber_g?: number | null;
  sodium_mg?: number | null;
  saturated_fat_g?: number | null;
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
  categoryScore: number | null;
  displayScore: number | null;
  letterGrade: ProductLetterGrade | null;
  gradeBand: ProductGradeBand;
  gradeLabel: string;
  label: ProductScoreLabel;
  tier: ProductProcessingTier | null;
  tierLabel: string;
  categoryId: string | null;
  categoryLabel: string | null;
  factors: ProductScoreFactor[];
  scoreCap: { ruleId: string; label: string; cap: number } | null;
  confidence: 'low' | 'medium' | 'high';
  summary: string;
  positives: string[];
  considerations: string[];
  better_options: ProductBetterOption[];
  evidence_refs: ProductEvidenceRef[];
  reasonCodes: string[];
};

const TIERS: Record<ProductProcessingTier, { label: string; base: number; floor: number; ceiling: number }> = {
  1: { label: 'Single-ingredient or whole-food pattern', base: 94, floor: 85, ceiling: 100 },
  2: { label: 'Short, straightforward ingredient pattern', base: 82, floor: 68, ceiling: 94 },
  3: { label: 'Formulated packaged-food pattern', base: 64, floor: 36, ceiling: 80 },
  4: { label: 'Highly formulated packaged-food pattern', base: 46, floor: 8, ceiling: 62 }
};

const DEDUCTION_DECAY = [1, 0.75, 0.55, 0.4, 0.3];
const SWEETENER_PATTERNS = [
  /\baspartame\b/,
  /\bsucralose\b/,
  /\bacesulfame( potassium)?\b/,
  /\bace-?k\b/,
  /\bsaccharin\b/,
  /\bneotame\b/,
  /\bstevia\b/,
  /\bmonk fruit\b/
];

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/\band\/or\b/g, ',').replace(/\d+(\.\d+)?\s?%/g, '').replace(/\s+/g, ' ').trim();
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function factor(
  id: string,
  label: string,
  points: number,
  explanation: string,
  options: { severity?: ProductRuleSeverity; evidence_refs?: string[]; matched?: string[] } = {}
): ProductScoreFactor {
  return {
    id,
    label,
    points,
    rawPoints: points,
    severity: options.severity ?? (points > 0 ? 'positive' : 'light'),
    matched: options.matched ?? [],
    explanation,
    evidence_refs: options.evidence_refs
  };
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
    } else {
      current += character;
    }
  }
  if (current.trim()) tokens.push(current.trim());
  return tokens.filter((token) => token.replace(/[^a-z]/gi, '').length > 0);
}

function matchRule(rule: ProductIngredientRule, text: string, tokens: string[]): ProductScoreFactor | null {
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
    if (rule.patterns.some((pattern) => new RegExp(pattern.source, pattern.flags.replace('g', '')).test(firstThree))) {
      points += rule.firstIngredientsAdjustment;
    }
  }
  return factor(rule.id, rule.label, points, rule.explanation, {
    severity: rule.severity,
    matched: [...matched],
    evidence_refs: rule.evidence_refs
  });
}

function classifyTier(tokens: string[], matchedRules: ProductIngredientRule[]): ProductProcessingTier {
  if (matchedRules.some((rule) => rule.minimumTier === 4)) return 4;
  if (matchedRules.some((rule) => rule.minimumTier === 3)) return 3;
  if (tokens.length <= 1) return 1;
  return tokens.length <= 5 ? 2 : 3;
}

export function productLetterGrade(score: number): ProductLetterGrade {
  if (score >= 92) return 'A';
  if (score >= 85) return 'A-';
  if (score >= 80) return 'B+';
  if (score >= 74) return 'B';
  if (score >= 70) return 'B-';
  if (score >= 64) return 'C+';
  if (score >= 56) return 'C';
  if (score >= 50) return 'C-';
  if (score >= 45) return 'D+';
  if (score >= 39) return 'D';
  if (score >= 35) return 'D-';
  return 'F';
}

export function productGradeBand(grade: ProductLetterGrade | null): ProductGradeBand {
  if (grade === null) return 'calibrating';
  if (grade === 'A' || grade === 'A-') return 'strong';
  if (grade.startsWith('B')) return 'solid';
  if (grade.startsWith('C')) return 'mixed';
  if (grade.startsWith('D')) return 'cautious';
  return 'avoid';
}

export function productGradeLabel(band: ProductGradeBand): string {
  if (band === 'strong') return 'Strong';
  if (band === 'solid') return 'Solid';
  if (band === 'mixed') return 'Not bad / Not good';
  if (band === 'cautious') return 'Cautious';
  if (band === 'avoid') return 'Avoid';
  return 'Calibrating';
}

function compatibilityLabel(band: ProductGradeBand): ProductScoreLabel {
  if (band === 'calibrating') return 'calibrating';
  if (band === 'strong' || band === 'solid') return 'supportive';
  if (band === 'mixed') return 'steady';
  return 'watch';
}

export function productBetterOptions(score: number | null, categoryId: string | null): ProductBetterOption[] {
  if (score === null || score >= 70) return [];
  if (categoryId === 'soda' || categoryId === 'juice') {
    return [{
      title: 'Try a lighter packaged beverage',
      summary: 'Look for a drink that reduces the main watch signals without requiring a perfect label.',
      criteria: ['Lower added sugar', 'Fewer watch additives', 'Sparkling water or unsweetened tea', 'Low-sugar prebiotic drink if it feels good for you'],
      reason_codes: ['better_beverage_criteria']
    }];
  }
  if (categoryId === 'chips') {
    return [{
      title: 'Look for a simpler crunchy option',
      summary: 'A short label and a more straightforward oil source can meaningfully improve the packaged-food choice.',
      criteria: ['Shorter ingredient list', 'Avocado, olive, or coconut oil', 'Lower sodium', 'No artificial colors or flavors', 'Simple tortilla or potato base'],
      reason_codes: ['better_snack_criteria']
    }];
  }
  if (categoryId === 'cookies' || categoryId === 'candy') {
    return [{
      title: 'Choose a simpler dessert pattern',
      summary: 'Dessert can still fit; a smaller serving and fewer formulation signals make the choice easier to balance.',
      criteria: ['Smaller serving', 'Simpler ingredient list', 'Fewer additives', 'Less added sugar', 'Pair with protein or fiber when useful'],
      reason_codes: ['better_dessert_criteria']
    }];
  }
  if (categoryId === 'bars') {
    return [{
      title: 'Look for a steadier bar',
      summary: 'Prioritize the nutrients that make a bar more useful rather than relying on front-label claims.',
      criteria: ['Higher protein', 'Higher fiber', 'Lower added sugar', 'Fewer sugar alcohols if digestion-sensitive'],
      reason_codes: ['better_bar_criteria']
    }];
  }
  return [{
    title: 'Compare the label pattern',
    summary: 'A nearby option with fewer watch signals may offer a better packaged-food fit.',
    criteria: ['Shorter ingredient list', 'More protein or fiber when relevant', 'Less added sugar', 'Lower sodium when relevant'],
    reason_codes: ['better_product_criteria']
  }];
}

function nutritionFactors(
  categoryId: string | null,
  per100?: ProductNutrients,
  serving?: ProductScoringInput['servingNutrients']
): ProductScoreFactor[] {
  const factors: ProductScoreFactor[] = [];
  const beverage = categoryId === 'soda' || categoryId === 'juice';
  const evidence = ['fda_daily_values'];
  if (!beverage && typeof per100?.sugar_g === 'number' && per100.sugar_g >= 30) {
    factors.push(factor('sugar_density', 'Higher sugar density', -7, 'Sugar is higher per 100 g based on available nutrition facts.', { evidence_refs: evidence }));
  } else if (!beverage && typeof per100?.sugar_g === 'number' && per100.sugar_g >= 15) {
    factors.push(factor('sugar_density', 'Moderate sugar density', -4, 'Sugar is moderate per 100 g based on available nutrition facts.', { evidence_refs: evidence }));
  }

  const sodiumPenalty = typeof serving?.sodium_mg === 'number' && serving.sodium_mg >= 400
    ? -6
    : typeof per100?.sodium_mg === 'number' && per100.sodium_mg >= 750
      ? -4
      : 0;
  if (sodiumPenalty) {
    factors.push(factor('sodium_density', 'Higher sodium', sodiumPenalty, 'Sodium is higher based on the available nutrition facts.', { evidence_refs: evidence }));
  }

  const usefulFiber = (serving?.fiber_g ?? 0) >= 5 || (per100?.fiber_g ?? 0) >= 6;
  if (usefulFiber) {
    factors.push(factor('fiber_density', 'Useful fiber', 4, 'Fiber is useful based on the available nutrition facts.', { evidence_refs: evidence }));
  } else if (categoryId === 'chips' && ((serving?.fiber_g ?? 0) < 2 || (per100?.fiber_g ?? 0) < 4)) {
    factors.push(factor('fiber_modest', 'Modest fiber', -3, 'Fiber is modest for this packaged snack.', { evidence_refs: evidence }));
  }

  if ((serving?.protein_g ?? 0) >= 15 || (per100?.protein_g ?? 0) >= 15) {
    factors.push(factor('protein_density', 'Useful protein', 3, 'Protein is useful based on the available nutrition facts.', { evidence_refs: evidence }));
  }
  return factors;
}

function scoreSummary(
  band: ProductGradeBand,
  factorIds: Set<string>
): string {
  if (factorIds.has('high_sugar_beverage')) {
    return 'Added sugar is high for a beverage serving, so this lands low even in packaged-food context.';
  }
  if (factorIds.has('prebiotic_fiber') && factorIds.has('lower_sugar_beverage')) {
    return 'This is a better packaged beverage choice than high-sugar soda, though added fibers may not feel great for everyone.';
  }
  if (factorIds.has('zero_sugar_beverage')) {
    return 'This avoids the high added-sugar load, but sweeteners keep it in the middle.';
  }
  if (band === 'strong') return 'A strong packaged-food choice based on the available label data.';
  if (band === 'solid') return 'A better packaged choice in this category, with a few context signals.';
  if (band === 'mixed') return 'This product has a mix of useful and watch signals in packaged-food context.';
  if (band === 'cautious') return 'This has several watch signals for a packaged food.';
  return 'This is one Healthi would usually suggest swapping when possible.';
}

function knownNutritionCount(input: ProductScoringInput): number {
  return [...Object.values(input.nutrimentsPer100g ?? {}), ...Object.values(input.servingNutrients ?? {})]
    .filter((value) => typeof value === 'number').length;
}

export function scoreProductLabel(input: ProductScoringInput): ProductScoringResult {
  const normalizedIngredients = normalize(input.ingredientsText ?? '');
  const tokens = splitIngredientList(normalizedIngredients);
  const category = detectProductCategory(input.category, input.name, input.categoryTags);

  if (tokens.length === 0) {
    return {
      absoluteScore: null,
      categoryScore: null,
      displayScore: null,
      letterGrade: null,
      gradeBand: 'calibrating',
      gradeLabel: 'Calibrating',
      label: 'calibrating',
      tier: null,
      tierLabel: 'Ingredient data unavailable',
      categoryId: category?.id ?? null,
      categoryLabel: category?.label ?? null,
      factors: [],
      scoreCap: null,
      confidence: 'low',
      summary: 'Ingredient data is incomplete, so the label-based food quality signal is still calibrating.',
      positives: [],
      considerations: ['More label data will make this estimate clearer.'],
      better_options: [],
      evidence_refs: [],
      reasonCodes: ['ingredient_data_missing', 'product_score_calibrating']
    };
  }

  const deductionMatches = INGREDIENT_CONSIDERATION_RULES.flatMap((rule) => {
    const matchedFactor = matchRule(rule, normalizedIngredients, tokens);
    return matchedFactor ? [{ rule, factor: matchedFactor }] : [];
  });
  const labelText = normalize(`${normalizedIngredients} ${(input.labels ?? []).join(' ')}`);
  const positiveFactors = INGREDIENT_POSITIVE_RULES.flatMap((rule) => {
    const matchedFactor = matchRule(rule, labelText, tokens);
    return matchedFactor ? [matchedFactor] : [];
  });
  const tier = classifyTier(tokens, deductionMatches.map((match) => match.rule));
  const tierConfig = TIERS[tier];
  const deductions = deductionMatches.map((match) => ({ ...match.factor })).sort((left, right) => left.rawPoints - right.rawPoints);
  deductions.forEach((item, index) => {
    item.points = Math.round(item.rawPoints * DEDUCTION_DECAY[Math.min(index, DEDUCTION_DECAY.length - 1)]! * 10) / 10;
  });

  const positiveTotal = positiveFactors.reduce((sum, item) => sum + item.points, 0);
  if (positiveTotal > MAX_INGREDIENT_BONUS) {
    const multiplier = MAX_INGREDIENT_BONUS / positiveTotal;
    positiveFactors.forEach((item) => { item.points = Math.round(item.points * multiplier * 10) / 10; });
  }

  const categoryId = category?.id ?? null;
  const beverage = categoryId === 'soda' || categoryId === 'juice';
  const factorIdsBeforeCalibration = new Set([...deductions, ...positiveFactors].map((item) => item.id));
  const calibrationFactors: ProductScoreFactor[] = [];
  const sugarServing = input.servingNutrients?.sugar_g;
  const sugarPer100 = input.nutrimentsPer100g?.sugar_g;
  const isHighSugarBeverage = beverage && (
    (typeof sugarServing === 'number' && sugarServing >= 25) ||
    (typeof sugarPer100 === 'number' && sugarPer100 >= 8)
  );
  const isVeryHighSugarBeverage = beverage && typeof sugarServing === 'number' && sugarServing >= 35;
  const lowSugarBeverage = beverage && (
    (typeof sugarServing === 'number' && sugarServing <= 8) ||
    (typeof sugarPer100 === 'number' && sugarPer100 <= 5)
  );
  const hasSweetener = factorIdsBeforeCalibration.has('non_sugar_sweetener');
  const hasPrebiotic = factorIdsBeforeCalibration.has('prebiotic_fiber');
  const hasSugarAlcohol = factorIdsBeforeCalibration.has('sugar_alcohol');

  if (isHighSugarBeverage) {
    calibrationFactors.push(factor(
      'high_sugar_beverage',
      'High-sugar beverage',
      isVeryHighSugarBeverage ? -22 : -18,
      'Added sugar is high for a beverage serving.',
      { severity: 'strong', evidence_refs: ['fda_daily_values'] }
    ));
  }
  if (lowSugarBeverage && hasPrebiotic) {
    calibrationFactors.push(factor(
      'lower_sugar_beverage',
      'Lower-sugar beverage',
      12,
      'Sugar is lower than a typical sugar-sweetened soft drink.',
      { evidence_refs: ['fda_daily_values'] }
    ));
  }
  if (beverage && hasSweetener && !isHighSugarBeverage) {
    calibrationFactors.push(factor(
      'zero_sugar_beverage',
      'Avoids a high added-sugar load',
      0,
      'Non-sugar sweeteners are a watch signal, but this avoids the high added-sugar load of regular soda.',
      { evidence_refs: ['fda_sweeteners_safety', 'who_nss_weight_control'] }
    ));
    const sweetenerCount = SWEETENER_PATTERNS.filter((pattern) => pattern.test(normalizedIngredients)).length;
    if (sweetenerCount >= 2) {
      calibrationFactors.push(factor(
        'multiple_sweeteners',
        'Multiple sweeteners',
        -7,
        'More than one non-sugar sweetener appears in the ingredient list.',
        { evidence_refs: ['fda_sweeteners_safety', 'who_nss_weight_control'] }
      ));
    }
  }
  if (tier >= 3) {
    calibrationFactors.push(factor(
      beverage ? 'formulated_beverage' : 'formulated_product',
      beverage ? 'Formulated beverage' : 'Formulated packaged food',
      0,
      'The ingredient pattern reflects a more formulated packaged product.',
      { evidence_refs: ['bmj_ultraprocessed_umbrella_review'] }
    ));
  }
  if (hasPrebiotic || hasSugarAlcohol) {
    calibrationFactors.push(factor(
      'possible_gi_response',
      'Personal digestion response may vary',
      0,
      'Added fibers or sugar alcohols may not feel the same for everyone.',
      { evidence_refs: ['fda_sugar_alcohol_notice'] }
    ));
  }

  const nutrition = nutritionFactors(categoryId, input.nutrimentsPer100g, input.servingNutrients);
  const factors = [...deductions, ...positiveFactors, ...nutrition, ...calibrationFactors]
    .sort((left, right) => Math.abs(right.points) - Math.abs(left.points));
  let absoluteScore = tierConfig.base + factors.reduce((sum, item) => sum + item.points, 0);
  absoluteScore = clamp(absoluteScore, tierConfig.floor, tierConfig.ceiling);

  const scoreCaps: Array<NonNullable<ProductScoringResult['scoreCap']>> = [];
  const considerCap = (ruleId: string, label: string, cap: number) => {
    if (cap < absoluteScore) scoreCaps.push({ ruleId, label, cap });
  };
  deductionMatches.forEach((match) => {
    if (typeof match.rule.scoreCap === 'number') considerCap(match.rule.id, match.rule.label, match.rule.scoreCap);
  });
  if (isHighSugarBeverage) considerCap('high_sugar_beverage', 'High-sugar beverage', isVeryHighSugarBeverage ? 22 : 28);
  if (beverage && hasSweetener && !hasPrebiotic) {
    considerCap('sweetened_zero_sugar_beverage', 'Sweetened zero-sugar beverage', 63);
  }
  if (beverage && hasPrebiotic && lowSugarBeverage) considerCap('functional_beverage_ceiling', 'Formulated beverage ceiling', 79);
  if (categoryId === 'chips') considerCap('packaged_snack_ceiling', 'Packaged snack ceiling', 72);
  if (categoryId === 'cookies') considerCap('dessert_category_ceiling', 'Dessert category ceiling', 44);
  const complexCookie = categoryId === 'cookies' &&
    factorIdsBeforeCalibration.has('added_sugar') &&
    factorIdsBeforeCalibration.has('refined_flour') &&
    ['refined_oil_blend', 'emulsifier', 'artificial_flavor', 'flavor_blend']
      .filter((id) => factorIdsBeforeCalibration.has(id)).length >= 2;
  if (complexCookie) considerCap('complex_cookie_pattern', 'Complex dessert pattern', 30);
  const scoreCap = scoreCaps.sort((left, right) => left.cap - right.cap)[0] ?? null;
  if (scoreCap) absoluteScore = scoreCap.cap;
  absoluteScore = Math.round(clamp(absoluteScore, 0, 100));

  const categoryScore = category
    ? Math.round(clamp(50 + (absoluteScore - category.typicalScore) * CATEGORY_SCORE_SLOPE, 5, 98))
    : null;
  const displayScore = absoluteScore;
  const letterGrade = productLetterGrade(displayScore);
  const gradeBand = productGradeBand(letterGrade);
  const gradeLabel = productGradeLabel(gradeBand);
  const label = compatibilityLabel(gradeBand);
  const nutritionCount = knownNutritionCount(input);
  const confidence = nutritionCount >= 4 && category ? 'high' : nutritionCount >= 2 ? 'medium' : 'low';
  const factorIds = new Set(factors.map((item) => item.id));
  const positives = unique(factors.filter((item) => item.points > 0).map((item) => item.explanation));
  if (positives.length === 0 && tier <= 2) positives.push('The available ingredient list is short and straightforward.');
  const considerations = unique(factors
    .filter((item) => item.points < 0 || item.id === 'possible_gi_response' || item.id === 'formulated_product' || item.id === 'formulated_beverage')
    .map((item) => item.explanation));
  const evidence_refs = resolveProductEvidence(factors.flatMap((item) => item.evidence_refs ?? []));
  const reasonCodes = unique([
    `ingredient_tier_${tier}`,
    ...(category ? [`category_${category.id}`] : []),
    ...factors.map((item) => item.id),
    ...(hasSweetener ? ['non_sugar_sweetener', 'sweetener_watch_signal'] : []),
    ...(beverage && hasSweetener ? ['zero_sugar_beverage'] : []),
    ...(scoreCap ? ['score_cap_applied'] : [])
  ]);

  return {
    absoluteScore,
    categoryScore,
    displayScore,
    letterGrade,
    gradeBand,
    gradeLabel,
    label,
    tier,
    tierLabel: tierConfig.label,
    categoryId,
    categoryLabel: category?.label ?? null,
    factors,
    scoreCap,
    confidence,
    summary: scoreSummary(gradeBand, factorIds),
    positives,
    considerations,
    better_options: productBetterOptions(displayScore, categoryId),
    evidence_refs,
    reasonCodes
  };
}
