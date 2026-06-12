import type { CircadianBriefing, DataConfidence, SleepSession, TimeWindow } from '../../engines/circadian';

export type DashboardReadinessState = 'primed' | 'steady' | 'maintain' | 'recover';
export type DashboardActionId = 'log_meal' | 'start_workout' | 'log_sleep';

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
  const score = scoreReadiness(briefing, session);
  const label = readinessLabel(score);
  const confidence = confidenceFromSignals(Boolean(briefing), Boolean(session), briefing?.confidence);
  const debtAverage = briefing?.sleep_debt_7_day.nightly_average_debt_minutes ?? null;
  const reasonCodes = [
    briefing ? 'rhythm_estimate_available' : 'rhythm_signal_missing',
    session ? 'sleep_signal_available' : 'sleep_signal_missing',
    debtAverage !== null && debtAverage >= 60 ? 'sleep_debt_elevated' : 'sleep_debt_in_range'
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
      calories: { current: 0, target: 0 },
      protein: { current: 0, target: 0 },
      mealsLogged: { current: 0, target: 0 },
      foodResponse: 'Food response will improve as meals are logged.',
      cta: 'Log Meal',
      enabled: true,
      source: 'Calibrating'
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
