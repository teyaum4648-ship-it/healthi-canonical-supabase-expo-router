import type {
  DataConfidence,
  FoodQualityFlag,
  NutritionReasonCode
} from '../../../engines/nutrition';

export type ProductProvider = 'open_food_facts' | 'manual' | 'demo';

export type HealthiProductSnapshot = {
  barcode: string;
  provider: ProductProvider;
  provider_product_id?: string | null;
  name: string;
  brand?: string | null;
  serving_size?: string | null;
  serving_quantity_g?: number | null;
  calories_per_serving?: number | null;
  protein_g?: number | null;
  carbs_g?: number | null;
  fat_g?: number | null;
  saturated_fat_g?: number | null;
  fiber_g?: number | null;
  sugar_g?: number | null;
  sodium_mg?: number | null;
  ingredients_text?: string | null;
  quality_flags: FoodQualityFlag[];
  confidence: DataConfidence;
  reason_codes: NutritionReasonCode[];
};

export type ProductQualitySnapshot = {
  score: number | null;
  label: 'supportive' | 'steady' | 'watch' | 'calibrating';
  summary: string;
  positives: string[];
  considerations: string[];
  confidence: DataConfidence;
  reason_codes: NutritionReasonCode[];
};

export type ProductLookupResult =
  | { status: 'found'; product: HealthiProductSnapshot }
  | { status: 'not_found'; barcode: string; message: string }
  | {
      status: 'error';
      barcode: string;
      code: 'invalid_barcode' | 'network_error' | 'provider_error' | 'malformed_response';
      message: string;
    };
