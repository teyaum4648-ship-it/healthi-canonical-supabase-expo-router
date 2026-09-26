/**
 * The theme's raw values, with no react-native import anywhere in the module graph.
 *
 * They live apart from `mobileTheme.ts` because that file reaches for `Platform.select`
 * and `StyleSheet.hairlineWidth`, and pulling react-native into a test run means the
 * bundler has to parse Flow-typed JavaScript, which it cannot. Keeping the numbers and
 * the colours here is what lets `tests/styles/contrast.test.ts` measure them.
 *
 * Import from `mobileTheme` as before; it re-exports all of this.
 */

/**
 * The light canvas. The page is Apple's off-white, and pure white is kept for the things
 * that float on it: cards and the controls inside them. Text is a rich charcoal with one
 * muted grey for labels, timestamps and captions, which is enough hierarchy on its own.
 *
 * Each pillar keeps one colour, darkened until it passes 4.5:1 as text on the canvas and
 * carries white text as a fill, so the same value works for a label, an icon and a button.
 */
export const hues = {
  green: '#247A31',
  purple: '#8944AB',
  teal: '#0071A4',
  amber: '#A05A00',
  blue: '#0066CC',
  blueFill: '#0071E3',
  blueFillPressed: '#0062C4',
  red: '#B31A12',
  /** Text and icons on any accent fill. */
  onAccent: '#FFFFFF'
} as const;

/**
 * Wellness zones, as washes rather than raw colour: a translucent tint of the system hue
 * behind text in a darker shade of it. Every pair reads at 4.7:1 or better.
 */
export const zones = {
  optimal: { background: 'rgba(52, 199, 89, 0.08)', text: '#247A31', solid: '#34C759' },
  warning: { background: 'rgba(255, 204, 0, 0.1)', text: '#8A6D00', solid: '#FFCC00' },
  critical: { background: 'rgba(255, 59, 48, 0.08)', text: '#B31A12', solid: '#FF3B30' },
  neutral: { background: 'rgba(0, 0, 0, 0.04)', text: '#6E6E73', solid: '#AEAEB2' }
} as const;

export type ZoneTone = keyof typeof zones;

export const palette = {
  ink: '#1D1D1F',
  inkSoft: '#1D1D1F',
  ivory: '#F5F5F7',
  paper: '#FFFFFF',
  muted: '#6E6E73',
  faint: '#6E6E73',
  hairline: 'rgba(0, 0, 0, 0.04)',
  hairlineSoft: 'rgba(0, 0, 0, 0.04)',
  sand: '#E8E8ED',
  forest: hues.blue,
  forestMid: hues.blue,
  forestFill: hues.blueFill,
  forestFillPressed: hues.blueFillPressed,
  forestSoft: hues.green,
  forestPale: 'rgba(0, 113, 227, 0.14)',
  forestWash: 'rgba(0, 113, 227, 0.07)',
  clayDark: hues.red
} as const;

export const colors = {
  background: palette.ivory,
  surface: palette.paper,
  surfaceInset: '#F5F5F7',
  surfaceMuted: '#F2F2F5',
  text: palette.ink,
  textMuted: palette.muted,
  textFaint: palette.faint,
  textSubtle: palette.faint,
  textInverse: hues.onAccent,
  hairline: palette.hairline,
  hairlineSoft: palette.hairlineSoft,
  border: palette.hairline,
  borderMuted: palette.hairlineSoft,
  borderStrong: 'rgba(0, 0, 0, 0.04)',
  track: palette.sand,
  accent: palette.forest,
  accentMid: palette.forestMid,
  accentSoft: palette.forestSoft,
  accentPale: palette.forestPale,
  accentWash: palette.forestWash,
  primary: palette.forestFill,
  primaryPressed: palette.forestFillPressed,
  primaryMuted: palette.forestWash,
  primaryText: hues.onAccent,
  danger: palette.clayDark,
  success: hues.green,
  dim: palette.faint,
  glow: 'rgba(0, 113, 227, 0.14)',

  // Legacy aliases let established screens adopt the mobile shell without
  // changing their data or interaction logic.
  gold: palette.forest,
  goldSoft: palette.forestMid,
  deepViolet: palette.ink,
  midnightPlum: palette.paper,
  plum: '#F2F2F5',
  softViolet: palette.forestSoft,
  mutedViolet: palette.faint,
  violetMuted: palette.muted,
  lavender: palette.forestMid,
  lavenderMist: palette.forestWash,
  teal: palette.forestSoft,
  warmIvory: palette.ivory,
  cosmicWhite: palette.ink,
  signalGreen: hues.green,
  signalGold: hues.amber,
  signalAmber: hues.amber,
  signalCoral: palette.clayDark,
  priorityYellow: hues.amber,
  priorityRed: palette.clayDark
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
  md: 14,
  lg: 16,
  xl: 16,
  full: 999
} as const;

/** One curve for every hover, press, focus and open: a quick start that settles softly. */
export const motion = {
  duration: 250,
  bezier: [0.25, 1, 0.5, 1] as const,
  css: 'all 0.25s cubic-bezier(0.25, 1, 0.5, 1)'
} as const;

/**
 * Cards are a material, not paint: white at 88% over the canvas with the backdrop blurred
 * and its colour lifted, so whatever scrolls behind a card or the tab bar softens rather
 * than showing through. Edges are a 4% hairline that adapts to what is behind them, and
 * the shadow is wide and faint enough to lift a card without drawing a line under it.
 *
 * Over the canvas the card composites to #FEFEFE, which is what text contrast is checked
 * against (tests/styles/contrast.test.ts).
 */
export const surfaces = {
  card: 'rgba(255, 255, 255, 0.88)',
  blur: 'blur(20px) saturate(190%)',
  edge: 'rgba(0, 0, 0, 0.04)',
  shadow: '0 10px 30px rgba(0, 0, 0, 0.03), 0 1px 3px rgba(0, 0, 0, 0.01)',
  chrome: 'rgba(255, 255, 255, 0.88)'
} as const;
