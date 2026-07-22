import { describe, expect, it, vi } from 'vitest';

import { barcodeLookupCandidates, canonicalBarcodeIdentity, validateBarcode } from '../../../src/features/nutrition/productLookup/barcodeUtils';
import { normalizeOpenFoodFactsProduct } from '../../../src/features/nutrition/productLookup/normalizeProduct';
import { lookupOpenFoodFactsProduct, searchOpenFoodFactsProducts } from '../../../src/features/nutrition/productLookup/openFoodFactsClient';
import { calculateProductQuality } from '../../../src/features/nutrition/productLookup/productQuality';
import { resolveIngredientEvidence } from '../../../src/features/nutrition/productLookup/ingredientEvidenceResolver';

const completeProduct = {
  code: '3017620422003',
  product_name: 'Hazelnut spread',
  brands: 'Example Brand',
  serving_size: '30 g',
  serving_quantity: 30,
  ingredients_text: 'Sugar, hazelnuts, cocoa, milk',
  labels_tags: ['en:vegetarian'],
  categories_tags: ['en:chocolate-spreads'],
  packaging_tags: ['en:glass-jar'],
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
    expect(product?.categories_tags).toEqual(['chocolate spreads']);
    expect(product?.packaging_tags).toEqual(['glass jar']);
    expect(product?.nutriments_per_100g).toMatchObject({ sugar_g: 56.3, protein_g: 6.3, sodium_mg: 43 });
    expect(product?.quality_flags).toContain('ultra_processed_indicator');
    expect(product?.reason_codes).toContain('product_label_data');
  });

  it('uses direct sodium first, converts salt once, and ignores impossible nutrient values', () => {
    const fromSalt = normalizeOpenFoodFactsProduct('12345678', {
      product_name: 'Salt reference',
      serving_size: '5 g',
      nutriments: { salt_100g: 80, sodium_100g: -1 }
    });
    expect(fromSalt?.sodium_mg).toBe(1600);
    expect(fromSalt?.nutriments_per_100g?.sodium_mg).toBe(32000);
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

  it('retries a UPC-A barcode as its EAN-13 equivalent', async () => {
    const fetcher = vi.fn(async (url: string) => ({
      ok: true,
      json: async () => url.includes('/0123456789012.json') ? { status: 1, product: completeProduct } : { status: 0 }
    }));
    const result = await lookupOpenFoodFactsProduct('123456789012', { fetcher });

    expect(result).toMatchObject({ status: 'found', product: { barcode: '123456789012' } });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('uses one stable identity for UPC-A and zero-prefixed EAN/GTIN forms', () => {
    expect(canonicalBarcodeIdentity('123456789012')).toBe('123456789012');
    expect(canonicalBarcodeIdentity('0123456789012')).toBe('123456789012');
    expect(canonicalBarcodeIdentity('00123456789012')).toBe('123456789012');
    expect(barcodeLookupCandidates('0123456789012')).toEqual(expect.arrayContaining([
      '123456789012', '0123456789012', '00123456789012'
    ]));
  });

  it('sends an app identifier and abort signal with provider requests', async () => {
    const fetcher = vi.fn(async () => ({ ok: true, json: async () => ({ status: 1, product: completeProduct }) }));
    await lookupOpenFoodFactsProduct('3017620422003', { fetcher });

    expect(fetcher).toHaveBeenCalledWith(
      expect.stringContaining('/3017620422003.json'),
      expect.objectContaining({
        headers: expect.objectContaining({ Accept: 'application/json', 'X-User-Agent': 'Healthi/0.1' }),
        signal: expect.anything()
      })
    );
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
    expect(product?.serving_size).toBeNull();
    expect(product?.serving_quantity_g).toBeNull();
    expect(product?.protein_g).toBeNull();
    expect(product?.nutriments_per_100g?.protein_g).toBe(5);
    expect(product?.evidence_confidence?.serving).toBe('low');
    expect(product?.reason_codes).toEqual(expect.arrayContaining(['partial_nutrition_data', 'nutrition_calibrating']));
    expect(calculateProductQuality(product!)).toMatchObject({ score: null, label: 'calibrating', confidence: 'low' });
    expect(calculateProductQuality(product!)).toMatchObject({
      letter_grade: null,
      grade_band: 'calibrating',
      grade_label: 'More data needed',
      result_state: 'more_data_needed',
      nutrient_basis: { type: 'per_100g', source: 'fallback' }
    });
  });

  it('maps complete, partial, and unresolved evidence to calm public result states', () => {
    const finalProduct = normalizeOpenFoodFactsProduct('12345678', {
      product_name: 'Simple oat cereal', categories_tags: ['en:cereals'], ingredients_text_en: 'whole oats, cinnamon, sea salt',
      serving_size: '40 g', serving_quantity: 40,
      nutriments: { 'energy-kcal_serving': 150, proteins_serving: 5, fiber_serving: 4, sugars_serving: 1, sodium_serving: 0.12 }
    })!;
    const estimatedProduct = normalizeOpenFoodFactsProduct('12345679', {
      product_name: 'Oat cereal', categories_tags: ['en:cereals'],
      serving_size: '40 g', serving_quantity: 40,
      nutriments: { 'energy-kcal_serving': 150, proteins_serving: 8, fiber_serving: 5, sugars_serving: 2, sodium_serving: 0.12 }
    })!;
    const unresolvedProduct = normalizeOpenFoodFactsProduct('12345670', {
      product_name: 'Pantry product', nutriments: { 'energy-kcal_100g': 200 }
    })!;
    const final = calculateProductQuality(finalProduct);
    const estimated = calculateProductQuality(estimatedProduct);
    const unresolved = calculateProductQuality(unresolvedProduct);
    expect(final).toMatchObject({ result_state: 'final', score: expect.any(Number), letter_grade: expect.any(String) });
    expect(estimated).toMatchObject({ result_state: 'estimated', score: null, grade_label: 'Estimated grade' });
    expect(estimated.letter_grade).not.toBe('A');
    expect(estimated.estimated_grade_range).not.toBeNull();
    expect(estimated.missing_evidence).toContain('Complete package ingredient details are unavailable.');
    expect(unresolved).toMatchObject({ result_state: 'more_data_needed', score: null, letter_grade: null, grade_label: 'More data needed' });
    expect(JSON.stringify(unresolved)).not.toContain('Calibrating');
    expect(unresolved.considerations).toContain('There is not enough reliable category information to assign a grade yet.');
    expect(unresolved.considerations.join(' ').toLowerCase()).not.toMatch(/uses the overall label pattern|the score uses/);
  });

  it('resolves localized ingredient text without discarding alternate provider fields', () => {
    const requested = resolveIngredientEvidence({
      lang: 'fr',
      ingredients_text_es: 'avena, almendras, sal',
      ingredients_text_en: 'oats, almonds, salt',
      ingredients_text: 'avoine, amandes, sel'
    }, 'es');
    expect(requested).toMatchObject({
      resolved_text: 'avena, almendras, sal',
      source_field: 'ingredients_text_es',
      language: 'es',
      reconstructed: false
    });
    expect(requested.localized_texts).toEqual(expect.arrayContaining([
      { source_field: 'ingredients_text_es', language: 'es', text: 'avena, almendras, sal' },
      { source_field: 'ingredients_text_en', language: 'en', text: 'oats, almonds, salt' },
      { source_field: 'ingredients_text', language: 'fr', text: 'avoine, amandes, sel' }
    ]));
    expect(requested.conflicts).toEqual([]);
    expect(requested.confidence).toBe('high');

    const blankPreferred = resolveIngredientEvidence({ ingredients_text_en: ' ', ingredients_text_fr: 'avoine, sel' }, 'en');
    expect(blankPreferred).toMatchObject({ resolved_text: 'avoine, sel', source_field: 'ingredients_text_fr' });
  });

  it('uses structured ingredients only as a lower-confidence ordered fallback', () => {
    const evidence = resolveIngredientEvidence({
      lang: 'en',
      ingredients: [
        { id: 'en:oats', text: 'oats' },
        { id: 'en:nut-blend', text: 'nut blend', ingredients: [{ id: 'en:almonds', text: 'almonds' }, { id: 'en:cashews', text: 'cashews' }] }
      ]
    });
    expect(evidence).toMatchObject({
      resolved_text: 'oats, nut blend (almonds, cashews)',
      source_field: 'ingredients',
      status: 'reconstructed',
      confidence: 'medium',
      reconstructed: true
    });
    expect(evidence.structured_ingredients[1]).toMatchObject({ id: 'en:nut-blend', ingredients: [{ id: 'en:almonds' }, { id: 'en:cashews' }] });
  });

  it('prefers raw label text over structured reconstruction without treating translations as conflicts', () => {
    const evidence = resolveIngredientEvidence({
      lang: 'fr',
      ingredients_text_en: 'oats, almonds, salt',
      ingredients_text_fr: 'avoine, sucre, sel',
      ingredients: [{ id: 'en:oats', text: 'oats' }]
    });
    expect(evidence).toMatchObject({ raw_text: 'oats, almonds, salt', reconstructed: false, confidence: 'high' });
    expect(evidence.conflicts).toEqual([]);
  });

  it('flags materially different raw ingredient fields only when they represent the same language', () => {
    const evidence = resolveIngredientEvidence({
      lang: 'en',
      ingredients_text_en: 'oats, almonds, salt',
      ingredients_text: 'oats, sugar, salt'
    });
    expect(evidence.conflicts).toEqual(['Provider ingredient text fields for the same language materially disagree.']);
    expect(evidence.confidence).toBe('medium');
  });

  it('uses only ingredient-specific quality tags to classify a populated ingredient label', () => {
    for (const unrelatedTag of [
      'en:packaging-data-missing',
      'en:environmental-score-packaging-data-missing',
      'en:environmental-score-origins-of-ingredients-origins-are-100-percent-unknown',
      'en:nutrition-data-incomplete',
      'en:categories-missing'
    ]) {
      expect(resolveIngredientEvidence({
        ingredients_text_en: 'oats, almonds, salt',
        ingredients_n: 3,
        data_quality_tags: ['en:ingredients-en-completed', unrelatedTag]
      })).toMatchObject({ status: 'complete', confidence: 'high' });
    }

    expect(resolveIngredientEvidence({
      ingredients_text_en: 'oats, almonds, salt',
      data_quality_tags: ['en:ingredients-incomplete']
    })).toMatchObject({ status: 'partial', confidence: 'medium' });

    expect(resolveIngredientEvidence({
      data_quality_tags: ['en:packaging-data-missing']
    })).toMatchObject({ status: 'absent', confidence: 'low' });
  });

  it('keeps complete ingredient evidence usable without serving or nutrition data', () => {
    const product = normalizeOpenFoodFactsProduct('12345678', {
      product_name: 'Simple pantry food',
      categories_tags: ['en:snacks'],
      ingredients_text_en: 'whole oats, almonds, sea salt'
    });
    expect(product).toMatchObject({
      ingredients_text: 'whole oats, almonds, sea salt',
      serving_quantity_g: null,
      evidence_confidence: { ingredients: 'high', nutrition: 'low', serving: 'low' }
    });
  });

  it('returns explainable, serializable V2 quality output', () => {
    const base = normalizeOpenFoodFactsProduct('12345678', {
      product_name: 'Whole oat cereal',
      categories_tags: ['cereal'],
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
    const steady = calculateProductQuality({
      ...base,
      ingredients_text: 'Oats, cane sugar, seeds',
      categories_tags: ['cereal']
    });
    const watch = calculateProductQuality({
      ...base,
      ingredients_text: 'Corn, artificial colors, artificial flavor, sugar, maltodextrin',
      categories_tags: ['chips'],
      quality_flags: ['ultra_processed_indicator']
    });

    expect(supportive.label).toBe('supportive');
    expect(watch.label).toBe('watch');
    expect(supportive.score!).toBeGreaterThan(steady.score!);
    expect(steady.score!).toBeGreaterThan(watch.score!);
    expect(steady.category_comparison_available).toBe(false);
    expect(steady.category_score).toBeNull();
    expect(steady.source_confidence).toBeTruthy();
    expect(steady.interpretation_confidence).toBeTruthy();
    expect(steady.macro_context?.summary).toContain('do not automatically');
    expect(watch.factors?.length).toBeGreaterThan(0);
    expect(supportive.letter_grade).toBeTruthy();
    expect(steady.grade_label).toBeTruthy();
    expect(watch.better_options?.length).toBeGreaterThan(0);
    expect(watch.evidence_refs?.length).toBeGreaterThan(0);
    expect(steady.nutrient_basis).toMatchObject({ type: 'provider_serving', source: 'provided' });
    expect(JSON.parse(JSON.stringify(watch))).toEqual(watch);
  });

  it('does not leak legacy meal-level penalties into Scanner V2 output', () => {
    const product = normalizeOpenFoodFactsProduct('12345678', {
      product_name: 'Sea salt tortilla chips',
      categories_tags: ['chips'],
      serving_size: '28 g',
      ingredients_text: 'Corn, avocado oil, sea salt',
      nutriments: {
        'energy-kcal_serving': 260,
        proteins_serving: 2,
        carbohydrates_serving: 30,
        fat_serving: 8,
        fiber_serving: 1,
        sugars_serving: 0,
        sodium_serving: 0.18
      }
    })!;
    expect(product.reason_codes).toEqual(expect.arrayContaining(['protein_low', 'fiber_low']));
    const scannerReasons = calculateProductQuality(product).reason_codes;
    for (const legacyReason of ['protein_low', 'fiber_low', 'added_sugar_high', 'sodium_high', 'processing_level_high'] as const) {
      expect(scannerReasons).not.toContain(legacyReason);
    }
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

  it('keeps internal score mechanics out of user-facing product output', () => {
    const product = normalizeOpenFoodFactsProduct('12345678', {
      product_name: 'Organic almond milk',
      categories_tags: ['plant milks'],
      serving_size: '240 ml',
      ingredients_text: 'water, almonds, sea salt, organic, natural flavors',
      nutriments: {
        'energy-kcal_serving': 40,
        proteins_serving: 1,
        carbohydrates_serving: 1,
        fat_serving: 3,
        fiber_serving: 1,
        sugars_serving: 0,
        sodium_serving: 0.15
      }
    })!;
    const quality = calculateProductQuality(product);
    expect(quality).toMatchObject({ score: 89, letter_grade: 'B' });
    const output = JSON.stringify(quality).toLowerCase();
    for (const internalTerm of ['raw score', 'eligibility', 'dimensions', 'gate', 'ledger', 'policy']) {
      expect(output).not.toContain(internalTerm);
    }
  });
});
