import { hues } from './tokens';

/**
 * One colour per pillar, used wherever a pillar is named: mint, iris, glacier and amber,
 * a quarter of the wheel apart so no two can be mistaken for each other.
 *
 * Colour is never the only signal: every place that uses one also names the pillar.
 */
export const pillarColors = {
  recovery_rhythm: hues.mint,
  nourishment: hues.iris,
  movement_capacity: hues.glacier,
  mind_life_load: hues.amber
} as const;

export type PillarId = keyof typeof pillarColors;

/**
 * Text and icons on a pillar-coloured fill. The pillar colours are light, so white on
 * them fails contrast; near-black passes comfortably on all four.
 */
export const onPillar = hues.onAccent;

/** Each tab's accent, used for its tab-bar icon and its main button. Home uses the brand mint. */
export const tabAccent = {
  food: pillarColors.nourishment,
  movement: pillarColors.movement_capacity,
  rhythm: pillarColors.recovery_rhythm,
  mood: pillarColors.mind_life_load
} as const;

/** The same colour at low strength, for an icon's backing tile. */
export function pillarTint(pillar: PillarId, alpha = 0.16): string {
  const hex = pillarColors[pillar].slice(1);
  const [r, g, b] = [0, 2, 4].map((offset) => parseInt(hex.slice(offset, offset + 2), 16));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
