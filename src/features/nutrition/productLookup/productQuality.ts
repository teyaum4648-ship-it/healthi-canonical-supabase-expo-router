import type { DataConfidence, NutritionReasonCode } from '../../../engines/nutrition';
import { productGradeBand, productLetterGrade, scoreProductLabel } from '../../../engines/nutrition/productScoring';
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
  'whole_food_emphasis',
  'nutrition_calibrating'
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

function metricServing(snapshot: HealthiProductSnapshot): { quantity: number; unit: 'g' | 'ml' } | null {
  const unit = snapshot.serving_unit?.trim().toLowerCase();
  if (typeof snapshot.serving_quantity === 'number' && snapshot.serving_quantity > 0 && (unit === 'g' || unit === 'ml')) {
    return { quantity: snapshot.serving_quantity, unit };
  }
  if (typeof snapshot.serving_quantity_g === 'number' && snapshot.serving_quantity_g > 0) {
    return { quantity: snapshot.serving_quantity_g, unit: 'g' };
  }
  const matches = [...(snapshot.serving_size?.matchAll(/([\d.]+)\s*(ml|g)\b/ig) ?? [])];
  const match = matches.at(-1);
  const quantity = Number(match?.[1]);
  const matchedUnit = match?.[2]?.toLowerCase();
  return Number.isFinite(quantity) && quantity > 0 && (matchedUnit === 'g' || matchedUnit === 'ml')
    ? { quantity, unit: matchedUnit }
    : null;
}

function gradeRange(scoreRange: [number, number]): [NonNullable<ProductQualitySnapshot['letter_grade']>, NonNullable<ProductQualitySnapshot['letter_grade']>] {
  const [low, high] = scoreRange;
  return [productLetterGrade(high), productLetterGrade(low)];
}

function resultState(
  snapshot: HealthiProductSnapshot,
  interpretation: DataConfidence,
  hasScore: boolean,
  generalizedFallbackUsed: boolean,
  scoreScope: 'overall' | 'supported_evidence'
): 'final' | 'estimated' | 'provisional' | 'more_data_needed' {
  const identity = snapshot.evidence_confidence?.identity ?? (snapshot.name.trim() ? 'medium' : 'low');
  const ingredientStatus = snapshot.ingredient_evidence?.status ?? (snapshot.ingredients_text?.trim() ? 'partial' : 'absent');
  const overall = snapshot.evidence_confidence?.overall ?? snapshot.confidence;
  if (identity === 'low' || !hasScore) return 'more_data_needed';
  if (ingredientStatus === 'absent') return 'provisional';
  if (scoreScope === 'supported_evidence') return 'provisional';
  if (generalizedFallbackUsed) return 'provisional';
  if (interpretation === 'low' || (snapshot.provider_conflicts?.length ?? 0) > 0) return 'provisional';
  return ingredientStatus === 'complete' && overall === 'high' ? 'final' : 'estimated';
}

