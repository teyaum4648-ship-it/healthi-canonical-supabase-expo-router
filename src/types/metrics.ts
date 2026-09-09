import type { DataConfidence } from './common';

export type MetricSource =
  | 'healthkit'
  | 'health_connect'
  | 'manual'
  | 'estimated'
  | 'food_api'
  | 'ai_generated';

export type MetricType =
  | 'sleep_duration_minutes'
  | 'sleep_quality_score'
  | 'sleep_debt_minutes_7d'
  | 'resting_heart_rate'
  | 'hrv_rmssd'
  | 'hydration_ml'
  | 'caffeine_mg'
  | 'energy_score'
  | 'soreness_score'
  | 'digestion_score'
  | 'motivation_score'
  | 'body_weight_kg'
  | 'steps';

export type MetricObservation = {
  id: string;
  user_id: string;
  metric_type: MetricType;
  value: number;
  unit: string;
  source: MetricSource;
  source_confidence: DataConfidence;
  observed_at: string;
  metadata?: Record<string, unknown>;
};
