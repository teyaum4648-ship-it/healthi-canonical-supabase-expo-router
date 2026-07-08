import type { DataConfidence } from '../../types/common';

export type { DataConfidence };

export type DayScheduleBlockType =
  | 'work'
  | 'class'
  | 'commute'
  | 'exercise'
  | 'meal'
  | 'free_time'
  | 'recovery'
  | 'social'
  | 'appointment'
  | 'sleep'
  | 'other';

export type DayScheduleBlockFlexibility = 'fixed' | 'flexible' | 'preferred' | 'suggested';

export type DayScheduleBlockSource = 'user_entered' | 'healthi_suggested' | 'demo' | 'estimated_default';

export type DayPlanRecommendationType =
  | 'deep_work'
  | 'movement'
  | 'meal_timing'
  | 'walk'
  | 'recovery'
  | 'caffeine_cutoff'
  | 'wind_down'
  | 'sleep'
  | 'schedule_adjustment';

export type DayPlanMode = 'build' | 'maintain' | 'correct' | 'restore';

export type DayPlanPriority = 'low' | 'medium' | 'high';

export type DayPlanReasonCode =
  | 'schedule_blocks_available'
  | 'open_window_detected'
  | 'overlapping_blocks_handled'
  | 'rhythm_window_available'
  | 'deep_work_window_matched'
  | 'movement_window_matched'
  | 'nutrition_calibrating'
  | 'food_response_logged'
  | 'fueling_signal_available'
  | 'readiness_low'
  | 'readiness_high'
  | 'restore_mode_selected'
  | 'wind_down_protected'
  | 'caffeine_cutoff_available'
  | 'sleep_timing_available'
  | 'missing_schedule_data'
  | 'missing_rhythm_data'
  | 'missing_nutrition_data'
  | 'missing_movement_data'
  | 'missing_readiness_data'
  | 'low_confidence_inputs';

export type DayScheduleBlock = {
  id: string;
  type: DayScheduleBlockType;
  label: string;
  start: string;
  end: string;
  flexibility: DayScheduleBlockFlexibility;
  source: DayScheduleBlockSource;
  confidence: DataConfidence;
  reason_codes: DayPlanReasonCode[];
};

export type DayEnergyWindow = {
  start: string;
  end: string;
  label: string;
  intensity?: 'low' | 'medium' | 'high';
};

export type DayTimeWindow = {
  start: string;
  end: string;
};

export type DayOpenWindow = DayTimeWindow & {
  duration_minutes: number;
  reason_codes: DayPlanReasonCode[];
};

export type DayPlanRecommendation = {
  id: string;
  type: DayPlanRecommendationType;
  title: string;
  detail: string;
  start?: string;
  end?: string;
  priority: DayPlanPriority;
  confidence: DataConfidence;
  reason_codes: DayPlanReasonCode[];
};

export type GenerateDayPlanInput = {
  date: string;
  wake_time?: string;
  target_bedtime?: string;
  schedule_blocks: DayScheduleBlock[];
  rhythm?: {
    energy_windows?: DayEnergyWindow[];
    deep_work_window?: DayTimeWindow | null;
    exercise_window?: DayTimeWindow | null;
    caffeine_cutoff?: string | null;
    wind_down_start?: string | null;
  };
  readiness?: {
    score?: number | null;
    mode?: DayPlanMode;
    confidence?: DataConfidence;
    reason_codes?: string[];
  };
  nutrition?: {
    readiness_adjustment?: number;
    confidence?: DataConfidence;
    meal_count?: number;
    food_response_label?: string;
    reason_codes?: string[];
  };
  movement?: {
    training_readiness?: 'low' | 'medium' | 'high';
    preferred_training_time?: string | null;
    reason_codes?: string[];
  };
};

export type DayPlanResult = {
  date: string;
  mode: DayPlanMode;
  confidence: DataConfidence;
  summary: string;
  primary_focus: string;
  recommendations: DayPlanRecommendation[];
  protected_blocks: DayScheduleBlock[];
  open_windows: DayOpenWindow[];
  reason_codes: DayPlanReasonCode[];
  missing_data: string[];
};

