import { CATEGORY_SCORE_SLOPE, detectProductCategory } from './categories';
import {
  INGREDIENT_CONSIDERATION_RULES,
  INGREDIENT_POSITIVE_RULES,
  MAX_INGREDIENT_BONUS,
  type ProductIngredientRule,
  type ProductRuleSeverity
} from './rules';

export type ProductProcessingTier = 1 | 2 | 3 | 4;
export type ProductScoreLabel = 'supportive' | 'steady' | 'watch' | 'calibrating';

export type ProductScoringInput = {
  name: string;
  ingredientsText?: string | null;
  labels?: string[];
  category?: string | null;
  categoryTags?: string[];
  packaging?: string[];
  nutrimentsPer100g?: {
    sugar_g?: number | null;
    protein_g?: number | null;
    fiber_g?: number | null;
    sodium_mg?: number | null;
  };
};

export type ProductScoreFactor = {
  id: string;
  label: string;
  points: number;
  rawPoints: number;
  severity: ProductRuleSeverity;
  matched: string[];
  explanation: string;
};

export type ProductScoringResult = {
  absoluteScore: number | null;
  categoryScore: number | null;
  displayScore: number | null;
  label: ProductScoreLabel;
  tier: ProductProcessingTier | null;
  tierLabel: string;
  categoryId: string | null;
  categoryLabel: string | null;
  factors: ProductScoreFactor[];
  scoreCap: { ruleId: string; label: string; cap: number } | null;
  confidence: 'low' | 'medium' | 'high';
  summary: string;
  reasonCodes: string[];
};

const TIERS: Record<ProductProcessingTier, { label: string; base: number; floor: number; ceiling: number }> = {
  1: { label: 'Single-ingredient or whole-food pattern', base: 94, floor: 85, ceiling: 100 },
  2: { label: 'Short, straightforward ingredient pattern', base: 82, floor: 68, ceiling: 94 },
  3: { label: 'Formulated packaged-food pattern', base: 64, floor: 36, ceiling: 80 },
  4: { label: 'Highly formulated packaged-food pattern', base: 46, floor: 8, ceiling: 62 }
};

const DEDUCTION_DECAY = [1, 0.75, 0.55, 0.4, 0.3];

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/\band\/or\b/g, ',').replace(/\d+(\.\d+)?\s?%/g, '').replace(/\s+/g, ' ').trim();
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
  return { id: rule.id, label: rule.label, points, rawPoints: points, severity: rule.severity, matched: [...matched], explanation: rule.explanation };
}

function classifyTier(tokens: string[], matchedRules: ProductIngredientRule[]): ProductProcessingTier {
  if (matchedRules.some((rule) => rule.minimumTier === 4)) return 4;
  if (matchedRules.some((rule) => rule.minimumTier === 3)) return 3;
  if (tokens.length <= 1) return 1;
  return tokens.length <= 5 ? 2 : 3;
}

function nutritionFactors(tier: ProductProcessingTier, input?: ProductScoringInput['nutrimentsPer100g']): ProductScoreFactor[] {
  if (!input || tier <= 2) return [];
  const factors: ProductScoreFactor[] = [];
  const add = (id: string, label: string, points: number, explanation: string) => factors.push({
    id, label, points, rawPoints: points, severity: points > 0 ? 'positive' : 'light', matched: [], explanation
  });
  if (typeof input.sugar_g === 'number' && input.sugar_g >= 30) add('sugar_density', 'Higher sugar density', -7, 'Sugar is higher per 100 g based on available nutrition facts.');
  else if (typeof input.sugar_g === 'number' && input.sugar_g >= 15) add('sugar_density', 'Moderate sugar density', -4, 'Sugar is moderate per 100 g based on available nutrition facts.');
  if (typeof input.sodium_mg === 'number' && input.sodium_mg >= 1500) add('sodium_density', 'Higher sodium density', -4, 'Sodium is higher per 100 g based on available nutrition facts.');
  if (typeof input.protein_g === 'number' && input.protein_g >= 15) add('protein_density', 'Useful protein density', 3, 'Protein is useful per 100 g based on available nutrition facts.');
  if (typeof input.fiber_g === 'number' && input.fiber_g >= 6) add('fiber_density', 'Useful fiber density', 3, 'Fiber is useful per 100 g based on available nutrition facts.');
  return factors;
}

