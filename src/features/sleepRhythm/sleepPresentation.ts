import type {
  CircadianBriefing,
  CircadianPhase,
  DataConfidence,
  SleepSession,
  TimeWindow
} from '../../engines/circadian';

export type SleepPhasePresentation = {
  label: string;
  energy: 'Low' | 'Steady' | 'High';
  support: string;
  next_shift: string;
};

export type RhythmConsistencyScore = {
  score: number | null;
  confidence: DataConfidence;
  verdict: string;
  change_from_previous: number | null;
  explanation: string;
  reason_codes: string[];
  limiting_factors: string[];
};

export type SleepProtocolItem = {
  id: 'light' | 'focus' | 'movement' | 'reset' | 'caffeine' | 'wind_down';
  name: string;
  reason: string;
  start_at: string | null;
  end_at: string | null;
  point_in_time: boolean;
};

export type WindDownStep = {
  id: string;
  name: string;
  detail: string;
  duration_minutes: number;
  icon: 'bulb-outline' | 'phone-portrait-outline' | 'water-outline' | 'body-outline' | 'book-outline' | 'moon-outline' | 'cafe-outline' | 'create-outline' | 'leaf-outline';
  enabled: boolean;
  anchor?: boolean;
  removable?: boolean;
};

export type ScheduledWindDownStep = WindDownStep & {
  start_minutes: number;
};

export type SleepNightSummary = {
  date: string;
  bedtime_minutes: number | null;
  wake_minutes: number | null;
  duration_minutes: number | null;
  source_confidence: DataConfidence;
};

const PHASE_COPY: Record<CircadianPhase, Omit<SleepPhasePresentation, 'next_shift'>> = {
  wake_grogginess: {
    label: 'Waking',
    energy: 'Low',
    support: 'Your body is still surfacing. Ease in before demanding focus.'
  },
  rising: {
    label: 'Morning rise',
    energy: 'Steady',
    support: 'Focus energy is climbing toward your first useful peak of the day.'
  },
  morning_peak: {
    label: 'First peak',
    energy: 'High',
    support: 'A useful focus window is open for work that needs your full attention.'
  },
  afternoon_dip: {
    label: 'Midday dip',
    energy: 'Low',
    support: 'A natural lull. Lighter tasks and a brief reset may carry you through.'
  },
  second_peak: {
    label: 'Second peak',
    energy: 'High',
    support: 'A second, gentler rise can support focused work or movement.'
  },
  wind_down: {
    label: 'Wind-down',
    energy: 'Low',
    support: 'Lower the light and pace so your system can settle toward sleep.'
  },
  sleep_window: {
    label: 'Sleep',
    energy: 'Low',
    support: 'You are in your estimated sleep window. Rest is the useful priority.'
  },
  unknown: {
    label: 'Calibrating',
    energy: 'Steady',
    support: 'Add a confirmed sleep window to make today’s rhythm more personal.'
  }
};

export const DEFAULT_WIND_DOWN_STEPS: WindDownStep[] = [
  {
    id: 'dim',
    name: 'Dim the lights',
    detail: 'Overheads off, warm lamps only',
    duration_minutes: 5,
    icon: 'bulb-outline',
    enabled: true
  },
  {
    id: 'screens',
    name: 'Screens down',
    detail: 'Phone on the charger, out of reach',
    duration_minutes: 10,
    icon: 'phone-portrait-outline',
    enabled: true
  },
  {
    id: 'shower',
    name: 'Warm shower',
    detail: 'A familiar cue to begin settling',
    duration_minutes: 15,
    icon: 'water-outline',
    enabled: true
  },
  {
    id: 'stretch',
    name: 'Light stretch',
    detail: 'Comfortable movement only; never through pain',
    duration_minutes: 8,
    icon: 'body-outline',
    enabled: false
  },
  {
    id: 'read',
    name: 'Read',
    detail: 'Paper, not a screen — a few pages',
    duration_minutes: 15,
    icon: 'book-outline',
    enabled: true
  },
  {
    id: 'lights_out',
    name: 'Lights out',
    detail: 'Your target sleep time',
    duration_minutes: 0,
    icon: 'moon-outline',
    enabled: true,
    anchor: true
  }
];

