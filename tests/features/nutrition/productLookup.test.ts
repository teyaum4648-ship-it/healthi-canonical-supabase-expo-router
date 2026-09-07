import { describe, expect, it, vi } from 'vitest';

import { barcodeLookupCandidates, canonicalBarcodeIdentity, validateBarcode } from '../../../src/features/nutrition/productLookup/barcodeUtils';
import { normalizeOpenFoodFactsProduct } from '../../../src/features/nutrition/productLookup/normalizeProduct';
import { lookupOpenFoodFactsProduct, searchOpenFoodFactsProducts } from '../../../src/features/nutrition/productLookup/openFoodFactsClient';
import { calculateProductQuality } from '../../../src/features/nutrition/productLookup/productQuality';
import { buildProductQualityScorePresentation } from '../../../src/features/nutrition/productLookup/productQualityPresentation';
import { resolveIngredientEvidence } from '../../../src/features/nutrition/productLookup/ingredientEvidenceResolver';
import { ProviderRequestScheduler } from '../../../src/features/nutrition/productLookup/productRequestScheduler';

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
  it('renders bounded Estimated and Provisional score presentations without hiding low-confidence scores', () => {
    const product = normalizeOpenFoodFactsProduct('12345678', {
      product_name: 'Whole oat cereal', categories_tags: ['cereal'], ingredients_text: 'oats, seeds',
      serving_size: '40 g', serving_quantity: 40,
      nutriments: { 'energy-kcal_serving': 160, proteins_serving: 6, fiber_serving: 4, sugars_serving: 2, sodium_serving: 0.1 }
    })!;
    const quality = calculateProductQuality(product);
    expect(quality.central_score).toEqual(expect.any(Number));
    const centralScore = quality.central_score!;
    for (const result_state of ['estimated', 'provisional'] as const) {
      const presentation = buildProductQualityScorePresentation({
        ...quality,
        result_state,
        score: centralScore,
        confidence: 'low',
        estimated_score_range: [Math.max(0, centralScore - 10), Math.min(100, centralScore + 10)],
        estimated_grade_range: ['B', 'C']
      });
      expect(presentation).toMatchObject({
        grade: expect.any(String),
        scoreLine: quality.score_scope === 'supported_evidence' ? `Supported-evidence score ${centralScore}` : `Score ${centralScore}`,
        stateLine: quality.grade_certainty?.state === 'stable' && result_state === 'estimated'
          ? 'Estimated'
          : 'Provisional',
        confidenceLine: 'Confidence: Low'
      });
      expect(presentation.rangeLine).toContain('Deterministic range');
    }
  });
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

  it('retries a transient provider failure once before returning a product', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ status: 1, product: completeProduct }) });
    const result = await lookupOpenFoodFactsProduct('3017620422003', { fetcher });

    expect(result).toMatchObject({ status: 'found', product: { name: 'Hazelnut spread' } });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[1]?.[0]).toBe(fetcher.mock.calls[0]?.[0]);
  });

  it('honors Retry-After through the shared scheduler and retries only once', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: { get: (name: string) => name.toLowerCase() === 'retry-after' ? '2' : null },
        json: async () => ({})
      })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ status: 1, product: completeProduct }) });
    let now = 0;
    const scheduler = new ProviderRequestScheduler({
      minimumIntervalMs: 0,
      now: () => now,
      sleep: async (milliseconds) => { now += milliseconds; }
    });
    const schedule = vi.spyOn(scheduler, 'schedule');
    const defer = vi.spyOn(scheduler, 'defer');

    await expect(lookupOpenFoodFactsProduct('3017620422003', { fetcher, scheduler }))
      .resolves.toMatchObject({ status: 'found' });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(schedule).toHaveBeenCalledTimes(2);
    expect(defer).toHaveBeenCalledWith(2_000);
  });

  it('does not retry a permanent provider rejection', async () => {
    const fetcher = vi.fn(async () => ({ ok: false, status: 403, json: async () => ({}) }));
    const result = await lookupOpenFoodFactsProduct('3017620422003', { fetcher });

    expect(result).toMatchObject({ status: 'error', code: 'provider_error' });
    expect(fetcher).toHaveBeenCalledTimes(1);
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

  it('normalizes described household servings when gram equivalents are available', () => {
    for (const [servingSize, servingQuantity] of [
      ['1 slice (45 g)', 45],
      ['2 bars (42 g)', 42],
      ['1 cup (245 g)', 245],
      ['17 crackers (29 g)', 29],
      ['about 1 cup (240 g)', 240],
      ['1 can (411 g)', 411],
      ['2 oz (56 g)', 56]
    ] as const) {
      const product = normalizeOpenFoodFactsProduct('12345678', {
        product_name: 'Serving parser fixture',
        serving_size: servingSize,
        serving_quantity: servingQuantity,
        nutriments: { 'energy-kcal_100g': 100 }
      });
      expect(product?.serving_quantity_g).toBe(servingQuantity);
      expect(product?.calories_per_serving).toBe(servingQuantity);
    }
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
    expect(estimated).toMatchObject({
      result_state: 'more_data_needed',
      score: null,
      central_score: null,
      grade_label: 'More data needed',
      score_eligibility: { eligible: false, supportedDimensionCount: 1 }
    });
    expect(estimated.estimated_grade_range).toBeNull();
    expect(estimated.missing_evidence).toContain('Complete package ingredient details are unavailable.');
    expect(unresolved).toMatchObject({ result_state: 'more_data_needed', score: null, letter_grade: null, grade_label: 'More data needed' });
    expect(JSON.stringify(unresolved)).not.toContain('Calibrating');
    expect(unresolved.considerations).toContain('There is not enough reliable category information to assign a grade yet.');
    expect(unresolved.missing_evidence).toContain('A reliable product category could not be resolved.');
    expect(unresolved.considerations.join(' ').toLowerCase()).not.toMatch(/uses the overall label pattern|the score uses/);
  });

  it('resolves supported beverages with complete formulation evidence even when ordinary food macros are absent', () => {
    const product = normalizeOpenFoodFactsProduct('12345678', {
      product_name: 'Zero sugar carbonated soft drink',
      categories_tags: ['en:carbonated-drinks', 'en:artificially-sweetened-beverages', 'en:diet-sodas'],
      ingredients_text_en: 'carbonated water, caramel color, phosphoric acid, aspartame, caffeine, potassium benzoate, natural flavor, acesulfame potassium',
      serving_size: '1 can (355 ml)',
      serving_quantity: 355,
      nutriments: { sugars_serving: 0, sodium_serving: 0.035 }
    })!;
    const quality = calculateProductQuality(product);

    expect(product.evidence_confidence?.nutrition).toBe('medium');
    expect(product.reason_codes).toContain('nutrition_calibrating');
    expect(quality).toMatchObject({
      result_state: 'estimated',
      category_id: 'soda',
      score: expect.any(Number),
      absolute_score: expect.any(Number),
      letter_grade: expect.any(String)
    });
    expect(quality.reason_codes).not.toContain('nutrition_calibrating');
    expect(quality.missing_evidence).not.toContain('Nutrition details are incomplete.');
  });

  it('maps directly supported unknown-category products to bounded provisional results', () => {
    const product = normalizeOpenFoodFactsProduct('12345678', {
      product_name: 'Unclassified pantry item',
      ingredients_text_en: 'water, oats, sea salt',
      serving_size: '30 g',
      serving_quantity: 30,
      nutriments: { 'energy-kcal_serving': 100 }
    })!;
    const quality = calculateProductQuality(product);

    expect(quality).toMatchObject({
      result_state: 'provisional',
      score: expect.any(Number),
      letter_grade: expect.any(String),
      grade_label: 'Grade uncertain',
      grade_certainty: { state: 'unresolved' },
      category_comparison_available: false,
      generalized_fallback_used: true,
      score_eligibility: { eligible: true }
    });
    expect(quality.reason_codes).not.toContain('nutrition_calibrating');
    expect(quality.scoring_reason_codes).toContain('generalized_evidence_fallback');
    expect(quality.estimated_score_range).not.toBeNull();
    expect(quality.missing_evidence).toContain('Category-specific comparison is unavailable.');
    expect(quality.summary).not.toMatch(/calibrating/i);
    expect(quality.considerations.join(' ')).not.toMatch(/calibrating/i);
    expect(buildProductQualityScorePresentation(quality)).toMatchObject({
      scoreLine: `Supported-evidence score ${quality.score}`,
      stateLine: 'Provisional',
      rangeLine: expect.stringContaining('Deterministic range'),
      confidenceLine: expect.stringMatching(/^Confidence:/),
      supportedDimensionsLine: expect.stringContaining('Supported dimensions:'),
      contextLine: 'This center summarizes supported dimensions only; missing material dimensions remain in the range.'
    });
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
    expect(watch.considerations.length).toBeGreaterThan(0);
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
      serving_size: '50 g',
      ingredients_text: 'Corn, avocado oil, sea salt',
      nutriments: {
        'energy-kcal_serving': 260,
        proteins_serving: 2,
        carbohydrates_serving: 30,
        fat_serving: 14,
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

  it('keeps a small near-zero macro-energy discrepancy scoreable', () => {
    const product = normalizeOpenFoodFactsProduct('12345678', {
      product_name: 'Citrus sparkling water',
      categories_tags: ['en:waters', 'en:sparkling-waters'],
      ingredients_text: 'carbonated water, citrus juice',
      serving_size: '1 can (355 ml)',
      serving_quantity: 355,
      nutriments: {
        'energy-kcal_serving': 3,
        proteins_serving: 0,
        carbohydrates_serving: 0,
        fat_serving: 0,
        sugars_serving: 0,
        sodium_serving: 0
      }
    })!;
    const quality = calculateProductQuality(product);
    const macroObservations = product.nutrient_evidence?.observations.filter((item) => (
      ['calories', 'protein_g', 'carbs_g', 'fat_g'].includes(item.nutrient) && item.basis === 'per_serving'
    )) ?? [];

    expect(product.calories_per_serving).toBe(3);
    expect(macroObservations.every((item) => item.plausibilityFlags.length === 0)).toBe(true);
    expect(macroObservations.some((item) => item.plausibilityNotes.some((note) => (
      note.includes('discrepancy 3 kcal') && note.includes('tolerance 10 kcal')
    )))).toBe(true);
    expect(quality).toMatchObject({
      category_id: 'sparkling_water',
      score: expect.any(Number),
      result_state: expect.stringMatching(/^(final|estimated|provisional)$/)
    });
  });

  it('contains an impossible macro set while retaining unrelated evidence for a bounded result', () => {
    const product = normalizeOpenFoodFactsProduct('12345678', {
      product_name: 'Seasoned whole grain snack',
      categories_tags: ['en:snacks', 'en:chips'],
      ingredients_text: 'whole grain, oil, seeds, seasoning',
      serving_size: '30 g',
      serving_quantity: 30,
      nutriments: {
        'energy-kcal_serving': 100,
        proteins_serving: 30,
        carbohydrates_serving: 50,
        fat_serving: 20,
        fiber_serving: 3,
        sugars_serving: 2,
        sodium_serving: 0.1
      }
    })!;
    const quality = calculateProductQuality(product);
    const rejectedCore = product.nutrient_evidence?.observations.filter((item) => (
      ['calories', 'protein_g', 'carbs_g', 'fat_g'].includes(item.nutrient) && item.basis === 'per_serving'
    )) ?? [];

    expect(rejectedCore).toHaveLength(4);
    expect(rejectedCore.every((item) => (
      item.plausibilityFlags.includes('macronutrient_energy_mismatch') && item.selectedFor.length === 0
    ))).toBe(true);
    expect(product).toMatchObject({
      calories_per_serving: null,
      protein_g: null,
      carbs_g: null,
      fat_g: null,
      fiber_g: 3,
      sugar_g: 2,
      sodium_mg: 100
    });
    expect(quality).toMatchObject({
      score: expect.any(Number),
      result_state: expect.stringMatching(/^(estimated|provisional)$/),
      score_eligibility: { eligible: true }
    });
    expect((quality.missing_evidence ?? []).join(' ')).toMatch(/nutrition|nutrient|macro/i);
  });

  it('keeps more data needed when unsafe macros leave too little material evidence', () => {
    const product = normalizeOpenFoodFactsProduct('12345678', {
      product_name: 'Generic packaged item',
      categories_tags: ['en:snacks'],
      serving_size: '30 g',
      serving_quantity: 30,
      nutriments: {
        'energy-kcal_serving': 100,
        proteins_serving: 30,
        carbohydrates_serving: 50,
        fat_serving: 20
      }
    })!;
    const quality = calculateProductQuality(product);

    expect(product.calories_per_serving).toBeNull();
    expect(quality).toMatchObject({
      score: null,
      result_state: 'more_data_needed',
      score_eligibility: { eligible: false }
    });
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

  it('keeps internal score mechanics in a non-rendered review trace', () => {
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
    expect(quality).toMatchObject({
      score: expect.any(Number),
      absolute_score: expect.any(Number),
      letter_grade: expect.any(String),
      engine_version: 'product_quality_v5'
    });
    const output = JSON.stringify(quality).toLowerCase();
    expect(quality.dimensions).toHaveLength(5);
    expect(quality.review_trace).toMatchObject({
      engine_version: 'product_quality_v5',
      category_resolution: { selectedCategoryId: 'plant_milk' },
      score_ledger: expect.any(Array)
    });
    const userCopy = [quality.summary, ...quality.positives, ...quality.considerations].join(' ').toLowerCase();
    for (const internalTerm of ['raw score', 'eligibility', 'gate', 'ledger', 'policy']) {
      expect(userCopy).not.toContain(internalTerm);
    }
    expect(output).toContain('review_trace');
  });
});
