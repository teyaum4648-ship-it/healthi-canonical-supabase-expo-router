import type {
  FoodPatternAnswers,
  FoodPatternQuestionId,
  FoodQualityFlag,
  MealLog,
  MealType,
  NutritionReasonCode
} from '../../engines/nutrition';
import type { PostMealResponseLogInput } from './foodPersonalizationPersistence';

export type ManualMealFormState = {
  name: string;
  meal_type: MealType;
  logged_at: string;
  calories: string;
  protein_g: string;
  carbs_g: string;
  fat_g: string;
  fiber_g: string;
  sugar_g: string;
  sodium_mg: string;
  quality_flags: FoodQualityFlag[];
};

export type ResponseLogFormState = {
  meal_log_id: string | null;
  responded_at: string;
  minutes_after_meal: string;
  overall_score: string;
  digestion: PostMealResponseLogInput['digestion'];
  energy: PostMealResponseLogInput['energy'];
  appetite: PostMealResponseLogInput['appetite'];
  focus: PostMealResponseLogInput['focus'];
  cravings: PostMealResponseLogInput['cravings'];
  notes: string;
};

export type FoodPatternQuestionOption = {
  label: string;
  value: string;
};

export type FoodPatternQuestion = {
  id: FoodPatternQuestionId;
  prompt: string;
  options: FoodPatternQuestionOption[];
};

export type FoodPatternAnswerDraft = Partial<Record<FoodPatternQuestionId, string | null>>;

export const mealTypes: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack', 'unknown'];

export const qualityFlagOptions: Array<{ label: string; value: FoodQualityFlag }> = [
  { label: 'Whole food emphasis', value: 'whole_food_emphasis' },
  { label: 'Balanced meal', value: 'balanced_meal' },
  { label: 'Added sugar', value: 'added_sugar' },
  { label: 'High sodium', value: 'high_sodium' },
  { label: 'Low fiber', value: 'low_fiber' },
  { label: 'Protein low', value: 'protein_low' },
  { label: 'Ultra-processed indicator', value: 'ultra_processed_indicator' }
];

