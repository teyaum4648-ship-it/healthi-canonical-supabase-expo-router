import type { ProductArchetype } from './archetypes';
import type {
  DataConfidence,
  ProductNutrientBasis,
  ProductScoreLedgerEntry,
  ProductScoringInput
} from './engine';
import { ingredientTextForMatching, parseIngredients, type ParsedIngredients } from './ingredientParser';
import type { CategoryProfile, RuleFamily } from './profiles';

export type ProductScoreDimensionId =
  | 'ingredient_integrity'
  | 'formulation_burden'
  | 'category_nutrition_fit'
  | 'food_structure'
  | 'processing_purpose';

export type ProductScoreScope = 'overall' | 'supported_evidence';

export type ProductDimensionContribution = {
  ruleId: string;
  label: string;
  delta: number;
  evidence: string[];
  effect: 'score_contribution';
};

export type ProductDimensionAnchor = {
  ruleId: string;
  label: string;
  score: number;
  evidence: string[];
};

export type ProductDimensionEvidenceState =
  | 'unsupported'
  | 'not_detected'
  | 'negative_evidence'
  | 'supported_absence'
  | 'positive_evidence'
  | 'mixed';

export type ProductScoreDimension = {
  id: ProductScoreDimensionId;
  label: string;
  score: number | null;
  weight: number;
  effectiveWeight: number;
  contribution: number;
  confidence: DataConfidence;
  evidence: string[];
  evidenceFields: string[];
  evidenceState: ProductDimensionEvidenceState;
  anchor: ProductDimensionAnchor | null;
  rulesEvaluated: string[];
  rulesFired: string[];
  rulesSuppressed: string[];
  positiveContributions: ProductDimensionContribution[];
  negativeContributions: ProductDimensionContribution[];
  missingEvidence: string[];
  range: [number, number] | null;
};

export type ProductDimensionScore = {
  score: number | null;
  range: [number, number] | null;
  dimensions: ProductScoreDimension[];
  supportedWeight: number;
  scoreScope: ProductScoreScope;
  aggregation: {
    method: 'conditional_supported_evidence_with_unknown_interval';
    formula: 'sum(weight * supported score) / supported weight';
    supportedWeightedSum: number;
    supportedWeight: number;
    unknownWeight: number;
    supportedDimensionCount: number;
    conditionalCentralScore: number | null;
    scoreScope: ProductScoreScope;
    materialUnknownDimensions: ProductScoreDimensionId[];
  };
};

export const PRODUCT_DIMENSION_SCALE_SEMANTICS = {
  0: 'Extreme direct evidence of failure within this dimension.',
  20: 'Very strong unfavorable evidence with little countervailing support.',
  40: 'Clearly unfavorable evidence, while preserving room for more severe cases.',
  60: 'Mixed or ordinary evidence for the product’s intended role.',
  80: 'Strong favorable product-specific evidence.',
  100: 'Exceptional favorable evidence across the material checks for this dimension.'
} as const;

export const PRODUCT_DIMENSION_OWNERSHIP = {
  ingredient_integrity: 'Identity and nature of major ingredients, dominant composition, declared order, and direct ingredient-quality signals.',
  formulation_burden: 'Flavor, color, texture, sweetener, isolate, reconstruction, and other demonstrated formulation systems.',
  category_nutrition_fit: 'Measured serving-normalized nutrients and density interpreted for the supported product role.',
  food_structure: 'Direct evidence of preserved, fragmented, isolated, refined, or reconstructed food structure.',
  processing_purpose: 'Direct evidence of the formulation’s principal delivery purpose; simplicity alone provides no credit.'
} as const satisfies Record<ProductScoreDimensionId, string>;

type DimensionDraft = {
  score: number | null;
  confidence: DataConfidence;
  evidence: string[];
  evidenceFields: string[];
  evidenceState: ProductDimensionEvidenceState;
  anchor?: ProductDimensionAnchor | null;
  evaluated: string[];
  positive: ProductDimensionContribution[];
  negative: ProductDimensionContribution[];
  missing: string[];
  suppressed?: string[];
};

type FormulationAssessment = {
  active: ProductDimensionContribution[];
  suppressed: string[];
};

type SugarExposure = {
  sugar: number | null;
  addedSugar: number | null;
  sugarDensity: number | null;
  addedSugarDensity: number | null;
  densityBasis: 'g' | 'ml' | 'per_100g' | null;
};

const DEFAULT_WEIGHTS: Record<ProductScoreDimensionId, number> = {
  ingredient_integrity: 0.3,
  formulation_burden: 0.25,
  category_nutrition_fit: 0.2,
  food_structure: 0.15,
  processing_purpose: 0.1
};

const DIMENSION_FAMILIES: Record<ProductScoreDimensionId, string[]> = {
  ingredient_integrity: ['ingredient_simplicity', 'refined_syrups', 'oils', 'claim_alignment'],
  formulation_burden: ['flavor_systems', 'sweeteners', 'oils', 'emulsifiers_gums', 'colors', 'refined_syrups'],
  category_nutrition_fit: ['sugar_density', 'sodium_density', 'calorie_density', 'fat_density', 'protein_density', 'fiber_density', 'claim_alignment'],
  food_structure: ['ingredient_simplicity', 'refined_syrups'],
  processing_purpose: ['flavor_systems', 'sweeteners', 'emulsifiers_gums', 'colors', 'refined_syrups', 'claim_alignment']
};

