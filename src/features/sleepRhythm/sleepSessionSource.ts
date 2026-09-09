import type { SleepNeedEstimate, SleepSession } from '../../engines/circadian';
import { getLocalSleepWindowSessions, saveLocalSleepWindowSession } from './localSleepWindowStore';
import {
  getActiveSleepNeedEstimate,
  getRecentSleepSessions,
  saveSleepSession,
  type SleepRhythmSupabaseClient,
  type SleepSessionPersistenceInput
} from './persistence';

type Source = {
  mode: 'demo' | 'account';
  userId: string | undefined;
  client: SleepRhythmSupabaseClient;
};

function accountId(source: Source): string {
  if (!source.userId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(source.userId)) {
    throw new Error('An active account is required to access saved sleep.');
  }
  return source.userId;
}

/** Empty history stays empty. Account outages never fall back to device demo data. */
export async function loadSleepHistory(source: Source, limit = 21): Promise<{
  sessions: SleepSession[];
  sleepNeed: SleepNeedEstimate | null;
}> {
  if (source.mode === 'demo') {
    return { sessions: (await getLocalSleepWindowSessions()).slice(0, limit), sleepNeed: null };
  }
  const userId = accountId(source);
  const [sessions, estimate] = await Promise.all([
    getRecentSleepSessions(source.client, userId, limit),
    getActiveSleepNeedEstimate(source.client, userId)
  ]);
  return {
    sessions,
    sleepNeed: estimate ? {
      minutes: estimate.minutes,
      confidence: estimate.confidence,
      basis: [...estimate.basis],
      updated_at: estimate.updated_at
    } : null
  };
}

export async function saveSleepForSource(source: Source, session: SleepSessionPersistenceInput): Promise<void> {
  if (source.mode === 'demo') {
    await saveLocalSleepWindowSession(session);
  } else {
    await saveSleepSession(source.client, accountId(source), session);
  }
}
