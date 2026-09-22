import { composeFoundationScore } from '../foundations/composeFoundationScore';
import type { FoundationContributor, FoundationScore } from '../foundations/foundationTypes';
import type { MovementSummary } from './movementTypes';

/**
 * Where someone's movement actually stands, and why.
 *
 * The app already had a readiness signal — what to do today — and a weekly summary, but
 * nothing that said whether movement as a whole is in good shape. Those are different
 * questions: a week of four easy sessions reads as "ready to build" every morning while
 * nothing is getting stronger.
 *
 * Six terms, weighted and renormalised over whatever had data. The one that matters most
 * is progression, because it is the only one that distinguishes training from attendance.
 *
 * Crucially, a stalled term is not always a movement problem. Strength is built during
 * recovery and out of what someone ate, so when progression is the limiter this looks
 * across domains before blaming the training — which is the difference between "your
 * progression is stagnant" and "your progression is stagnant and you are three hours down
 * on sleep, which is when the adapting would happen".
 */

/** Sessions in a week that count as a full week of movement. */
const SESSION_TARGET = 4;
/** Minutes in a week that count as full. General activity guidance, not a prescription. */
const MINUTE_TARGET = 150;
/** Fewer rest days than this in a week and the body is not being given room. */
const MIN_REST_DAYS = 1;

export type ProgressionTally = {
  progressing: number;
  holding: number;
  regressing: number;
  /** Lifts with too little history to read. Excluded rather than counted against. */
  unknown: number;
};

/**
 * Context from the other pillars, used only to explain a movement limiter — never to
 * change the movement score itself. A pillar that moved because of another pillar's data
 * would double-count the same day.
 */
export type MovementCrossDomainContext = {
  sleep_debt_hours?: number | null;
  nourishment_score?: number | null;
  recovery_score?: number | null;
};

function ratio(value: number, target: number): number {
  return Math.min(1, Math.max(0, value / target));
}

function progressionTerm(tally: ProgressionTally | null | undefined): { value: number | null; detail: string } {
  if (!tally) return { value: null, detail: 'No lifts logged with enough history to read' };
  const read = tally.progressing + tally.holding + tally.regressing;
  if (read === 0) return { value: null, detail: 'No lifts logged with enough history to read' };

  // Holding is not failing — a repeated session at the same load is maintenance, and
  // deliberate holds are common. Regressing is what costs.
  const value = (tally.progressing + tally.holding * 0.5) / read;
  const detail = tally.progressing === 0
    ? `None of your ${read} tracked lifts moved forward`
    : `${tally.progressing} of ${read} tracked lifts moved forward`;
  return { value, detail };
}

/**
 * Why a limiter is a limiter, reaching into other domains where the cause plausibly lives.
 *
 * Only ever an explanation. The sentence names what the other pillars were carrying at the
 * time; it does not assert that one caused the other, because this app cannot know that.
 */
export function explainMovementLimiter(
  limiterId: string,
  context: MovementCrossDomainContext
): string | null {
  const debt = context.sleep_debt_hours;
  const nourishment = context.nourishment_score;

  if (limiterId === 'progression') {
    if (typeof debt === 'number' && debt >= 2) {
      return `Strength is built between sessions, and you are carrying about ${Math.round(debt)} hours of sleep debt — that is when the adapting would be happening.`;
    }
    if (typeof nourishment === 'number' && nourishment < 55) {
      return 'Your food has been running short this week, so there may not be much to build with.';
    }
    return 'Loads have not moved. That may be the programme rather than you — the same weight for weeks is a signal to change something, not to push harder.';
  }

  if (limiterId === 'recovery_balance') {
    return 'No rest day this week. Training without one tends to cost more than it adds.';
  }

  if (limiterId === 'consistency' && typeof debt === 'number' && debt >= 3) {
    return 'Sessions have been sparse, and a sleep debt this size makes starting one harder.';
  }

  return null;
}

export function calculateMovementScore(params: {
  date: string;
  summary: MovementSummary;
  progression?: ProgressionTally | null;
  /** Days in the last seven with no session logged. */
  restDays7d?: number | null;
  context?: MovementCrossDomainContext;
}): FoundationScore & { limiter_causes: string[] } {
  const { summary } = params;
  const context = params.context ?? {};
  const logged = summary.workout_count > 0 || summary.total_minutes > 0;

  const progression = progressionTerm(params.progression);

  const disciplines = [
    summary.strength_session_count > 0,
    summary.cardio_session_count > 0,
    summary.mobility_recovery_session_count > 0
  ].filter(Boolean).length;

  const contributors: FoundationContributor[] = [
    {
      id: 'consistency',
      label: 'Consistency',
      weight: 0.25,
      value: logged ? ratio(summary.workout_count, SESSION_TARGET) : null,
      detail: logged
        ? `${summary.workout_count} of ${SESSION_TARGET} sessions this week`
        : 'Nothing logged in the last seven days'
    },
    {
      id: 'volume',
      label: 'Time moving',
      weight: 0.15,
      value: logged ? ratio(summary.total_minutes, MINUTE_TARGET) : null,
      detail: logged
        ? `${summary.total_minutes} of ${MINUTE_TARGET} minutes this week`
        : 'Nothing logged in the last seven days'
    },
    {
      id: 'progression',
      label: 'Progression',
      weight: 0.25,
      value: progression.value,
      detail: progression.detail
    },
    {
      id: 'variety',
      label: 'Variety',
      weight: 0.15,
      value: logged ? disciplines / 3 : null,
      detail: logged
        ? `${disciplines} of strength, cardio and mobility this week`
        : 'Nothing logged in the last seven days'
    },
    {
      id: 'mobility',
      label: 'Mobility',
      weight: 0.1,
      value: logged ? Math.min(1, summary.mobility_recovery_session_count / 2) : null,
      detail: logged
        ? `${summary.mobility_recovery_session_count} mobility or recovery sessions`
        : 'Nothing logged in the last seven days'
    },
    {
      id: 'recovery_balance',
      label: 'Rest',
      weight: 0.1,
      value: typeof params.restDays7d === 'number'
        ? Math.min(1, params.restDays7d / MIN_REST_DAYS)
        : null,
      detail: typeof params.restDays7d === 'number'
        ? `${params.restDays7d} rest ${params.restDays7d === 1 ? 'day' : 'days'} in the last seven`
        : 'Not enough history to see your rest days'
    }
  ];

  const base = composeFoundationScore({
    domain: 'movement_capacity',
    date: params.date,
    contributors,
    inputConfidences: [summary.confidence],
    reasonCodes: summary.reason_codes,
    summarise: (score, limiters) => {
      if (score === null) return 'Nothing logged yet, so there is nothing to read.';
      const lead = limiters[0];
      if (!lead) return score >= 75 ? 'Movement is in good shape this week.' : 'Movement is steady this week.';
      return `${lead.label} is what is holding movement back — ${lead.detail.toLowerCase()}.`;
    }
  });

  return {
    ...base,
    limiter_causes: base.limiters
      .map((limiter) => explainMovementLimiter(limiter.id, context))
      .filter((cause): cause is string => cause !== null)
  };
}
