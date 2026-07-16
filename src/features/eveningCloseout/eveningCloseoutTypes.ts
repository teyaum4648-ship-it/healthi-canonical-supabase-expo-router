import type { DataConfidence } from '../../types/common';

export type { DataConfidence };

export type CloseoutFollowedPlan = 'yes' | 'partly' | 'no';
export type CloseoutBodyResponse = 'better' | 'same' | 'lower_energy' | 'more_tense';
export type CloseoutMovementDiscomfort = 'no' | 'mild_discomfort' | 'pain';
export type CloseoutDigestion = 'comfortable' | 'okay' | 'off';
export type CloseoutCaffeine = 'no' | 'yes' | 'not_sure';
export type CloseoutOutdoor = 'yes' | 'no';

export type EveningCloseoutAnswers = {
  followed_plan?: CloseoutFollowedPlan | null;
  body_response?: CloseoutBodyResponse | null;
  movement_discomfort?: CloseoutMovementDiscomfort | null;
  digestion?: CloseoutDigestion | null;
  caffeine_after_cutoff?: CloseoutCaffeine | null;
  outdoor_light_or_walk?: CloseoutOutdoor | null;
};

export type CloseoutAdherenceLabel = 'followed' | 'partial' | 'missed' | 'unknown';
export type CloseoutResponseLabel = 'supported' | 'neutral' | 'strained' | 'needs_attention' | 'unknown';
export type CloseoutAdjustmentDomain =
  | 'recovery_rhythm'
  | 'nourishment'
  | 'movement_capacity'
  | 'mind_life_load';

export type CloseoutNextDayAdjustment = {
  id: string;
  title: string;
  detail: string;
  domain: CloseoutAdjustmentDomain;
  reason_codes: string[];
};

export type EveningCloseoutResult = {
  date: string;
  adherence_label: CloseoutAdherenceLabel;
  response_label: CloseoutResponseLabel;
  next_day_adjustments: CloseoutNextDayAdjustment[];
  reason_codes: string[];
  safety_flags: string[];
  confidence: DataConfidence;
};
