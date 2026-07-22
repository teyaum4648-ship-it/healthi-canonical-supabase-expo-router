import type { DataConfidence } from '../../../engines/nutrition';
import type { IngredientEvidence } from './ingredientEvidenceResolver';

export type ProductEvidenceProviderId = 'open_food_facts' | 'healthi_verified' | 'usda_food_data_central' | 'fixture';
export type ProductEvidenceField = 'name' | 'brand' | 'variant' | 'ingredients' | 'nutrition' | 'serving' | 'category' | 'product_form';

export type ProductFieldProvenance = {
  provider: ProductEvidenceProviderId;
  provider_record_id: string | null;
  source_timestamp: string | null;
  confidence: DataConfidence;
};

export type NormalizedProviderNutrition = {
  calories?: number | null;
  protein_g?: number | null;
  carbs_g?: number | null;
  fat_g?: number | null;
  saturated_fat_g?: number | null;
  fiber_g?: number | null;
  sugar_g?: number | null;
  sodium_mg?: number | null;
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
  serving_size: string | null;
  serving_quantity_g: number | null;
  categories: string[];
  product_form: string | null;
  source_timestamp: string | null;
  provider_confidence: DataConfidence;
  field_provenance: Partial<Record<ProductEvidenceField, ProductFieldProvenance[]>>;
  conflicts: string[];
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
