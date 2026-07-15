import type { ReasonCode } from '../constants/reasonCodes';
import type { DataConfidence } from './common';

export type OnboardingQuestionKey =
  | 'primary_goal'
  | 'blocking_factors'
  | 'result_timeline'
  | 'protein_fat_meal_response'
  | 'carb_meal_response'
  | 'sweet_food_response'
  | 'meal_cadence'
  | 'post_exercise_craving'
  | 'diet_quality_score'
  | 'processed_food_frequency'
  | 'vegetable_frequency'
  | 'water_intake'
  | 'breakfast_skipping'
  | 'bedtime'
  | 'wake_time'
  | 'morning_rested_score'
  | 'overnight_waking'
  | 'daily_stress_score'
  | 'stress_sources'
  | 'daytime_energy_crashes'
  | 'caffeine_dependence'
  | 'post_meal_discomfort'
  | 'post_meal_energy'
  | 'bowel_regular'
  | 'weekly_training_days'
  | 'training_types'
  | 'recovery_between_sessions'
  | 'daily_schedule'
  | 'non_fitness_activity';

export type OnboardingAnswerValue = string | string[] | number | null;

export type OnboardingAnswers = Partial<Record<OnboardingQuestionKey, OnboardingAnswerValue>>;

export type OnboardingOption = {
  value: string;
  label: string;
};

export type OnboardingQuestionType = 'single' | 'multi' | 'text' | 'time' | 'scale';

export type OnboardingQuestion = {
  key: OnboardingQuestionKey;
  section: string;
  prompt: string;
  helper?: string;
  type: OnboardingQuestionType;
  options?: OnboardingOption[];
  min?: number;
  max?: number;
  optional?: boolean;
};

export type TrainingExperience =
  | 'never_trained'
  | 'beginner'
  | 'intermediate'
  | 'advanced';

export type BaselineProfileInput = {
  userId: string;
  answers: OnboardingAnswers;
};

export type BaselineProfileDraft = {
  user_id: string;
  sleep_need_minutes_estimate: number;
  preferred_bedtime: string | null;
  preferred_waketime: string | null;
  hydration_target_ml: number;
  food_constraints: string[];
  training_capacity: {
    experience: TrainingExperience | null;
    weekly_training_days: string | null;
    equipment: string[];
  };
  movement_flags: string[];
  posture_flags: string[];
  stress_tendencies: string[];
  digestion_tendencies: string[];
  primary_goal: string | null;
  initial_foundation_scores: {
    recovery_rhythm: BaselineDomainScore;
    nourishment: BaselineDomainScore;
    movement_capacity: BaselineDomainScore;
    mind_life_load: BaselineDomainScore;
    plan_signals: BaselinePlanSignals;
    protocol_biases: string[];
    setup_v2?: {
      version: 2;
      baseline_mode: 'build' | 'maintain' | 'correct' | 'restore' | 'professional_guidance';
      primary_focus: FoundationDomain;
      confidence: DataConfidence;
      reason_codes: string[];
      missing_data: string[];
    };
  };
  calibration_status: 'calibrating';
};

export type BaselineDomainScore = {
  score: number;
  confidence: 'low';
  reason_codes: string[];
  limiting_factors: string[];
};

export type BaselinePlanSignals = {
  sleep_circadian_repair: number;
  stress_rhythm_support: number;
  food_quality_foundation: number;
  metabolic_stability: number;
  digestion_support: number;
  movement_reactivation: number;
  performance_recovery: number;
};

export type MetabolicType = 'protein' | 'mixed' | 'carbo';

export type OnboardingArchetype =
  | 'energyOptimizer'
  | 'bodyRecomposition'
  | 'sleepRebuilder'
  | 'stressRecovery'
  | 'gutHealer'
  | 'performanceAthlete';

export type OnboardingTag =
  | 'hpaFatigue'
  | 'bloodSugarDysregulation'
  | 'circadianDisruption'
  | 'poorSleep'
  | 'gutIssues'
  | 'overtraining'
  | 'sedentary'
  | 'caffeineDependence'
  | 'poorDietQuality'
  | 'underHydrated';

