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
