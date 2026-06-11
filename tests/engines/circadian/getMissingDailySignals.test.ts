import { describe, expect, it } from 'vitest';

import { getMissingDailySignals } from '../../../src/engines/circadian';
import type { SleepSession } from '../../../src/engines/circadian';

const completeSleepSession: SleepSession = {
  date: '2026-06-10',
  sleep_start_at: '2026-06-09T22:30:00.000Z',
  sleep_end_at: '2026-06-10T06:30:00.000Z',
  duration_minutes: 480,
  sleep_quality: 8,
  source: 'manual',
  source_confidence: 'medium',
  reason_codes: [],
  created_at: '2026-06-10T12:00:00.000Z'
};

describe('getMissingDailySignals', () => {
  it('skips sleep questions when sleep data has sufficient confidence', () => {
    const result = getMissingDailySignals({
      sleepSession: completeSleepSession
    });

    expect(result.signals_already_known).toEqual(
      expect.arrayContaining(['bedtime', 'wake_time', 'sleep_quality'])
    );
    expect(result.signals_to_ask).not.toContain('bedtime');
    expect(result.signals_to_ask).not.toContain('wake_time');
    expect(result.signals_to_ask).not.toContain('sleep_quality');
    expect(result.signals_to_ask).toEqual(
      expect.arrayContaining(['stress', 'soreness', 'digestion', 'hydration', 'fueling', 'time_available'])
    );
  });

  it('asks sleep questions when sleep data is missing', () => {
    const result = getMissingDailySignals({});

    expect(result.signals_to_ask).toEqual(
      expect.arrayContaining(['bedtime', 'wake_time', 'sleep_quality'])
    );
    expect(result.reason_codes).toContain('sleep_signals_needed');
  });

  it('asks sleep questions when sleep confidence is low', () => {
    const result = getMissingDailySignals({
      sleepSession: {
        ...completeSleepSession,
        source_confidence: 'low'
      }
    });

    expect(result.signals_to_ask).toEqual(
      expect.arrayContaining(['bedtime', 'wake_time', 'sleep_quality'])
    );
    expect(result.reason_codes).toContain('source_confidence_low');
  });
});

