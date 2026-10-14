import type { CircadianBriefing, SleepSession } from '../../engines/circadian';
import type { DayPlanResult } from '../../engines/dayPlan';
import type { MovementReadinessSignal, MovementSummary } from '../../engines/movement';
import type {
  DailyReadinessAction,
  DailyReadinessDriver,
  DailyReadinessMode,
  DailyReadinessResult,
  DataConfidence,
  GenerateDailyReadinessInput
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
  /** Water logged today, and how it paces against the day so far (1 = on pace). */
  hydration?: { ml_today: number; pace: number | null } | null;
  /** Today's Mood tab and check-in entries, without sleep. */
  mind?: GenerateDailyReadinessInput['mind'] | null;
  sources?: Partial<Record<'rhythm' | 'nutrition' | 'movement' | 'schedule' | 'hydration' | 'mind', MorningBriefingSource>>;
  baseline_mode?: DailyReadinessMode;
  /** The person's own starting point from their load check, when they have one. */
  personal_baseline?: NonNullable<GenerateDailyReadinessInput['user_context']>['personal_baseline'];
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
