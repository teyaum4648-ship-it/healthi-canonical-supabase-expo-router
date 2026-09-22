import type {
  DataConfidence,
  FoodQualityFlag,
  MealDataSource,
  MealLog,
  MealType,
  MealUserResponse,
  NutritionReasonCode,
  NutritionTargets
} from '../../engines/nutrition';

import type { MicronutrientAmounts } from '../../engines/nutrition/micronutrients';
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export type MealLogPersistenceInput = MealLog & {
  meal_date?: string;
  correction_of_meal_id?: string | null;
  original_source_id?: string | null;
  raw_source_payload?: JsonValue;
};

export type MealLogInsert = {
  user_id: string;
  logged_at: string;
  meal_date: string;
  meal_type: MealType;
  name: string;
  source: MealDataSource;
  source_confidence: DataConfidence;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fiber_g: number | null;
  sugar_g: number | null;
  sodium_mg: number | null;
  /** Sparse panel keyed by nutrient id; an absent key means unreported, not zero. */
  micronutrients: MicronutrientAmounts | null;
  ingredients: string[] | null;
  quality_flags: FoodQualityFlag[];
  user_response: MealUserResponse | null;
  corrected_by_user: boolean;
  confirmed_by_user: boolean;
  correction_of_meal_id: string | null;
  original_source_id: string | null;
  raw_source_payload: JsonValue;
  reason_codes: NutritionReasonCode[];
};

export type MealLogRow = MealLogInsert & {
  id: string;
  created_at: string;
  updated_at: string;
};

export type NutritionTargetInsert = {
  user_id: string;
  calories_target: number | null;
  protein_g_target: number | null;
  carbs_g_target: number | null;
  fat_g_target: number | null;
  fiber_g_target: number | null;
  sodium_mg_limit: number | null;
  confidence: DataConfidence;
  basis: NutritionTargets['basis'];
  is_active: boolean;
};

export type NutritionTargetRow = NutritionTargetInsert & {
  id: string;
  created_at: string;
  updated_at: string;
};

type QueryError = {
  message?: string;
};

type QueryResponse<T> = {
  data: T | null;
  error: QueryError | null;
};

type InsertQuery<TRow> = {
  select(columns: string): {
    single(): Promise<QueryResponse<TRow>>;
  };
};

type SelectQuery<TRow> = {
  eq(column: string, value: string | boolean): SelectQuery<TRow>;
  order(column: string, options: { ascending: boolean }): SelectQuery<TRow>;
  limit(count: number): Promise<QueryResponse<TRow[]>>;
};

type TableQuery<TInsert, TRow> = {
  insert(payload: TInsert): InsertQuery<TRow>;
  select(columns: string): SelectQuery<TRow>;
};

export type NutritionSupabaseClient = {
  from(table: 'meal_logs'): TableQuery<MealLogInsert, MealLogRow>;
  from(table: 'nutrition_targets'): TableQuery<NutritionTargetInsert, NutritionTargetRow>;
};

function raiseSupabaseError(error: QueryError): never {
  throw new Error(error.message ?? 'Nutrition persistence request failed.');
}

function dateFromLoggedAt(loggedAt: string): string {
  return loggedAt.slice(0, 10);
}

export function toMealLogInsert(
  mealLog: MealLogPersistenceInput,
  userId: string
): MealLogInsert {
  return {
    user_id: userId,
    logged_at: mealLog.logged_at,
    meal_date: mealLog.meal_date ?? dateFromLoggedAt(mealLog.logged_at),
    meal_type: mealLog.meal_type,
    name: mealLog.name,
    source: mealLog.source,
    source_confidence: mealLog.source_confidence,
    calories: mealLog.calories ?? null,
    protein_g: mealLog.protein_g ?? null,
    carbs_g: mealLog.carbs_g ?? null,
    fat_g: mealLog.fat_g ?? null,
    fiber_g: mealLog.fiber_g ?? null,
    sugar_g: mealLog.sugar_g ?? null,
    sodium_mg: mealLog.sodium_mg ?? null,
    micronutrients: mealLog.micronutrients ? { ...mealLog.micronutrients } : null,
    ingredients: mealLog.ingredients ? [...mealLog.ingredients] : null,
    quality_flags: [...mealLog.quality_flags],
    user_response: mealLog.user_response ? { ...mealLog.user_response } : null,
    corrected_by_user: mealLog.corrected_by_user ?? false,
    confirmed_by_user: mealLog.confirmed_by_user ?? false,
    correction_of_meal_id: mealLog.correction_of_meal_id ?? null,
    original_source_id: mealLog.original_source_id ?? null,
    raw_source_payload: mealLog.raw_source_payload ?? null,
    reason_codes: [...mealLog.reason_codes]
  };
}

export function toNutritionTargetInsert(
  target: NutritionTargets,
  userId: string,
  isActive = true
): NutritionTargetInsert {
  return {
    user_id: userId,
    calories_target: target.calories_target ?? null,
    protein_g_target: target.protein_g_target ?? null,
    carbs_g_target: target.carbs_g_target ?? null,
    fat_g_target: target.fat_g_target ?? null,
    fiber_g_target: target.fiber_g_target ?? null,
    sodium_mg_limit: target.sodium_mg_limit ?? null,
    confidence: target.confidence,
    basis: [...target.basis],
    is_active: isActive
  };
}

export async function saveMealLog(
  client: NutritionSupabaseClient,
  userId: string,
  mealLog: MealLogPersistenceInput
): Promise<MealLogRow> {
  const payload = toMealLogInsert(mealLog, userId);
  const { data, error } = await client.from('meal_logs').insert(payload).select('*').single();

  if (error) {
    raiseSupabaseError(error);
  }

  if (!data) {
    throw new Error('Meal log save returned no data.');
  }

  return data;
}

export async function getMealLogsForDate(
  client: NutritionSupabaseClient,
  userId: string,
  date: string,
  limit = 100
): Promise<MealLogRow[]> {
  const { data, error } = await client
    .from('meal_logs')
    .select('*')
    .eq('user_id', userId)
    .eq('meal_date', date.slice(0, 10))
    .order('logged_at', { ascending: true })
    .limit(limit);

  if (error) {
    raiseSupabaseError(error);
  }

  return data ?? [];
}

export async function getRecentMealLogs(
  client: NutritionSupabaseClient,
  userId: string,
  limit = 14
): Promise<MealLogRow[]> {
  const { data, error } = await client
    .from('meal_logs')
    .select('*')
    .eq('user_id', userId)
    .order('logged_at', { ascending: false })
    .limit(limit);

  if (error) {
    raiseSupabaseError(error);
  }

  return data ?? [];
}

export async function saveNutritionTarget(
  client: NutritionSupabaseClient,
  userId: string,
  target: NutritionTargets,
  isActive = true
): Promise<NutritionTargetRow> {
  const payload = toNutritionTargetInsert(target, userId, isActive);
  const { data, error } = await client.from('nutrition_targets').insert(payload).select('*').single();

  if (error) {
    raiseSupabaseError(error);
  }

  if (!data) {
    throw new Error('Nutrition target save returned no data.');
  }

  return data;
}

export async function getActiveNutritionTarget(
  client: NutritionSupabaseClient,
  userId: string
): Promise<NutritionTargetRow | null> {
  const { data, error } = await client
    .from('nutrition_targets')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) {
    raiseSupabaseError(error);
  }

  return data?.[0] ?? null;
}
