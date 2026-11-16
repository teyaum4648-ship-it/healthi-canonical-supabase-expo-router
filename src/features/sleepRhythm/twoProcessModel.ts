import type { SleepSession } from '../../engines/circadian';
import type { DataConfidence } from '../../types/common';
import { wallClockMinute } from '../dashboard/dayThreadInput';

/**
 * "Body clock" and "sleep pressure" for the Sleep screen: the two-process model of sleep
 * regulation (Borbély, 1982), with the published parameters of Daan, Beersma and Borbély
 * (1984), run over the nights the person logged.
 *
 * What this is, and is not:
 * - It is a model. Nothing here is measured: no hormone, no temperature, no brain signal.
 *   Every value is an estimate from sleep and wake times, and the screen says "est.".
 * - Sleep pressure (Process S) rises while awake and falls while asleep, exponentially. It
 *   is driven only by the logged sleep intervals, so a short week genuinely starts today
 *   higher. A night that was not logged is filled with the person's own usual night (the
 *   median of what they did log), counted, and lowers confidence. It is never invented as
 *   a bad night.
 * - The body clock (Process C) is the model's circadian threshold: a fixed, skewed daily
 *   wave. Its timing comes from the engine's own estimate of the person's clock (mid-sleep
 *   across logged nights), so it moves only as fast as their habits do.
 * - The space between the two threads is the model's alertness. It is a separate view
 *   from the energy forecast above it; the two are built differently and can disagree a
 *   little, which is why each is labelled for what it is.
 *
 * This is a display model for the Sleep screen. It does not feed readiness, scores or any
 * recommendation, so it cannot override safety flags, confidence or anything else.
 */

/** Daan, Beersma & Borbély (1984). Hours. */
export const TWO_PROCESS = {
  /** Time constant of the rise in sleep pressure while awake. */
  tauRise: 18.2,
  /** Time constant of its fall during sleep. */
  tauFall: 4.2,
  /** Mean of the upper (sleep-onset) threshold, on the 0–1 scale of S. */
  upperMean: 0.67,
  /** Circadian amplitude of that threshold. */
  amplitude: 0.12,
  /** The skewed circadian waveform: amplitudes of its first five harmonics. */
  harmonics: [0.97, 0.22, 0.07, 0.03, 0.001]
} as const;

const STEP = 10;
const MINUTES_PER_HOUR = 60;

/** The skewed wave, slow rise through the day and a quicker fall at night. Hours in, about −1 to 1 out. */
function wave(hours: number): number {
  return TWO_PROCESS.harmonics.reduce((sum, a, index) => sum + a * Math.sin((-2 * Math.PI * (index + 1) * hours) / 24), 0);
}

function steadyState(needMinutes: number): { atBed: number; atWake: number } {
  const asleep = Math.exp(-needMinutes / MINUTES_PER_HOUR / TWO_PROCESS.tauFall);
  const awake = Math.exp(-(1440 - needMinutes) / MINUTES_PER_HOUR / TWO_PROCESS.tauRise);
  const atBed = (1 - awake) / (1 - asleep * awake);
  return { atBed, atWake: asleep * atBed };
}

/**
 * Where the wave sits against the clock's mid-sleep. Solved once from the model itself: a
 * rested sleeper with an 8-hour need and a 3:00 AM mid-sleep (11 PM to 7 AM) reaches the
 * falling threshold exactly at their usual bedtime. Hours, relative to mid-sleep.
 */
const WAVE_OFFSET_FROM_MIDSLEEP = (() => {
  const { atBed } = steadyState(8 * 60);
  const bed = 23;
  let best = 0;
  let bestError = Infinity;
  for (let shift = 0; shift < 24; shift += 0.01) {
    const at = TWO_PROCESS.upperMean + TWO_PROCESS.amplitude * wave(bed - shift);
    const after = TWO_PROCESS.upperMean + TWO_PROCESS.amplitude * wave(bed + 0.1 - shift);
    const error = Math.abs(at - atBed);
    if (after < at && error < bestError) {
      best = shift;
      bestError = error;
    }
  }
  /* The wave with no shift has mid-sleep at 3:00 AM in the reference case. */
  return best - 3;
})();

export type TwoProcessInput = {
  /** The briefing's day, YYYY-MM-DD. Every minute below counts from its midnight. */
  day: string;
  wakeIso: string | null;
  bedIso: string | null;
  /** The engine's clock: mid-sleep in minutes past midnight, from logged nights. */
  clockMidSleepMinutes: number | null;
  sessions: SleepSession[];
  needMinutes: number;
};

