import { shiftDay } from '../navigation/navigationModel';

export type WaterUnit = 'mL' | 'fl oz';
export type WaterEntry = { id: string; user_id: string; amount_ml: number; logged_at: string; source: 'manual' };
type Result<T> = { data: T | null; error: { message?: string } | null };
type WaterQuery = PromiseLike<Result<WaterEntry[]>> & {
  eq(column: string, value: string): WaterQuery;
  gte(column: string, value: string): WaterQuery;
  lt(column: string, value: string): WaterQuery;
  order(column: string, options: { ascending: boolean }): WaterQuery;
  select(columns: string): WaterQuery;
};
export type HydrationClient = { from(table: 'hydration_logs'): {
  select(columns: string): WaterQuery;
  upsert(entry: WaterEntry, options: { onConflict: string }): { select(columns: string): { single(): Promise<Result<WaterEntry>> } };
  delete(): WaterQuery;
} };
type Storage = { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void> };
export const demoWaterKey = 'healthi:demo:hydration:entries';
const mlPerUsOunce = 29.5735295625;

export function waterAmountMl(text: string, unit: WaterUnit): number | null {
  if (!/^\d+(?:\.\d+)?$/.test(text.trim())) return null;
  const value = Number(text) * (unit === 'fl oz' ? mlPerUsOunce : 1);
  // A per-entry input guard, not a daily target or intake recommendation.
  return Number.isFinite(value) && value >= 1 && value <= 5000 ? Math.round(value) : null;
}
export function formatWater(amount: number, unit: WaterUnit) {
  return unit === 'mL' ? `${Math.round(amount).toLocaleString()} mL` : `${Math.round(amount / mlPerUsOunce * 10) / 10} fl oz`;
}
export function waterForDay(entries: WaterEntry[], userId: string, day: string) {
  return entries.filter(e => e.user_id === userId && e.logged_at.slice(0, 10) === day);
}
function validEntry(value: unknown): value is WaterEntry {
  if (!value || typeof value !== 'object') return false;
  const e = value as WaterEntry;
  return typeof e.id === 'string' && typeof e.user_id === 'string' && Number.isInteger(e.amount_ml) && e.amount_ml > 0 && e.amount_ml <= 5000 && typeof e.logged_at === 'string' && Number.isFinite(Date.parse(e.logged_at)) && e.source === 'manual';
}
export function createWaterEntry(amountMl: number, userId: string, day: string, now = new Date().toISOString()): WaterEntry {
  if (!userId || !Number.isInteger(amountMl) || amountMl < 1 || amountMl > 5000 || !/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(Date.parse(`${day}T00:00:00Z`)) || !Number.isFinite(Date.parse(now))) throw new Error('Invalid water entry.');
  const id = globalThis.crypto?.randomUUID?.() ?? 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.floor(Math.random() * 16); return (c === 'x' ? r : (r & 3) | 8).toString(16); });
  return { id, user_id: userId, amount_ml: amountMl, logged_at: `${day}${now.slice(10)}`, source: 'manual' };
}
function requireOwner(userId: string) { if (!userId || userId === 'demo-user') throw new Error('A signed-in account is required.'); }
export async function readWater(client: HydrationClient, userId: string, day: string) {
  requireOwner(userId);
  const { data, error } = await client.from('hydration_logs').select('*').eq('user_id', userId)
    .gte('logged_at', `${day}T00:00:00.000Z`).lt('logged_at', `${shiftDay(day, 1)}T00:00:00.000Z`).order('logged_at', { ascending: true });
  if (error) throw new Error('Water entries could not load.');
  return waterForDay((data ?? []).filter(validEntry), userId, day);
}
export async function saveWater(client: HydrationClient, userId: string, entry: WaterEntry) {
  requireOwner(userId);
  if (!validEntry(entry) || entry.user_id !== userId) throw new Error('Invalid water entry owner.');
  // A stable entry ID makes a retry safe if the original response was lost.
  const { data, error } = await client.from('hydration_logs').upsert(entry, { onConflict: 'id' }).select('*').single();
  if (error || !validEntry(data) || data.user_id !== userId || data.id !== entry.id) throw new Error('Water could not be saved.');
  return data;
}
export async function undoWater(client: HydrationClient, userId: string, id: string) {
  requireOwner(userId);
  const { error } = await client.from('hydration_logs').delete().eq('user_id', userId).eq('id', id).select('id');
  if (error) throw new Error('Water could not be removed.');
}

/** Device-only demo state. Account data never falls back into this store. */
export function createDemoWaterStore(storage: Storage) {
  let queue: Promise<unknown> = Promise.resolve();
  async function read(): Promise<WaterEntry[]> {
    const raw = await storage.getItem(demoWaterKey);
    if (raw === null) return [];
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data) || !data.every(validEntry) || data.some(e => e.user_id !== 'demo-user')) throw new Error('Saved demo water could not be read.');
    return data;
  }
  function update(edit: (rows: WaterEntry[]) => WaterEntry[]) {
    const operation = queue.then(async () => { const next = edit(await read()); await storage.setItem(demoWaterKey, JSON.stringify(next)); return next; });
    queue = operation.catch(() => undefined);
    return operation;
  }
  return {
    read,
    save: (entry: WaterEntry) => {
      if (!validEntry(entry) || entry.user_id !== 'demo-user') return Promise.reject(new Error('Only demo entries belong in demo storage.'));
      return update(rows => [...rows.filter(e => e.id !== entry.id), entry]);
    },
    undo: (id: string) => update(rows => rows.filter(e => e.id !== id))
  };
}
