import { afterEach, describe, expect, it, vi } from 'vitest';

import { foodLoggingNutrition } from '../../../src/features/nutrition/foodLoggingNutrition';
import { buildEngineSearchUrl, catalogueBrand, engineWords, searchCatalogueEngine } from '../../../src/features/nutrition/productLookup/catalogueEngine';
import { searchFoods } from '../../../src/features/nutrition/productLookup/foodSearchClient';

const NO_LOCAL_LISTS = { restaurantRows: [], menuStat: { restaurants: [], foods: [] } };
const per100 = (kcal: number, protein: number, carbs: number, fat: number) => ({ 'energy-kcal_100g': kcal, proteins_100g: protein, carbohydrates_100g: carbs, fat_100g: fat });

/* Engine hits are shaped as the engine returned them on 1 October 2026: brands as a list, per-100 g nutrients only, no serving. */
const hit = (code: string, name: string, brands: string[], nutriments = per100(220, 3, 21, 14)) => ({ code, product_name: name, brands, nutriments, countries_tags: ['en:united-states'] });
const BREYERS_BUTTER_PECAN = hit('0077567254405', 'Butter Pecan Ice Cream', ['Breyers', 'Unilever'], per100(140, 2, 18, 6));
const BREYERS_TUB = hit('0077567201096', 'Ice Cream, Butter Pecan', ['Breyers', 'Unilever'], per100(224, 3, 21, 15));
const BREYERS_CHOCOLATE = hit('0077567306623', 'Breyers, ice cream, chocolate', ['Breyers', 'Unilever']);
const FRIENDLYS = hit('0029839007615', 'Premium Ice Cream, Butter Pecan', ["Friendly's"]);
const UNBRANDED = hit('0070253712524', 'Butter pecan ice cream, butter pecan', []);
const BISCUIT = hit('3850116007328', 'Lino lada duo', ['Ledo']);

type Route = (url: URL) => { status?: number; body?: unknown };
function catalogue(route: Route) {
  const urls: URL[] = [];
  const fetcher = (async (input: string) => {
    const url = new URL(input);
    urls.push(url);
    const { status = 200, body = {} } = route(url);
    return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  }) as unknown as typeof fetch;
  return { urls, fetcher };
}
const isEngine = (url: URL) => url.hostname === 'search.openfoodfacts.org';
const isLabels = (url: URL) => url.pathname === '/api/v2/search' && url.searchParams.has('code');
const isProductRead = (url: URL) => url.pathname.startsWith('/api/v2/product/');
const isKeyword = (url: URL) => url.pathname === '/cgi/search.pl';
const insideBrand = (url: URL) => isEngine(url) && (url.searchParams.get('q') ?? '').startsWith('brands:');

describe('what the engine is asked', () => {
  it('sends plain words, never query syntax', () => {
    expect(engineWords("Breyer's Butter-Pecan & ice cream")).toEqual(['breyers', 'butter', 'pecan', 'ice', 'cream']);
    expect(engineWords('brands:"x" OR * (cola)')).toEqual(['brands', 'x', 'cola']);
    expect(engineWords('mac and cheese with the works')).toEqual(['mac', 'cheese', 'works']);
  });

  it('names the brand and the country as fields beside the words', () => {
    const q = new URL(buildEngineSearchUrl(['butter', 'pecan'], { brand: 'Breyers', countryTag: 'united-states' })).searchParams.get('q');
    expect(q).toBe('brands:"breyers" AND butter AND pecan AND countries_tags:"en:united-states"');
    expect(new URL(buildEngineSearchUrl(['cola'], { brand: 'Ben "&" Jerry\\s' })).searchParams.get('q')).toBe('brands:"ben & jerry s" AND cola');
    expect(new URL(buildEngineSearchUrl(['oats'])).searchParams.get('q')).toBe('oats');
  });
});

describe('reading the brand off the answers', () => {
  it('finds the brand the search starts with, even when it is not in any product name', () => {
    expect(catalogueBrand('breyers butter pecan ice cream', [FRIENDLYS, UNBRANDED, BREYERS_CHOCOLATE])).toEqual({ brand: 'Breyers', rest: 'butter pecan ice cream' });
  });

  it('uses the spelling the catalogue uses most, apostrophes and all', () => {
    const answers = [hit('1', 'Mac', ["Annie's"]), hit('2', 'Shells', ["Annie's"]), hit('3', 'Bunnies', ['Annies'])];
    expect(catalogueBrand('annies mac and cheese', answers)).toEqual({ brand: "Annie's", rest: 'mac and cheese' });
    expect(catalogueBrand('ben and jerrys half baked', [hit('4', 'Half Baked', ['Ben & Jerry’s'])])?.brand).toBe('Ben & Jerry’s');
  });

  it('prefers the longest brand and needs it at the start, with words after it', () => {
    const answers = [hit('1', 'Bread', ['Dave’s']), hit('2', 'Good Seed', ["Dave's Killer Bread"])];
    expect(catalogueBrand('daves killer bread good seed', answers)?.brand).toBe("Dave's Killer Bread");
    expect(catalogueBrand('vanilla breyers', [BREYERS_CHOCOLATE])).toBeNull();
    expect(catalogueBrand('breyers', [BREYERS_CHOCOLATE])).toBeNull();
    expect(catalogueBrand('greek yogurt', [hit('5', 'Yogurt', ['Chobani'])])).toBeNull();
  });
});

