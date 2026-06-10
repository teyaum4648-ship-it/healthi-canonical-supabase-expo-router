import type { ReasonCode } from '../constants/reasonCodes';
import type { DayMode, ReadinessState } from './readiness';

export type MovementPattern =
  | 'horizontal_push'
  | 'vertical_push'
  | 'horizontal_pull'
  | 'vertical_pull'
  | 'squat'
  | 'hinge'
  | 'lunge'
  | 'carry'
  | 'rotation'
  | 'anti_rotation'
  | 'core_stability'
  | 'locomotion';

export type PatternPermission =
  | 'allowed'
  | 'allowed_with_modification'
  | 'technique_only'
  | 'corrective_only'
  | 'blocked';

export type MovementPatternPermission = {
  user_id: string;
  pattern: MovementPattern;
  permission: PatternPermission;
  reasons: ReasonCode[];
  updated_at: string;
  retest_after?: string;
};

export type TrainingState = 'build' | 'maintain' | 'technique' | 'correct' | 'restore';

export type ProgressionType =
  | 'more_reps'
  | 'more_load'
  | 'same_work_lower_rpe'
  | 'better_form'
  | 'better_range'
  | 'more_volume'
  | 'better_tempo_control';

export type ExerciseSetLog = {
  exercise_id?: string;
  exercise_name: string;
  load?: number;
  load_unit?: 'lb' | 'kg';
  reps?: number;
  rpe?: number;
  rir?: number;
  tempo?: string;
  rest_seconds?: number;
  pain_score?: number;
  pain_locations?: string[];
  form_quality?: 'poor' | 'acceptable' | 'good' | 'excellent';
  range_quality?: 'shortened' | 'acceptable' | 'full';
  notes?: string;
};

export type ProgressionTarget = {
  exercise_id?: string;
  exercise_name: string;
  target_type: ProgressionType;
  previous_reference: ExerciseSetLog;
  target: ExerciseSetLog;
  reason_codes: ReasonCode[];
};

export type WorkoutAdjustment = {
  type: 'none' | 'reduce_volume' | 'reduce_load' | 'technique_only' | 'corrective' | 'restore';
  notes?: string;
};

export type TrainingContext = {
  readiness: ReadinessState;
  day_mode: DayMode;
  allostatic_load: { score: number };
  sleep: { debt_hours_7d?: number };
  recovery: { rhr_deviation_bpm?: number; hrv_status?: string };
  fuel: { under_fueled?: boolean };
  hydration: { percent?: number };
  soreness: { local_score?: number };
  safety: { red_flags: ReasonCode[] };
  pattern_permission: MovementPatternPermission;
  warmup: { rpe_unusually_high?: boolean; pain_present?: boolean };
  last_session_sets: ExerciseSetLog[];
};

export type ProgressionGateResult = {
  progression_allowed: boolean;
  training_state: TrainingState;
  progression_target?: ProgressionTarget;
  blocked_reasons: ReasonCode[];
  recommended_adjustment: WorkoutAdjustment;
};

export type SessionOutcome =
  | 'productive_progression'
  | 'productive_maintenance'
  | 'recovery_mismatch'
  | 'movement_constraint'
  | 'under_fueled'
  | 'incomplete';
