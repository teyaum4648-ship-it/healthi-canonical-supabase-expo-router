import type {
  DataConfidence,
  DayPlanReasonCode,
  DayScheduleBlock,
  DayScheduleBlockType
} from '../../engines/dayPlan';

export type DayScheduleBlockPersistenceFlexibility = 'fixed' | 'flexible' | 'movable';
export type DayScheduleBlockPersistenceSource = 'manual' | 'demo' | 'calendar_import' | 'system_suggested';

export type DayScheduleBlockPersistenceInput = {
  block_date?: string;
  start_at: string;
  end_at: string;
  block_type: DayScheduleBlockType;
  title?: string | null;
  description?: string | null;
  location?: string | null;
  flexibility?: DayScheduleBlockPersistenceFlexibility;
  is_protected?: boolean;
  source?: DayScheduleBlockPersistenceSource;
  source_confidence?: DataConfidence;
  reason_codes?: DayPlanReasonCode[];
};

export type DayScheduleBlockInsert = {
  user_id: string;
  block_date: string;
  start_at: string;
  end_at: string;
  block_type: DayScheduleBlockType;
  title: string | null;
  description: string | null;
  location: string | null;
  flexibility: DayScheduleBlockPersistenceFlexibility;
  is_protected: boolean;
  source: DayScheduleBlockPersistenceSource;
  source_confidence: DataConfidence;
  reason_codes: DayPlanReasonCode[];
};

export type DayScheduleBlockUpdate = Partial<Omit<DayScheduleBlockInsert, 'user_id'>>;

export type DayScheduleBlockRow = DayScheduleBlockInsert & {
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
  gt(column: string, value: string): SelectQuery<TRow>;
  lt(column: string, value: string): SelectQuery<TRow>;
  order(column: string, options: { ascending: boolean }): SelectQuery<TRow>;
  limit(count: number): Promise<QueryResponse<TRow[]>>;
};

type UpdateQuery<TRow> = {
  eq(column: string, value: string): UpdateQuery<TRow>;
  select(columns: string): {
    single(): Promise<QueryResponse<TRow>>;
  };
};

