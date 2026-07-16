import type { CircadianBriefing } from '../../engines/circadian';
import type { DayPlanResult } from '../../engines/dayPlan';
import type { MovementReadinessSignal } from '../../engines/movement';
import type { DailyReadinessResult } from '../../engines/readiness';
import type { DailyProtocol, ProtocolActionStatus } from '../../engines/protocol';
import type { SafetyReviewInput, SafetyReviewResult } from '../../engines/safety';
import type { DashboardNutritionSummary } from '../dashboard/dashboardComposer';

export type DailyProtocolSource = 'logged' | 'demo' | 'calibrating';

/**
 * The already-computed engine outputs the composer maps into protocol input.
 * Every field is optional so sparse/signed-out states never crash.
 */
export type DailyProtocolComposerInput = {
  date: string;
  timezone?: string | null;
  readiness?: DailyReadinessResult | null;
  circadian?: CircadianBriefing | null;
  nutrition?: DashboardNutritionSummary | null;
  movement?: {
    signal?: MovementReadinessSignal | null;
    pain_present?: boolean | null;
    soreness_level?: number | null;
  };
  dayPlan?: DayPlanResult | null;
  baseline?: {
    baseline_mode?: DailyReadinessResult['mode'] | null;
    primary_focus?: DailyReadinessResult['primary_focus'] | null;
    confidence?: DailyReadinessResult['confidence'] | null;
  } | null;
  mindLifeLoad?: SafetyReviewInput['mindLifeLoad'];
  userReportedFlags?: SafetyReviewInput['userReportedFlags'];
  source?: DailyProtocolSource;
};

export type DailyProtocolScreenModel = {
  protocol: DailyProtocol;
  safety: SafetyReviewResult;
  source_label: DailyProtocolSource;
  is_demo: boolean;
  generated_at: string;
};

export type { ProtocolActionStatus };
