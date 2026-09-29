import { describe, expect, it, vi } from 'vitest';

// A build script, deliberately plain JS and outside the app's module graph.
import { buildRows, parseCsvLine, portionLabel } from '../../../scripts/build-restaurant-foods.mjs';
import { matchRestaurantFoods, prettyRestaurantName, restaurantBrand } from '../../../src/features/nutrition/productLookup/bundledRestaurantFoods';
import { bundledRestaurantMatches, searchFoods } from '../../../src/features/nutrition/productLookup/foodSearchClient';
import { RESTAURANT_FOODS } from '../../../src/features/nutrition/productLookup/generatedRestaurantFoods';
import { BUNDLED_RESTAURANT_DATA_TYPE, type RestaurantFoodRow } from '../../../src/features/nutrition/productLookup/restaurantFoodTypes';
import { foodSearchPortionDetail } from '../../../src/features/nutrition/foodLoggingNutrition';

const NO_MENUSTAT = { restaurants: [], foods: [] };

/*
 * Fixture rows in the generated shape. The numbers are test values chosen to be easy to
 * check, not USDA's measurements.
 */
const ROWS: RestaurantFoodRow[] = [
  [1001, "McDONALD'S, BIG MAC", 'Fast Foods', 250, 12, 20, 13, 1.5, 4, 4.5, 450, [['1 sandwich', 200]]],
  [1002, 'BURGER KING, WHOPPER, no cheese', 'Fast Foods', 230, 11, 18, 12, null, null, null, null, [['1 item', 270]]],
  [1003, 'Fast foods, hamburger; single, regular patty; plain', 'Fast Foods', 260, 13, 30, 10, 1, 5, 4, 480, []],
  [1004, 'CHICK-FIL-A, chicken sandwich', 'Fast Foods', 240, 15, 25, 9, 1, 3, 2, 600, [['1 sandwich', 180]]],
  [1005, 'PIZZA HUT 14" Pepperoni Pizza, Pan Crust', 'Fast Foods', 280, 12, 28, 13, 2, 3, 5, 600, [['1 slice', 110]]]
];

describe('restaurant names', () => {
  it('turns USDA capitals into readable names and leaves lower-case detail alone', () => {
    expect(prettyRestaurantName("McDONALD'S, BIG MAC")).toBe("McDonald's, Big Mac");
    expect(prettyRestaurantName('BURGER KING, WHOPPER, no cheese')).toBe('Burger King, Whopper, no cheese');
    expect(prettyRestaurantName('CHICK-FIL-A, chicken sandwich')).toBe('Chick-fil-A, chicken sandwich');
    expect(prettyRestaurantName("WEND'YS, Crispy Chicken Sandwich")).toBe("Wendy's, Crispy Chicken Sandwich");
    expect(prettyRestaurantName("KFC, Fried Chicken, ORIGINAL RECIPE")).toBe('KFC, Fried Chicken, Original Recipe');
    expect(prettyRestaurantName("T.G.I. FRIDAY'S, chicken fingers")).toBe("T.G.I. Friday's, chicken fingers");
  });

  it('reads the chain only from a capitalised lead segment', () => {
    expect(restaurantBrand("McDONALD'S, BIG MAC")).toEqual({ brand: "McDonald's", dish: 'BIG MAC' });
    expect(restaurantBrand('Fast foods, hamburger; single, regular patty; plain').brand).toBeNull();
    expect(restaurantBrand('Restaurant, Chinese, fried rice').brand).toBeNull();
  });
});

describe('matching the built-in list', () => {
  const names = (query: string) => matchRestaurantFoods(query, ROWS).map(row => row.description);

  it('finds a chain dish by chain, by dish, and by the spelling people type', () => {
    expect(names('big mac')).toEqual(['Big Mac']);
    expect(names('mcdonalds big mac')).toEqual(['Big Mac']);
    expect(names('big macs')).toEqual(['Big Mac']);
    expect(names('whopper from burger king')).toEqual(['Whopper, no cheese']);
  });

  it('needs every meaningful word, so a pizza query does not bring back burgers', () => {
    expect(names('pepperoni pizza')).toEqual(['Pizza Hut 14" Pepperoni Pizza, Pan Crust']);
    expect(names('big mac pizza')).toEqual([]);
    // A shared prefix ranks a near miss but does not let it in.
    expect(names('pancakes')).toEqual([]);
    expect(names('chick fil a')).toEqual(['Chicken sandwich']);
    expect(names('x')).toEqual([]);
  });

  it('logs like any USDA food: serving weight, per-100 g nutrients, unreported stays unreported', () => {
    const [mac] = bundledRestaurantMatches('big mac', ROWS);
    expect(mac).toMatchObject({ provider: 'usda_food_data_central', provider_product_id: '1001', name: 'Big Mac', brand: "McDonald's", serving_size: '1 sandwich (200 g)', serving_quantity_g: 200, food_data_type: BUNDLED_RESTAURANT_DATA_TYPE });
    expect(mac.nutriments_per_100g).toMatchObject({ calories: 250, protein_g: 12, carbs_g: 20, fat_g: 13, sodium_mg: 450 });
    const [whopper] = bundledRestaurantMatches('whopper', ROWS);
    expect(whopper.nutriments_per_100g).toMatchObject({ fiber_g: null, sugar_g: null, sodium_mg: null });
  });

  it('says where the row came from and when', () => {
    const [mac] = bundledRestaurantMatches('big mac', ROWS);
    expect(foodSearchPortionDetail(mac)).toContain('USDA restaurant data, 2018');
    expect(foodSearchPortionDetail(mac)).toContain("McDonald's");
  });

  it('ships rows in the generated shape', () => {
    for (const row of RESTAURANT_FOODS) {
      expect(row).toHaveLength(12);
      expect(typeof row[3]).toBe('number');
      for (const [label, grams] of row[11]) { expect(label.length).toBeGreaterThan(0); expect(grams).toBeGreaterThan(0); }
    }
  });
});

