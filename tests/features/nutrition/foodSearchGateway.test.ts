import { describe, expect, it, vi } from 'vitest';
import { handleFoodSearch, searchCatalog } from '../../../src/server/foodSearch';
import { normalizeSearchPayload, normalizeUsdaSearchFood, searchFoods } from '../../../src/features/nutrition/productLookup/foodSearchClient';
const product = { code: '12345678', product_name: 'Hamburger bun', brands: ['Example bakery'], serving_size: '1 bun (50 g)', nutriments: { 'energy-kcal_100g': 270, proteins_100g: 9 } };
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const ctx = { waitUntil: (_promise: Promise<unknown>) => {} };
describe('server-backed food search', () => {
  it('uses modern keyword search with bounded fields and treats text as terms', async () => {
    const fetcher = vi.fn(async() => response({ hits: [product] }));
    const result = await searchCatalog('hamburger bun', {}, fetcher);
    expect(result.products[0].brands).toBe('Example bakery');
    const calls = fetcher.mock.calls as unknown as [string, RequestInit][];
    expect(calls[0][0]).toBe('https://search.openfoodfacts.org/search');
    expect(JSON.parse(calls[0][1].body as string).q).toBe('hamburger bun');
    expect(calls).toHaveLength(1);
    expect(result.usdaConfigured).toBe(false);
  });
  it('has exactly one fallback when primary keyword search fails', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(response({}, 503)).mockResolvedValueOnce(response({ products: [product] }));
    expect((await searchCatalog('bun', {}, fetcher)).products).toHaveLength(1);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('retains another source when one fails and never exposes the API key', async () => {
    const fetcher = vi.fn(async(url: string | URL | Request) => String(url).includes('api.nal') ? response({ foods: [{ fdcId: 123, description: 'Bun' }] }) : response({}, 503));
    const result = await searchCatalog('bun', { USDA_API_KEY: 'test-secret' }, fetcher as typeof fetch);
    expect(result.partial).toBe(true); expect(result.usdaFoods).toHaveLength(1);
    expect(JSON.stringify(result)).not.toContain('test-secret');
  });
  it('reports genuine outages rather than empty results', async () => {
    const r = await handleFoodSearch(new Request('https://healthi.test/api/food-search?q=outage'), {}, ctx, undefined, vi.fn(async() => response({},503)));
    expect(r.status).toBe(503); expect(await r.json()).toMatchObject({ error: 'provider_unavailable' });
  });
  it('reuses a fresh public catalog cache without an upstream request', async () => {
    const payload = { products: [product], usdaFoods: [], fetchedAt: new Date().toISOString() };
    const cache = { match: vi.fn(async() => response(payload)), put: vi.fn(async() => {}) };
    const fetcher = vi.fn();
    const r = await handleFoodSearch(new Request('https://healthi.test/api/food-search?q=cached'), {}, ctx, cache, fetcher);
    expect(await r.json()).toMatchObject({ cache: 'fresh' }); expect(fetcher).not.toHaveBeenCalled();
  });
  it('labels stale cached results when upstream is down', async () => {
    const cache = { match: vi.fn(async() => response({ products: [product], usdaFoods: [], fetchedAt: new Date(Date.now()-3600_000).toISOString() })), put: vi.fn(async() => {}) };
    const r = await handleFoodSearch(new Request('https://healthi.test/api/food-search?q=stale'), {}, ctx, cache, vi.fn(async()=>response({},503)));
    expect(await r.json()).toMatchObject({ stale: true, cache: 'stale' });
  });
  it('rejects cross-origin requests, invalid queries, and writes', async () => {
    expect((await handleFoodSearch(new Request('https://healthi.test/api/food-search?q=x'), {},ctx)).status).toBe(400);
    expect((await handleFoodSearch(new Request('https://healthi.test/api/food-search?q=bun', { headers: { Origin: 'https://elsewhere.test' } }), {},ctx)).status).toBe(403);
    expect((await handleFoodSearch(new Request('https://healthi.test/api/food-search?q=bun', { method: 'POST' }), {},ctx)).status).toBe(405);
  });
});
describe('food search client normalization and states', () => {
  const usda = { fdcId: 1234, description: 'Whole wheat bun', foodNutrients: [{ nutrientId: 1008, unitName: 'KCAL', value: 250 }, { nutrientId: 1093, unitName: 'MG', value: 380 }] };
  it('keeps USDA units, attribution, and absent values explicit', () => {
    expect(normalizeUsdaSearchFood(usda)).toMatchObject({ provider: 'usda_food_data_central', provider_product_id: '1234', barcode: '', image_url: null, serving_size: null, nutriments_per_100g: { calories: 250, sodium_mg: 380, fat_g: null } });
  });
  it('does not collapse distinct foods without barcodes', () => {
    const rows = normalizeSearchPayload({ products: [], usdaFoods: [usda, { ...usda, fdcId: 5678, description: 'Hamburger bun' }] }, 'bun');
    expect(rows).toHaveLength(2);
  });
  it('skips malformed records without discarding good matches', () => {
    const rows = normalizeSearchPayload({ products: [null, { code: 123, product_name: 'Invalid' }, { ...product, brands: 'Example' }], usdaFoods: [{ description: 'Missing id' }] }, 'bun');
    expect(rows).toHaveLength(1);
  });
  it('calls the gateway without a custom CORS-preflight header and does not retry it', async () => {
    const fetcher = vi.fn(async() => response({ products: [{ ...product, brands: 'Example' }], usdaFoods: [] }));
    const result = await searchFoods('hamburger bun', { endpoint: '/api/food-search', fetcher });
    expect(result.status).toBe('found'); expect(fetcher).toHaveBeenCalledTimes(1);
    const calls = fetcher.mock.calls as unknown as [string, RequestInit][];
    expect(calls[0][0]).toContain('q=hamburger%20bun'); expect(calls[0][1].headers).toEqual({ Accept: 'application/json' });
  });
  it('distinguishes outages from no matches and reports partial results', async () => {
    expect((await searchFoods('empty', { endpoint: '/api/food-search', fetcher: vi.fn(async()=>response({ products: [], usdaFoods: [] })) })).status).toBe('empty');
    expect((await searchFoods('offline', { endpoint: '/api/food-search', fetcher: vi.fn(async()=>response({},503)) })).status).toBe('error');
    const result = await searchFoods('partial', { endpoint: '/api/food-search', fetcher: vi.fn(async()=>response({ products: [], usdaFoods: [usda], partial: true })) });
    expect(result.status).toBe('found'); expect(result.notice).toContain('One database');
  });
  it('cancels before sending and does not publish obsolete responses', async () => {
    const controller = new AbortController(); controller.abort(); const fetcher = vi.fn();
    expect((await searchFoods('canceled', { endpoint: '/api/food-search', signal: controller.signal, fetcher })).status).toBe('error');
    expect(fetcher).not.toHaveBeenCalled();
  });
});
