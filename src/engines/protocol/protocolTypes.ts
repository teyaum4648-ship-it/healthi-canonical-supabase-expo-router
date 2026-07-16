import type { DataConfidence } from '../../types/common';
import type { SafetyReviewResult } from '../safety';

export type { DataConfidence };

export type ProtocolDayMode = 'build' | 'maintain' | 'correct' | 'restore' | 'professional_guidance';

export type ProtocolPrimaryFocus =
  | 'recovery_rhythm'
  | 'nourishment'
  | 'movement_capacity'
  | 'mind_life_load'
  | 'balanced';

export type ProtocolStatus = 'ready' | 'calibrating' | 'limited' | 'professional_guidance';

export type ProtocolActionDomain =
  | 'movement_capacity'
  | 'nourishment'
  | 'recovery_rhythm'
  | 'mind_life_load';

export type ProtocolActionKind =
  | 'movement'
  | 'restore'
  | 'hydration'
  | 'meal'
  | 'walk'
  | 'caffeine_cutoff'
  | 'wind_down'
  | 'reflection'
  | 'schedule';

export type ProtocolActionStatus = 'pending' | 'done' | 'skipped' | 'deferred';

export type DailyProtocolAction = {
  id: string;
  title: string;
  detail: string;
  domain: ProtocolActionDomain;
  kind: ProtocolActionKind;
  priority: 'low' | 'medium' | 'high';
  status: ProtocolActionStatus;
  reason_codes: string[];
  time_hint?: string | null;
};

export type GenerateDailyProtocolInput = {
  date: string;
  timezone?: string | null;
  baseline?: {
    baseline_mode?: ProtocolDayMode | null;
    primary_focus?: ProtocolPrimaryFocus | null;
    confidence?: DataConfidence | null;
  };
  readiness?: {
    score?: number | null;
    label?: string | null;
    day_mode?: ProtocolDayMode | null;
    primary_focus?: ProtocolPrimaryFocus | null;
    confidence?: DataConfidence | null;
    reason_codes?: string[];
  };
  circadian?: {
    current_phase?: string | null;
    best_movement_window?: string | null;
    caffeine_cutoff?: string | null;
    wind_down_start?: string | null;
    sleep_debt_minutes?: number | null;
    confidence?: DataConfidence | null;
    reason_codes?: string[];
  };
  nourishment?: {
    nutrition_readiness_label?: string | null;
    hydration_low?: boolean | null;
    digestion_off?: boolean | null;
    under_fueled?: boolean | null;
    food_pattern_label?: string | null;
    reason_codes?: string[];
  };
  movement?: {
    movement_readiness_label?: string | null;
    suggested_next_action?: string | null;
    pain_present?: boolean | null;
    soreness_level?: number | null;
    reason_codes?: string[];
  };
  schedule?: {
    open_windows_count?: number | null;
    protected_blocks_count?: number | null;
    day_load_label?: string | null;
    reason_codes?: string[];
  };
  safety?: SafetyReviewResult;
  source?: 'demo' | 'logged' | 'calibrating' | 'unknown';
};

export type DailyProtocol = {
  id: string;
  date: string;
  status: ProtocolStatus;
  day_mode: ProtocolDayMode;
  primary_focus: ProtocolPrimaryFocus;
  confidence: DataConfidence;
  headline: string;
  summary: string;
  actions: DailyProtocolAction[];
  safety: {
    status: SafetyReviewResult['status'];
    summary: string;
    training_allowed: boolean;
    progression_allowed: boolean;
  };
  reason_codes: string[];
  missing_data: string[];
};
