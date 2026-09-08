import { describe, expect, it } from 'vitest';

import { mergeProductEvidence } from '../../../src/features/nutrition/productLookup/mergeProductEvidence';
import {
  assessMacroEnergyPlausibility,
  buildNutrientEvidenceLedger,
  derivePerServingObservation,
  nutrientObservation,
  selectedNutrition
} from '../../../src/features/nutrition/productLookup/nutrientEvidence';
import { normalizeOpenFoodFactsProduct } from '../../../src/features/nutrition/productLookup/normalizeProduct';
import type {
  NormalizedProductProviderResult,
  NutrientIdentifier,
  NutrientObservation
} from '../../../src/features/nutrition/productLookup/productDataProvider';

function observation(overrides: Partial<NutrientObservation> & Pick<NutrientObservation, 'nutrient' | 'value' | 'basis'>): NutrientObservation {
  const units: Record<NutrientIdentifier, NutrientObservation['unit']> = {
    calories: 'kcal', protein_g: 'g', carbs_g: 'g', fat_g: 'g', saturated_fat_g: 'g',
    fiber_g: 'g', sugar_g: 'g', added_sugar_g: 'g', sodium_mg: 'mg', caffeine_mg: 'mg'
  };
  return nutrientObservation({
    nutrient: overrides.nutrient,
    value: overrides.value,
    unit: overrides.unit ?? units[overrides.nutrient],
    basis: overrides.basis,
    servingQuantity: overrides.servingQuantity ?? null,
    servingUnit: overrides.servingUnit ?? null,
    packageQuantity: overrides.packageQuantity ?? null,
    packageUnit: overrides.packageUnit ?? null,
    provider: overrides.provider ?? 'fixture',
    providerRecordId: overrides.providerRecordId ?? 'record-1',
    directlyReported: overrides.directlyReported ?? true,
    derivedFrom: overrides.derivedFrom ?? [],
    conversionFormula: overrides.conversionFormula ?? null,
    conversionConfidence: overrides.conversionConfidence ?? 'high',
    confidence: overrides.confidence ?? 'high',
    sourceTimestamp: overrides.sourceTimestamp ?? '2026-01-01T00:00:00.000Z',
    rawField: overrides.rawField ?? overrides.nutrient,
    selectionReason: null
  });
}

function provider(overrides: Partial<NormalizedProductProviderResult>): NormalizedProductProviderResult {
  return {
    provider: 'fixture', provider_record_id: 'record-1', barcode: '123456789012', name: 'Generic fixture', brand: null,
    variant: null, quantity: '100 g',
    ingredients: {
      resolved_text: 'base, seasoning', raw_text: 'base, seasoning', source_field: 'ingredients_text', language: 'en',
      structured_ingredients: [], status: 'complete', confidence: 'high', reconstructed: false, conflicts: []
    },
    nutrition: {}, serving_size: '1 unit (50 g)', serving_quantity_g: 50, serving_quantity: 50, serving_unit: 'g',
    categories: [], product_form: 'ready_to_eat', source_timestamp: '2026-01-01T00:00:00.000Z',
    provider_confidence: 'high', field_provenance: {}, conflicts: [], ...overrides
  };
}

