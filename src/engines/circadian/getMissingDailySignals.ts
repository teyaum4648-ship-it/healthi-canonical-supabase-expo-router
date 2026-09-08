import type { CircadianBriefing, DailySignalNeed, MissingDailySignalsResult, SleepSession } from './types';

type GetMissingDailySignalsParams = {
  sleepSession?: SleepSession | null;
  circadianBriefing?: CircadianBriefing | null;
};

const subjectiveSignals: DailySignalNeed[] = [
  'stress',
  'soreness',
  'pain_or_limitation',
  'digestion',
  'hydration',
  'fueling',
  'time_available'
];

function pushUnique<T>(list: T[], value: T): void {
  if (!list.includes(value)) {
    list.push(value);
  }
}

export function getMissingDailySignals(params: GetMissingDailySignalsParams): MissingDailySignalsResult {
  const signalsToAsk: DailySignalNeed[] = [...subjectiveSignals];
  const signalsAlreadyKnown: DailySignalNeed[] = [];
  const reasonCodes: string[] = [];
  const sleepSession = params.sleepSession ?? null;
  const hasSufficientConfidence =
    sleepSession?.source_confidence === 'medium' || sleepSession?.source_confidence === 'high';
  const hasSleepTiming =
    Boolean(sleepSession?.duration_minutes && sleepSession.duration_minutes > 0) ||
    Boolean(sleepSession?.sleep_start_at && sleepSession.sleep_end_at) ||
    Boolean(params.circadianBriefing?.wake_time);

  if (sleepSession && hasSufficientConfidence && hasSleepTiming) {
    if (sleepSession.sleep_start_at || sleepSession.duration_minutes) {
      pushUnique(signalsAlreadyKnown, 'bedtime');
    }

    if (sleepSession.sleep_end_at || params.circadianBriefing?.wake_time) {
      pushUnique(signalsAlreadyKnown, 'wake_time');
    }

    if (typeof sleepSession.sleep_quality === 'number') {
      pushUnique(signalsAlreadyKnown, 'sleep_quality');
    } else {
      pushUnique(signalsToAsk, 'sleep_quality');
    }

    reasonCodes.push('sleep_signals_sufficient');
  } else {
    pushUnique(signalsToAsk, 'sleep_quality');
    pushUnique(signalsToAsk, 'bedtime');
    pushUnique(signalsToAsk, 'wake_time');
    reasonCodes.push('sleep_signals_needed');

    if (sleepSession?.source_confidence === 'low') {
      reasonCodes.push('source_confidence_low');
    }
  }

  return {
    signals_to_ask: signalsToAsk.filter((signal) => !signalsAlreadyKnown.includes(signal)),
    signals_already_known: signalsAlreadyKnown,
    reason_codes: reasonCodes
  };
}

