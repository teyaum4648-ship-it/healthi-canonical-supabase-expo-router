import { dayPlanCopy, primaryFocusForMode, summaryForMode } from './dayPlanCopy';
import type {
  DataConfidence,
  DayOpenWindow,
  DayPlanMode,
  DayPlanReasonCode,
  DayPlanRecommendation,
  DayPlanResult,
  DayScheduleBlock,
  DayTimeWindow,
  GenerateDayPlanInput
} from './dayPlanTypes';

const MINUTE_MS = 60 * 1000;
const DEFAULT_WAKE_HOUR = 6;
const DEFAULT_BED_HOUR = 22;
const DEFAULT_BED_MINUTE = 30;

type TimedBlock = DayScheduleBlock & {
  startMs: number;
  endMs: number;
};

type TimedWindow = {
  startMs: number;
  endMs: number;
};

function parseTime(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? null : parsed;
}

function iso(value: number): string {
  return new Date(value).toISOString();
}

function addMinutes(value: number, minutes: number): number {
  return value + minutes * MINUTE_MS;
}

function dayTime(date: string, hour: number, minute = 0): number {
  return new Date(`${date.slice(0, 10)}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00.000Z`).getTime();
}

function uniqueReasons(reasons: DayPlanReasonCode[]): DayPlanReasonCode[] {
  return [...new Set(reasons)];
}

function clampWindow(startMs: number, endMs: number, bounds: TimedWindow): TimedWindow | null {
  const start = Math.max(startMs, bounds.startMs);
  const end = Math.min(endMs, bounds.endMs);
  if (end <= start) return null;
  return { startMs: start, endMs: end };
}

function normalizeBlocks(blocks: DayScheduleBlock[]): TimedBlock[] {
  return blocks
    .map((block) => {
      const startMs = parseTime(block.start);
      const endMs = parseTime(block.end);
      if (startMs === null || endMs === null || endMs <= startMs) return null;
      return { ...block, startMs, endMs };
    })
    .filter((block): block is TimedBlock => Boolean(block))
    .sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs || a.id.localeCompare(b.id));
}

function isBusyBlock(block: DayScheduleBlock): boolean {
  return block.type !== 'free_time' || block.flexibility === 'fixed';
}

function mergeBusyBlocks(blocks: TimedBlock[], bounds: TimedWindow): TimedWindow[] {
  const busy = blocks
    .filter(isBusyBlock)
    .map((block) => clampWindow(block.startMs, block.endMs, bounds))
    .filter((block): block is TimedWindow => Boolean(block))
    .sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs);

  const merged: TimedWindow[] = [];

  for (const block of busy) {
    const previous = merged[merged.length - 1];
    if (!previous || block.startMs > previous.endMs) {
      merged.push({ ...block });
      continue;
    }

    previous.endMs = Math.max(previous.endMs, block.endMs);
  }

  return merged;
}

function hasOverlap(blocks: TimedBlock[]): boolean {
  const sorted = blocks.filter(isBusyBlock).sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs);
  return sorted.some((block, index) => index > 0 && block.startMs < sorted[index - 1].endMs);
}

function createOpenWindows(busyBlocks: TimedWindow[], bounds: TimedWindow): DayOpenWindow[] {
  const openWindows: DayOpenWindow[] = [];
  let cursor = bounds.startMs;

  for (const block of busyBlocks) {
    if (block.startMs > cursor) {
      openWindows.push({
        start: iso(cursor),
        end: iso(block.startMs),
        duration_minutes: Math.round((block.startMs - cursor) / MINUTE_MS),
        reason_codes: ['open_window_detected']
      });
    }
    cursor = Math.max(cursor, block.endMs);
  }

  if (cursor < bounds.endMs) {
    openWindows.push({
      start: iso(cursor),
      end: iso(bounds.endMs),
      duration_minutes: Math.round((bounds.endMs - cursor) / MINUTE_MS),
      reason_codes: ['open_window_detected']
    });
  }

  return openWindows.filter((window) => window.duration_minutes >= 10);
}

function determineMode(input: GenerateDayPlanInput): DayPlanMode {
  if (input.readiness?.mode) return input.readiness.mode;
  const score = input.readiness?.score;
  if (typeof score !== 'number') return 'maintain';
  if (score >= 75) return 'build';
  if (score >= 55) return 'maintain';
  if (score >= 35) return 'correct';
  return 'restore';
}