export function calculateProductQuality(snapshot: HealthiProductSnapshot): ProductQualitySnapshot {
  const selectedServing = metricServing(snapshot);
  const hasProviderServing = selectedServing !== null;
  const scored = scoreProductLabel({
    name: snapshot.name,
    ingredientsText: snapshot.ingredients_text,
    labels: snapshot.labels,
    categoryTags: snapshot.categories_tags,
    packaging: snapshot.packaging_tags,
    sourceConfidence: snapshot.evidence_confidence?.ingredients ?? snapshot.confidence,
    ingredientEvidenceStatus: snapshot.ingredient_evidence?.status ?? (snapshot.ingredients_text ? 'partial' : 'absent'),
    evidenceContext: {
      identityConfidence: snapshot.evidence_confidence?.identity ?? (snapshot.name.trim() ? 'medium' : 'low'),
      nutritionConfidence: snapshot.evidence_confidence?.nutrition,
      servingConfidence: snapshot.evidence_confidence?.serving,
      productFormConfidence: snapshot.evidence_confidence?.product_form,
      providerConflict: (snapshot.provider_conflicts?.length ?? 0) > 0,
      ingredientConflict: (snapshot.ingredient_evidence?.conflicts.length ?? 0) > 0,
      fieldReliability: snapshot.nutrition_validation ? {
        calories: snapshot.nutrition_validation.nutrients.calories.reliability,
        sugar_g: snapshot.nutrition_validation.nutrients.sugar_g.reliability,
        carbs_g: snapshot.nutrition_validation.nutrients.carbs_g.reliability,
        protein_g: snapshot.nutrition_validation.nutrients.protein_g.reliability,
        fat_g: snapshot.nutrition_validation.nutrients.fat_g.reliability,
        fiber_g: snapshot.nutrition_validation.nutrients.fiber_g.reliability,
        sodium_mg: snapshot.nutrition_validation.nutrients.sodium_mg.reliability,
        saturated_fat_g: snapshot.nutrition_validation.nutrients.saturated_fat_g.reliability,
        added_sugar_g: snapshot.nutrition_validation.nutrients.added_sugar_g.reliability,
        caffeine_mg: snapshot.nutrition_validation.nutrients.caffeine_mg.reliability
      } : undefined,
      validationIssueCount: snapshot.validation_issues?.length ?? 0
    },
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
      added_sugar_g: snapshot.added_sugar_g,
      caffeine_mg: snapshot.caffeine_mg,
      serving_quantity_g: selectedServing?.unit === 'g' ? selectedServing.quantity : null
    } : undefined,
    servingQuantity: selectedServing?.quantity ?? null,
    servingUnit: selectedServing?.unit ?? null
  });

  const positives = [...scored.positives];
  const considerations = [...scored.considerations];
  if (scored.interpretationConfidence === 'low' && scored.displayScore === null) {
    considerations.push('There is not enough reliable category information to assign a grade yet.');
  } else if (scored.interpretationConfidence === 'low' && !scored.generalizedFallbackUsed) {
    considerations.push('Category interpretation is limited, so this result remains provisional.');
  }
  if (scored.generalizedFallbackUsed && scored.displayScore !== null) {
    considerations.push('Category-specific comparison is unavailable; this provisional result uses directly supported label dimensions only.');
  }
  if (scored.gradeCertainty?.state !== 'stable') {
    considerations.push(scored.gradeCertainty?.explanation ?? 'The available range does not support a stable letter grade.');
  }

  const reasons: NutritionReasonCode[] = scannerReasonCodes(snapshot);
  if (scored.label === 'supportive') reasons.push('food_quality_supportive');
  if (scored.label === 'watch') reasons.push('nutrition_signal_watch');
  if (scored.label === 'calibrating') reasons.push('partial_nutrition_data');

  const state = resultState(snapshot, scored.interpretationConfidence, scored.displayScore !== null, scored.generalizedFallbackUsed, scored.scoreScope);
  const ingredientStatus = snapshot.ingredient_evidence?.status ?? (snapshot.ingredients_text ? 'partial' : 'absent');
  const scoreRange = state !== 'final' || scored.gradeCertainty?.state !== 'stable'
    ? scored.scoreRange
    : null;
  const range = scoreRange ? gradeRange(scoreRange) : null;
  const missingEvidence = [
    ...(ingredientStatus === 'complete' ? [] : ['Complete package ingredient details are unavailable.']),
    ...(snapshot.evidence_confidence?.serving === 'low' ? ['Provider-supplied serving details are unavailable.'] : []),
    ...(snapshot.evidence_confidence?.nutrition === 'low' ? ['Nutrition details are incomplete.'] : []),
    ...(scored.interpretationConfidence === 'low' ? ['A reliable product category could not be resolved.'] : []),
    ...(scored.generalizedFallbackUsed && scored.displayScore !== null ? ['Category-specific comparison is unavailable.'] : []),
    ...scored.dimensions.filter((dimension) => dimension.score === null).map((dimension) => `${dimension.label} is unsupported by the available evidence.`),
    ...((snapshot.provider_conflicts?.length ?? 0) > 0 ? ['Available provider records materially disagree.'] : []),
    ...((snapshot.nutrient_evidence?.conflicts.length ?? 0) > 0
      ? ['Some nutrient observations were excluded or downgraded because their basis or plausibility was unsafe.']
      : [])
  ];
  const publicScore = state === 'more_data_needed' ? null : scored.displayScore;
  const publicGrade = state === 'more_data_needed' ? null : scored.letterGrade;
  const publicSummary = state === 'final'
    ? scored.summary
    : state === 'estimated'
      ? 'This is an estimated grade based on partial label evidence. Ingredient details could change the result.'
      : state === 'provisional'
        ? scored.scoreScope === 'supported_evidence'
          ? 'This provisional supported-evidence score summarizes only the dimensions the label can support. The deterministic range includes missing material dimensions.'
        : scored.generalizedFallbackUsed
          ? 'This provisional result uses directly supported Product Quality dimensions. Category-specific comparison is unavailable, so the deterministic range is wider.'
          : 'This is a provisional interpretation. The available evidence supports a bounded result, but category or provider conflicts remain.'
        : 'More label data is needed before assigning a responsible Product Quality grade.';
  const productResolutionTrace = snapshot.provider_resolution?.resolution_trace;
  const supportedDimensions = scored.dimensions.filter((dimension) => dimension.score !== null).map((dimension) => dimension.id);
  const unsupportedDimensions = scored.dimensions.filter((dimension) => dimension.score === null).map((dimension) => dimension.id);

  return {
    score: publicScore,
    central_score: scored.displayScore,
    label: scored.label,
    summary: publicSummary,
    positives,
    considerations,
    confidence: lowerOf(snapshot.confidence, scored.confidence),
    reason_codes: uniqueReasons(reasons),
    absolute_score: scored.displayScore,
    category_score: scored.categoryScore,
    category_id: scored.categoryId,
    category_label: scored.categoryLabel,
    category_comparison_available: scored.categoryComparisonAvailable,
    product_form: scored.productForm,
    prepared_use: scored.preparedUse,
    nutrient_basis: {
      type: scored.nutrientBasis.type,
      source: scored.nutrientBasis.source,
      nutrients: { ...scored.nutrientBasis.nutrients },
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
    grade_label: scored.gradeCertainty?.state === 'unresolved'
      ? 'Grade uncertain'
      : scored.gradeCertainty?.state === 'provisional'
        ? 'Provisional grade'
      : state === 'final' ? scored.gradeLabel : state === 'estimated' ? 'Estimated grade' : state === 'provisional' ? 'Provisional grade' : 'More data needed',
    grade_certainty: scored.gradeCertainty ? {
      ...scored.gradeCertainty,
      gradesSpanned: [...scored.gradeCertainty.gradesSpanned]
    } : null,
    better_options: scored.better_options.map((option) => ({
      ...option,
      criteria: [...option.criteria],
      reason_codes: [...option.reason_codes]
    })),
    evidence_refs: scored.evidence_refs.map((reference) => ({ ...reference })),
    result_state: state,
    estimated_grade_range: range,
    estimated_score_range: scoreRange,
    missing_evidence: missingEvidence,
    evidence_confidence: snapshot.evidence_confidence ? { ...snapshot.evidence_confidence } : undefined,
    engine_version: scored.engineVersion,
    archetype: scored.archetype ? {
      ...scored.archetype,
      evidence: [...scored.archetype.evidence],
      missingEvidence: [...scored.archetype.missingEvidence]
    } : null,
    dimensions: scored.dimensions.map((dimension) => ({
      ...dimension,
      anchor: dimension.anchor ? {
        ...dimension.anchor,
        evidence: [...dimension.anchor.evidence]
      } : null,
      evidence: [...dimension.evidence],
      evidenceFields: [...dimension.evidenceFields],
      rulesEvaluated: [...dimension.rulesEvaluated],
      rulesFired: [...dimension.rulesFired],
      rulesSuppressed: [...dimension.rulesSuppressed],
      positiveContributions: dimension.positiveContributions.map((entry) => ({
        ...entry,
        evidence: [...entry.evidence]
      })),
      negativeContributions: dimension.negativeContributions.map((entry) => ({
        ...entry,
        evidence: [...entry.evidence]
      })),
      missingEvidence: [...dimension.missingEvidence],
      range: dimension.range ? [...dimension.range] as [number, number] : null
    })),
    supported_dimension_weight: scored.supportedDimensionWeight,
    score_scope: scored.scoreScope,
    dimension_aggregation: { ...scored.dimensionAggregation },
    score_eligibility: {
      ...scored.scoreEligibility,
      directEvidenceKinds: [...scored.scoreEligibility.directEvidenceKinds],
      thresholds: { ...scored.scoreEligibility.thresholds },
      deniedReasons: [...scored.scoreEligibility.deniedReasons]
    },
    generalized_fallback_used: scored.generalizedFallbackUsed,
    review_trace: {
      engine_version: scored.engineVersion,
      category_resolution: JSON.parse(JSON.stringify(scored.categoryResolution)) as typeof scored.categoryResolution,
      score_ledger: scored.scoreLedger.map((entry) => ({
        ...entry,
        evidence: [...entry.evidence]
      })),
      grade_eligibility: scored.gradeEligibility ? {
        ...scored.gradeEligibility,
        deniedReasons: [...scored.gradeEligibility.deniedReasons]
      } : null,
      grade_certainty: scored.gradeCertainty ? {
        ...scored.gradeCertainty,
        gradesSpanned: [...scored.gradeCertainty.gradesSpanned]
      } : null,
      supported_dimension_weight: scored.supportedDimensionWeight,
      score_scope: scored.scoreScope,
      dimension_aggregation: { ...scored.dimensionAggregation },
      score_eligibility: {
        ...scored.scoreEligibility,
        directEvidenceKinds: [...scored.scoreEligibility.directEvidenceKinds],
        thresholds: { ...scored.scoreEligibility.thresholds },
        deniedReasons: [...scored.scoreEligibility.deniedReasons]
      },
      product_resolution: productResolutionTrace ? {
        trace: JSON.parse(JSON.stringify(productResolutionTrace)) as typeof productResolutionTrace,
        supported_dimensions: supportedDimensions,
        unsupported_dimensions: unsupportedDimensions,
        final_scoring_scope: scored.scoreScope,
        final_result_state: state,
        abstention_reason: state === 'more_data_needed'
          ? scored.scoreEligibility.deniedReasons.join(', ') || productResolutionTrace.abstention_reason
          : null
      } : undefined
    }
  };
}
