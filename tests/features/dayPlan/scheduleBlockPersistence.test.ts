import { describe, expect, it } from 'vitest';

import type { DayPlanReasonCode } from '../../../src/engines/dayPlan';
import {
  dayScheduleBlockRowToEngineBlock,
  deleteDayScheduleBlock,
  getScheduleBlocksForDate,
  getScheduleBlocksForRange,
  saveDayScheduleBlock,
  toDayScheduleBlockInsert,
  type DayScheduleBlockInsert,
  type DayScheduleBlockPersistenceInput,
  type DayScheduleBlockRow,
  type DayScheduleBlockSupabaseClient
} from '../../../src/features/dayPlan/scheduleBlockPersistence';

const userId = '00000000-0000-0000-0000-000000000001';

function baseBlock(overrides: Partial<DayScheduleBlockPersistenceInput> = {}): DayScheduleBlockPersistenceInput {
  return {
    block_date: '2026-07-12',
    start_at: '2026-07-12T09:00:00.000Z',
    end_at: '2026-07-12T17:00:00.000Z',
    block_type: 'work',
    title: 'Work block',
    description: 'Focused desk block',
    location: 'Office',
    flexibility: 'fixed',
    is_protected: true,
    source: 'manual',
    source_confidence: 'medium',
    reason_codes: ['manual_schedule_block'],
    ...overrides
  };
}

function row(overrides: Partial<DayScheduleBlockRow> = {}): DayScheduleBlockRow {
  const payload = toDayScheduleBlockInsert(baseBlock(), userId);
  return {
    ...payload,
    id: '11111111-1111-1111-1111-111111111111',
    created_at: '2026-07-12T09:01:00.000Z',
    updated_at: '2026-07-12T09:01:00.000Z',
    ...overrides
  };
}

