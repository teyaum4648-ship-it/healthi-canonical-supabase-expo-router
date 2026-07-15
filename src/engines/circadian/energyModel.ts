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
 *  - sleep inertia dip in the first ~30–60 min after wake (deeper/longer when under-rested)
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
function normalizeQuality(quality: number | null | undefined): number {
  if (quality === null || quality === undefined || !Number.isFinite(quality)) {
    return 0.6; // neutral placeholder when quality is unknown
  }
  if (quality <= 5) {
    return clamp01((quality - 1) / 4); // 1 → 0, 5 → 1
  }
  return clamp01((quality - 1) / 9); // 1 → 0, 10 → 1
}

/**
 * Collapse last night's quality, duration-vs-need and recent sleep debt into a
 * single 0–1 restoration factor. 1 = fully restored (sharp, high curve); low =
 * flat, depressed curve with deep dips and long inertia.
 */
export function computeRestorationFactor(params: {
  quality?: number | null;
  durationMinutes?: number | null;
  sleepNeedMinutes?: number | null;
  avgDebtMinutes?: number | null;
}): number {
  const qualityScore = normalizeQuality(params.quality);

  const need = params.sleepNeedMinutes && params.sleepNeedMinutes > 0 ? params.sleepNeedMinutes : 480;
  const durationScore =
    params.durationMinutes && params.durationMinutes > 0
      ? clamp01((params.durationMinutes / need - 0.5) / 0.6) // 0.5×need → 0, 1.1×need → 1
      : 0.6;

  const debtScore =
    params.avgDebtMinutes === null || params.avgDebtMinutes === undefined
      ? 0.6
      : clamp01(1 - Math.max(0, params.avgDebtMinutes) / 120); // 2h+ nightly debt → 0

  const raw = qualityScore * 0.4 + durationScore * 0.35 + debtScore * 0.25;
  return clamp01(Math.max(0.15, raw)); // keep a floor so the curve never fully collapses
}

/**
 * Estimated energy (0–100) at a point in the waking day.
 * @param minutesSinceWake minutes elapsed since wake
 * @param minutesUntilBed minutes remaining until target bedtime
 * @param restorationFactor 0–1 from {@link computeRestorationFactor}
 */
export function circadianEnergyAt(
  minutesSinceWake: number,
  minutesUntilBed: number,
  restorationFactor: number
): number {
  const R = clamp01(restorationFactor);
  const h = minutesSinceWake / 60; // hours since wake
  const b = Math.max(0, minutesUntilBed) / 60; // hours until bed

  const base = 40 + 15 * R;
  const amp = 0.6 + 0.4 * R;

  const inertiaDepth = 18 * (1.4 - 0.8 * R);
  const inertiaTau = 0.7 + 0.6 * (1 - R);
  const inertia = inertiaDepth * gaussian(h, 0, inertiaTau);

  const morningPeak = 30 * amp * gaussian(h, 3.5, 2.2);
  const afternoonDip = 14 * (1.5 - 0.5 * R) * gaussian(h, 7, 1.6);
  const eveningPeak = 22 * amp * gaussian(b, 3.5, 2.0); // wake-maintenance zone before bed
  const windDown = 22 * gaussian(b, 0, 1.2);

  return clampEnergy(base - inertia + morningPeak - afternoonDip + eveningPeak - windDown);
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
