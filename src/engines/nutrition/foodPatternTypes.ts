import type { DataConfidence } from './types';

export type FoodPatternLabel =
  | 'steady_balanced'
  | 'protein_forward'
  | 'carb_supported'
  | 'lighter_frequent'
  | 'evening_sensitive'
  | 'calibrating';

export type FoodPatternScoredLabel = Exclude<FoodPatternLabel, 'calibrating'>;

export type FoodPatternReasonCode =
  | 'protein_forward_signal'
  | 'carb_supported_signal'
  | 'lighter_frequent_signal'
  | 'evening_sensitive_signal'
  | 'steady_balanced_signal'
  | 'breakfast_helpful'
  | 'late_meal_sensitivity'
  | 'large_meal_heaviness'
  | 'afternoon_energy_dip'
  | 'training_fuel_needed'
  | 'appetite_instability'
  | 'digestion_sensitivity'
  | 'food_pattern_calibrating'
  | 'food_pattern_inconsistent';

export type FoodPatternQuestionId =
  | 'protein_meal_energy'
  | 'carb_meal_energy'
  | 'hunger_frequency'
  | 'cravings_pattern'
  | 'large_meal_digestion'
  | 'higher_fat_meal_response'
  | 'breakfast_skip_response'
  | 'afternoon_energy'
  | 'late_dinner_response'
  | 'heavy_dinner_sleep'
  | 'training_fuel_need'
  | 'appetite_stability'
  | 'meal_size_preference'
  | 'caffeine_food_sensitivity'
  | 'stress_life_load_eating'
  | 'morning_fueling_pattern';

export type FoodPatternScores = Record<FoodPatternScoredLabel, number>;

export type FoodPatternAnswers = Partial<Record<FoodPatternQuestionId, string | null | undefined>>;

export type FoodPatternMealStyle = FoodPatternScoredLabel;

export type FoodPatternMealResponseInput = {
  meal_style: FoodPatternMealStyle;
  energy: 1 | 2 | 3 | 4 | 5;
  digestion: 1 | 2 | 3 | 4 | 5;
  appetite_stability: 1 | 2 | 3 | 4 | 5;
  cravings?: boolean;
  response_count?: number;
  responded_at?: string;
};

export type FoodPatternMealResponseScore = {
  score: number;
  label: 'supportive' | 'neutral' | 'watch';
  confidence: DataConfidence;
  reason_codes: FoodPatternReasonCode[];
};

export type FoodPatternProfile = {
  id?: string;
  user_id?: string;
  created_at: string;
  updated_at: string;
  source: 'food_pattern_test' | 'manual_adjustment' | 'adaptive_update';
  confidence: DataConfidence;
  pattern_label: FoodPatternLabel;
  scores: FoodPatternScores;
  macro_tendency: {
    protein: 'lower' | 'moderate' | 'higher';
    carbs: 'lower' | 'moderate' | 'higher';
    fat: 'lower' | 'moderate' | 'higher';
  };
  meal_timing_tendency: {
    breakfast: 'optional' | 'helpful' | 'important';
    meal_spacing: 'shorter' | 'moderate' | 'longer';
    late_meal_sensitivity: 'low' | 'medium' | 'high';
  };
  response_tendencies: {
    digestion: 'steady' | 'sensitive' | 'unknown';
    energy: 'steady' | 'dip_prone' | 'unknown';
    appetite: 'stable' | 'hungry_soon' | 'unknown';
  };
  reason_codes: FoodPatternReasonCode[];
};

export type FoodPatternResultCopy = {
  title: string;
  summary: string;
  confidence_note: string;
};