describe('searching the engine', () => {
  const labels = { products: [
    { code: '0077567254405', product_name: 'Butter Pecan Ice Cream', brands: 'Breyers, Unilever', serving_size: '1/2 cup (63 g)', serving_quantity: 63, nutriments: per100(140, 2, 18, 6) }
  ] };

  it('puts the brand’s own products first, then the rest of the first answer', async () => {
    const { urls, fetcher } = catalogue((url) => isLabels(url) ? { body: labels }
      : insideBrand(url) ? { body: { hits: [BREYERS_BUTTER_PECAN, BREYERS_TUB, BREYERS_CHOCOLATE] } }
        : { body: { hits: [BISCUIT, FRIENDLYS, UNBRANDED, BREYERS_CHOCOLATE] } });
    const result = await searchCatalogueEngine('breyers butter pecan ice cream', { fetcher: fetcher as never, countryTag: 'united-states' });
    expect(result.status).toBe('found');
    expect(result.products.slice(0, 2).map((p) => p.name).sort()).toEqual(['Butter Pecan Ice Cream', 'Ice Cream, Butter Pecan']);
    expect(result.products[0].brand).toBe('Breyers');
    expect(result.products.map((p) => p.name)).toContain('Premium Ice Cream, Butter Pecan');
    expect(urls.filter((url) => !isProductRead(url)).map((url) => isLabels(url) ? 'labels' : insideBrand(url) ? 'inside brand' : 'words')).toEqual(['words', 'inside brand', 'labels']);
    expect(urls[0].searchParams.get('q')).toBe('breyers AND butter AND pecan AND ice AND cream AND countries_tags:"en:united-states"');
  });

  it('fills in the label serving from the full record, and still logs per 100 g without it', async () => {
    const answer = { hits: [BREYERS_BUTTER_PECAN] };
    const filled = await searchCatalogueEngine('breyers butter pecan', { fetcher: catalogue((url) => isLabels(url) ? { body: labels } : { body: answer }).fetcher as never });
    expect(foodLoggingNutrition(filled.products[0]).basis).toBe('serving');
    expect(filled.products[0].serving_size).toBe('1/2 cup (63 g)');
    const bare = await searchCatalogueEngine('breyers butter pecan', { fetcher: catalogue((url) => isLabels(url) ? { status: 503, body: 'busy' } : { body: answer }).fetcher as never });
    expect(bare.status).toBe('found');
    expect(foodLoggingNutrition(bare.products[0]).basis).toBe('per_100g');
  });

  it('reads the leading matches one by one when the bulk label request is turned away', async () => {
    const tubLabel = { product: { code: '0077567201096', product_name: 'Ice Cream, Butter Pecan', brands: 'Breyers, Unilever', serving_size: '67 g (0.5 cup)', serving_quantity: 67, nutriments: per100(224, 3, 21, 15) } };
    const { urls, fetcher } = catalogue((url) => isLabels(url) ? { status: 503, body: 'busy' }
      : isProductRead(url) ? (url.pathname.includes('0077567201096') ? { body: tubLabel } : { status: 404, body: { status: 0 } })
        : insideBrand(url) ? { body: { hits: [BREYERS_TUB, BREYERS_CHOCOLATE] } } : { body: { hits: [FRIENDLYS, UNBRANDED, BREYERS_CHOCOLATE, BISCUIT, hit('1', 'Spare', ['X'])] } });
    const result = await searchCatalogueEngine('breyers butter pecan ice cream', { fetcher: fetcher as never });
    expect(result.products[0].name).toBe('Ice Cream, Butter Pecan');
    expect(foodLoggingNutrition(result.products[0]).basis).toBe('serving');
    expect(urls.filter(isProductRead)).toHaveLength(4);
  });

  it('asks every country when nothing is tagged as sold here', async () => {
    const { urls, fetcher } = catalogue((url) => isLabels(url) ? { body: { products: [] } }
      : (url.searchParams.get('q') ?? '').includes('countries_tags') ? { body: { hits: [] } } : { body: { hits: [FRIENDLYS] } });
    const result = await searchCatalogueEngine('butter pecan', { fetcher: fetcher as never, countryTag: 'united-states' });
    expect(result.status).toBe('found');
    expect(urls.filter(isEngine).map((url) => url.searchParams.get('q'))).toEqual(['butter AND pecan AND countries_tags:"en:united-states"', 'butter AND pecan']);
  });

  it('reports an outage as an error, not as nothing found', async () => {
    const result = await searchCatalogueEngine('breyers', { fetcher: catalogue(() => ({ status: 503, body: 'busy' })).fetcher as never });
    expect(result.status).toBe('error');
  });
});

