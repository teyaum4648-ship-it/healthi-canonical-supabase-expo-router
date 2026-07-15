import type { BaselineMode } from '../../engines/baseline';
import type { DataConfidence } from '../../types/common';
import type { OnboardingAnswers } from '../../types/onboarding';

export type OnboardingV2Domain =
  | 'recovery_rhythm'
  | 'nourishment'
  | 'movement_capacity'
  | 'mind_life_load';

export type OnboardingV2PrimaryFocus = OnboardingV2Domain | 'balanced';

export type OnboardingV2CalibrationHint = {
  domain: OnboardingV2Domain;
  label: string;
  detail: string;
  priority: number;
  reason_codes: string[];
};

export type OnboardingV2NextStep = {
  id: string;
  title: string;
  detail: string;
  priority: 'low' | 'medium' | 'high';
  reason_codes: string[];
};

export type OnboardingV2BaselineSetup = {
  version: 2;
  baseline_mode: BaselineMode;
  primary_focus: OnboardingV2PrimaryFocus;
  confidence: DataConfidence;
  reason_codes: string[];
  missing_data: string[];
};

export type OnboardingV2Result = OnboardingV2BaselineSetup & {
  completed: boolean;
  summary: string;
  calibration_hints: OnboardingV2CalibrationHint[];
  next_steps: OnboardingV2NextStep[];
};

export type GenerateOnboardingV2Input = {
  answers: OnboardingAnswers;
  existing_baseline_mode?: BaselineMode | null;
};
