import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { normalizeSearchPayload, normalizeUsdaSearchFood } from '../../../src/features/nutrition/productLookup/foodSearchClient';
import { foodLoggingNutrition, partitionFoodSearchResults, withFoodPortion } from '../../../src/features/nutrition/foodLoggingNutrition';
import { resolveSearchFoods } from '../../../src/features/nutrition/productLookup/searchFoodResolution';
import { searchCatalog } from '../../../src/server/foodSearch';
import { createEmptyMealBuilder, addMealBuilderItem, calculateMealBuilderTotals } from '../../../src/features/nutrition/mealBuilder';

const nutrients = [
  { nutrientId: 1008, unitName: 'KCAL', value: 250 },
  { nutrientId: 1003, unitName: 'G', value: 10 },
  { nutrientId: 1005, unitName: 'G', value: 30 },
  { nutrientId: 1004, unitName: 'G', value: 10 }
];
const usda = { fdcId: 100, description: 'Example food', dataType: 'Survey (FNDDS)', foodNutrients: nutrients };
const payload = (foods: unknown[], products: unknown[] = []) => ({ usdaFoods: foods, products });
const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });

describe('general catalog resolution', () => {
  it.each([
    ['cereal', '1 cup', 40], ['ground beef patty', '1 quarter lb patty', 85],
    ['bread', '1 slice', 35], ['milk', '1 cup', 244], ['yogurt', '1 container', 170],
    ['rice', '1 cup cooked', 158], ['peanut butter', '2 tbsp', 32], ['apple', '1 medium', 182]
  ])('uses reported household measures for %s', (name, label, grams) => {
    const p = normalizeUsdaSearchFood({ ...usda, description: name, foodMeasures: [{ disseminationText: label, gramWeight: grams }] })!;
    expect(p.serving_size).toBe(`${label} (${grams} g)`);
    expect(foodLoggingNutrition(p).nutrients.calories).toBe(250 * Number(grams) / 100);
    expect(partitionFoodSearchResults([p]).ready).toHaveLength(1);
  });
  it('supports full USDA nested nutrients and household portions', () => {
    const p = normalizeUsdaSearchFood({ ...usda, foodNutrients: nutrients.map(n => ({ nutrient: { id: n.nutrientId, unitName: n.unitName }, amount: n.value })), foodPortions: [{ amount: 1, modifier: 'patty', gramWeight: 85, measureUnit: { name: 'undetermined' } }] })!;
    expect(p.serving_size).toBe('1 patty (85 g)');
    expect(foodLoggingNutrition(p).nutrients.calories).toBe(212.5);
  });
  it('ignores quantity-not-specified portions and lets a user choose another real portion', () => {
    const p = normalizeUsdaSearchFood({ ...usda, foodMeasures: [
      { disseminationText: 'Quantity not specified', gramWeight: 100 },
      { disseminationText: '1 small patty', gramWeight: 60 }, { disseminationText: '1 large patty', gramWeight: 120 }
    ] })!;
    const before = JSON.stringify(p);
    const selected = withFoodPortion(p, p.food_portions![1]);
    const meal = addMealBuilderItem(createEmptyMealBuilder(), { snapshot: selected, source: 'search', servings: 2 });
    expect(calculateMealBuilderTotals(meal.items).calories).toBe(600);
    expect(JSON.stringify(p)).toBe(before);
    expect(withFoodPortion(p, { label: 'Invented', quantity: 900, unit: 'g' })).toBe(p);
  });
  it('keeps mL label portions in mL and never assigns grams', () => {
    const p = normalizeUsdaSearchFood({ ...usda, servingSize: 240, servingSizeUnit: 'mL', householdServingFullText: '1 cup' })!;
    expect(p.food_portions![0].unit).toBe('mL');
    expect(withFoodPortion(p, p.food_portions![0]).serving_quantity_g).toBeNull();
  });
  it('does not let one reported macro suppress derivable calories', () => {
    const p = normalizeUsdaSearchFood({ ...usda, servingSize: 40, servingSizeUnit: 'g' })!;
    p.protein_g = 4;
    expect(foodLoggingNutrition(p).nutrients).toMatchObject({ calories: 100, protein_g: 4, carbs_g: 12 });
  });
  it('ranks a complete relevant backup result before an empty exact-name match', () => {
    const rows = normalizeSearchPayload(payload([{ ...usda, description: 'Crisp cereal original', servingSize: 40, servingSizeUnit: 'g' }], [{ code: '12345678', product_name: 'Crisp cereal' }]), 'crisp cereal');
    expect(rows[0].provider).toBe('usda_food_data_central');
    expect(partitionFoodSearchResults(rows).incomplete).toHaveLength(1);
  });
  it('selects the complete exact-GTIN backup as a whole record, preserving only its matching photo', () => {
    const rows = normalizeSearchPayload(payload([{ ...usda, gtinUpc: '123456789012', servingSize: 40, servingSizeUnit: 'g' }], [{ code: '0123456789012', product_name: 'Example food', image_front_small_url: 'https://images.openfoodfacts.org/images/products/test.jpg' }]), 'example food');
    expect(rows).toHaveLength(1);
    expect(rows[0].provider).toBe('usda_food_data_central');
    expect(rows[0].image_url).toContain('images.openfoodfacts.org');
    expect(foodLoggingNutrition(rows[0]).nutrients.calories).toBe(100);
  });
  it('does not merge nutrition or photos merely because names match', () => {
    const a = normalizeUsdaSearchFood({ ...usda, gtinUpc: '123456789012' })!;
    const b = { ...a, barcode: '999999999999', image_url: 'https://example.test/photo.jpg', nutriments_per_100g: { calories: null } };
    const result = resolveSearchFoods([b, a], 'example food');
    expect(result).toHaveLength(2);
    expect(result[0].image_url).toBeNull();
    expect(foodLoggingNutrition(result[1]).nutrients.calories).toBeNull();
  });
  it('keeps exact food terms above an unrelated complete product', () => {
    const a = normalizeUsdaSearchFood({ ...usda, description: 'Plain yogurt' })!;
    const b = normalizeUsdaSearchFood({ ...usda, fdcId: 200, description: 'Strawberry candy', servingSize: 30, servingSizeUnit: 'g' })!;
    expect(resolveSearchFoods([b,a], 'plain yogurt')[0].name).toBe('Plain yogurt');
  });
  it('does not convert absent calories to zero or expose them as ready to log', () => {
    const p = normalizeUsdaSearchFood({ ...usda, foodNutrients: nutrients.slice(1) })!;
    expect(partitionFoodSearchResults([p]).ready).toHaveLength(0);
    expect(foodLoggingNutrition(p).nutrients.calories).toBeNull();
    const zero = normalizeUsdaSearchFood({ ...usda, foodNutrients: nutrients.map(n=>({...n,value:0})) })!;
    expect(partitionFoodSearchResults([zero]).ready).toHaveLength(1);
  });
  it('loads full nutrition, not only serving metadata, for an incomplete OFF index hit', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(response({ hits: [{ code: '12345678', product_name: 'Example' }] })).mockResolvedValueOnce(response({ products: [{ code: '12345678', product_name: 'Example', serving_size: '1 cup (40 g)', nutriments: { 'energy-kcal_100g': 400, proteins_100g: 8, carbohydrates_100g: 70, fat_100g: 10 } }] }));
    const r = await searchCatalog('example', {}, fetcher);
    const p = normalizeSearchPayload(r, 'example')[0];
    expect(foodLoggingNutrition(p).nutrients.calories).toBe(160);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('uses at most one batch of 20 exact USDA IDs, preserves useful search results on failure, and hides keys', async () => {
    const fetcher = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      if (String(url).endsWith('/foods/search')) return response({ foods: Array.from({ length:24 },(_,i)=>({...usda,fdcId:i+1})) });
      if (String(url).endsWith('/foods')) { expect(JSON.parse(init!.body as string).fdcIds).toHaveLength(20); return response({},503); }
      return response({ hits: [] });
    });
    const r = await searchCatalog('food', { USDA_API_KEY:'private-key' }, fetcher);
    expect(r.usdaFoods).toHaveLength(24);
    expect(r.servingDetailsIncomplete).toBe(true);
    expect(JSON.stringify(r)).not.toContain('private-key');
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
  it('merges USDA full details by FDC ID only', async () => {
    const fetcher = vi.fn(async (url: string | URL | Request) => String(url).endsWith('/foods/search') ? response({foods:[usda]}) : String(url).endsWith('/foods') ? response([{ ...usda, fdcId:999, foodPortions:[{amount:1,modifier:'cup',gramWeight:40}] }]) : response({ hits:[] }));
    const r = await searchCatalog('food', { USDA_API_KEY:'private-key' }, fetcher);
    expect(r.usdaFoods[0].foodPortions).toBeUndefined();
  });
});

// Optional, read-only smoke check of captured gateway payloads. Pass JSON [{query,path}].
it.runIf(!!process.env.HEALTHI_SEARCH_SMOKE_FILES)('checks real captured catalog results through app normalization', () => {
  const files = JSON.parse(process.env.HEALTHI_SEARCH_SMOKE_FILES!) as Array<{query:string;path:string}>;
  for (const file of files) {
    const data = JSON.parse(readFileSync(file.path,'utf8'));
    const rows = normalizeSearchPayload(data,file.query);
    const { ready,incomplete } = partitionFoodSearchResults(rows);
    process.stdout.write(JSON.stringify({query:file.query,ready:ready.length,incomplete:incomplete.length,partial:data.partial,detailsIncomplete:data.servingDetailsIncomplete,top:ready.slice(0,3).map(p=>({name:p.name,source:p.provider,label:foodLoggingNutrition(p).label,calories:foodLoggingNutrition(p).nutrients.calories}))}) + '\n');
    expect(ready.length, file.query).toBeGreaterThan(0);
    expect(ready.slice(0,3).every(p=>foodLoggingNutrition(p).nutrients.calories!==null)).toBe(true);
  }
});
