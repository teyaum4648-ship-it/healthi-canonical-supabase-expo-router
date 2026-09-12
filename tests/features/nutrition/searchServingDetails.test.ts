import { describe, expect, it, vi } from 'vitest';
import { searchCatalog, handleFoodSearch } from '../../../src/server/foodSearch';
import { normalizeSearchPayload, searchFoods } from '../../../src/features/nutrition/productLookup/foodSearchClient';
import { foodLoggingNutrition, foodSearchPortionDetail, initialFoodLoggingAmount } from '../../../src/features/nutrition/foodLoggingNutrition';
import { addMealBuilderItem, createEmptyMealBuilder, calculateMealBuilderTotals } from '../../../src/features/nutrition/mealBuilder';

const raw = { code: '12345678', product_name: 'Example snack', nutriments: { 'energy-kcal_100g': 400, proteins_100g: 20 } };
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const detail = { code: raw.code, serving_size: '1 bar (45 g)', serving_quantity: 45 };
const ctx = { waitUntil: (_p: Promise<unknown>) => {} };
describe('search label enrichment', () => {
  it('uses one exact-code bulk request and recovers servings missing from the index', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(response({ hits: [raw, { ...raw, code: '87654321' }] })).mockResolvedValueOnce(response({ products: [detail, { ...detail, code: '87654321' }] }));
    const payload = await searchCatalog('snack', {}, fetcher);
    expect(fetcher).toHaveBeenCalledTimes(2);
    const url = new URL(fetcher.mock.calls[1][0]);
    expect(url.pathname).toBe('/api/v2/search');
    expect(url.searchParams.get('code')).toBe('12345678,87654321');
    expect(url.searchParams.get('fields')).not.toContain('nutriments');
    expect(payload.servingDetailsIncomplete).toBe(false);
    const food = normalizeSearchPayload(payload, 'snack')[0];
    expect(foodLoggingNutrition(food)).toMatchObject({ basis: 'serving', label: '1 bar (45 g)', amountPerPortion: 1, nutrients: { calories: 180, protein_g: 9 } });
    expect(foodSearchPortionDetail(food)).toContain('180 kcal per serving');
    expect(initialFoodLoggingAmount(food)).toBe('1');
    const meal = addMealBuilderItem(createEmptyMealBuilder(), { snapshot: food, source: 'search', servings: 2 });
    expect(calculateMealBuilderTotals(meal.items).calories).toBe(360);
  });
  it('does not use unrelated barcode records or infer serving from package weight', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(response({ hits: [{ ...raw, quantity: '12 bars (540 g)' }] })).mockResolvedValueOnce(response({ products: [{ ...detail, code: '87654321' }] }));
    const payload = await searchCatalog('snack', {}, fetcher);
    expect(payload.products[0].serving_size).toBeUndefined();
    const food = normalizeSearchPayload(payload, 'snack')[0];
    expect(foodLoggingNutrition(food).basis).toBe('per_100g');
    expect(initialFoodLoggingAmount(food)).toBe('');
    expect(foodSearchPortionDetail(food)).toContain('Serving size not listed');
    expect(foodSearchPortionDetail(food)).toContain('400 kcal per 100 g');
    expect(foodSearchPortionDetail(food)).not.toContain('per serving');
  });
  it('never replaces already reported servings and does not mutate index rows', async () => {
    const known = { ...raw, serving_size: '2 crackers (30 g)' };
    const before = JSON.stringify(known);
    const fetcher = vi.fn(async () => response({ hits: [known] }));
    const result = await searchCatalog('crackers', {}, fetcher);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(result.products[0].serving_size).toBe(known.serving_size);
    expect(JSON.stringify(known)).toBe(before);
  });
  it('retains useful results if the label request fails, without retrying or caching the failure', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(response({ hits: [raw] })).mockResolvedValueOnce(response({}, 503));
    const cache = { match: vi.fn(async (_request: Request) => undefined), put: vi.fn(async () => {}) };
    const result = await handleFoodSearch(new Request('https://healthi.test/api/food-search?q=snack'), {}, ctx, cache, fetcher);
    const payload = await result.json();
    expect(payload).toMatchObject({ servingDetailsIncomplete: true, partial: false, products: [raw] });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(cache.put).not.toHaveBeenCalled();
    expect(cache.match.mock.calls[0][0].url).toContain('/food-search-cache/v2');
  });
  it('reports when serving details could not load rather than silently implying no label exists', async () => {
    const result = await searchFoods('snack', { endpoint: '/api/food-search', fetcher: vi.fn(async () => response({ products: [raw], usdaFoods: [], servingDetailsIncomplete: true })) });
    expect(result.status).toBe('found');
    expect(result.notice).toContain('serving sizes could not load');
  });
  it('keeps missing serving sizes explicit even when the full record is genuinely incomplete', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(response({ hits: [raw] })).mockResolvedValueOnce(response({ products: [{ code: raw.code, quantity: '45 g' }] }));
    const result = await searchCatalog('snack', {}, fetcher);
    expect(result.servingDetailsIncomplete).toBe(false);
    expect(result.products[0].serving_size).toBeUndefined();
  });
  it('limits the entire enrichment stage with an abort deadline', async () => {
    vi.useFakeTimers();
    try {
      const fetcher = vi.fn().mockResolvedValueOnce(response({ hits: [raw] })).mockImplementationOnce((_url, init) => new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(new Error('timeout')), { once: true })));
      const pending = searchCatalog('snack', {}, fetcher);
      await vi.advanceTimersByTimeAsync(2600);
      expect((await pending).servingDetailsIncomplete).toBe(true);
      expect(fetcher).toHaveBeenCalledTimes(2);
    } finally { vi.useRealTimers(); }
  });
  it('supports volume references without calling them servings or assuming grams', () => {
    const product = { barcode: '', provider: 'open_food_facts' as const, name: 'Drink', nutriments_per_100ml: { calories: 30 }, confidence: 'low' as const, quality_flags: [], reason_codes: [] };
    expect(foodSearchPortionDetail(product)).toContain('30 kcal per 100 mL');
    expect(initialFoodLoggingAmount(product)).toBe('');
    expect(foodLoggingNutrition(product).amountUnit).toBe('mL');
  });
  it('does not mislabel a real 100 g label serving as a fallback', () => {
    const food = normalizeSearchPayload({ products: [{ ...raw, serving_size: '1 container (100 g)' }], usdaFoods: [] }, 'snack')[0];
    expect(initialFoodLoggingAmount(food)).toBe('1');
    expect(foodSearchPortionDetail(food)).toContain('400 kcal per serving');
  });
});
