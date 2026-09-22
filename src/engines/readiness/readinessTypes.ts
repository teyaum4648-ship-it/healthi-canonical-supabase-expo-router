import type { DataConfidence } from '../../types/common';

export type { DataConfidence };

export type DailyReadinessDomain =
  | 'recovery_rhythm'
  | 'nourishment'
  | 'movement_capacity'
  | 'mind_life_load';

export type DailyReadinessLabel = 'primed' | 'steady' | 'conserve' | 'restore' | 'calibrating';
export type DailyReadinessMode = 'build' | 'maintain' | 'correct' | 'restore' | 'professional_guidance';
export type DailyReadinessPrimaryFocus = DailyReadinessDomain | 'balanced';

export type ReadinessTimeWindow = {
  start: string;
  end: string;
};

export type GenerateDailyReadinessInput = {
  date: string;
  rhythm?: {
    sleep_duration_hours?: number | null;
    sleep_debt_hours?: number | null;
    energy_phase?: string | null;
    deep_work_window?: ReadinessTimeWindow | null;
    exercise_window?: ReadinessTimeWindow | null;
    caffeine_cutoff?: string | null;
    wind_down_start?: string | null;
    confidence?: DataConfidence;
    reason_codes?: string[];
  };
  nutrition?: {
    meal_count?: number;
    readiness_adjustment?: number;
    food_quality_label?: string;
    food_response_label?: string;
    confidence?: DataConfidence;
    reason_codes?: string[];
  };
  movement?: {
    workout_count_7d?: number;
    total_minutes_7d?: number;
    training_load_label?: string;
    readiness_label?: string;
    confidence?: DataConfidence;
    reason_codes?: string[];
  };
  schedule?: {
    block_count?: number;
    open_window_count?: number;
    next_protected_block?: string | null;
    confidence?: DataConfidence;
    reason_codes?: string[];
  };
  user_context?: {
    baseline_mode?: DailyReadinessMode;
  };
};

export type DailyReadinessAction = {
  id: string;
  title: string;
  detail: string;
  domain: DailyReadinessDomain;
  priority: 'low' | 'medium' | 'high';
  confidence: DataConfidence;
  reason_codes: string[];
};

export type DailyReadinessDriver = {
  domain: DailyReadinessDomain;
  label: string;
  status: 'supportive' | 'steady' | 'watch' | 'calibrating';
  detail: string;
  /**
   * Points this domain moved the score, signed. The engine has always computed this and
   * then thrown it away at the boundary, which is why the app could say "conserve" but
   * never "because you are three hours down on sleep". A score a person cannot take
   * apart is a verdict; one they can is a reading.
   */
  contribution: number;
  /** No signal at all. Contributes zero by design — absence lowers confidence, not score. */
  missing: boolean;
  confidence: DataConfidence;
  reason_codes: string[];
};

export type DailyReadinessResult = {
  date: string;
  score: number;
  /** Where every day starts before any signal is read. The rest of the score is the ledger. */
  baseline_score: number;
  /**
   * Baseline plus every contribution, before the 0-100 clamp.
   *
   * A very good day sums past 100 and a very bad one below 0, and when that happens the
   * ledger and the ring disagree unless the ceiling is said out loud. Carrying the raw
   * total is what lets the explanation stay arithmetic instead of becoming a story.
   */
  raw_score: number;
  label: DailyReadinessLabel;
  mode: DailyReadinessMode;
  confidence: DataConfidence;
  primary_focus: DailyReadinessPrimaryFocus;
  summary: string;
  recommended_actions: DailyReadinessAction[];
  driver_cards: DailyReadinessDriver[];
  reason_codes: string[];
  missing_data: string[];
};
