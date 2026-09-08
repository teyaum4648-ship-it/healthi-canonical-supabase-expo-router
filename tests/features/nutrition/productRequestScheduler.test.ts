import { describe, expect, it, vi } from 'vitest';

import { retryAfterMilliseconds } from '../../../src/features/nutrition/productLookup/openFoodFactsClient';
import { ProviderRequestScheduler } from '../../../src/features/nutrition/productLookup/productRequestScheduler';

describe('product provider request scheduler', () => {
  it('keeps a rapid twenty-barcode run within the provider start-rate limit', async () => {
    let now = 0;
    const sleep = vi.fn(async (milliseconds: number) => { now += milliseconds; });
    const scheduler = new ProviderRequestScheduler({ minimumIntervalMs: 4_100, now: () => now, sleep });
    const starts: number[] = [];
    const requests = Array.from({ length: 20 }, (_, index) => scheduler.schedule(async () => {
      starts.push(now);
      return index;
    }));

    await expect(Promise.all(requests)).resolves.toEqual(Array.from({ length: 20 }, (_, index) => index));
    expect(starts).toHaveLength(20);
    expect(starts[0]).toBe(0);
    expect(starts.at(-1)).toBe(77_900);
    expect(starts.slice(1).every((start, index) => start - starts[index]! >= 4_100)).toBe(true);
    expect(sleep).toHaveBeenCalledTimes(19);
  });

  it('honors a provider defer window without starting a retry loop', async () => {
    let now = 0;
    const scheduler = new ProviderRequestScheduler({
      minimumIntervalMs: 4_100,
      now: () => now,
      sleep: async (milliseconds) => { now += milliseconds; }
    });
    const starts: number[] = [];
    await scheduler.schedule(async () => { starts.push(now); });
    scheduler.defer(12_000);
    await scheduler.schedule(async () => { starts.push(now); });
    expect(starts).toEqual([0, 12_000]);
    expect(retryAfterMilliseconds('12', 0)).toBe(12_000);
    expect(retryAfterMilliseconds('Thu, 01 Jan 1970 00:00:20 GMT', 5_000)).toBe(15_000);
  });
});
