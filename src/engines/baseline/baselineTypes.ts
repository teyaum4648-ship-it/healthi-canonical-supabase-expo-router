import type { DataConfidence } from '../../types/common';

export type BaselineDomain =
  | 'recovery_rhythm'
  | 'nourishment'
  | 'movement_capacity'
  | 'mind_life_load'
  | 'readiness';

export type BaselineMode = 'build' | 'maintain' | 'correct' | 'restore' | 'professional_guidance';

export type BaselineProfileInput = {
  display_name?: string | null;
  goal?: string | null;
  baseline_mode?: BaselineMode | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type BaselineOnboardingInput = {
  completed?: boolean;
  completed_at?: string | null;
  baseline_profile?: {
    preferred_bedtime?: string | null;
    preferred_waketime?: string | null;
    hydration_target_ml?: number | null;
    food_constraints?: string[] | null;
    training_capacity?: { experience?: string | null; weekly_training_days?: string | null } | null;
    primary_goal?: string | null;
    calibration_status?: string | null;
  } | null;
  reason_codes?: string[];
};

export type BaselineDataCoverage = {
  recovery_rhythm_days?: number;
  nourishment_days?: number;
  movement_capacity_days?: number;
  mind_life_load_days?: number;
  readiness_days?: number;
};

export type BaselineCurrentSignals = {
  readiness_label?: string | null;
  readiness_score?: number | null;
  primary_focus?: string | null;
  food_pattern_label?: string | null;
  movement_readiness_label?: string | null;
  rhythm_confidence?: DataConfidence;
};

export type GenerateBaselineSummaryInput = {
  profile?: BaselineProfileInput | null;
  onboarding?: BaselineOnboardingInput | null;
  dataCoverage?: BaselineDataCoverage;
  currentSignals?: BaselineCurrentSignals;
  source_label?: 'logged' | 'demo' | 'calibrating';
};

export type BaselineProfileCard = {
  id: string;
  title: string;
  value: string;
  detail: string;
  confidence: DataConfidence;
  reason_codes: string[];
};

export type BaselineCalibrationDomain = {
  domain: BaselineDomain;
  label: string;
  status: 'ready' | 'partial' | 'calibrating';
  detail: string;
};

export type BaselineSummary = {
  status: 'ready' | 'calibrating' | 'needs_setup';
  confidence: DataConfidence;
  source_label: 'logged' | 'demo' | 'calibrating';
  headline: string;
  detail: string;
  profile_cards: BaselineProfileCard[];
  calibration: {
    completion_label: string;
    detail: string;
    domains: BaselineCalibrationDomain[];
  };
  preferences: Array<{ id: string; title: string; detail: string }>;
  next_steps: Array<{
    id: string;
    title: string;
    detail: string;
    priority: 'low' | 'medium' | 'high';
    reason_codes: string[];
  }>;
  reason_codes: string[];
  missing_data: string[];
};