describe('nutrient basis and plausibility ledger', () => {
  it('uses bounded absolute, proportional, confidence, and rounding tolerance for macro energy', () => {
    expect(assessMacroEnergyPlausibility({
      calories: 3, proteinG: 0, carbohydrateG: 0, fatG: 0,
      confidence: 'high', directlyReported: true
    })).toMatchObject({ accepted: true, discrepancy: 3, tolerance: 9 });
    expect(assessMacroEnergyPlausibility({
      calories: 200, proteinG: 10, carbohydrateG: 30, fatG: 4,
      confidence: 'high', directlyReported: true
    })).toMatchObject({ accepted: true, estimatedCalories: 196 });
    expect(assessMacroEnergyPlausibility({
      calories: 100, proteinG: 30, carbohydrateG: 50, fatG: 20,
      confidence: 'high', directlyReported: true
    })).toMatchObject({ accepted: false, estimatedCalories: 500, discrepancy: 400 });
  });

  it('accepts rounded-zero macros and explicitly reported fiber within the bounded model', () => {
    const roundedZero = buildNutrientEvidenceLedger([
      observation({ nutrient: 'calories', value: 0, basis: 'per_serving', servingQuantity: 250, servingUnit: 'ml' }),
      observation({ nutrient: 'protein_g', value: 0.4, basis: 'per_serving', servingQuantity: 250, servingUnit: 'ml' }),
      observation({ nutrient: 'carbs_g', value: 0.4, basis: 'per_serving', servingQuantity: 250, servingUnit: 'ml' }),
      observation({ nutrient: 'fat_g', value: 0.1, basis: 'per_serving', servingQuantity: 250, servingUnit: 'ml' })
    ], { servingQuantity: 250, servingUnit: 'ml' });
    const withFiber = buildNutrientEvidenceLedger([
      observation({ nutrient: 'calories', value: 170, basis: 'per_serving', servingQuantity: 50, servingUnit: 'g' }),
      observation({ nutrient: 'protein_g', value: 5, basis: 'per_serving', servingQuantity: 50, servingUnit: 'g' }),
      observation({ nutrient: 'carbs_g', value: 35, basis: 'per_serving', servingQuantity: 50, servingUnit: 'g' }),
      observation({ nutrient: 'fat_g', value: 3, basis: 'per_serving', servingQuantity: 50, servingUnit: 'g' }),
      observation({ nutrient: 'fiber_g', value: 5, basis: 'per_serving', servingQuantity: 50, servingUnit: 'g' })
    ], { servingQuantity: 50, servingUnit: 'g' });

    expect(roundedZero.observations.every((item) => item.plausibilityFlags.length === 0)).toBe(true);
    expect(withFiber.observations.filter((item) => ['calories', 'protein_g', 'carbs_g', 'fat_g'].includes(item.nutrient)))
      .toEqual(expect.arrayContaining([expect.objectContaining({ plausibilityNotes: [expect.stringContaining('estimated 177 kcal')] })]));
  });

  it('does not compare incomplete or incompatible macro bases and retains reported calories', () => {
    const incomplete = buildNutrientEvidenceLedger([
      observation({ nutrient: 'calories', value: 120, basis: 'per_serving', servingQuantity: 50, servingUnit: 'g' }),
      observation({ nutrient: 'protein_g', value: 5, basis: 'per_serving', servingQuantity: 50, servingUnit: 'g' })
    ], { servingQuantity: 50, servingUnit: 'g' });
    const incompatible = buildNutrientEvidenceLedger([
      observation({ nutrient: 'calories', value: 120, basis: 'per_serving', servingQuantity: 50, servingUnit: 'g' }),
      observation({ nutrient: 'protein_g', value: 20, basis: 'per_100g' }),
      observation({ nutrient: 'carbs_g', value: 50, basis: 'per_100g' }),
      observation({ nutrient: 'fat_g', value: 10, basis: 'per_100g' })
    ], { servingQuantity: 50, servingUnit: 'g' });

    expect(selectedNutrition(incomplete, 'per_serving')).toMatchObject({ calories: 120, protein_g: 5 });
    expect(incomplete.observations[0]?.plausibilityNotes).toEqual([
      expect.stringContaining('macro_energy_not_compared')
    ]);
    expect(selectedNutrition(incompatible, 'per_serving').calories).toBe(120);
    expect(incompatible.observations.every((item) => !item.plausibilityFlags.includes('macronutrient_energy_mismatch'))).toBe(true);
  });

  it('applies the same macro-energy model to a compatible per-100-unit basis', () => {
    const ledger = buildNutrientEvidenceLedger([
      observation({ nutrient: 'calories', value: 200, basis: 'per_100g' }),
      observation({ nutrient: 'protein_g', value: 10, basis: 'per_100g' }),
      observation({ nutrient: 'carbs_g', value: 30, basis: 'per_100g' }),
      observation({ nutrient: 'fat_g', value: 4, basis: 'per_100g' })
    ]);

    expect(selectedNutrition(ledger, 'per_100g')).toMatchObject({ calories: 200, protein_g: 10, carbs_g: 30, fat_g: 4 });
    expect(ledger.observations.every((item) => item.plausibilityFlags.length === 0)).toBe(true);
  });
  it('requires a metric denominator for a per-serving value and never invents zero', () => {
    const normalized = normalizeOpenFoodFactsProduct('12345678', {
      product_name: 'Household serving fixture',
      serving_size: '1 cup',
      serving_quantity: 1,
      nutriments: { 'energy-kcal_serving': 120 }
    })!;

    expect(normalized.calories_per_serving).toBeNull();
    expect(normalized.nutrient_evidence?.observations).toEqual(expect.arrayContaining([
      expect.objectContaining({ basis: 'unknown', value: 120, plausibilityFlags: ['unknown_nutrient_basis'] })
    ]));
    expect(normalized.nutrient_evidence?.selections.find((item) => (
      item.nutrient === 'calories' && item.targetBasis === 'per_serving'
    ))?.selectedObservationId).toBeNull();
  });

  it('derives only between compatible per-100 and metric serving bases', () => {
    const per100g = observation({ nutrient: 'protein_g', value: 20, basis: 'per_100g' });
    const per100ml = observation({ nutrient: 'sugar_g', value: 8, basis: 'per_100ml' });

    expect(derivePerServingObservation(per100g, 50, 'g')).toMatchObject({
      value: 10, basis: 'per_serving', servingQuantity: 50, servingUnit: 'g', directlyReported: false,
      conversionFormula: expect.stringContaining('÷ 100 g')
    });
    expect(derivePerServingObservation(per100g, 50, 'ml')).toBeNull();
    expect(derivePerServingObservation(per100ml, 250, 'ml')).toMatchObject({ value: 20, servingUnit: 'ml' });
    expect(derivePerServingObservation(per100ml, 250, 'g')).toBeNull();
  });

  it('retains package values without treating them as serving values', () => {
    const normalized = normalizeOpenFoodFactsProduct('12345678', {
      product_name: 'Package fixture', quantity: '500 g', serving_size: '50 g',
      nutriments: { 'energy-kcal_package': 900 }
    })!;
    const packageObservation = normalized.nutrient_evidence?.observations.find((item) => item.basis === 'per_package');

    expect(packageObservation).toMatchObject({ value: 900, packageQuantity: 500, packageUnit: 'g', selectedFor: [] });
    expect(packageObservation?.rejectionReasons.join(' ')).toContain('not treated as a serving value');
    expect(normalized.calories_per_serving).toBeNull();
  });

  it('retains conflicting observations, leaves them unresolved, and never averages them', () => {
    const ledger = buildNutrientEvidenceLedger([
      observation({ nutrient: 'calories', value: 100, basis: 'per_serving', servingQuantity: 50, servingUnit: 'g', sourceTimestamp: '2026-01-01T00:00:00.000Z' }),
      observation({ nutrient: 'calories', value: 160, basis: 'per_serving', servingQuantity: 50, servingUnit: 'g', provider: 'open_food_facts', providerRecordId: 'record-2', sourceTimestamp: '2026-02-01T00:00:00.000Z' })
    ], { servingQuantity: 50, servingUnit: 'g' });

    expect(selectedNutrition(ledger, 'per_serving').calories).toBeNull();
    expect(ledger.conflicts).toContain('calories materially differs across compatible per_serving observations.');
    expect(ledger.observations.filter((item) => item.conflictStatus === 'material_conflict')).toHaveLength(2);
    expect(ledger.observations.map((item) => item.value)).not.toContain(130);
  });

  it('rejects suspicious observations and uses another plausible provider value', () => {
    const ledger = buildNutrientEvidenceLedger([
      observation({ nutrient: 'carbs_g', value: 10, basis: 'per_serving', servingQuantity: 50, servingUnit: 'g', provider: 'open_food_facts', providerRecordId: 'unsafe' }),
      observation({ nutrient: 'sugar_g', value: 24, basis: 'per_serving', servingQuantity: 50, servingUnit: 'g', provider: 'open_food_facts', providerRecordId: 'unsafe' }),
      observation({ nutrient: 'sugar_g', value: 5, basis: 'per_serving', servingQuantity: 50, servingUnit: 'g', providerRecordId: 'safe' }),
      observation({ nutrient: 'saturated_fat_g', value: 8, basis: 'per_serving', servingQuantity: 50, servingUnit: 'g', providerRecordId: 'fat-record' }),
      observation({ nutrient: 'fat_g', value: 2, basis: 'per_serving', servingQuantity: 50, servingUnit: 'g', providerRecordId: 'fat-record' }),
      observation({ nutrient: 'sodium_mg', value: -1, basis: 'per_serving', servingQuantity: 50, servingUnit: 'g' }),
      observation({ nutrient: 'protein_g', value: 5, basis: 'per_serving', servingQuantity: 120, servingUnit: 'g', packageQuantity: 100, packageUnit: 'g' })
    ], { servingQuantity: 50, servingUnit: 'g' });

    expect(selectedNutrition(ledger, 'per_serving').sugar_g).toBe(5);
    expect(ledger.observations.find((item) => item.providerRecordId === 'unsafe' && item.nutrient === 'sugar_g')?.plausibilityFlags)
      .toContain('sugar_exceeds_total_carbohydrate');
    expect(ledger.observations.find((item) => item.nutrient === 'saturated_fat_g')?.plausibilityFlags)
      .toContain('saturated_fat_exceeds_total_fat');
    expect(ledger.observations.find((item) => item.nutrient === 'sodium_mg')?.plausibilityFlags)
      .toContain('impossible_negative_value');
    expect(ledger.observations.find((item) => item.nutrient === 'protein_g')?.plausibilityFlags)
      .toEqual(expect.arrayContaining(['serving_exceeds_package_quantity', 'selected_serving_context_mismatch']));
  });

  it('does not let duplicate provider aliases bypass a cross-field plausibility rejection', () => {
    const macro = (nutrient: NutrientIdentifier, value: number, rawField: string) => observation({
      nutrient,
      value,
      basis: 'per_serving',
      servingQuantity: 283,
      servingUnit: 'g',
      rawField
    });
    const ledger = buildNutrientEvidenceLedger([
      macro('calories', 260, 'energy-kcal_serving'),
      macro('calories', 260.1, 'energy_kcal_serving'),
      macro('protein_g', 53.8, 'proteins_serving'),
      macro('protein_g', 53.8, 'proteins_100g_derived'),
      macro('carbs_g', 110, 'carbohydrates_serving'),
      macro('carbs_g', 110.4, 'carbohydrates_100g_derived'),
      macro('fat_g', 9.9, 'fat_serving'),
      macro('fat_g', 9.9, 'fat_100g_derived')
    ], { servingQuantity: 283, servingUnit: 'g' });

    expect(selectedNutrition(ledger, 'per_serving')).toMatchObject({
      calories: null,
      protein_g: null,
      carbs_g: null,
      fat_g: null
    });
    expect(ledger.observations.every((item) => (
      item.plausibilityFlags.includes('macronutrient_energy_mismatch') && item.selectedFor.length === 0
    ))).toBe(true);
  });

  it('merges direct and derived observations field by field with a complete rejected ledger', () => {
    const olderDirect = buildNutrientEvidenceLedger([
      observation({ nutrient: 'protein_g', value: 8, basis: 'per_serving', servingQuantity: 50, servingUnit: 'g', sourceTimestamp: '2026-01-01T00:00:00.000Z' })
    ], { servingQuantity: 50, servingUnit: 'g' });
    const per100 = observation({
      nutrient: 'protein_g', value: 20, basis: 'per_100g', provider: 'open_food_facts', providerRecordId: 'record-2',
      sourceTimestamp: '2026-02-01T00:00:00.000Z'
    });
    const newerDerived = buildNutrientEvidenceLedger([
      per100,
      derivePerServingObservation(per100, 50, 'g')!
    ], { servingQuantity: 50, servingUnit: 'g' });
    const merged = mergeProductEvidence(
      provider({ nutrient_evidence: olderDirect, nutrition: { protein_g: 8 } }),
      provider({ provider: 'open_food_facts', provider_record_id: 'record-2', nutrient_evidence: newerDerived, nutrition: { protein_g: 10 }, source_timestamp: '2026-02-01T00:00:00.000Z' })
    );

    expect(merged.result?.nutrition.protein_g).toBe(8);
    expect(merged.result?.nutrient_evidence?.observations).toHaveLength(3);
    expect(merged.result?.nutrient_evidence?.selections.find((item) => (
      item.nutrient === 'protein_g' && item.targetBasis === 'per_serving'
    ))).toMatchObject({ selectedObservationId: expect.any(String), rejectedObservationIds: [expect.any(String)] });
  });
});