export const foodPatternQuestions: FoodPatternQuestion[] = [
  {
    id: 'protein_meal_energy',
    prompt: 'After a protein-forward meal, your energy usually feels:',
    options: [
      { label: 'Steady and satisfied', value: 'steady' },
      { label: 'Heavy or slower', value: 'heavy' },
      { label: 'Neutral', value: 'neutral' },
      { label: 'Not sure yet', value: 'not_sure' }
    ]
  },
  {
    id: 'carb_meal_energy',
    prompt: 'After a higher-carb meal, your energy usually feels:',
    options: [
      { label: 'Steady', value: 'steady' },
      { label: 'A dip later', value: 'dip' },
      { label: 'It depends', value: 'depends' },
      { label: 'Not sure yet', value: 'not_sure' }
    ]
  },
  {
    id: 'hunger_frequency',
    prompt: 'How long do meals usually hold you?',
    options: [
      { label: 'Under 2 hours', value: 'under_2_hours' },
      { label: '3-4 hours', value: 'three_to_four_hours' },
      { label: '5+ hours', value: 'five_plus_hours' },
      { label: 'It varies', value: 'varies' }
    ]
  },
  {
    id: 'cravings_pattern',
    prompt: 'When do cravings show up most?',
    options: [
      { label: 'Afternoon', value: 'afternoon' },
      { label: 'Evening', value: 'evening' },
      { label: 'After sweets', value: 'after_sweets' },
      { label: 'Rarely', value: 'rare' }
    ]
  },
  {
    id: 'large_meal_digestion',
    prompt: 'Large meals usually feel:',
    options: [
      { label: 'Fine', value: 'fine' },
      { label: 'Heavy', value: 'heavy' },
      { label: 'Sleepy afterward', value: 'sleepy' },
      { label: 'Not sure yet', value: 'not_sure' }
    ]
  },
  {
    id: 'higher_fat_meal_response',
    prompt: 'Higher-fat meals usually feel:',
    options: [
      { label: 'Satisfying', value: 'satisfied' },
      { label: 'Heavy', value: 'heavy' },
      { label: 'Neutral', value: 'neutral' },
      { label: 'Depends on timing', value: 'depends_on_timing' }
    ]
  },
  {
    id: 'breakfast_skip_response',
    prompt: 'When you skip breakfast, you usually:',
    options: [
      { label: 'Feel fine', value: 'fine' },
      { label: 'Feel a crash', value: 'crash' },
      { label: 'Eat more later', value: 'overeat_later' },
      { label: 'Do not skip it', value: 'not_applicable' }
    ]
  },
  {
    id: 'afternoon_energy',
    prompt: 'Your afternoon energy is usually:',
    options: [
      { label: 'Steady', value: 'steady' },
      { label: 'Dips', value: 'dip' },
      { label: 'Depends on lunch', value: 'depends_lunch' },
      { label: 'Only shifts on training days', value: 'training_days_only' }
    ]
  },
  {
    id: 'late_dinner_response',
    prompt: 'Late dinners usually feel:',
    options: [
      { label: 'Fine', value: 'fine' },
      { label: 'Restless later', value: 'restless' },
      { label: 'Heavy', value: 'heavy' },
      { label: 'Not sure yet', value: 'not_sure' }
    ]
  },
  {
    id: 'heavy_dinner_sleep',
    prompt: 'A heavier dinner usually makes the next morning feel:',
    options: [
      { label: 'Unchanged', value: 'unchanged' },
      { label: 'Less rested', value: 'worse_sleep' },
      { label: 'Slow to start', value: 'slow_morning' },
      { label: 'Not sure yet', value: 'not_sure' }
    ]
  },
  {
    id: 'training_fuel_need',
    prompt: 'On training days, you usually need:',
    options: [
      { label: 'More carbs', value: 'extra_carbs' },
      { label: 'More protein', value: 'extra_protein' },
      { label: 'Normal meals', value: 'normal_meals' },
      { label: 'Not active right now', value: 'not_active' }
    ]
  },
  {
    id: 'appetite_stability',
    prompt: 'Your appetite usually feels:',
    options: [
      { label: 'Predictable', value: 'predictable' },
      { label: 'Up and down', value: 'swings' },
      { label: 'Low then high later', value: 'low_then_high' },
      { label: 'Not sure yet', value: 'not_sure' }
    ]
  },
  {
    id: 'meal_size_preference',
    prompt: 'You tend to do best with:',
    options: [
      { label: 'Three balanced meals', value: 'three_balanced' },
      { label: 'Smaller meals more often', value: 'smaller_more_often' },
      { label: 'Larger meals, fewer times', value: 'larger_fewer' },
      { label: 'Changes daily', value: 'changes_daily' }
    ]
  },
  {
    id: 'caffeine_food_sensitivity',
    prompt: 'Caffeine without food usually feels:',
    options: [
      { label: 'Fine', value: 'fine' },
      { label: 'Too sharp or a later dip', value: 'wired_or_crash' },
      { label: 'Better after food', value: 'need_food_first' },
      { label: 'Rare caffeine', value: 'rare_caffeine' }
    ]
  },
  {
    id: 'stress_life_load_eating',
    prompt: 'When life gets busy, you usually:',
    options: [
      { label: 'Eat steadily', value: 'steady' },
      { label: 'Forget food', value: 'forget_food' },
      { label: 'Snack more', value: 'snack_more' },
      { label: 'Eat heavier at dinner', value: 'dinner_heavier' }
    ]
  },
  {
    id: 'morning_fueling_pattern',
    prompt: 'Your morning fueling pattern is closest to:',
    options: [
      { label: 'Protein-forward breakfast', value: 'protein_breakfast' },
      { label: 'Carb-forward breakfast', value: 'carb_breakfast' },
      { label: 'Light start', value: 'light_start' },
      { label: 'No breakfast', value: 'no_breakfast' }
    ]
  }
];