function createClient(calls: Array<{ action: string; payload?: unknown; column?: string; value?: unknown }>, rows = [row()]) {
  return {
    from(table: 'day_schedule_blocks') {
      calls.push({ action: 'from', value: table });
      return {
        insert(payload: DayScheduleBlockInsert) {
          calls.push({ action: 'insert', payload });
          return {
            select(columns: string) {
              calls.push({ action: 'insert_select', value: columns });
              return {
                single() {
                  calls.push({ action: 'insert_single' });
                  return Promise.resolve({ data: { ...row(), ...payload }, error: null });
                }
              };
            }
          };
        },
        select(columns: string) {
          calls.push({ action: 'select', value: columns });
          const query = {
            eq(column: string, value: string | boolean) {
              calls.push({ action: 'eq', column, value });
              return query;
            },
            gt(column: string, value: string) {
              calls.push({ action: 'gt', column, value });
              return query;
            },
            lt(column: string, value: string) {
              calls.push({ action: 'lt', column, value });
              return query;
            },
            order(column: string, payload: { ascending: boolean }) {
              calls.push({ action: 'order', column, payload });
              return query;
            },
            limit(count: number) {
              calls.push({ action: 'limit', value: count });
              return Promise.resolve({ data: rows, error: null });
            }
          };
          return query;
        },
        update() {
          throw new Error('Unexpected update.');
        },
        delete() {
          calls.push({ action: 'delete' });
          const query = {
            eq(column: string, value: string) {
              calls.push({ action: 'delete_eq', column, value });
              return query;
            },
            then<TResult1 = { data: null; error: null }, TResult2 = never>(
              onfulfilled?: ((value: { data: null; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
              _onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
            ) {
              return Promise.resolve({ data: null, error: null }).then(onfulfilled ?? ((value) => value as TResult1));
            }
          };
          return query;
        }
      };
    }
  } as unknown as DayScheduleBlockSupabaseClient;
}

describe('schedule block persistence', () => {
  it('maps required fields', () => {
    const payload = toDayScheduleBlockInsert(baseBlock(), userId);

    expect(payload).toEqual({
      user_id: userId,
      block_date: '2026-07-12',
      start_at: '2026-07-12T09:00:00.000Z',
      end_at: '2026-07-12T17:00:00.000Z',
      block_type: 'work',
      title: 'Work block',
      description: 'Focused desk block',
      location: 'Office',
      flexibility: 'fixed',
      is_protected: true,
      source: 'manual',
      source_confidence: 'medium',
      reason_codes: ['manual_schedule_block']
    });
  });

  it('preserves optional fields and trims empty text safely', () => {
    const payload = toDayScheduleBlockInsert(
      baseBlock({
        title: '  ',
        description: '',
        location: undefined,
        flexibility: 'movable',
        is_protected: false,
        source: 'demo',
        source_confidence: 'low'
      }),
      userId
    );

    expect(payload.title).toBeNull();
    expect(payload.description).toBeNull();
    expect(payload.location).toBeNull();
    expect(payload.flexibility).toBe('movable');
    expect(payload.is_protected).toBe(false);
    expect(payload.source).toBe('demo');
    expect(payload.source_confidence).toBe('low');
  });

  it('preserves reason codes without mutating source', () => {
    const reasons: DayPlanReasonCode[] = ['manual_schedule_block', 'user_fixed_block'];
    const payload = toDayScheduleBlockInsert(baseBlock({ reason_codes: reasons }), userId);

    payload.reason_codes.push('schedule_blocks_available');

    expect(reasons).toEqual(['manual_schedule_block', 'user_fixed_block']);
  });

  it('supports overnight block mapping', () => {
    const payload = toDayScheduleBlockInsert(
      baseBlock({
        block_type: 'sleep',
        start_at: '2026-07-12T22:30:00.000Z',
        end_at: '2026-07-13T06:30:00.000Z'
      }),
      userId
    );

    expect(payload.block_date).toBe('2026-07-12');
    expect(new Date(payload.end_at).getTime()).toBeGreaterThan(new Date(payload.start_at).getTime());
  });

  it('does not reject overlapping blocks in mapping helpers', () => {
    const first = toDayScheduleBlockInsert(baseBlock({ start_at: '2026-07-12T09:00:00.000Z', end_at: '2026-07-12T11:00:00.000Z' }), userId);
    const second = toDayScheduleBlockInsert(baseBlock({ block_type: 'commute', start_at: '2026-07-12T10:30:00.000Z', end_at: '2026-07-12T12:00:00.000Z' }), userId);

    expect(first.end_at).toBe('2026-07-12T11:00:00.000Z');
    expect(second.start_at).toBe('2026-07-12T10:30:00.000Z');
  });

  it('maps rows into Day Plan engine blocks', () => {
    const engineBlock = dayScheduleBlockRowToEngineBlock(row({ source: 'manual', flexibility: 'movable' }));

    expect(engineBlock).toEqual({
      id: '11111111-1111-1111-1111-111111111111',
      type: 'work',
      label: 'Work block',
      start: '2026-07-12T09:00:00.000Z',
      end: '2026-07-12T17:00:00.000Z',
      flexibility: 'flexible',
      source: 'user_entered',
      confidence: 'medium',
      reason_codes: ['manual_schedule_block']
    });
  });

  it('date query helper filters by user and block date', async () => {
    const calls: Array<{ action: string; payload?: unknown; column?: string; value?: unknown }> = [];
    await getScheduleBlocksForDate(createClient(calls), userId, '2026-07-12');

    expect(calls).toEqual(expect.arrayContaining([
      { action: 'eq', column: 'user_id', value: userId },
      { action: 'eq', column: 'block_date', value: '2026-07-12' },
      { action: 'order', column: 'start_at', payload: { ascending: true } }
    ]));
  });

  it('range query helper uses safe overlap filters', async () => {
    const calls: Array<{ action: string; payload?: unknown; column?: string; value?: unknown }> = [];
    await getScheduleBlocksForRange(createClient(calls), userId, '2026-07-12T00:00:00.000Z', '2026-07-13T00:00:00.000Z');

    expect(calls).toEqual(expect.arrayContaining([
      { action: 'lt', column: 'start_at', value: '2026-07-13T00:00:00.000Z' },
      { action: 'gt', column: 'end_at', value: '2026-07-12T00:00:00.000Z' }
    ]));
  });

  it('delete helper targets the provided block id and user id', async () => {
    const calls: Array<{ action: string; payload?: unknown; column?: string; value?: unknown }> = [];
    await deleteDayScheduleBlock(createClient(calls), userId, '22222222-2222-2222-2222-222222222222');

    expect(calls).toEqual(expect.arrayContaining([
      { action: 'delete_eq', column: 'id', value: '22222222-2222-2222-2222-222222222222' },
      { action: 'delete_eq', column: 'user_id', value: userId }
    ]));
  });

  it('save helper returns a serializable row', async () => {
    const calls: Array<{ action: string; payload?: unknown; column?: string; value?: unknown }> = [];
    const saved = await saveDayScheduleBlock(createClient(calls), userId, baseBlock());

    expect(JSON.parse(JSON.stringify(saved))).toEqual(saved);
  });
});
