import { describe, expect, it } from 'vitest';

// A build script, deliberately plain JS and outside the app's module graph.
import { buildRows, csvRecords, servingMetric } from '../../../scripts/build-menustat-foods.mjs';
import { matchMenuStat, type MenuStatData } from '../../../src/features/nutrition/productLookup/menuStatFoods';
import { restaurantMatches } from '../../../src/features/nutrition/productLookup/foodSearchClient';
import { MENUSTAT_FOODS, MENUSTAT_RESTAURANTS } from '../../../src/features/nutrition/productLookup/generatedMenuStatFoods';
import { MENUSTAT_DATA_TYPE, type RestaurantFoodRow } from '../../../src/features/nutrition/productLookup/restaurantFoodTypes';
import { foodLoggingNutrition, foodSearchPortionDetail } from '../../../src/features/nutrition/foodLoggingNutrition';

/* Fixture rows in the generated shape; test values, not MenuStat's figures. */
const DATA: MenuStatData = {
  restaurants: ['Chipotle Mexican Grill', "McDonald's", 'Starbucks'],
  foods: [
    [1, 0, 'Chicken Burrito', '1 burrito', 450, 'g', 1000, 50, 110, 38, 14, 12, 5, 2200],
    [2, 0, 'Chips & Guacamole', null, null, null, 770, 10, 82, 47, 7, 15, 1, 580],
    [3, 1, 'Big Mac', '1 sandwich', 219, 'g', 540, 25, 45, 28, 10, 3, 9, 950],
    [4, 2, 'Caffe Latte, Grande', '16 fl oz', 473, 'mL', 190, 13, 19, 7, 4.5, 0, 17, 170],
    [5, 2, 'Pumpkin Spice Latte with Whipped Cream and Extra Shot, Venti', '20 fl oz', 591, 'mL', 470, 16, 64, 17, 11, 0, 61, 320]
  ]
};

