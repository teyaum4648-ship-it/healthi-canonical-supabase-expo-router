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
  ProductScoreFactor,
  ProductArchetype,
  ProductDimensionScore,
  ProductScoreScope,
  ProductScoreDimension,
  ProductScoreLedgerEntry,
  ProductScoreEligibility,
  ProductGradeEligibility,
  ProductGradeCertainty,
  ProductQualityEngineVersion,
  CategoryResolution
} from '../../../engines/nutrition/productScoring';
import type { IngredientEvidence } from './ingredientEvidenceResolver';
import type { NutrientEvidenceLedger, ProductEvidenceField, ProductFieldProvenance } from './productDataProvider';
import type {
  NutritionValidationResult,
  ProductIdentityResolution,
  ProviderResolutionTrace,
  ValidationIssue
} from './nutritionValidation';
import type { LabEvidenceRecord, LabEvidenceReferenceSnapshot, LabEvidenceResolution } from '../labEvidence/labEvidenceTypes';

export type ProductProvider = 'open_food_facts' | 'usda_food_data_central' | 'manual' | 'demo';

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

export type ProductEvidenceSufficiencySnapshot = {
  level: 'full' | 'good' | 'partial' | 'minimum_defensible' | 'abstain';
  supports_bounded_interpretation: boolean;
  exact_identity_established: boolean;
  ingredient_token_count: number;
  selected_nutrient_count: number;
  metric_serving_available: boolean;
  category_context_available: boolean;
  material_conflict: boolean;
  supported_evidence_domains: string[];
  unsupported_evidence_domains: string[];
  reasons: string[];
};

export type ProductResolutionTraceSnapshot = {
  version: 'product_resolution_trace_v2' | 'product_resolution_trace_v3';
  normalized_gtin: string;
  cache: {
    attempted: boolean;
    result: 'miss' | 'invalid' | 'fresh_sufficient' | 'fresh_insufficient' | 'stale_sufficient' | 'stale_insufficient';
    sufficiency: ProductEvidenceSufficiencySnapshot | null;
  };
  source_a: {
    provider: 'open_food_facts';
    attempted: boolean;
    result: 'skipped' | 'found' | 'not_found' | 'unavailable';
    selected_fields: string[];
    rejected_fields: string[];
    attempt_count: number;
    http_statuses: number[];
    failure_reason: string | null;
  };
  source_b: {
    provider: 'usda_food_data_central';
    attempted: boolean;
    result: 'skipped' | 'found' | 'not_found' | 'unavailable';
    invocation_reason: 'source_a_unavailable' | 'source_a_not_found' | 'source_a_materially_insufficient' | 'source_a_validation_failed' | 'not_required_source_a_sufficient' | 'not_configured';
    selected_fields: string[];
    rejected_fields: string[];
    attempt_count: number;
    http_statuses: number[];
    failure_reason: string | null;
  };
  merge: {
    attempted: boolean;
    exact_identity_compatible: boolean;
    identity_confidence?: number | null;
    identity_resolution?: ProductIdentityResolution | null;
    selected_fields: Record<'open_food_facts' | 'usda_food_data_central', string[]>;
    rejected_fields: Record<'open_food_facts' | 'usda_food_data_central', string[]>;
    conflicts: string[];
  };
  sufficiency_before_source_b: ProductEvidenceSufficiencySnapshot | null;
  sufficiency_after_source_b: ProductEvidenceSufficiencySnapshot | null;
  final_scoring_scope: 'overall' | 'supported_evidence' | 'none';
  final_result_state: 'resolved' | 'more_data_needed' | 'identity_unresolved' | 'provider_unavailable';
  abstention_reason: string | null;
};