const CONCENTRATED_SWEETENER = /\b(sugar|syrup|sucrose|glucose|fructose|dextrose|maltose|molasses|honey|agave|concentrated sweetener|granulated sweetener)\b/i;
const REFINED_STARCH = /\b((?:refined|isolated|modified)?\s*(?:food |corn |potato |tapioca |rice |wheat )?starch|maltodextrin|dextrin)\b/i;
const TECHNICAL_COMPONENT = /\b(gums?|thickener|stabili[sz]er|emulsifier|cellulose|carrageenan|lecithin|mono(?:-| )?and(?:-| )?diglycerides|calcium silicate|sodium aluminosilicate|silicon dioxide|tricalcium phosphate|yellow prussiate)\b/i;
const ISOLATED_COMPONENT = /\b(protein (?:isolate|concentrate)|isolated protein|added fiber|soluble fiber|inulin|fiber isolate|hydroly[sz]ed protein)\b/i;
const INDUSTRIAL_FAT = /\b(hydrogenated|shortening|interesterified|vegetable oil blend|palm kernel oil)\b/i;
const DIRECT_FORMULATION_IDENTITY = /\b(aspartame|sucralose|acesulfame potassium|ace-?k|saccharin|stevia|monk fruit|allulose|sugar alcohol|caramel color|artificial colors?|natural flavors?|artificial flavors?)\b/i;
const DIRECT_QUALITY = /\b(whole|intact|sprouted|cultured|fermented|cold[- ]pressed|extra virgin|unrefined|minimally milled)\b/i;
const PRESERVED_STRUCTURE = /\b(whole|intact|sprouted|rolled|stone[- ]ground|coarse[- ]ground)\b/i;
const RECONSTRUCTED_STRUCTURE = /\b(isolate|concentrate|modified|maltodextrin|dextrin|starch|cellulose|gums?|extruded|reconstituted|powdered base)\b/i;
const CULINARY_SOURCE = /\b(water|milk|cream|eggs?|grains?|wheat|oats?|rice|corn|barley|millet|quinoa|potatoes?|tomatoes?|vegetables?|fruit|beans?|chickpeas?|lentils?|peas?|soybeans?|tofu|peanuts?|nuts?|seeds?|chicken|turkey|beef|pork|fish|cocoa|cacao|oil|salt|herbs?|spices?)\b/i;
const CULINARY_OIL = /\b(?:culinary |cold[- ]pressed |extra virgin |unrefined )?[a-z ]*oil\b/i;