describe('the app’s search on the phone', () => {
  it('answers from the engine without touching the keyword search', async () => {
    const { urls, fetcher } = catalogue((url) => isLabels(url) ? { body: { products: [] } }
      : insideBrand(url) ? { body: { hits: [BREYERS_BUTTER_PECAN] } } : { body: { hits: [FRIENDLYS, BREYERS_CHOCOLATE] } });
    const result = await searchFoods('breyers butter pecan ice cream', { fetcher, countryTag: 'united-states', ...NO_LOCAL_LISTS });
    expect(result.status).toBe('found');
    expect(result.products[0].name).toBe('Butter Pecan Ice Cream');
    expect(urls.some(isKeyword)).toBe(false);
  });

  it('falls back to the keyword search when the engine is unavailable', async () => {
    const keywordProduct = { code: '0077567201096', product_name: 'Ice Cream, Butter Pecan', brands: 'Breyers, Unilever', serving_size: '67 g', nutriments: per100(224, 3, 21, 15) };
    const { urls, fetcher } = catalogue((url) => isEngine(url) ? { status: 503, body: 'busy' } : { body: { products: [keywordProduct] } });
    const result = await searchFoods('breyers butter pecan ice cream', { fetcher, countryTag: 'united-states', ...NO_LOCAL_LISTS });
    expect(result.status).toBe('found');
    expect(result.products[0].brand).toBe('Breyers');
    expect(urls.filter(isKeyword)).toHaveLength(1);
  });

  it('says nothing matched, not that the database is down, when the engine found nothing and the fallback failed', async () => {
    const { fetcher } = catalogue((url) => isEngine(url) ? { body: { hits: [] } } : { status: 503, body: 'busy' });
    const result = await searchFoods('zzqx flavour', { fetcher, countryTag: null, ...NO_LOCAL_LISTS });
    expect(result.status).toBe('empty');
  });

  describe('a search address set for the web build', () => {
    afterEach(() => { vi.unstubAllEnvs(); });
    const engineOnly = () => catalogue((url) => isLabels(url) ? { body: { products: [] } } : isEngine(url) ? { body: { hits: [BREYERS_BUTTER_PECAN] } } : { status: 503, body: 'busy' });

    it('is ignored on a phone when it is a same-origin path, which a phone cannot reach', async () => {
      vi.stubEnv('EXPO_PUBLIC_FOOD_SEARCH_URL', '/api/food-search');
      const { urls, fetcher } = engineOnly();
      const result = await searchFoods('breyers butter pecan', { fetcher, countryTag: 'united-states', ...NO_LOCAL_LISTS });
      expect(urls[0].hostname).toBe('search.openfoodfacts.org');
      expect(result.status).toBe('found');
    });

    it('is used when it is a full address', async () => {
      vi.stubEnv('EXPO_PUBLIC_FOOD_SEARCH_URL', 'https://search.example.test/api/food-search');
      const { urls, fetcher } = engineOnly();
      await searchFoods('breyers butter pecan', { fetcher, countryTag: 'united-states', ...NO_LOCAL_LISTS });
      expect(urls[0].hostname).toBe('search.example.test');
    });
  });

  it('asks the engine for a store’s house brand by name, and still says which brand', async () => {
    const kirkland = hit('0096619000000', 'Organic Creamy Almond Butter', ['Kirkland Signature'], per100(600, 21, 21, 53));
    const { urls, fetcher } = catalogue((url) => isLabels(url) ? { body: { products: [] } } : { body: { hits: [kirkland] } });
    const result = await searchFoods('costco almond butter', { fetcher, countryTag: 'united-states', ...NO_LOCAL_LISTS });
    expect(result.status).toBe('found');
    expect(result.notice).toMatch(/Kirkland Signature, Costco’s own brand/);
    expect(urls[0].searchParams.get('q')).toBe('kirkland AND signature AND almond AND butter AND countries_tags:"en:united-states"');
    expect(urls.filter(insideBrand)[0]?.searchParams.get('q')).toBe('brands:"kirkland signature" AND almond AND butter AND countries_tags:"en:united-states"');
  });
});
