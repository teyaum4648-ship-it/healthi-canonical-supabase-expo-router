import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  evaluateProductEvidenceSufficiency,
  mergeProviderRecords,
  resolveProductData,
  validGtin,
  type CanonicalProductCacheRecord,
  type CanonicalProductCacheStore,
  type ResolverProviderRecord
} from '../../../supabase/functions/_shared/productDataResolver';
import {
  classifyProductResolverError,
  clearProductResolverRequestState,
  lookupResolvedProduct
} from '../../../src/features/nutrition/productLookup/productResolverClient';
import { calculateProductQuality } from '../../../src/features/nutrition/productLookup/productQuality';
import type { HealthiProductSnapshot } from '../../../src/features/nutrition/productLookup/productLookupTypes';

function provider(overrides: Partial<ResolverProviderRecord> = {}): ResolverProviderRecord {
  return {
    provider: 'open_food_facts',
    status: 'found',
    recordId: '898248001411',
    updatedAt: '2026-01-01',
    fields: {
      name: 'Cultured Dairy',
      brand: 'Example',
      ingredients_text: 'cultured milk, live cultures',
      serving_size: '1 cup (170 g)',
      serving_quantity: 170,
      serving_unit: 'g',
      calories: 120,
      protein_g: 16,
      sugar_g: 5,
      sodium_mg: 60,
      categories: ['skyr'],
      labels: [],
      packaging: []
    },
    ...overrides
  };
}

function cachedRecord(
  freshUntil = '2026-08-01T00:00:00.000Z',
  resolverVersion = 'product_data_resolver_v3'
): CanonicalProductCacheRecord {
  const resolution = mergeProviderRecords('898248001411', [provider()]);
  if (resolution.status !== 'resolved') throw new Error('fixture must resolve');
  return {
    canonicalGtin: '898248001411',
    resolution,
    providerProvenance: resolution.product.field_provenance ?? [],
    providerConflicts: resolution.product.provider_conflicts ?? [],
    sourceTimestamps: { open_food_facts: '2026-01-01' },
    resolverVersion,
    fetchedAt: '2026-07-31T00:00:00.000Z',
    freshUntil,
    lastSuccessfulProviderAt: '2026-07-31T00:00:00.000Z',
    payloadBytes: JSON.stringify(resolution).length
  };
}

function memoryCache(record: CanonicalProductCacheRecord | null) {
  const writes: CanonicalProductCacheRecord[] = [];
  const cache: CanonicalProductCacheStore = {
    get: vi.fn(async () => record),
    put: vi.fn(async (next) => { writes.push(next); record = next; })
  };
  return { cache, writes };
}

