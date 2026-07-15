import type { BaselineOnboardingInput, BaselineProfileInput, BaselineSummary } from '../../engines/baseline';
import type { FoodPatternProfile, MealLog } from '../../engines/nutrition';
import type { SleepNeedEstimate, SleepSession } from '../../engines/circadian';
import type { WorkoutSessionRow } from '../movement/movementPersistence';
import type { PersonalBlueprint } from './personalBlueprint';

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
  blueprint: PersonalBlueprint;
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
  initial_foundation_scores?: unknown;
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
  food_pattern?: FoodPatternProfile | null;
  recent_meals?: MealLog[];
  sleep_sessions?: SleepSession[];
  sleep_need?: SleepNeedEstimate;
  preferred_bedtime?: string | null;
  movement_sessions?: WorkoutSessionRow[];
  movement_flags?: string[] | null;
  posture_flags?: string[] | null;
  baseline_mode?: BaselineProfileInput['baseline_mode'];
  primary_focus?: string | null;
  movement_readiness_label?: string | null;
  rhythm_confidence?: 'low' | 'medium' | 'high';
};
