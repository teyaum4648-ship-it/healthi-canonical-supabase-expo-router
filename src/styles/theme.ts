import { StyleSheet, type TextStyle } from 'react-native';

export const palette = {
  ink: '#1A211D',
  inkSoft: '#3A423D',
  ivory: '#F6F4EE',
  paper: '#FDFCF9',
  muted: '#8F938B',
  faint: '#A3A69E',
  hairline: '#E8E4DA',
  hairlineSoft: '#EFECE3',
  sand: '#E9E5DA',
  forest: '#1C5443',
  forestMid: '#4E8571',
  forestSoft: '#7FA48F',
  forestPale: '#C3D6CB',
  forestWash: '#E6EFE9',
  clayDark: '#8A4B3C'
} as const;

export const colors = {
  background: palette.ivory,
  surface: palette.paper,
  surfaceInset: '#F3F0E8',
  surfaceMuted: palette.forestWash,
  text: palette.ink,
  textMuted: palette.muted,
  textFaint: palette.faint,
  textSubtle: palette.faint,
  textInverse: palette.paper,
  hairline: palette.hairline,
  hairlineSoft: palette.hairlineSoft,
  border: palette.hairline,
  borderMuted: palette.hairlineSoft,
  borderStrong: palette.forestPale,
  track: palette.sand,
  accent: palette.forest,
  accentMid: palette.forestMid,
  accentSoft: palette.forestSoft,
  accentPale: palette.forestPale,
  accentWash: palette.forestWash,
  primary: palette.forest,
  primaryPressed: '#174737',
  primaryMuted: palette.forestWash,
  primaryText: palette.paper,
  danger: palette.clayDark,
  success: palette.forestMid,
  dim: palette.faint,
  glow: 'rgba(28, 84, 67, 0.22)',

  // Legacy aliases kept while older screens migrate to Atelier tokens.
  gold: palette.forest,
  goldSoft: palette.forestMid,
  deepViolet: palette.ink,
  midnightPlum: palette.paper,
  plum: palette.forestWash,
  softViolet: palette.forestSoft,
  mutedViolet: palette.faint,
  violetMuted: palette.muted,
  lavender: palette.forestMid,
  lavenderMist: palette.forestWash,
  teal: palette.forestSoft,
  warmIvory: palette.ivory,
  cosmicWhite: palette.paper,
  signalGreen: palette.forestMid,
  signalGold: palette.forest,
  signalAmber: '#B89145',
  signalCoral: palette.clayDark,
  priorityYellow: '#B89145',
  priorityRed: palette.clayDark
} as const;

export const fonts = {
  display: 'Fraunces_400Regular',
  displayLight: 'Fraunces_300Light',
  displayItalic: 'Fraunces_400Regular_Italic',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium'
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

export const hairlineWidth = StyleSheet.hairlineWidth;

export const type = {
  hero: {
    fontFamily: fonts.displayLight,
    fontSize: 64,
    lineHeight: 68,
    letterSpacing: 0,
    fontVariant: ['tabular-nums']
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 30,
    lineHeight: 37,
    letterSpacing: 0
  },
  heading: {
    fontFamily: fonts.display,
    fontSize: 21,
    lineHeight: 27
  },
  voice: {
    fontFamily: fonts.displayItalic,
    fontSize: 15,
    lineHeight: 22
  },
  eyebrow: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.6
  },
  label: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    lineHeight: 18
  },
  body: {
    fontFamily: fonts.body,
    fontSize: 14.5,
    lineHeight: 22
  },
  caption: {
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 17
  },
  numberLg: {
    fontFamily: fonts.body,
    fontSize: 26,
    lineHeight: 31,
    letterSpacing: 0,
    fontVariant: ['tabular-nums']
  },
  number: {
    fontFamily: fonts.bodyMedium,
    fontSize: 16,
    lineHeight: 21,
    fontVariant: ['tabular-nums']
  }
} as const satisfies Record<string, TextStyle>;
