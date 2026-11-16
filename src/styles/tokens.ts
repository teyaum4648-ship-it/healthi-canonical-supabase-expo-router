/**
 * The theme's semantic values, with no react-native import anywhere in the module graph.
 *
 * They live apart from `mobileTheme.ts` because that file reaches for `Platform.select`
 * and `StyleSheet.hairlineWidth`, and pulling react-native into a test run means the
 * bundler has to parse Flow-typed JavaScript, which it cannot. Keeping the values here is
 * what lets `tests/styles/contrast.test.ts` measure them.
 *
 * Phase 3 of the Daywoven 1c handoff (docs/design/1c/HANDOFF.md): every name below keeps
 * its export, so the ~100 files that import it follow automatically, but each now points
 * at the 1c "Thread" palette in `daywoven1c.ts`: a light canvas, white cards, ink text and
 * a charcoal band. That file is the only place a colour is defined; this one only maps the
 * older names onto it. Import from `mobileTheme` as before; it re-exports all of this.
 */
import { accent, bone, control, ink, pillarOnCanvas, safety, surface, zoneOnCanvas } from './daywoven1c';

/**
 * The four foundation colours and the two signal colours, by their old names. Colour means
 * what the data is (a foundation, energy, sleep, safety), never which tab is open, so the
 * old per-pillar hues now resolve to the canvas-safe pillar marks.
 */
export const hues = {
  mint: pillarOnCanvas.recovery_rhythm,
  mintSoft: pillarOnCanvas.recovery_rhythm,
  mintFill: ink.text,
  mintPressed: control.primaryPressed,
  iris: pillarOnCanvas.nourishment,
  irisSoft: pillarOnCanvas.nourishment,
  glacier: pillarOnCanvas.movement_capacity,
  glacierSoft: pillarOnCanvas.movement_capacity,
  amber: accent.amberDeep,
  coral: safety.onCanvas,
  /** Text and icons on an ink or pillar fill. */
  onAccent: bone.text
} as const;

/** The old dark gradient ground is now the flat canvas at every stop. */
export const ground = {
  top: surface.canvas,
  middle: surface.canvas,
  base: surface.canvas
} as const;

export const palette = {
  ink: ink.text,
  inkSoft: ink.muted,
  ivory: surface.canvas,
  paper: surface.card,
  muted: ink.muted,
  faint: ink.muted,
  hairline: ink.hairline,
  hairlineSoft: ink.hairlineSoft,
  sand: ink.track,
  forest: ink.text,
  forestMid: ink.text,
  forestFill: ink.text,
  forestFillPressed: control.primaryPressed,
  forestSoft: ink.text,
  forestPale: ink.washStrong,
  forestWash: ink.wash,
  clayDark: safety.onCanvas
} as const;

export const colors = {
  background: surface.canvas,
  surface: surface.card,
  surfaceInset: surface.canvas,
  surfaceMuted: surface.sunken,
  text: ink.text,
  textMuted: ink.muted,
  textFaint: ink.muted,
  textSubtle: ink.muted,
  textInverse: bone.text,
  hairline: ink.hairline,
  hairlineSoft: ink.hairlineSoft,
  border: ink.hairline,
  borderMuted: ink.hairlineSoft,
  borderStrong: ink.border,
  track: ink.track,
  /** UI accent is ink. Amber is kept for energy and highlights and is used by name where it means that. */
  accent: ink.text,
  accentMid: ink.text,
  accentSoft: ink.text,
  accentPale: ink.washStrong,
  accentWash: ink.wash,
  /** Primary button: ink fill, bone text (design language P13). */
  primary: ink.text,
  primaryPressed: control.primaryPressed,
  primaryMuted: ink.wash,
  primaryText: bone.text,
  danger: safety.onCanvas,
  success: ink.text,
  dim: ink.muted,
  glow: ink.wash,

  // Legacy aliases, each pointed at its nearest 1c meaning so established screens follow.
  gold: ink.text,
  goldSoft: ink.text,
  deepViolet: ink.text,
  midnightPlum: surface.card,
  plum: surface.sunken,
  softViolet: ink.text,
  mutedViolet: ink.muted,
  violetMuted: ink.muted,
  lavender: ink.text,
  lavenderMist: ink.wash,
  teal: ink.text,
  warmIvory: surface.canvas,
  cosmicWhite: ink.text,
  signalGreen: ink.text,
  signalGold: accent.amberDeep,
  signalAmber: accent.amberDeep,
  signalCoral: safety.onCanvas,
  priorityYellow: accent.amberDeep,
  priorityRed: safety.onCanvas
} as const;

export const spacing = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 24,
  xl: 34
} as const;

export const radii = {
  sm: 10,
  md: 12,
  lg: 14,
  xl: 20,
  full: 999
} as const;

/**
 * Glass is retired in 1c (handoff, "Never: glass, glow and gradient backgrounds"). The
 * names stay so callers keep compiling; every value is now a flat white card with a
 * hairline edge, and the chrome is the tab bar's canvas tint.
 */
export const glass = {
  gradient: [surface.card, surface.card] as const,
  gradientRaised: [surface.card, surface.card] as const,
  edge: ink.border,
  highlight: 'none',
  shadow: 'none',
  chrome: surface.tabBar
} as const;

/** One curve for every hover, press, focus and open: a quick start that settles softly. */
export const motion = {
  duration: 250,
  bezier: [0.25, 1, 0.5, 1] as const,
  css: 'all 0.25s cubic-bezier(0.25, 1, 0.5, 1)'
} as const;

/** The card's parts by name, for components that set their own edge. */
export const surfaces = {
  edge: ink.border,
  chrome: surface.tabBar
} as const;

/** Wellness zones on the canvas; see `zoneOnCanvas` in daywoven1c.ts. */
export const zones = zoneOnCanvas;

export type ZoneTone = keyof typeof zones;