function confidenceRank(confidence: DataConfidence): number {
  if (confidence === 'high') return 3;
  if (confidence === 'medium') return 2;
  return 1;
}

function confidenceFromScore(score: number): DataConfidence {
  if (score >= 3) return 'high';
  if (score >= 2) return 'medium';
  return 'low';
}

function lowerConfidence(confidence: DataConfidence): DataConfidence {
  if (confidence === 'high') return 'medium';
  return 'low';
}

function combineConfidence(input: GenerateDayPlanInput, missingData: string[]): DataConfidence {
  const values: DataConfidence[] = [
    input.readiness?.confidence ?? 'low',
    input.nutrition?.confidence ?? 'low',
    input.movement?.training_readiness ? 'medium' : 'low',
    input.rhythm ? 'medium' : 'low',
    input.schedule_blocks.length > 0 ? 'medium' : 'low'
  ];
  const base = confidenceFromScore(Math.min(...values.map(confidenceRank)));

  if (missingData.length >= 3) return 'low';
  if (missingData.length > 0) return lowerConfidence(base);
  return base;
}

function hasRhythmData(input: GenerateDayPlanInput): boolean {
  return Boolean(
    input.rhythm &&
      (
        input.rhythm.energy_windows?.length ||
        input.rhythm.deep_work_window ||
        input.rhythm.exercise_window ||
        input.rhythm.caffeine_cutoff ||
        input.rhythm.wind_down_start
      )
  );
}

function missingDataFor(input: GenerateDayPlanInput): string[] {
  const missing: string[] = [];
  if (input.schedule_blocks.length === 0) missing.push('schedule');
  if (!hasRhythmData(input)) missing.push('rhythm');
  if (!input.nutrition || typeof input.nutrition.meal_count !== 'number') missing.push('nutrition');
  if (!input.movement?.training_readiness) missing.push('movement');
  if (!input.readiness || (typeof input.readiness.score !== 'number' && !input.readiness.mode)) missing.push('readiness');
  return missing;
}

function reasonsForMissing(missing: string[]): DayPlanReasonCode[] {
  const reasons: DayPlanReasonCode[] = [];
  if (missing.includes('schedule')) reasons.push('missing_schedule_data');
  if (missing.includes('rhythm')) reasons.push('missing_rhythm_data');
  if (missing.includes('nutrition')) reasons.push('missing_nutrition_data');
  if (missing.includes('movement')) reasons.push('missing_movement_data');
  if (missing.includes('readiness')) reasons.push('missing_readiness_data');
  if (missing.length > 0) reasons.push('low_confidence_inputs');
  return reasons;
}

function timedWindow(window: DayTimeWindow | null | undefined): TimedWindow | null {
  const startMs = parseTime(window?.start);
  const endMs = parseTime(window?.end);
  if (startMs === null || endMs === null || endMs <= startMs) return null;
  return { startMs, endMs };
}

function intersectWindows(a: TimedWindow, b: TimedWindow): TimedWindow | null {
  const startMs = Math.max(a.startMs, b.startMs);
  const endMs = Math.min(a.endMs, b.endMs);
  if (endMs <= startMs) return null;
  return { startMs, endMs };
}

function fitWindow(
  openWindows: DayOpenWindow[],
  preferred: TimedWindow | null,
  durationMinutes: number
): TimedWindow | null {
  const durationMs = durationMinutes * MINUTE_MS;
  const timedOpenWindows = openWindows.map((window) => ({
    startMs: parseTime(window.start) ?? 0,
    endMs: parseTime(window.end) ?? 0
  }));

  if (preferred) {
    for (const open of timedOpenWindows) {
      const overlap = intersectWindows(open, preferred);
      if (overlap && overlap.endMs - overlap.startMs >= durationMs) {
        return { startMs: overlap.startMs, endMs: addMinutes(overlap.startMs, durationMinutes) };
      }
    }
  }

  const fallback = timedOpenWindows.find((window) => window.endMs - window.startMs >= durationMs);
  return fallback ? { startMs: fallback.startMs, endMs: addMinutes(fallback.startMs, durationMinutes) } : null;
}

function highEnergyWindow(input: GenerateDayPlanInput): TimedWindow | null {
  const preferred = timedWindow(input.rhythm?.deep_work_window);
  if (preferred) return preferred;

  const highWindow = input.rhythm?.energy_windows?.find((window) => window.intensity === 'high');
  return timedWindow(highWindow ? { start: highWindow.start, end: highWindow.end } : null);
}

