export { PRODUCT_CATEGORIES, categoryInterpretationConfidence, detectProductCategory } from './categories';
export type { ProductForm } from './categories';
export { resolveProductCategory } from './categoryResolution';
export type { CategoryCandidate, CategoryEvidence, CategoryEvidenceSource, CategoryResolution, CategoryResolutionInput } from './categoryResolution';
export { CATEGORY_PROFILES, RULE_FAMILIES, getCategoryProfile } from './profiles';
export type { CategoryProfile, NutrientBasisPreference, RuleFamily, RulePolicyStatus } from './profiles';
export { PRODUCT_EVIDENCE_REFERENCES, resolveProductEvidence } from './evidence';
export {
  productBetterOptions,
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
  ProductGradeEligibility,
  ProductLetterGrade,
  ProductMacroContext,
  ProductNutrientBasis,
  ProductNutrients,
  ProductScoreLedgerEntry,
  ProductScoreLedgerStatus,
  ProductScoreFactor,
  ProductScoreLabel,
  ProductScoringInput,
  ProductScoringResult
} from './engine';
export type { ProductEvidenceRef } from './evidence';
export type { RankedCatalogProduct, ScoredCatalogProduct } from './recommend';
