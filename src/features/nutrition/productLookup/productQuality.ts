import type { DataConfidence, NutritionReasonCode } from '../../../engines/nutrition';
import { productGradeBand, scoreProductLabel } from '../../../engines/nutrition/productScoring';
import type { HealthiProductSnapshot, ProductQualitySnapshot } from './productLookupTypes';

function uniqueReasons(reasons: NutritionReasonCode[]): NutritionReasonCode[] {
  return [...new Set(reasons)];
}

const LEGACY_MEAL_REASON_CODES = new Set<NutritionReasonCode>([
  'protein_low',
  'fiber_low',
  'added_sugar_high',
  'sodium_high',
  'processing_level_high',
  'balanced_meal',
  'whole_food_emphasis'
]);

function scannerReasonCodes(snapshot: HealthiProductSnapshot): NutritionReasonCode[] {
  return snapshot.reason_codes.filter((reason) => !LEGACY_MEAL_REASON_CODES.has(reason));
}

function lowerOf(left: DataConfidence, right: DataConfidence): DataConfidence {
  const order: Record<DataConfidence, number> = { low: 0, medium: 1, high: 2 };
  return order[left] <= order[right] ? left : right;
}

function derivedPer100g(snapshot: HealthiProductSnapshot): NonNullable<HealthiProductSnapshot['nutriments_per_100g']> {
  if (snapshot.nutriments_per_100g) return { ...snapshot.nutriments_per_100g };
  const grams = snapshot.serving_quantity_g;
  const multiplier = typeof grams === 'number' && grams > 0 ? 100 / grams : null;
  const scale = (value: number | null | undefined): number | null => (
    multiplier !== null && typeof value === 'number'
      ? Math.round(value * multiplier * 10) / 10
      : null
  );
  return {
    calories: scale(snapshot.calories_per_serving),
    sugar_g: scale(snapshot.sugar_g),
    protein_g: scale(snapshot.protein_g),
    fiber_g: scale(snapshot.fiber_g),
    sodium_mg: scale(snapshot.sodium_mg),
    saturated_fat_g: scale(snapshot.saturated_fat_g)
  };
}

function estimatedRange(score: number, status: NonNullable<HealthiProductSnapshot['ingredient_evidence']>['status']): [NonNullable<ProductQualitySnapshot['letter_grade']>, NonNullable<ProductQualitySnapshot['letter_grade']>] {
  const uncertainty = status === 'partial' ? 6 : status === 'reconstructed' ? 8 : 12;
  const high = Math.min(89, score + uncertainty);
  const low = Math.max(0, score - uncertainty);
  const grade = (value: number) => value >= 90 ? 'A' as const : value >= 80 ? 'B' as const : value >= 70 ? 'C' as const : value >= 60 ? 'D' as const : 'F' as const;
  return [grade(high), grade(low)];
}

function resultState(snapshot: HealthiProductSnapshot, interpretation: DataConfidence): 'final' | 'estimated' | 'more_data_needed' {
  const identity = snapshot.evidence_confidence?.identity ?? (snapshot.name.trim() ? 'medium' : 'low');
  const ingredientStatus = snapshot.ingredient_evidence?.status ?? (snapshot.ingredients_text?.trim() ? 'partial' : 'absent');
  if (identity === 'low' || interpretation === 'low' || (snapshot.provider_conflicts?.length ?? 0) > 0) return 'more_data_needed';
  return ingredientStatus === 'complete' ? 'final' : 'estimated';
}

