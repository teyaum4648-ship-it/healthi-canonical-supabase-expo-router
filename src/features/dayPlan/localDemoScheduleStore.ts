import AsyncStorage from '@react-native-async-storage/async-storage';

import type { DayScheduleBlockRow } from './scheduleBlockPersistence';

export const demoScheduleBlocksKey = 'healthi:demo:dayPlan:scheduleBlocks';

function cloneSerializable<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function parseJson(value: string | null): unknown {
  if (!value) return null;

  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isDemoScheduleBlock(value: unknown): value is DayScheduleBlockRow {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.user_id === 'string' &&
    typeof value.block_date === 'string' &&
    typeof value.start_at === 'string' &&
    typeof value.end_at === 'string' &&
    typeof value.block_type === 'string' &&
    typeof value.flexibility === 'string' &&
    typeof value.is_protected === 'boolean' &&
    typeof value.source === 'string' &&
    typeof value.source_confidence === 'string' &&
    typeof value.created_at === 'string' &&
    typeof value.updated_at === 'string' &&
    isStringArray(value.reason_codes)
  );
}

export function serializeDemoScheduleBlocks(blocks: DayScheduleBlockRow[]): string {
  return JSON.stringify(blocks.map((block) => cloneSerializable(block)));
}

export function deserializeDemoScheduleBlocks(value: string | null): DayScheduleBlockRow[] {
  const parsed = parseJson(value);
  if (!Array.isArray(parsed)) return [];

  return parsed.filter(isDemoScheduleBlock).map((block) => cloneSerializable(block));
}

function sortByStart(blocks: DayScheduleBlockRow[]): DayScheduleBlockRow[] {
  return [...blocks].sort((a, b) => a.start_at.localeCompare(b.start_at) || a.id.localeCompare(b.id));
}

export async function readDemoScheduleBlocks(): Promise<DayScheduleBlockRow[]> {
  const stored = await AsyncStorage.getItem(demoScheduleBlocksKey);
  return deserializeDemoScheduleBlocks(stored);
}

export async function writeDemoScheduleBlocks(blocks: DayScheduleBlockRow[]): Promise<void> {
  await AsyncStorage.setItem(demoScheduleBlocksKey, serializeDemoScheduleBlocks(sortByStart(blocks)));
}

export async function addDemoScheduleBlock(block: DayScheduleBlockRow): Promise<DayScheduleBlockRow[]> {
  const current = await readDemoScheduleBlocks();
  const next = sortByStart([cloneSerializable(block), ...current.filter((item) => item.id !== block.id)]);
  await writeDemoScheduleBlocks(next);
  return next;
}

export async function updateDemoScheduleBlock(block: DayScheduleBlockRow): Promise<DayScheduleBlockRow[]> {
  const current = await readDemoScheduleBlocks();
  const next = sortByStart(current.map((item) => (item.id === block.id ? cloneSerializable(block) : item)));
  await writeDemoScheduleBlocks(next);
  return next;
}

export async function deleteDemoScheduleBlock(blockId: string): Promise<DayScheduleBlockRow[]> {
  const current = await readDemoScheduleBlocks();
  const next = current.filter((item) => item.id !== blockId);
  await writeDemoScheduleBlocks(next);
  return next;
}

export async function getDemoScheduleBlocksForDate(date: string): Promise<DayScheduleBlockRow[]> {
  const current = await readDemoScheduleBlocks();
  return sortByStart(current.filter((block) => block.block_date === date.slice(0, 10)));
}

export async function getDemoScheduleBlocksForRange(startAt: string, endAt: string): Promise<DayScheduleBlockRow[]> {
  const start = new Date(startAt).getTime();
  const end = new Date(endAt).getTime();
  const current = await readDemoScheduleBlocks();

  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return [];

  return sortByStart(
    current.filter((block) => {
      const blockStart = new Date(block.start_at).getTime();
      const blockEnd = new Date(block.end_at).getTime();
      return !Number.isNaN(blockStart) && !Number.isNaN(blockEnd) && blockStart < end && blockEnd > start;
    })
  );
}

export async function clearDemoScheduleBlocks(): Promise<void> {
  await AsyncStorage.removeItem(demoScheduleBlocksKey);
}
