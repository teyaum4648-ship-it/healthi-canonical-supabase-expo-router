import type {
  DataConfidence,
  FoodPatternProfile,
  FoodPatternReasonCode,
  FoodPatternScores
} from '../../engines/nutrition';
import type { JsonValue } from './persistence';

export type FoodPatternProfilePersistenceInput = FoodPatternProfile & {
  is_active?: boolean;
};

export type FoodPatternProfileInsert = {
  user_id: string;
  source: FoodPatternProfile['source'];
  confidence: DataConfidence;
  pattern_label: FoodPatternProfile['pattern_label'];
  scores: FoodPatternScores;
  macro_tendency: FoodPatternProfile['macro_tendency'];
  meal_timing_tendency: FoodPatternProfile['meal_timing_tendency'];
  response_tendencies: FoodPatternProfile['response_tendencies'];
  is_active: boolean;
  reason_codes: FoodPatternReasonCode[];
};

export type FoodPatternProfileRow = FoodPatternProfileInsert & {
  id: string;
  created_at: string;
  updated_at: string;
};

export type PostMealResponseLogInput = {
  meal_log_id?: string | null;
  responded_at: string;
  minutes_after_meal?: number | null;
  overall_score: number;
  digestion?: 'good' | 'neutral' | 'heavy' | 'uncomfortable' | null;
  energy?: 'better' | 'steady' | 'dip' | null;
  appetite?: 'stable' | 'hungry_soon' | 'overfull' | null;
  focus?: 'clear' | 'neutral' | 'foggy' | null;
  cravings?: 'none' | 'mild' | 'strong' | null;
  notes?: string | null;
  confidence: DataConfidence;
  reason_codes: string[];
};

export type PostMealResponseLogInsert = {
  user_id: string;
  meal_log_id: string | null;
  responded_at: string;
  minutes_after_meal: number | null;
  overall_score: number;
  digestion: PostMealResponseLogInput['digestion'];
  energy: PostMealResponseLogInput['energy'];
  appetite: PostMealResponseLogInput['appetite'];
  focus: PostMealResponseLogInput['focus'];
  cravings: PostMealResponseLogInput['cravings'];
  notes: string | null;
  confidence: DataConfidence;
  reason_codes: string[];
};

export type PostMealResponseLogRow = PostMealResponseLogInsert & {
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

type UpdateQuery<TRow> = {
  eq(column: string, value: string | boolean): UpdateQuery<TRow>;
  then<TResult1 = QueryResponse<TRow[]>, TResult2 = never>(
    onfulfilled?: ((value: QueryResponse<TRow[]>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2>;
};

type TableQuery<TInsert, TRow> = {
  insert(payload: TInsert): InsertQuery<TRow>;
  select(columns: string): SelectQuery<TRow>;
  update(payload: Partial<TInsert>): UpdateQuery<TRow>;
};

export type FoodPersonalizationSupabaseClient = {
  from(table: 'food_pattern_profiles'): TableQuery<FoodPatternProfileInsert, FoodPatternProfileRow>;
  from(table: 'post_meal_response_logs'): TableQuery<PostMealResponseLogInsert, PostMealResponseLogRow>;
};

function raiseSupabaseError(error: QueryError): never {
  throw new Error(error.message ?? 'Food personalization persistence request failed.');
}

function cloneJson<T extends JsonValue | object>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function toFoodPatternProfileInsert(
  profile: FoodPatternProfilePersistenceInput,
  userId: string,
  isActive = profile.is_active ?? true
): FoodPatternProfileInsert {
  return {
    user_id: userId,
    source: profile.source,
    confidence: profile.confidence,
    pattern_label: profile.pattern_label,
    scores: cloneJson(profile.scores),
    macro_tendency: cloneJson(profile.macro_tendency),
    meal_timing_tendency: cloneJson(profile.meal_timing_tendency),
    response_tendencies: cloneJson(profile.response_tendencies),
    is_active: isActive,
    reason_codes: [...profile.reason_codes]
  };
}

export function toPostMealResponseLogInsert(
  responseLog: PostMealResponseLogInput,
  userId: string
): PostMealResponseLogInsert {
  return {
    user_id: userId,
    meal_log_id: responseLog.meal_log_id ?? null,
    responded_at: responseLog.responded_at,
    minutes_after_meal: responseLog.minutes_after_meal ?? null,
    overall_score: responseLog.overall_score,
    digestion: responseLog.digestion ?? null,
    energy: responseLog.energy ?? null,
    appetite: responseLog.appetite ?? null,
    focus: responseLog.focus ?? null,
    cravings: responseLog.cravings ?? null,
    notes: responseLog.notes ?? null,
    confidence: responseLog.confidence,
    reason_codes: [...responseLog.reason_codes]
  };
}

export async function saveFoodPatternProfile(
  client: FoodPersonalizationSupabaseClient,
  userId: string,
  profile: FoodPatternProfilePersistenceInput,
  isActive = profile.is_active ?? true
): Promise<FoodPatternProfileRow> {
  const payload = toFoodPatternProfileInsert(profile, userId, isActive);
  const { data, error } = await client.from('food_pattern_profiles').insert(payload).select('*').single();

  if (error) {
    raiseSupabaseError(error);
  }

  if (!data) {
    throw new Error('Food pattern profile save returned no data.');
  }

  return data;
}

export async function replaceActiveFoodPatternProfile(
  client: FoodPersonalizationSupabaseClient,
  userId: string,
  profile: FoodPatternProfilePersistenceInput
): Promise<FoodPatternProfileRow> {
  const { error } = await client
    .from('food_pattern_profiles')
    .update({ is_active: false })
    .eq('user_id', userId)
    .eq('is_active', true);

  if (error) {
    raiseSupabaseError(error);
  }

  return saveFoodPatternProfile(client, userId, profile, true);
}

export async function getActiveFoodPatternProfile(
  client: FoodPersonalizationSupabaseClient,
  userId: string
): Promise<FoodPatternProfileRow | null> {
  const { data, error } = await client
    .from('food_pattern_profiles')
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

export async function savePostMealResponseLog(
  client: FoodPersonalizationSupabaseClient,
  userId: string,
  responseLog: PostMealResponseLogInput
): Promise<PostMealResponseLogRow> {
  const payload = toPostMealResponseLogInsert(responseLog, userId);
  const { data, error } = await client.from('post_meal_response_logs').insert(payload).select('*').single();

  if (error) {
    raiseSupabaseError(error);
  }

  if (!data) {
    throw new Error('Post-meal response log save returned no data.');
  }

  return data;
}

export async function getPostMealResponseLogsForMeal(
  client: FoodPersonalizationSupabaseClient,
  userId: string,
  mealLogId: string,
  limit = 20
): Promise<PostMealResponseLogRow[]> {
  const { data, error } = await client
    .from('post_meal_response_logs')
    .select('*')
    .eq('user_id', userId)
    .eq('meal_log_id', mealLogId)
    .order('responded_at', { ascending: false })
    .limit(limit);

  if (error) {
    raiseSupabaseError(error);
  }

  return data ?? [];
}

export async function getRecentPostMealResponseLogs(
  client: FoodPersonalizationSupabaseClient,
  userId: string,
  limit = 20
): Promise<PostMealResponseLogRow[]> {
  const { data, error } = await client
    .from('post_meal_response_logs')
    .select('*')
    .eq('user_id', userId)
    .order('responded_at', { ascending: false })
    .limit(limit);

  if (error) {
    raiseSupabaseError(error);
  }

  return data ?? [];
}
