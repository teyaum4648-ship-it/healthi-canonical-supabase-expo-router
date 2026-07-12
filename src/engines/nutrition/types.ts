import type { DataConfidence } from '../../types/common';

export type { DataConfidence };

export type MealDataSource =
  | 'manual'
  | 'demo'
  | 'barcode_pending'
  | 'ocr_pending'
  | 'food_api_pending'
  | 'user_corrected'
  | 'estimated_default';

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'unknown';

export type FoodQualityFlag =
  | 'added_sugar'
  | 'high_sodium'
  | 'low_fiber'
  | 'protein_low'
  | 'ultra_processed_indicator'
  | 'balanced_meal'
  | 'whole_food_emphasis'
  | 'late_heavy_meal'
  | 'timing_supportive';

export type NutritionReasonCode =
  | 'protein_low'
  | 'protein_supportive'
  | 'fiber_low'
  | 'fiber_supportive'
  | 'under_fueled'
  | 'over_fueled'
  | 'meal_timing_late'
  | 'meal_timing_supportive'
  | 'added_sugar_high'
  | 'sodium_high'
  | 'processing_level_high'
  | 'digestion_discomfort_reported'
  | 'energy_dip_reported'
  | 'appetite_unstable_reported'
  | 'cravings_reported'
  | 'food_quality_supportive'
  | 'balanced_meal'
  | 'whole_food_emphasis'
  | 'food_data_missing'
  | 'nutrition_calibrating'
  | 'demo_food_data'
  | 'manual_food_log'
  | 'barcode_food_logged'
  | 'product_label_data'
  | 'user_corrected_food_log'
  | 'source_low_confidence'
  | 'partial_nutrition_data'
  | 'food_response_missing'
  | 'food_response_steady'
  | 'nutrition_signal_supportive'
  | 'nutrition_signal_watch';

export type MealUserResponse = {
  digestion?: 'good' | 'neutral' | 'heavy' | 'uncomfortable' | 'not_sure' | null;
  energy?: 'better' | 'steady' | 'dip' | 'not_sure' | null;
  appetite?: 'stable' | 'hungry_soon' | 'overfull' | 'not_sure' | null;
  cravings?: 'none' | 'mild' | 'strong' | 'not_sure' | null;
  notes?: string | null;
};

export type MealLog = {
  id?: string;
  user_id?: string;
  logged_at: string;
  meal_type: MealType;
  name: string;
  source: MealDataSource;
  source_confidence: DataConfidence;
  calories?: number | null;
  protein_g?: number | null;
  carbs_g?: number | null;
  fat_g?: number | null;
  fiber_g?: number | null;
  sugar_g?: number | null;
  sodium_mg?: number | null;
  ingredients?: string[] | null;
  quality_flags: FoodQualityFlag[];
  user_response?: MealUserResponse | null;
  corrected_by_user?: boolean;
  confirmed_by_user?: boolean;
  reason_codes: NutritionReasonCode[];
  created_at: string;
};

export type NutritionTargets = {
  calories_target?: number | null;
  protein_g_target?: number | null;
  carbs_g_target?: number | null;
  fat_g_target?: number | null;
  fiber_g_target?: number | null;
  sodium_mg_limit?: number | null;
  confidence: DataConfidence;
  basis: Array<'onboarding' | 'default' | 'manual_adjustment' | 'nutrition_history'>;
};

export type NutrientSummary = {
  date: string;
  meal_count: number;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fiber_g: number | null;
  sugar_g: number | null;
  sodium_mg: number | null;
  targets?: NutritionTargets | null;
  target_progress: {
    calories?: number | null;
    protein?: number | null;
    carbs?: number | null;
    fat?: number | null;
    fiber?: number | null;
    sodium?: number | null;
  };
  confidence: DataConfidence;
  reason_codes: NutritionReasonCode[];
};

export type FoodQualitySummary = {
  date: string;
  score: number | null;
  label: 'supportive' | 'steady' | 'watch' | 'unknown';
  flags: FoodQualityFlag[];
  confidence: DataConfidence;
  reason_codes: NutritionReasonCode[];
};

export type FoodResponseSummary = {
  date: string;
  label: 'steady' | 'mixed' | 'watch' | 'unknown';
  digestion_signal: 'supportive' | 'neutral' | 'watch' | 'unknown';
  energy_signal: 'supportive' | 'neutral' | 'watch' | 'unknown';
  appetite_signal: 'supportive' | 'neutral' | 'watch' | 'unknown';
  confidence: DataConfidence;
  reason_codes: NutritionReasonCode[];
};

export type NutritionReadinessSignal = {
  date: string;
  score_adjustment: number;
  label: 'supportive' | 'neutral' | 'watch' | 'unknown';
  summary: string;
  confidence: DataConfidence;
  reason_codes: NutritionReasonCode[];
};
