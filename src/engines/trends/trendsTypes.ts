import type { DataConfidence } from '../../types/common';

export type TrendsRangeDays = 7 | 14 | 30;
export type TrendsDomain =
  | 'recovery_rhythm'
  | 'nourishment'
  | 'movement_capacity'
  | 'mind_life_load'
  | 'readiness';
export type TrendsStatus = 'supportive' | 'steady' | 'watch' | 'calibrating';
export type TrendsDirection = 'up' | 'down' | 'steady' | 'mixed' | 'unknown';
export type TrendsSourceLabel = 'logged' | 'demo' | 'calibrating';

export type TrendReadinessEntry = {
  date: string;
  score?: number | null;
  label?: string | null;
  mode?: string | null;
  confidence?: DataConfidence;
  primary_focus?: string | null;
  reason_codes?: string[];
};

export type TrendRhythmEntry = {
  date: string;
  sleep_duration_hours?: number | null;
  sleep_debt_hours?: number | null;
  confidence?: DataConfidence;
  reason_codes?: string[];
};

export type TrendNutritionEntry = {
  date: string;
  meal_count?: number;
  /** Calories from the meals that reported them; null when none did. */
  calories?: number | null;
  protein_grams?: number | null;
  fiber_grams?: number | null;
  added_sugar_grams?: number | null;
  food_quality_label?: string | null;
  food_response_label?: string | null;
  confidence?: DataConfidence;
  reason_codes?: string[];
};

export type TrendMovementEntry = {
  date: string;
  workout_count?: number;
  total_minutes?: number;
  training_load_label?: string | null;
  readiness_label?: string | null;
  confidence?: DataConfidence;
  reason_codes?: string[];
};

export type TrendScheduleEntry = {
  date: string;
  block_count?: number;
  open_window_count?: number;
  protected_block_count?: number;
  confidence?: DataConfidence;
  reason_codes?: string[];
};

/** What the Mood tab recorded on a day: things a person did, not a mood score. */
export type TrendMindEntry = {
  date: string;
  breathing_sessions?: number;
  breathing_minutes?: number;
  morning_light_minutes?: number;
  habits_done?: number;
};

export type GenerateTrendsSummaryInput = {
  today: string;
  range_days?: TrendsRangeDays;
  source_label?: TrendsSourceLabel;
  readinessHistory?: TrendReadinessEntry[];
  rhythmHistory?: TrendRhythmEntry[];
  nutritionHistory?: TrendNutritionEntry[];
  movementHistory?: TrendMovementEntry[];
  scheduleHistory?: TrendScheduleEntry[];
  mindHistory?: TrendMindEntry[];
};

/** One day of a card's chart. Null is a day with nothing logged — a gap, never a zero. */
export type TrendsSeriesPoint = { date: string; value: number | null };

export type TrendsDomainCard = {
  domain: TrendsDomain;
  title: string;
  value_label: string;
  detail: string;
  status: TrendsStatus;
  direction: TrendsDirection;
  confidence: DataConfidence;
  /** Distinct days in the range with something recorded for this domain. */
  days_logged: number;
  /** One point per day of the range, oldest first, for the card's chart. */
  series: TrendsSeriesPoint[];
  /** What the chart measures, e.g. "hours asleep". */
  series_label: string;
  /** How a single point reads, for the chart's labels and tooltip. */
  series_unit: 'hours' | 'kcal' | 'minutes' | 'score';
  reason_codes: string[];
};

export type TrendsInsight = {
  id: string;
  title: string;
  detail: string;
  domain: TrendsDomain | 'balanced';
  priority: 'low' | 'medium' | 'high';
  confidence: DataConfidence;
  reason_codes: string[];
};

export type TrendsSummary = {
  generated_at: string;
  range_days: TrendsRangeDays;
  confidence: DataConfidence;
  source_label: TrendsSourceLabel;
  overview: {
    headline: string;
    detail: string;
    trend_direction: 'improving' | 'steady' | 'mixed' | 'needs_attention' | 'calibrating';
    reason_codes: string[];
  };
  domain_cards: TrendsDomainCard[];
  /** Distinct days in the range with anything recorded at all. */
  days_logged: number;
  insights: TrendsInsight[];
  next_focus: {
    domain: Exclude<TrendsDomain, 'readiness'> | 'balanced';
    title: string;
    detail: string;
    reason_codes: string[];
  };
  missing_data: string[];
};
