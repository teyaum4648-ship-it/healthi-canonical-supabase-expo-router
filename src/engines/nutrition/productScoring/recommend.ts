import { detectProductCategory } from './categories';
import { scoreProductLabel, type ProductScoringInput, type ProductScoringResult } from './engine';

export type ScoredCatalogProduct = ProductScoringInput & { id: string };
export type RankedCatalogProduct = { product: ScoredCatalogProduct; result: ProductScoringResult };

function rank(products: ScoredCatalogProduct[]): RankedCatalogProduct[] {
  return products
    .map((product) => ({ product, result: scoreProductLabel(product) }))
    .sort((left, right) => (right.result.displayScore ?? -1) - (left.result.displayScore ?? -1));
}

export function searchScoredProducts(
  query: string,
  catalog: ScoredCatalogProduct[],
  limit = 10
): RankedCatalogProduct[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return [];
  const queryCategory = detectProductCategory(normalizedQuery, normalizedQuery);
  const matches = catalog.filter((product) => {
    const category = detectProductCategory(product.category, product.name, product.categoryTags);
    return product.name.toLowerCase().includes(normalizedQuery) || Boolean(queryCategory && category?.id === queryCategory.id);
  });
  return rank(matches).slice(0, limit);
}

export function recommendProductAlternatives(
  scanned: ScoredCatalogProduct,
  catalog: ScoredCatalogProduct[],
  options: { minimumDifference?: number; limit?: number } = {}
): { scanned: ProductScoringResult; alternatives: RankedCatalogProduct[] } {
  const scannedResult = scoreProductLabel(scanned);
  const scannedCategory = detectProductCategory(scanned.category, scanned.name, scanned.categoryTags);
  if (!scannedCategory || scannedResult.displayScore === null) return { scanned: scannedResult, alternatives: [] };
  const minimumDifference = options.minimumDifference ?? 8;
  const alternatives = rank(catalog.filter((product) => {
    if (product.id === scanned.id) return false;
    return detectProductCategory(product.category, product.name, product.categoryTags)?.id === scannedCategory.id;
  })).filter((candidate) => (
    candidate.result.displayScore !== null &&
    candidate.result.displayScore >= scannedResult.displayScore! + minimumDifference
  )).slice(0, options.limit ?? 3);
  return { scanned: scannedResult, alternatives };
}
