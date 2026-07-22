import { describe, expect, it } from 'vitest';

import { mergeProductEvidence, mergeProductSnapshots } from '../../../src/features/nutrition/productLookup/mergeProductEvidence';
import type { HealthiProductSnapshot } from '../../../src/features/nutrition/productLookup/productLookupTypes';
import { unavailableSecondaryProductProvider, type NormalizedProductProviderResult } from '../../../src/features/nutrition/productLookup/productDataProvider';

function result(overrides: Partial<NormalizedProductProviderResult> = {}): NormalizedProductProviderResult {
  return {
    provider: 'fixture', provider_record_id: 'fixture-1', barcode: '123456789012',
    name: 'Cocoa nut bar', brand: 'Fixture Foods', variant: 'Cocoa', quantity: '50 g',
    ingredients: {
      resolved_text: null, raw_text: null, source_field: null, language: 'en', structured_ingredients: [],
      status: 'absent', confidence: 'low', reconstructed: false, conflicts: []
    },
    nutrition: {}, serving_size: null, serving_quantity_g: null, categories: ['bars'], product_form: 'ready_to_eat',
    source_timestamp: '2026-07-01T00:00:00.000Z', provider_confidence: 'medium',
    field_provenance: {}, conflicts: [], ...overrides
  };
}

function ingredients(text: string, status: 'complete' | 'partial' | 'reconstructed' = 'complete') {
  return {
    resolved_text: text, raw_text: status === 'reconstructed' ? null : text, source_field: status === 'reconstructed' ? 'ingredients' : 'ingredients_text',
    language: 'en', structured_ingredients: [], status, confidence: status === 'complete' ? 'high' as const : 'medium' as const,
    reconstructed: status === 'reconstructed', conflicts: []
  };
}

