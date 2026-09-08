import type { ReasonCode } from '../constants/reasonCodes';
import type { DataConfidence, DayMode, DailyPriority } from './readiness';

export type FoodResponseConfidence =
  | 'single_response'
  | 'early_signal'
  | 'emerging_pattern'
  | 'consistent_pattern';

export type FoodItem = {
  id: string;
  name: string;
  brand?: string;
  barcode?: string;
  nutrition?: Record<string, unknown>;
  ingredients?: string;
  ingredient_tags?: string[];
};

export type FoodResponseLog = {
  id: string;
  food_item_id: string;
  response_score: number;
  energy_after?: 'crashed' | 'flat' | 'stable' | 'elevated';
  digestion?: 'uncomfortable' | 'fine' | 'great';
  mental_clarity?: 'foggy' | 'normal' | 'sharp';
  mood?: 'irritable' | 'neutral' | 'calm_clear';
  cravings_after?: 'none' | 'mild' | 'strong';
  satiety?: 'hungry_soon' | 'satisfied' | 'too_full';
  logged_at: string;
};

export type FoodPattern = {
  food_item_id: string;
  avg_response_score: number;
  log_count: number;
  confidence_label: FoodResponseConfidence;
  common_positive_effects: string[];
  common_negative_effects: string[];
  recommended_use: 'emphasize' | 'neutral' | 'reduce' | 'avoid_today';
};

export type FoodContext = {
  day_mode: DayMode;
  daily_priority: DailyPriority;
  goal: string;
  digestion_state?: 'great' | 'fine' | 'off' | 'uncomfortable';
  sleep_debt_hours_7d?: number;
  current_time?: string;
  circadian_phase?: string;
  allergies: string[];
  intolerances: string[];
  user_food_patterns: FoodPattern[];
  recent_food_ids: string[];
};

export type FoodFitScore = {
  general_quality_score: number;
  personal_response_score?: number;
  current_fit_score: number;
  total_score: number;
  confidence: DataConfidence;
  reasons: ReasonCode[];
};
