export { PRODUCT_CATEGORIES, categoryInterpretationConfidence, detectProductCategory } from './categories';
export { resolveProductArchetype } from './archetypes';
export type {
  ProductArchetype,
  ProductBaseArchetype,
  ProductFormArchetype,
  ProductFormulationArchetype,
  ProductIntentArchetype
} from './archetypes';
export { PRODUCT_DIMENSION_OWNERSHIP, PRODUCT_DIMENSION_SCALE_SEMANTICS, scoreProductDimensions } from './dimensions';
export { PRODUCT_QUALITY_V5_DIMENSION_WEIGHTS, scoreProductDimensionsV5 } from './kernelV5';
export type {
  ProductDimensionAnchor,
  ProductDimensionContribution,
  ProductDimensionEvidenceState,
  ProductDimensionScore,
  ProductScoreDimension,
  ProductScoreDimensionId,
  ProductScoreScope
} from './dimensions';
export { ingredientTextForMatching, parseIngredients } from './ingredientParser';
export type { IngredientEvidenceCompleteness, ParsedIngredients } from './ingredientParser';
export type { ProductForm } from './categories';
export { resolveProductCategory } from './categoryResolution';
export type {
  CategoryCandidate,
  CategoryContradictionLevel,
  CategoryEvidence,
  CategoryEvidenceLevel,
  CategoryEvidenceSource,
  CategoryResolution,
  CategoryResolutionInput
} from './categoryResolution';
export { CATEGORY_PROFILES, RULE_FAMILIES, getCategoryProfile } from './profiles';
export type { CategoryProfile, NutrientBasisPreference, RuleFamily, RulePolicyStatus } from './profiles';
export { PRODUCT_EVIDENCE_REFERENCES, resolveProductEvidence } from './evidence';
export {
  PRODUCT_SCORE_ELIGIBILITY_POLICY,
  PRODUCT_QUALITY_ENGINE_VERSION,
  productBetterOptions,
  productGradeCertainty,
  productGradeBand,
  productGradeLabel,
  productLetterGrade,
  scoreProductLabel,
  splitIngredientList
} from './engine';
export { recommendProductAlternatives, searchScoredProducts } from './recommend';
export type {
  ProductProcessingTier,
  ProductBetterOption,
  ProductGradeBand,
  ProductGradeCertainty,
  ProductGradeCertaintyState,
  ProductGradeEligibility,
  ProductLetterGrade,
  ProductMacroContext,
  ProductNutrientBasis,
  ProductNutrients,
  ProductScoreLedgerEntry,
  ProductScoreLedgerStatus,
  ProductScoreFactor,
  ProductScoreEligibility,
  ProductScoreLabel,
  ProductScoringInput,
  ProductScoringResult,
  ProductQualityEngineVersion
} from './engine';
export type { ProductEvidenceRef } from './evidence';
export type { RankedCatalogProduct, ScoredCatalogProduct } from './recommend';
