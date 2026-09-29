import { describe, expect, it } from 'vitest';

import { searchFoods } from '../../../src/features/nutrition/productLookup/foodSearchClient';
import { buildFoodSearchUrl } from '../../../src/features/nutrition/productLookup/openFoodFactsClient';
import { deviceCountryTag, findStoreBrand, storeBrandNotice, storeBrandText } from '../../../src/features/nutrition/productLookup/storeBrands';

describe('store names and house brands', () => {
  it('reads a store as the brand on its shelves, and keeps what else was asked for', () => {
    const costco = findStoreBrand('costco almond butter');
    expect(costco).toMatchObject({ rest: 'almond butter', typedStore: 'Costco' });
    expect(costco?.store.tag).toBe('kirkland-signature');
    expect(storeBrandText(costco!)).toBe('Kirkland Signature almond butter');
    expect(storeBrandNotice(costco!)).toMatch(/Kirkland Signature, Costco’s own brand/);
  });

  it('knows a brand typed directly and does not announce it', () => {
    const tj = findStoreBrand("trader joe's mandarin orange chicken");
    expect(tj).toMatchObject({ rest: 'mandarin orange chicken', typedStore: null });
    expect(tj?.store.tag).toBe('trader-joe-s');
    expect(storeBrandNotice(tj!)).toBeUndefined();
    expect(findStoreBrand('walmart frozen pizza')?.store.tag).toBe('great-value');
    expect(findStoreBrand('h-e-b tortillas')?.store.tag).toBe('h-e-b');
    expect(findStoreBrand('good & gather granola')?.store.tag).toBe('good-gather');
  });

  it('prefers the longest store name and needs whole words', () => {
    expect(findStoreBrand('whole foods market granola')).toMatchObject({ rest: 'granola' });
    expect(findStoreBrand('kirklandish bars')).toBeNull();
  });

  it('leaves foods that share a word with a store alone', () => {
    expect(findStoreBrand('brussels sprouts')).toBeNull();
    expect(findStoreBrand('bean sprouts')).toBeNull();
    expect(findStoreBrand('greek yogurt')).toBeNull();
  });
});

describe('the device country', () => {
  it('maps a locale region to a catalogue country, and nothing else', () => {
    expect(deviceCountryTag('en-US')).toBe('united-states');
    expect(deviceCountryTag('en-GB')).toBe('united-kingdom');
    expect(deviceCountryTag('en-US-u-ca-gregory')).toBe('united-states');
    expect(deviceCountryTag('en')).toBeNull();
    expect(deviceCountryTag('zh-Hant-TW')).toBeNull();
  });
});

describe('search URLs and fallbacks', () => {
  it('puts brand and country filters beside the words', () => {
    const url = buildFoodSearchUrl('almond butter', 'en', { brandTag: 'kirkland-signature', countryTag: 'united-states' });
    expect(url).toContain('search_terms=almond%20butter&');
    expect(url).toContain('&tagtype_0=brands&tag_contains_0=contains&tag_0=kirkland-signature');
    expect(url).toContain('&tagtype_1=countries&tag_contains_1=contains&tag_1=united-states');
    expect(buildFoodSearchUrl('oats')).not.toContain('tagtype_');
  });

  const almondButter = { code: '0096619000000', product_name: 'Organic Creamy Almond Butter', brands: 'Kirkland Signature', serving_size: '2 tbsp (32 g)', nutriments: { 'energy-kcal_100g': 600, proteins_100g: 21, carbohydrates_100g: 21, fat_100g: 53 } };
  const offFetcher = (answer: (url: string) => unknown[]) => {
    const urls: string[] = [];
    const fetcher = async (url: string | URL | Request) => {
      urls.push(String(url));
      return new Response(JSON.stringify({ products: answer(String(url)) }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    };
    return { urls, fetcher: fetcher as typeof fetch };
  };

  it('searches a store as its brand in the device country, and says which brand', async () => {
    const { urls, fetcher } = offFetcher(() => [almondButter]);
    const result = await searchFoods('costco almond butter', { fetcher, countryTag: 'united-states', restaurantRows: [] });
    expect(urls).toHaveLength(1);
    expect(urls[0]).toContain('tag_0=kirkland-signature');
    expect(urls[0]).toContain('tag_1=united-states');
    expect(urls[0]).toContain('search_terms=almond%20butter&');
    expect(result.status).toBe('found');
    expect(result.notice).toMatch(/Costco’s own brand/);
  });

  it('falls back to the brand as words when the brand filter finds nothing', async () => {
    const { urls, fetcher } = offFetcher(url => url.includes('tagtype_0=brands') ? [] : [almondButter]);
    const result = await searchFoods('costco almond butter', { fetcher, countryTag: 'united-states', restaurantRows: [] });
    expect(urls).toHaveLength(2);
    expect(urls[1]).toContain('search_terms=Kirkland%20Signature%20almond%20butter&');
    expect(urls[1]).not.toContain('tagtype_');
    expect(result.status).toBe('found');
  });

  it('searches the device country first and every country only if that is empty', async () => {
    const { urls, fetcher } = offFetcher(url => url.includes('tagtype_0=countries') ? [] : [almondButter]);
    const result = await searchFoods('almond butter', { fetcher, countryTag: 'united-states', restaurantRows: [] });
    expect(urls).toHaveLength(2);
    expect(urls[0]).toContain('tag_0=united-states');
    expect(urls[1]).not.toContain('tagtype_');
    expect(result.status).toBe('found');
  });

  it('searches every country when the region is unknown', async () => {
    const { urls, fetcher } = offFetcher(() => [almondButter]);
    await searchFoods('almond butter', { fetcher, countryTag: null, restaurantRows: [] });
    expect(urls).toHaveLength(1);
    expect(urls[0]).not.toContain('tagtype_');
  });

  it('sends the brand words to the server search, which has no brand filter', async () => {
    const { urls, fetcher } = offFetcher(() => []);
    await searchFoods('costco almond butter', { endpoint: '/api/food-search', fetcher, restaurantRows: [] });
    expect(urls[0]).toBe('/api/food-search?q=Kirkland%20Signature%20almond%20butter');
  });
});
