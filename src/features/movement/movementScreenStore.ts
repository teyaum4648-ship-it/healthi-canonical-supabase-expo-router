import { createScopedLogStore, isRecord } from '../practice/scopedLogStore';
import {
  MOBILITY_TESTS,
  type MobilityFinding,
  type MovementScreen,
  type PostureFlag,
  POSTURE_PROMPTS
} from '../../engines/movement';

/**
 * The most recent mobility screen, on the device.
 *
 * Kept as a short history rather than a single record because the point of a screen is to
 * be repeated: what a hip did in March against what it does in June is the only way to
 * know whether any of the suggested work did anything. The latest one drives the score;
 * the rest are there for that comparison.
 *
 * Local for now, like the rest of the practice surfaces. movement_screen_results and
 * posture_assessments exist in the schema and this is the seam a Supabase implementation
 * drops into.
 */

export type StoredMovementScreen = {
  date: string;
  findings: Partial<Record<string, MobilityFinding>>;
  postureFlags: PostureFlag[];
  savedAt: string;
};

const FINDINGS: MobilityFinding[] = ['clear', 'limited', 'restricted', 'not_tested'];
const TEST_IDS = new Set(MOBILITY_TESTS.map((test) => test.id));
const POSTURE_IDS = new Set(Object.keys(POSTURE_PROMPTS));

function isStoredScreen(value: unknown): value is StoredMovementScreen {
  if (!isRecord(value)) return false;
  if (typeof value.date !== 'string' || typeof value.savedAt !== 'string') return false;
  if (!Array.isArray(value.postureFlags)) return false;
  if (!isRecord(value.findings)) return false;

  // A row written by an older build is dropped rather than trusted into a screen.
  const findingsValid = Object.entries(value.findings).every(([id, finding]) =>
    TEST_IDS.has(id) && typeof finding === 'string' && FINDINGS.includes(finding as MobilityFinding));
  const flagsValid = value.postureFlags.every((flag) => typeof flag === 'string' && POSTURE_IDS.has(flag));
  return findingsValid && flagsValid;
}

const store = createScopedLogStore<StoredMovementScreen>({
  key: 'healthi.movement.screen.v1',
  isRow: isStoredScreen,
  cap: 24
});

export const localMovementScreenStore = store;

/** Newest first, so the head is what the score should read. */
export async function readMovementScreens(scope: string): Promise<StoredMovementScreen[]> {
  const rows = await store.read(scope);
  return [...rows].sort((left, right) => right.savedAt.localeCompare(left.savedAt));
}

export async function saveMovementScreen(
  scope: string,
  screen: Omit<StoredMovementScreen, 'savedAt'>
): Promise<StoredMovementScreen[]> {
  await store.append(scope, { ...screen, savedAt: new Date().toISOString() });
  return readMovementScreens(scope);
}

/** The stored screen in the shape the engines read, or null when there is none. */
export function toMovementScreen(
  stored: StoredMovementScreen | undefined,
  blockedPatterns: string[] = []
): MovementScreen | null {
  if (!stored) return null;
  return {
    date: stored.date,
    findings: { ...stored.findings },
    postureFlags: [...stored.postureFlags],
    blockedPatterns
  };
}
