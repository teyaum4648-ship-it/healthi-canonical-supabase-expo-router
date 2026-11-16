import { describe, expect, it } from 'vitest';

import { contrastRatio, WCAG } from '../../src/styles/contrast';
import { accent, bone, ink, pillar, pillarOnCanvas, safety, surface, zoneWord } from '../../src/styles/daywoven1c';

/**
 * The 1c "Thread" palette: a light canvas with a charcoal band. Text on the canvas and on
 * the band has to clear 4.5:1; marks that carry meaning (chart lines, the now line, bars)
 * have to clear 3:1. Translucent tokens are blended over the surface they sit on first,
 * because a translucent colour has no contrast ratio of its own.
 */

function parse(color: string): { rgb: [number, number, number]; alpha: number } {
  const hex = color.trim().match(/^#([0-9a-f]{6})$/i);
  if (hex) {
    const value = hex[1]!;
    return { rgb: [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16)) as [number, number, number], alpha: 1 };
  }
  const rgba = color.trim().match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/i);
  if (!rgba) throw new Error(`Cannot parse colour: ${color}`);
  return { rgb: [Number(rgba[1]), Number(rgba[2]), Number(rgba[3])], alpha: rgba[4] === undefined ? 1 : Number(rgba[4]) };
}

/** The colour seen when `color` is drawn over the opaque `over`. */
function flatten(color: string, over: string): string {
  const top = parse(color);
  const base = parse(over);
  if (base.alpha !== 1) throw new Error(`Background must be opaque: ${over}`);
  return `#${top.rgb
    .map((channel, i) => Math.round(top.alpha * channel + (1 - top.alpha) * base.rgb[i]!))
    .map((channel) => channel.toString(16).padStart(2, '0'))
    .join('')}`.toUpperCase();
}

function channelDistance(a: string, b: string): number {
  const x = parse(a).rgb;
  const y = parse(b).rgb;
  return Math.max(...x.map((channel, i) => Math.abs(channel - y[i]!)));
}

describe('the flattened values written in the tokens file match the real blends', () => {
  it.each([
    ['bone.soft', bone.soft, '#B4B2AC'],
    ['bone.muted', bone.muted, '#ABA9A4'],
    ['bone.faint', bone.faint, '#A3A19C'],
    ['bone.label', bone.label, '#9A9894']
  ])('%s over the band is %s', (_name, value, documented) => {
    expect(channelDistance(flatten(value, surface.band), documented)).toBeLessThanOrEqual(1);
  });

  it('amberWashFlat is amberWash over the canvas', () => {
    expect(channelDistance(flatten(accent.amberWash, surface.canvas), accent.amberWashFlat)).toBeLessThanOrEqual(1);
  });
});

describe('1c text meets WCAG 2.2 AA (4.5:1)', () => {
  const pairs: [string, string, string][] = [
    ['ink.text on canvas', ink.text, surface.canvas],
    ['ink.text on card', ink.text, surface.card],
    ['ink.text on the amber wash', ink.text, accent.amberWashFlat],
    ['ink.muted on canvas', ink.muted, surface.canvas],
    ['ink.muted on card', ink.muted, surface.card],
    ['ink.mutedOnWash on the amber wash', ink.mutedOnWash, accent.amberWashFlat],
    ['bone.text on band', bone.text, surface.band],
    ['bone.soft on band', flatten(bone.soft, surface.band), surface.band],
    ['bone.muted on band', flatten(bone.muted, surface.band), surface.band],
    ['bone.faint on band', flatten(bone.faint, surface.band), surface.band],
    ['bone.label on band', flatten(bone.label, surface.band), surface.band],
    ['pillar.nourishment (zone word) on band', pillar.nourishment, surface.band],
    ['ink.text on the amber "Now" pill', ink.text, accent.amber],
    ['ink.text on the bone primary button', ink.text, bone.text],
    ['safety.onCanvas on canvas', safety.onCanvas, surface.canvas],
    ['safety.onCanvas on card', safety.onCanvas, surface.card],
    ['safety.onBand on band', safety.onBand, surface.band]
  ];

  it.each(pairs)('%s', (name, foreground, background) => {
    const ratio = contrastRatio(foreground, background);
    expect(ratio, `${name} is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(WCAG.AA_TEXT);
  });

  it.each(Object.entries(zoneWord))('the %s zone word reaches 4.5:1 on the band', (zone, color) => {
    const ratio = contrastRatio(color.startsWith('#') ? color : flatten(color, surface.band), surface.band);
    expect(ratio, `${zone} word is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(WCAG.AA_TEXT);
  });
});

describe('1c marks that carry meaning reach 3:1', () => {
  it.each([
    ...Object.entries(pillarOnCanvas).map(([name, value]) => [`pillarOnCanvas.${name} on canvas`, value, surface.canvas] as [string, string, string]),
    ['the amber-deep now line on canvas', accent.amberDeep, surface.canvas],
    ['last night’s lavender bar on card', accent.lavenderDeep, surface.card],
    ['each ring colour on the band', pillar.recovery_rhythm, surface.band],
    ['nourishment ring on the band', pillar.nourishment, surface.band],
    ['movement ring on the band', pillar.movement_capacity, surface.band],
    ['mind ring on the band', pillar.mind_life_load, surface.band]
  ] as [string, string, string][])('%s', (name, foreground, background) => {
    const ratio = contrastRatio(foreground, background);
    expect(ratio, `${name} is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(WCAG.AA_NON_TEXT);
  });
});
