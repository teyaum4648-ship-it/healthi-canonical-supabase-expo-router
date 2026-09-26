import { describe, expect, it } from 'vitest';

import { scoreRingColor } from '../../../src/features/nutrition/scoreRing';

/**
 * The ring's three colours are derived from the letter grade rather than from their own
 * thresholds, so this pins the cuts the owner asked for — 80 and up green, 60 to 79
 * amber, below 60 red — to the bands the rest of the app already uses. If a band moves,
 * this fails rather than the two quietly disagreeing.
 */
describe('the score ring reads the bands, not its own numbers', () => {
  const green = '#248A3D';
  const amber = '#9A7400';
  const red = '#D70015';

  it('is green from 80 up', () => {
    expect(scoreRingColor(100)).toBe(green);
    expect(scoreRingColor(92)).toBe(green);
    expect(scoreRingColor(80)).toBe(green);
  });

  it('is amber from 60 to 79', () => {
    expect(scoreRingColor(79)).toBe(amber);
    expect(scoreRingColor(70)).toBe(amber);
    expect(scoreRingColor(60)).toBe(amber);
  });

  it('is red below 60', () => {
    expect(scoreRingColor(59)).toBe(red);
    expect(scoreRingColor(25)).toBe(red);
    expect(scoreRingColor(0)).toBe(red);
  });

  it('says nothing rather than something when there is no score', () => {
    // A product the engine could not score is not a red product.
    expect(scoreRingColor(null)).not.toBe(red);
    expect(scoreRingColor(undefined)).not.toBe(red);
    expect(scoreRingColor(Number.NaN)).not.toBe(red);
  });
});