type DeleteQuery = {
  eq(column: string, value: string): DeleteQuery;
  then<TResult1 = QueryResponse<null>, TResult2 = never>(
    onfulfilled?: ((value: QueryResponse<null>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2>;
};

type TableQuery<TInsert, TRow> = {
  insert(payload: TInsert): InsertQuery<TRow>;
  select(columns: string): SelectQuery<TRow>;
  update(payload: Partial<TInsert>): UpdateQuery<TRow>;
  delete(): DeleteQuery;
};

export type DayScheduleBlockSupabaseClient = {
  from(table: 'day_schedule_blocks'): TableQuery<DayScheduleBlockInsert, DayScheduleBlockRow>;
};

function raiseSupabaseError(error: QueryError): never {
  throw new Error(error.message ?? 'Schedule block persistence request failed.');
}
function dateFromStart(startAt: string): string {
  return startAt.slice(0, 10);
}

function titleForBlock(input: DayScheduleBlockPersistenceInput): string | null {
  const trimmed = input.title?.trim();
  return trimmed ? trimmed : null;
}

export function toDayScheduleBlockInsert(
  block: DayScheduleBlockPersistenceInput,
  userId: string
): DayScheduleBlockInsert {
  return {
    user_id: userId,
    block_date: block.block_date ?? dateFromStart(block.start_at),
    start_at: block.start_at,
    end_at: block.end_at,
    block_type: block.block_type,
    title: titleForBlock(block),
    description: block.description?.trim() || null,
    location: block.location?.trim() || null,
    flexibility: block.flexibility ?? 'fixed',
    is_protected: block.is_protected ?? true,
    source: block.source ?? 'manual',
    source_confidence: block.source_confidence ?? 'medium',
    reason_codes: [...(block.reason_codes ?? ['manual_schedule_block'])]
  };
}

export function toDayScheduleBlockUpdate(
  block: Partial<DayScheduleBlockPersistenceInput>
): DayScheduleBlockUpdate {
  const update: DayScheduleBlockUpdate = {};

  if (block.block_date !== undefined) update.block_date = block.block_date;
  if (block.start_at !== undefined) update.start_at = block.start_at;
  if (block.end_at !== undefined) update.end_at = block.end_at;
  if (block.block_type !== undefined) update.block_type = block.block_type;
  if (block.title !== undefined) update.title = block.title?.trim() || null;
  if (block.description !== undefined) update.description = block.description?.trim() || null;
  if (block.location !== undefined) update.location = block.location?.trim() || null;
  if (block.flexibility !== undefined) update.flexibility = block.flexibility;
  if (block.is_protected !== undefined) update.is_protected = block.is_protected;
  if (block.source !== undefined) update.source = block.source;
  if (block.source_confidence !== undefined) update.source_confidence = block.source_confidence;
  if (block.reason_codes !== undefined) update.reason_codes = [...block.reason_codes];

  return update;
}

function engineFlexibility(row: DayScheduleBlockRow): DayScheduleBlock['flexibility'] {
  return row.flexibility === 'fixed' ? 'fixed' : 'flexible';
}

function engineSource(row: DayScheduleBlockRow): DayScheduleBlock['source'] {
  if (row.source === 'demo') return 'demo';
  if (row.source === 'system_suggested') return 'healthi_suggested';
  return 'user_entered';
}

export function dayScheduleBlockRowToEngineBlock(row: DayScheduleBlockRow): DayScheduleBlock {
  return {
    id: row.id,
    type: row.block_type,
    label: row.title ?? row.block_type,
    start: row.start_at,
    end: row.end_at,
    flexibility: engineFlexibility(row),
    source: engineSource(row),
    confidence: row.source_confidence,
    reason_codes: [...row.reason_codes]
  };
}

export async function saveDayScheduleBlock(
  client: DayScheduleBlockSupabaseClient,
  userId: string,
  block: DayScheduleBlockPersistenceInput
): Promise<DayScheduleBlockRow> {
  const payload = toDayScheduleBlockInsert(block, userId);
  const { data, error } = await client.from('day_schedule_blocks').insert(payload).select('*').single();

  if (error) {
    raiseSupabaseError(error);
  }

  if (!data) {
    throw new Error('Schedule block save returned no data.');
  }

  return data;
}

export async function updateDayScheduleBlock(
  client: DayScheduleBlockSupabaseClient,
  userId: string,
  blockId: string,
  block: Partial<DayScheduleBlockPersistenceInput>
): Promise<DayScheduleBlockRow> {
  const payload = toDayScheduleBlockUpdate(block);
  const { data, error } = await client
    .from('day_schedule_blocks')
    .update(payload)
    .eq('id', blockId)
    .eq('user_id', userId)
    .select('*')
    .single();

  if (error) {
    raiseSupabaseError(error);
  }

  if (!data) {
    throw new Error('Schedule block update returned no data.');
  }

  return data;
}

export async function deleteDayScheduleBlock(
  client: DayScheduleBlockSupabaseClient,
  userId: string,
  blockId: string
): Promise<void> {
  const { error } = await client
    .from('day_schedule_blocks')
    .delete()
    .eq('id', blockId)
    .eq('user_id', userId);

  if (error) {
    raiseSupabaseError(error);
  }
}

export async function getScheduleBlocksForDate(
  client: DayScheduleBlockSupabaseClient,
  userId: string,
  date: string,
  limit = 100
): Promise<DayScheduleBlockRow[]> {
  const { data, error } = await client
    .from('day_schedule_blocks')
    .select('*')
    .eq('user_id', userId)
    .eq('block_date', date.slice(0, 10))
    .order('start_at', { ascending: true })
    .limit(limit);

  if (error) {
    raiseSupabaseError(error);
  }

  return data ?? [];
}

export async function getScheduleBlocksForRange(
  client: DayScheduleBlockSupabaseClient,
  userId: string,
  startAt: string,
  endAt: string,
  limit = 200
): Promise<DayScheduleBlockRow[]> {
  const { data, error } = await client
    .from('day_schedule_blocks')
    .select('*')
    .eq('user_id', userId)
    .lt('start_at', endAt)
    .gt('end_at', startAt)
    .order('start_at', { ascending: true })
    .limit(limit);

  if (error) {
    raiseSupabaseError(error);
  }

  return data ?? [];
}
