export { CATEGORY_SCORE_SLOPE, PRODUCT_CATEGORIES, detectProductCategory } from './categories';
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
  ProductLetterGrade,
  ProductNutrients,
  ProductScoreFactor,
  ProductScoreLabel,
  ProductScoringInput,
  ProductScoringResult
} from './engine';
export type { ProductEvidenceRef } from './evidence';
export type { RankedCatalogProduct, ScoredCatalogProduct } from './recommend';
