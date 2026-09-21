import type {
  CircadianBriefing,
  CircadianEnergyPoint,
  EnergyExtreme,
  EnergyZone,
  EnergyZoneLevel,
  TimeWindow
} from './types';

/**
 * Continuous circadian energy model grounded in the two-process model of sleep
 * regulation (Borbély 1982). Waking-day alertness ≈ Process C (circadian arousal)
 * minus Process S (homeostatic sleep pressure), with the whole curve scaled by how
 * restorative the prior night was (`restorationFactor`).
 *
 * The shape encodes documented features:
 *  - sleep inertia clearing over the first ~2–4 h after wake (deeper/longer when under-rested)
 *  - a morning peak ~3–4 h after wake
 *  - the post-lunch dip ~7 h after wake (deeper with sleep debt)
 *  - the late-day wake-maintenance-zone "second wind" ~3–4 h before bedtime
 *  - a wind-down decline as melatonin onset lets sleep pressure win near bedtime
 *
 * Sources: PMC9540767 (two-process model), PMC6054682 / PMC2647793 / PMC3601314
 * (wake-maintenance zone, post-lunch dip, sleep-propensity rhythm).
 */

const HIGH_ENERGY_THRESHOLD = 70;
const MODERATE_ENERGY_THRESHOLD = 45;

