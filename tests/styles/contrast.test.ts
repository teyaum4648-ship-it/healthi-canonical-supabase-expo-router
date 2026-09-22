import { describe, expect, it } from 'vitest';

import { colors } from '../../src/styles/tokens';
import { contrastRatio, relativeLuminance, WCAG } from '../../src/styles/contrast';

/**
 * The app is dark-only, so every piece of text sits on one of four near-black surfaces.
 * These are the four, and a colour has to clear its threshold on all of them — checking
 * only against pure black is how #6E6E73 shipped at 3.06:1 on the lightest panel.
 */
const SURFACES: Array<[string, string]> = [
  ['background', colors.background],
  ['surface', colors.surface],
  ['surfaceInset', colors.surfaceInset],
  ['surfaceMuted', colors.surfaceMuted]
];

function worstCase(foreground: string): { ratio: number; surface: string } {
  return SURFACES.reduce(
    (worst, [name, surface]) => {
      const ratio = contrastRatio(foreground, surface);
      return ratio < worst.ratio ? { ratio, surface: name } : worst;
    },
    { ratio: Infinity, surface: '' }
  );
}

describe('contrastRatio', () => {
  it('matches the known anchors', () => {
    expect(contrastRatio('#FFFFFF', '#000000')).toBeCloseTo(21, 5);
    expect(contrastRatio('#000000', '#000000')).toBeCloseTo(1, 5);
    // Order must not matter.
    expect(contrastRatio('#1E90FF', '#000000')).toBeCloseTo(contrastRatio('#000000', '#1E90FF'), 10);
  });

  it('accepts shorthand hex and rejects anything it cannot measure', () => {
    expect(relativeLuminance('#fff')).toBeCloseTo(relativeLuminance('#FFFFFF'), 10);
    expect(() => relativeLuminance('rgba(0, 0, 0, 0.5)')).toThrow(/opaque hex/);
  });
});

describe('theme text colours meet WCAG 2.2 AA', () => {
  const textTokens: Array<[string, string]> = [
    ['text', colors.text],
    ['textMuted', colors.textMuted],
    ['textFaint', colors.textFaint],
    ['textSubtle', colors.textSubtle],
    ['accent', colors.accent],
    ['accentMid', colors.accentMid],
    ['accentSoft', colors.accentSoft],
    ['danger', colors.danger],
    ['success', colors.success]
  ];

  it.each(textTokens)('%s reaches 4.5:1 on every surface', (name, value) => {
    const { ratio, surface } = worstCase(value);
    expect(
      ratio,
      `${name} (${value}) is ${ratio.toFixed(2)}:1 on ${surface}, below ${WCAG.AA_TEXT}:1`
    ).toBeGreaterThanOrEqual(WCAG.AA_TEXT);
  });
});

describe('filled controls meet WCAG 2.2 AA for their own label', () => {
  /*
   * A primary button is white text on a solid fill, so the fill is the background and
   * the accent's contrast against the page says nothing about it. #0A84FF as a fill gave
   * its own label 3.65:1.
   */
  it.each([
    ['primary', colors.primary],
    ['primaryPressed', colors.primaryPressed]
  ])('primaryText on %s reaches 4.5:1', (name, fill) => {
    const ratio = contrastRatio(colors.primaryText, fill);
    expect(
      ratio,
      `primaryText on ${name} (${fill}) is ${ratio.toFixed(2)}:1`
    ).toBeGreaterThanOrEqual(WCAG.AA_TEXT);
  });

  it('keeps the pressed state visibly darker than the resting fill', () => {
    expect(relativeLuminance(colors.primaryPressed)).toBeLessThan(relativeLuminance(colors.primary));
  });
});

describe('score ring colours meet the non-text threshold', () => {
  // From scoreRing.ts. A ring stroke is a graphic, so 1.4.11 applies rather than 1.4.3.
  it.each([
    ['green', '#30D158'],
    ['yellow', '#FFD60A'],
    ['red', '#FF6961'],
    ['unscored', colors.textFaint]
  ])('%s reaches 3:1 on every surface', (name, value) => {
    const { ratio, surface } = worstCase(value);
    expect(
      ratio,
      `${name} (${value}) is ${ratio.toFixed(2)}:1 on ${surface}`
    ).toBeGreaterThanOrEqual(WCAG.AA_NON_TEXT);
  });
});
