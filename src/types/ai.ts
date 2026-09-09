import type { ReadinessState } from './readiness';
import type { MovementPatternPermission } from './training';
import type { FoodPattern } from './food';

export type MinimalUserProfile = {
  user_id: string;
  display_name?: string;
  primary_goal?: string;
  timezone: string;
};

export type SafetyConstraint = {
  code: string;
  severity: 'low' | 'medium' | 'high';
  instruction: string;
};

export type RecentLogSummary = {
  type: 'food' | 'workout' | 'checkin' | 'sleep' | 'hydration';
  summary: string;
  occurred_at: string;
};

export type AIContextSnapshot = {
  user_profile: MinimalUserProfile;
  current_readiness: ReadinessState;
  daily_protocol?: Record<string, unknown>;
  movement_permissions: MovementPatternPermission[];
  food_patterns: FoodPattern[];
  meal_plan?: Record<string, unknown>;
  recent_logs: RecentLogSummary[];
  safety_constraints: SafetyConstraint[];
  user_question: string;
};