function clampEnergy(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function gaussian(x: number, center: number, width: number): number {
  const z = (x - center) / width;
  return Math.exp(-(z * z));
}

/** Normalize a stored sleep-quality value to 0–1. Tolerates both 1–5 and 0–10 scales. */
function normalizeQuality(quality: number | null | undefined): number | null {
  if (quality === null || quality === undefined || !Number.isFinite(quality)) return null;
  if (quality <= 5) return clamp01((quality - 1) / 4); // 1 → 0, 5 → 1
  return clamp01((quality - 1) / 9); // 1 → 0, 10 → 1
}

export type RestorationInput = {
  /** Stored 1–5 (or 0–10) sleep quality. */
  quality?: number | null;
  /**
   * How refreshed the person said they felt on waking, 1–5. A separate and more reliable
   * question than "quality": it asks about an observable present state rather than a
   * judgement about hours spent unconscious, and it reads sleep inertia directly.
   */
  refreshment?: number | null;
  durationMinutes?: number | null;
  sleepNeedMinutes?: number | null;
  avgDebtMinutes?: number | null;
  /** 0–1 from circadianPhase. How tightly the last two weeks of nights cluster. */
  regularityScore?: number | null;
  /** Signed minutes between last night's mid-sleep and the body clock. */
  misalignmentMinutes?: number | null;
};

export type Restoration = {
  /** 0–1. 1 = fully restored (sharp, high curve); low = flat and depressed. */
  factor: number;
  /**
   * How much of the total weight was actually known, 0–1. This is what makes missing
   * data lower *confidence* rather than the score: an unknown term is dropped and the
   * rest renormalised, instead of being filled with a flattering placeholder.
   */
  coverage: number;
  /** Which inputs contributed, for reason codes. */
  knownTerms: string[];
  /** The term that cost the most, if any single one stands out. Names the limiter. */
  limiter: 'quality' | 'refreshment' | 'duration' | 'debt' | 'regularity' | 'misalignment' | null;
};

type TermName = NonNullable<Restoration['limiter']>;

/** Neutral midpoint used only when nothing at all is known. */
const NEUTRAL_FACTOR = 0.5;

/**
 * Below this much coverage the forecast is still calibrating and should say so.
 *
 * Set at the point where neither the subjective signal nor a rhythm is available: duration
 * and debt read off a single night come to 0.40, which is genuinely thin however confident
 * the arithmetic looks. Exported because the engine and the copy must not each hardcode
 * their own idea of thin — they disagreed the first time, and a test caught it.
 */
export const THIN_COVERAGE = 0.5;

/*
 * Weights over the terms that are present. Refreshment outranks stored quality because it
 * is the better-posed question; duration and debt carry the objective load; regularity
 * and misalignment are the timing half that the model previously ignored entirely.
 */
const TERM_WEIGHTS = {
  refreshment: 0.28,
  quality: 0.16,
  duration: 0.24,
  debt: 0.16,
  regularity: 0.08,
  misalignment: 0.08
} as const;

/**
 * Collapse last night into a single 0–1 restoration factor, plus how much of it was
 * actually known.
 *
 * Two deliberate departures from the previous version:
 *
 * **No floor.** It used to end in `Math.max(0.15, raw)`, which meant three hours of sleep
 * and five hours of sleep both bottomed out at 0.15 and produced the same forecast. The
 * floor was there to stop the drawn curve collapsing, but it was clamping the signal
 * rather than the display — so the bottom half of the scale was unreachable. Presentation
 * clamps belong in the chart.
 *
 * **No flattering placeholder.** An unknown term used to be filled with 0.6, which made
 * logging nothing (0.600) score better than honestly logging a mediocre night (0.507).
 * Unknown terms are now dropped and the remaining weights renormalised, and the absence
 * is reported as `coverage` for the caller to turn into confidence.
 */
export function computeRestoration(params: RestorationInput): Restoration {
  const need = params.sleepNeedMinutes && params.sleepNeedMinutes > 0 ? params.sleepNeedMinutes : 480;

  const qualityScore = normalizeQuality(params.quality);
  const refreshmentScore = normalizeQuality(params.refreshment);

  const durationScore =
    params.durationMinutes && params.durationMinutes > 0
      ? clamp01((params.durationMinutes / need - 0.5) / 0.6) // 0.5×need → 0, 1.1×need → 1
      : null;

  const debtScore =
    params.avgDebtMinutes === null || params.avgDebtMinutes === undefined || !Number.isFinite(params.avgDebtMinutes)
      ? null
      : clamp01(1 - Math.max(0, params.avgDebtMinutes) / 120); // 2h+ nightly debt → 0

  const regularityScore =
    params.regularityScore === null || params.regularityScore === undefined
      ? null
      : clamp01(params.regularityScore);

  /* Three hours out of step is treated as the point where timing has cost everything. */
  const misalignmentScore =
    params.misalignmentMinutes === null || params.misalignmentMinutes === undefined
      ? null
      : clamp01(1 - Math.abs(params.misalignmentMinutes) / 180);

  const candidates: Array<[TermName, number | null, number]> = [
    ['refreshment', refreshmentScore, TERM_WEIGHTS.refreshment],
    ['quality', qualityScore, TERM_WEIGHTS.quality],
    ['duration', durationScore, TERM_WEIGHTS.duration],
    ['debt', debtScore, TERM_WEIGHTS.debt],
    ['regularity', regularityScore, TERM_WEIGHTS.regularity],
    ['misalignment', misalignmentScore, TERM_WEIGHTS.misalignment]
  ];

  const present = candidates.filter(
    (entry): entry is [TermName, number, number] => entry[1] !== null
  );

  if (present.length === 0) {
    return { factor: NEUTRAL_FACTOR, coverage: 0, knownTerms: [], limiter: null };
  }

  const totalWeight = present.reduce((sum, [, , weight]) => sum + weight, 0);
  const factor = clamp01(present.reduce((sum, [, score, weight]) => sum + score * weight, 0) / totalWeight);

  /*
   * The limiter is the present term that gave up the most weighted ground. Reported only
   * when one term clearly dominates, so the app never names a cause it cannot see.
   */
  const losses = present
    .map(([name, score, weight]) => ({ name, loss: (1 - score) * weight }))
    .sort((left, right) => right.loss - left.loss);
  const limiter = losses[0] && losses[0].loss > 0.04 && losses[0].loss > (losses[1]?.loss ?? 0) * 1.4
    ? losses[0].name
    : null;

  return {
    factor,
    coverage: clamp01(totalWeight / Object.values(TERM_WEIGHTS).reduce((a, b) => a + b, 0)),
    knownTerms: present.map(([name]) => name),
    limiter
  };
}

/** Backwards-compatible shorthand for callers that only want the number. */
export function computeRestorationFactor(params: RestorationInput): number {
  return computeRestoration(params).factor;
}

/**
 * Estimated energy (0–100) at a point in the waking day.
 * @param minutesSinceWake minutes elapsed since wake
 * @param minutesUntilBed minutes remaining until target bedtime
 * @param restorationFactor 0–1 from {@link computeRestorationFactor}
 */
export type EnergyModifiers = {
  /**
   * Signed minutes between last night's mid-sleep and the body clock. Costs amplitude:
   * being out of step is its own load, separate from how long or how well you slept.
   */
  misalignmentMinutes?: number | null;
  /**
   * Estimated caffeine still on board, in mg. Lifts the curve — genuinely, that is what
   * it does — and the lift is flagged as borrowed rather than earned so the copy can say
   * so. It masks the afternoon dip more than it raises the peak.
   */
  caffeineOnBoardMg?: number | null;
  /**
   * Minutes of morning daylight logged today. A modest same-day alertness effect on top
   * of its much larger role in setting tomorrow's phase.
   */
  morningLightMinutes?: number | null;
  /**
   * Minutes since the time the body clock expected to wake, as opposed to when the person
   * actually did.
   *
   * This is the fix for the model's largest inaccuracy. The rhythm used to be keyed
   * entirely off `sleep_end_at`, which asserts that sleeping in three hours moves your
   * whole circadian rhythm three hours. It does not — the clock is set by light and by
   * weeks of habit and shifts by at most about an hour a day. So the rhythm components
   * (morning peak, afternoon dip) now run on clock time while sleep inertia stays keyed
   * to when you genuinely woke, because inertia really is wake-relative.
   *
   * Omitted falls back to `minutesSinceWake`, which is the old behaviour.
   */
  minutesSinceCircadianWake?: number | null;
};

export function circadianEnergyAt(
  minutesSinceWake: number,
  minutesUntilBed: number,
  restorationFactor: number,
  modifiers: EnergyModifiers = {}
): number {
  const R = clamp01(restorationFactor);
  const h = minutesSinceWake / 60; // hours since the person actually woke — drives inertia
  const b = Math.max(0, minutesUntilBed) / 60; // hours until bed
  /* Hours since the clock expected to wake — drives the rhythm. See minutesSinceCircadianWake. */
  const c = (modifiers.minutesSinceCircadianWake ?? minutesSinceWake) / 60;

  /*
   * Base and amplitude both scale hard with R, because the previous settings left the
   * whole model living in a 21–84 band: the best night and the worst differed by at most
   * 27 points of 100, which on a 136px plot is about 26 pixels. A forecast nobody can
   * see the difference in is not a forecast. A genuinely bad night now reads bad.
   */
  const base = 24 + 38 * R;
  const amp = 0.45 + 0.55 * R;

  // Sleep inertia clears more slowly than a "groggy first hour" would suggest:
  // subjective alertness keeps improving for up to ~2 h after waking, and some task
  // performance takes up to ~3.5 h to fully dissipate (PMC3832615). The Gaussian width
  // is set so a well-rested morning is mostly clear by ~2.5 h and an under-rested one
  // drags toward ~4 h, rather than both being gone inside 90 minutes.
  const inertiaDepth = 20 * (1.5 - 0.9 * R);
  const inertiaTau = 1.2 + 0.8 * (1 - R);
  const inertia = inertiaDepth * gaussian(h, 0, inertiaTau);

  const morningPeak = 32 * amp * gaussian(c, 3.5, 2.2);
  const afternoonDip = 15 * (1.6 - 0.6 * R) * gaussian(c, 7, 1.6);
  const eveningPeak = 22 * amp * gaussian(b, 3.5, 2.0); // wake-maintenance zone before bed
  const windDown = 22 * gaussian(b, 0, 1.2);

  /* Timing load. Flat across the day — being out of step does not clock off at lunch. */
  const misalignment = modifiers.misalignmentMinutes ?? null;
  const misalignmentPenalty =
    misalignment === null ? 0 : 14 * clamp01(Math.abs(misalignment) / 180);

  /* Caffeine fills the dip more than it raises the peak, which is how it actually feels. */
  const caffeineMg = modifiers.caffeineOnBoardMg ?? null;
  const caffeineLift =
    caffeineMg === null || caffeineMg <= 0
      ? 0
      : 12 * clamp01(caffeineMg / 200) * (0.45 + 0.55 * gaussian(c, 7, 3.2));

  const lightMinutes = modifiers.morningLightMinutes ?? null;
  const lightLift = lightMinutes === null ? 0 : 5 * clamp01(lightMinutes / 20);

  return clampEnergy(
    base - inertia + morningPeak - afternoonDip + eveningPeak - windDown
      - misalignmentPenalty + caffeineLift + lightLift
  );
}

/**
 * The floor and ceiling of a typical day for this person, so today's curve can be read
 * against their own normal rather than against an abstract 0–100.
 *
 * The chart used to render a fixed 0–100 axis, which meant a good day and a bad day both
 * filled the same vertical space and neither had anything to be compared to. A reference
 * band is the honest way to make the axis mean something: the scale can move, but there
 * is always something behind it that does not.
 */
export type TypicalBand = {
  low: number;
  high: number;
  /** Nights the band was built from. Below about five it is a guess, and says so. */
  nights: number;
};

/**
 * Build the band from the median of recent nights.
 *
 * The median rather than the mean, for the same reason the sleep baseline uses it: one
 * catastrophic night should not redefine what normal looks like for a fortnight.
 */
export function deriveTypicalBand(
  nightlySleepMinutes: number[],
  sleepNeedMinutes: number,
  wakingMinutes = 16 * 60
): TypicalBand | null {
  const usable = nightlySleepMinutes.filter((value) => Number.isFinite(value) && value > 0);
  if (usable.length === 0) return null;

  const sorted = [...usable].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  const medianMinutes = sorted.length % 2 === 1
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;

  /*
   * Duration is the only term available across a run of nights — refreshment and
   * misalignment are per-night and often absent — so the band is deliberately a
   * duration-only reference, and `nights` lets the caller hedge it.
   */
  const reference = computeRestorationFactor({
    durationMinutes: medianMinutes,
    sleepNeedMinutes
  });

  let low = 100;
  let high = 0;
  for (let m = 0; m <= wakingMinutes; m += 20) {
    const value = circadianEnergyAt(m, wakingMinutes - m, reference);
    if (value < low) low = value;
    if (value > high) high = value;
  }

  return { low, high, nights: usable.length };
}

export type OutlookBand = 'sharp' | 'steady' | 'slow' | 'flat';

export type DayOutlook = {
  /** 0–100 headline. Usable energy across the waking day, not an average of the curve. */
  score: number;
  band: OutlookBand;
  peakEnergy: number;
  /** Minutes the curve spends in the high band — the part of the day worth protecting. */
  highMinutes: number;
  /** Minutes below the moderate threshold. */
  lowMinutes: number;
  /** How much of the input was known, carried through from restoration. */
  coverage: number;
};

const OUTLOOK_LABELS: Record<OutlookBand, string> = {
  sharp: 'Sharp',
  steady: 'Steady',
  slow: 'Slow',
  flat: 'Flat'
};

export function outlookLabel(band: OutlookBand): string {
  return OUTLOOK_LABELS[band];
}

/** Measured bounds of the raw usable-energy figure across R = 0 → 1. See deriveDayOutlook. */
export const RAW_OUTLOOK_FLOOR = 8;
export const RAW_OUTLOOK_CEILING = 60;

/**
 * A single number for "what does today look like".
 *
 * Deliberately not the mean of the curve: a day with a strong morning and a dead
 * afternoon averages the same as a flat mediocre one, and those are not the same day. The
 * score is weighted toward time spent actually usable, so the shape counts.
 */
export function deriveDayOutlook(
  points: CircadianEnergyPoint[],
  coverage = 1,
  stepMinutes = 20
): DayOutlook | null {
  if (points.length === 0) return null;

  const energies = points.map((point) => point.estimated_energy);
  const peak = Math.max(...energies);
  const high = energies.filter((value) => value >= HIGH_ENERGY_THRESHOLD).length * stepMinutes;
  const low = energies.filter((value) => value < MODERATE_ENERGY_THRESHOLD).length * stepMinutes;

  /*
   * Usable energy, weighted superlinearly in height.
   *
   * A step function was tried first and a test caught the problem: counting "above
   * moderate" as one and "above high" as two makes a day that is excellent all morning
   * and dead all afternoon score exactly the same as a uniformly mediocre one. They are
   * not the same day. The purpose of this chart is deciding when to do the hard thing,
   * and a real peak is schedulable where a flat plateau is not — so height has to pay
   * more than proportionally. The exponent is gentle enough that a genuinely flat good
   * day still beats a spiky bad one.
   */
  const usable = energies.reduce((sum, value) => sum + Math.pow(clamp01(value / 100), 1.5), 0);
  const raw = (usable / energies.length) * 100;

  /*
   * Rescale onto the range this curve can actually reach.
   *
   * Even a perfect day spends time in sleep inertia, the afternoon dip and the wind-down,
   * so the raw figure only ever runs from about 8 to about 60 — measured by sweeping the
   * model from R=0 to R=1. Publishing that unrescaled would repeat the mistake this whole
   * change set out to fix: a headline score that tops out at 59 reads as broken.
   *
   * These two constants are therefore a property of the curve, not free parameters.
   * `pins the achievable window` in the tests fails if a change to the curve moves them.
   */
  const score = Math.round(
    clamp01((raw - RAW_OUTLOOK_FLOOR) / (RAW_OUTLOOK_CEILING - RAW_OUTLOOK_FLOOR)) * 100
  );

  return {
    score,
    band: score >= 70 ? 'sharp' : score >= 45 ? 'steady' : score >= 25 ? 'slow' : 'flat',
    peakEnergy: peak,
    highMinutes: high,
    lowMinutes: low,
    coverage: clamp01(coverage)
  };
}

function levelFor(energy: number): EnergyZoneLevel {
  if (energy >= HIGH_ENERGY_THRESHOLD) return 'high';
  if (energy >= MODERATE_ENERGY_THRESHOLD) return 'moderate';
  return 'low';
}

/** Contiguous vertical bands classifying each stretch of the curve high/moderate/low. */
export function deriveEnergyZones(points: CircadianEnergyPoint[]): EnergyZone[] {
  if (points.length < 2) return [];

  const zones: EnergyZone[] = [];
  let runStart = points[0].time;
  let runLevel = levelFor(points[0].estimated_energy);

  for (let i = 1; i < points.length; i++) {
    const level = levelFor(points[i].estimated_energy);
    if (level !== runLevel) {
      zones.push({ start_at: runStart, end_at: points[i].time, level: runLevel });
      runStart = points[i].time;
      runLevel = level;
    }
  }
  zones.push({ start_at: runStart, end_at: points[points.length - 1].time, level: runLevel });
  return zones;
}

/**
 * Meaningful local maxima/minima of the curve, labelled peak/low. Endpoints are
 * skipped and a minimum prominence is required so only real turning points surface.
 */
export function deriveEnergyExtrema(
  points: CircadianEnergyPoint[],
  minProminence = 5,
  windowRadius = 3
): EnergyExtreme[] {
  if (points.length < 3) return [];

  const extrema: EnergyExtreme[] = [];
  for (let i = 1; i < points.length - 1; i++) {
    const lo = Math.max(0, i - windowRadius);
    const hi = Math.min(points.length - 1, i + windowRadius);
    let windowMin = Number.POSITIVE_INFINITY;
    let windowMax = Number.NEGATIVE_INFINITY;
    for (let j = lo; j <= hi; j++) {
      const value = points[j].estimated_energy;
      if (value < windowMin) windowMin = value;
      if (value > windowMax) windowMax = value;
    }

    const curr = points[i].estimated_energy;
    const prev = points[i - 1].estimated_energy;
    // Prominence measured against the surrounding window, not just neighbours, so a
    // gently-rounded turning point on a finely sampled curve still registers.
    const isPeak = curr >= windowMax && curr - windowMin >= minProminence && prev <= curr;
    const isLow = curr <= windowMin && windowMax - curr >= minProminence && prev >= curr;

    if (!isPeak && !isLow) continue;

    const type: EnergyExtreme['type'] = isPeak ? 'peak' : 'low';
    const last = extrema[extrema.length - 1];
    // Collapse flat plateaus / adjacent same-type extrema into the stronger one.
    if (last && last.type === type) {
      const lastBetter = type === 'peak' ? last.energy >= curr : last.energy <= curr;
      if (lastBetter) continue;
      extrema.pop();
    }
    extrema.push({ type, time: points[i].time, energy: curr });
  }
  return extrema;
}

function timeWithin(time: number, window: TimeWindow | undefined): boolean {
  if (!window) return false;
  const start = new Date(window.start_at).getTime();
  const end = new Date(window.end_at).getTime();
  return Number.isFinite(start) && Number.isFinite(end) && time >= start && time <= end;
}

function energyAtTime(points: CircadianEnergyPoint[], time: number): number {
  let best = points[0]?.estimated_energy ?? 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const point of points) {
    const distance = Math.abs(new Date(point.time).getTime() - time);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = point.estimated_energy;
    }
  }
  return best;
}

