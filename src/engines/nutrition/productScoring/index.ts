export { CATEGORY_SCORE_SLOPE, PRODUCT_CATEGORIES, detectProductCategory } from './categories';
export { scoreProductLabel, splitIngredientList } from './engine';
export { recommendProductAlternatives, searchScoredProducts } from './recommend';
export type {
  ProductProcessingTier,
  ProductScoreFactor,
  ProductScoreLabel,
  ProductScoringInput,
  ProductScoringResult
} from './engine';
export type { RankedCatalogProduct, ScoredCatalogProduct } from './recommend';