export function createEmptyManualMealForm(now = new Date().toISOString()): ManualMealFormState {
  return {
    name: '',
    meal_type: 'unknown',
    logged_at: now,
    calories: '',
    protein_g: '',
    carbs_g: '',
    fat_g: '',
    fiber_g: '',
    sugar_g: '',
    sodium_mg: '',
    quality_flags: []
  };
}

export function createEmptyResponseLogForm(now = new Date().toISOString()): ResponseLogFormState {
  return {
    meal_log_id: null,
    responded_at: now,
    minutes_after_meal: '90',
    overall_score: '7',
    digestion: 'neutral',
    energy: 'steady',
    appetite: 'stable',
    focus: 'neutral',
    cravings: 'none',
    notes: ''
  };
}

export function parseOptionalNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return null;

  return Math.max(0, Math.round(parsed * 10) / 10);
}

export function clampOverallScore(value: string | number): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return 5;

  return Math.max(1, Math.min(10, Math.round(parsed)));
}

export function isSparseMealForm(form: ManualMealFormState): boolean {
  const knownCoreCount = [form.calories, form.protein_g, form.carbs_g, form.fat_g].filter(
    (value) => parseOptionalNumber(value) !== null
  ).length;

  return knownCoreCount < 2;
}

export function manualMealFormToMealLog(
  form: ManualMealFormState,
  now = new Date().toISOString()
): MealLog {
  const reasonCodes: NutritionReasonCode[] = ['manual_food_log'];

  if (isSparseMealForm(form)) {
    reasonCodes.push('nutrition_calibrating', 'partial_nutrition_data');
  }

  return {
    logged_at: form.logged_at || now,
    meal_type: form.meal_type,
    name: form.name.trim() || 'Manual meal',
    source: 'manual',
    source_confidence: 'medium',
    calories: parseOptionalNumber(form.calories),
    protein_g: parseOptionalNumber(form.protein_g),
    carbs_g: parseOptionalNumber(form.carbs_g),
    fat_g: parseOptionalNumber(form.fat_g),
    fiber_g: parseOptionalNumber(form.fiber_g),
    sugar_g: parseOptionalNumber(form.sugar_g),
    sodium_mg: parseOptionalNumber(form.sodium_mg),
    ingredients: null,
    quality_flags: [...form.quality_flags],
    user_response: null,
    corrected_by_user: false,
    confirmed_by_user: true,
    reason_codes: reasonCodes,
    created_at: now
  };
}

export function responseLogFormToInput(form: ResponseLogFormState): PostMealResponseLogInput {
  return {
    meal_log_id: form.meal_log_id,
    responded_at: form.responded_at,
    minutes_after_meal: parseOptionalNumber(form.minutes_after_meal),
    overall_score: clampOverallScore(form.overall_score),
    digestion: form.digestion,
    energy: form.energy,
    appetite: form.appetite,
    focus: form.focus,
    cravings: form.cravings,
    notes: form.notes.trim() || null,
    confidence: 'medium',
    reason_codes: ['post_meal_response_logged']
  };
}

export function foodPatternDraftToAnswers(draft: FoodPatternAnswerDraft): FoodPatternAnswers {
  return foodPatternQuestions.reduce<FoodPatternAnswers>((answers, question) => {
    const value = draft[question.id];
    answers[question.id] = value ?? null;
    return answers;
  }, {});
}

export function demoModeLabel(isRemoteConfigured: boolean, hasUser: boolean): string {
  if (isRemoteConfigured && hasUser) return 'Synced when saved';
  if (isRemoteConfigured) return 'Local preview';
  return 'Local demo mode';
}
