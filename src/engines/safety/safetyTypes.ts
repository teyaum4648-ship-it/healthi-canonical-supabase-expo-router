import type { DataConfidence } from '../../types/common';

export type { DataConfidence };

export type SafetyDayMode = 'build' | 'maintain' | 'correct' | 'restore' | 'professional_guidance';

export type SafetyStatus = 'clear' | 'caution' | 'limit_guidance' | 'professional_guidance';

export type SafetyBlockedDomain =
  | 'movement'
  | 'training'
  | 'nourishment'
  | 'recovery_rhythm'
  | 'mind_life_load';

export type SafetyActionDomain = 'movement' | 'nourishment' | 'recovery_rhythm' | 'mind_life_load';

export type SafetySource = 'demo' | 'logged' | 'calibrating' | 'unknown';

export type SafetyReviewInput = {
  dayMode?: SafetyDayMode | null;
  readiness?: {
    score?: number | null;
    label?: string | null;
    confidence?: DataConfidence | null;
    reason_codes?: string[];
  };
  movement?: {
    pain_present?: boolean | null;
    discomfort_level?: 'none' | 'mild' | 'moderate' | 'high' | null;
    soreness_level?: number | null;
    movement_readiness_label?: string | null;
    recent_workout_effort?: number | null;
    reason_codes?: string[];
  };
  nourishment?: {
    hydration_low?: boolean | null;
    under_fueled?: boolean | null;
    digestion_off?: boolean | null;
    nutrition_readiness_label?: string | null;
    reason_codes?: string[];
  };
  recoveryRhythm?: {
    sleep_debt_minutes?: number | null;
    poor_sleep_quality?: boolean | null;
    rhythm_confidence?: DataConfidence | null;
    reason_codes?: string[];
  };
  mindLifeLoad?: {
    life_load_level?: 'low' | 'moderate' | 'high' | null;
    stress_score?: number | null;
    reason_codes?: string[];
  };
  userReportedFlags?: {
    chest_pain?: boolean;
    fainting?: boolean;
    severe_dizziness?: boolean;
    shortness_of_breath_at_rest?: boolean;
    new_neurological_symptoms?: boolean;
    severe_injury?: boolean;
    pregnancy_related_concern?: boolean;
    restrictive_eating_concern?: boolean;
    severe_low_mood_or_self_harm_signal?: boolean;
  };
  source?: SafetySource;
};

export type SafetyAllowedAction = {
  id: string;
  title: string;
  detail: string;
  domain: SafetyActionDomain;
};

export type SafetyDisallowedAction = {
  id: string;
  title: string;
  detail: string;
  reason_codes: string[];
};

export type SafetyReviewResult = {
  status: SafetyStatus;
  confidence: DataConfidence;
  training_allowed: boolean;
  progression_allowed: boolean;
  blocked_domains: SafetyBlockedDomain[];
  summary: string;
  allowed_actions: SafetyAllowedAction[];
  disallowed_actions: SafetyDisallowedAction[];
  reason_codes: string[];
  missing_data: string[];
};
