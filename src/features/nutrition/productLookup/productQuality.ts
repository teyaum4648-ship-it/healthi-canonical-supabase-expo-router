import type { DataConfidence, NutritionReasonCode } from '../../../engines/nutrition';
import {
  PRODUCT_EVIDENCE_REFERENCES,
  detectProductCategory,
  productBetterOptions,
  productGradeBand,
  productGradeLabel,
  productLetterGrade,
  scoreProductLabel
} from '../../../engines/nutrition/productScoring';
import type { HealthiProductSnapshot, ProductQualitySnapshot } from './productLookupTypes';

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function lowerConfidence(confidence: DataConfidence): DataConfidence {
  if (confidence === 'high') return 'medium';
  return confidence === 'medium' ? 'low' : 'low';
}

function uniqueReasons(reasons: NutritionReasonCode[]): NutritionReasonCode[] {
  return [...new Set(reasons)];
}

function calculateNutrientFallback(snapshot: HealthiProductSnapshot): ProductQualitySnapshot {
  const knownNutrients = [
    snapshot.calories_per_serving,
    snapshot.protein_g,
    snapshot.carbs_g,
    snapshot.fat_g,
    snapshot.fiber_g,
    snapshot.sugar_g,
    snapshot.sodium_mg
  ].filter((value) => typeof value === 'number').length;

  if (knownNutrients < 2) {
    return {
      score: null,
      label: 'calibrating',
      summary: 'Label data is limited, so the food quality signal is still calibrating.',
      positives: [],
      considerations: ['Add the available nutrition facts manually for a clearer signal.'],
      confidence: 'low',
      reason_codes: uniqueReasons([...snapshot.reason_codes, 'partial_nutrition_data', 'nutrition_calibrating']),
      letter_grade: null,
      grade_band: 'calibrating',
      grade_label: 'Calibrating',
      better_options: [],
      evidence_refs: []
    };
  }

  let score = 60;
  const positives: string[] = [];
  const considerations: string[] = [];
  const reasons = [...snapshot.reason_codes];

  if ((snapshot.protein_g ?? 0) >= 15) {
    score += 10;
    positives.push('Protein is supportive for this serving.');
  } else if ((snapshot.calories_per_serving ?? 0) >= 200 && (snapshot.protein_g ?? 0) < 6) {
    score -= 6;
    considerations.push('Protein is modest for this serving.');
  }

  if ((snapshot.fiber_g ?? 0) >= 5) {
    score += 12;
    positives.push('Higher fiber supports a steadier fueling signal.');
  } else if ((snapshot.fiber_g ?? 0) >= 3) {
    score += 6;
    positives.push('This serving provides a useful fiber signal.');
  } else if ((snapshot.carbs_g ?? 0) >= 20) {
    score -= 5;
    considerations.push('Fiber is modest relative to the carbohydrate amount.');
  }

  if ((snapshot.sugar_g ?? 0) >= 20) {
    score -= 15;
    considerations.push('Sugar is higher for one serving.');
  } else if ((snapshot.sugar_g ?? 0) >= 10) {
    score -= 8;
    considerations.push('Sugar is worth considering alongside the rest of your day.');
  }

  if ((snapshot.sodium_mg ?? 0) >= 700) {
    score -= 14;
    considerations.push('Sodium is higher than typical for one serving.');
  } else if ((snapshot.sodium_mg ?? 0) >= 400) {
    score -= 7;
    considerations.push('Sodium is moderate for this serving.');
  }

  if ((snapshot.saturated_fat_g ?? 0) >= 7) {
    score -= 6;
    considerations.push('Saturated fat is higher for one serving.');
  }

  if (snapshot.quality_flags.includes('ultra_processed_indicator')) {
    score -= 12;
    considerations.push('The ingredient pattern suggests more processing.');
  }
  if (snapshot.quality_flags.includes('whole_food_emphasis')) score += 8;
  if (snapshot.quality_flags.includes('balanced_meal')) score += 6;

  let confidence = snapshot.confidence;
  if (!snapshot.ingredients_text) {
    confidence = lowerConfidence(confidence);
    considerations.push('Ingredient data is incomplete, so confidence is lower.');
  }

  const finalScore = clampScore(score);
  const label = finalScore >= 74 ? 'supportive' : finalScore >= 52 ? 'steady' : 'watch';
  const letterGrade = productLetterGrade(finalScore);
  const gradeBand = productGradeBand(letterGrade);
  const category = detectProductCategory(null, snapshot.name, snapshot.categories_tags);
  const summary = label === 'supportive'
    ? 'Available label data suggests a supportive fueling fit.'
    : label === 'steady'
      ? 'Available label data suggests a steady fit with a few context signals.'
      : 'Available label data suggests a few signals worth balancing across the day.';

  return {
    score: finalScore,
    label,
    summary,
    positives,
    considerations,
    confidence,
    reason_codes: uniqueReasons(reasons),
    letter_grade: letterGrade,
    grade_band: gradeBand,
    grade_label: productGradeLabel(gradeBand),
    better_options: productBetterOptions(finalScore, category?.id ?? null),
    evidence_refs: [{ ...PRODUCT_EVIDENCE_REFERENCES.fda_daily_values! }]
  };
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

export function calculateProductQuality(snapshot: HealthiProductSnapshot): ProductQualitySnapshot {
  if (!snapshot.ingredients_text?.trim()) return calculateNutrientFallback(snapshot);

  const scored = scoreProductLabel({
    name: snapshot.name,
    ingredientsText: snapshot.ingredients_text,
    labels: snapshot.labels,
    categoryTags: snapshot.categories_tags,
    packaging: snapshot.packaging_tags,
    nutrimentsPer100g: derivedPer100g(snapshot),
    servingNutrients: {
      calories: snapshot.calories_per_serving,
      sugar_g: snapshot.sugar_g,
      protein_g: snapshot.protein_g,
      fiber_g: snapshot.fiber_g,
      sodium_mg: snapshot.sodium_mg,
      saturated_fat_g: snapshot.saturated_fat_g,
      serving_quantity_g: snapshot.serving_quantity_g
    }
  });
  if (scored.displayScore === null) return calculateNutrientFallback(snapshot);

  const positives = [...scored.positives];
  const considerations = [...scored.considerations];
  if (!snapshot.categories_tags?.length && scored.categoryId === null) {
    considerations.push('Category context is unavailable, so the score uses the overall label pattern.');
  }

  const reasons: NutritionReasonCode[] = [...snapshot.reason_codes];
  if (scored.tier !== null && scored.tier >= 3) reasons.push('processing_level_high');
  if (scored.label === 'supportive') reasons.push('food_quality_supportive');
  if (scored.label === 'watch') reasons.push('nutrition_signal_watch');

  return {
    score: scored.displayScore,
    label: scored.label,
    summary: scored.summary,
    positives,
    considerations,
    confidence: lowerOf(snapshot.confidence, scored.confidence),
    reason_codes: uniqueReasons(reasons),
    absolute_score: scored.absoluteScore,
    category_score: scored.categoryScore,
    category_id: scored.categoryId,
    category_label: scored.categoryLabel,
    processing_tier: scored.tier,
    processing_tier_label: scored.tierLabel,
    factors: scored.factors,
    limiting_factor: scored.scoreCap
      ? { rule_id: scored.scoreCap.ruleId, label: scored.scoreCap.label, cap: scored.scoreCap.cap }
      : null,
    scoring_reason_codes: [...scored.reasonCodes],
    letter_grade: scored.letterGrade,
    grade_band: scored.gradeBand,
    grade_label: scored.gradeLabel,
    better_options: scored.better_options.map((option) => ({
      ...option,
      criteria: [...option.criteria],
      reason_codes: [...option.reason_codes]
    })),
    evidence_refs: scored.evidence_refs.map((reference) => ({ ...reference }))
  };
}
