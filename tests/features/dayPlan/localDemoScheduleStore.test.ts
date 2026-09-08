import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DayScheduleBlockRow } from '../../../src/features/dayPlan/scheduleBlockPersistence';
import {
  addDemoScheduleBlock,
  clearDemoScheduleBlocks,
  deleteDemoScheduleBlock,
  deserializeDemoScheduleBlocks,
  getDemoScheduleBlocksForDate,
  getDemoScheduleBlocksForRange,
  readDemoScheduleBlocks,
  serializeDemoScheduleBlocks,
  updateDemoScheduleBlock
} from '../../../src/features/dayPlan/localDemoScheduleStore';

const storage = vi.hoisted(() => new Map<string, string>());

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn((key: string) => Promise.resolve(storage.get(key) ?? null)),
    setItem: vi.fn((key: string, value: string) => {
      storage.set(key, value);
      return Promise.resolve();
    }),
    removeItem: vi.fn((key: string) => {
      storage.delete(key);
      return Promise.resolve();
    })
  }
}));

function block(overrides: Partial<DayScheduleBlockRow> = {}): DayScheduleBlockRow {
  return {
    id: 'local-schedule-1',
    user_id: 'demo-user',
    block_date: '2026-07-12',
    start_at: '2026-07-12T09:00:00.000Z',
    end_at: '2026-07-12T17:00:00.000Z',
    block_type: 'work',
    title: 'Work block',
    description: null,
    location: null,
    flexibility: 'fixed',
    is_protected: true,
    source: 'demo',
    source_confidence: 'medium',
    reason_codes: ['manual_schedule_block', 'demo_schedule_data'],
    created_at: '2026-07-12T08:55:00.000Z',
    updated_at: '2026-07-12T08:55:00.000Z',
    ...overrides
  };
}

describe('local demo schedule store', () => {
  beforeEach(() => {
    storage.clear();
  });

  it('serializes and deserializes schedule blocks safely', () => {
    const source = block();
    const roundTrip = deserializeDemoScheduleBlocks(serializeDemoScheduleBlocks([source]));

    expect(roundTrip).toEqual([source]);
    expect(roundTrip[0]?.reason_codes).toEqual(['manual_schedule_block', 'demo_schedule_data']);
  });

  it('returns empty arrays for missing or invalid data', () => {
    expect(deserializeDemoScheduleBlocks(null)).toEqual([]);
    expect(deserializeDemoScheduleBlocks('not-json')).toEqual([]);
    expect(deserializeDemoScheduleBlocks(JSON.stringify([{ id: 'missing-fields' }]))).toEqual([]);
  });

  it('adds, updates, and deletes local demo blocks', async () => {
    await addDemoScheduleBlock(block());
    expect(await readDemoScheduleBlocks()).toHaveLength(1);

    await updateDemoScheduleBlock(block({ title: 'Updated work block' }));
    expect((await readDemoScheduleBlocks())[0]?.title).toBe('Updated work block');

    await deleteDemoScheduleBlock('local-schedule-1');
    expect(await readDemoScheduleBlocks()).toEqual([]);
  });

  it('filters local demo blocks by date', async () => {
    await addDemoScheduleBlock(block());
    await addDemoScheduleBlock(block({ id: 'local-schedule-2', block_date: '2026-07-13', start_at: '2026-07-13T10:00:00.000Z', end_at: '2026-07-13T11:00:00.000Z' }));

    expect(await getDemoScheduleBlocksForDate('2026-07-12')).toEqual([block()]);
  });

  it('filters local demo blocks by overlapping range', async () => {
    const overnight = block({
      id: 'local-sleep',
      block_type: 'sleep',
      title: 'Sleep',
      block_date: '2026-07-12',
      start_at: '2026-07-12T22:30:00.000Z',
      end_at: '2026-07-13T06:30:00.000Z'
    });
    await addDemoScheduleBlock(overnight);

    expect(await getDemoScheduleBlocksForRange('2026-07-13T00:00:00.000Z', '2026-07-13T08:00:00.000Z')).toEqual([overnight]);
    expect(await getDemoScheduleBlocksForRange('bad-date', '2026-07-13T08:00:00.000Z')).toEqual([]);
  });

  it('clears local demo blocks', async () => {
    await addDemoScheduleBlock(block());
    await clearDemoScheduleBlocks();

    expect(await readDemoScheduleBlocks()).toEqual([]);
  });

  it('does not introduce blocked language in demo payloads', () => {
    const output = serializeDemoScheduleBlocks([block()]).toLowerCase();
    const blockedTerms = [
      'diag' + 'nosis',
      'diag' + 'nose',
      'treat' + 'ment',
      'c' + 'ure',
      'pre' + 'scribe',
      'pre' + 'scription',
      'ad' + 'renal',
      'h' + 'pa',
      'cor' + 'tisol',
      'hor' + 'mone',
      'clin' + 'ical',
      'medical ' + 'decision',
      'dys' + 'regulated',
      'dys' + 'function',
      'de' + 'tox',
      'tox' + 'in',
      'tox' + 'ic',
      'clean' + 'se',
      'cheat ' + 'meal',
      'guilt-' + 'free',
      'bad ' + 'food',
      'metabolic ' + 'type',
      'metabolic ' + 'typing',
      'che' + 'k',
      'h' + 'lc',
      '4 doc' + 'tors',
      'primal ' + 'pattern',
      'work-' + 'in'
    ];

    for (const term of blockedTerms) {
      expect(output).not.toContain(term);
    }
  });
});