describe('provider-neutral product evidence merge', () => {
  it('fills missing primary ingredients from a complete secondary source', () => {
    const merged = mergeProductEvidence(result(), result({
      provider_record_id: 'fixture-2', ingredients: ingredients('dates, egg whites, almonds'), source_timestamp: '2026-07-02T00:00:00.000Z'
    }));
    expect(merged).toMatchObject({ status: 'merged', result: { ingredients: { resolved_text: 'dates, egg whites, almonds', status: 'complete' } } });
  });

  it('protects complete raw ingredients from newer partial or reconstructed evidence', () => {
    const complete = result({ ingredients: ingredients('oats, almonds, salt'), source_timestamp: '2026-06-01T00:00:00.000Z' });
    const newerWeak = result({ provider_record_id: 'fixture-2', ingredients: ingredients('oats, flavor', 'partial'), source_timestamp: '2026-07-15T00:00:00.000Z' });
    expect(mergeProductEvidence(complete, newerWeak).result?.ingredients.resolved_text).toBe('oats, almonds, salt');
  });

  it('treats UPC-A and zero-prefixed EAN as the same exact identity', () => {
    const merged = mergeProductEvidence(result({ barcode: '123456789012' }), result({ barcode: '0123456789012', provider_record_id: 'fixture-2' }));
    expect(merged.status).toBe('merged');
    expect(merged.result?.barcode).toBe('123456789012');
  });

  it('rejects different barcodes and materially different variants', () => {
    expect(mergeProductEvidence(result(), result({ barcode: '999999999999' }))).toMatchObject({ status: 'rejected' });
    expect(mergeProductEvidence(result(), result({ variant: 'Vanilla' }))).toMatchObject({ status: 'rejected', conflicts: ['Provider records identify different product variants.'] });
  });

  it('retains ingredient conflicts, lowers relevant confidence, and preserves provenance', () => {
    const primary = result({
      ingredients: ingredients('oats, almonds, salt'),
      field_provenance: { ingredients: [{ provider: 'open_food_facts', provider_record_id: 'off-1', source_timestamp: '2026-07-01T00:00:00.000Z', confidence: 'high' }] }
    });
    const secondary = result({
      provider: 'usda_food_data_central', provider_record_id: 'fdc-1', ingredients: ingredients('oats, sugar, flavor'),
      field_provenance: { ingredients: [{ provider: 'usda_food_data_central', provider_record_id: 'fdc-1', source_timestamp: '2026-07-02T00:00:00.000Z', confidence: 'high' }] }
    });
    const merged = mergeProductEvidence(primary, secondary);
    expect(merged.conflicts).toContain('Credible provider ingredient lists disagree.');
    expect(merged.result?.ingredients.confidence).toBe('medium');
    expect(merged.result?.field_provenance.ingredients).toHaveLength(2);
  });

  it('uses newer complete nutrition when quality is comparable but not weaker sparse nutrition', () => {
    const primary = result({ nutrition: { calories: 200, protein_g: 10, sugar_g: 5 }, provider_confidence: 'high' });
    const newerComplete = result({ nutrition: { calories: 190, protein_g: 11, sugar_g: 4 }, provider_confidence: 'high', source_timestamp: '2026-07-05T00:00:00.000Z' });
    expect(mergeProductEvidence(primary, newerComplete).result?.nutrition.calories).toBe(190);
    const newerSparse = result({ nutrition: { calories: 180 }, provider_confidence: 'high', source_timestamp: '2026-07-06T00:00:00.000Z' });
    expect(mergeProductEvidence(primary, newerSparse).result?.nutrition.calories).toBe(200);
  });

  it('keeps the production secondary source explicitly unavailable without credentials', async () => {
    await expect(unavailableSecondaryProductProvider.lookup('123456789012')).resolves.toEqual({
      status: 'unavailable', reason: 'not_configured'
    });
  });

  it('merges refreshed complete ingredients into a partial cached scanner snapshot', () => {
    const cached: HealthiProductSnapshot = {
      barcode: '0123456789012', provider: 'open_food_facts', name: 'Cocoa nut bar', brand: 'Fixture Foods',
      ingredients_text: 'dates, egg whites', ingredient_evidence: ingredients('dates, egg whites', 'partial'),
      categories_tags: ['bars'], quality_flags: [], confidence: 'medium', reason_codes: []
    };
    const refreshed: HealthiProductSnapshot = {
      ...cached, barcode: '123456789012', ingredients_text: 'dates, egg whites, almonds, cocoa, salt',
      ingredient_evidence: ingredients('dates, egg whites, almonds, cocoa, salt'),
      evidence_confidence: {
        identity: 'high', ingredients: 'high', nutrition: 'medium', serving: 'low', category: 'medium',
        product_form: 'medium', provider: 'medium', overall: 'medium'
      }
    };
    const merged = mergeProductSnapshots(cached, refreshed);
    expect(merged).toMatchObject({
      status: 'merged', snapshot: { barcode: '123456789012', ingredients_text: 'dates, egg whites, almonds, cocoa, salt' }
    });
    expect(merged.snapshot.provider_conflicts).toEqual([]);
  });

  it('retains a material formulation conflict instead of silently replacing it', () => {
    const base: HealthiProductSnapshot = {
      barcode: '123456789012', provider: 'open_food_facts', name: 'Cocoa nut bar', brand: 'Fixture Foods',
      ingredients_text: 'dates, egg whites, almonds', ingredient_evidence: ingredients('dates, egg whites, almonds'),
      quality_flags: [], confidence: 'high', reason_codes: []
    };
    const merged = mergeProductSnapshots(base, {
      ...base, ingredients_text: 'protein isolate, syrup, flavors', ingredient_evidence: ingredients('protein isolate, syrup, flavors')
    });
    expect(merged.snapshot.provider_conflicts).toContain('Credible provider ingredient lists disagree.');
    expect(merged.snapshot.evidence_confidence?.ingredients).toBe('medium');
  });
});