export const WIND_DOWN_LIBRARY: WindDownStep[] = [
  {
    id: 'tea',
    name: 'Herbal tea',
    detail: 'Caffeine-free and warm',
    duration_minutes: 8,
    icon: 'cafe-outline',
    enabled: true,
    removable: true
  },
  {
    id: 'journal',
    name: 'Journal',
    detail: 'Park tomorrow on paper',
    duration_minutes: 7,
    icon: 'create-outline',
    enabled: true,
    removable: true
  },
  {
    id: 'breathing',
    name: 'Slow breathing',
    detail: 'A few comfortable, unforced rounds',
    duration_minutes: 5,
    icon: 'leaf-outline',
    enabled: true,
    removable: true
  }
];

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function minuteOfDay(value: string | null | undefined): number | null {
  const parsed = parseDate(value);
  if (!parsed) return null;
  return parsed.getUTCHours() * 60 + parsed.getUTCMinutes();
}

function extendedBedtime(value: string | null | undefined): number | null {
  const minute = minuteOfDay(value);
  if (minute === null) return null;
  return minute < 12 * 60 ? minute + 1440 : minute;
}

function mean(values: number[]): number {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function meanAbsoluteDeviation(values: number[]): number {
  const center = mean(values);
  return mean(values.map((value) => Math.abs(value - center)));
}

function bounded(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

export function formatSleepMinutes(minutes: number | null): string {
  if (minutes === null) return 'Still calibrating';
  const rounded = Math.max(0, Math.round(minutes));
  const hours = Math.floor(rounded / 60);
  const remainder = rounded % 60;
  if (hours > 0 && remainder > 0) return `${hours}h ${remainder}m`;
  if (hours > 0) return `${hours}h`;
  return `${remainder}m`;
}

export function formatSleepTime(value: string | null | undefined): string {
  const minute = minuteOfDay(value);
  if (minute === null) return '—';
  return formatClockMinutes(minute);
}

export function formatClockMinutes(input: number): string {
  const minute = ((Math.round(input) % 1440) + 1440) % 1440;
  const hour = Math.floor(minute / 60);
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${String(minute % 60).padStart(2, '0')} ${hour < 12 ? 'AM' : 'PM'}`;
}

export function sleepNightSummaries(sessions: SleepSession[]): SleepNightSummary[] {
  return [...sessions]
    .sort((left, right) => left.date.localeCompare(right.date))
    .map((session) => ({
      date: session.date,
      bedtime_minutes: extendedBedtime(session.sleep_start_at),
      wake_minutes: minuteOfDay(session.sleep_end_at),
      duration_minutes: session.duration_minutes,
      source_confidence: session.source_confidence
    }));
}

function consistencyForNights(nights: SleepNightSummary[]): number | null {
  const complete = nights.filter(
    (night): night is SleepNightSummary & { bedtime_minutes: number; wake_minutes: number } =>
      night.bedtime_minutes !== null && night.wake_minutes !== null
  );
  if (complete.length < 3) return null;
  const bedtimeDeviation = meanAbsoluteDeviation(complete.map((night) => night.bedtime_minutes));
  const wakeDeviation = meanAbsoluteDeviation(complete.map((night) => night.wake_minutes));
  return Math.round(bounded(100 - (bedtimeDeviation + wakeDeviation) * 0.62, 0, 100));
}

export function calculateRhythmConsistency(sessions: SleepSession[]): RhythmConsistencyScore {
  const nights = sleepNightSummaries(sessions).slice(-14);
  const score = consistencyForNights(nights);
  const recent = nights.slice(-7);
  const prior = nights.slice(-14, -7);
  const recentScore = consistencyForNights(recent);
  const priorScore = consistencyForNights(prior);
  const completeCount = nights.filter(
    (night) => night.bedtime_minutes !== null && night.wake_minutes !== null
  ).length;
  const confidence: DataConfidence = completeCount >= 12 ? 'high' : completeCount >= 6 ? 'medium' : 'low';

  if (score === null) {
    return {
      score: null,
      confidence,
      verdict: 'Still calibrating',
      change_from_previous: null,
      explanation: 'Add at least three complete sleep windows to begin a consistency trend.',
      reason_codes: ['rhythm_consistency_insufficient_history'],
      limiting_factors: ['Fewer than three complete bedtime and wake-time records']
    };
  }

  const bedtimes = nights.flatMap((night) => night.bedtime_minutes === null ? [] : [night.bedtime_minutes]);
  const wakeTimes = nights.flatMap((night) => night.wake_minutes === null ? [] : [night.wake_minutes]);
  const bedtimeDeviation = meanAbsoluteDeviation(bedtimes);
  const wakeDeviation = meanAbsoluteDeviation(wakeTimes);
  const wobble = bedtimeDeviation > wakeDeviation ? 'bedtime' : 'wake time';
  const verdict = score >= 80 ? 'Very steady' : score >= 66 ? 'Fairly steady' : score >= 50 ? 'Finding a groove' : 'Still finding your rhythm';

  return {
    score,
    confidence,
    verdict,
    change_from_previous: recentScore !== null && priorScore !== null ? recentScore - priorScore : null,
    explanation: `Your ${wobble} varies more right now. A few repeatable nights may help the rhythm feel steadier.`,
    reason_codes: [
      'rhythm_consistency_calculated',
      wobble === 'bedtime' ? 'bedtime_variability_leads' : 'wake_variability_leads'
    ],
    limiting_factors: completeCount < 12 ? [`Only ${completeCount} of 14 nights have complete timing`] : []
  };
}

function energyForNow(briefing: CircadianBriefing, now: string): number | null {
  if (briefing.energy_curve.length === 0) return null;
  const nowMs = parseDate(now)?.getTime();
  if (nowMs === undefined || nowMs === null) return briefing.energy_curve[0]?.estimated_energy ?? null;
  let closest = briefing.energy_curve[0];
  let distance = Number.POSITIVE_INFINITY;
  for (const point of briefing.energy_curve) {
    const pointMs = parseDate(point.time)?.getTime();
    if (pointMs === undefined || pointMs === null) continue;
    const nextDistance = Math.abs(pointMs - nowMs);
    if (nextDistance < distance) {
      closest = point;
      distance = nextDistance;
    }
  }
  return closest?.estimated_energy ?? null;
}

function nextShiftLabel(briefing: CircadianBriefing, now: string): string {
  const nowMs = parseDate(now)?.getTime();
  if (nowMs === undefined || nowMs === null || briefing.energy_curve.length === 0) return 'Add sleep data to refine timing';
  const current = briefing.current_phase;
  const next = briefing.energy_curve.find((point) => parseDate(point.time)!.getTime() > nowMs && point.label !== current);
  if (!next) return current === 'sleep_window' ? 'Rest window underway' : 'Settling toward sleep';
  const nextMs = parseDate(next.time)?.getTime();
  if (nextMs === undefined || nextMs === null) return 'Timing is still calibrating';
  return `Next shift in ${formatSleepMinutes((nextMs - nowMs) / 60_000)}`;
}

export function buildSleepPhasePresentation(briefing: CircadianBriefing, now: string): SleepPhasePresentation {
  const base = PHASE_COPY[briefing.current_phase];
  const energy = energyForNow(briefing, now);
  return {
    ...base,
    energy: energy === null ? base.energy : energy >= 72 ? 'High' : energy >= 42 ? 'Steady' : 'Low',
    next_shift: nextShiftLabel(briefing, now)
  };
}

function protocolWindow(
  id: SleepProtocolItem['id'],
  name: string,
  reason: string,
  window: TimeWindow | undefined
): SleepProtocolItem {
  return {
    id,
    name,
    reason,
    start_at: window?.start_at ?? null,
    end_at: window?.end_at ?? null,
    point_in_time: false
  };
}

export function buildSleepProtocol(briefing: CircadianBriefing): SleepProtocolItem[] {
  return [
    protocolWindow('light', 'Walk / light movement', 'Supports the transition into your day', briefing.rhythm_plan.best_walk_windows[0]),
    protocolWindow('focus', 'Deep work', 'Aligned with your estimated first focus peak', briefing.rhythm_plan.deep_work_windows[0]),
    protocolWindow('movement', 'Exercise', 'Placed within a higher estimated-energy window', briefing.rhythm_plan.best_exercise_windows[0]),
    protocolWindow('reset', 'Breathing / reset', 'Placed near your estimated lower-energy window', briefing.rhythm_plan.breathing_windows[0]),
    {
      id: 'caffeine',
      name: 'Caffeine cutoff',
      reason: 'Estimated from your target sleep time',
      start_at: briefing.rhythm_plan.caffeine_cutoff,
      end_at: null,
      point_in_time: true
    },
    {
      id: 'wind_down',
      name: 'Wind-down',
      reason: 'A calmer transition before your target sleep time',
      start_at: briefing.rhythm_plan.wind_down_start,
      end_at: briefing.rhythm_plan.target_bedtime,
      point_in_time: false
    }
  ];
}

export function scheduleWindDown(steps: WindDownStep[], bedtimeMinutes: number): ScheduledWindDownStep[] {
  const enabled = steps.filter((step) => step.enabled);
  const total = enabled.reduce((sum, step) => sum + step.duration_minutes, 0);
  let cursor = bedtimeMinutes - total;
  return enabled.map((step) => {
    const scheduled = { ...step, start_minutes: cursor };
    cursor += step.duration_minutes;
    return scheduled;
  });
}
