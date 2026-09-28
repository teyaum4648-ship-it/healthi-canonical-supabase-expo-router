import type { ContributorImpact, RecoveryFeature, RecoveryWeights, Restedness, SleepContributor } from './types';

const POSITIVE_FROM = 85;
const NEGATIVE_BELOW = 70;

function impactOf(score: number): ContributorImpact {
  if (score >= POSITIVE_FROM) return 'positive';
  if (score < NEGATIVE_BELOW) return 'negative';
  return 'neutral';
}

const RESTEDNESS_WORDS: Record<Restedness, string> = {
  1: 'exhausted',
  2: 'tired',
  3: 'okay',
  4: 'rested',
  5: 'very rested'
};

/*
 * Wording is associative, never causal or clinical: "may contribute", "associated with",
 * "likely to feel". A score describes the inputs; it does not say why a person feels a
 * certain way or what is going on in their body.
 */
function messageFor(id: RecoveryFeature, impact: ContributorImpact, restedness: Restedness | null): string {
  switch (id) {
    case 'duration':
      return impact === 'positive' ? 'You slept close to your estimated need.'
        : impact === 'neutral' ? 'You slept a little under your estimated need.'
        : 'You slept less than your estimated need, which may contribute to lower energy today.';
    case 'fragmentation':
      return impact === 'positive' ? 'Little time awake overnight.'
        : impact === 'neutral' ? 'Some time awake overnight.'
        : 'You spent a fair amount of time awake overnight, which is associated with feeling less rested.';
    case 'efficiency':
      return impact === 'positive' ? 'Most of your time in bed was spent asleep.'
        : impact === 'neutral' ? 'A modest share of your time in bed was spent awake.'
        : 'A large share of your time in bed was spent awake.';
    case 'sleepDebt':
      return impact === 'positive' ? 'Little sleep debt from the past week.'
        : impact === 'neutral' ? 'Some sleep debt has built up over the past week.'
        : 'Short nights earlier this week have added up, which may contribute to lower energy.';
    case 'subjective':
      return `You reported feeling ${restedness ? RESTEDNESS_WORDS[restedness] : 'unsure'} this morning.`;
    case 'heartRate':
      return impact === 'positive' ? 'Your morning pulse was at or near your usual.'
        : impact === 'neutral' ? 'Your morning pulse was a little above your usual.'
        : 'Your morning pulse was above your usual, which is associated with lower recovery.';
  }
}

/**
 * One line per feature that was used, ordered by how much weighted ground each one gave
 * up, so the first line is the one most worth reading.
 */
export function generateSleepExplanation(
  scores: Partial<Record<RecoveryFeature, number | null>>,
  weightsUsed: Partial<RecoveryWeights>,
  restedness: Restedness | null
): SleepContributor[] {
  return (Object.keys(weightsUsed) as RecoveryFeature[])
    .filter((id) => typeof scores[id] === 'number')
    .map((id) => {
      const score = Math.round(scores[id] as number);
      const impact = impactOf(score);
      return { id, score, impact, message: messageFor(id, impact, restedness), loss: (100 - score) * (weightsUsed[id] ?? 0) };
    })
    .sort((left, right) => right.loss - left.loss)
    .map(({ loss: _loss, ...contributor }) => contributor);
}
