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
  ProductMacroContext,
  ProductNutrientBasis,
  ProductForm,
  ProductProcessingTier,
  ProductScoreFactor
} from '../../../engines/nutrition/productScoring';
import type { IngredientEvidence } from './ingredientEvidenceResolver';
import type { ProductEvidenceField, ProductFieldProvenance } from './productDataProvider';
import type { LabEvidenceRecord, LabEvidenceReferenceSnapshot, LabEvidenceResolution } from '../labEvidence/labEvidenceTypes';

export type ProductProvider = 'open_food_facts' | 'manual' | 'demo';

export type ProductEvidenceConfidence = {
  identity: DataConfidence;
  ingredients: DataConfidence;
  nutrition: DataConfidence;
  serving: DataConfidence;
  category: DataConfidence;
  product_form: DataConfidence;
  provider: DataConfidence;
  overall: DataConfidence;
};

export type HealthiProductSnapshot = {
  barcode: string;
  provider: ProductProvider;
  provider_product_id?: string | null;
  canonical_barcode?: string;
  name: string;
  brand?: string | null;
  variant?: string | null;
  quantity?: string | null;
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
  ingredient_evidence?: IngredientEvidence;
  evidence_confidence?: ProductEvidenceConfidence;
  provider_updated_at?: string | null;
  provider_completeness?: number | null;
  provider_quality_tags?: string[];
  field_provenance?: Partial<Record<ProductEvidenceField, ProductFieldProvenance[]>>;
  provider_conflicts?: string[];
  /** Legacy records are read-only and never trusted without server revalidation. */
  lab_evidence?: LabEvidenceRecord[];
  lab_evidence_resolution?: LabEvidenceResolution;
  lab_evidence_reference?: LabEvidenceReferenceSnapshot;
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
  category_comparison_available?: boolean;
  product_form?: ProductForm | null;
  prepared_use?: string | null;
  nutrient_basis?: Omit<ProductNutrientBasis, 'nutrients'>;
  macro_context?: ProductMacroContext;
  top_drivers?: ProductScoreFactor[];
  source_confidence?: DataConfidence;
  interpretation_confidence?: DataConfidence;
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
  result_state?: 'final' | 'estimated' | 'more_data_needed';
  estimated_grade_range?: [ProductLetterGrade, ProductLetterGrade] | null;
  missing_evidence?: string[];
  evidence_confidence?: ProductEvidenceConfidence;
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
