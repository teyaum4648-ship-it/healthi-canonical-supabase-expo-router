import type { ExplanationBlock, ReasonCode } from '../constants/reasonCodes';
import type { DayMode, DailyPriority } from './readiness';
import type { FoodPattern } from './food';

export type ShoppingMode =
  | 'build_my_cart'
  | 'scan_product'
  | 'compare_products'
  | 'budget_mode'
  | 'recovery_mode'
  | 'performance_mode'
  | 'meal_prep_week';

export type ShoppingListInput = {
  user_id: string;
  goal: string;
  day_mode: DayMode;
  daily_priority: DailyPriority;
  store_context?: string;
  days: number;
  servings: number;
  budget?: 'low' | 'medium' | 'high';
  cooking_time?: 'minimal' | 'moderate' | 'chef';
  food_patterns: FoodPattern[];
  allergies: string[];
  intolerances: string[];
  training_schedule?: Record<string, unknown>;
  pantry_items?: string[];
};

export type ShoppingCategory = {
  name: string;
  items: ShoppingListItem[];
};

export type ShoppingListItem = {
  name: string;
  quantity?: string;
  reason_codes: ReasonCode[];
  notes?: string;
};

export type ShoppingItemWarning = {
  name: string;
  reason_codes: ReasonCode[];
  notes: string;
};

export type MealPrepStep = {
  order: number;
  title: string;
  details: string;
};

export type RecipeSummary = {
  title: string;
  ingredients: string[];
  reason_codes: ReasonCode[];
};

export type ShoppingList = {
  id?: string;
  user_id: string;
  store_context?: string;
  days: number;
  servings: number;
  strategy_summary: string;
  categories: ShoppingCategory[];
  avoid_or_limit: ShoppingItemWarning[];
  recipes: RecipeSummary[];
  prep_plan: MealPrepStep[];
  explanation: ExplanationBlock;
};
