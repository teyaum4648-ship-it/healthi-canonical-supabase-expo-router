import { calculateSleepDuration } from './calculateSleepDuration';
import type { DataConfidence, SleepDebtNight, SleepDebtSummary, SleepNeedEstimate, SleepSession } from './types';

type CalculateSleepDebtParams = {
  date: string;
  sessions: SleepSession[];
  sleepNeed: SleepNeedEstimate;
  rollingWindowDays: 7 | 14;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function parseDay(date: string): Date | null {
  const parsed = new Date(`${date.slice(0, 10)}T00:00:00.000Z`);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

function daysBetween(laterDate: string, earlierDate: string): number | null {
  const later = parseDay(laterDate);
  const earlier = parseDay(earlierDate);

  if (!later || !earlier) {
    return null;
  }

  return Math.round((later.getTime() - earlier.getTime()) / DAY_MS);
}

function getSleepMinutes(session: SleepSession): number | null {
  if (typeof session.duration_minutes === 'number' && session.duration_minutes > 0) {
    return Math.round(session.duration_minutes);
  }

  return calculateSleepDuration(session.sleep_start_at, session.sleep_end_at);
}

function getWeight(index: number, total: number, rollingWindowDays: 7 | 14): number {
  if (total <= 1) {
    return 1;
  }

  const oldestWeight = rollingWindowDays === 14 ? 0.35 : 0.55;
  const step = (1 - oldestWeight) / (total - 1);

  return Number((1 - step * index).toFixed(2));
}

function getConfidence(usableNights: SleepDebtNight[], sleepNeed: SleepNeedEstimate): DataConfidence {
  if (usableNights.length < 3) {
    return 'low';
  }

  if (usableNights.length < 7) {
    return 'medium';
  }

  const hasLowSource = usableNights.some((night) => night.source_confidence === 'low');

  if (hasLowSource || sleepNeed.confidence === 'low') {
    return 'medium';
  }

  return 'high';
}

function getDebtReasonCode(averageDebt: number): string {
  if (averageDebt > 180) {
    return 'sleep_debt_high';
  }

  if (averageDebt >= 60) {
    return 'sleep_debt_moderate';
  }

  return 'sleep_debt_low';
}

export function calculateSleepDebt(params: CalculateSleepDebtParams): SleepDebtSummary {
  const windowSessions = params.sessions
    .filter((session) => {
      const distance = daysBetween(params.date, session.date);
      return distance !== null && distance >= 0 && distance < params.rollingWindowDays;
    })
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, params.rollingWindowDays);

  const usableSessions = windowSessions
    .map((session) => ({
      session,
      sleepMinutes: getSleepMinutes(session)
    }))
    .filter((item): item is { session: SleepSession; sleepMinutes: number } => item.sleepMinutes !== null);

  if (usableSessions.length === 0) {
    return {
      date: params.date,
      rolling_window_days: params.rollingWindowDays,
      total_sleep_debt_minutes: null,
      weighted_sleep_debt_minutes: null,
      nightly_average_debt_minutes: null,
      nights: [],
      confidence: 'low',
      reason_codes: ['sleep_data_missing', 'calibrating']
    };
  }

  const nights = usableSessions.map<SleepDebtNight>((item, index) => {
    const debtMinutes = Math.max(0, params.sleepNeed.minutes - item.sleepMinutes);
    const repaymentMinutes = Math.max(0, item.sleepMinutes - params.sleepNeed.minutes);

    return {
      date: item.session.date,
      sleep_minutes: item.sleepMinutes,
      sleep_need_minutes: params.sleepNeed.minutes,
      debt_minutes: debtMinutes,
      repayment_minutes: repaymentMinutes,
      weight: getWeight(index, usableSessions.length, params.rollingWindowDays),
      source_confidence: item.session.source_confidence
    };
  });

  const rawDebt = nights.reduce((total, night) => total + (night.debt_minutes ?? 0), 0);
  const rawRepayment = nights.reduce((total, night) => total + (night.repayment_minutes ?? 0), 0);
  const weightedDebt = nights.reduce(
    (total, night) => total + (night.debt_minutes ?? 0) * night.weight,
    0
  );
  const weightedRepayment = nights.reduce(
    (total, night) => total + (night.repayment_minutes ?? 0) * night.weight,
    0
  );
  const totalSleepDebt = Math.max(0, Math.round(rawDebt - rawRepayment * 0.5));
  const weightedSleepDebt = Math.max(0, Math.round(weightedDebt - weightedRepayment * 0.5));
  const nightlyAverageDebt = Math.round(totalSleepDebt / nights.length);
  const reasonCodes = [getDebtReasonCode(nightlyAverageDebt)];

  if (nights.some((night) => night.source_confidence === 'low')) {
    reasonCodes.push('source_confidence_low');
  }

  if (nights.length < 7 || params.sleepNeed.confidence === 'low') {
    reasonCodes.push('calibrating');
  }

  return {
    date: params.date,
    rolling_window_days: params.rollingWindowDays,
    total_sleep_debt_minutes: totalSleepDebt,
    weighted_sleep_debt_minutes: weightedSleepDebt,
    nightly_average_debt_minutes: nightlyAverageDebt,
    nights,
    confidence: getConfidence(nights, params.sleepNeed),
    reason_codes: reasonCodes
  };
}