export type HealthiProductSnapshot = {
  /** Provider photo for identification only; not scoring evidence. */
  image_url?: string | null;
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
  serving_quantity?: number | null;
  serving_unit?: string | null;
  serving_equivalent?: string | null;
  /** Reported household portions for food logging, not inferred from names. */
  food_portions?: Array<{ label: string; quantity: number; unit: 'g' | 'mL' }>;
  food_data_type?: string;
  calories_per_serving?: number | null;
  protein_g?: number | null;
  carbs_g?: number | null;
  fat_g?: number | null;
  saturated_fat_g?: number | null;
  fiber_g?: number | null;
  sugar_g?: number | null;
  added_sugar_g?: number | null;
  sodium_mg?: number | null;
  caffeine_mg?: number | null;
  ingredients_text?: string | null;
  ingredient_tokens?: string[];
  additive_signals?: string[];
  ingredient_evidence?: IngredientEvidence;
  evidence_confidence?: ProductEvidenceConfidence;
  provider_updated_at?: string | null;
  provider_completeness?: number | null;
  provider_quality_tags?: string[];
  field_provenance?: Partial<Record<ProductEvidenceField, ProductFieldProvenance[]>>;
  provider_conflicts?: string[];
  provider_missing_fields?: string[];
  nutrient_evidence?: NutrientEvidenceLedger;
  nutrition_validation?: NutritionValidationResult;
  validation_issues?: ValidationIssue[];
  provider_resolution_trace?: ProviderResolutionTrace[];
  product_identity_resolution?: ProductIdentityResolution | null;
  provider_resolution?: {
    version: 'product_data_resolver_v1' | 'product_data_resolver_v2' | 'product_data_resolver_v3';
    requested_barcode: string;
    canonical_gtin: string;
    terminal_state: 'resolved' | 'identity_unresolved' | 'provider_unavailable';
    sources: Array<{
      provider: 'open_food_facts' | 'usda_food_data_central';
      status: 'found' | 'not_found' | 'unavailable';
      record_id: string | null;
      source_timestamp?: string | null;
    }>;
    cache_freshness?: 'fresh' | 'stale' | 'refreshed' | 'miss';
    cache_fetched_at?: string | null;
    resolver_version?: string;
    resolution_trace?: ProductResolutionTraceSnapshot;
  };
  /** Legacy records are read-only and never trusted without server revalidation. */
  lab_evidence?: LabEvidenceRecord[];
  lab_evidence_resolution?: LabEvidenceResolution;
  lab_evidence_reference?: LabEvidenceReferenceSnapshot;
  labels?: string[];
  categories_tags?: string[];
  packaging_tags?: string[];
  nutriments_per_100g?: {
    calories?: number | null;
    carbs_g?: number | null;
    fat_g?: number | null;
    sugar_g?: number | null;
    added_sugar_g?: number | null;
    protein_g?: number | null;
    fiber_g?: number | null;
    sodium_mg?: number | null;
    saturated_fat_g?: number | null;
    caffeine_mg?: number | null;
  };
  nutriments_per_100ml?: {
    calories?: number | null;
    carbs_g?: number | null;
    fat_g?: number | null;
    sugar_g?: number | null;
    added_sugar_g?: number | null;
    protein_g?: number | null;
    fiber_g?: number | null;
    sodium_mg?: number | null;
    saturated_fat_g?: number | null;
    caffeine_mg?: number | null;
  };
  quality_flags: FoodQualityFlag[];
  confidence: DataConfidence;
  reason_codes: NutritionReasonCode[];
};

export type ProductQualitySnapshot = {
  score: number | null;
  central_score?: number | null;
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
  grade_certainty?: ProductGradeCertainty | null;
  better_options?: ProductBetterOption[];
  evidence_refs?: ProductEvidenceRef[];
  result_state?: 'final' | 'estimated' | 'provisional' | 'more_data_needed' | 'identity_unresolved' | 'provider_unavailable';
  estimated_grade_range?: [ProductLetterGrade, ProductLetterGrade] | null;
  estimated_score_range?: [number, number] | null;
  missing_evidence?: string[];
  evidence_confidence?: ProductEvidenceConfidence;
  engine_version?: ProductQualityEngineVersion;
  archetype?: ProductArchetype | null;
  dimensions?: ProductScoreDimension[];
  supported_dimension_weight?: number;
  score_scope?: ProductScoreScope;
  dimension_aggregation?: ProductDimensionScore['aggregation'];
  score_eligibility?: ProductScoreEligibility;
  generalized_fallback_used?: boolean;
  review_trace?: {
    engine_version: ProductQualityEngineVersion;
    category_resolution: CategoryResolution;
    score_ledger: ProductScoreLedgerEntry[];
    grade_eligibility: ProductGradeEligibility | null;
    grade_certainty: ProductGradeCertainty | null;
    supported_dimension_weight: number;
    score_scope: ProductScoreScope;
    dimension_aggregation: ProductDimensionScore['aggregation'];
    score_eligibility: ProductScoreEligibility;
    product_resolution?: {
      trace: ProductResolutionTraceSnapshot;
      supported_dimensions: string[];
      unsupported_dimensions: string[];
      final_scoring_scope: ProductScoreScope;
      final_result_state: NonNullable<ProductQualitySnapshot['result_state']>;
      abstention_reason: string | null;
    };
  };
};

export type ProductQualityResultState = NonNullable<ProductQualitySnapshot['result_state']>;

export type ProductLookupResult =
  | { status: 'found'; product: HealthiProductSnapshot }
  | { status: 'not_found' | 'identity_unresolved'; barcode: string; message: string }
  | { status: 'provider_unavailable'; barcode: string; message: string }
  | {
      status: 'error';
      barcode: string;
      code: 'invalid_barcode' | 'network_error' | 'provider_error' | 'malformed_response';
      message: string;
    };