function weightsFor(archetype: ProductArchetype): Record<ProductScoreDimensionId, number> {
  if (archetype.contextMode === 'evidence_fallback' && archetype.confidence === 'low') return DEFAULT_WEIGHTS;
  if (archetype.form === 'beverage') return {
    ingredient_integrity: 0.2,
    formulation_burden: 0.25,
    category_nutrition_fit: 0.3,
    food_structure: 0.1,
    processing_purpose: 0.15
  };
  if (archetype.intent === 'staple' || archetype.intent === 'meal') return {
    ingredient_integrity: 0.25,
    formulation_burden: 0.2,
    category_nutrition_fit: 0.25,
    food_structure: 0.2,
    processing_purpose: 0.1
  };
  if (archetype.intent === 'snack') return {
    ingredient_integrity: 0.25,
    formulation_burden: 0.25,
    category_nutrition_fit: 0.2,
    food_structure: 0.15,
    processing_purpose: 0.15
  };
  if (archetype.intent === 'dessert') return {
    ingredient_integrity: 0.3,
    formulation_burden: 0.25,
    category_nutrition_fit: 0.15,
    food_structure: 0.15,
    processing_purpose: 0.15
  };
  return DEFAULT_WEIGHTS;
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function contribution(ruleId: string, label: string, delta: number, evidence: string[]): ProductDimensionContribution {
  return { ruleId, label, delta, evidence, effect: 'score_contribution' };
}

function anchor(ruleId: string, label: string, score: number, evidence: string[]): ProductDimensionAnchor {
  return { ruleId, label, score, evidence };
}

function scoreFromEvidence(
  evidenceAnchor: ProductDimensionAnchor,
  positive: ProductDimensionContribution[],
  negative: ProductDimensionContribution[]
): number {
  return clamp(evidenceAnchor.score + positive.reduce((sum, item) => sum + item.delta, 0) + negative.reduce((sum, item) => sum + item.delta, 0));
}

function ingredientStatus(input: ProductScoringInput): 'complete' | 'partial' | 'reconstructed' | 'absent' {
  return input.ingredientEvidenceStatus ?? (input.ingredientsText?.trim() ? 'complete' : 'absent');
}

function completeIngredients(input: ProductScoringInput): boolean {
  return ingredientStatus(input) === 'complete' && !input.evidenceContext?.ingredientConflict;
}

function dominantToken(parsed: ParsedIngredients): string {
  return parsed.topLevelIngredients[0] ?? parsed.flatTokens[0] ?? '';
}

function formulationSignals(text: string, profile: CategoryProfile | null): FormulationAssessment {
  const rules: Array<[string, string, RuleFamily, RegExp, number]> = [
    ['declared_flavor_system', 'Declared flavor system', 'flavor_systems', /\b(natural flavors?|artificial flavors?)\b/i, -6],
    ['synthetic_high_intensity_sweetener', 'Synthetic high-intensity sweetener system', 'sweeteners', /\b(sucralose|aspartame|acesulfame potassium|ace-?k|saccharin)\b/i, -8],
    ['plant_derived_high_intensity_sweetener', 'Plant-derived high-intensity sweetener system', 'sweeteners', /\b(stevia|monk fruit)\b/i, -3],
    ['rare_sugar_system', 'Rare-sugar formulation component', 'sweeteners', /\ballulose\b/i, -2],
    ['sugar_alcohol_system', 'Sugar-alcohol formulation system', 'sweeteners', /\b(erythritol|xylitol|sorbitol|maltitol|mannitol)\b/i, -5],
    ['texture_system', 'Texture or stabilizer system', 'emulsifiers_gums', TECHNICAL_COMPONENT, -10],
    ['color_system', 'Added color system', 'colors', /\b(caramel color|red 40|yellow 5|yellow 6|blue 1|artificial colors?)\b/i, -7],
    ['isolated_nutrition_component', 'Isolated protein or fiber component', 'ingredient_simplicity', ISOLATED_COMPONENT, -8],
    ['refined_starch_system', 'Refined starch system', 'ingredient_simplicity', REFINED_STARCH, -8],
    ['refined_syrup_system', 'Refined syrup system', 'refined_syrups', /\b(high[- ]fructose corn syrup|corn syrup|glucose syrup|rice syrup|tapioca syrup|maltodextrin)\b/i, -10],
    ['industrial_fat_system', 'Industrial fat system', 'oils', INDUSTRIAL_FAT, -11]
  ];
  const active: ProductDimensionContribution[] = [];
  const suppressed: string[] = [];
  for (const [id, label, family, pattern, requestedDelta] of rules) {
    const match = pattern.exec(text)?.[0];
    if (!match) continue;
    const policy = profile?.rulePolicy[family] ?? 'apply';
    if (policy === 'suppress' || policy === 'unavailable') {
      suppressed.push(`${id}:category_policy_${policy}`);
      continue;
    }
    const delta = policy === 'context_only' ? Math.ceil(requestedDelta / 2) : requestedDelta;
    active.push(contribution(id, label, delta, [match]));
  }
  return { active, suppressed };
}

function range(score: number, confidence: DataConfidence, evidenceCount: number): [number, number] {
  const spread = confidence === 'high' ? 4 : confidence === 'medium' ? 10 : 18;
  const evidenceSpread = evidenceCount >= 3 ? 0 : evidenceCount === 2 ? 3 : 6;
  return [clamp(score - spread - evidenceSpread), clamp(score + spread + evidenceSpread)];
}

function ledgerTrace(ledger: ProductScoreLedgerEntry[], id: ProductScoreDimensionId) {
  const families = DIMENSION_FAMILIES[id];
  const relevant = ledger.filter((entry) => families.includes(entry.ruleFamily));
  return {
    evaluated: relevant.map((entry) => `context:${entry.ruleId}`),
    suppressed: relevant.filter((entry) => entry.status === 'suppressed' || entry.status === 'unavailable').map((entry) => `context:${entry.ruleId}`)
  };
}

function dimension(
  id: ProductScoreDimensionId,
  label: string,
  draft: DimensionDraft,
  ledger: ProductScoreLedgerEntry[],
  weight: number
): ProductScoreDimension {
  const trace = ledgerTrace(ledger, id);
  const score = draft.score === null ? null : clamp(draft.score);
  return {
    id,
    label,
    score,
    weight,
    effectiveWeight: 0,
    contribution: 0,
    confidence: draft.confidence,
    evidence: unique(draft.evidence),
    evidenceFields: unique(draft.evidenceFields),
    evidenceState: score === null ? 'unsupported' : draft.evidenceState,
    anchor: score === null ? null : draft.anchor ?? null,
    rulesEvaluated: unique([...draft.evaluated, ...(draft.anchor ? [draft.anchor.ruleId] : []), ...trace.evaluated]),
    rulesFired: unique([...(draft.anchor ? [draft.anchor.ruleId] : []), ...draft.positive.map((item) => item.ruleId), ...draft.negative.map((item) => item.ruleId)]),
    rulesSuppressed: unique([...(draft.suppressed ?? []), ...trace.suppressed]),
    positiveContributions: draft.positive,
    negativeContributions: draft.negative,
    missingEvidence: unique(draft.missing),
    range: null
  };
}

function ingredientIntegrity(input: ProductScoringInput, parsed: ParsedIngredients, sourceConfidence: DataConfidence): DimensionDraft {
  if (parsed.flatTokens.length === 0) return {
    score: null, confidence: 'low', evidence: [], evidenceFields: [], evidenceState: 'unsupported', evaluated: [],
    positive: [], negative: [], missing: ['ingredient identity evidence']
  };
  const complete = completeIngredients(input);
  const text = ingredientTextForMatching(parsed);
  const dominant = dominantToken(parsed);
  const dominantSweetener = CONCENTRATED_SWEETENER.test(dominant);
  const dominantStarch = REFINED_STARCH.test(dominant);
  const dominantTechnical = TECHNICAL_COMPONENT.test(dominant);
  const dominantIsolate = ISOLATED_COMPONENT.test(dominant);
  const leadingText = parsed.topLevelIngredients.slice(0, 3).join(', ');
  const leadingSweetener = CONCENTRATED_SWEETENER.test(leadingText);
  const directQuality = parsed.topLevelIngredients.filter((token) => DIRECT_QUALITY.test(token));
  const culinary = parsed.topLevelIngredients.filter((token) => CULINARY_SOURCE.test(token) && !CONCENTRATED_SWEETENER.test(token) && !REFINED_STARCH.test(token) && !TECHNICAL_COMPONENT.test(token));
  const qualityRatio = parsed.topLevelIngredients.length ? directQuality.length / parsed.topLevelIngredients.length : 0;
  const culinaryRatio = parsed.topLevelIngredients.length ? culinary.length / parsed.topLevelIngredients.length : 0;
  let evidenceAnchor: ProductDimensionAnchor | null = null;
  if (dominantSweetener) evidenceAnchor = anchor('dominant_concentrated_sweetener_identity', 'Dominant ingredient is a concentrated sweetener', 24, [dominant]);
  else if (dominantTechnical) evidenceAnchor = anchor('dominant_technical_component_identity', 'Dominant ingredient is a technical formulation component', 22, [dominant]);
  else if (dominantStarch) evidenceAnchor = anchor('dominant_refined_starch_identity', 'Dominant ingredient is a refined isolated starch', 32, [dominant]);
  else if (dominantIsolate) evidenceAnchor = anchor('dominant_isolated_component_identity', 'Dominant ingredient is an isolated nutrition component', 40, [dominant]);
  else if (archetypeHydrationWater(input, dominant)) evidenceAnchor = anchor('direct_water_identity_anchor', 'Direct ingredient identity supports the hydration base', 90, [dominant]);
  else if (directQuality.length > 0) evidenceAnchor = anchor(
    'direct_ingredient_quality_anchor',
    'Direct ingredient-quality evidence is present',
    qualityRatio >= 0.5 ? 82 : 74,
    directQuality.slice(0, 5)
  );
  else if (culinaryRatio >= 0.6) evidenceAnchor = anchor('culinary_identity_anchor', 'Major ingredients have recognizable culinary identities', 76, [`${culinary.length}/${parsed.topLevelIngredients.length} culinary-source ingredients`]);
  else if (culinaryRatio >= 0.3) evidenceAnchor = anchor('mixed_identity_anchor', 'Ingredient identities show a mixed culinary pattern', 62, [`${culinary.length}/${parsed.topLevelIngredients.length} culinary-source ingredients`]);
  else if ([CONCENTRATED_SWEETENER, REFINED_STARCH, TECHNICAL_COMPONENT, ISOLATED_COMPONENT, INDUSTRIAL_FAT, DIRECT_FORMULATION_IDENTITY].some((pattern) => pattern.test(text))) {
    evidenceAnchor = anchor('direct_unfavorable_identity_anchor', 'Direct unfavorable major-ingredient evidence is present', 60, [text]);
  }

  if (!evidenceAnchor) return {
    score: null,
    confidence: 'low',
    evidence: [`${parsed.topLevelIngredients.length} top-level ingredients`, `ingredient evidence:${ingredientStatus(input)}`],
    evidenceFields: ['ingredientsText', 'ingredientEvidenceStatus'],
    evidenceState: 'unsupported',
    evaluated: ['dominant_ingredient_identity', 'direct_ingredient_quality'],
    positive: [], negative: [],
    missing: ['interpretable major-ingredient identity semantics']
  };

  const positive: ProductDimensionContribution[] = [];
  const negative: ProductDimensionContribution[] = [];
  if (directQuality.length > 0) positive.push(contribution('direct_quality_language', 'Direct ingredient-quality language', Math.min(8, 3 + directQuality.length), directQuality.slice(0, 5)));
  if (dominantSweetener) negative.push(contribution('dominant_sweetener_order', 'Declared order establishes concentrated sweetness as the dominant composition', -8, [dominant]));
  else if (leadingSweetener) negative.push(contribution('leading_sweetener_order', 'Declared order places concentrated sweetness among the major ingredients', -12, [leadingText]));
  if (dominantTechnical) negative.push(contribution('dominant_technical_order', 'Declared order establishes a technical component as the dominant composition', -8, [dominant]));
  if (dominantStarch) negative.push(contribution('dominant_starch_order', 'Declared order establishes refined starch as the dominant composition', -6, [dominant]));
  if (!dominantSweetener && !dominantTechnical && !dominantStarch && !leadingSweetener) {
    if (INDUSTRIAL_FAT.test(text)) negative.push(contribution('industrial_fat_identity', 'Industrial fat identity affects major-ingredient quality', -10, [text.match(INDUSTRIAL_FAT)?.[0] ?? 'industrial fat']));
    else if (TECHNICAL_COMPONENT.test(text) || REFINED_STARCH.test(text) || ISOLATED_COMPONENT.test(text)) negative.push(contribution('major_reconstruction_identity', 'A major isolated, refined, or technical component affects ingredient integrity', -8, [text]));
    else if (DIRECT_FORMULATION_IDENTITY.test(parsed.topLevelIngredients.slice(0, 3).join(', '))) negative.push(contribution('major_formulation_identity', 'A declared formulation component appears among the major ingredients', -5, [parsed.topLevelIngredients.slice(0, 3).join(', ')]));
  }
  return {
    score: scoreFromEvidence(evidenceAnchor, positive, negative),
    confidence: complete ? sourceConfidence : sourceConfidence === 'high' ? 'medium' : sourceConfidence,
    evidence: [`dominant:${dominant}`, `${parsed.topLevelIngredients.length} top-level ingredients`, `ingredient evidence:${ingredientStatus(input)}`],
    evidenceFields: ['ingredientsText', 'ingredientEvidenceStatus'],
    evidenceState: positive.length && negative.length ? 'mixed' : negative.length ? 'negative_evidence' : positive.length ? 'positive_evidence' : 'not_detected',
    anchor: evidenceAnchor,
    evaluated: ['dominant_ingredient_identity', 'direct_ingredient_quality', 'industrial_fat_identity'],
    positive,
    negative,
    missing: complete ? [] : ['complete ingredient list needed to establish declared-order confidence'],
    suppressed: ['ingredient_count:simplicity_owned_by_formulation_burden']
  };
}

function archetypeHydrationWater(input: ProductScoringInput, dominant: string): boolean {
  const identity = `${input.category ?? ''} ${(input.categoryTags ?? []).join(' ')} ${input.name}`;
  return /^\s*(?:purified |spring |mineral |filtered |carbonated )?water\s*$/i.test(dominant) && /\b(water|hydration)\b/i.test(identity);
}

function formulationBurden(input: ProductScoringInput, parsed: ParsedIngredients, sourceConfidence: DataConfidence, profile: CategoryProfile | null): DimensionDraft {
  if (parsed.flatTokens.length === 0) return {
    score: null, confidence: 'low', evidence: [], evidenceFields: [], evidenceState: 'unsupported', evaluated: [],
    positive: [], negative: [], missing: ['complete ingredient list']
  };
  const complete = completeIngredients(input);
  const assessment = formulationSignals(ingredientTextForMatching(parsed), profile);
  if (!complete && assessment.active.length === 0) return {
    score: null, confidence: 'low', evidence: [`ingredient evidence:${ingredientStatus(input)}`],
    evidenceFields: ['ingredientsText', 'ingredientEvidenceStatus'], evidenceState: 'unsupported', evaluated: ['formulation_system_scan'],
    positive: [], negative: [], missing: ['complete ingredient list needed to support absence of formulation systems'], suppressed: assessment.suppressed
  };
  const count = parsed.topLevelIngredients.length;
  const evidenceAnchor = complete
    ? assessment.active.length === 0
      ? anchor(
          count === 1 ? 'complete_single_component_formulation' : count <= 5 ? 'complete_low_burden_formulation' : count <= 9 ? 'complete_moderate_burden_formulation' : 'complete_complex_formulation',
          count === 1 ? 'Complete evidence establishes one formulation component' : count <= 5 ? 'Complete evidence establishes low formulation burden' : count <= 9 ? 'Complete evidence establishes moderate formulation burden' : 'Complete evidence establishes a complex formulation',
          count === 1 ? 94 : count <= 5 ? 88 : count <= 9 ? 74 : 58,
          [`${count} top-level ingredients`, 'complete conflict-free ingredient evidence']
        )
      : anchor('complete_formulation_system_scope', 'Complete evidence establishes the formulation-system scope', 74, [`${assessment.active.length} formulation systems`, `${count} top-level ingredients`])
    : anchor('direct_formulation_system_evidence', 'Direct formulation-system evidence is present on a partial label', 58, [`${assessment.active.length} formulation systems`]);
  const positive = complete && assessment.active.length === 0
    ? [contribution('supported_absence_of_formulation_systems', 'Complete evidence supports absence of additional formulation systems', count <= 5 ? 4 : 2, ['complete ingredient evidence', `${count} top-level ingredients`])]
    : [];
  return {
    score: scoreFromEvidence(evidenceAnchor, positive, assessment.active),
    confidence: complete ? sourceConfidence : sourceConfidence === 'high' ? 'medium' : sourceConfidence,
    evidence: [`${count} top-level ingredients`, `${assessment.active.length} active formulation systems`, `ingredient evidence:${ingredientStatus(input)}`],
    evidenceFields: ['ingredientsText', 'ingredientEvidenceStatus'],
    evidenceState: assessment.active.length ? (positive.length ? 'mixed' : 'negative_evidence') : 'supported_absence',
    anchor: evidenceAnchor,
    evaluated: ['formulation_system_scan', 'supported_absence_of_formulation_systems'],
    positive,
    negative: assessment.active,
    missing: complete ? [] : ['complete ingredient list needed to support absence of formulation systems'],
    suppressed: assessment.suppressed
  };
}

function sugarExposure(input: ProductScoringInput, basis: ProductNutrientBasis): SugarExposure {
  const sugar = typeof basis.nutrients.sugar_g === 'number' ? basis.nutrients.sugar_g : null;
  const addedSugar = typeof basis.nutrients.added_sugar_g === 'number' ? basis.nutrients.added_sugar_g : null;
  if (basis.type === 'per_100g') return {
    sugar, addedSugar, sugarDensity: sugar, addedSugarDensity: addedSugar, densityBasis: 'per_100g'
  };
  const embeddedMass = typeof input.servingNutrients?.serving_quantity_g === 'number' && input.servingNutrients.serving_quantity_g > 0
    ? input.servingNutrients.serving_quantity_g
    : null;
  const explicitQuantity = typeof input.servingQuantity === 'number' && input.servingQuantity > 0 && (input.servingUnit === 'g' || input.servingUnit === 'ml')
    ? input.servingQuantity
    : null;
  const quantity = embeddedMass ?? explicitQuantity;
  const densityBasis = embeddedMass !== null ? 'g' as const : explicitQuantity !== null ? input.servingUnit as 'g' | 'ml' : null;
  return {
    sugar,
    addedSugar,
    sugarDensity: quantity !== null && sugar !== null ? Math.round((sugar / quantity) * 1000) / 10 : null,
    addedSugarDensity: quantity !== null && addedSugar !== null ? Math.round((addedSugar / quantity) * 1000) / 10 : null,
    densityBasis
  };
}

function combinedSugarSeverity(exposure: SugarExposure, liquid: boolean): 'none' | 'low' | 'moderate' | 'high' | 'very_high' | null {
  if (exposure.sugar === null && exposure.addedSugar === null) return null;
  const density = Math.max(exposure.sugarDensity ?? -1, exposure.addedSugarDensity ?? -1);
  const grams = Math.max(exposure.sugar ?? -1, exposure.addedSugar ?? -1);
  if (density >= (liquid ? 10 : 45) || grams >= (liquid ? 35 : 25)) return 'very_high';
  if (density >= (liquid ? 6 : 30) || grams >= (liquid ? 20 : 18)) return 'high';
  if (density >= (liquid ? 3 : 15) || grams >= (liquid ? 10 : 10)) return 'moderate';
  if (grams <= 0.5 && density <= 0.5) return 'none';
  return 'low';
}

function categoryNutritionFit(input: ProductScoringInput, archetype: ProductArchetype, basis: ProductNutrientBasis): DimensionDraft {
  if (archetype.contextMode === 'evidence_fallback' && archetype.confidence === 'low') return {
    score: null, confidence: 'low', evidence: [], evidenceFields: [], evidenceState: 'unsupported', evaluated: [],
    positive: [], negative: [], missing: ['defensible category-relative nutrition context']
  };
  const nutrients = basis.nutrients;
  const exposure = sugarExposure(input, basis);
  const liquid = archetype.form === 'beverage';
  const severity = combinedSugarSeverity(exposure, liquid);
  const sodium = typeof nutrients.sodium_mg === 'number' ? nutrients.sodium_mg : null;
  const protein = typeof nutrients.protein_g === 'number' ? nutrients.protein_g : null;
  const fiber = typeof nutrients.fiber_g === 'number' ? nutrients.fiber_g : null;
  const saturatedFat = typeof nutrients.saturated_fat_g === 'number' ? nutrients.saturated_fat_g : null;
  const relevant = [exposure.sugar, exposure.addedSugar, sodium, protein, fiber, saturatedFat].some((value) => value !== null);
  if (!relevant) return {
    score: null, confidence: 'low', evidence: [], evidenceFields: [], evidenceState: 'unsupported', evaluated: [],
    positive: [], negative: [], missing: ['category-relevant measured nutrition evidence']
  };

  const evidence = [
    ...(exposure.sugar !== null ? [`sugar:${exposure.sugar} g`] : []),
    ...(exposure.addedSugar !== null ? [`added sugar:${exposure.addedSugar} g`] : []),
    ...(exposure.sugarDensity !== null ? [`sugar density:${exposure.sugarDensity} g/100 ${exposure.densityBasis === 'ml' ? 'ml' : 'g'}`] : []),
    ...(exposure.addedSugarDensity !== null ? [`added-sugar density:${exposure.addedSugarDensity} g/100 ${exposure.densityBasis === 'ml' ? 'ml' : 'g'}`] : []),
    ...(sodium !== null ? [`sodium:${sodium} mg`] : []),
    ...(protein !== null ? [`protein:${protein} g`] : []),
    ...(fiber !== null ? [`fiber:${fiber} g`] : [])
  ];
  const positive: ProductDimensionContribution[] = [];
  const negative: ProductDimensionContribution[] = [];
  let evidenceAnchor: ProductDimensionAnchor;
  let state: ProductDimensionEvidenceState = 'not_detected';

  if (liquid && archetype.intent === 'hydration' && severity === 'none') {
    evidenceAnchor = anchor('unsweetened_hydration_nutrition', 'Measured nutrition supports unsweetened hydration', 86, evidence);
    state = 'supported_absence';
  } else if (liquid && severity === 'none') {
    evidenceAnchor = anchor('supported_absence_of_measured_sugar', 'Measured nutrition supports absence of sugar without treating absent macros as a bonus', 64, evidence);
    state = 'supported_absence';
  } else if (severity === 'very_high') {
    evidenceAnchor = anchor('very_high_measured_sugar_exposure', 'Measured sugar or added-sugar exposure is very high', liquid ? 24 : 30, evidence);
    negative.push(contribution('measured_sugar_density_consequence', 'High measured sugar density limits category nutrition fit', -8, evidence.filter((item) => item.includes('sugar'))));
    state = 'negative_evidence';
  } else if (severity === 'high') {
    evidenceAnchor = anchor('high_measured_sugar_exposure', 'Measured sugar or added-sugar exposure is high', liquid ? 34 : 42, evidence);
    negative.push(contribution('measured_sugar_density_consequence', 'Measured sugar density is unfavorable for the product role', -6, evidence.filter((item) => item.includes('sugar'))));
    state = 'negative_evidence';
  } else if (severity === 'moderate') {
    evidenceAnchor = anchor('moderate_measured_sugar_exposure', 'Measured sugar exposure is moderate for the product role', liquid ? 48 : 54, evidence);
    negative.push(contribution('measured_sugar_density_consequence', 'Measured sugar density is a category nutrition consideration', -3, evidence.filter((item) => item.includes('sugar'))));
    state = 'negative_evidence';
  } else if (archetype.intent === 'performance' && (protein !== null || fiber !== null)) {
    evidenceAnchor = anchor('performance_nutrition_evidence', 'Measured nutrition is available for the intended performance role', 58, evidence);
  } else if (archetype.intent === 'staple' || archetype.intent === 'meal') {
    evidenceAnchor = anchor('staple_meal_nutrition_evidence', 'Measured nutrition is available for the staple or meal role', 58, evidence);
  } else if (archetype.intent === 'snack' || archetype.intent === 'dessert') {
    evidenceAnchor = anchor('snack_dessert_nutrition_evidence', 'Measured nutrition is available for the snack or dessert role', severity === 'none' || severity === 'low' ? 62 : 55, evidence);
  } else {
    evidenceAnchor = anchor('category_role_nutrition_evidence', 'Measured nutrition is available for the supported product role', 58, evidence);
  }

  if (protein !== null && protein >= (liquid ? 20 : 15)) positive.push(contribution('meaningful_role_protein', 'Meaningful measured protein for the supported product role', 14, [`${protein} g protein`]));
  else if (protein !== null && protein >= 8) positive.push(contribution('moderate_role_protein', 'Moderate measured protein for the supported product role', 6, [`${protein} g protein`]));
  if (fiber !== null && fiber >= 5) positive.push(contribution('meaningful_role_fiber', 'Meaningful measured fiber for the supported product role', 7, [`${fiber} g fiber`]));
  else if (fiber !== null && fiber >= 3) positive.push(contribution('moderate_role_fiber', 'Moderate measured fiber for the supported product role', 4, [`${fiber} g fiber`]));
  if ((archetype.intent === 'staple' || archetype.intent === 'meal') && sodium !== null && sodium > 800) negative.push(contribution('high_role_sodium', 'Measured sodium is high for the supported staple or meal role', -15, [`${sodium} mg sodium`]));
  else if (archetype.intent === 'snack' && sodium !== null && sodium > 500) negative.push(contribution('high_role_sodium', 'Measured sodium is high for the supported snack role', -12, [`${sodium} mg sodium`]));
  if (archetype.intent === 'dessert' && saturatedFat !== null && saturatedFat >= 15) negative.push(contribution('high_role_saturated_fat', 'Measured saturated fat is high even in dessert context', -10, [`${saturatedFat} g saturated fat`]));

  return {
    score: scoreFromEvidence(evidenceAnchor, positive, negative),
    confidence: basis.confidence,
    evidence,
    evidenceFields: ['nutrientBasis', ...(exposure.densityBasis ? ['servingQuantity'] : [])],
    evidenceState: positive.length && (negative.length || state === 'negative_evidence') ? 'mixed' : negative.length || state === 'negative_evidence' ? 'negative_evidence' : positive.length ? 'positive_evidence' : state,
    anchor: evidenceAnchor,
    evaluated: ['measured_sugar_and_added_sugar_density', 'role_protein', 'role_fiber', 'role_sodium', 'role_saturated_fat'],
    positive,
    negative,
    missing: exposure.sugar !== null && exposure.sugarDensity === null ? ['metric serving mass or volume needed for sugar-density interpretation'] : [],
    suppressed: [
      ...(severity === 'high' || severity === 'very_high' ? ['category_typicality:cannot_neutralize_direct_sugar_evidence'] : []),
      ...(exposure.sugar !== null && exposure.addedSugar !== null ? ['separate_sugar_penalty:combined_into_one_measured_exposure_consequence'] : [])
    ]
  };
}

function foodStructure(input: ProductScoringInput, parsed: ParsedIngredients, archetype: ProductArchetype, sourceConfidence: DataConfidence): DimensionDraft {
  if (parsed.flatTokens.length === 0 || (archetype.base === 'water' && archetype.form === 'beverage')) return {
    score: null, confidence: 'low', evidence: [], evidenceFields: [], evidenceState: 'unsupported', evaluated: ['preserved_structure', 'reconstructed_structure'],
    positive: [], negative: [], missing: [parsed.flatTokens.length ? 'food structure is not material for this water-based beverage' : 'ingredient structure evidence']
  };
  const text = ingredientTextForMatching(parsed);
  const preserved = parsed.flatTokens.filter((token) => PRESERVED_STRUCTURE.test(token));
  const reconstructed = parsed.flatTokens.filter((token) => RECONSTRUCTED_STRUCTURE.test(token));
  const dominant = dominantToken(parsed);
  const matrixAbsent = CONCENTRATED_SWEETENER.test(dominant) || REFINED_STARCH.test(dominant) || TECHNICAL_COMPONENT.test(dominant);
  const extractedOil = CULINARY_OIL.test(dominant);
  if (preserved.length === 0 && reconstructed.length === 0 && !matrixAbsent && !extractedOil) return {
    score: null, confidence: 'low', evidence: [`${parsed.topLevelIngredients.length} top-level ingredients`], evidenceFields: ['ingredientsText'], evidenceState: 'unsupported',
    evaluated: ['preserved_structure', 'reconstructed_structure'], positive: [], negative: [], missing: ['direct food-structure evidence']
  };
  const evidenceAnchor = matrixAbsent
    ? anchor('absent_food_matrix_anchor', 'Dominant composition does not establish an intact food matrix', 32, [dominant])
    : extractedOil
      ? anchor('extracted_food_structure_anchor', 'Direct evidence supports an extracted rather than intact food structure', 48, [dominant])
    : preserved.length > 0 && reconstructed.length > 0
      ? anchor('mixed_food_structure_anchor', 'Both preserved and reconstructed structure are declared', 56, [`${preserved.length} preserved signals`, `${reconstructed.length} reconstructed signals`])
      : preserved.length > 0
        ? anchor('preserved_food_structure_anchor', 'Direct evidence supports preserved food structure', 82, preserved.slice(0, 5))
        : anchor('reconstructed_food_structure_anchor', 'Direct evidence supports isolated or reconstructed structure', 45, reconstructed.slice(0, 5));
  const positive = preserved.length > 0
    ? [contribution('direct_preserved_structure', 'Direct preserved-structure evidence', Math.min(8, 3 + preserved.length), preserved.slice(0, 5))]
    : [];
  const negative = reconstructed.length > 0
    ? [contribution('direct_reconstructed_structure', 'Direct isolated or reconstructed structure evidence', -Math.min(10, 4 + reconstructed.length * 2), reconstructed.slice(0, 5))]
    : matrixAbsent
      ? [contribution('dominant_matrix_absence', 'Dominant composition provides no intact food matrix', -4, [dominant])]
      : extractedOil
        ? [contribution('extracted_matrix_structure', 'Extraction separates the product from an intact food matrix', -4, [dominant])]
      : [];
  return {
    score: scoreFromEvidence(evidenceAnchor, positive, negative),
    confidence: completeIngredients(input) ? sourceConfidence : sourceConfidence === 'high' ? 'medium' : sourceConfidence,
    evidence: [`${preserved.length} preserved-structure signals`, `${reconstructed.length} reconstructed-structure signals`],
    evidenceFields: ['ingredientsText'],
    evidenceState: positive.length && negative.length ? 'mixed' : positive.length ? 'positive_evidence' : 'negative_evidence',
    anchor: evidenceAnchor,
    evaluated: ['preserved_structure', 'reconstructed_structure', 'dominant_matrix_absence'],
    positive,
    negative,
    missing: [],
    suppressed: [text && parsed.flatTokens.length === 1 ? 'single_ingredient_count:not_food_structure_evidence' : 'ingredient_count:not_food_structure_evidence']
  };
}

function processingPurpose(
  input: ProductScoringInput,
  parsed: ParsedIngredients,
  archetype: ProductArchetype,
  basis: ProductNutrientBasis,
  sourceConfidence: DataConfidence,
  profile: CategoryProfile | null
): DimensionDraft {
  if (parsed.flatTokens.length === 0) return {
    score: null, confidence: 'low', evidence: [], evidenceFields: [], evidenceState: 'unsupported', evaluated: [],
    positive: [], negative: [], missing: ['ingredient evidence needed to assess processing purpose']
  };
  const dominant = dominantToken(parsed);
  const assessment = formulationSignals(ingredientTextForMatching(parsed), profile);
  const exposure = sugarExposure(input, basis);
  const severity = combinedSugarSeverity(exposure, archetype.form === 'beverage');
  const dominantSweetener = CONCENTRATED_SWEETENER.test(dominant);
  const dominantTechnical = TECHNICAL_COMPONENT.test(dominant);
  const dominantStarch = REFINED_STARCH.test(dominant);
  const directWhole = parsed.flatTokens.some((token) => DIRECT_QUALITY.test(token));
  let evidenceAnchor: ProductDimensionAnchor | null = null;
  const positive: ProductDimensionContribution[] = [];
  const negative: ProductDimensionContribution[] = [];

  if (dominantSweetener) evidenceAnchor = anchor('concentrated_sweetness_purpose', 'Declared order supports concentrated sweetness as the principal purpose', 25, [dominant]);
  else if (dominantTechnical) evidenceAnchor = anchor('technical_formulation_purpose', 'Declared order supports a technical formulation purpose', 24, [dominant]);
  else if (dominantStarch) evidenceAnchor = anchor('isolated_starch_purpose', 'Declared order supports a refined isolated-component purpose', 32, [dominant]);
  else if (archetype.form === 'beverage' && archetype.intent === 'hydration' && severity === 'none' && assessment.active.length === 0) {
    evidenceAnchor = anchor('hydration_delivery_purpose', 'Direct formulation evidence supports hydration as the principal purpose', 88, ['water-based form', 'measured absence of sugar', 'no detected formulation system']);
    positive.push(contribution('direct_hydration_purpose', 'Direct hydration-purpose evidence', 5, ['water-based beverage', 'measured unsweetened nutrition']));
  } else if ((severity === 'high' || severity === 'very_high') && (archetype.intent === 'dessert' || archetype.intent === 'snack')) {
    evidenceAnchor = anchor('sweetness_delivery_purpose', 'Measured exposure and declared order support sweetness delivery as a principal purpose', severity === 'very_high' ? 34 : 44, [dominant, ...[exposure.sugarDensity, exposure.addedSugarDensity].filter((value): value is number => value !== null).map((value) => `${value} g/100 serving units`)]);
    negative.push(contribution('sweetness_primary_purpose', 'Concentrated sweetness is central to the product purpose', -7, [dominant]));
  } else if (archetype.form === 'beverage' && severity === 'none') {
    evidenceAnchor = anchor('non_sugar_beverage_delivery_purpose', 'Direct evidence supports a formulated beverage purpose without concentrated sugar delivery', 66, ['measured absence of sugar', `${assessment.active.length} formulation systems`]);
    if (assessment.active.length > 0) negative.push(contribution('formulated_beverage_delivery', 'Formulation systems remain material to the beverage purpose', -Math.min(6, assessment.active.length * 2), assessment.active.flatMap((item) => item.evidence)));
  } else if (archetype.formulation === 'highly_formulated') {
    evidenceAnchor = anchor('highly_formulated_delivery_purpose', 'Multiple formulation systems shape the principal delivery purpose', 50, [`${assessment.active.length} formulation systems`]);
    negative.push(contribution('reconstructed_delivery_purpose', 'Reconstruction is central to the product purpose', -6, parsed.reconstructionSignals));
  } else if (archetype.formulation === 'functional') {
    evidenceAnchor = anchor('functional_delivery_purpose', 'Functional isolates or additions shape the principal product purpose', 54, parsed.reconstructionSignals);
    negative.push(contribution('functional_reconstruction_purpose', 'Functional reconstruction is material to the product purpose', -5, parsed.reconstructionSignals));
  } else if (directWhole && (archetype.intent === 'staple' || archetype.intent === 'meal')) {
    evidenceAnchor = anchor('staple_nourishment_purpose', 'Direct ingredient evidence supports a staple nourishment purpose', 80, parsed.flatTokens.filter((token) => DIRECT_QUALITY.test(token)).slice(0, 5));
    positive.push(contribution('direct_staple_purpose', 'Direct whole-source evidence supports the intended staple role', 5, parsed.flatTokens.filter((token) => DIRECT_QUALITY.test(token)).slice(0, 5)));
  } else if (assessment.active.length > 0) {
    evidenceAnchor = anchor('formulated_delivery_purpose', 'Declared formulation systems materially shape the product purpose', 58, [`${assessment.active.length} formulation systems`]);
    negative.push(contribution('formulation_shaped_purpose', 'Formulation systems shape the principal delivery purpose', -Math.min(8, assessment.active.length * 2), assessment.active.flatMap((item) => item.evidence)));
  } else if (CULINARY_OIL.test(dominant)) {
    evidenceAnchor = anchor('extracted_culinary_purpose', 'Direct ingredient evidence supports a concentrated culinary-fat purpose', 55, [dominant]);
  } else if (CULINARY_SOURCE.test(dominant) && (
    archetype.contextMode !== 'evidence_fallback' ||
    parsed.topLevelIngredients.length >= 2 && parsed.topLevelIngredients.filter((token) => CULINARY_SOURCE.test(token)).length / parsed.topLevelIngredients.length >= 0.6
  )) {
    evidenceAnchor = anchor('supported_category_role_purpose', 'Direct ingredient evidence supports the inferred product role', archetype.intent === 'staple' || archetype.intent === 'meal' ? 70 : 66, [dominant, `intent:${archetype.intent}`]);
  }

  if (!evidenceAnchor) return {
    score: null, confidence: 'low', evidence: [`dominant:${dominant}`], evidenceFields: ['ingredientsText'], evidenceState: 'unsupported',
    evaluated: ['principal_processing_purpose'], positive: [], negative: [], missing: ['direct evidence of principal processing purpose'],
    suppressed: [...assessment.suppressed, 'ingredient_count:simplicity_not_processing_purpose']
  };
  return {
    score: scoreFromEvidence(evidenceAnchor, positive, negative),
    confidence: completeIngredients(input) ? sourceConfidence : sourceConfidence === 'high' ? 'medium' : sourceConfidence,
    evidence: [`dominant:${dominant}`, `intent:${archetype.intent}`, `formulation:${archetype.formulation}`],
    evidenceFields: ['ingredientsText', ...(severity !== null ? ['nutrientBasis'] : [])],
    evidenceState: positive.length && negative.length ? 'mixed' : negative.length ? 'negative_evidence' : positive.length ? 'positive_evidence' : 'not_detected',
    anchor: evidenceAnchor,
    evaluated: ['principal_processing_purpose', 'sweetness_primary_purpose', 'functional_reconstruction_purpose'],
    positive,
    negative,
    missing: [],
    suppressed: [...assessment.suppressed, 'ingredient_count:simplicity_not_processing_purpose', ...(severity === 'high' || severity === 'very_high' ? ['category_typicality:cannot_neutralize_sweetness_purpose'] : [])]
  };
}

export function scoreProductDimensions(params: {
  input: ProductScoringInput;
  archetype: ProductArchetype;
  basis: ProductNutrientBasis;
  ledger: ProductScoreLedgerEntry[];
  sourceConfidence: DataConfidence;
  profile: CategoryProfile | null;
}): ProductDimensionScore {
  const { input, archetype, basis, ledger, sourceConfidence, profile } = params;
  const parsed = parseIngredients(input.ingredientsText, ingredientStatus(input));
  const weights = weightsFor(archetype);
  const dimensions = [
    dimension('ingredient_integrity', 'Ingredient integrity', ingredientIntegrity(input, parsed, sourceConfidence), ledger, weights.ingredient_integrity),
    dimension('formulation_burden', 'Formulation burden', formulationBurden(input, parsed, sourceConfidence, profile), ledger, weights.formulation_burden),
    dimension('category_nutrition_fit', 'Category nutrition fit', categoryNutritionFit(input, archetype, basis), ledger, weights.category_nutrition_fit),
    dimension('food_structure', 'Food structure', foodStructure(input, parsed, archetype, sourceConfidence), ledger, weights.food_structure),
    dimension('processing_purpose', 'Processing purpose', processingPurpose(input, parsed, archetype, basis, sourceConfidence, profile), ledger, weights.processing_purpose)
  ];
  const supported = dimensions.filter((item) => item.score !== null);
  const supportedWeight = Math.round(supported.reduce((sum, item) => sum + item.weight, 0) * 1000) / 1000;
  const unknownWeight = Math.max(0, Math.round((1 - supportedWeight) * 1000) / 1000);
  const materialUnknownDimensions = dimensions
    .filter((item) => item.score === null && item.weight >= 0.15)
    .map((item) => item.id);
  const scoreScope: ProductScoreScope = supportedWeight >= 0.85 && materialUnknownDimensions.length === 0
    ? 'overall'
    : 'supported_evidence';
  const emptyAggregation: ProductDimensionScore['aggregation'] = {
    method: 'conditional_supported_evidence_with_unknown_interval',
    formula: 'sum(weight * supported score) / supported weight',
    supportedWeightedSum: 0,
    supportedWeight,
    unknownWeight,
    supportedDimensionCount: supported.length,
    conditionalCentralScore: null,
    scoreScope,
    materialUnknownDimensions
  };
  if (supported.length === 0 || supportedWeight <= 0) return {
    score: null, range: null, dimensions, supportedWeight, scoreScope, aggregation: emptyAggregation
  };

  for (const item of supported) {
    item.effectiveWeight = item.weight / supportedWeight;
    item.contribution = item.score! * item.effectiveWeight;
    item.range = range(item.score!, item.confidence, item.evidence.length);
  }
  const supportedWeightedSum = supported.reduce((sum, item) => sum + item.score! * item.weight, 0);
  const score = clamp(supported.reduce((sum, item) => sum + item.contribution, 0));
  const contextSpread = profile ? 0 : archetype.confidence === 'low' ? 6 : 3;
  const conflictSpread = input.evidenceContext?.providerConflict ? 6 : 0;
  const unsupportedSpread = materialUnknownDimensions.length * 2;
  const nutrientEvidenceSpread = basis.confidence === 'low' ? 6 : basis.confidence === 'medium' ? 3 : 0;
  const low = clamp(supported.reduce((sum, item) => sum + item.range![0] * item.weight, 0) - contextSpread - conflictSpread - unsupportedSpread - nutrientEvidenceSpread);
  const high = clamp(supported.reduce((sum, item) => sum + item.range![1] * item.weight, 0) + unknownWeight * 100 + contextSpread + conflictSpread + unsupportedSpread + nutrientEvidenceSpread);
  return {
    score,
    range: [Math.min(low, score), Math.max(high, score)],
    dimensions,
    supportedWeight,
    scoreScope,
    aggregation: {
      ...emptyAggregation,
      supportedWeightedSum: Math.round(supportedWeightedSum * 10) / 10,
      conditionalCentralScore: score
    }
  };
}
