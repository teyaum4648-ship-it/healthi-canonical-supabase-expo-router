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
 * OLED black with cool slate layers, and four accents that only mark data or the one
 * action on a screen. The accents are the sRGB edge of the Display P3 set in the design
 * files: mint for recovery and the brand, iris for nourishment, glacier for movement and
 * amber for mind. Coral is kept for safety and nothing else.
 */
export const hues = {
  mint: '#00F6AA',
  mintSoft: '#5CF2C0',
  mintFill: '#00F0A8',
  mintPressed: '#00C98D',
  iris: '#A88FFF',
  irisSoft: '#C2B2FF',
  glacier: '#46C6FF',
  glacierSoft: '#8AD9FF',
  amber: '#FFC25B',
  coral: '#FF6B6B',
  /** Text and icons on any accent fill; 7.4:1 on iris, the darkest of them. */
  onAccent: '#0A0D13'
} as const;

export const palette = {
  ink: '#F5F7FA',
  inkSoft: '#C7CBD1',
  ivory: '#000000',
  paper: '#15171B',
  muted: '#A9B0BA',
  faint: '#8C939D',
  hairline: 'rgba(235, 240, 255, 0.08)',
  hairlineSoft: 'rgba(235, 240, 255, 0.055)',
  sand: '#2A2E35',
  forest: hues.mint,
  forestMid: hues.mintSoft,
  forestFill: hues.mintFill,
  forestFillPressed: hues.mintPressed,
  forestSoft: hues.mintSoft,
  forestPale: 'rgba(0, 246, 170, 0.22)',
  forestWash: 'rgba(0, 246, 170, 0.11)',
  clayDark: hues.coral
} as const;

export const colors = {
  background: palette.ivory,
  surface: palette.paper,
  surfaceInset: '#1E2126',
  surfaceMuted: '#272A30',
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
  glow: 'rgba(0, 246, 170, 0.22)',

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
 * Glass: a card is a faint top-lit gradient over black, a hairline edge and a highlight
 * along its top, with a soft shadow under it. Written once here so every card agrees.
 */
export const glass = {
  gradient: ['rgba(235, 240, 255, 0.075)', 'rgba(235, 240, 255, 0.03)'] as const,
  gradientRaised: ['rgba(235, 240, 255, 0.11)', 'rgba(235, 240, 255, 0.05)'] as const,
  edge: 'rgba(235, 240, 255, 0.09)',
  highlight: 'inset 0 1px 0 rgba(255, 255, 255, 0.06)',
  shadow: '0 14px 34px rgba(0, 0, 0, 0.45)',
  chrome: 'rgba(22, 25, 30, 0.86)'
} as const;

