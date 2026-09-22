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

export const palette = {
  ink: '#F5F5F7',
  inkSoft: '#D1D1D6',
  ivory: '#000000',
  paper: '#121214',
  muted: '#A1A1A6',
  faint: '#8E8E93',
  hairline: 'rgba(255, 255, 255, 0.075)',
  hairlineSoft: 'rgba(255, 255, 255, 0.055)',
  sand: '#2C2C2E',
  forest: '#1E90FF',
  forestMid: '#5AC8FA',
  forestFill: '#0071E3',
  forestFillPressed: '#0058B8',
  forestSoft: '#63E6CE',
  forestPale: 'rgba(30, 144, 255, 0.24)',
  forestWash: 'rgba(30, 144, 255, 0.12)',
  clayDark: '#FF6961'
} as const;

export const colors = {
  background: palette.ivory,
  surface: palette.paper,
  surfaceInset: '#1C1C1E',
  surfaceMuted: '#242426',
  text: palette.ink,
  textMuted: palette.muted,
  textFaint: palette.faint,
  textSubtle: palette.faint,
  textInverse: '#FFFFFF',
  hairline: palette.hairline,
  hairlineSoft: palette.hairlineSoft,
  border: palette.hairline,
  borderMuted: palette.hairlineSoft,
  borderStrong: 'rgba(255, 255, 255, 0.12)',
  track: palette.sand,
  accent: palette.forest,
  accentMid: palette.forestMid,
  accentSoft: palette.forestSoft,
  accentPale: palette.forestPale,
  accentWash: palette.forestWash,
  primary: palette.forestFill,
  primaryPressed: palette.forestFillPressed,
  primaryMuted: palette.forestWash,
  primaryText: '#FFFFFF',
  danger: palette.clayDark,
  success: palette.forestSoft,
  dim: palette.faint,
  glow: 'rgba(30, 144, 255, 0.24)',

  // Legacy aliases let established screens adopt the mobile shell without
  // changing their data or interaction logic.
  gold: palette.forest,
  goldSoft: palette.forestMid,
  deepViolet: palette.ink,
  midnightPlum: palette.paper,
  plum: '#242426',
  softViolet: palette.forestSoft,
  mutedViolet: palette.faint,
  violetMuted: palette.muted,
  lavender: palette.forestMid,
  lavenderMist: palette.forestWash,
  teal: palette.forestSoft,
  warmIvory: palette.ivory,
  cosmicWhite: palette.ink,
  signalGreen: palette.forestSoft,
  signalGold: '#FFD479',
  signalAmber: '#FFD479',
  signalCoral: palette.clayDark,
  priorityYellow: '#FFD479',
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
  lg: 20,
  xl: 28,
  full: 999
} as const;

