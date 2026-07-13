import { describe, expect, it, vi } from 'vitest';

import { validateBarcode } from '../../../src/features/nutrition/productLookup/barcodeUtils';
import { normalizeOpenFoodFactsProduct } from '../../../src/features/nutrition/productLookup/normalizeProduct';
import { lookupOpenFoodFactsProduct, searchOpenFoodFactsProducts } from '../../../src/features/nutrition/productLookup/openFoodFactsClient';
import { calculateProductQuality } from '../../../src/features/nutrition/productLookup/productQuality';

const completeProduct = {
  code: '3017620422003',
  product_name: 'Hazelnut spread',
  brands: 'Example Brand',
  serving_size: '30 g',
  serving_quantity: 30,
  ingredients_text: 'Sugar, hazelnuts, cocoa, milk',
  nova_group: 4,
  additives_n: 1,
  nutriments: {
    'energy-kcal_100g': 540,
    proteins_100g: 6.3,
    carbohydrates_100g: 57.5,
    fat_100g: 30.9,
    'saturated-fat_100g': 10.6,
    fiber_100g: 3.4,
    sugars_100g: 56.3,
    sodium_100g: 0.043
  }
};

describe('product lookup and quality', () => {
  it('normalizes an Open Food Facts response into a Healthi product snapshot', () => {
    const product = normalizeOpenFoodFactsProduct('3017620422003', completeProduct);

    expect(product).toMatchObject({
      barcode: '3017620422003',
      provider: 'open_food_facts',
      name: 'Hazelnut spread',
      brand: 'Example Brand',
      serving_quantity_g: 30,
      calories_per_serving: 162,
      protein_g: 1.9,
      sugar_g: 16.9,
      sodium_mg: 12.9
    });
    expect(product?.quality_flags).toContain('ultra_processed_indicator');
    expect(product?.reason_codes).toContain('product_label_data');
  });

  it('returns a safe not-found result', async () => {
    const fetcher = vi.fn(async () => ({ ok: true, json: async () => ({ status: 0 }) }));
    const result = await lookupOpenFoodFactsProduct('3017620422003', { fetcher });

    expect(result).toEqual({
      status: 'not_found',
      barcode: '3017620422003',
      message: 'No product was found for this barcode. You can still log it manually.'
    });
  });

  it('normalizes searchable product results and handles short searches safely', async () => {
    const fetcher = vi.fn(async () => ({ ok: true, json: async () => ({ products: [completeProduct] }) }));
    const result = await searchOpenFoodFactsProducts('hazelnut', { fetcher });

    expect(result).toMatchObject({ status: 'found', products: [{ name: 'Hazelnut spread', barcode: '3017620422003' }] });
    await expect(searchOpenFoodFactsProducts('h', { fetcher })).resolves.toEqual({
      status: 'empty',
      products: [],
      message: 'Enter at least two letters to search foods.'
    });
  });

  it('lowers confidence for incomplete nutrition data', () => {
    const product = normalizeOpenFoodFactsProduct('12345678', {
      product_name: 'Sparse product',
      nutriments: { proteins_100g: 5 }
    });

    expect(product?.confidence).toBe('low');
    expect(product?.serving_size).toBe('100 g reference');
    expect(product?.serving_quantity_g).toBe(100);
    expect(product?.reason_codes).toEqual(expect.arrayContaining(['partial_nutrition_data', 'nutrition_calibrating']));
    expect(calculateProductQuality(product!)).toMatchObject({ score: null, label: 'calibrating', confidence: 'low' });
  });

  it('returns explainable supportive, steady, and watch labels', () => {
    const base = normalizeOpenFoodFactsProduct('12345678', {
      product_name: 'Base product',
      serving_size: '100 g',
      ingredients_text: 'Oats, seeds, berries',
      nutriments: {
        'energy-kcal_serving': 260,
        proteins_serving: 18,
        carbohydrates_serving: 32,
        fat_serving: 8,
        fiber_serving: 8,
        sugars_serving: 4,
        sodium_serving: 0.15
      }
    })!;
    const supportive = calculateProductQuality(base);
    const steady = calculateProductQuality({ ...base, protein_g: 9, fiber_g: 3 });
    const watch = calculateProductQuality({
      ...base,
      protein_g: 2,
      fiber_g: 1,
      sugar_g: 24,
      sodium_mg: 850,
      saturated_fat_g: 8,
      quality_flags: ['ultra_processed_indicator']
    });

    expect(supportive.label).toBe('supportive');
    expect(steady.label).toBe('steady');
    expect(watch.label).toBe('watch');
  });

  it('rejects empty and malformed manual barcodes safely', () => {
    expect(validateBarcode('')).toMatchObject({ valid: false });
    expect(validateBarcode('12AB-45')).toMatchObject({ valid: false });
    expect(validateBarcode('1234567')).toMatchObject({ valid: false });
    expect(validateBarcode(' 3017 6204 22003 ')).toEqual({ valid: true, barcode: '3017620422003' });
  });

  it('keeps product quality copy clear of blocked language', () => {
    const product = normalizeOpenFoodFactsProduct('3017620422003', completeProduct)!;
    const output = JSON.stringify(calculateProductQuality(product)).toLowerCase();
    const blockedTerms = [
      'diag' + 'nosis', 'diag' + 'nose', 'treat' + 'ment', 'c' + 'ure', 'pre' + 'scribe',
      'ad' + 'renal', 'h' + 'pa', 'cor' + 'tisol', 'hor' + 'mone', 'clin' + 'ical',
      'de' + 'tox', 'tox' + 'ic', 'clean' + 'se', 'cheat ' + 'meal', 'guilt-' + 'free',
      'bad ' + 'food', 'metabolic ' + 'type', 'scout ' + 'score', 'bobby ' + 'approved'
    ];

    for (const term of blockedTerms) expect(output).not.toContain(term);
  });
});
