import type { DataConfidence, SleepDataSource, SleepNeedEstimate, SleepSession } from '../../engines/circadian';

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export type SleepSessionPersistenceInput = SleepSession & {
  confirmed_by_user?: boolean;
  correction_of_session_id?: string | null;
  original_source_id?: string | null;
  raw_source_payload?: JsonValue;
};

export type SleepSessionInsert = {
  user_id: string;
  date: string;
  sleep_start_at: string | null;
  sleep_end_at: string | null;
  duration_minutes: number | null;
  sleep_quality: number | null;
  source: SleepDataSource;
  source_confidence: DataConfidence;
  corrected_by_user: boolean;
  confirmed_by_user: boolean;
  correction_of_session_id: string | null;
  original_source_id: string | null;
  raw_source_payload: JsonValue;
  reason_codes: string[];
};

export type SleepSessionRow = SleepSessionInsert & {
  id: string;
  created_at: string;
  updated_at: string;
};

export type SleepNeedEstimateInsert = {
  user_id: string;
  minutes: number;
  confidence: DataConfidence;
  basis: SleepNeedEstimate['basis'];
  is_active: boolean;
};

export type SleepNeedEstimateRow = SleepNeedEstimateInsert & {
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

export type SleepRhythmSupabaseClient = {
  from(table: 'sleep_sessions'): TableQuery<SleepSessionInsert, SleepSessionRow>;
  from(table: 'sleep_need_estimates'): TableQuery<SleepNeedEstimateInsert, SleepNeedEstimateRow>;
};

function raiseSupabaseError(error: QueryError): never {
  throw new Error(error.message ?? 'Sleep rhythm persistence request failed.');
}

export function toSleepSessionInsert(
  sleepSession: SleepSessionPersistenceInput,
  userId: string
): SleepSessionInsert {
  return {
    user_id: userId,
    date: sleepSession.date,
    sleep_start_at: sleepSession.sleep_start_at,
    sleep_end_at: sleepSession.sleep_end_at,
    duration_minutes: sleepSession.duration_minutes,
    sleep_quality: sleepSession.sleep_quality ?? null,
    source: sleepSession.source,
    source_confidence: sleepSession.source_confidence,
    corrected_by_user: sleepSession.corrected_by_user ?? false,
    confirmed_by_user: sleepSession.confirmed_by_user ?? false,
    correction_of_session_id: sleepSession.correction_of_session_id ?? null,
    original_source_id: sleepSession.original_source_id ?? null,
    raw_source_payload: sleepSession.raw_source_payload ?? null,
    reason_codes: [...sleepSession.reason_codes]
  };
}

export function toSleepNeedEstimateInsert(
  sleepNeed: SleepNeedEstimate,
  userId: string,
  isActive = true
): SleepNeedEstimateInsert {
  return {
    user_id: userId,
    minutes: sleepNeed.minutes,
    confidence: sleepNeed.confidence,
    basis: [...sleepNeed.basis],
    is_active: isActive
  };
}

export async function saveSleepSession(
  client: SleepRhythmSupabaseClient,
  userId: string,
  sleepSession: SleepSessionPersistenceInput
): Promise<SleepSessionRow> {
  const payload = toSleepSessionInsert(sleepSession, userId);
  const { data, error } = await client.from('sleep_sessions').insert(payload).select('*').single();

  if (error) {
    raiseSupabaseError(error);
  }

  if (!data) {
    throw new Error('Sleep session save returned no data.');
  }

  return data;
}

export async function getRecentSleepSessions(
  client: SleepRhythmSupabaseClient,
  userId: string,
  limit = 14
): Promise<SleepSessionRow[]> {
  const { data, error } = await client
    .from('sleep_sessions')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .limit(limit);

  if (error) {
    raiseSupabaseError(error);
  }

  return data ?? [];
}

export async function saveSleepNeedEstimate(
  client: SleepRhythmSupabaseClient,
  userId: string,
  sleepNeed: SleepNeedEstimate,
  isActive = true
): Promise<SleepNeedEstimateRow> {
  const payload = toSleepNeedEstimateInsert(sleepNeed, userId, isActive);
  const { data, error } = await client.from('sleep_need_estimates').insert(payload).select('*').single();

  if (error) {
    raiseSupabaseError(error);
  }

  if (!data) {
    throw new Error('Sleep need estimate save returned no data.');
  }

  return data;
}

export async function getActiveSleepNeedEstimate(
  client: SleepRhythmSupabaseClient,
  userId: string
): Promise<SleepNeedEstimateRow | null> {
  const { data, error } = await client
    .from('sleep_need_estimates')
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

