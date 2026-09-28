import { describeMisalignment, outlookLabel, THIN_COVERAGE } from '../../engines/circadian';
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
  id: 'morning_light' | 'light' | 'focus' | 'movement' | 'reset' | 'caffeine' | 'dim_light' | 'wind_down';
  name: string;
  reason: string;
  start_at: string | null;
  end_at: string | null;
  point_in_time: boolean;
  /**
   * Why this window sits where it does, in the person's own terms.
   *
   * Kept on the item rather than buried in a docs file so the reasoning ships with
   * the recommendation. Each line reports what was measured and, where the effect is
   * small or contested, says so — the timing is inferred from sleep times, which
   * carry far less information than an actual circadian phase measurement.
   */
  evidence: string;
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
  window: TimeWindow | undefined,
  evidence: string
): SleepProtocolItem {
  return {
    id,
    name,
    reason,
    start_at: window?.start_at ?? null,
    end_at: window?.end_at ?? null,
    point_in_time: false,
    evidence
  };
}

/**
 * Plain-language notes on where each window comes from.
 *
 * Written to be readable by someone who has not read a chronobiology paper, and to
 * avoid overstating: the morning-light note names the size of the effect, and the
 * focus note admits the peak is a population average rather than a personal one.
 */
const PROTOCOL_EVIDENCE = {
  morning_light: 'Light soon after waking is the strongest signal your body clock takes from the day. A single 30-minute dose measurably shifts it earlier, though by minutes rather than hours — it is a nudge repeated daily, not a reset.',
  light: 'Easy movement early helps the transition out of sleep. Grogginess after waking clears over roughly two to four hours, so the first stretch of the day is better suited to something light than to your hardest work.',
  focus: 'Alertness tends to climb to a first peak around three to four hours after waking, once grogginess has cleared. That is a population average — if your own best hours differ, trust what you notice over this window.',
  movement: 'Strength and power measure highest in the late afternoon, when core body temperature peaks. This window is also kept at least four hours clear of your target sleep time, because training closer than that is linked to falling asleep later and sleeping worse.',
  reset: 'Alertness dips around seven to eight hours after waking. It happens whether or not you eat lunch, so it is worth planning for rather than pushing through.',
  caffeine: 'A standard coffee measures about nine hours of effect on sleep, and a pre-workout or large cold brew closer to thirteen. Caffeine clears at very different speeds between people, so treat this as a starting point and adjust to what you notice.',
  dim_light: 'Melatonin is held back by surprisingly little light — ordinary room lighting and screens are bright enough. Sensitivity varies enormously between people, so if you fall asleep easily this matters less to you than the average.',
  wind_down: 'Sleep pressure builds all day, but for most people the couple of hours before their usual bedtime are when the body clock is still pushing alertness up — which is why sleep can feel hard to reach right before bed. A calmer transition works with that rather than against it.'
} as const satisfies Record<SleepProtocolItem['id'], string>;