export function calculateProductQuality(snapshot: HealthiProductSnapshot): ProductQualitySnapshot {
  const hasProviderServing = Boolean(snapshot.serving_size?.trim()) || (
    typeof snapshot.serving_quantity_g === 'number' && snapshot.serving_quantity_g > 0
  );
  const scored = scoreProductLabel({
    name: snapshot.name,
    ingredientsText: snapshot.ingredients_text,
    labels: snapshot.labels,
    categoryTags: snapshot.categories_tags,
    packaging: snapshot.packaging_tags,
    sourceConfidence: snapshot.evidence_confidence?.ingredients ?? snapshot.confidence,
    ingredientEvidenceStatus: snapshot.ingredient_evidence?.status ?? (snapshot.ingredients_text ? 'partial' : 'absent'),
    nutrimentsPer100g: derivedPer100g(snapshot),
    servingNutrients: hasProviderServing ? {
      calories: snapshot.calories_per_serving,
      sugar_g: snapshot.sugar_g,
      carbs_g: snapshot.carbs_g,
      protein_g: snapshot.protein_g,
      fat_g: snapshot.fat_g,
      fiber_g: snapshot.fiber_g,
      sodium_mg: snapshot.sodium_mg,
      saturated_fat_g: snapshot.saturated_fat_g,
      serving_quantity_g: snapshot.serving_quantity_g
    } : undefined
  });

  const positives = [...scored.positives];
  const considerations = [...scored.considerations];
  if (!snapshot.categories_tags?.length && scored.categoryId === null) {
    considerations.push('There is not enough reliable category information to assign a grade yet.');
  }

  const reasons: NutritionReasonCode[] = scannerReasonCodes(snapshot);
  if (scored.label === 'supportive') reasons.push('food_quality_supportive');
  if (scored.label === 'watch') reasons.push('nutrition_signal_watch');
  if (scored.label === 'calibrating') reasons.push('nutrition_calibrating', 'partial_nutrition_data');

  const state = resultState(snapshot, scored.interpretationConfidence);
  const ingredientStatus = snapshot.ingredient_evidence?.status ?? (snapshot.ingredients_text ? 'partial' : 'absent');
  const range = state === 'estimated' && scored.displayScore !== null ? estimatedRange(scored.displayScore, ingredientStatus) : null;
  const missingEvidence = [
    ...(ingredientStatus === 'complete' ? [] : ['Complete package ingredient details are unavailable.']),
    ...(snapshot.evidence_confidence?.serving === 'low' ? ['Provider-supplied serving details are unavailable.'] : []),
    ...(snapshot.evidence_confidence?.nutrition === 'low' ? ['Nutrition details are incomplete.'] : []),
    ...((snapshot.provider_conflicts?.length ?? 0) > 0 ? ['Available provider records materially disagree.'] : [])
  ];
  const publicScore = state === 'final' ? scored.displayScore : null;
  const publicGrade = state === 'more_data_needed' ? null : scored.letterGrade === 'A' && state === 'estimated' ? 'B' : scored.letterGrade;
  const publicSummary = state === 'final'
    ? scored.summary
    : state === 'estimated'
      ? 'This is an estimated grade based on partial label evidence. Ingredient details could change the result.'
      : 'More label data is needed before assigning a responsible Product Quality grade.';

  return {
    score: publicScore,
    label: scored.label,
    summary: publicSummary,
    positives,
    considerations,
    confidence: lowerOf(snapshot.confidence, scored.confidence),
    reason_codes: uniqueReasons(reasons),
    absolute_score: publicScore,
    category_score: scored.categoryScore,
    category_id: scored.categoryId,
    category_label: scored.categoryLabel,
    category_comparison_available: scored.categoryComparisonAvailable,
    product_form: scored.productForm,
    prepared_use: scored.preparedUse,
    nutrient_basis: {
      type: scored.nutrientBasis.type,
      source: scored.nutrientBasis.source,
      confidence: scored.nutrientBasis.confidence
    },
    macro_context: {
      summary: scored.macroContext.summary,
      highlights: [...scored.macroContext.highlights]
    },
    top_drivers: scored.topDrivers.map((factor) => ({
      ...factor,
      matched: [...factor.matched],
      evidence_refs: [...(factor.evidence_refs ?? [])]
    })),
    source_confidence: scored.sourceConfidence,
    interpretation_confidence: scored.interpretationConfidence,
    processing_tier: scored.tier,
    processing_tier_label: scored.tierLabel,
    factors: scored.factors,
    limiting_factor: scored.scoreCap
      ? { rule_id: scored.scoreCap.ruleId, label: scored.scoreCap.label, cap: scored.scoreCap.cap }
      : null,
    scoring_reason_codes: [...scored.reasonCodes],
    letter_grade: publicGrade,
    grade_band: publicGrade ? productGradeBand(publicGrade) : 'calibrating',
    grade_label: state === 'final' ? scored.gradeLabel : state === 'estimated' ? 'Estimated grade' : 'More data needed',
    better_options: scored.better_options.map((option) => ({
      ...option,
      criteria: [...option.criteria],
      reason_codes: [...option.reason_codes]
    })),
    evidence_refs: scored.evidence_refs.map((reference) => ({ ...reference })),
    result_state: state,
    estimated_grade_range: range,
    missing_evidence: missingEvidence,
    evidence_confidence: snapshot.evidence_confidence ? { ...snapshot.evidence_confidence } : undefined
  };
}
