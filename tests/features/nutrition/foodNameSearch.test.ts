import { describe, expect, it, vi } from 'vitest';
import { buildFoodSearchUrl, rankFoodSearchResults, searchOpenFoodFactsProducts } from '../../../src/features/nutrition/productLookup/openFoodFactsClient';
import { normalizeOpenFoodFactsProduct } from '../../../src/features/nutrition/productLookup/normalizeProduct';
import { ProviderRequestScheduler } from '../../../src/features/nutrition/productLookup/productRequestScheduler';

const product = { code: '12345678', product_name: 'Plain Greek yogurt', serving_size: '170 g', nutriments: { 'energy-kcal_100g': 60 } };
const response = (products: unknown[] = [product]) => ({ ok: true, status: 200, json: async () => ({ products }) });
describe('food name database search', () => {
  it('uses the actual keyword endpoint rather than the V2 filter endpoint', async () => {
    const fetcher = vi.fn(async (_url: string) => response());
    const result = await searchOpenFoodFactsProducts('Greek yogurt & oats', { fetcher });
    expect(result).toMatchObject({ status: 'found', products: [{ name: product.product_name, calories_per_serving: 102 }] });
    const url = new URL(fetcher.mock.calls[0][0]);
    expect(url.pathname).toBe('/cgi/search.pl');
    expect(url.searchParams.get('search_terms')).toBe('Greek yogurt & oats');
    expect(url.searchParams.get('search_simple')).toBe('1');
    expect(url.searchParams.get('json')).toBe('1');
    expect(url.searchParams.get('fields')).toContain('nutriments');
    expect(buildFoodSearchUrl(' oats ')).toContain('search_terms=oats&');
  });
  it('orders name and brand matches and deduplicates canonical barcode identities', () => {
    const p = (code: string, name: string, brand?: string) => normalizeOpenFoodFactsProduct(code, { product_name: name, brands: brand })!;
    const ranked = rankFoodSearchResults([p('123456789012', 'Mineral water'), p('0894700010137', 'Greek yogurt'), p('894700010137', 'Duplicate'), p('12345670', 'Plain yogurt', 'Greek dairy')], 'greek yogurt');
    expect(ranked.map(row => row.name)).toEqual(['Greek yogurt', 'Plain yogurt', 'Mineral water']);
  });
  it('keeps a real no-result response distinct from an unavailable provider', async () => {
    expect(await searchOpenFoodFactsProducts('unmatched food', { fetcher: async () => response([]) })).toMatchObject({ status: 'empty', products: [] });
    expect(await searchOpenFoodFactsProducts('food', { fetcher: async () => ({ ok: false, status: 403, json: async () => ({}) }) })).toMatchObject({ status: 'error', products: [] });
  });
  it('prefers exact food names to foods merely flavored with the search term', () => {
    const products = ['Yogurt with banana', 'Banana chips', 'Banana'].map((name, index) => normalizeOpenFoodFactsProduct(`1234567${index}`, { product_name: name })!);
    expect(rankFoodSearchResults(products, 'banana').map(row => row.name)).toEqual(['Banana', 'Banana chips', 'Yogurt with banana']);
  });
  it.each([408, 500, 503])('retries HTTP %i only once', async status => {
    const fetcher = vi.fn().mockResolvedValue({ ok: false, status, json: async () => ({}) });
    expect((await searchOpenFoodFactsProducts('food', { fetcher })).status).toBe('error');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('retries network failure once and can recover', async () => {
    const fetcher = vi.fn().mockRejectedValueOnce(new TypeError('Network')).mockResolvedValueOnce(response());
    expect((await searchOpenFoodFactsProducts('yogurt', { fetcher })).status).toBe('found');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it.each([400, 401, 403, 404])('does not retry permanent HTTP %i', async status => {
    const fetcher = vi.fn().mockResolvedValue({ ok: false, status, json: async () => ({}) });
    await searchOpenFoodFactsProducts('food', { fetcher });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('backs off rate-limited searches without automatically sending another request', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: false, status: 429, headers: { get: () => '120' }, json: async () => ({}) });
    const scheduler = new ProviderRequestScheduler({ minimumIntervalMs: 0 }); const defer = vi.spyOn(scheduler, 'defer');
    const result = await searchOpenFoodFactsProducts('food', { fetcher, scheduler });
    expect(result.status !== 'found' && result.message).toContain('busy');
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(defer).toHaveBeenCalledWith(60_000);
  });
  it('does not request a canceled queued search', async () => {
    const controller = new AbortController(); controller.abort(); const fetcher = vi.fn(async () => response());
    expect((await searchOpenFoodFactsProducts('food', { fetcher, signal: controller.signal })).status).toBe('error');
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('does not retry malformed JSON or publish malformed product lists', async () => {
    const fetcher = vi.fn(async () => ({ ok: true, json: async () => { throw new SyntaxError('Bad JSON'); } }));
    expect((await searchOpenFoodFactsProducts('food', { fetcher })).status).toBe('error');
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect((await searchOpenFoodFactsProducts('food', { fetcher: async () => ({ ok: true, json: async () => ({ products: {} }) }) })).status).toBe('error');
  });
  it('rejects empty and oversized queries without network work', async () => {
    const fetcher = vi.fn(async () => response());
    await searchOpenFoodFactsProducts(' ', { fetcher }); await searchOpenFoodFactsProducts('x'.repeat(121), { fetcher });
    expect(fetcher).not.toHaveBeenCalled();
  });
});