export function buildSleepProtocol(briefing: CircadianBriefing): SleepProtocolItem[] {
  return [
    // First in the list because it is the earliest and the best-evidenced: a single
    // 30-minute exposure after waking is the strongest phase cue available without
    // changing sleep times. The effect is a nudge of roughly 11 minutes per morning,
    // so the reason says "helps set" rather than promising a reset.
    protocolWindow('morning_light', 'Morning light', 'Helps set your body clock for the day', briefing.rhythm_plan.morning_light_windows[0], PROTOCOL_EVIDENCE.morning_light),
    protocolWindow('light', 'Walk / light movement', 'Supports the transition into your day', briefing.rhythm_plan.best_walk_windows[0], PROTOCOL_EVIDENCE.light),
    protocolWindow('focus', 'Deep work', 'Aligned with your estimated first focus peak', briefing.rhythm_plan.deep_work_windows[0], PROTOCOL_EVIDENCE.focus),
    protocolWindow('movement', 'Exercise', 'Near your estimated temperature peak, and clear of your sleep window', briefing.rhythm_plan.best_exercise_windows[0], PROTOCOL_EVIDENCE.movement),
    protocolWindow('reset', 'Breathing / reset', 'Placed near your estimated lower-energy window', briefing.rhythm_plan.breathing_windows[0], PROTOCOL_EVIDENCE.reset),
    {
      id: 'caffeine',
      name: 'Caffeine cutoff',
      reason: 'Estimated from your target sleep time',
      start_at: briefing.rhythm_plan.caffeine_cutoff,
      end_at: null,
      point_in_time: true,
      evidence: PROTOCOL_EVIDENCE.caffeine
    },
    {
      id: 'dim_light',
      name: 'Start dimming lights',
      reason: 'Ordinary indoor light is bright enough to hold melatonin back',
      start_at: briefing.rhythm_plan.evening_dim_light_start,
      end_at: briefing.rhythm_plan.target_bedtime,
      point_in_time: false,
      evidence: PROTOCOL_EVIDENCE.dim_light
    },
    {
      id: 'wind_down',
      name: 'Wind-down',
      reason: 'A calmer transition before your target sleep time',
      start_at: briefing.rhythm_plan.wind_down_start,
      end_at: briefing.rhythm_plan.target_bedtime,
      point_in_time: false,
      evidence: PROTOCOL_EVIDENCE.wind_down
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

/**
 * Today's outlook, in words.
 *
 * The chart can show the shape of a day but not why it has that shape. This is the
 * sentence underneath it: which single input cost the most, and whether the problem was
 * the hours or the timing — the distinction the model could not previously make at all.
 *
 * Language stays estimative throughout. This is general wellness guidance, and the honest
 * register for a forecast built partly from self-report is "suggests", not "shows".
 */

const LIMITER_COPY: Record<string, string> = {
  refreshment: 'You said you woke unrefreshed, which is the strongest single signal here.',
  quality: 'Reported sleep quality is what is holding the estimate down.',
  duration: 'A short night is the main factor.',
  debt: 'Accumulated sleep debt across recent nights is the main factor.',
  regularity: 'An irregular recent schedule is the main factor — the nights vary more than they settle.',
  misalignment: 'The hours were there; the timing was not. Your body clock and last night disagree.',
  fragmentation: 'Time awake during the night is the main factor.',
  heart_rate: 'A morning pulse above your usual is the main factor.'
};

export type OutlookSummary = {
  eyebrow: string;
  /** The band word — Sharp, Steady, Slow or Flat. */
  headline: string;
  /** Score and peak, for the right-hand side of the card header. */
  meta: string;
  /** Why it looks like this. Null when nothing stands out. */
  body: string | null;
  /** Timing note, when last night sat meaningfully out of step. */
  timing: string | null;
  /** Shown instead of confidence claims when the inputs are thin. */
  calibrating: boolean;
};

export function describeOutlook(briefing: CircadianBriefing): OutlookSummary | null {
  const outlook = briefing.day_outlook;
  if (!outlook) return null;

  const hours = Math.round((outlook.highMinutes / 60) * 10) / 10;
  const meta = outlook.highMinutes > 0
    ? `${outlook.score} · ${hours}h in your best range`
    : `${outlook.score} · peaks around ${outlook.peakEnergy}`;

  const misalignment = briefing.circadian_phase?.misalignmentMinutes ?? null;
  const timing = misalignment !== null && Math.abs(misalignment) >= 60
    ? describeMisalignment(misalignment)
    : null;

  return {
    eyebrow: 'Today’s outlook',
    headline: outlookLabel(outlook.band),
    meta,
    /* Timing already has its own line, so it is not repeated as the limiter. */
    body: briefing.limiter && briefing.limiter !== 'misalignment'
      ? LIMITER_COPY[briefing.limiter] ?? null
      : null,
    timing,
    calibrating: briefing.input_coverage < THIN_COVERAGE
  };
}

/**
 * How refreshed a person felt on waking, as anchored choices rather than bare numbers.
 *
 * The input used to be the digits 1 to 5 with no reference point, carrying the largest
 * single weight in the model while being the least reliable thing in it. "How did it
 * feel?" invites a judgement about a night spent unconscious; "how refreshed were you?"
 * asks about something observable, and reads sleep inertia directly.
 *
 * Deliberately no default. Unanswered has to mean unanswered — a pre-selected 4 asserts a
 * good night on behalf of someone who never said so.
 */
export const REFRESHMENT_CHOICES: Array<{ value: string; label: string; detail: string }> = [
  { value: '1', label: 'Wrecked', detail: 'Could have gone straight back to sleep' },
  { value: '2', label: 'Groggy', detail: 'Slow to get going' },
  { value: '3', label: 'OK', detail: 'Took a while, but I was up' },
  { value: '4', label: 'Clear', detail: 'Awake within a few minutes' },
  { value: '5', label: 'Sharp', detail: 'Woke before the alarm, ready' }
];

/**
 * Which of today's rhythm steps to show before "Show all".
 *
 * The Sleep tab listed all eight steps of the day, from morning light to wind-down, the
 * same schedule the Plan screen already draws. What matters from here is what is next,
 * so the list opens on the step happening now and the ones still ahead.
 */
export function rhythmStepsToShow<T>(items: T[], statusOf: (item: T) => string, limit = 3): { shown: T[]; hidden: number } {
  const ahead = items.filter((item) => ['Now', 'Upcoming', 'Later'].includes(statusOf(item)));
  const shown = ahead.slice(0, limit);
  return { shown, hidden: items.length - shown.length };
}