describe('matching chain menus', () => {
  it('finds an item by chain and dish', () => {
    expect(matchMenuStat('chipotle burrito', DATA).map(p => p.name)).toEqual(['Chicken Burrito']);
    expect(matchMenuStat('chick fil a', { restaurants: ['Chick-Fil-A'], foods: [[7, 0, 'Nuggets', null, null, null, 260, 28, 11, 12, 2.5, 0, 1, 1210]] })[0].brand).toBe('Chick-fil-A');
    expect(matchMenuStat('mcdonalds big mac', DATA).map(p => p.name)).toEqual(['Big Mac']);
    expect(matchMenuStat('guacamole', DATA).map(p => p.name)).toEqual(['Chips & Guacamole']);
    expect(matchMenuStat('pizza', DATA)).toEqual([]);
  });

  it('puts the closest names first and caps a broad search', () => {
    expect(matchMenuStat('starbucks latte', DATA).map(p => p.name)).toEqual(['Caffe Latte, Grande', 'Pumpkin Spice Latte with Whipped Cream and Extra Shot, Venti']);
    expect(matchMenuStat('starbucks latte', DATA, 1)).toHaveLength(1);
  });

  it('logs one serving as the chain published it, and says where it came from', () => {
    const [burrito] = matchMenuStat('chicken burrito', DATA);
    expect(burrito).toMatchObject({ provider: 'manual', provider_product_id: 'menustat:1', brand: 'Chipotle Mexican Grill', food_data_type: MENUSTAT_DATA_TYPE, serving_quantity_g: 450 });
    const logging = foodLoggingNutrition(burrito);
    expect(logging.basis).toBe('serving');
    expect(logging.nutrients).toMatchObject({ calories: 1000, protein_g: 50, carbs_g: 110, fat_g: 38, sodium_mg: 2200 });
    expect(foodSearchPortionDetail(burrito)).toContain('Chain menu data (MenuStat), 2018');
    expect(foodSearchPortionDetail(burrito)).toContain('1 burrito (450 g)');
  });

  it('keeps a missing serving size missing, and drinks in millilitres', () => {
    const [chips] = matchMenuStat('guacamole', DATA);
    expect(chips.serving_quantity_g).toBeNull();
    expect(foodLoggingNutrition(chips).nutrients.calories).toBe(770);
    const [latte] = matchMenuStat('caffe latte', DATA);
    expect(latte).toMatchObject({ serving_quantity: 473, serving_unit: 'mL', serving_quantity_g: null });
  });

  it('shows a dish once when both built-in lists have it', async () => {
    const usda: RestaurantFoodRow[] = [[9001, "McDONALD'S, BIG MAC", 'Fast Foods', 257, 12, 20, 15, null, null, null, null, [['1 item', 219]]]];
    const found = await restaurantMatches('big mac', { restaurantRows: usda, menuStat: { ...DATA, foods: [[3, 1, 'Big Mac', null, null, null, 540, 25, 45, 28, 10, 3, 9, 950]] } });
    const macs = found.filter(p => p.name === 'Big Mac');
    expect(macs).toHaveLength(1);
    // The USDA row knows the sandwich weighs 219 g; the chain row did not report it.
    expect(macs[0].serving_quantity_g).toBe(219);
  });

  it('ships rows in the generated shape', () => {
    for (const row of MENUSTAT_FOODS) {
      expect(row).toHaveLength(14);
      expect(MENUSTAT_RESTAURANTS[row[1]]).toBeTruthy();
      expect(row[6]).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('the MenuStat generator', () => {
  const header = '"Menu_Item_ID","Restaurant","Item_Name","Item_Description","Serving_Size","Serving_Size_Unit","Serving_Size_household","Calories","Protein","Carbohydrates","Total_Fat","Saturated_Fat","Dietary_Fiber","Sugar","Sodium"';

  it('reads records whose quoted text spans lines', () => {
    const records = [...csvRecords(`${header}\n"1","Qdoba","Taco","Soft taco,\nwith salsa","","","","170","8","16","7","3","2","1","400"\n`)];
    expect(records).toHaveLength(2);
    expect(records[1][3]).toBe('Soft taco,\nwith salsa');
  });

  it('converts servings to grams or millilitres, and refuses what it cannot read', () => {
    expect(servingMetric('219', 'g')).toEqual([219, 'g']);
    expect(servingMetric('16', 'fl oz')).toEqual([473, 'mL']);
    expect(servingMetric('4', 'oz')).toEqual([113, 'g']);
    expect(servingMetric('1', 'each')).toBeNull();
    expect(servingMetric('', 'g')).toBeNull();
  });

  it('keeps single calorie figures, drops ranges and repeats, and indexes chains', () => {
    const records = [...csvRecords([
      header,
      '"10","Qdoba","Burrito Bowl","Build your own","","","","340-1175","","","","","","",""',
      '"11","Qdoba","Chips","","85","g","1 bag","430","6","52","22","3","5","1","310"',
      '"12","Qdoba","Chips","again","85","g","1 bag","430","6","52","22","3","5","1","310"',
      '"13","Starbucks","Caffe Latte, Grande","","16","fl oz","","190","13","19","7","4.5","0","17","170"'
    ].join('\n'))];
    const built = buildRows(records);
    expect(built.restaurants).toEqual(['Qdoba', 'Starbucks']);
    expect(built.rows).toEqual([
      [11, 0, 'Chips', '1 bag', 85, 'g', 430, 6, 52, 22, 3, 5, 1, 310],
      [13, 1, 'Caffe Latte, Grande', '473 mL', 473, 'mL', 190, 13, 19, 7, 4.5, 0, 17, 170]
    ]);
  });

  it('fails loudly when a column it needs is missing', () => {
    expect(() => buildRows([...csvRecords('"Menu_Item_ID","Restaurant"\n"1","Qdoba"')])).toThrow(/column missing/);
  });
});
