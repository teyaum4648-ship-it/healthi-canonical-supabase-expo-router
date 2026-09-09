export const REASON_CODES = [
  'high_sleep_debt',
  'moderate_sleep_debt',
  'poor_sleep_quality',
  'circadian_shift',
  'current_circadian_dip',
  'rhr_above_baseline',
  'hrv_below_baseline',
  'stress_flags_high',
  'hydration_low',
  'under_fueled',
  'digestion_off',
  'caffeine_late',
  'caffeine_high',
  'local_soreness_high',
  'pain_flag_present',
  'movement_pattern_blocked',
  'movement_permission_limited',
  'posture_limitation',
  'mobility_limitation',
  'warmup_mismatch',
  'last_session_regressed',
  'last_session_progressed',
  'recovery_supports_progression',
  'food_response_positive',
  'food_response_negative',
  'ingredient_watch_list',
  'allergy_constraint',
  'goal_fit',
  'professional_guidance_needed',
  'calibrating',
  'missing_data_low_confidence',
] as const;

export type ReasonCode = typeof REASON_CODES[number];

export type ReasonSeverity = 'low' | 'medium' | 'high';

export type ExplanationReason = {
  code: ReasonCode;
  userFacingText: string;
  severity: ReasonSeverity;
};

export type ExplanationBlock = {
  summary: string;
  reasons: ExplanationReason[];
};
