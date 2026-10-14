import { describe, expect, it } from 'vitest';

import {
  healthConnectSleepToSamples,
  healthConnectStepsToSamples,
  healthKitSleepToSamples,
  healthKitStepsToSamples
} from '../../../src/features/health/healthAdapters';
import { sleepSessionsFromSamples } from '../../../src/features/health/healthImport';

describe('Apple Health samples', () => {
  it('reads in-bed, awake and every kind of asleep', () => {
    const samples = healthKitSleepToSamples([
      { startDate: new Date('2026-07-14T03:00:00Z'), endDate: new Date('2026-07-14T03:30:00Z'), value: 0 },
      { startDate: new Date('2026-07-14T03:30:00Z'), endDate: new Date('2026-07-14T06:00:00Z'), value: 3 },
      { startDate: new Date('2026-07-14T06:00:00Z'), endDate: new Date('2026-07-14T06:10:00Z'), value: 2 },
      { startDate: new Date('2026-07-14T06:10:00Z'), endDate: new Date('2026-07-14T10:30:00Z'), value: 5 }
    ]);
    expect(samples.map((sample) => sample.stage)).toEqual(['in_bed', 'asleep', 'awake', 'asleep']);
  });

  it('drops samples with unreadable times and keeps step counts', () => {
    expect(healthKitSleepToSamples([{ startDate: 'nope', endDate: '2026-07-14T06:00:00Z', value: 1 }])).toEqual([]);
    expect(healthKitStepsToSamples([{ startDate: '2026-07-14T09:00:00Z', endDate: '2026-07-14T09:10:00Z', quantity: 812 }]))
      .toEqual([{ start: '2026-07-14T09:00:00.000Z', end: '2026-07-14T09:10:00.000Z', count: 812 }]);
  });

  it('becomes a night the Sleep tab can store', () => {
    const samples = healthKitSleepToSamples([
      { startDate: '2026-07-14T03:30:00Z', endDate: '2026-07-14T06:00:00Z', value: 4 },
      { startDate: '2026-07-14T06:10:00Z', endDate: '2026-07-14T10:30:00Z', value: 5 }
    ]);
    const [night] = sleepSessionsFromSamples(samples, 'healthkit', 'America/New_York', '2026-07-14T12:00:00Z');
    expect(night?.date).toBe('2026-07-14');
    expect(night?.duration_minutes).toBe(410);
    expect(night?.source).toBe('healthkit');
  });
});

describe('Health Connect records', () => {
  it('reads stages, with awake and out of bed as awake', () => {
    const samples = healthConnectSleepToSamples([{
      startTime: '2026-07-14T03:00:00Z',
      endTime: '2026-07-14T10:00:00Z',
      stages: [
        { startTime: '2026-07-14T03:00:00Z', endTime: '2026-07-14T05:00:00Z', stage: 4 },
        { startTime: '2026-07-14T05:00:00Z', endTime: '2026-07-14T05:15:00Z', stage: 1 },
        { startTime: '2026-07-14T05:15:00Z', endTime: '2026-07-14T09:45:00Z', stage: 6 },
        { startTime: '2026-07-14T09:45:00Z', endTime: '2026-07-14T10:00:00Z', stage: 3 }
      ]
    }]);
    expect(samples.map((sample) => sample.stage)).toEqual(['asleep', 'awake', 'asleep', 'awake']);
  });

  it('treats a session without stages as asleep throughout', () => {
    expect(healthConnectSleepToSamples([{ startTime: '2026-07-14T03:00:00Z', endTime: '2026-07-14T10:00:00Z' }]))
      .toEqual([{ start: '2026-07-14T03:00:00.000Z', end: '2026-07-14T10:00:00.000Z', stage: 'asleep' }]);
  });

  it('keeps step records', () => {
    expect(healthConnectStepsToSamples([{ startTime: '2026-07-14T09:00:00Z', endTime: '2026-07-14T10:00:00Z', count: 1500 }])[0]?.count).toBe(1500);
  });
});
