import type { CircadianBriefing, DataConfidence, SleepSession, TimeWindow } from '../../engines/circadian';
import {
  calculateFoodQuality,
  calculateFoodResponse,
  calculateNutrientSummary,
  generateNutritionReadinessSignal,
  type MealLog,
  type NutritionReasonCode,
  type NutritionTargets
} from '../../engines/nutrition';

export type DashboardReadinessState = 'primed' | 'steady' | 'maintain' | 'recover';
export type DashboardActionId = 'log_meal' | 'start_workout' | 'log_sleep';

export type DashboardNutritionSummary = {
  meal_count: number;
  calorie_label: string;
  protein_label: string;
  food_quality_label: string;
  food_response_label: string;
  readiness_support_label: string;
  confidence: DataConfidence;
  source_label: 'logged' | 'demo' | 'calibrating';
  next_action: string;
  reason_codes: string[];
  readiness_adjustment: number;
};

export type DashboardSignalTile = {
  id: 'sleep_quality' | 'recovery' | 'training_load';
  label: string;
  value: string;
  status: string;
  confidence: DataConfidence;
  source: string;
  icon: string;
};

export type DashboardModel = {
  date: string;
  demoMode: boolean;
  readiness: {
    score: number;
    state: DashboardReadinessState;
    label: string;
    summary: string;
    confidence: DataConfidence;
    reason_codes: string[];
  };
  drivers: DashboardSignalTile[];
  focus: {
    title: string;
    body: string;
    tags: string[];
    why: string[];
    directive: 'stronger_output' | 'controlled_output' | 'recovery_led';
  };
  training: {
    title: string;
    subtitle: string;
    weeklyProgress: { completed: number; target: number };
    cta: string;
    enabled: boolean;
    source: string;
  };
  nutrition: {
    calories: { current: number; target: number };
    protein: { current: number; target: number };
    mealsLogged: { current: number; target: number };
    foodResponse: string;
    summary: DashboardNutritionSummary;
    cta: string;
    enabled: boolean;
    source: string;
  };
  sleepRhythm: {
    duration: string;
    quality: string;
    sleepDebt: string;
    rhythmPhase: string;
    bedtimeTarget: string;
    windDownStart: string;
    cta: string;
    source: string;
  };
  quickActions: Array<{
    id: DashboardActionId;
    label: string;
    subtitle: string;
    enabled: boolean;
    route: '/food' | '/movement' | '/rhythm';
  }>;
};

export type ComposeDashboardModelParams = {
  date: string;
  circadianBriefing?: CircadianBriefing | null;
  recentSleepSession?: SleepSession | null;
  nutritionMeals?: MealLog[];
  nutritionTargets?: NutritionTargets | null;
  nutritionDemoMode?: boolean;
  demoMode?: boolean;
};

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function formatMinutes(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined) return 'Calibrating';
  const sign = minutes < 0 ? '-' : '';
  const absolute = Math.abs(minutes);
  return `${sign}${Math.floor(absolute / 60)}h ${absolute % 60}m`;
}

function formatTime(value: string | null | undefined): string {
  if (!value) return 'Calibrating';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Calibrating';
  const hours = date.getUTCHours();
  const minutes = date.getUTCMinutes();
  const hour12 = hours % 12 || 12;
  const suffix = hours >= 12 ? 'PM' : 'AM';
  return `${hour12}:${String(minutes).padStart(2, '0')} ${suffix}`;
}

function formatWindow(window: TimeWindow | undefined): string {
  if (!window) return 'Calibrating';
  return `${formatTime(window.start_at)} - ${formatTime(window.end_at)}`;
}

function phaseLabel(label: string | null | undefined): string {
  const labels: Record<string, string> = {
    wake_grogginess: 'Wake ramp',
    rising: 'Rising',
    morning_peak: 'Morning peak',
    afternoon_dip: 'Recovery dip',
    second_peak: 'Second peak',
    wind_down: 'Wind-down',
    sleep_window: 'Sleep window',
    unknown: 'Calibrating'
  };
  return labels[label ?? 'unknown'] ?? 'Calibrating';
}

