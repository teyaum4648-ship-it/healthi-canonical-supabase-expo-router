import { describe, expect, it, vi } from 'vitest';

import type { SleepSession } from '../../../src/engines/circadian';
import {
  dailyStepsFromSamples,
  importableSleep,
  sleepSessionsFromSamples,
  unavailableHealthSource,
  wallClock,
  type HealthSource
} from '../../../src/features/health/healthImport';

const store = new Map<string, string>();
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: { getItem: async (key: string) => store.get(key) ?? null, setItem: async (key: string, value: string) => { store.set(key, value); } }
}));

const { syncHealth, localStepsStore } = await import('../../../src/features/health/healthSync');

const NY = 'America/New_York';

describe('wallClock', () => {
  it('writes an instant as the local clock on the UTC axis, the way the Sleep tab stores times', () => {
    expect(wallClock('2026-09-24T03:05:00.000Z', NY)).toEqual({ date: '2026-09-23', iso: '2026-09-23T23:05:00.000Z' });
  });
});

describe('sleepSessionsFromSamples', () => {
  const night = [
    { start: '2026-09-24T03:00:00.000Z', end: '2026-09-24T03:20:00.000Z', stage: 'in_bed' as const },
    { start: '2026-09-24T03:20:00.000Z', end: '2026-09-24T06:00:00.000Z', stage: 'asleep' as const },
    { start: '2026-09-24T06:00:00.000Z', end: '2026-09-24T06:15:00.000Z', stage: 'awake' as const },
    { start: '2026-09-24T06:15:00.000Z', end: '2026-09-24T10:30:00.000Z', stage: 'asleep' as const }
  ];

  it('makes one night, dated by the morning it ended, counting only time asleep', () => {
    const [session, ...rest] = sleepSessionsFromSamples(night, 'healthkit', NY, '2026-09-24T12:00:00.000Z');
    expect(rest).toHaveLength(0);
    expect(session).toMatchObject({
      date: '2026-09-24',
      sleep_start_at: '2026-09-23T23:20:00.000Z',
      sleep_end_at: '2026-09-24T06:30:00.000Z',
      duration_minutes: 415,
      source: 'healthkit',
      source_confidence: 'high'
    });
    expect(session?.sleep_intervals?.map((interval) => interval.state)).toEqual(['asleep', 'awake', 'asleep']);
  });

  it('splits nights separated by a long gap and drops naps too short to be a night', () => {
    const sessions = sleepSessionsFromSamples([
      ...night,
      { start: '2026-09-24T19:00:00.000Z', end: '2026-09-24T19:40:00.000Z', stage: 'asleep' },
      { start: '2026-09-25T03:00:00.000Z', end: '2026-09-25T10:00:00.000Z', stage: 'asleep' }
    ], 'health_connect', NY, '2026-09-25T12:00:00.000Z');
    expect(sessions.map((session) => [session.date, session.duration_minutes])).toEqual([['2026-09-24', 415], ['2026-09-25', 420]]);
  });
});

describe('importableSleep', () => {
  const base = { sleep_start_at: null, sleep_end_at: null, duration_minutes: 420, source_confidence: 'high' as const, reason_codes: [], created_at: '' };
  const imported: SleepSession[] = [{ ...base, date: '2026-09-23', source: 'healthkit' }, { ...base, date: '2026-09-24', source: 'healthkit' }, { ...base, date: '2026-09-25', source: 'healthkit' }];

  it('never replaces a night the person logged, confirmed or corrected', () => {
    const existing: SleepSession[] = [
      { ...base, date: '2026-09-23', source: 'manual' },
      { ...base, date: '2026-09-24', source: 'estimated', confirmed_by_user: true },
      { ...base, date: '2026-09-25', source: 'healthkit' }
    ];
    expect(importableSleep(existing, imported).map((night) => night.date)).toEqual(['2026-09-25']);
  });
});

describe('dailyStepsFromSamples', () => {
  it('sums steps by the local day each sample started, ignoring bad counts', () => {
    expect(dailyStepsFromSamples([
      { start: '2026-09-24T02:00:00.000Z', end: '2026-09-24T02:30:00.000Z', count: 1200 },
      { start: '2026-09-24T15:00:00.000Z', end: '2026-09-24T15:30:00.000Z', count: 3000.4 },
      { start: '2026-09-24T16:00:00.000Z', end: '2026-09-24T16:30:00.000Z', count: -5 }
    ], NY)).toEqual([{ date: '2026-09-23', steps: 1200 }, { date: '2026-09-24', steps: 3000 }]);
  });
});

describe('syncHealth', () => {
  it('does nothing where no health app can be reached', async () => {
    expect(await syncHealth(unavailableHealthSource, { scope: 'demo', timeZone: NY, now: new Date(), readSleep: async () => [], saveSleep: async () => undefined })).toBeNull();
  });

  it('saves new nights, keeps logged ones, and stores steps by day', async () => {
    const source: HealthSource = {
      platform: 'healthkit',
      isAvailable: async () => true,
      requestPermission: async () => true,
      readSleep: async () => [{ start: '2026-09-24T03:00:00.000Z', end: '2026-09-24T10:00:00.000Z', stage: 'asleep' }, { start: '2026-09-23T03:00:00.000Z', end: '2026-09-23T10:00:00.000Z', stage: 'asleep' }],
      readSteps: async () => [{ start: '2026-09-24T15:00:00.000Z', end: '2026-09-24T15:30:00.000Z', count: 4200 }]
    };
    const saved: SleepSession[] = [];
    const result = await syncHealth(source, {
      scope: 'demo', timeZone: NY, now: new Date('2026-09-24T18:00:00.000Z'),
      readSleep: async () => [{ date: '2026-09-23', sleep_start_at: null, sleep_end_at: null, duration_minutes: 400, source: 'manual', source_confidence: 'high', reason_codes: [], created_at: '' }],
      saveSleep: async (session) => { saved.push(session); }
    });
    expect(result).toEqual({ nightsSaved: 1, nightsKept: 1, stepDays: 1 });
    expect(saved.map((night) => night.date)).toEqual(['2026-09-24']);
    expect((await localStepsStore.read('demo')).map((row) => [row.date, row.steps])).toEqual([['2026-09-24', 4200]]);
  });

  it('says plainly when access was not given', async () => {
    const source: HealthSource = { ...unavailableHealthSource, platform: 'healthkit', isAvailable: async () => true, requestPermission: async () => false };
    await expect(syncHealth(source, { scope: 'demo', timeZone: NY, now: new Date(), readSleep: async () => [], saveSleep: async () => undefined })).rejects.toThrow(/access/);
  });
});
