import {
  generateDailyProtocol,
  type GenerateDailyProtocolInput
} from '../../engines/protocol';
import { reviewSafetySignals, type SafetyReviewInput } from '../../engines/safety';
import type { DailyProtocolComposerInput, DailyProtocolScreenModel, DailyProtocolSource } from './dailyProtocolTypes';

function formatClockLabel(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const hours = date.getUTCHours();
  const minutes = date.getUTCMinutes();
  const hour12 = hours % 12 || 12;
  const suffix = hours >= 12 ? 'PM' : 'AM';
  return `${hour12}:${String(minutes).padStart(2, '0')} ${suffix}`;
}

function includesCode(codes: string[] | undefined, code: string): boolean {
  return Array.isArray(codes) && codes.includes(code);
}

/** Map already-computed engine outputs into a SafetyReviewInput. */
export function buildSafetyInput(input: DailyProtocolComposerInput): SafetyReviewInput {
  const nutritionReasons = input.nutrition?.reason_codes;
  const nightlyDebt = input.circadian?.sleep_debt_7_day?.nightly_average_debt_minutes ?? null;

  return {
    dayMode: input.readiness?.mode ?? input.baseline?.baseline_mode ?? null,
    readiness: input.readiness
      ? {
          score: input.readiness.score,
          label: input.readiness.label,
          confidence: input.readiness.confidence,
          reason_codes: [...input.readiness.reason_codes]
        }
      : undefined,
    movement:
      input.movement?.signal || input.movement?.pain_present != null || input.movement?.soreness_level != null
        ? {
            pain_present: input.movement?.pain_present ?? null,
            soreness_level: input.movement?.soreness_level ?? null,
            movement_readiness_label: input.movement?.signal?.label ?? null,
            reason_codes: input.movement?.signal ? [...input.movement.signal.reason_codes] : []
          }
        : undefined,
    nourishment: input.nutrition
      ? {
          under_fueled: includesCode(nutritionReasons, 'under_fueled'),
          digestion_off: includesCode(nutritionReasons, 'digestion_discomfort_reported'),
          nutrition_readiness_label: input.nutrition.readiness_support_label ?? input.nutrition.food_response_label,
          reason_codes: [...(input.nutrition.reason_codes ?? [])]
        }
      : undefined,
    recoveryRhythm: input.circadian
      ? {
          sleep_debt_minutes: nightlyDebt,
          rhythm_confidence: input.circadian.confidence,
          reason_codes: [...input.circadian.reason_codes]
        }
      : undefined,
    mindLifeLoad: input.mindLifeLoad,
    userReportedFlags: input.userReportedFlags,
    source: input.source ?? 'unknown'
  };
}

/** Map already-computed engine outputs into the protocol engine input (minus safety). */
export function buildProtocolInput(input: DailyProtocolComposerInput): Omit<GenerateDailyProtocolInput, 'safety'> {
  const rhythmPlan = input.circadian?.rhythm_plan;
  const nutritionReasons = input.nutrition?.reason_codes;
  const nightlyDebt = input.circadian?.sleep_debt_7_day?.nightly_average_debt_minutes ?? null;

  return {
    date: input.date,
    timezone: input.timezone ?? null,
    baseline: input.baseline
      ? {
          baseline_mode: input.baseline.baseline_mode ?? null,
          primary_focus: input.baseline.primary_focus ?? null,
          confidence: input.baseline.confidence ?? null
        }
      : undefined,
    readiness: input.readiness
      ? {
          score: input.readiness.score,
          label: input.readiness.label,
          day_mode: input.readiness.mode,
          primary_focus: input.readiness.primary_focus,
          confidence: input.readiness.confidence,
          reason_codes: [...input.readiness.reason_codes]
        }
      : undefined,
    circadian: input.circadian
      ? {
          current_phase: input.circadian.current_phase,
          best_movement_window: formatClockLabel(rhythmPlan?.best_exercise_windows?.[0]?.start_at ?? null),
          caffeine_cutoff: formatClockLabel(rhythmPlan?.caffeine_cutoff ?? null),
          wind_down_start: formatClockLabel(rhythmPlan?.wind_down_start ?? null),
          sleep_debt_minutes: nightlyDebt,
          confidence: input.circadian.confidence,
          reason_codes: [...input.circadian.reason_codes]
        }
      : undefined,
    nourishment: input.nutrition
      ? {
          nutrition_readiness_label: input.nutrition.readiness_support_label ?? input.nutrition.food_response_label,
          under_fueled: includesCode(nutritionReasons, 'under_fueled'),
          digestion_off: includesCode(nutritionReasons, 'digestion_discomfort_reported'),
          food_pattern_label: input.nutrition.food_quality_label,
          reason_codes: [...(input.nutrition.reason_codes ?? [])]
        }
      : undefined,
    movement: input.movement?.signal
      ? {
          movement_readiness_label: input.movement.signal.label,
          suggested_next_action: input.movement.signal.suggested_next_action,
          pain_present: input.movement.pain_present ?? null,
          soreness_level: input.movement.soreness_level ?? null,
          reason_codes: [...input.movement.signal.reason_codes]
        }
      : undefined,
    schedule: input.dayPlan
      ? {
          open_windows_count: input.dayPlan.open_windows.length,
          protected_blocks_count: input.dayPlan.protected_blocks.length,
          reason_codes: [...input.dayPlan.reason_codes]
        }
      : undefined,
    source: input.source ?? 'unknown'
  };
}

function resolveSourceLabel(input: DailyProtocolComposerInput): DailyProtocolSource {
  if (input.source === 'demo') return 'demo';
  const hasAnySignal = Boolean(input.readiness || input.circadian || input.nutrition || input.movement?.signal || input.dayPlan);
  if (!hasAnySignal) return 'calibrating';
  return input.source ?? 'logged';
}

/**
 * Feature-level composer: reviews safety first, then generates the daily
 * protocol, returning a serializable screen model. Safe on empty/signed-out
 * input (produces a calibrating protocol rather than throwing).
 */
export function composeDailyProtocol(input: DailyProtocolComposerInput): DailyProtocolScreenModel {
  const safety = reviewSafetySignals(buildSafetyInput(input));
  const protocol = generateDailyProtocol({ ...buildProtocolInput(input), safety });
  const source_label = resolveSourceLabel(input);

  return {
    protocol,
    safety,
    source_label,
    is_demo: input.source === 'demo',
    generated_at: new Date().toISOString()
  };
}
