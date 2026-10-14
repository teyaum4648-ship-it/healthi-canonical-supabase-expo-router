import { observeLoadCheck, type ObservedLoadAnswers } from '../../engines/loadCheck';
import { supabase } from '../../lib/supabase';
import { getLocalDemoNutritionState } from '../nutrition/localDemoNutritionStore';
import { getRecentMealLogs, type NutritionSupabaseClient } from '../nutrition/persistence';
import { localCaffeineStore } from '../sleepRhythm/caffeineLog';
import { localMorningReportStore } from '../sleepRhythm/morningReportStore';
import type { SleepRhythmSupabaseClient } from '../sleepRhythm/persistence';
import { loadSleepHistory } from '../sleepRhythm/sleepSessionSource';

const isUuid = (value: string | undefined): value is string =>
  Boolean(value?.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i));

/**
 * Reads the logs the observable questions come from. Each source failing on its own just
 * leaves its question to the person.
 */
export async function loadObservedAnswers(params: { mode: 'demo' | 'account'; userId: string | undefined; scope: string; today: string }): Promise<ObservedLoadAnswers> {
  const [sleep, meals, caffeine, mornings] = await Promise.all([
    loadSleepHistory({ mode: params.mode, userId: params.userId, client: supabase as unknown as SleepRhythmSupabaseClient }, 21)
      .then((history) => history.sessions).catch(() => []),
    (isUuid(params.userId)
      ? getRecentMealLogs(supabase as unknown as NutritionSupabaseClient, params.userId, 150)
      : getLocalDemoNutritionState().then((state) => state.mealLogs)
    ).then((rows) => rows.map((row) => ({ logged_at: row.logged_at }))).catch(() => []),
    localCaffeineStore.read(params.scope).catch(() => []),
    localMorningReportStore.read(params.scope).catch(() => [])
  ]);
  return observeLoadCheck({ today: params.today, sleepSessions: sleep, meals, caffeine, mornings });
}
