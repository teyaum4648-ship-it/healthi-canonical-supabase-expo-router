import type { DataConfidence, MealType, NutritionReasonCode } from '../../engines/nutrition';
import type { JsonValue } from './persistence';
import type { ProductProvider } from './productLookup/productLookupTypes';
import type { ProductQualityLabel } from './productLibraryPersistence';

export type MealItemSource = 'manual' | 'scanner' | 'search' | 'saved_food' | 'demo';

export type MealLogItemPersistenceInput = {
  meal_log_id?: string | null;
  food_product_id?: string | null;
  logged_at: string;
  meal_type: MealType;
  name: string;
  brand?: string | null;
  servings: number;
  serving_size?: string | null;
  serving_quantity_g?: number | null;
  calories?: number | null;
  protein_g?: number | null;
  carbs_g?: number | null;
  fat_g?: number | null;
  fiber_g?: number | null;
  sugar_g?: number | null;
  sodium_mg?: number | null;
  saturated_fat_g?: number | null;
  barcode?: string | null;
  provider?: ProductProvider | null;
  provider_product_id?: string | null;
  quality_label?: ProductQualityLabel | null;
  quality_score?: number | null;
  quality_confidence?: DataConfidence | null;
  source?: MealItemSource;
  source_confidence?: DataConfidence;
  reason_codes?: NutritionReasonCode[];
  metadata?: JsonValue;
};

export type MealLogItemInsert = Required<Pick<MealLogItemPersistenceInput, 'logged_at' | 'meal_type' | 'name' | 'servings'>> & {
  user_id: string;
  meal_log_id: string | null;
  food_product_id: string | null;
  brand: string | null;
  serving_size: string | null;
  serving_quantity_g: number | null;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fiber_g: number | null;
  sugar_g: number | null;
  sodium_mg: number | null;
  saturated_fat_g: number | null;
  barcode: string | null;
  provider: ProductProvider | null;
  provider_product_id: string | null;
  quality_label: ProductQualityLabel | null;
  quality_score: number | null;
  quality_confidence: DataConfidence | null;
  source: MealItemSource;
  source_confidence: DataConfidence;
  reason_codes: NutritionReasonCode[];
  metadata: JsonValue;
};

export type MealLogItemRow = MealLogItemInsert & { id: string; created_at: string; updated_at: string };

type QueryError = { message?: string };
type QueryResponse<T> = { data: T | null; error: QueryError | null };
type InsertQuery = { select(columns: string): { single(): Promise<QueryResponse<MealLogItemRow>> } };
type InsertManyQuery = { select(columns: string): Promise<QueryResponse<MealLogItemRow[]>> };
type SelectQuery = {
  eq(column: string, value: string): SelectQuery;
  gte(column: string, value: string): SelectQuery;
  lt(column: string, value: string): SelectQuery;
  order(column: string, options: { ascending: boolean }): SelectQuery;
  limit(count: number): Promise<QueryResponse<MealLogItemRow[]>>;
};
type DeleteQuery = {
  eq(column: string, value: string): DeleteQuery;
  then<TResult1 = QueryResponse<null>, TResult2 = never>(
    onfulfilled?: ((value: QueryResponse<null>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2>;
};
type MealItemTableQuery = {
  insert(payload: MealLogItemInsert): InsertQuery;
  insert(payload: MealLogItemInsert[]): InsertManyQuery;
  select(columns: string): SelectQuery;
  delete(): DeleteQuery;
};

export type MealItemSupabaseClient = { from(table: 'meal_log_items'): MealItemTableQuery };

function raiseSupabaseError(error: QueryError): never {
  throw new Error(error.message ?? 'Meal item persistence request failed.');
}

function nullableText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function toMealLogItemInsert(
  item: MealLogItemPersistenceInput,
  userId: string
): MealLogItemInsert {
  return {
    user_id: userId,
    meal_log_id: item.meal_log_id ?? null,
    food_product_id: item.food_product_id ?? null,
    logged_at: item.logged_at,
    meal_type: item.meal_type,
    name: item.name.trim() || 'Food item',
    brand: nullableText(item.brand),
    servings: item.servings,
    serving_size: nullableText(item.serving_size),
    serving_quantity_g: item.serving_quantity_g ?? null,
    calories: item.calories ?? null,
    protein_g: item.protein_g ?? null,
    carbs_g: item.carbs_g ?? null,
    fat_g: item.fat_g ?? null,
    fiber_g: item.fiber_g ?? null,
    sugar_g: item.sugar_g ?? null,
    sodium_mg: item.sodium_mg ?? null,
    saturated_fat_g: item.saturated_fat_g ?? null,
    barcode: nullableText(item.barcode),
    provider: item.provider ?? null,
    provider_product_id: nullableText(item.provider_product_id),
    quality_label: item.quality_label ?? null,
    quality_score: item.quality_score ?? null,
    quality_confidence: item.quality_confidence ?? null,
    source: item.source ?? 'manual',
    source_confidence: item.source_confidence ?? 'medium',
    reason_codes: [...(item.reason_codes ?? ['manual_food_log'])],
    metadata: item.metadata ?? null
  };
}

export async function saveMealLogItem(
  client: MealItemSupabaseClient,
  userId: string,
  item: MealLogItemPersistenceInput
): Promise<MealLogItemRow> {
  const { data, error } = await client.from('meal_log_items').insert(toMealLogItemInsert(item, userId)).select('*').single();
  if (error) raiseSupabaseError(error);
  if (!data) throw new Error('Meal item save returned no data.');
  return data;
}

export async function saveMealLogItems(
  client: MealItemSupabaseClient,
  userId: string,
  items: MealLogItemPersistenceInput[]
): Promise<MealLogItemRow[]> {
  if (items.length === 0) return [];
  const { data, error } = await client.from('meal_log_items').insert(items.map((item) => toMealLogItemInsert(item, userId))).select('*');
  if (error) raiseSupabaseError(error);
  return data ?? [];
}

export async function getMealLogItemsForDate(
  client: MealItemSupabaseClient,
  userId: string,
  date: string,
  limit = 200
): Promise<MealLogItemRow[]> {
  const start = `${date.slice(0, 10)}T00:00:00.000Z`;
  const nextDay = new Date(`${date.slice(0, 10)}T00:00:00.000Z`);
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);
  const { data, error } = await client
    .from('meal_log_items')
    .select('*')
    .eq('user_id', userId)
    .gte('logged_at', start)
    .lt('logged_at', nextDay.toISOString())
    .order('logged_at', { ascending: true })
    .limit(limit);
  if (error) raiseSupabaseError(error);
  return data ?? [];
}

export async function getMealLogItemsForMealLog(
  client: MealItemSupabaseClient,
  userId: string,
  mealLogId: string,
  limit = 100
): Promise<MealLogItemRow[]> {
  const { data, error } = await client
    .from('meal_log_items')
    .select('*')
    .eq('user_id', userId)
    .eq('meal_log_id', mealLogId)
    .order('created_at', { ascending: true })
    .limit(limit);
  if (error) raiseSupabaseError(error);
  return data ?? [];
}

export async function deleteMealLogItem(
  client: MealItemSupabaseClient,
  userId: string,
  itemId: string
): Promise<void> {
  const { error } = await client.from('meal_log_items').delete().eq('id', itemId).eq('user_id', userId);
  if (error) raiseSupabaseError(error);
}