describe('search with the built-in list', () => {
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

  it('adds matching dishes to the catalogue results', async () => {
    const fetcher = vi.fn(async () => json({ products: [], usdaFoods: [] }));
    const result = await searchFoods('big mac', { endpoint: '/api/food-search', fetcher: fetcher as unknown as typeof fetch, restaurantRows: ROWS, menuStat: NO_MENUSTAT });
    expect(result.status).toBe('found');
    expect(result.products.map(p => p.name)).toEqual(['Big Mac']);
  });

  it('still answers from the built-in list when the catalogue is down, and says so', async () => {
    const fetcher = vi.fn(async () => json({}, 503));
    const result = await searchFoods('chicken sandwich', { endpoint: '/api/food-search', fetcher: fetcher as unknown as typeof fetch, restaurantRows: ROWS, menuStat: NO_MENUSTAT });
    expect(result.status).toBe('found');
    expect(result.products[0].brand).toBe('Chick-fil-A');
    expect(result.notice).toMatch(/built into the app/);
  });

  it('merges into the phone path, which searches Open Food Facts directly', async () => {
    const fetcher = vi.fn(async () => json({ products: [] }));
    const result = await searchFoods('whopper', { fetcher: fetcher as unknown as typeof fetch, restaurantRows: ROWS, menuStat: NO_MENUSTAT });
    expect(fetcher).toHaveBeenCalled();
    expect(result.products.map(p => p.name)).toEqual(['Whopper, no cheese']);
  });

  it('changes nothing when no built-in dish matches', async () => {
    const fetcher = vi.fn(async () => json({ products: [], usdaFoods: [] }));
    const result = await searchFoods('greek yogurt', { endpoint: '/api/food-search', fetcher: fetcher as unknown as typeof fetch, restaurantRows: ROWS, menuStat: NO_MENUSTAT });
    expect(result.status).toBe('empty');
  });
});

describe('the generator', () => {
  it('parses quoted CSV fields with commas and doubled quotes', () => {
    expect(parseCsvLine('"1","McDONALD\'S, BIG MAC","21"')).toEqual(['1', "McDONALD'S, BIG MAC", '21']);
    expect(parseCsvLine('"2","PIZZA HUT 14"" Pizza",""')).toEqual(['2', 'PIZZA HUT 14" Pizza', '']);
  });

  it('labels a portion by its description, or by amount and modifier when the unit is undetermined', () => {
    expect(portionLabel({ portion_description: '1 serving (6 pieces)', amount: '1', modifier: '' }, 'undetermined')).toBe('1 serving (6 pieces)');
    expect(portionLabel({ portion_description: '', amount: '1', modifier: 'sandwich' }, 'undetermined')).toBe('1 sandwich');
    expect(portionLabel({ portion_description: '', amount: '1', modifier: '' }, 'cup')).toBe('1 cup');
  });

  it('keeps only fast-food and restaurant rows that report energy, with their portions in order', () => {
    const rows = buildRows({
      categories: [{ id: '21', description: 'Fast Foods' }, { id: '27', description: 'Restaurant Foods' }, { id: '9', description: 'Fruits and Fruit Juices' }],
      foods: [
        { fdc_id: '1', description: "McDONALD'S, BIG MAC", food_category_id: '21' },
        { fdc_id: '2', description: 'Restaurant, Chinese, fried rice', food_category_id: '27' },
        { fdc_id: '3', description: 'Apples, raw', food_category_id: '9' },
        { fdc_id: '4', description: 'Fast foods, no energy reported', food_category_id: '21' }
      ],
      nutrients: [
        { fdc_id: '1', nutrient_id: '1008', amount: '250' }, { fdc_id: '1', nutrient_id: '1003', amount: '12.004' },
        { fdc_id: '2', nutrient_id: '1008', amount: '160' }, { fdc_id: '3', nutrient_id: '1008', amount: '52' },
        { fdc_id: '4', nutrient_id: '1003', amount: '10' }
      ],
      portions: [
        { fdc_id: '1', seq_num: '2', amount: '1', measure_unit_id: '9999', portion_description: '', modifier: 'serving', gram_weight: '210' },
        { fdc_id: '1', seq_num: '1', amount: '1', measure_unit_id: '9999', portion_description: '', modifier: 'sandwich', gram_weight: '200' },
        { fdc_id: '2', seq_num: '1', amount: '1', measure_unit_id: '1000', portion_description: '', modifier: '', gram_weight: '137' }
      ],
      units: [{ id: '9999', name: 'undetermined' }, { id: '1000', name: 'cup' }]
    });
    expect(rows).toEqual([
      [1, "McDONALD'S, BIG MAC", 'Fast Foods', 250, 12, null, null, null, null, null, null, [['1 sandwich', 200], ['1 serving', 210]]],
      [2, 'Restaurant, Chinese, fried rice', 'Restaurant Foods', 160, null, null, null, null, null, null, null, [['1 cup', 137]]]
    ]);
  });
});
