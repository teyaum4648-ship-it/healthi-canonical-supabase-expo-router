import { createDemoWaterStore, createWaterEntry, saveWater, undoWater, type HydrationClient, type WaterEntry } from './hydrationStore';

type Storage = Parameters<typeof createDemoWaterStore>[0];

export const GLASS_ML = 250;

/**
 * One tap from Home's quick log: a glass of water, saved where the Diet tab keeps water.
 *
 * Opening the diary to type 250 is the reason water went unlogged, and the readiness
 * estimate reads water. A glass is a fixed, labelled amount rather than a guess, and the
 * confirmation that follows offers Undo for the tap that was meant for something else.
 */
export async function addGlassOfWater(params: { demo: boolean; userId: string | null; client: HydrationClient | null; day: string; storage: Storage }): Promise<WaterEntry> {
  if (params.demo) {
    const entry = createWaterEntry(GLASS_ML, 'demo-user', params.day);
    await createDemoWaterStore(params.storage).save(entry);
    return entry;
  }
  if (!params.userId || !params.client) throw new Error('Sign in to log water.');
  return saveWater(params.client, params.userId, createWaterEntry(GLASS_ML, params.userId, params.day));
}

export async function removeWater(params: { demo: boolean; userId: string | null; client: HydrationClient | null; storage: Storage }, id: string): Promise<void> {
  if (params.demo) {
    await createDemoWaterStore(params.storage).undo(id);
    return;
  }
  if (!params.userId || !params.client) throw new Error('Sign in to change water.');
  await undoWater(params.client, params.userId, id);
}
