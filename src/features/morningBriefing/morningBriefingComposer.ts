import type { GenerateDayPlanInput } from '../../engines/dayPlan';
import {
  generateDailyReadiness,
  readinessFocusLabel,
  type DailyReadinessLabel,
  type DailyReadinessResult,
  type GenerateDailyReadinessInput
} from '../../engines/readiness';
import type {
  MorningBriefing,
  MorningBriefingComposerInput,
  MorningBriefingDashboardHero,
  MorningBriefingSource
} from './morningBriefingTypes';

function timeLabel(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}`;
}

function windowValue(window: { start_at: string; end_at: string } | undefined) {
  if (!window) return null;
  return { start: timeLabel(window.start_at) ?? window.start_at, end: timeLabel(window.end_at) ?? window.end_at };
}

function readinessInput(input: MorningBriefingComposerInput): GenerateDailyReadinessInput {
  const briefing = input.rhythm?.briefing;
  const session = input.rhythm?.recent_sleep_session;
  const nutrition = input.nutrition;
  const movement = input.movement;
  const schedule = input.schedule;
  const dayPlan = schedule?.day_plan;
  const scheduleBlockCount = schedule?.block_count ?? dayPlan?.protected_blocks.length ?? 0;

  return {
    date: input.date,
    // A default clock-based briefing is a suggestion, not observed sleep evidence.
    rhythm: session
      ? {
          sleep_duration_hours: typeof session?.duration_minutes === 'number' ? Math.round((session.duration_minutes / 60) * 10) / 10 : null,
          sleep_debt_hours: typeof briefing?.sleep_debt_7_day.nightly_average_debt_minutes === 'number'
            ? Math.round((briefing.sleep_debt_7_day.nightly_average_debt_minutes / 60) * 10) / 10
            : null,
          energy_phase: briefing?.current_phase ?? null,
          deep_work_window: windowValue(briefing?.rhythm_plan.deep_work_windows[0]),
          exercise_window: windowValue(briefing?.rhythm_plan.best_exercise_windows[0]),
          caffeine_cutoff: timeLabel(briefing?.rhythm_plan.caffeine_cutoff),
          wind_down_start: timeLabel(briefing?.rhythm_plan.wind_down_start),
          confidence: briefing?.confidence ?? session?.source_confidence ?? 'low',
          reason_codes: [...(briefing?.reason_codes ?? []), ...(session?.reason_codes ?? [])]
        }
      : undefined,
    nutrition: nutrition
      ? {
          meal_count: nutrition.meal_count,
          readiness_adjustment: nutrition.readiness_adjustment,
          food_quality_label: nutrition.food_quality_label,
          food_response_label: nutrition.food_response_label,
          confidence: nutrition.confidence,
          reason_codes: [...nutrition.reason_codes]
        }
      : undefined,
    movement: movement?.summary || movement?.signal
      ? {
          workout_count_7d: movement.summary?.workout_count ?? 0,
          total_minutes_7d: movement.summary?.total_minutes ?? 0,
          training_load_label: movement.summary?.consistency ?? 'calibrating',
          readiness_label: movement.signal?.label ?? 'calibrating',
          confidence: movement.signal?.confidence ?? movement.summary?.confidence ?? 'low',
          reason_codes: [
            ...(movement.summary?.reason_codes ?? []),
            ...(movement.signal?.reason_codes ?? [])
          ]
        }
      : undefined,
    schedule: schedule
      ? {
          block_count: scheduleBlockCount,
          open_window_count: scheduleBlockCount > 0 ? dayPlan?.open_windows.length ?? 0 : 0,
          next_protected_block: schedule.next_protected_block ?? dayPlan?.protected_blocks[0]?.start ?? null,
          confidence: dayPlan?.confidence ?? 'low',
          reason_codes: [...(dayPlan?.reason_codes ?? [])]
        }
      : undefined,
    user_context: input.baseline_mode ? { baseline_mode: input.baseline_mode } : undefined
  };
}

function headline(label: DailyReadinessLabel): string {
  if (label === 'primed') return 'Primed for stronger output';
  if (label === 'steady') return 'A steady day';
  if (label === 'conserve') return 'Protect your capacity';
  if (label === 'restore') return 'Recovery leads today';
  return 'Your system is still calibrating';
}

function sourceLabel(
  readiness: DailyReadinessResult,
  sources: MorningBriefingComposerInput['sources']
): MorningBriefingSource {
  if (readiness.missing_data.length >= 3) return 'calibrating';
  const values = Object.values(sources ?? {});
  if (values.includes('demo')) return 'demo';
  if (values.includes('logged')) return 'logged';
  return 'calibrating';
}

export function composeMorningBriefing(input: MorningBriefingComposerInput): MorningBriefing {
  const readiness = generateDailyReadiness(readinessInput(input));
  return {
    date: input.date.slice(0, 10),
    readiness,
    headline: headline(readiness.label),
    subheadline: readiness.summary,
    today_focus: readinessFocusLabel(readiness.primary_focus),
    top_actions: readiness.recommended_actions.slice(0, 3),
    driver_cards: readiness.driver_cards.map((driver) => ({
      ...driver,
      reason_codes: [...driver.reason_codes]
    })),
    confidence: readiness.confidence,
    source_label: sourceLabel(readiness, input.sources)
  };
}

export function morningBriefingToDashboardHero(briefing: MorningBriefing): MorningBriefingDashboardHero {
  return {
    score: briefing.readiness.score,
    label: briefing.headline,
    summary: briefing.subheadline,
    focus: briefing.today_focus,
    top_action: briefing.top_actions[0]?.title ?? 'Keep the day steady as signals arrive.',
    confidence: briefing.confidence,
    source_label: briefing.source_label
  };
}

export function readinessToDayPlanInput(
  readiness: DailyReadinessResult
): NonNullable<GenerateDayPlanInput['readiness']> {
  const mode = readiness.mode === 'professional_guidance' ? 'maintain' : readiness.mode;
  return {
    score: readiness.score,
    mode,
    confidence: readiness.confidence,
    reason_codes: [...readiness.reason_codes]
  };
}
