import type { DataConfidence } from '../../types/common';

export type { DataConfidence };

export type MovementWorkoutType =
  | 'strength'
  | 'cardio'
  | 'mobility'
  | 'recovery'
  | 'mixed'
  | 'sport'
  | 'other';

export type MovementExerciseCategory = 'strength' | 'cardio' | 'mobility' | 'recovery' | 'sport' | 'other';

export type MovementReadinessLabel =
  | 'ready_to_build'
  | 'steady_maintenance'
  | 'lighter_day'
  | 'recovery_support'
  | 'calibrating';

export type MovementConsistencyLabel = 'calibrating' | 'starting' | 'steady' | 'high_frequency';

export type MovementReasonCode =
  | 'no_workouts_logged'
  | 'limited_workout_history'
  | 'weekly_workouts_available'
  | 'weekly_minutes_available'
  | 'strength_sessions_logged'
  | 'cardio_sessions_logged'
  | 'mobility_recovery_logged'
  | 'recent_high_effort'
  | 'multiple_high_effort_sessions'
  | 'consistent_moderate_training'
  | 'readiness_supports_build'
  | 'readiness_suggests_lighter_day'
  | 'restore_mode_active'
  | 'sleep_signal_limited'
  | 'sleep_signal_supportive'
  | 'nutrition_signal_supportive'
  | 'nutrition_signal_watch'
  | 'exercise_entries_available'
  | 'movement_data_calibrating'
  | 'demo_movement_data'
  | 'manual_workout_log';

export type MovementSession = {
  id: string;
  session_date: string;
  logged_at: string;
  title: string;
  workout_type: MovementWorkoutType;
  duration_minutes: number | null;
  perceived_effort: number | null;
  source_confidence: DataConfidence;
  reason_codes: string[];
};

export type MovementExerciseEntry = {
  id: string;
  workout_session_id: string;
  exercise_name: string;
  category: MovementExerciseCategory;
  sets: number | null;
  reps: number | null;
  weight: number | null;
  distance: number | null;
  duration_minutes: number | null;
  effort: number | null;
};

export type MovementSummary = {
  date: string;
  window_start: string;
  workout_count: number;
  total_minutes: number;
  strength_session_count: number;
  cardio_session_count: number;
  mobility_recovery_session_count: number;
  estimated_training_load: number;
  recent_high_effort_count: number;
  exercise_entry_count: number;
  consistency: MovementConsistencyLabel;
  confidence: DataConfidence;
  reason_codes: MovementReasonCode[];
};

export type MovementReadinessInput = {
  summary: MovementSummary;
  readiness_mode?: 'build' | 'maintain' | 'correct' | 'restore';
  readiness_score?: number | null;
  sleep_signal?: 'supportive' | 'limited' | 'unknown';
  nutrition_signal?: 'supportive' | 'watch' | 'unknown';
};

export type MovementReadinessSignal = {
  label: MovementReadinessLabel;
  score: number;
  training_readiness: 'low' | 'medium' | 'high';
  confidence: DataConfidence;
  summary: string;
  suggested_next_action: string;
  reason_codes: MovementReasonCode[];
};

export type AdaptiveMovementCapacity = 'restore' | 'technique' | 'build' | 'push';

export type AdaptiveMovementPlanReasonCode =
  | MovementReasonCode
  | 'adaptive_plan_from_readiness'
  | 'training_limited_by_safety'
  | 'calibration_session_recommended'
  | 'movement_mix_balanced'
  | 'mobility_recovery_underrepresented'
  | 'sleep_context_unknown'
  | 'nutrition_context_unknown';

export type AdaptiveMovementPlanInput = {
  signal: MovementReadinessSignal;
  summary: MovementSummary;
  training_allowed?: boolean;
  sleep_signal?: 'supportive' | 'limited' | 'unknown';
  nutrition_signal?: 'supportive' | 'watch' | 'unknown';
};

export type AdaptiveMovementPlan = {
  capacity: AdaptiveMovementCapacity;
  readiness_score: number;
  confidence: DataConfidence;
  verdict: string;
  explanation: string;
  objective: string;
  effort_range: { min: number; max: number };
  recommended_session_types: MovementWorkoutType[];
  agenda: Array<{ timing: 'now' | 'next' | 'later'; guidance: string }>;
  support: Array<{
    key: 'sleep' | 'nutrition' | 'recent_load';
    label: string;
    state: 'supportive' | 'watch' | 'limited' | 'unknown' | 'available';
    summary: string;
  }>;
  movement_mix_insight: string;
  training_allowed: boolean;
  reason_codes: AdaptiveMovementPlanReasonCode[];
};
