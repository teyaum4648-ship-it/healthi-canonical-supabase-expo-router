import type {
  DailyReadinessDomain,
  DailyReadinessDriver,
  DailyReadinessLabel,
  DailyReadinessPrimaryFocus
} from './readinessTypes';

export function readinessSummary(label: DailyReadinessLabel): string {
  if (label === 'primed') return 'Your available signals support a stronger day.';
  if (label === 'steady') return 'Your system supports a steady, useful pace today.';
  if (label === 'conserve') return 'Protect your capacity and keep the day controlled.';
  if (label === 'restore') return 'Recovery rhythm leads today, with lighter demands where possible.';
  return 'Log one thing, like last night’s sleep, a meal or water, a workout, your plan or a mood check-in, to see today’s readiness.';
}

export function readinessFocusLabel(focus: DailyReadinessPrimaryFocus): string {
  if (focus === 'recovery_rhythm') return 'Recovery + Rhythm';
  if (focus === 'nourishment') return 'Nourishment';
  if (focus === 'movement_capacity') return 'Movement Capacity';
  if (focus === 'mind_life_load') return 'Mind + Life Load';
  return 'Balanced Day';
}

/**
 * What a domain with no data should say.
 *
 * "More logged data will sharpen this signal" is true and useless: it does not say what
 * is missing or what to do about it. A domain contributes nothing until something is
 * logged, so the honest reading of an empty domain is an invitation, and it should name
 * the one thing that would fill it.
 */
export function missingDomainPrompt(domain: DailyReadinessDomain): string {
  if (domain === 'recovery_rhythm') return 'Nothing logged yet — add last night to see how it lands.';
  if (domain === 'nourishment') return 'No meals or water logged yet — add one to bring food into today.';
  if (domain === 'movement_capacity') return 'No sessions logged this week — add one to bring movement in.';
  return 'Nothing here yet today — a mood check-in or a block in your plan brings it in.';
}

/**
 * The points a domain moved the score, as they should read on a row.
 *
 * A domain with nothing logged shows an invitation rather than a zero, because zero is
 * a measurement and this is an absence — the same distinction the score itself makes by
 * refusing to fall when data is missing.
 */
export function contributionLabel(driver: Pick<DailyReadinessDriver, 'contribution' | 'missing'>): string {
  if (driver.missing) return 'Add';
  const points = Math.round(driver.contribution);
  if (points === 0) return 'No change';
  return points > 0 ? `+${points}` : `\u2212${Math.abs(points)}`;
}

/**
 * The arithmetic in one line, so the number on the ring stops being a verdict.
 *
 * This is the whole point of the ledger: a person who reads "61" and cannot see where it
 * came from has been told how they feel. A person who reads "starts at 70, sleep took
 * 15" has been shown something they can act on.
 */
export function readinessLedgerSummary(baseline: number, score: number, rawScore: number = score): string {
  const raw = Math.round(rawScore);
  const shown = Math.round(score);

  // A day good enough to sum past 100, or bad enough to sum below 0, has to say so:
  // otherwise the rows add up to one number and the ring shows another.
  if (raw > shown) return `Every day starts at ${baseline}. Today's signals add ${raw - baseline} — the scale stops at ${shown}.`;
  if (raw < shown) return `Every day starts at ${baseline}. Today's signals take off ${baseline - raw} — the scale stops at ${shown}.`;

  const moved = shown - baseline;
  if (moved === 0) return `Every day starts at ${baseline}. Today's signals left it there.`;
  return `Every day starts at ${baseline}. Today's signals move it ${moved > 0 ? 'up to' : 'down to'} ${shown}.`;
}
