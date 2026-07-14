import type { BaselineOnboardingInput, BaselineProfileInput, BaselineSummary } from '../../engines/baseline';

export type HealthiProfileRecord = {
  id?: string | null;
  display_name?: string | null;
  primary_goal?: string | null;
  onboarding_status?: 'not_started' | 'in_progress' | 'completed' | null;
};

export type ProfileScreenModel = {
  account: {
    label: string;
    detail: string;
    source_label: 'logged' | 'demo' | 'calibrating';
  };
  baseline: BaselineSummary;
  load_error: boolean;
};

export type ProfileComposerInput = {
  profile?: HealthiProfileRecord | null;
  email?: string | null;
  is_demo_mode: boolean;
  supabase_client?: unknown;
};

export type BaselineProfileRecord = NonNullable<BaselineOnboardingInput['baseline_profile']> & {
  generated_at?: string | null;
};

export type ProfileComposerData = {
  profile?: BaselineProfileInput | null;
  onboarding?: BaselineOnboardingInput | null;
  email?: string | null;
  source_label?: 'logged' | 'demo' | 'calibrating';
  nutrition_dates?: string[];
  movement_dates?: string[];
  schedule_dates?: string[];
  sleep_dates?: string[];
  food_pattern_label?: string | null;
  movement_readiness_label?: string | null;
  rhythm_confidence?: 'low' | 'medium' | 'high';
};
