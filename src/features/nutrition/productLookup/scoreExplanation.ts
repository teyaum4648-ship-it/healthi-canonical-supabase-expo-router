import { explainProductScore, type ProductExplanation } from '../../../engines/nutrition/productScoring/explain';
import type { HealthiProductSnapshot, ProductQualitySnapshot } from './productLookupTypes';

/**
 * Why a product's score is the score, read from the same label and the same ledger the
 * score came from. Shared by the scanner and by every score ring that opens a breakdown,
 * so the two can never explain the same product differently.
 */
export function explainSnapshotScore(product: HealthiProductSnapshot, quality: ProductQualitySnapshot): ProductExplanation {
  const basis = quality.nutrient_basis ?? null;
  const perHundred = basis?.type === 'per_100g';
  return explainProductScore({
    ingredientsText: product.ingredients_text ?? null,
    nutrients: basis?.nutrients ?? null,
    basisLabel: perHundred
      ? (product.nutriments_per_100ml && !product.nutriments_per_100g ? '100 ml' : '100 g')
      : product.serving_size ?? 'serving',
    dimensions: quality.dimensions ?? [],
    grade: quality.letter_grade ?? null
  });
}
