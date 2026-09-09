import type { DataConfidence } from '../../types/common';

export type { DataConfidence };

export type SleepDataSource =
  | 'manual'
  | 'estimated'
  | 'demo'
  | 'phone_motion'
  | 'phone_activity'
  | 'healthkit'
  | 'health_connect'
  | 'wearable'
  | 'user_corrected';

export type SleepIntervalState = 'asleep' | 'awake';

export type SleepInterval = {
  id: string;
  state: SleepIntervalState;
  start_at: string;
  end_at: string;
};

export type SleepSession = {
  id?: string;
  user_id?: string;
  date: string;
  sleep_start_at: string | null;
  sleep_end_at: string | null;
  duration_minutes: number | null;
  sleep_quality?: number | null;
  source: SleepDataSource;
  source_confidence: DataConfidence;
  corrected_by_user?: boolean;
  confirmed_by_user?: boolean;
  timezone?: string | null;
  sleep_intervals?: SleepInterval[];
  reason_codes: string[];
  created_at: string;
};

export type SleepNeedEstimate = {
  minutes: number;
  confidence: DataConfidence;
  basis: Array<'onboarding' | 'default' | 'sleep_history' | 'manual_adjustment'>;
  updated_at: string;
};

export type SleepDebtNight = {
  date: string;
  sleep_minutes: number | null;
  sleep_need_minutes: number;
  debt_minutes: number | null;
  repayment_minutes: number | null;
  weight: number;
  source_confidence: DataConfidence;
};

export type SleepDebtSummary = {
  date: string;
  rolling_window_days: 7 | 14;
  total_sleep_debt_minutes: number | null;
  weighted_sleep_debt_minutes: number | null;
  nightly_average_debt_minutes: number | null;
  nights: SleepDebtNight[];
  confidence: DataConfidence;
  reason_codes: string[];
};

export type CircadianPhase =
  | 'wake_grogginess'
  | 'rising'
  | 'morning_peak'
  | 'afternoon_dip'
  | 'second_peak'
  | 'wind_down'
  | 'sleep_window'
  | 'unknown';

export type CircadianEnergyPoint = {
  time: string;
  estimated_energy: number;
  label: string;
};

export type EnergyZoneLevel = 'high' | 'moderate' | 'low';

export type EnergyZone = {
  start_at: string;
  end_at: string;
  level: EnergyZoneLevel;
};

export type EnergyExtreme = {
  type: 'peak' | 'low';
  time: string;
  energy: number;
};

export type TimeWindow = {
  start_at: string;
  end_at: string;
  label: string;
};

export type RhythmPlan = {
  deep_work_windows: TimeWindow[];
  best_exercise_windows: TimeWindow[];
  best_walk_windows: TimeWindow[];
  nap_windows: TimeWindow[];
  breathing_windows: TimeWindow[];
  caffeine_cutoff: string | null;
  wind_down_start: string | null;
  target_bedtime: string | null;
  reason_codes: string[];
};

export type CircadianBriefing = {
  date: string;
  timezone: string;
  wake_time: string | null;
  target_bedtime: string | null;
  current_phase: CircadianPhase;
  energy_curve: CircadianEnergyPoint[];
  energy_zones: EnergyZone[];
  energy_extrema: EnergyExtreme[];
  rhythm_plan: RhythmPlan;
  sleep_debt_7_day: SleepDebtSummary;
  sleep_debt_14_day: SleepDebtSummary;
  confidence: DataConfidence;
  reason_codes: string[];
  source_summary: {
    sleep_source: SleepDataSource;
    source_confidence: DataConfidence;
  };
};

export type DailySignalNeed =
  | 'sleep_quality'
  | 'bedtime'
  | 'wake_time'
  | 'stress'
  | 'soreness'
  | 'pain_or_limitation'
  | 'digestion'
  | 'hydration'
  | 'fueling'
  | 'time_available';

export type MissingDailySignalsResult = {
  signals_to_ask: DailySignalNeed[];
  signals_already_known: DailySignalNeed[];
  reason_codes: string[];
};