function recommendation(
  partial: Omit<DayPlanRecommendation, 'id'>,
  index: number
): DayPlanRecommendation {
  return {
    id: `day-plan-${String(index + 1).padStart(2, '0')}`,
    ...partial,
    reason_codes: uniqueReasons(partial.reason_codes)
  };
}

function addDeepWorkRecommendation(
  recommendations: DayPlanRecommendation[],
  input: GenerateDayPlanInput,
  openWindows: DayOpenWindow[],
  confidence: DataConfidence
) {
  const preferred = highEnergyWindow(input);
  const fitted = fitWindow(openWindows, preferred, 60);
  if (!fitted) return;

  recommendations.push(
    recommendation(
      {
        type: 'deep_work',
        title: dayPlanCopy.deepWorkTitle,
        detail: dayPlanCopy.deepWorkDetail,
        start: iso(fitted.startMs),
        end: iso(fitted.endMs),
        priority: 'high',
        confidence,
        reason_codes: ['rhythm_window_available', 'deep_work_window_matched']
      },
      recommendations.length
    )
  );
}

function addMovementRecommendation(
  recommendations: DayPlanRecommendation[],
  mode: DayPlanMode,
  input: GenerateDayPlanInput,
  openWindows: DayOpenWindow[],
  confidence: DataConfidence
) {
  const lowCapacity =
    mode === 'restore' ||
    mode === 'correct' ||
    input.readiness?.score !== null && input.readiness?.score !== undefined && input.readiness.score < 45 ||
    input.movement?.training_readiness === 'low';
  const exerciseWindow = timedWindow(input.rhythm?.exercise_window);
  const fitted = fitWindow(openWindows, exerciseWindow, lowCapacity ? 20 : 45);
  if (!fitted) return;

  if (lowCapacity) {
    recommendations.push(
      recommendation(
        {
          type: mode === 'restore' ? 'recovery' : 'walk',
          title: mode === 'restore' ? dayPlanCopy.recoveryTitle : dayPlanCopy.lighterMovementTitle,
          detail: mode === 'restore' ? dayPlanCopy.recoveryDetail : dayPlanCopy.lighterMovementDetail,
          start: iso(fitted.startMs),
          end: iso(fitted.endMs),
          priority: mode === 'restore' ? 'high' : 'medium',
          confidence,
          reason_codes: mode === 'restore' ? ['restore_mode_selected', 'readiness_low'] : ['readiness_low', 'movement_window_matched']
        },
        recommendations.length
      )
    );
    return;
  }

  if (mode === 'build' || input.movement?.training_readiness === 'high') {
    recommendations.push(
      recommendation(
        {
          type: 'movement',
          title: dayPlanCopy.movementTitle,
          detail: dayPlanCopy.movementDetail,
          start: iso(fitted.startMs),
          end: iso(fitted.endMs),
          priority: 'high',
          confidence,
          reason_codes: ['readiness_high', 'movement_window_matched']
        },
        recommendations.length
      )
    );
  }
}

function addNutritionRecommendation(
  recommendations: DayPlanRecommendation[],
  input: GenerateDayPlanInput,
  openWindows: DayOpenWindow[],
  confidence: DataConfidence
) {
  const missingNutrition = !input.nutrition || typeof input.nutrition.meal_count !== 'number' || input.nutrition.meal_count === 0;
  const fitted = fitWindow(openWindows, null, 20);

  recommendations.push(
    recommendation(
      {
        type: 'meal_timing',
        title: dayPlanCopy.nutritionTitle,
        detail: missingNutrition ? dayPlanCopy.nutritionMissingDetail : dayPlanCopy.nutritionPresentDetail,
        start: fitted ? iso(fitted.startMs) : undefined,
        end: fitted ? iso(fitted.endMs) : undefined,
        priority: missingNutrition ? 'medium' : 'low',
        confidence: missingNutrition ? 'low' : confidence,
        reason_codes: missingNutrition ? ['nutrition_calibrating', 'missing_nutrition_data'] : ['fueling_signal_available', 'food_response_logged']
      },
      recommendations.length
    )
  );
}

