import { describe, expect, it, vi } from 'vitest';

/*
 * An in-memory AsyncStorage. The real one is a no-op under vitest, which is why no store
 * in this codebase had a test before — and why the validators, the part that decides
 * whether a row written by an older build is trusted into a screen, were the least
 * covered code in the feature.
 */
vi.mock('@react-native-async-storage/async-storage', () => {
  const memory = new Map<string, string>();
  return {
    default: {
      getItem: async (key: string) => memory.get(key) ?? null,
      setItem: async (key: string, value: string) => { memory.set(key, value); },
      removeItem: async (key: string) => { memory.delete(key); },
      clear: async () => { memory.clear(); }
    }
  };
});

import {
  readMovementScreens,
  saveMovementScreen,
  toMovementScreen
} from '../../../src/features/movement/movementScreenStore';
import { findMovementLinks, mobilityTerm } from '../../../src/engines/movement';

/**
 * Keeping a screen, and handing it back in the shape the engines read.
 *
 * A screen is only worth taking if it can be compared to the last one, so this keeps a
 * short history rather than one record: what a hip did in March against what it does in
 * June is the only way to know whether any of the suggested work did anything.
 */

const scope = () => `test-${Math.random().toString(36).slice(2)}`;

describe('storing a movement screen', () => {
  it('reads back what was saved', async () => {
    const user = scope();
    await saveMovementScreen(user, {
      date: '2026-09-01',
      findings: { half_kneeling_hip: 'limited', single_leg_stand: 'limited' },
      postureFlags: ['knees_fall_inward']
    });

    const rows = await readMovementScreens(user);
    expect(rows).toHaveLength(1);
    expect(rows[0].findings.half_kneeling_hip).toBe('limited');
    expect(rows[0].postureFlags).toEqual(['knees_fall_inward']);
    expect(rows[0].savedAt).toBeTruthy();
  });

  it('puts the newest screen first, because that is the one the score reads', async () => {
    const user = scope();
    await saveMovementScreen(user, { date: '2026-03-01', findings: { ankle_to_wall: 'restricted' }, postureFlags: [] });
    await new Promise((resolve) => setTimeout(resolve, 2));
    await saveMovementScreen(user, { date: '2026-06-01', findings: { ankle_to_wall: 'clear' }, postureFlags: [] });

    const rows = await readMovementScreens(user);
    expect(rows).toHaveLength(2);
    expect(rows[0].date).toBe('2026-06-01');
    // And the older one survives, so the two can be compared.
    expect(rows[1].date).toBe('2026-03-01');
  });

  it('keeps one account of screens separate from another', async () => {
    const alice = scope();
    const bob = scope();
    await saveMovementScreen(alice, { date: '2026-09-01', findings: { ankle_to_wall: 'clear' }, postureFlags: [] });
    expect(await readMovementScreens(bob)).toEqual([]);
  });
});

describe('handing a screen to the engines', () => {
  it('maps a stored screen into the shape the reasoning reads', async () => {
    const user = scope();
    const rows = await saveMovementScreen(user, {
      date: '2026-09-01',
      findings: { half_kneeling_hip: 'limited', seated_straddle: 'limited', single_leg_stand: 'limited' },
      postureFlags: []
    });

    const screen = toMovementScreen(rows[0])!;
    expect(screen.date).toBe('2026-09-01');
    // The round trip has to survive into the reasoning, or the storage is decorative.
    expect(findMovementLinks(screen).map((link) => link.id)).toContain('lateral_hip_under_contributing');
    expect(mobilityTerm(screen).value).toBeCloseTo(0.5, 6);
  });

  it('carries blocked patterns through, so saved screens cannot route around a safety rule', async () => {
    const user = scope();
    const rows = await saveMovementScreen(user, {
      date: '2026-09-01',
      findings: { half_kneeling_hip: 'limited', seated_straddle: 'limited', single_leg_stand: 'limited' },
      postureFlags: []
    });

    const screen = toMovementScreen(rows[0], ['single_leg'])!;
    const link = findMovementLinks(screen).find((candidate) => candidate.id === 'lateral_hip_under_contributing')!;
    expect(link.strengthen).toEqual([]);
    expect(link.reason_codes).toContain('programming_withheld_pattern_blocked');
  });

  it('gives nothing when nothing has been screened', () => {
    expect(toMovementScreen(undefined)).toBeNull();
  });
});
