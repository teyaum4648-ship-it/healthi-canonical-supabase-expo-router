import type {
  DataConfidence,
  FoundationContributor,
  FoundationDomain,
  FoundationScore
} from './foundationTypes';

/**
 * Turning a set of terms into a pillar score, the same way every time.
 *
 * Two rules do most of the work here, and both come from the same place: missing data
 * must lower confidence and never a score.
 *
 * A term with no data is dropped and the remaining weights are renormalised, so a day
 * that reported four of six terms is scored out of those four rather than out of six with
 * two zeroes dragging. The alternative — treating an unreported term as a failure — makes
 * the score a measure of how much someone logged rather than of how they are doing.
 *
 * Coverage is then reported separately, and caps confidence. A score of 80 drawn from a
 * third of the pillar is a true statement about a third of the pillar, and the honest way
 * to present it is with the number next to it rather than by quietly moving the number.
 */

/** Below this share of the pillar's weight, one term can carry the whole reading. */
const THIN_COVERAGE = 0.4;
/** Above this, enough is known that the score is worth trusting as a whole. */
const BROAD_COVERAGE = 0.75;
/** A term at or below this is doing enough damage to be worth naming. */
const LIMITER_CEILING = 0.65;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function weakest(confidences: DataConfidence[]): DataConfidence {
  if (confidences.includes('low')) return 'low';
  if (confidences.includes('medium')) return 'medium';
  return 'high';
}

function confidenceFromCoverage(coverage: number): DataConfidence {
  if (coverage < THIN_COVERAGE) return 'low';
  if (coverage < BROAD_COVERAGE) return 'medium';
  return 'high';
}

export function composeFoundationScore(params: {
  domain: FoundationDomain;
  date: string;
  contributors: FoundationContributor[];
  /** Confidences from the sources feeding the terms; the weakest one caps the result. */
  inputConfidences?: DataConfidence[];
  reasonCodes?: string[];
  /** Copy for the score, given the score and what limited it. */
  summarise: (score: number | null, limiters: FoundationContributor[]) => string;
}): FoundationScore {
  const contributors = params.contributors.map((contributor) => ({
    ...contributor,
    value: contributor.value === null ? null : clamp01(contributor.value)
  }));

  const totalWeight = contributors.reduce((sum, contributor) => sum + contributor.weight, 0);
  const known = contributors.filter((contributor) => contributor.value !== null);
  const knownWeight = known.reduce((sum, contributor) => sum + contributor.weight, 0);
  const coverage = totalWeight <= 0 ? 0 : knownWeight / totalWeight;

  /*
   * A score is withheld, not merely flagged, below THIN_COVERAGE.
   *
   * This was a real defect and the app showed it: a profile with nothing logged read
   * "100 / 100 — Movement is in good shape this week", because the only term with data
   * was rest, and somebody who has never trained trivially has rest days. Coverage was
   * 9%, confidence was correctly 'low', and none of that mattered — the number said 100.
   *
   * One or two terms cannot speak for a pillar. Where they are all there is, the honest
   * output is no score and a summary that says why, which is the same rule the readiness
   * baseline follows: absence must not be dressed up as a finding.
   */
  const score = knownWeight <= 0 || coverage < THIN_COVERAGE
    ? null
    : Math.round((known.reduce((sum, c) => sum + c.weight * (c.value as number), 0) / knownWeight) * 100);

  const limiters = known
    .filter((contributor) => (contributor.value as number) <= LIMITER_CEILING)
    .sort((left, right) =>
      right.weight * (1 - (right.value as number)) - left.weight * (1 - (left.value as number)))
    .slice(0, 3);

  const reasonCodes = [...new Set([
    ...(params.reasonCodes ?? []),
    ...limiters.map((limiter) => `limited_by_${limiter.id}`),
    ...(coverage < THIN_COVERAGE ? [`${params.domain}_coverage_thin`] : []),
    ...(score === null ? [`${params.domain}_not_yet_measurable`] : [])
  ])];

  return {
    domain: params.domain,
    date: params.date.slice(0, 10),
    score,
    confidence: score === null
      ? 'low'
      : weakest([confidenceFromCoverage(coverage), ...(params.inputConfidences ?? [])]),
    coverage: Math.round(coverage * 100) / 100,
    contributors,
    limiters,
    reason_codes: reasonCodes,
    summary: params.summarise(score, limiters)
  };
}

export { THIN_COVERAGE, BROAD_COVERAGE, LIMITER_CEILING };