export type OnboardingDimensionScores = {
  stressScore: number;
  sleepScore: number;
  dietScore: number;
  digestiveScore: number;
  activityScore: number;
  metabolicType: MetabolicType;
  sleepDebt: number;
};

export type LifestylePlanResult = {
  plan: LifestylePlan;
  scores: OnboardingDimensionScores;
  tags: OnboardingTag[];
  archetype: OnboardingArchetype;
};

export type LifestylePlan = {
  archetype: OnboardingArchetype;
  metabolicType: MetabolicType;
  macroRatio: {
    protein: number;
    fat: number;
    carbs: number;
  };
  mealTiming: {
    protocol: string;
    description: string;
    mealsPerDay: number;
    fastingWindow: string | null;
  };
  sleepProtocol: {
    targetBedtime: string;
    screenCutoffMinutes: number;
    morningLight: boolean;
    notes?: string;
  };
  supplementFocus: Array<{
    name: string;
    timing: string;
    reason: string;
  }>;
  exerciseGuidance: {
    weeklyFrequency: number;
    intensity: string;
    focus: string;
    notes?: string;
  };
  stressProtocol: {
    priority: 'low' | 'moderate' | 'high';
    interventions: string[];
  };
  priorityFocus: string[];
  weeklyMilestones: string[];
  warningFlags: string[];
};

export type FoundationDomain =
  | 'recovery_rhythm'
  | 'nourishment'
  | 'movement_capacity'
  | 'mind_life_load'
  | 'balanced';

export type FocusDomainScore = {
  focus_pressure_score: number;
  confidence: DataConfidence;
  reason_codes: ReasonCode[];
  limiting_factors: string[];
};

export type TrainingBias =
  | 'normal_progression'
  | 'reduce_intensity'
  | 'increase_recovery_spacing'
  | 'movement_quality_first'
  | 'consistency_first'
  | 'stress_adapted_training';

export type LifestyleBias =
  | 'circadian_consistency'
  | 'hydration_and_meal_rhythm'
  | 'stress_decompression'
  | 'movement_restoration'
  | 'balanced';

export type NourishmentBias =
  | 'hydration_first'
  | 'meal_rhythm_first'
  | 'digestion_support'
  | 'protein_energy_adequacy'
  | 'food_constraints_awareness'
  | 'balanced';

export type RecoveryBias =
  | 'sleep_timing'
  | 'wind_down'
  | 'morning_light'
  | 'caffeine_cutoff'
  | 'recovery_spacing'
  | 'balanced';

export type BiweeklyFocusProfile = {
  user_id?: string;
  cycle_start_date: string;
  cycle_end_date: string;
  primary_focus: FoundationDomain;
  secondary_focus?: FoundationDomain;
  scorecard: {
    recovery_rhythm: FocusDomainScore;
    nourishment: FocusDomainScore;
    movement_capacity: FocusDomainScore;
    mind_life_load: FocusDomainScore;
  };
  confidence: DataConfidence;
  reason_codes: ReasonCode[];
  top_limiting_factors: string[];
  training_bias: TrainingBias;
  lifestyle_bias: LifestyleBias;
  nourishment_bias: NourishmentBias;
  recovery_bias: RecoveryBias;
  generated_from: 'onboarding' | 'biweekly_reassessment';
  calibration_status: 'calibrating' | 'active';
  reassessment_due_at: string;
  generated_at: string;
  dynamic_score_sheet: DynamicScoreSheet;
};

export type PriorityBand = 'low' | 'moderate' | 'high';

export type ScoreSheetDomain = {
  label: string;
  score: number;
  priority: PriorityBand;
  color_token: 'green' | 'yellow' | 'red';
  weight: number;
  reasons: RankedScoreReason[];
};

export type RankedScoreReason = {
  domain: Exclude<FoundationDomain, 'balanced'>;
  label: string;
  explanation: string;
  impact_score: number;
  reason_code: string;
};

export type DynamicScoreSheet = {
  overall_priority: PriorityBand;
  overall_score: number;
  domain_scores: {
    recovery_rhythm: ScoreSheetDomain;
    nourishment: ScoreSheetDomain;
    mind_life_load: ScoreSheetDomain;
    movement_capacity: ScoreSheetDomain;
  };
  ranked_reasons: RankedScoreReason[];
  summary: string;
};