function zoneLevelAtTime(zones: EnergyZone[], time: number): EnergyZoneLevel {
  for (const zone of zones) {
    const start = new Date(zone.start_at).getTime();
    const end = new Date(zone.end_at).getTime();
    if (time >= start && time <= end) return zone.level;
  }
  return 'moderate';
}

export type RecommendedActivity = {
  label: string;
  energy: number;
  zoneLevel: EnergyZoneLevel;
};

/**
 * What the rhythm suggests doing at a given moment — matched against the plan's
 * activity windows first, then a fall-back keyed to the energy zone.
 */
export function getRecommendedActivityAt(briefing: CircadianBriefing, isoTime: string): RecommendedActivity {
  const time = new Date(isoTime).getTime();
  const energy = energyAtTime(briefing.energy_curve, time);
  const zoneLevel = zoneLevelAtTime(briefing.energy_zones, time);
  const plan = briefing.rhythm_plan;

  let label = zoneLevel === 'high' ? 'Protect focus' : zoneLevel === 'moderate' ? 'Ease into lighter work' : 'Rest or reset';

  if (plan.deep_work_windows.some((window) => timeWithin(time, window))) {
    label = 'Deep work';
  } else if (plan.best_exercise_windows.some((window) => timeWithin(time, window))) {
    label = 'Exercise';
  } else if (plan.nap_windows.some((window) => timeWithin(time, window))) {
    label = 'Short nap';
  } else if (plan.best_walk_windows.some((window) => timeWithin(time, window))) {
    label = 'Walk / light movement';
  } else if (plan.breathing_windows.some((window) => timeWithin(time, window))) {
    label = 'Breathing / reset';
  } else if (plan.wind_down_start && time >= new Date(plan.wind_down_start).getTime()) {
    label = 'Wind-down';
  }

  return { label, energy, zoneLevel };
}
