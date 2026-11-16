import type { CircadianBriefing } from '../../engines/circadian';
import type { GenerateDayPlanInput } from '../../engines/dayPlan';

/**
 * The rhythm input the day plan is built from: the briefing's deep-work and exercise
 * windows, caffeine cutoff and wind-down. Shared by /plan and the "Your day" strand on
 * Today, so both place the plan from the same windows.
 */
export function briefingToDayPlanRhythm(briefing: CircadianBriefing | null): GenerateDayPlanInput['rhythm'] {
  if (!briefing || !briefing.wake_time) return undefined;
  const plan = briefing.rhythm_plan;
  const deepWork = plan.deep_work_windows[0];
  const exercise = plan.best_exercise_windows[0];
  return {
    energy_windows: plan.deep_work_windows.map((window) => ({
      start: window.start_at,
      end: window.end_at,
      label: window.label,
      intensity: 'high' as const
    })),
    deep_work_window: deepWork ? { start: deepWork.start_at, end: deepWork.end_at } : null,
    exercise_window: exercise ? { start: exercise.start_at, end: exercise.end_at } : null,
    caffeine_cutoff: plan.caffeine_cutoff,
    wind_down_start: plan.wind_down_start
  };
}
