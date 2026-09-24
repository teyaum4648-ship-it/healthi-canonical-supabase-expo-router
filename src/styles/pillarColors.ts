/**
 * One colour per pillar, used wherever a pillar is named.
 *
 * Each is the colour its own tab already used — the Sleep tab's night green, the Diet tab's
 * calorie purple, the Move tab's blue — so adopting it changes as little as possible. Home
 * had a separate set that nothing else used, and its nourishment cyan sat so close to the
 * Sleep green in both hue and lightness that the two pillars could not be told apart.
 *
 * Colour is never the only signal: every place that uses one also names the pillar.
 */
export const pillarColors = {
  recovery_rhythm: '#A9D8BF',
  nourishment: '#AA8AF8',
  movement_capacity: '#5AC8FA',
  mind_life_load: '#FFD479'
} as const;

export type PillarId = keyof typeof pillarColors;

/**
 * Text and icons on a pillar-coloured fill. The pillar colours are light, so white on
 * them fails contrast; near-black passes comfortably on all four.
 */
export const onPillar = '#0B0B0C';

/** Each tab's accent, used for its tab-bar icon and its main button. Home keeps system blue. */
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
