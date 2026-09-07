import type { DataConfidence } from '../../../engines/nutrition';
import { canonicalBarcodeIdentity } from './barcodeUtils';
import type { IngredientEvidence } from './ingredientEvidenceResolver';
import type {
  NormalizedProductProviderResult,
  ProductEvidenceField,
  ProductFieldProvenance
} from './productDataProvider';
import type { HealthiProductSnapshot } from './productLookupTypes';
import {
  combineNutrientEvidence,
  legacyNutrientObservations,
  metricServing,
  nutrientEvidenceConfidence,
  selectedNutrition
} from './nutrientEvidence';
import { resolveProductIdentity } from './nutritionValidation';

export type ProductEvidenceMergeResult = {
  status: 'merged' | 'rejected';
  result: NormalizedProductProviderResult | null;
  conflicts: string[];
};

const confidenceRank: Record<DataConfidence, number> = { low: 0, medium: 1, high: 2 };

function normalized(value: string | null): string {
  return (value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function timestamp(value: string | null): number {
  const parsed = value ? new Date(value).getTime() : NaN;
  return Number.isFinite(parsed) ? parsed : 0;
}

function ingredientRank(evidence: IngredientEvidence): number {
  if (evidence.status === 'complete' && !evidence.reconstructed) return 4;
  if (evidence.status === 'partial' && !evidence.reconstructed) return 3;
  if (evidence.status === 'reconstructed') return 2;
  return 0;
}

function preferIngredients(primary: NormalizedProductProviderResult, secondary: NormalizedProductProviderResult): IngredientEvidence {
  const left = primary.ingredients;
  const right = secondary.ingredients;
  const leftRank = ingredientRank(left);
  const rightRank = ingredientRank(right);
  if (rightRank !== leftRank) return rightRank > leftRank ? right : left;
  if (confidenceRank[right.confidence] !== confidenceRank[left.confidence]) {
    return confidenceRank[right.confidence] > confidenceRank[left.confidence] ? right : left;
  }
  return timestamp(secondary.source_timestamp) > timestamp(primary.source_timestamp) ? right : left;
}

function fieldSources(
  field: ProductEvidenceField,
  primary: NormalizedProductProviderResult,
  secondary: NormalizedProductProviderResult
): ProductFieldProvenance[] {
  const values = [...(primary.field_provenance[field] ?? []), ...(secondary.field_provenance[field] ?? [])];
  return values.filter((value, index) => values.findIndex((candidate) => (
    candidate.provider === value.provider && candidate.provider_record_id === value.provider_record_id
  )) === index);
}

function withLowerConfidence(evidence: IngredientEvidence): IngredientEvidence {
  return { ...evidence, confidence: evidence.confidence === 'high' ? 'medium' : 'low' };
}

function normalizedServing(result: NormalizedProductProviderResult): { quantity: number; unit: 'g' | 'ml' } | null {
  const unit = result.serving_unit?.trim().toLowerCase();
  if (typeof result.serving_quantity === 'number' && result.serving_quantity > 0 && (unit === 'g' || unit === 'ml')) {
    return { quantity: result.serving_quantity, unit };
  }
  return typeof result.serving_quantity_g === 'number' && result.serving_quantity_g > 0
    ? { quantity: result.serving_quantity_g, unit: 'g' }
    : null;
}

function preferredServing(
  primary: NormalizedProductProviderResult,
  secondary: NormalizedProductProviderResult
): { result: NormalizedProductProviderResult; quantity: number; unit: 'g' | 'ml' } | null {
  const candidates = [primary, secondary].flatMap((result) => {
    const serving = normalizedServing(result);
    return serving ? [{ result, ...serving }] : [];
  });
  return candidates.sort((left, right) => (
    confidenceRank[right.result.provider_confidence] - confidenceRank[left.result.provider_confidence] ||
    timestamp(right.result.source_timestamp) - timestamp(left.result.source_timestamp) ||
    left.result.provider.localeCompare(right.result.provider)
  ))[0] ?? null;
}

function evidenceLedger(result: NormalizedProductProviderResult) {
  if (result.nutrient_evidence) return result.nutrient_evidence;
  const serving = normalizedServing(result);
  return combineNutrientEvidence([], legacyNutrientObservations({
    nutrition: result.nutrition,
    provider: result.provider,
    providerRecordId: result.provider_record_id,
    servingQuantity: serving?.quantity ?? null,
    servingUnit: serving?.unit ?? null,
    sourceTimestamp: result.source_timestamp,
    confidence: result.provider_confidence
  }), serving ? { servingQuantity: serving.quantity, servingUnit: serving.unit } : undefined);
}

export function mergeProductEvidence(
  primary: NormalizedProductProviderResult,
  secondary: NormalizedProductProviderResult
): ProductEvidenceMergeResult {
  const conflicts: string[] = [];
  if (canonicalBarcodeIdentity(primary.barcode) !== canonicalBarcodeIdentity(secondary.barcode)) {
    return { status: 'rejected', result: null, conflicts: ['Provider records do not share an exact normalized barcode.'] };
  }
  const identityResolution = resolveProductIdentity({
    barcodeMatch: true,
    primaryBrand: primary.brand,
    secondaryBrand: secondary.brand,
    primaryName: primary.name,
    secondaryName: secondary.name,
    primaryIngredients: primary.ingredients.resolved_text,
    secondaryIngredients: secondary.ingredients.resolved_text
  });
  if (!identityResolution.accepted) {
    return {
      status: 'rejected',
      result: null,
      conflicts: ['Exact-barcode records lacked enough corroborating identity evidence for a safe field-level merge.']
    };
  }
  if (primary.brand && secondary.brand && normalized(primary.brand) !== normalized(secondary.brand)) {
    conflicts.push('Exact-barcode provider records use different brand text.');
  }
  if (primary.variant && secondary.variant && normalized(primary.variant) !== normalized(secondary.variant)) {
    conflicts.push('Exact-barcode provider records use different variant text.');
  }
  if (primary.name && secondary.name && normalized(primary.name) !== normalized(secondary.name)) {
    conflicts.push('Exact-barcode provider records use different product-name text.');
  }

  let ingredients = preferIngredients(primary, secondary);
  const primaryIngredients = normalized(primary.ingredients.resolved_text);
  const secondaryIngredients = normalized(secondary.ingredients.resolved_text);
  const oneIngredientListExtendsTheOther = primaryIngredients.includes(secondaryIngredients) || secondaryIngredients.includes(primaryIngredients);
  if (primaryIngredients && secondaryIngredients && primaryIngredients !== secondaryIngredients && !oneIngredientListExtendsTheOther) {
    conflicts.push('Credible provider ingredient lists disagree.');
    ingredients = withLowerConfidence({ ...ingredients, conflicts: [...ingredients.conflicts, 'Credible provider ingredient lists disagree.'] });
  }
  const serving = preferredServing(primary, secondary);
  const nutrientEvidence = combineNutrientEvidence(
    [evidenceLedger(primary), evidenceLedger(secondary)],
    [],
    serving ? { servingQuantity: serving.quantity, servingUnit: serving.unit } : undefined
  );
  const nutrition = selectedNutrition(nutrientEvidence, 'per_serving');
  conflicts.push(...nutrientEvidence.conflicts);
  const primaryServing = normalizedServing(primary);
  const secondaryServing = normalizedServing(secondary);
  if (primaryServing && secondaryServing && (
    primaryServing.unit !== secondaryServing.unit ||
    Math.abs(primaryServing.quantity - secondaryServing.quantity) > Math.max(1, primaryServing.quantity * 0.05)
  )) {
    conflicts.push('Serving quantity materially differs across exact-barcode provider records.');
  }
  const fields: ProductEvidenceField[] = [
    'name', 'brand', 'variant', 'ingredients', 'nutrition', 'serving', 'category', 'product_form',
    'calories', 'protein_g', 'carbs_g', 'fat_g', 'saturated_fat_g', 'fiber_g', 'sugar_g',
    'added_sugar_g', 'sodium_mg', 'caffeine_mg'
  ];
  const field_provenance = Object.fromEntries(fields.map((field) => [field, fieldSources(field, primary, secondary)]));

  return {
    status: 'merged',
    conflicts,
    result: {
      ...primary,
      barcode: canonicalBarcodeIdentity(primary.barcode),
      name: primary.name ?? secondary.name,
      brand: primary.brand ?? secondary.brand,
      variant: primary.variant ?? secondary.variant,
      quantity: primary.quantity ?? secondary.quantity,
      ingredients,
      nutrition,
      nutrient_evidence: nutrientEvidence,
      nutrition_validation: primary.nutrition_validation ?? secondary.nutrition_validation,
      serving_size: serving?.result.serving_size ?? primary.serving_size ?? secondary.serving_size,
      serving_quantity_g: serving?.unit === 'g' ? serving.quantity : null,
      serving_quantity: serving?.quantity ?? null,
      serving_unit: serving?.unit ?? null,
      categories: [...new Set([...primary.categories, ...secondary.categories])],
      product_form: primary.product_form ?? secondary.product_form,
      provider_confidence: conflicts.length > 0 ? 'medium' : primary.provider_confidence,
      field_provenance,
      conflicts: [...new Set([...primary.conflicts, ...secondary.conflicts, ...conflicts])],
      missing_fields: [...new Set([...(primary.missing_fields ?? []), ...(secondary.missing_fields ?? [])])]
    }
  };
}

function providerId(snapshot: HealthiProductSnapshot): NormalizedProductProviderResult['provider'] {
  if (snapshot.provider === 'open_food_facts' || snapshot.provider === 'usda_food_data_central') return snapshot.provider;
  return 'fixture';
}

function provenanceFor(snapshot: HealthiProductSnapshot): NormalizedProductProviderResult['field_provenance'] {
  if (snapshot.field_provenance) return snapshot.field_provenance;
  const base = {
    provider: providerId(snapshot), provider_record_id: snapshot.provider_product_id ?? null,
    source_timestamp: snapshot.provider_updated_at ?? null, confidence: snapshot.confidence
  };
  return Object.fromEntries((['name', 'brand', 'variant', 'ingredients', 'nutrition', 'serving', 'category', 'product_form'] as ProductEvidenceField[])
    .map((field) => [field, [{ ...base }]]));
}

function snapshotResult(snapshot: HealthiProductSnapshot): NormalizedProductProviderResult {
  return {
    provider: providerId(snapshot), provider_record_id: snapshot.provider_product_id ?? null,
    barcode: snapshot.canonical_barcode ?? canonicalBarcodeIdentity(snapshot.barcode), name: snapshot.name, brand: snapshot.brand ?? null,
    variant: snapshot.variant ?? null, quantity: snapshot.quantity ?? null,
    ingredients: snapshot.ingredient_evidence ?? {
      resolved_text: snapshot.ingredients_text ?? null, raw_text: snapshot.ingredients_text ?? null, source_field: snapshot.ingredients_text ? 'ingredients_text' : null,
      language: null, structured_ingredients: [], status: snapshot.ingredients_text ? 'partial' : 'absent',
      confidence: snapshot.evidence_confidence?.ingredients ?? 'low', reconstructed: false, conflicts: []
    },
    nutrition: {
      calories: snapshot.calories_per_serving, protein_g: snapshot.protein_g, carbs_g: snapshot.carbs_g, fat_g: snapshot.fat_g,
      saturated_fat_g: snapshot.saturated_fat_g, fiber_g: snapshot.fiber_g, sugar_g: snapshot.sugar_g,
      added_sugar_g: snapshot.added_sugar_g, sodium_mg: snapshot.sodium_mg, caffeine_mg: snapshot.caffeine_mg
    },
    nutrient_evidence: snapshot.nutrient_evidence,
    serving_size: snapshot.serving_size ?? null, serving_quantity_g: snapshot.serving_quantity_g ?? null,
    serving_quantity: snapshot.serving_quantity ?? snapshot.serving_quantity_g ?? null,
    serving_unit: snapshot.serving_unit ?? (snapshot.serving_quantity_g ? 'g' : null),
    categories: [...(snapshot.categories_tags ?? [])], product_form: null, source_timestamp: snapshot.provider_updated_at ?? null,
    provider_confidence: snapshot.evidence_confidence?.provider ?? snapshot.confidence,
    field_provenance: provenanceFor(snapshot), conflicts: [...(snapshot.provider_conflicts ?? [])]
  };
}

function moreCompletePer100g(primary: HealthiProductSnapshot, secondary: HealthiProductSnapshot): HealthiProductSnapshot['nutriments_per_100g'] {
  const count = (value: HealthiProductSnapshot['nutriments_per_100g']) => Object.values(value ?? {}).filter((item) => typeof item === 'number').length;
  return count(secondary.nutriments_per_100g) > count(primary.nutriments_per_100g)
    ? secondary.nutriments_per_100g ? { ...secondary.nutriments_per_100g } : undefined
    : primary.nutriments_per_100g ? { ...primary.nutriments_per_100g } : undefined;
}

export function mergeProductSnapshots(
  stored: HealthiProductSnapshot,
  refreshed: HealthiProductSnapshot
): { status: 'merged' | 'rejected'; snapshot: HealthiProductSnapshot } {
  const merged = mergeProductEvidence(snapshotResult(stored), snapshotResult(refreshed));
  if (merged.status === 'rejected' || !merged.result) {
    return {
      status: 'rejected',
      snapshot: { ...refreshed, provider_conflicts: [...new Set([...(refreshed.provider_conflicts ?? []), ...merged.conflicts])] }
    };
  }
  const result = merged.result;
  const selectedPer100g = result.nutrient_evidence ? selectedNutrition(result.nutrient_evidence, 'per_100g') : null;
  const selectedPer100ml = result.nutrient_evidence ? selectedNutrition(result.nutrient_evidence, 'per_100ml') : null;
  const hasSelectedValues = (value: Record<string, unknown> | null) => value && Object.values(value).some((item) => typeof item === 'number');
  const latestTimestamp = timestamp(refreshed.provider_updated_at ?? null) >= timestamp(stored.provider_updated_at ?? null)
    ? refreshed.provider_updated_at ?? stored.provider_updated_at ?? null
    : stored.provider_updated_at ?? null;
  return {
    status: 'merged',
    snapshot: {
      ...refreshed,
      barcode: canonicalBarcodeIdentity(result.barcode), canonical_barcode: canonicalBarcodeIdentity(result.barcode),
      name: result.name ?? refreshed.name, brand: result.brand, variant: result.variant, quantity: result.quantity,
      ingredients_text: result.ingredients.resolved_text, ingredient_evidence: result.ingredients,
      ingredient_tokens: refreshed.ingredient_tokens ?? stored.ingredient_tokens,
      additive_signals: refreshed.additive_signals ?? stored.additive_signals,
      calories_per_serving: result.nutrition.calories ?? null, protein_g: result.nutrition.protein_g ?? null,
      carbs_g: result.nutrition.carbs_g ?? null, fat_g: result.nutrition.fat_g ?? null,
      saturated_fat_g: result.nutrition.saturated_fat_g ?? null, fiber_g: result.nutrition.fiber_g ?? null,
      sugar_g: result.nutrition.sugar_g ?? null, added_sugar_g: result.nutrition.added_sugar_g ?? null,
      sodium_mg: result.nutrition.sodium_mg ?? null, caffeine_mg: result.nutrition.caffeine_mg ?? null,
      nutrient_evidence: result.nutrient_evidence,
      serving_size: result.serving_size, serving_quantity_g: result.serving_quantity_g,
      serving_quantity: result.serving_quantity ?? refreshed.serving_quantity ?? stored.serving_quantity,
      serving_unit: result.serving_unit ?? refreshed.serving_unit ?? stored.serving_unit,
      serving_equivalent: refreshed.serving_equivalent ?? stored.serving_equivalent,
      categories_tags: result.categories, labels: [...new Set([...(stored.labels ?? []), ...(refreshed.labels ?? [])])],
      packaging_tags: [...new Set([...(stored.packaging_tags ?? []), ...(refreshed.packaging_tags ?? [])])],
      nutriments_per_100g: result.nutrient_evidence
        ? hasSelectedValues(selectedPer100g) ? { ...selectedPer100g } : undefined
        : moreCompletePer100g(stored, refreshed),
      nutriments_per_100ml: result.nutrient_evidence
        ? hasSelectedValues(selectedPer100ml) ? { ...selectedPer100ml } : undefined
        : refreshed.nutriments_per_100ml ?? stored.nutriments_per_100ml,
      provider_updated_at: latestTimestamp,
      field_provenance: result.field_provenance, provider_conflicts: result.conflicts,
      provider_missing_fields: [...new Set([...(stored.provider_missing_fields ?? []), ...(refreshed.provider_missing_fields ?? [])])],
      provider_resolution: refreshed.provider_resolution ?? stored.provider_resolution,
      evidence_confidence: {
        ...(refreshed.evidence_confidence ?? stored.evidence_confidence!),
        ingredients: result.ingredients.confidence,
        nutrition: result.nutrient_evidence
          ? nutrientEvidenceConfidence(result.nutrient_evidence)
          : result.field_provenance.nutrition?.some((item) => item.confidence === 'high') ? 'high' : refreshed.evidence_confidence?.nutrition ?? 'medium',
        serving: normalizedServing(result) ? refreshed.evidence_confidence?.serving ?? stored.evidence_confidence?.serving ?? 'medium' : 'low',
        overall: result.conflicts.length > 0 ? 'medium' : refreshed.evidence_confidence?.overall ?? stored.evidence_confidence?.overall ?? 'medium'
      }
    }
  };
}
