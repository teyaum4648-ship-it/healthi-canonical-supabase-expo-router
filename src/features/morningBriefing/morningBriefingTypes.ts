import type { CircadianBriefing, SleepSession } from '../../engines/circadian';
import type { DayPlanResult } from '../../engines/dayPlan';
import type { MovementReadinessSignal, MovementSummary } from '../../engines/movement';
import type {
  DailyReadinessAction,
  DailyReadinessDriver,
  DailyReadinessMode,
  DailyReadinessResult,
  DataConfidence
} from '../../engines/readiness';
import type { DashboardNutritionSummary } from '../dashboard/dashboardComposer';

export type MorningBriefingSource = 'logged' | 'demo' | 'calibrating';

export type MorningBriefingComposerInput = {
  date: string;
  rhythm?: {
    briefing?: CircadianBriefing | null;
    recent_sleep_session?: SleepSession | null;
  };
  nutrition?: DashboardNutritionSummary | null;
  movement?: {
    summary?: MovementSummary | null;
    signal?: MovementReadinessSignal | null;
  };
  schedule?: {
    block_count?: number;
    day_plan?: DayPlanResult | null;
    next_protected_block?: string | null;
  };
  sources?: Partial<Record<'rhythm' | 'nutrition' | 'movement' | 'schedule', MorningBriefingSource>>;
  baseline_mode?: DailyReadinessMode;
};

export type MorningBriefing = {
  date: string;
  readiness: DailyReadinessResult;
  headline: string;
  subheadline: string;
  today_focus: string;
  top_actions: DailyReadinessAction[];
  driver_cards: DailyReadinessDriver[];
  confidence: DataConfidence;
  source_label: MorningBriefingSource;
};

export type MorningBriefingDashboardHero = {
  score: number;
  label: string;
  summary: string;
  focus: string;
  top_action: string;
  confidence: DataConfidence;
  source_label: MorningBriefingSource;
};