export type TwoProcessPoint = { minute: number; clock: number; pressure: number; rested: number | null };

export type TwoProcessDay = {
  startMinute: number;
  endMinute: number;
  wakeMinute: number;
  bedMinute: number;
  points: TwoProcessPoint[];
  /** Nights in the last week that were logged, and those filled with the usual night. */
  loggedNights: number;
  filledNights: number;
  lastNightLogged: boolean;
  /** How much higher pressure started this morning than it would after a rested week, 0–1. */
  extraPressureAtWake: number;
  confidence: DataConfidence;
  reason_codes: string[];
};

type Interval = { start: number; end: number };

function asleepInterval(session: SleepSession, day: string): Interval | null {
  const start = wallClockMinute(session.sleep_start_at, day);
  const end = wallClockMinute(session.sleep_end_at, day);
  if (start === null || end === null || end <= start) return null;
  const inBed = end - start;
  const asleep = session.duration_minutes && session.duration_minutes > 0 ? Math.min(inBed, session.duration_minutes) : inBed;
  /* Time awake in bed sits at the start, as falling asleep does; waking is when the log says. */
  return { start: end - asleep, end };
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

/** S across the timeline: falls through each sleep interval, rises between them. */
function pressureFunction(nights: Interval[], startValue: number): (minute: number) => number {
  const events: { minute: number; value: number; asleep: boolean }[] = [];
  let value = startValue;
  let cursor = nights[0]!.start;
  for (const night of nights) {
    if (night.start > cursor) {
      events.push({ minute: cursor, value, asleep: false });
      value = 1 - (1 - value) * Math.exp(-(night.start - cursor) / MINUTES_PER_HOUR / TWO_PROCESS.tauRise);
    }
    events.push({ minute: night.start, value, asleep: true });
    value *= Math.exp(-(night.end - night.start) / MINUTES_PER_HOUR / TWO_PROCESS.tauFall);
    cursor = night.end;
  }
  events.push({ minute: cursor, value, asleep: false });
  return (minute: number) => {
    let event = events[0]!;
    for (const candidate of events) if (candidate.minute <= minute) event = candidate;
    const hours = Math.max(0, minute - event.minute) / MINUTES_PER_HOUR;
    return event.asleep
      ? event.value * Math.exp(-hours / TWO_PROCESS.tauFall)
      : 1 - (1 - event.value) * Math.exp(-hours / TWO_PROCESS.tauRise);
  };
}

/**
 * Build today's two threads, or null when there is nothing to run the model on: no wake
 * time or no logged night at all. The screen shows its empty state instead.
 */
export function buildTwoProcessDay(input: TwoProcessInput): TwoProcessDay | null {
  const wakeMinute = wallClockMinute(input.wakeIso, input.day);
  if (wakeMinute === null) return null;
  const need = Number.isFinite(input.needMinutes) && input.needMinutes > 180 ? input.needMinutes : 8 * 60;
  const bedFromBriefing = wallClockMinute(input.bedIso, input.day);
  const bedMinute = bedFromBriefing !== null && bedFromBriefing > wakeMinute ? bedFromBriefing : wakeMinute + 1440 - need;

  const logged = input.sessions
    .map((session) => asleepInterval(session, input.day))
    .filter((night): night is Interval => night !== null)
    .filter((night) => night.end <= wakeMinute + 60 && night.end > wakeMinute - 7 * 1440 - 360)
    .sort((a, b) => a.end - b.end);
  if (logged.length === 0) return null;

  /* The last seven nights, each ending near the same clock time as this morning. */
  const usual = median(logged.map((night) => night.end - night.start));
  const nights: Interval[] = [];
  let loggedNights = 0;
  let lastNightLogged = false;
  for (let back = 6; back >= 0; back -= 1) {
    const target = wakeMinute - back * 1440;
    const match = logged.find((night) => Math.abs(night.end - target) <= 6 * 60);
    if (match) {
      nights.push(match);
      loggedNights += 1;
      if (back === 0) lastNightLogged = true;
    } else {
      nights.push({ start: target - usual, end: target });
    }
  }
  const filledNights = 7 - loggedNights;

  /* Before the week, assume the steady state of a rested schedule: no debt carried in. */
  const rested = steadyState(need);
  const pressure = pressureFunction(nights, rested.atBed);

  const midSleep = input.clockMidSleepMinutes ?? (((wakeMinute - need / 2) % 1440) + 1440) % 1440;
  const clockAt = (minute: number) =>
    TWO_PROCESS.upperMean + TWO_PROCESS.amplitude * wave(minute / MINUTES_PER_HOUR - (midSleep / MINUTES_PER_HOUR + WAVE_OFFSET_FROM_MIDSLEEP));

  const restedAt = (minute: number) =>
    minute < wakeMinute ? null : 1 - (1 - rested.atWake) * Math.exp(-(minute - wakeMinute) / MINUTES_PER_HOUR / TWO_PROCESS.tauRise);

  const startMinute = Math.floor((wakeMinute - 30) / 180) * 180;
  const endMinute = Math.min(startMinute + 21 * 60, Math.max(startMinute + 18 * 60, Math.ceil((bedMinute + 30) / 180) * 180));
  const points: TwoProcessPoint[] = [];
  for (let minute = startMinute; minute <= endMinute; minute += STEP) {
    points.push({ minute, clock: clockAt(minute), pressure: pressure(minute), rested: restedAt(minute) });
  }

  const reason_codes = ['two_process_model'];
  if (!lastNightLogged) reason_codes.push('last_night_not_logged');
  if (filledNights > 0) reason_codes.push('nights_filled_with_usual');
  reason_codes.push(input.clockMidSleepMinutes === null ? 'clock_from_wake_time' : 'clock_from_logged_nights');

  /* A model of a model: never above medium, and low until the week is mostly known. */
  const confidence: DataConfidence = lastNightLogged && loggedNights >= 4 && input.clockMidSleepMinutes !== null ? 'medium' : 'low';

  return {
    startMinute,
    endMinute,
    wakeMinute,
    bedMinute,
    points,
    loggedNights,
    filledNights,
    lastNightLogged,
    extraPressureAtWake: Math.max(0, pressure(wakeMinute) - rested.atWake),
    confidence,
    reason_codes
  };
}

export type TwoProcessTrend = 'rising' | 'falling' | 'steady';

export type TwoProcessReading = {
  minute: number;
  clock: number;
  pressure: number;
  /** The space between the threads, 0–1, on a fixed scale so a short week reads lower. */
  level: number;
  /** Which way the space is going. */
  trend: TwoProcessTrend;
  /** "Clock rising", "Pressure building"… what the two threads are doing. */
  name: string;
  /** "High energy", "Moderate energy"… for the right-hand side of the readout. */
  energy: string;
};

/** A gap this wide or wider reads as full: about what a rested morning starts with. */
const FULL_GAP = 0.45;

function interpolate(day: TwoProcessDay, minute: number): TwoProcessPoint {
  const clamped = Math.max(day.startMinute, Math.min(day.endMinute, minute));
  const index = Math.min(day.points.length - 2, Math.max(0, Math.floor((clamped - day.startMinute) / STEP)));
  const a = day.points[index]!;
  const b = day.points[index + 1] ?? a;
  const t = b.minute === a.minute ? 0 : (clamped - a.minute) / (b.minute - a.minute);
  const mix = (x: number, y: number) => x + (y - x) * t;
  return {
    minute: clamped,
    clock: mix(a.clock, b.clock),
    pressure: mix(a.pressure, b.pressure),
    rested: a.rested === null || b.rested === null ? null : mix(a.rested, b.rested)
  };
}

/**
 * The readout above the chart for one minute of the day. In this model the space between
 * the threads is widest soon after waking and closes towards bedtime; the names say which
 * thread is doing the work at that moment, not a forecast of how anyone will feel.
 */
export function readTwoProcess(day: TwoProcessDay, minute: number): TwoProcessReading {
  const point = interpolate(day, minute);
  const gap = point.clock - point.pressure;
  const gapAt = (m: number) => {
    const p = interpolate(day, m);
    return p.clock - p.pressure;
  };
  const slope = gapAt(point.minute + 20) - gapAt(point.minute - 20);
  const trend: TwoProcessTrend = slope > 0.004 ? 'rising' : slope < -0.004 ? 'falling' : 'steady';
  const clockRising = interpolate(day, point.minute + 20).clock > interpolate(day, point.minute - 20).clock;
  const level = Math.max(0, Math.min(1, gap / FULL_GAP));
  const levelWord = level >= 0.7 ? 'High' : level >= 0.4 ? 'Moderate' : 'Low';

  let name: string;
  if (point.minute < day.wakeMinute) name = 'Asleep';
  else if (point.minute > day.bedMinute) name = 'Past bedtime';
  else if (gap <= 0.02) name = 'Threads meeting';
  else if (day.bedMinute - point.minute <= 120) name = 'Winding down';
  else if (point.minute - day.wakeMinute < 120) name = 'Fresh start';
  else if (clockRising) name = 'Clock rising';
  else name = 'Pressure building';

  const energy = point.minute < day.wakeMinute ? 'Recovering' : `${levelWord} energy`;
  return { minute: point.minute, clock: point.clock, pressure: point.pressure, level, trend, name, energy };
}

export type TwoProcessGeometry = {
  clock: string;
  pressure: string;
  rested: string | null;
  /** The space between the threads while awake, closed into a fillable shape. */
  gap: string;
  x: (minute: number) => number;
  y: (value: number) => number;
  minuteAt: (x: number) => number;
  /** Labels every three hours, as clock times. */
  ticks: { minute: number; x: number }[];
  /**
   * Where the line labels sit: inside the space between the threads, early in the waking
   * day where that space is widest, the clock's just under its line and the pressure's
   * just over its own, so neither line runs through a label.
   */
  labelLeft: number;
  clockLabelY: number;
  pressureLabelY: number;
};

export function twoProcessGeometry(day: TwoProcessDay, width: number, height: number, showRested: boolean): TwoProcessGeometry {
  const top = 10;
  const bottom = height - 10;
  const values = day.points.flatMap((p) => [p.clock, p.pressure, ...(showRested && p.rested !== null ? [p.rested] : [])]);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1e-6, max - min);
  const x = (minute: number) => ((minute - day.startMinute) / (day.endMinute - day.startMinute)) * width;
  const y = (value: number) => bottom - ((value - min) / span) * (bottom - top);
  const line = (pick: (p: TwoProcessPoint) => number | null) => {
    let path = '';
    for (const p of day.points) {
      const value = pick(p);
      if (value === null) continue;
      path += `${path ? 'L' : 'M'}${x(p.minute).toFixed(1)},${y(value).toFixed(1)} `;
    }
    return path.trim();
  };
  const awake = day.points.filter((p) => p.minute >= day.wakeMinute && p.minute <= day.bedMinute);
  const gap = awake.length > 1
    ? `${awake.map((p, index) => `${index ? 'L' : 'M'}${x(p.minute).toFixed(1)},${y(p.clock).toFixed(1)}`).join(' ')} ${[...awake].reverse().map((p) => `L${x(p.minute).toFixed(1)},${y(p.pressure).toFixed(1)}`).join(' ')} Z`
    : '';
  const ticks: { minute: number; x: number }[] = [];
  for (let minute = Math.ceil(day.startMinute / 180) * 180; minute <= day.endMinute; minute += 180) ticks.push({ minute, x: x(minute) });

  const anchorMinute = Math.min(day.bedMinute, day.wakeMinute + 75);
  /* The labels run about 90pt to the right of the anchor; place them by the tighter end. */
  const spanEnd = Math.min(day.endMinute, anchorMinute + ((90 / Math.max(1, width)) * (day.endMinute - day.startMinute)));
  const at = (minute: number) => day.points.reduce((best, p) => (Math.abs(p.minute - minute) < Math.abs(best.minute - minute) ? p : best));
  const anchor = at(anchorMinute);
  const end = at(spanEnd);
  const labelLeft = Math.max(0, Math.min(width - 96, x(anchor.minute) + 8));
  let clockLabelY = Math.max(y(anchor.clock), y(end.clock)) + 6;
  let pressureLabelY = Math.min(y(anchor.pressure), y(end.pressure)) - 20;
  if (pressureLabelY - clockLabelY < 18) {
    const middle = (clockLabelY + pressureLabelY) / 2;
    clockLabelY = middle - 9;
    pressureLabelY = middle + 9;
  }
  clockLabelY = Math.max(0, Math.min(height - 32, clockLabelY));
  pressureLabelY = Math.max(clockLabelY + 16, Math.min(height - 14, pressureLabelY));

  return {
    clock: line((p) => p.clock),
    pressure: line((p) => p.pressure),
    rested: showRested ? line((p) => p.rested) || null : null,
    gap,
    x,
    y,
    minuteAt: (px: number) => day.startMinute + (Math.max(0, Math.min(width, px)) / Math.max(1, width)) * (day.endMinute - day.startMinute),
    ticks,
    labelLeft,
    clockLabelY,
    pressureLabelY
  };
}
