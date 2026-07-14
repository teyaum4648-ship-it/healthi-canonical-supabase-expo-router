export { calculateFoodQuality } from './calculateFoodQuality';
export { calculateFoodPatternProfile } from './calculateFoodPatternProfile';
export { calculateFoodResponse } from './calculateFoodResponse';
export { calculateNutrientSummary } from './calculateNutrientSummary';
export { generateNutritionReadinessSignal } from './generateNutritionReadinessSignal';
export { getFoodPatternResultCopy } from './foodPatternResultCopy';
export { adaptScannedProductToMealLog } from './scannerAdapter';
export { scoreFoodPatternMealResponse, updateFoodPatternProfileFromResponse } from './updateFoodPatternProfileFromResponse';
export {
  detectProductCategory,
  productBetterOptions,
  productGradeBand,
  productGradeLabel,
  productLetterGrade,
  recommendProductAlternatives,
  scoreProductLabel,
  searchScoredProducts,
  splitIngredientList
} from './productScoring';
export type { AdaptScannedProductParams, ScannedProductInput, ScannedProductNutriments } from './scannerAdapter';
export type {
  FoodPatternAnswers,
  FoodPatternLabel,
  FoodPatternMealResponseInput,
  FoodPatternMealResponseScore,
  FoodPatternMealStyle,
  FoodPatternProfile,
  FoodPatternQuestionId,
  FoodPatternReasonCode,
  FoodPatternResultCopy,
  FoodPatternScoredLabel,
  FoodPatternScores
} from './foodPatternTypes';
export type {
  DataConfidence,
  FoodQualityFlag,
  FoodQualitySummary,
  FoodResponseSummary,
  MealDataSource,
  MealLog,
  MealType,
  MealUserResponse,
  NutrientSummary,
  NutritionReadinessSignal,
  NutritionReasonCode,
  NutritionTargets
} from './types';
export type {
  ProductProcessingTier,
  ProductBetterOption,
  ProductEvidenceRef,
  ProductGradeBand,
  ProductLetterGrade,
  ProductNutrients,
  ProductScoreFactor,
  ProductScoreLabel,
  ProductScoringInput,
  ProductScoringResult,
  RankedCatalogProduct,
  ScoredCatalogProduct
} from './productScoring';