describe('product-data-resolve', () => {
  beforeEach(() => clearProductResolverRequestState());

  it('requires a checksum-valid canonical GTIN', () => {
    expect(validGtin('898248001411')).toBe('898248001411');
    expect(validGtin('898248001412')).toBeNull();
    expect(validGtin('not-a-barcode')).toBeNull();
  });

  it('merges exact identity records field by field with selected provenance', () => {
    const merged = mergeProviderRecords('898248001411', [
      provider(),
      provider({
        provider: 'usda_food_data_central',
        recordId: '123',
        updatedAt: '2026-02-01',
        fields: {
          name: 'CULTURED NONFAT DAIRY PRODUCT',
          brand: 'Example',
          ingredients_text: 'cultured nonfat milk, live active cultures',
          serving_size: '1 container',
          serving_quantity: 170,
          serving_unit: 'g',
          calories: 100,
          protein_g: 15,
          added_sugar_g: 0,
          sugar_g: 5,
          sodium_mg: 55,
          categories: ['Yogurt'],
          labels: [],
          packaging: []
        }
      })
    ]);
    expect(merged.status).toBe('resolved');
    if (merged.status !== 'resolved') return;
    expect(merged.product).toMatchObject({
      calories_per_serving: 100,
      protein_g: 15,
      added_sugar_g: 0,
      provider_resolution: { terminal_state: 'resolved' }
    });
    const provenance = merged.product.field_provenance as Record<string, Array<{ selected: boolean }>>;
    expect(provenance.calories).toHaveLength(2);
    expect(provenance.calories.filter((item) => item.selected)).toHaveLength(1);
    expect(merged.product.provider_conflicts).toEqual(expect.arrayContaining([
      'ingredients_text differs across exact-GTIN provider records.'
    ]));
  });

  it('never accepts a non-exact USDA search result', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: 0 }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        foods: [{ fdcId: 1, gtinUpc: '111111111111', description: 'Wrong product' }]
      }), { status: 200 }));
    const result = await resolveProductData({
      barcode: '898248001411',
      usdaApiKey: 'server-only-key',
      fetcher
    });
    expect(result.status).toBe('identity_unresolved');
  });

  it('uses an exact USDA GTIN when Open Food Facts returns not found', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response('{}', { status: 404 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        foods: [{
          fdcId: 123, gtinUpc: '898248001411', description: 'EXACT CULTURED DAIRY', brandOwner: 'Example',
          ingredients: 'cultured milk, live cultures', servingSize: 170, servingSizeUnit: 'g', brandedFoodCategory: 'Yogurt',
          foodNutrients: [
            { nutrientName: 'Energy', value: 65 },
            { nutrientName: 'Protein', value: 9 }
          ]
        }]
      }), { status: 200 }));
    const result = await resolveProductData({ barcode: '898248001411', usdaApiKey: 'server-only-key', fetcher });
    expect(result).toMatchObject({
      status: 'resolved',
      product: { name: 'EXACT CULTURED DAIRY', provider_resolution: { terminal_state: 'resolved' } },
      sources: expect.arrayContaining([
        expect.objectContaining({ provider: 'open_food_facts', status: 'not_found' }),
        expect.objectContaining({ provider: 'usda_food_data_central', status: 'found' })
      ])
    });
  });

  it('keeps ambiguous USDA nutrient values unselected until their basis is explicit', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response('{}', { status: 404 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        foods: [{
          fdcId: 123, gtinUpc: '898248001411', description: 'EXACT PACKAGE', brandOwner: 'Example',
          ingredients: 'single declared base', servingSize: 170, servingSizeUnit: 'g', brandedFoodCategory: 'Staples',
          foodNutrients: [
            { nutrientName: 'Energy', value: 500, unitName: 'kcal' },
            { nutrientName: 'Protein', value: 25, unitName: 'g' }
          ]
        }]
      }), { status: 200 }));
    const result = await resolveProductData({ barcode: '898248001411', usdaApiKey: 'server-only-key', fetcher });

    expect(result.status).toBe('resolved');
    if (result.status !== 'resolved') return;
    expect(result.product).toMatchObject({ calories_per_serving: null, protein_g: null });
    const ledger = result.product.nutrient_evidence as {
      observations: Array<{ basis: string; plausibilityFlags: string[]; selectedFor: string[]; rejectionReasons: string[] }>;
    };
    expect(ledger.observations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        basis: 'unknown',
        plausibilityFlags: ['unknown_nutrient_basis'],
        selectedFor: [],
        rejectionReasons: ['Unknown-basis evidence is retained but excluded from scoring.']
      })
    ]));
  });

  it('normalizes declared USDA Branded nutrient amounts on their documented per-100g basis', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response('{}', { status: 404 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        foods: [{
          fdcId: 123, gtinUpc: '898248001411', dataType: 'Branded', description: 'EXACT BRANDED PACKAGE',
          ingredients: 'whole grain, seeds, sea salt', servingSize: 50, servingSizeUnit: 'GRM',
          brandedFoodCategory: 'Staples', foodNutrients: [
            { nutrientName: 'Energy', value: 200, unitName: 'kcal' },
            { nutrientName: 'Protein', value: 10, unitName: 'g' }
          ]
        }]
      }), { status: 200 }));
    const result = await resolveProductData({ barcode: '898248001411', usdaApiKey: 'server-only-key', fetcher });

    expect(result).toMatchObject({
      status: 'resolved',
      product: { calories_per_serving: 100, protein_g: 5 }
    });
    if (result.status !== 'resolved') return;
    const ledger = result.product.nutrient_evidence as {
      observations: Array<{ nutrient: string; basis: string; directlyReported: boolean; conversionFormula: string | null }>;
    };
    expect(ledger.observations).toEqual(expect.arrayContaining([
      expect.objectContaining({ nutrient: 'calories', basis: 'per_100g', directlyReported: true }),
      expect.objectContaining({ nutrient: 'calories', basis: 'per_serving', directlyReported: false, conversionFormula: expect.stringContaining('÷ 100 g') })
    ]));
  });

  it('derives Open Food Facts serving nutrition only from a compatible metric basis', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      status: 1,
      product: {
        code: '898248001411', product_name: 'EXACT PACKAGE', ingredients_text: 'single declared base',
        serving_size: '1 unit (50 g)', quantity: '200 g',
        nutriments: { 'energy-kcal_100g': 200, proteins_100g: 20, 'energy-kcal_package': 700 },
        categories_tags: ['en:staples']
      }
    }), { status: 200 }));
    const result = await resolveProductData({ barcode: '898248001411', fetcher });

    expect(result.status).toBe('resolved');
    if (result.status !== 'resolved') return;
    expect(result.product).toMatchObject({ calories_per_serving: 100, protein_g: 10 });
    const ledger = result.product.nutrient_evidence as {
      observations: Array<{ basis: string; directlyReported: boolean; conversionFormula: string | null; selectedFor: string[] }>;
    };
    expect(ledger.observations).toEqual(expect.arrayContaining([
      expect.objectContaining({ basis: 'per_100g', value: 200, directlyReported: true }),
      expect.objectContaining({ basis: 'per_serving', value: 100, directlyReported: false, conversionFormula: expect.stringContaining('÷ 100 g') }),
      expect.objectContaining({ basis: 'per_package', value: 700, selectedFor: [] })
    ]));
  });

  it('rejects every duplicate alias when the provider macro set is internally implausible', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      status: 1,
      product: {
        code: '898248001411', product_name: 'EXACT PACKAGE', ingredients_text: 'base, seasoning',
        serving_size: '283 g',
        nutriments: {
          'energy-kcal_serving': 260,
          'energy-kcal_100g': 91.9,
          proteins_serving: 53.8,
          proteins_100g: 19,
          carbohydrates_serving: 110,
          carbohydrates_100g: 39,
          fat_serving: 9.9,
          fat_100g: 3.5
        },
        categories_tags: ['en:prepared-meals']
      }
    }), { status: 200 }));
    const result = await resolveProductData({ barcode: '898248001411', fetcher });

    expect(result.status).toBe('resolved');
    if (result.status !== 'resolved') return;
    expect(result.product).toMatchObject({
      calories_per_serving: null,
      protein_g: null,
      carbs_g: null,
      fat_g: null,
      evidence_confidence: { nutrition: 'low' }
    });
    const ledger = result.product.nutrient_evidence as {
      observations: Array<{ nutrient: string; plausibilityFlags: string[]; selectedFor: string[] }>;
    };
    expect(ledger.observations
      .filter((item) => ['calories', 'protein_g', 'carbs_g', 'fat_g'].includes(item.nutrient))
      .every((item) => (
        item.plausibilityFlags.includes('macronutrient_energy_mismatch') && item.selectedFor.length === 0
      ))).toBe(true);
  });

  it('retains a small near-zero macro-energy discrepancy in the server resolver', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      status: 1,
      product: {
        code: '898248001411', product_name: 'Generic sparkling beverage',
        ingredients_text: 'carbonated water, citrus juice',
        serving_size: '1 can (355 ml)', serving_quantity: 355,
        nutriments: {
          'energy-kcal_serving': 3,
          proteins_serving: 0,
          carbohydrates_serving: 0,
          fat_serving: 0
        },
        categories_tags: ['en:waters', 'en:sparkling-waters']
      }
    }), { status: 200 }));
    const result = await resolveProductData({ barcode: '898248001411', fetcher });

    expect(result.status).toBe('resolved');
    if (result.status !== 'resolved') return;
    expect(result.product).toMatchObject({ calories_per_serving: 3, protein_g: 0, carbs_g: 0, fat_g: 0 });
    const ledger = result.product.nutrient_evidence as {
      observations: Array<{ nutrient: string; basis: string; plausibilityFlags: string[]; plausibilityNotes: string[] }>;
    };
    const macroObservations = ledger.observations.filter((item) => (
      ['calories', 'protein_g', 'carbs_g', 'fat_g'].includes(item.nutrient) && item.basis === 'per_serving'
    ));
    expect(macroObservations.every((item) => item.plausibilityFlags.length === 0)).toBe(true);
    expect(macroObservations.some((item) => item.plausibilityNotes.some((note) => (
      note.includes('discrepancy 3 kcal') && note.includes('tolerance 10 kcal')
    )))).toBe(true);
  });

  it('retains material nutrient conflicts and lowers the selected nutrition confidence', () => {
    const merged = mergeProviderRecords('898248001411', [
      provider({ fields: { ...provider().fields, calories: 100 } }),
      provider({
        provider: 'usda_food_data_central', recordId: '123', updatedAt: '2026-02-01',
        fields: { ...provider().fields, calories: 180 }
      })
    ]);

    expect(merged.status).toBe('resolved');
    if (merged.status !== 'resolved') return;
    expect(merged.product).toMatchObject({
      calories_per_serving: null,
      evidence_confidence: { nutrition: 'low' },
      provider_conflicts: expect.arrayContaining(['calories materially differs across compatible per_serving observations.'])
    });
    const ledger = merged.product.nutrient_evidence as { observations: Array<{ value: number; conflictStatus: string }> };
    expect(ledger.observations.filter((item) => item.conflictStatus === 'material_conflict').map((item) => item.value)).toEqual([100, 180]);
  });

  it('degrades cleanly when USDA is not configured and distinguishes provider failure', async () => {
    const offFound = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      status: 1,
      product: {
        code: '898248001411',
        product_name: 'Cultured Dairy',
        ingredients_text: 'cultured milk',
        serving_quantity: 170,
        nutriments: { 'energy-kcal_serving': 110, proteins_serving: 16 },
        categories_tags: ['en:yogurts']
      }
    }), { status: 200 }));
    expect((await resolveProductData({ barcode: '898248001411', fetcher: offFound })).status).toBe('resolved');

    const unavailable = vi.fn().mockRejectedValue(new Error('offline'));
    expect((await resolveProductData({ barcode: '898248001411', fetcher: unavailable })).status).toBe('provider_unavailable');

    const sourceANotFound = vi.fn().mockResolvedValue(new Response('{}', { status: 404 }));
    expect(await resolveProductData({ barcode: '898248001411', fetcher: sourceANotFound })).toMatchObject({
      status: 'provider_unavailable',
      trace: {
        source_a: { result: 'not_found', failure_reason: 'http_404' },
        source_b: { result: 'skipped', invocation_reason: 'not_configured' },
        final_result_state: 'provider_unavailable'
      }
    });
    expect(sourceANotFound).toHaveBeenCalledTimes(1);
  });

  it('retries only once for transient responses and does not retry a permanent not-found response', async () => {
    const transient = vi.fn()
      .mockResolvedValueOnce(new Response('{}', { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: 0 }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ foods: [] }), { status: 200 }));
    expect(await resolveProductData({ barcode: '898248001411', fetcher: transient, usdaApiKey: 'server-only-test-key' })).toMatchObject({
      status: 'identity_unresolved',
      trace: { source_a: { attempt_count: 2, http_statuses: [503, 200], failure_reason: 'exact_record_not_found' } }
    });
    expect(transient).toHaveBeenCalledTimes(3);

    const permanent = vi.fn()
      .mockResolvedValueOnce(new Response('{}', { status: 404 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ foods: [] }), { status: 200 }));
    expect((await resolveProductData({ barcode: '898248001411', fetcher: permanent, usdaApiKey: 'server-only-test-key' })).status).toBe('identity_unresolved');
    expect(permanent).toHaveBeenCalledTimes(2);
  });

  it('honors a server-provider Retry-After window before its single retry', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response('{}', { status: 429, headers: { 'retry-after': '12' } }))
      .mockResolvedValueOnce(new Response('{}', { status: 404 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ foods: [] }), { status: 200 }));
    const waiter = vi.fn(async () => undefined);

    expect(await resolveProductData({ barcode: '898248001411', fetcher, waiter, usdaApiKey: 'server-only-test-key' })).toMatchObject({
      status: 'identity_unresolved', trace: { source_a: { attempt_count: 2, http_statuses: [429, 404] } }
    });
    expect(waiter).toHaveBeenCalledWith(12_000);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it.each([
    {
      label: 'unauthorized key',
      sourceBResponses: [new Response('{}', { status: 401 })],
      expectedAttempts: 1,
      expectedStatuses: [401],
      expectedFailure: 'http_401'
    },
    {
      label: 'rate limit exhaustion',
      sourceBResponses: [new Response('{}', { status: 429 }), new Response('{}', { status: 503 })],
      expectedAttempts: 2,
      expectedStatuses: [429, 503],
      expectedFailure: 'http_503'
    },
    {
      label: 'malformed response exhaustion',
      sourceBResponses: [new Response('not-json', { status: 200 }), new Response('still-not-json', { status: 200 })],
      expectedAttempts: 2,
      expectedStatuses: [200, 200],
      expectedFailure: 'network_timeout_or_malformed_response'
    }
  ])('keeps Source A evidence and reports Source B $label as unavailable', async ({
    sourceBResponses, expectedAttempts, expectedStatuses, expectedFailure
  }) => {
    const fetcher = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({
      status: 1,
      product: {
        code: '898248001411',
        product_name: 'Sparse exact product',
        ingredients_text: 'water'
      }
    }), { status: 200 }));
    for (const response of sourceBResponses) fetcher.mockResolvedValueOnce(response);

    const result = await resolveProductData({
      barcode: '898248001411',
      usdaApiKey: 'server-only-test-key',
      fetcher,
      waiter: async () => undefined
    });

    expect(result).toMatchObject({
      status: 'resolved',
      product: { name: 'Sparse exact product' },
      trace: {
        source_a: { result: 'found' },
        source_b: {
          result: 'unavailable',
          attempt_count: expectedAttempts,
          http_statuses: expectedStatuses,
          failure_reason: expectedFailure
        },
        final_result_state: 'more_data_needed'
      }
    });
    expect(fetcher).toHaveBeenCalledTimes(1 + expectedAttempts);
  });

  it('rejects oversized provider responses before parsing them', async () => {
    const oversized = vi.fn().mockResolvedValue(new Response('{}', {
      status: 200,
      headers: { 'content-length': '2000001' }
    }));
    expect((await resolveProductData({ barcode: '898248001411', fetcher: oversized })).status).toBe('provider_unavailable');
  });

  it('returns a fresh shared canonical cache record without calling providers', async () => {
    const { cache } = memoryCache(cachedRecord('2026-08-02T00:00:00.000Z'));
    const fetcher = vi.fn();
    const result = await resolveProductData({
      barcode: '898248001411', cache, fetcher,
      now: () => new Date('2026-08-01T00:00:00.000Z')
    });
    expect(result).toMatchObject({ status: 'resolved', cache: { status: 'fresh' } });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('does not reuse a cache record from an incompatible resolver version', async () => {
    const { cache } = memoryCache(cachedRecord('2026-08-02T00:00:00.000Z', 'product_data_resolver_v1'));
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      status: 1,
      product: {
        code: '898248001411', product_name: 'Current Resolver Product',
        ingredients_text: 'whole grain, seeds, sea salt', serving_size: '50 g',
        nutriments: {
          'energy-kcal_serving': 180, proteins_serving: 6, carbohydrates_serving: 30,
          fat_serving: 4, fiber_serving: 5, sodium_mg_serving: 120
        },
        categories_tags: ['en:staples']
      }
    }), { status: 200 }));

    const result = await resolveProductData({
      barcode: '898248001411', cache, fetcher,
      now: () => new Date('2026-08-01T00:00:00.000Z')
    });

    expect(result).toMatchObject({ status: 'resolved', cache: { status: 'miss' }, trace: { cache: { result: 'invalid' } } });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('does not let a fresh but insufficient cache suppress provider exhaustion', async () => {
    const prior = cachedRecord('2026-08-02T00:00:00.000Z');
    prior.resolution.product = {
      ...prior.resolution.product,
      ingredients_text: null,
      ingredient_tokens: [],
      ingredient_evidence: {
        resolved_text: null, raw_text: null, source_field: null, language: null,
        structured_ingredients: [], status: 'absent', confidence: 'low', reconstructed: false, conflicts: []
      },
      nutrient_evidence: null,
      calories: null,
      protein_g: null,
      carbs_g: null,
      fat_g: null,
      saturated_fat_g: null,
      fiber_g: null,
      sugar_g: null,
      added_sugar_g: null,
      sodium_mg: null,
      caffeine_mg: null
    };
    const { cache } = memoryCache(prior);
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      status: 1,
      product: {
        code: '898248001411', product_name: 'Refreshed complete product', ingredients_text: 'whole grain, seeds, sea salt',
        serving_size: '50 g', nutriments: {
          'energy-kcal_serving': 180, proteins_serving: 6, carbohydrates_serving: 30,
          fat_serving: 4, fiber_serving: 5, sodium_mg_serving: 120
        }, categories_tags: ['en:staples']
      }
    }), { status: 200 }));
    const result = await resolveProductData({
      barcode: '898248001411', cache, fetcher,
      now: () => new Date('2026-08-01T00:00:00.000Z')
    });

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      status: 'resolved',
      trace: { cache: { result: 'fresh_insufficient' }, final_result_state: 'resolved' }
    });
  });

  it('falls back to stale canonical evidence when both providers are unavailable', async () => {
    const prior = cachedRecord('2026-07-31T00:00:00.000Z');
    const { cache, writes } = memoryCache(prior);
    const result = await resolveProductData({
      barcode: '898248001411', cache, usdaApiKey: 'server-only-key',
      fetcher: vi.fn().mockRejectedValue(new Error('offline')),
      now: () => new Date('2026-08-01T00:00:00.000Z')
    });
    expect(result).toMatchObject({ status: 'resolved', cache: { status: 'stale' } });
    expect(writes).toHaveLength(0);
    expect(prior.resolution.product).toEqual(expect.objectContaining({ name: 'Cultured Dairy' }));
  });

  it('replaces canonical cache only after a valid normalized refresh', async () => {
    const { cache, writes } = memoryCache(cachedRecord('2026-07-31T00:00:00.000Z'));
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      status: 1,
      product: {
        code: '898248001411', product_name: 'Refreshed Cultured Dairy', ingredients_text: 'cultured milk, live cultures',
        serving_size: '170 g', serving_quantity: 170,
        nutriments: { 'energy-kcal_serving': 110, proteins_serving: 16, sugars_serving: 5 },
        categories_tags: ['en:yogurts']
      }
    }), { status: 200 }));
    const result = await resolveProductData({
      barcode: '898248001411', cache, fetcher,
      now: () => new Date('2026-08-01T00:00:00.000Z')
    });
    expect(result).toMatchObject({ status: 'resolved', cache: { status: 'refreshed' } });
    expect(writes).toHaveLength(1);
    expect(writes[0]?.resolution.product).toEqual(expect.objectContaining({ name: 'Refreshed Cultured Dairy' }));
    expect(writes[0]?.payloadBytes).toBeLessThanOrEqual(262_144);
  });

  it('queries Source B only after Source A cannot support a bounded interpretation', async () => {
    const completeA = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      status: 1,
      product: {
        code: '898248001411', product_name: 'Complete exact product', ingredients_text: 'whole grain, seeds, sea salt',
        serving_size: '50 g', nutriments: {
          'energy-kcal_serving': 180, proteins_serving: 6, carbohydrates_serving: 30,
          fat_serving: 4, 'saturated-fat_serving': 1, fiber_serving: 5, sugars_serving: 2,
          'added-sugars_serving': 0, sodium_mg_serving: 120
        }, categories_tags: ['en:staples']
      }
    }), { status: 200 }));
    const completeResult = await resolveProductData({
      barcode: '898248001411', usdaApiKey: 'server-only-key', fetcher: completeA
    });
    expect(completeA).toHaveBeenCalledTimes(1);
    expect(completeResult).toMatchObject({
      status: 'resolved',
      trace: {
        source_b: { attempted: false, result: 'skipped', invocation_reason: 'not_required_source_a_sufficient' },
        final_result_state: 'resolved'
      }
    });

    const incompleteAThenB = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        status: 1,
        product: {
          code: '898248001411', product_name: 'Incomplete exact product', serving_size: '50 g',
          nutriments: { 'energy-kcal_serving': 180, proteins_serving: 6, fiber_serving: 5 },
          categories_tags: ['en:staples']
        }
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        foods: [{
          fdcId: 42, gtinUpc: '898248001411', description: 'INCOMPLETE EXACT PRODUCT',
          ingredients: 'whole grain, seeds, sea salt', servingSize: 50, servingSizeUnit: 'g',
          brandedFoodCategory: 'Staples', foodNutrients: []
        }]
      }), { status: 200 }));
    const completedResult = await resolveProductData({
      barcode: '898248001411', usdaApiKey: 'server-only-key', fetcher: incompleteAThenB
    });
    expect(incompleteAThenB).toHaveBeenCalledTimes(2);
    expect(completedResult).toMatchObject({
      status: 'resolved',
      product: { ingredients_text: 'whole grain, seeds, sea salt' },
      trace: {
        source_b: { attempted: true, result: 'found', invocation_reason: 'source_a_validation_failed' },
        merge: { attempted: true, selected_fields: { usda_food_data_central: expect.arrayContaining(['ingredients_text']) } },
        final_result_state: 'resolved'
      }
    });
  });

  it('queries Source B when a scoring-relevant Source A field fails validation and resolves it field by field', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        status: 1,
        product: {
          code: '898248001411', product_name: 'Whole grain fixture', brands: 'Fixture foods',
          ingredients_text: 'whole grain, cane sugar, sea salt', serving_size: '50 g',
          nutriments: {
            'energy-kcal_serving': 190, proteins_serving: 6, carbohydrates_serving: 34,
            fat_serving: 4, 'saturated-fat_serving': 1, fiber_serving: 4, sugars_serving: 5,
            'added-sugars_serving': 0, sodium_mg_serving: 120
          }, categories_tags: ['en:whole-grain-foods']
        }
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        foods: [{
          fdcId: 41, gtinUpc: '898248001411', description: 'WHOLE GRAIN FIXTURE', brandOwner: 'Fixture foods',
          ingredients: 'whole grain, cane sugar, sea salt', servingSize: 50, servingSizeUnit: 'g',
          brandedFoodCategory: 'Whole grain foods', nutrientBasis: 'perServing', foodNutrients: [
            { nutrientName: 'Energy', value: 190 }, { nutrientName: 'Protein', value: 6 },
            { nutrientName: 'Carbohydrate', value: 34 }, { nutrientName: 'Total fat', value: 4 },
            { nutrientName: 'Saturated fat', value: 1 }, { nutrientName: 'Fiber', value: 4 },
            { nutrientName: 'Total sugars', value: 5 }, { nutrientName: 'Added sugars', value: 5 },
            { nutrientName: 'Sodium', value: 120 }
          ]
        }]
      }), { status: 200 }));

    const result = await resolveProductData({
      barcode: '898248001411', usdaApiKey: 'server-only-key', fetcher
    });

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({
      status: 'resolved',
      product: {
        added_sugar_g: 5,
        nutrition_validation: { nutrients: { added_sugar_g: { reliability: 'KNOWN' } } },
        provider_resolution_trace: expect.arrayContaining([
          expect.objectContaining({ field: 'added_sugar_g', selectedSource: 'usda_food_data_central', selectedValue: 5 })
        ])
      },
      trace: {
        source_b: { attempted: true, invocation_reason: 'source_a_validation_failed' },
        merge: { identity_confidence: expect.any(Number) }
      }
    });
  });

  it('uses Source B as exact-GTIN fallback when Source A is unavailable', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response('{}', { status: 503 }))
      .mockResolvedValueOnce(new Response('{}', { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        foods: [{
          fdcId: 77, gtinUpc: '898248001411', description: 'EXACT FALLBACK PRODUCT',
          ingredients: 'whole grain, seeds, sea salt', servingSize: 50, servingSizeUnit: 'g',
          brandedFoodCategory: 'Staples', nutrientBasis: 'perServing', foodNutrients: [
            { nutrientName: 'Energy', value: 180 }, { nutrientName: 'Protein', value: 6 },
            { nutrientName: 'Carbohydrate', value: 30 }, { nutrientName: 'Total fat', value: 4 },
            { nutrientName: 'Fiber', value: 5 }, { nutrientName: 'Sodium', value: 120 }
          ]
        }]
      }), { status: 200 }));
    const result = await resolveProductData({ barcode: '898248001411', usdaApiKey: 'server-only-key', fetcher });

    expect(result).toMatchObject({
      status: 'resolved',
      product: { name: 'EXACT FALLBACK PRODUCT' },
      trace: {
        source_a: { attempted: true, result: 'unavailable' },
        source_b: { attempted: true, result: 'found', invocation_reason: 'source_a_unavailable' },
        final_result_state: 'resolved'
      }
    });
  });

  it('combines partial exact records when Source B supplies missing normalized nutrition', async () => {
    const { cache, writes } = memoryCache(null);
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        status: 1,
        product: { code: '898248001411', product_name: 'Sparse exact product', ingredients_text: 'water' }
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        foods: [{
          fdcId: 88, gtinUpc: '898248001411', dataType: 'Branded', description: 'SPARSE EXACT PRODUCT',
          servingSize: 355, servingSizeUnit: 'ml', brandedFoodCategory: 'Beverages', foodNutrients: [
            { nutrientName: 'Energy', value: 2 }, { nutrientName: 'Carbohydrate', value: 0 },
            { nutrientName: 'Total fat', value: 0 }, { nutrientName: 'Sodium', value: 12 }
          ]
        }]
      }), { status: 200 }));
    const result = await resolveProductData({ barcode: '898248001411', usdaApiKey: 'server-only-key', fetcher, cache });

    expect(result).toMatchObject({
      status: 'resolved',
      product: { ingredients_text: 'water', calories_per_serving: 7.1, nutriments_per_100ml: { calories: 2 } },
      trace: {
        source_b: { attempted: true, result: 'found' },
        sufficiency_before_source_b: { supports_bounded_interpretation: false },
        sufficiency_after_source_b: { supports_bounded_interpretation: true },
        final_result_state: 'resolved'
      }
    });
    expect(writes).toHaveLength(1);
    expect(writes[0]?.resolution.sources).toEqual(expect.arrayContaining([
      expect.objectContaining({ provider: 'open_food_facts', status: 'found' }),
      expect.objectContaining({ provider: 'usda_food_data_central', status: 'found' })
    ]));
    expect(JSON.stringify(writes[0]?.providerProvenance)).toContain('usda_food_data_central');

    const repeatFetcher = vi.fn();
    await expect(resolveProductData({
      barcode: '898248001411', usdaApiKey: 'server-only-key', fetcher: repeatFetcher, cache
    })).resolves.toMatchObject({ status: 'resolved', cache: { status: 'fresh' } });
    expect(repeatFetcher).not.toHaveBeenCalled();
  });

  it('retains exact-identity conflicts without merging a mismatched provider record', () => {
    const result = mergeProviderRecords('898248001411', [
      provider(),
      provider({
        provider: 'usda_food_data_central', recordId: 'mismatch',
        fields: { ...provider().fields, canonical_gtin: '860439001005', brand: 'Different identity' }
      })
    ]);

    expect(result).toMatchObject({
      status: 'resolved',
      product: { brand: 'Example' },
      sources: expect.arrayContaining([
        expect.objectContaining({ provider: 'usda_food_data_central', status: 'not_found' })
      ])
    });
    if (result.status === 'resolved') expect(result.product.provider_conflicts).not.toContain('brand differs across exact-GTIN provider records.');
  });

  it('allows missing category when direct evidence is sufficient and abstains only after applicable routes', async () => {
    const sufficientWithoutCategory = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      status: 1,
      product: {
        code: '898248001411', product_name: 'Uncategorized exact product', ingredients_text: 'whole grain, seeds, sea salt',
        serving_size: '50 g', nutriments: {
          'energy-kcal_serving': 180, proteins_serving: 6, carbohydrates_serving: 30,
          fat_serving: 4, fiber_serving: 5, sodium_mg_serving: 120
        }, categories_tags: []
      }
    }), { status: 200 }));
    const supported = await resolveProductData({
      barcode: '898248001411', usdaApiKey: 'server-only-key', fetcher: sufficientWithoutCategory
    });
    expect(supported).toMatchObject({
      status: 'resolved',
      trace: {
        source_b: { attempted: true, invocation_reason: 'source_a_validation_failed' },
        sufficiency_after_source_b: { category_context_available: false, supports_bounded_interpretation: true },
        final_result_state: 'resolved'
      }
    });
    if (supported.status === 'resolved') {
      expect(evaluateProductEvidenceSufficiency({
        ...supported.product,
        ingredients_text: 'black beans',
        ingredient_tokens: ['black beans'],
        categories_tags: ['undefined']
      })).toMatchObject({
        supports_bounded_interpretation: false,
        category_context_available: false,
        reasons: expect.arrayContaining(['category_context_absent_non_blocking'])
      });
    }

    const insufficientThenMissing = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        status: 1, product: { code: '898248001411', product_name: 'Sparse exact product', ingredients_text: 'water' }
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ foods: [] }), { status: 200 }));
    const exhausted = await resolveProductData({
      barcode: '898248001411', usdaApiKey: 'server-only-key', fetcher: insufficientThenMissing
    });
    expect(exhausted).toMatchObject({
      status: 'resolved',
      trace: {
        source_b: { attempted: true, result: 'not_found', invocation_reason: 'source_a_validation_failed' },
        final_result_state: 'more_data_needed',
        final_scoring_scope: 'none',
        abstention_reason: expect.stringContaining('collective direct evidence')
      }
    });
  });

  it('keeps provider availability and equivalent corroboration out of the central score', () => {
    const sourceA = provider({ fields: { ...provider().fields, carbs_g: 8, fat_g: 1, fiber_g: 2 } });
    const sourceB = provider({
      provider: 'usda_food_data_central', recordId: 'corroborating-record', updatedAt: '2026-01-01',
      fields: { ...sourceA.fields, canonical_gtin: '898248001411' }
    });
    const single = mergeProviderRecords('898248001411', [sourceA]);
    const corroborated = mergeProviderRecords('898248001411', [sourceA, sourceB]);
    expect(single.status).toBe('resolved');
    expect(corroborated.status).toBe('resolved');
    if (single.status !== 'resolved' || corroborated.status !== 'resolved') return;

    const singleQuality = calculateProductQuality(single.product as unknown as HealthiProductSnapshot);
    const corroboratedQuality = calculateProductQuality(corroborated.product as unknown as HealthiProductSnapshot);
    expect(corroboratedQuality.central_score).toBe(singleQuality.central_score);
    expect(corroboratedQuality.score).toBe(singleQuality.score);
    expect(corroboratedQuality.result_state).not.toBe('more_data_needed');
  });

  it('classifies the full evidence degradation ladder without using category as permission', () => {
    const base = mergeProviderRecords('898248001411', [provider({
      fields: { ...provider().fields, carbs_g: 8, fat_g: 1, fiber_g: 2 }
    })]);
    expect(base.status).toBe('resolved');
    if (base.status !== 'resolved') return;

    expect(evaluateProductEvidenceSufficiency(base.product).level).toBe('full');
    expect(evaluateProductEvidenceSufficiency({
      ...base.product, categories_tags: []
    }).level).toBe('good');
    expect(evaluateProductEvidenceSufficiency({
      ...base.product, nutrient_evidence: null, calories: null, protein_g: null, carbs_g: null, fat_g: null,
      saturated_fat_g: null, fiber_g: null, sugar_g: null, added_sugar_g: null, sodium_mg: null, caffeine_mg: null,
      serving_quantity: null, serving_quantity_g: null, serving_unit: null
    }).level).toBe('partial');
    expect(evaluateProductEvidenceSufficiency({
      ...base.product, nutrient_evidence: null, calories: null, protein_g: null, carbs_g: null, fat_g: null,
      saturated_fat_g: null, fiber_g: null, sugar_g: null, added_sugar_g: null, sodium_mg: null, caffeine_mg: null,
      serving_quantity: null, serving_quantity_g: null, serving_unit: null, categories_tags: []
    }).level).toBe('minimum_defensible');
    expect(evaluateProductEvidenceSufficiency({
      ...base.product, ingredients_text: null, ingredient_tokens: [], nutrient_evidence: null,
      calories: null, protein_g: null, carbs_g: null, fat_g: null, saturated_fat_g: null,
      fiber_g: null, sugar_g: null, added_sugar_g: null, sodium_mg: null, caffeine_mg: null
    }).level).toBe('abstain');
  });

  it('distinguishes exhausted identity failure from collective provider unavailability', async () => {
    const unresolved = vi.fn()
      .mockResolvedValueOnce(new Response('{}', { status: 404 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ foods: [] }), { status: 200 }));
    expect(await resolveProductData({
      barcode: '898248001411', usdaApiKey: 'server-only-key', fetcher: unresolved
    })).toMatchObject({ status: 'identity_unresolved', trace: { final_result_state: 'identity_unresolved' } });

    const unavailable = vi.fn().mockRejectedValue(new Error('offline'));
    expect(await resolveProductData({
      barcode: '898248001411', usdaApiKey: 'server-only-key', fetcher: unavailable
    })).toMatchObject({ status: 'provider_unavailable', trace: { final_result_state: 'provider_unavailable' } });
    expect(unavailable).toHaveBeenCalledTimes(4);
  });

  it('falls back to public label data when the Edge Function is unavailable', async () => {
    const client = {
      functions: {
        invoke: vi.fn().mockResolvedValue({
          data: { status: 'provider_unavailable', message: 'offline' },
          error: null
        })
      }
    };
    const resolved = mergeProviderRecords('898248001411', [provider()]);
    expect(resolved.status).toBe('resolved');
    if (resolved.status !== 'resolved') return;
    const fallbackLookup = vi.fn().mockResolvedValue({ status: 'found', product: resolved.product });

    expect(await lookupResolvedProduct({
      barcode: '898248001411', client, configured: true, fallbackLookup, recentResultTtlMs: 0
    })).toMatchObject({
      status: 'found', product: resolved.product,
      resolverDiagnostics: {
        cacheStatus: 'miss', finalState: 'found',
        attempts: [
          expect.objectContaining({ provider: 'canonical_resolver', status: 'unavailable' }),
          expect.objectContaining({ provider: 'open_food_facts', status: 'found' })
        ]
      }
    });
    expect(client.functions.invoke).toHaveBeenCalledTimes(1);
    expect(fallbackLookup).toHaveBeenCalledWith('898248001411');
    expect(await lookupResolvedProduct({
      barcode: '898248001412', client, configured: true, fallbackLookup, recentResultTtlMs: 0
    })).toMatchObject({
      status: 'identity_unresolved'
    });
    expect(fallbackLookup).toHaveBeenCalledTimes(1);
  });

  it('uses public label data in local preview mode and preserves its terminal states', async () => {
    const resolved = mergeProviderRecords('898248001411', [provider()]);
    expect(resolved.status).toBe('resolved');
    if (resolved.status !== 'resolved') return;

    const foundFallback = vi.fn().mockResolvedValue({ status: 'found', product: resolved.product });
    expect(await lookupResolvedProduct({
      barcode: '898248001411', configured: false, fallbackLookup: foundFallback, recentResultTtlMs: 0
    })).toMatchObject({ status: 'found', product: resolved.product });

    const missingFallback = vi.fn().mockResolvedValue({
      status: 'not_found', barcode: '898248001411', message: 'No exact public record.'
    });
    expect(await lookupResolvedProduct({
      barcode: '898248001411', configured: false, fallbackLookup: missingFallback, recentResultTtlMs: 0
    })).toMatchObject({
      status: 'identity_unresolved', barcode: '898248001411', message: 'No exact public record.'
    });

    const unavailableFallback = vi.fn().mockResolvedValue({
      status: 'error', barcode: '898248001411', code: 'network_error', message: 'Public provider offline.'
    });
    expect(await lookupResolvedProduct({
      barcode: '898248001411', configured: false, fallbackLookup: unavailableFallback, recentResultTtlMs: 0
    })).toMatchObject({
      status: 'provider_unavailable', barcode: '898248001411', message: 'Public provider offline.'
    });

    expect(await lookupResolvedProduct({
      barcode: '898248001411', configured: false,
      fallbackLookup: vi.fn().mockRejectedValue(new Error('unexpected failure')),
      recentResultTtlMs: 0
    })).toMatchObject({
      status: 'provider_unavailable',
      barcode: '898248001411',
      message: 'Product providers are temporarily unavailable.'
    });
  });

  it('coalesces identical in-flight resolver chains and reuses a recent result', async () => {
    const resolved = mergeProviderRecords('898248001411', [provider()]);
    expect(resolved.status).toBe('resolved');
    if (resolved.status !== 'resolved') return;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const productSnapshot = resolved.product as unknown as HealthiProductSnapshot;
    const fallbackLookup = vi.fn(async () => {
      await gate;
      return { status: 'found' as const, product: productSnapshot };
    });

    const requests = Array.from({ length: 5 }, () => lookupResolvedProduct({
      barcode: '898248001411', configured: false, fallbackLookup
    }));
    await Promise.resolve();
    expect(fallbackLookup).toHaveBeenCalledTimes(1);
    release();
    const results = await Promise.all(requests);
    expect(results.every((result) => result.status === 'found')).toBe(true);
    expect(fallbackLookup).toHaveBeenCalledTimes(1);

    const recent = await lookupResolvedProduct({ barcode: '898248001411', configured: false, fallbackLookup });
    expect(recent.resolverDiagnostics).toMatchObject({ cacheStatus: 'recent_result', attempts: [] });
    expect(fallbackLookup).toHaveBeenCalledTimes(1);
  });

  it('classifies canonical resolver failures without exposing raw infrastructure errors', () => {
    expect(classifyProductResolverError({ status: 401 })).toMatchObject({ code: 'auth_required', httpStatus: 401 });
    expect(classifyProductResolverError({ status: 404 })).toMatchObject({ code: 'function_not_deployed', httpStatus: 404 });
    expect(classifyProductResolverError({ status: 429 })).toMatchObject({ code: 'rate_limited', httpStatus: 429 });
    expect(classifyProductResolverError({ status: 503 })).toMatchObject({ code: 'function_error', httpStatus: 503 });
    expect(classifyProductResolverError({ message: 'network connection failed' })).toMatchObject({ code: 'network_error' });
  });

  it('does not fall back after an exact canonical not-found result', async () => {
    const client = { functions: { invoke: vi.fn().mockResolvedValue({
      data: { status: 'identity_unresolved', message: 'No exact identity.' }, error: null
    }) } };
    const fallbackLookup = vi.fn();
    const result = await lookupResolvedProduct({
      barcode: '898248001411', client, configured: true, fallbackLookup, recentResultTtlMs: 0
    });
    expect(result).toMatchObject({ status: 'identity_unresolved', message: 'No exact identity.' });
    expect(client.functions.invoke).toHaveBeenCalledTimes(1);
    expect(fallbackLookup).not.toHaveBeenCalled();
  });
});