function scoreLabel(score: number): ProductScoreLabel {
  if (score >= 74) return 'supportive';
  if (score >= 52) return 'steady';
  return 'watch';
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
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
      label: 'calibrating',
      tier: null,
      tierLabel: 'Ingredient data unavailable',
      categoryId: category?.id ?? null,
      categoryLabel: category?.label ?? null,
      factors: [],
      scoreCap: null,
      confidence: 'low',
      summary: 'Ingredient data is incomplete, so the label-based food quality signal is still calibrating.',
      reasonCodes: ['ingredient_data_missing', 'product_score_calibrating']
    };
  }

  const deductionMatches = INGREDIENT_CONSIDERATION_RULES.flatMap((rule) => {
    const factor = matchRule(rule, normalizedIngredients, tokens);
    return factor ? [{ rule, factor }] : [];
  });
  const labelText = normalize(`${normalizedIngredients} ${(input.labels ?? []).join(' ')}`);
  const positiveFactors = INGREDIENT_POSITIVE_RULES.flatMap((rule) => {
    const factor = matchRule(rule, labelText, tokens);
    return factor ? [factor] : [];
  });
  const tier = classifyTier(tokens, deductionMatches.map((match) => match.rule));
  const tierConfig = TIERS[tier];

  const deductions = deductionMatches.map((match) => ({ ...match.factor })).sort((left, right) => left.rawPoints - right.rawPoints);
  deductions.forEach((factor, index) => {
    factor.points = Math.round(factor.rawPoints * DEDUCTION_DECAY[Math.min(index, DEDUCTION_DECAY.length - 1)]! * 10) / 10;
  });

  const positiveTotal = positiveFactors.reduce((sum, factor) => sum + factor.points, 0);
  if (positiveTotal > MAX_INGREDIENT_BONUS) {
    const multiplier = MAX_INGREDIENT_BONUS / positiveTotal;
    positiveFactors.forEach((factor) => { factor.points = Math.round(factor.points * multiplier * 10) / 10; });
  }
  const nutrition = nutritionFactors(tier, input.nutrimentsPer100g);
  const factors = [...deductions, ...positiveFactors, ...nutrition].sort((left, right) => Math.abs(right.points) - Math.abs(left.points));
  let absoluteScore = tierConfig.base + factors.reduce((sum, factor) => sum + factor.points, 0);
  absoluteScore = clamp(absoluteScore, tierConfig.floor, tierConfig.ceiling);

  let scoreCap: ProductScoringResult['scoreCap'] = null;
  for (const match of deductionMatches) {
    if (typeof match.rule.scoreCap === 'number' && match.rule.scoreCap < absoluteScore) {
      if (!scoreCap || match.rule.scoreCap < scoreCap.cap) {
        scoreCap = { ruleId: match.rule.id, label: match.rule.label, cap: match.rule.scoreCap };
      }
    }
  }
  if (scoreCap) absoluteScore = scoreCap.cap;
  absoluteScore = Math.round(clamp(absoluteScore, 0, 100));

  const categoryScore = category
    ? Math.round(clamp(50 + (absoluteScore - category.typicalScore) * CATEGORY_SCORE_SLOPE, 5, 98))
    : null;
  const displayScore = tier >= 3 && categoryScore !== null ? categoryScore : absoluteScore;
  const label = scoreLabel(displayScore);
  const knownNutritionFields = Object.values(input.nutrimentsPer100g ?? {}).filter((value) => typeof value === 'number').length;
  const confidence = knownNutritionFields >= 3 && category ? 'high' : 'medium';
  const topFactors = factors.slice(0, 3).map((factor) => factor.label.toLowerCase());
  const summary = topFactors.length > 0
    ? `Based on available label data, this product has a ${label} food quality signal. Key label factors include ${topFactors.join(', ')}.`
    : `Based on available label data, this product has a ${label} food quality signal with a straightforward ingredient pattern.`;

  return {
    absoluteScore,
    categoryScore,
    displayScore,
    label,
    tier,
    tierLabel: tierConfig.label,
    categoryId: category?.id ?? null,
    categoryLabel: category?.label ?? null,
    factors,
    scoreCap,
    confidence,
    summary,
    reasonCodes: unique([
      `ingredient_tier_${tier}`,
      ...(category ? [`category_${category.id}`] : []),
      ...factors.map((factor) => factor.id),
      ...(scoreCap ? ['score_cap_applied'] : [])
    ])
  };
}
