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
 * Deep slate with cool layers, and four soft accents that only mark data or the one
 * action on a screen, taken from the Healthi Premium Direction design: mint for recovery
 * and the brand, iris for nourishment, glacier for movement and amber for mind. Coral is
 * kept for safety and nothing else.
 */
export const hues = {
  mint: '#8FE3C4',
  mintSoft: '#A6EAD2',
  mintFill: '#8FE3C4',
  mintPressed: '#76CCAD',
  iris: '#B4A6F6',
  irisSoft: '#C9BFF9',
  glacier: '#86C8F0',
  glacierSoft: '#A5D6F4',
  amber: '#F2C87E',
  coral: '#FF6B6B',
  /** Text and icons on any accent fill; clears 4.5:1 on all four (tests/styles/contrast.test.ts). */
  onAccent: '#0A0D10'
} as const;

/**
 * The ground every screen stands on: near-black charcoal with a cool navy undertone,
 * deepest at the bottom. From the Healthi Premium Direction design.
 */
export const ground = {
  top: '#000000',
  middle: '#000000',
  base: '#000000'
} as const;

export const palette = {
  ink: '#F5F6F7',
  inkSoft: '#C9CDD2',
  ivory: ground.base,
  paper: '#111214',
  muted: '#9EA3AA',
  faint: '#8E949C',
  hairline: 'rgba(255, 255, 255, 0.08)',
  hairlineSoft: 'rgba(255, 255, 255, 0.06)',
  sand: '#26282C',
  forest: hues.mint,
  forestMid: hues.mintSoft,
  forestFill: hues.mintFill,
  forestFillPressed: hues.mintPressed,
  forestSoft: hues.mintSoft,
  forestPale: 'rgba(143, 227, 196, 0.22)',
  forestWash: 'rgba(143, 227, 196, 0.11)',
  clayDark: hues.coral
} as const;

export const colors = {
  background: palette.ivory,
  surface: palette.paper,
  surfaceInset: '#1A1B1E',
  surfaceMuted: '#232428',
  text: palette.ink,
  textMuted: palette.muted,
  textFaint: palette.faint,
  textSubtle: palette.faint,
  textInverse: hues.onAccent,
  hairline: palette.hairline,
  hairlineSoft: palette.hairlineSoft,
  border: palette.hairline,
  borderMuted: palette.hairlineSoft,
  borderStrong: 'rgba(235, 240, 255, 0.12)',
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
  success: palette.forestSoft,
  dim: palette.faint,
  glow: 'rgba(143, 227, 196, 0.22)',

  // Legacy aliases let established screens adopt the mobile shell without
  // changing their data or interaction logic.
  gold: palette.forest,
  goldSoft: palette.forestMid,
  deepViolet: palette.ink,
  midnightPlum: palette.paper,
  plum: '#272A30',
  softViolet: palette.forestSoft,
  mutedViolet: palette.faint,
  violetMuted: palette.muted,
  lavender: palette.forestMid,
  lavenderMist: palette.forestWash,
  teal: palette.forestSoft,
  warmIvory: palette.ivory,
  cosmicWhite: palette.ink,
  signalGreen: palette.forestSoft,
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
  md: 16,
  lg: 22,
  xl: 28,
  full: 999
} as const;

/**
 * Cards are flat: one charcoal fill on true black, no gradient, edge or shadow. The names
 * stay from when they were glass so the many screens that read them change together.
 */
export const glass = {
  gradient: ['rgba(255, 255, 255, 0)', 'rgba(255, 255, 255, 0)'] as const,
  gradientRaised: ['rgba(255, 255, 255, 0)', 'rgba(255, 255, 255, 0)'] as const,
  edge: 'rgba(255, 255, 255, 0.05)',
  highlight: 'inset 0 0 0 rgba(0, 0, 0, 0)',
  shadow: 'none',
  chrome: '#050506'
} as const;


/** One curve for every hover, press, focus and open: a quick start that settles softly. */
export const motion = {
  duration: 250,
  bezier: [0.25, 1, 0.5, 1] as const,
  css: 'all 0.25s cubic-bezier(0.25, 1, 0.5, 1)'
} as const;

/** The glass card's parts by name, for components that set their own edge. */
export const surfaces = {
  edge: glass.edge,
  chrome: glass.chrome
} as const;

/**
 * Wellness zones on black: a low-strength wash of the accent behind text in the accent
 * itself. Each text colour clears 4.5:1 on the darkest and lightest surfaces it sits on.
 */
export const zones = {
  optimal: { background: 'rgba(143, 227, 196, 0.12)', text: hues.mintSoft, solid: hues.mint },
  warning: { background: 'rgba(242, 200, 126, 0.14)', text: hues.amber, solid: hues.amber },
  critical: { background: 'rgba(255, 107, 107, 0.14)', text: hues.coral, solid: hues.coral },
  neutral: { background: 'rgba(235, 240, 255, 0.06)', text: '#A9B0BA', solid: '#8C939D' }
} as const;

export type ZoneTone = keyof typeof zones;
