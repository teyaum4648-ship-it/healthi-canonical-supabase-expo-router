import type { DataConfidence } from '../../../engines/nutrition';
import type { IngredientEvidence } from './ingredientEvidenceResolver';
import type { NutritionValidationResult } from './nutritionValidation';

export type ProductEvidenceProviderId = 'open_food_facts' | 'healthi_verified' | 'usda_food_data_central' | 'fixture';

export type NutrientIdentifier =
  | 'calories'
  | 'protein_g'
  | 'carbs_g'
  | 'fat_g'
  | 'saturated_fat_g'
  | 'fiber_g'
  | 'sugar_g'
  | 'added_sugar_g'
  | 'sodium_mg'
  | 'caffeine_mg';

export type NutrientBasis = 'per_serving' | 'per_100g' | 'per_100ml' | 'per_package' | 'unknown';
export type NutrientMetricUnit = 'g' | 'ml';
export type NutrientConflictStatus = 'none' | 'compatible_duplicate' | 'material_conflict' | 'suspicious';

export type NutrientObservation = {
  id: string;
  nutrient: NutrientIdentifier;
  value: number;
  unit: 'kcal' | 'g' | 'mg';
  basis: NutrientBasis;
  servingQuantity?: number | null;
  servingUnit?: NutrientMetricUnit | null;
  packageQuantity?: number | null;
  packageUnit?: NutrientMetricUnit | null;
  provider: ProductEvidenceProviderId;
  providerRecordId: string | null;
  directlyReported: boolean;
  derivedFrom?: string[];
  conversionFormula?: string | null;
  conversionConfidence?: DataConfidence;
  confidence: DataConfidence;
  sourceTimestamp: string | null;
  rawField: string;
  selectionReason?: string | null;
  conflictStatus: NutrientConflictStatus;
  plausibilityFlags: string[];
  plausibilityNotes: string[];
  selectedFor: Array<'per_serving' | 'per_100g' | 'per_100ml'>;
  rejectionReasons: string[];
};

export type NutrientSelection = {
  nutrient: NutrientIdentifier;
  targetBasis: 'per_serving' | 'per_100g' | 'per_100ml';
  selectedObservationId: string | null;
  rejectedObservationIds: string[];
  selectionReason: string;
  conflictStatus: NutrientConflictStatus;
};

export type NutrientEvidenceLedger = {
  version: 'nutrient_evidence_v1';
  observations: NutrientObservation[];
  selections: NutrientSelection[];
  conflicts: string[];
};
export type ProductEvidenceField =
  | 'name'
  | 'brand'
  | 'variant'
  | 'ingredients'
  | 'nutrition'
  | 'calories'
  | 'protein_g'
  | 'carbs_g'
  | 'fat_g'
  | 'saturated_fat_g'
  | 'fiber_g'
  | 'sugar_g'
  | 'added_sugar_g'
  | 'sodium_mg'
  | 'caffeine_mg'
  | 'serving'
  | 'serving_quantity'
  | 'serving_unit'
  | 'category'
  | 'product_form'
  | 'quantity';

export type ProductFieldProvenance = {
  provider: ProductEvidenceProviderId;
  provider_record_id: string | null;
  source_timestamp: string | null;
  confidence: DataConfidence;
  raw_field?: string | null;
  selected?: boolean;
  selection_reason?: string | null;
};

export type NormalizedProviderNutrition = {
  calories?: number | null;
  protein_g?: number | null;
  carbs_g?: number | null;
  fat_g?: number | null;
  saturated_fat_g?: number | null;
  fiber_g?: number | null;
  sugar_g?: number | null;
  added_sugar_g?: number | null;
  sodium_mg?: number | null;
  caffeine_mg?: number | null;
};

export type NormalizedProductProviderResult = {
  provider: ProductEvidenceProviderId;
  provider_record_id: string | null;
  barcode: string;
  name: string | null;
  brand: string | null;
  variant: string | null;
  quantity: string | null;
  ingredients: IngredientEvidence;
  nutrition: NormalizedProviderNutrition;
  nutrient_evidence?: NutrientEvidenceLedger;
  nutrition_validation?: NutritionValidationResult;
  serving_size: string | null;
  serving_quantity_g: number | null;
  serving_quantity?: number | null;
  serving_unit?: string | null;
  package_quantity?: number | null;
  package_unit?: string | null;
  categories: string[];
  product_form: string | null;
  source_timestamp: string | null;
  provider_confidence: DataConfidence;
  field_provenance: Partial<Record<ProductEvidenceField, ProductFieldProvenance[]>>;
  conflicts: string[];
  missing_fields?: string[];
};

export type ProductDataProviderLookup =
  | { status: 'found'; result: NormalizedProductProviderResult }
  | { status: 'not_found' }
  | { status: 'unavailable'; reason: 'not_configured' | 'temporarily_unavailable' };

export type ProductDataProvider = {
  id: ProductEvidenceProviderId;
  lookup(barcode: string): Promise<ProductDataProviderLookup>;
};

export const unavailableSecondaryProductProvider: ProductDataProvider = {
  id: 'usda_food_data_central',
  async lookup() {
    return { status: 'unavailable', reason: 'not_configured' };
  }
};
