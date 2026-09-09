import type { ExplanationBlock, ReasonCode } from '../constants/reasonCodes';

export type DataConfidence = 'low' | 'medium' | 'high';

export type DailyPriority =
  | 'recovery_rhythm'
  | 'nourishment'
  | 'movement_capacity'
  | 'mind_life_load'
  | 'balanced';

export type DayMode =
  | 'build'
  | 'maintain'
  | 'correct'
  | 'restore'
  | 'professional_guidance';

export type ReadinessZone = 'green' | 'yellow' | 'red';

export type DomainScore = {
  score: number;
  confidence: DataConfidence;
  reasons: ReasonCode[];
  limitingFactors: string[];
};

export type FoundationScores = {
  recovery_rhythm: DomainScore;
  nourishment: DomainScore;
  movement_capacity: DomainScore;
  mind_life_load: DomainScore;
};

export type ReadinessState = {
  readiness_score: number;
  system_load_score: number;
  vitality_score: number;
  confidence: DataConfidence;
  zone: ReadinessZone;
  day_mode: DayMode;
  daily_priority: DailyPriority;
  reason_codes: ReasonCode[];
  calibration_status?: 'calibrating' | 'calibrated';
};

export type WeightedInput = {
  key: string;
  value: unknown | null | undefined;
  normalizedScore: number;
  weight: number;
  reasons?: ReasonCode[];
};

export type DailyContext = {
  safety: {
    medical_red_flag_present: boolean;
    red_flags: ReasonCode[];
  };
  sleep: {
    debt_hours_7d?: number;
    quality_score?: number;
  };
  recovery: {
    rhr_deviation_bpm?: number;
    hrv_status?: 'very_low' | 'low' | 'normal' | 'high' | 'unknown';
  };
  stress: {
    flags_count?: number;
  };
  movement: {
    pain_flags: unknown[];
    blocked_patterns: string[];
  };
  nourishment: {
    digestion_score?: number;
    hydration_percent?: number;
    under_fueled_yesterday?: boolean;
  };
  mind: {
    emotional_stress_score?: number;
    motivation_score?: number;
    burnout_flags_count?: number;
  };
  calibration?: {
    days_since_onboarding: number;
  };
};

export type DayDecision = {
  day_mode: DayMode;
  daily_priority: DailyPriority;
  training_allowed: boolean;
  progressive_overload_allowed?: boolean;
  reason_codes: ReasonCode[];
  explanation?: ExplanationBlock;
};
