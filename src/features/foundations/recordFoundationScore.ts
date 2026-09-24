import type { FoundationDomain, FoundationScore } from '../../engines/foundations/foundationTypes';
import { saveFoundationScore, type FoundationScoreClient } from './foundationScorePersistence';
import { saveLocalDemoFoundationScore } from './localDemoFoundationStore';

/**
 * Keep one day's reading of one pillar.
 *
 * The pillars were computed fresh on every screen and then dropped, so nothing could say
 * how movement or nourishment had gone over a week — only nutrition had any history, and
 * only because meals happen to be stored. Recording the reading is what gives the rest of
 * the app a past to average.
 *
 * A pillar that withheld its score is still worth keeping: the day is then on record as one
 * where too little was known, which is different from a day that went badly and different
 * again from a day with no entry at all.
 *
 * Recording is a side effect of looking at a screen, so it never interrupts one. A failure
 * is swallowed deliberately — losing a day of history is not worth an error in front of
 * somebody who only opened the app to log lunch.
 */
export async function recordFoundationScore(params: {
  domain: FoundationDomain;
  score: FoundationScore;
  userId: string | null;
  demo: boolean;
  client: FoundationScoreClient | null;
}): Promise<void> {
  try {
    if (params.demo || !params.userId || !params.client) {
      await saveLocalDemoFoundationScore(params.domain, params.score);
      return;
    }
    await saveFoundationScore(params.client, params.userId, params.domain, params.score);
  } catch {
    /* History is best-effort. The screen the person is looking at does not depend on it. */
  }
}