function confidenceFromSignals(hasCircadian: boolean, hasSleep: boolean, sourceConfidence?: DataConfidence): DataConfidence {
  if (!hasCircadian || !hasSleep) return 'low';
  if (sourceConfidence === 'high') return 'high';
  return 'medium';
}

function formatNutritionAmount(value: number | null | undefined, suffix = ''): string {
  if (typeof value !== 'number') return 'Calibrating';
  return `${Math.round(value)}${suffix}`;
}

function formatNutritionTarget(value: number | null | undefined, suffix = ''): string | null {
  if (typeof value !== 'number' || value <= 0) return null;
  return `${Math.round(value)}${suffix}`;
}

function sentenceLabel(value: string): string {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function uniqueReasons(reasons: Array<string | NutritionReasonCode>): string[] {
  return [...new Set(reasons)];
}

function smallNutritionAdjustment(value: number, hasMeals: boolean): number {
  if (!hasMeals) return 0;
  return Math.max(-3, Math.min(2, Math.round(value)));
}

export function composeDashboardNutritionSummary(params: {
  date: string;
  meals?: MealLog[];
  targets?: NutritionTargets | null;
  demoMode?: boolean;
}): DashboardNutritionSummary {
  const meals = params.meals ?? [];
  const nutrientSummary = calculateNutrientSummary({
    date: params.date,
    meals,
    targets: params.targets ?? null
  });
  const foodQuality = calculateFoodQuality({
    date: params.date,
    meals,
    nutrientSummary
  });
  const foodResponse = calculateFoodResponse({
    date: params.date,
    meals
  });
  const readinessSignal = generateNutritionReadinessSignal({
    date: params.date,
    nutrientSummary,
    foodQuality,
    foodResponse
  });
  const hasMeals = nutrientSummary.meal_count > 0;
  const calorieTarget = formatNutritionTarget(params.targets?.calories_target);
  const proteinTarget = formatNutritionTarget(params.targets?.protein_g_target, 'g');
  const calorieCurrent = formatNutritionAmount(nutrientSummary.calories);
  const proteinCurrent = formatNutritionAmount(nutrientSummary.protein_g, 'g');

  if (!hasMeals) {
    return {
      meal_count: 0,
      calorie_label: 'Calibrating',
      protein_label: 'Calibrating',
      food_quality_label: 'Calibrating',
      food_response_label: 'Calibrating',
      readiness_support_label: 'Fueling is still calibrating.',
      confidence: 'low',
      source_label: params.demoMode ? 'demo' : 'calibrating',
      next_action: 'Log a meal to improve today’s fueling signal.',
      reason_codes: uniqueReasons([
        ...nutrientSummary.reason_codes,
        ...foodQuality.reason_codes,
        ...foodResponse.reason_codes,
        ...readinessSignal.reason_codes
      ]),
      readiness_adjustment: 0
    };
  }

  return {
    meal_count: nutrientSummary.meal_count,
    calorie_label: calorieTarget ? `${calorieCurrent} / ${calorieTarget}` : calorieCurrent,
    protein_label: proteinTarget ? `${proteinCurrent} / ${proteinTarget}` : proteinCurrent,
    food_quality_label: sentenceLabel(foodQuality.label),
    food_response_label: sentenceLabel(foodResponse.label),
    readiness_support_label: readinessSignal.summary,
    confidence: readinessSignal.confidence,
    source_label: params.demoMode || meals.some((meal) => meal.source === 'demo') ? 'demo' : 'logged',
    next_action:
      foodResponse.label === 'unknown'
        ? 'Rate how you felt after eating.'
        : readinessSignal.label === 'watch'
          ? 'Keep the next meal simple and steady.'
          : 'Based on logged meals.',
    reason_codes: uniqueReasons([
      ...nutrientSummary.reason_codes,
      ...foodQuality.reason_codes,
      ...foodResponse.reason_codes,
      ...readinessSignal.reason_codes
    ]),
    readiness_adjustment: smallNutritionAdjustment(readinessSignal.score_adjustment, hasMeals)
  };
}

function readinessLabel(score: number): { state: DashboardReadinessState; label: string; summary: string } {
  if (score >= 85) {
    return {
      state: 'primed',
      label: "You're primed",
      summary: 'Your signals support a stronger day.'
    };
  }

  if (score >= 70) {
    return {
      state: 'steady',
      label: 'Steady output',
      summary: 'Your rhythm supports steady output today.'
    };
  }

  if (score >= 55) {
    return {
      state: 'maintain',
      label: 'Maintain today',
      summary: 'Recovery signals suggest a controlled pace.'
    };
  }

  return {
    state: 'recover',
    label: 'Recover today',
    summary: 'Your system is asking for restoration today.'
  };
}

function scoreReadiness(briefing: CircadianBriefing | null | undefined, session: SleepSession | null | undefined): number {
  let score = 72;
  const sleepMinutes = session?.duration_minutes ?? null;
  const debtAverage = briefing?.sleep_debt_7_day.nightly_average_debt_minutes ?? null;

  if (sleepMinutes === null) score -= 10;
  else if (sleepMinutes >= 450) score += 9;
  else if (sleepMinutes >= 420) score += 5;
  else if (sleepMinutes < 360) score -= 14;

  if (debtAverage === null) score -= 8;
  else if (debtAverage >= 120) score -= 18;
  else if (debtAverage >= 60) score -= 10;
  else if (debtAverage <= 30) score += 5;

  const phase = briefing?.current_phase ?? 'unknown';
  if (phase === 'morning_peak' || phase === 'second_peak') score += 6;
  if (phase === 'rising') score += 3;
  if (phase === 'afternoon_dip') score -= 4;
  if (phase === 'wind_down' || phase === 'sleep_window') score -= 10;

  return clampScore(score);
}

function focusForSignals(score: number, briefing: CircadianBriefing | null | undefined, sleepMinutes: number | null): DashboardModel['focus'] {
  const debtAverage = briefing?.sleep_debt_7_day.nightly_average_debt_minutes ?? null;
  const deepWorkWindow = briefing?.rhythm_plan.deep_work_windows[0];
  const bestWindow = formatWindow(deepWorkWindow);
  const favorablePhase = ['rising', 'morning_peak', 'second_peak'].includes(briefing?.current_phase ?? '');
  const why: string[] = [];

  if (sleepMinutes !== null && sleepMinutes >= 420) why.push('Strong sleep duration');
  if (debtAverage !== null && debtAverage < 60) why.push('Recovery is steady');
  if (debtAverage !== null && debtAverage >= 60) why.push('Sleep debt is asking for control');
  why.push('Training load is light');
  if (favorablePhase) why.push('Favorable rhythm phase');
  if (why.length < 3) why.push('More signals are calibrating');

  if (debtAverage !== null && debtAverage >= 120 || score < 55) {
    return {
      title: 'Recovery-led day',
      body: 'Lower output and protect your wind-down window tonight.',
      tags: ['Priority: Rhythm', `Reset window: ${formatWindow(briefing?.rhythm_plan.breathing_windows[0])}`],
      why,
      directive: 'recovery_led'
    };
  }

  if (debtAverage !== null && debtAverage >= 60 || score < 80) {
    return {
      title: 'Controlled output',
      body: 'Keep strain measured while recovery catches up.',
      tags: ['Priority: Recovery', `Best window: ${bestWindow}`],
      why,
      directive: 'controlled_output'
    };
  }

  return {
    title: 'High-output window',
    body: 'Your rhythm and recovery signals support focused work before early afternoon.',
    tags: ['Priority: Training', `Best window: ${bestWindow}`],
    why,
    directive: 'stronger_output'
  };
}

export function composeDashboardModel(params: ComposeDashboardModelParams): DashboardModel {
  const briefing = params.circadianBriefing ?? null;
  const session = params.recentSleepSession ?? null;
  const sleepMinutes = session?.duration_minutes ?? null;
  const nutritionSummary = composeDashboardNutritionSummary({
    date: params.date,
    meals: params.nutritionMeals,
    targets: params.nutritionTargets,
    demoMode: params.nutritionDemoMode
  });
  const score = clampScore(scoreReadiness(briefing, session) + nutritionSummary.readiness_adjustment);
  const label = readinessLabel(score);
  const confidence = confidenceFromSignals(Boolean(briefing), Boolean(session), briefing?.confidence);
  const debtAverage = briefing?.sleep_debt_7_day.nightly_average_debt_minutes ?? null;
  const reasonCodes = [
    briefing ? 'rhythm_estimate_available' : 'rhythm_signal_missing',
    session ? 'sleep_signal_available' : 'sleep_signal_missing',
    debtAverage !== null && debtAverage >= 60 ? 'sleep_debt_elevated' : 'sleep_debt_in_range',
    nutritionSummary.meal_count > 0 ? 'nutrition_signal_available' : 'nutrition_signal_calibrating'
  ];

  return {
    date: params.date.slice(0, 10),
    demoMode: Boolean(params.demoMode),
    readiness: {
      score,
      state: label.state,
      label: label.label,
      summary: label.summary,
      confidence,
      reason_codes: reasonCodes
    },
    drivers: [
      {
        id: 'sleep_quality',
        label: 'Sleep Quality',
        value: formatMinutes(sleepMinutes),
        status: sleepMinutes !== null && sleepMinutes >= 420 ? 'Good' : 'Calibrating',
        confidence: session?.source_confidence ?? 'low',
        source: session ? (params.demoMode ? 'Demo' : 'Sleep log') : 'Calibrating',
        icon: 'moon-outline'
      },
      {
        id: 'recovery',
        label: 'Recovery',
        value: debtAverage !== null && debtAverage >= 60 ? 'Measured' : 'Steady',
        status: debtAverage === null ? 'Calibrating' : debtAverage >= 60 ? 'Control strain' : 'Steady',
        confidence,
        source: 'No live HRV data',
        icon: 'heart-outline'
      },
      {
        id: 'training_load',
        label: 'Training Load',
        value: 'Light',
        status: 'Calibrating',
        confidence: 'low',
        source: 'Demo',
        icon: 'barbell-outline'
      }
    ],
    focus: focusForSignals(score, briefing, sleepMinutes),
    training: {
      title: 'Movement capacity',
      subtitle: 'Training plan is calibrating',
      weeklyProgress: { completed: 0, target: 0 },
      cta: 'Start Session',
      enabled: true,
      source: 'Demo'
    },
    nutrition: {
      calories: { current: 0, target: params.nutritionTargets?.calories_target ?? 0 },
      protein: { current: 0, target: params.nutritionTargets?.protein_g_target ?? 0 },
      mealsLogged: { current: nutritionSummary.meal_count, target: 3 },
      foodResponse: nutritionSummary.readiness_support_label,
      summary: nutritionSummary,
      cta: 'Log Meal',
      enabled: true,
      source: sentenceLabel(nutritionSummary.source_label)
    },
    sleepRhythm: {
      duration: formatMinutes(sleepMinutes),
      quality: session?.sleep_quality ? `Good ${session.sleep_quality}` : 'Calibrating',
      sleepDebt: formatMinutes(debtAverage),
      rhythmPhase: phaseLabel(briefing?.current_phase),
      bedtimeTarget: formatTime(briefing?.target_bedtime),
      windDownStart: formatTime(briefing?.rhythm_plan.wind_down_start),
      cta: 'View Rhythm',
      source: session ? (params.demoMode ? 'Demo' : 'Sleep log') : 'Calibrating'
    },
    quickActions: [
      { id: 'log_meal', label: 'Log Meal', subtitle: 'Quick add', enabled: true, route: '/food' },
      { id: 'start_workout', label: 'Start Workout', subtitle: 'Start session', enabled: true, route: '/movement' },
      { id: 'log_sleep', label: 'Log Sleep', subtitle: 'Add sleep', enabled: true, route: '/rhythm' }
    ]
  };
}
