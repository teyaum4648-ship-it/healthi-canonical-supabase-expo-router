import type {
  DataConfidence,
  FoodQualityFlag,
  NutritionReasonCode
} from '../../../engines/nutrition';
import type {
  ProductBetterOption,
  ProductEvidenceRef,
  ProductGradeBand,
  ProductLetterGrade,
  ProductProcessingTier,
  ProductScoreFactor
} from '../../../engines/nutrition/productScoring';

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
  labels?: string[];
  categories_tags?: string[];
  packaging_tags?: string[];
  nutriments_per_100g?: {
    calories?: number | null;
    sugar_g?: number | null;
    protein_g?: number | null;
    fiber_g?: number | null;
    sodium_mg?: number | null;
    saturated_fat_g?: number | null;
  };
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
  absolute_score?: number | null;
  category_score?: number | null;
  category_id?: string | null;
  category_label?: string | null;
  processing_tier?: ProductProcessingTier | null;
  processing_tier_label?: string | null;
  factors?: ProductScoreFactor[];
  limiting_factor?: { rule_id: string; label: string; cap: number } | null;
  scoring_reason_codes?: string[];
  letter_grade?: ProductLetterGrade | null;
  grade_band?: ProductGradeBand;
  grade_label?: string;
  better_options?: ProductBetterOption[];
  evidence_refs?: ProductEvidenceRef[];
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
