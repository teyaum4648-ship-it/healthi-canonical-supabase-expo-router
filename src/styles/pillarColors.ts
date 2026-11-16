import { bone, ink, pillarOnCanvas } from './daywoven1c';

/**
 * One colour per foundation, used wherever a foundation is named on the light canvas: the
 * 1c `pillarOnCanvas` marks, each clearing 3:1 on the canvas as a graphic. Text is always
 * ink; these colour marks (a dot, a line, an icon), never words.
 *
 * Colour is never the only signal: every place that uses one also names the pillar.
 */
export const pillarColors = {
  recovery_rhythm: pillarOnCanvas.recovery_rhythm,
  nourishment: pillarOnCanvas.nourishment,
  movement_capacity: pillarOnCanvas.movement_capacity,
  mind_life_load: pillarOnCanvas.mind_life_load
} as const;

export type PillarId = keyof typeof pillarColors;

/** Text and icons on a pillar-coloured fill. */
export const onPillar = bone.text;

/**
 * Each tab's accent. 1c has no colour per tab (colour means what the data is), so every
 * tab's buttons and highlights are ink. Kept by name so callers do not change.
 */
export const tabAccent = {
  food: ink.text,
  movement: ink.text,
  rhythm: ink.text,
  mood: ink.text
} as const;

/** The same colour at low strength, for an icon's backing tile. */
export function pillarTint(pillar: PillarId, alpha = 0.12): string {
  const hex = pillarColors[pillar].slice(1);
  const [r, g, b] = [0, 2, 4].map((offset) => parseInt(hex.slice(offset, offset + 2), 16));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
