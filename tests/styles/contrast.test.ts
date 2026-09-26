import { describe, expect, it } from 'vitest';

import { colors, surfaces } from '../../src/styles/tokens';
import { compositeOver, contrastRatio, relativeLuminance, WCAG } from '../../src/styles/contrast';

/**
 * The app is light-only, so every piece of text sits on one of four off-white surfaces.
 * These are the four, and a colour has to clear its threshold on all of them — checking
 * only against pure white would pass colours that fail on the canvas or a muted chip.
 */
const SURFACES: Array<[string, string]> = [
  ['background', colors.background],
  ['surface', colors.surface],
  // Cards are translucent; this is the card material as it reads over the canvas.
  ['card material', compositeOver(surfaces.card, colors.background)],
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

describe('compositeOver', () => {
  it('lays a translucent colour over an opaque one', () => {
    expect(compositeOver('rgba(255, 255, 255, 0.88)', '#F5F5F7')).toBe('#FEFEFE');
    expect(compositeOver('rgba(0, 0, 0, 0.5)', '#FFFFFF')).toBe('#808080');
    expect(() => compositeOver('#FFFFFF', '#000000')).toThrow(/rgba/);
  });
});

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
    ['green', '#248A3D'],
    ['yellow', '#9A7400'],
    ['red', '#D70015'],
    ['unscored', colors.textFaint]
  ])('%s reaches 3:1 on every surface', (name, value) => {
    const { ratio, surface } = worstCase(value);
    expect(
      ratio,
      `${name} (${value}) is ${ratio.toFixed(2)}:1 on ${surface}`
    ).toBeGreaterThanOrEqual(WCAG.AA_NON_TEXT);
  });
});