function addSleepRecommendations(
  recommendations: DayPlanRecommendation[],
  input: GenerateDayPlanInput,
  confidence: DataConfidence
) {
  if (input.rhythm?.caffeine_cutoff) {
    recommendations.push(
      recommendation(
        {
          type: 'caffeine_cutoff',
          title: dayPlanCopy.caffeineTitle,
          detail: dayPlanCopy.caffeineDetail,
          start: input.rhythm.caffeine_cutoff,
          priority: 'medium',
          confidence,
          reason_codes: ['caffeine_cutoff_available']
        },
        recommendations.length
      )
    );
  }

  if (input.rhythm?.wind_down_start) {
    recommendations.push(
      recommendation(
        {
          type: 'wind_down',
          title: dayPlanCopy.windDownTitle,
          detail: dayPlanCopy.windDownDetail,
          start: input.rhythm.wind_down_start,
          end: input.target_bedtime,
          priority: 'high',
          confidence,
          reason_codes: ['wind_down_protected']
        },
        recommendations.length
      )
    );
  }
}

function dayBounds(input: GenerateDayPlanInput): TimedWindow {
  const startMs = parseTime(input.wake_time) ?? dayTime(input.date, DEFAULT_WAKE_HOUR);
  let endMs = parseTime(input.target_bedtime) ?? dayTime(input.date, DEFAULT_BED_HOUR, DEFAULT_BED_MINUTE);

  if (endMs <= startMs) {
    endMs += 24 * 60 * MINUTE_MS;
  }

  return { startMs, endMs };
}

export function generateDayPlan(input: GenerateDayPlanInput): DayPlanResult {
  const mode = determineMode(input);
  const bounds = dayBounds(input);
  const blocks = normalizeBlocks(input.schedule_blocks);
  const busyBlocks = mergeBusyBlocks(blocks, bounds);
  const protectedBlocks = blocks.filter(isBusyBlock).map(({ startMs, endMs, ...block }) => block);
  const openWindows = createOpenWindows(busyBlocks, bounds);
  const missingData = missingDataFor(input);
  const confidence = combineConfidence(input, missingData);
  const reasons: DayPlanReasonCode[] = reasonsForMissing(missingData);

  if (blocks.length > 0) reasons.push('schedule_blocks_available');
  if (openWindows.length > 0) reasons.push('open_window_detected');
  if (hasOverlap(blocks)) reasons.push('overlapping_blocks_handled');
  if (hasRhythmData(input)) reasons.push('rhythm_window_available');
  if (input.rhythm?.wind_down_start) reasons.push('wind_down_protected');
  if (input.rhythm?.caffeine_cutoff) reasons.push('caffeine_cutoff_available');
  if (input.target_bedtime) reasons.push('sleep_timing_available');
  if (input.nutrition?.meal_count && input.nutrition.meal_count > 0) reasons.push('fueling_signal_available');
  if (input.nutrition?.food_response_label && input.nutrition.food_response_label !== 'unknown') reasons.push('food_response_logged');
  if (mode === 'restore') reasons.push('restore_mode_selected');
  if (input.readiness?.score !== null && input.readiness?.score !== undefined && input.readiness.score < 45) reasons.push('readiness_low');
  if (input.readiness?.score !== null && input.readiness?.score !== undefined && input.readiness.score >= 75) reasons.push('readiness_high');

  const recommendations: DayPlanRecommendation[] = [];

  if (input.schedule_blocks.length === 0) {
    recommendations.push(
      recommendation(
        {
          type: 'schedule_adjustment',
          title: dayPlanCopy.scheduleAdjustmentTitle,
          detail: dayPlanCopy.scheduleAdjustmentDetail,
          priority: 'medium',
          confidence: 'low',
          reason_codes: ['missing_schedule_data', 'low_confidence_inputs']
        },
        recommendations.length
      )
    );
  }

  addDeepWorkRecommendation(recommendations, input, openWindows, confidence);
  addMovementRecommendation(recommendations, mode, input, openWindows, confidence);
  addNutritionRecommendation(recommendations, input, openWindows, confidence);
  addSleepRecommendations(recommendations, input, confidence);

  return {
    date: input.date.slice(0, 10),
    mode,
    confidence,
    summary: summaryForMode(mode, input.schedule_blocks.length > 0),
    primary_focus: primaryFocusForMode(mode),
    recommendations,
    protected_blocks: protectedBlocks,
    open_windows: openWindows,
    reason_codes: uniqueReasons(reasons),
    missing_data: missingData
  };
}
