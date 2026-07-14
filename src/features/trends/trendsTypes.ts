import type { TrendsRangeDays, TrendsSummary } from '../../engines/trends';

export type TrendsScreenModel = {
  range_days: TrendsRangeDays;
  summary: TrendsSummary;
  load_error: boolean;
};

export type LoadTrendsScreenModelInput = {
  today: string;
  range_days: TrendsRangeDays;
  user_id?: string | null;
  is_demo_mode: boolean;
  supabase_client?: unknown;
};
