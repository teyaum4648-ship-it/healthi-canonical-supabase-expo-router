import { describe, expect, it, vi } from 'vitest';

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

const { chronotypePrior, readChronotype, saveChronotype } =
  await import('../../../src/features/sleepRhythm/chronotypeStore');

/**
 * What someone said about their clock, and what they made of the day we built from it.
 *
 * The verdict is the load-bearing part. Someone who looked at the schedule their answers
 * produced and said "that is not me" has told us something about those answers, and an
 * app that goes on seeding the rhythm engine from them anyway has stopped listening.
 */

const scope = () => `test-${Math.random().toString(36).slice(2)}`;

const record = (over: Partial<Parameters<typeof saveChronotype>[1]> = {}) => ({
  answers: { free_day_wake: 'very_late', evening_sleepiness: 'very_late' },
  chronotype: 'late_clock' as const,
  preferredMidSleepMinutes: 300,
  accepted: true as boolean | null,
  slotOverrides: {},
  ...over
});

describe('storing what someone said about their clock', () => {
  it('reads back the latest answers', async () => {
    const user = scope();
    await saveChronotype(user, record());
    const stored = await readChronotype(user);
    expect(stored?.chronotype).toBe('late_clock');
    expect(stored?.preferredMidSleepMinutes).toBe(300);
  });

  it('keeps the slots someone moved, verbatim', async () => {
    // "My best thinking is actually after lunch" is a correction to a suggestion, not a
    // different answer to a question about when they wake.
    const user = scope();
    await saveChronotype(user, record({ slotOverrides: { deep_work: 780 } }));
    expect((await readChronotype(user))?.slotOverrides.deep_work).toBe(780);
  });

  it('returns nothing before anyone has answered', async () => {
    expect(await readChronotype(scope())).toBeNull();
  });
});

describe('whether the answers may seed the rhythm engine', () => {
  it('hands over the clock when the day was accepted', () => {
    expect(chronotypePrior({ ...record(), accepted: true, savedAt: '2026-09-01T00:00:00.000Z' })).toBe(300);
  });

  it('hands it over while they have not yet said', () => {
    expect(chronotypePrior({ ...record(), accepted: null, savedAt: '2026-09-01T00:00:00.000Z' })).toBe(300);
  });

  it('withholds it once the day was declined', () => {
    // Declining is a real answer, not a postponement.
    expect(chronotypePrior({ ...record(), accepted: false, savedAt: '2026-09-01T00:00:00.000Z' })).toBeNull();
  });

  it('withholds it when nobody has answered at all', () => {
    expect(chronotypePrior(null)).toBeNull();
  });
});
