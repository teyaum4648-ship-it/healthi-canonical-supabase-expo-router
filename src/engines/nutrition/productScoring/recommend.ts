import { resolveProductCategory } from './categoryResolution';
import { scoreProductLabel, type ProductScoringInput, type ProductScoringResult } from './engine';

export type ScoredCatalogProduct = ProductScoringInput & { id: string };
export type RankedCatalogProduct = { product: ScoredCatalogProduct; result: ProductScoringResult };

function rank(products: ScoredCatalogProduct[]): RankedCatalogProduct[] {
  return products
    .map((product) => ({ product, result: scoreProductLabel(product) }))
    .sort((left, right) => (right.result.displayScore ?? -1) - (left.result.displayScore ?? -1));
}

function categoryId(product: ProductScoringInput): string | null {
  return resolveProductCategory({
    name: product.name,
    explicitCategory: product.category,
    categoryTags: product.categoryTags,
    ingredientsText: product.ingredientsText,
    servingNutrients: product.servingNutrients
  }).selectedCategoryId;
}

export function searchScoredProducts(
  query: string,
  catalog: ScoredCatalogProduct[],
  limit = 10
): RankedCatalogProduct[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return [];
  const queryCategory = resolveProductCategory({ name: normalizedQuery, explicitCategory: normalizedQuery }).selectedCategoryId;
  const matches = catalog.filter((product) => {
    const category = categoryId(product);
    return product.name.toLowerCase().includes(normalizedQuery) || Boolean(queryCategory && category === queryCategory);
  });
  return rank(matches).slice(0, limit);
}

export function recommendProductAlternatives(
  scanned: ScoredCatalogProduct,
  catalog: ScoredCatalogProduct[],
  options: { minimumDifference?: number; limit?: number } = {}
): { scanned: ProductScoringResult; alternatives: RankedCatalogProduct[] } {
  const scannedResult = scoreProductLabel(scanned);
  const scannedCategory = categoryId(scanned);
  if (!scannedCategory || scannedResult.displayScore === null) return { scanned: scannedResult, alternatives: [] };
  const minimumDifference = options.minimumDifference ?? 8;
  const alternatives = rank(catalog.filter((product) => {
    if (product.id === scanned.id) return false;
    return categoryId(product) === scannedCategory;
  })).filter((candidate) => (
    candidate.result.displayScore !== null &&
    candidate.result.displayScore >= scannedResult.displayScore! + minimumDifference
  )).slice(0, options.limit ?? 3);
  return { scanned: scannedResult, alternatives };
}
