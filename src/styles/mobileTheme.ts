import { Platform, StyleSheet, type TextStyle, type ViewStyle } from 'react-native';

import { motion, surfaces, zones, type ZoneTone } from './tokens';

const systemFont =
  Platform.select({
    ios: 'System',
    android: 'sans-serif',
    web: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif'
  }) ?? 'sans-serif';

export { palette, colors, spacing, radii, hues, motion, surfaces, zones, type ZoneTone } from './tokens';

export const fonts = {
  display: systemFont,
  displayLight: systemFont,
  displayItalic: systemFont,
  body: systemFont,
  bodyMedium: systemFont
} as const;

export const hairlineWidth = StyleSheet.hairlineWidth;

export const type = {
  hero: {
    fontFamily: fonts.displayLight,
    fontSize: 58,
    lineHeight: 62,
    letterSpacing: -1.8,
    fontVariant: ['tabular-nums']
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 34,
    fontWeight: '700',
    lineHeight: 40,
    letterSpacing: -0.8
  },
  /** Every screen's name, the same size everywhere, like a large navigation title on iOS. */
  largeTitle: {
    fontFamily: fonts.display,
    fontSize: 32,
    fontWeight: '700',
    lineHeight: 38,
    letterSpacing: -0.6
  },
  heading: {
    fontFamily: fonts.display,
    fontSize: 22,
    fontWeight: '600',
    lineHeight: 28,
    letterSpacing: -0.35
  },
  voice: {
    fontFamily: fonts.body,
    fontSize: 16,
    lineHeight: 23
  },
  /* A section label in sentence case, the way iOS labels a group — not tracked-out capitals. */
  eyebrow: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    letterSpacing: 0
  },
  label: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 19
  },
  body: {
    fontFamily: fonts.body,
    fontSize: 16,
    lineHeight: 23
  },
  caption: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 18
  },
  numberLg: {
    fontFamily: fonts.body,
    fontSize: 28,
    fontWeight: '600',
    lineHeight: 34,
    letterSpacing: -0.4,
    fontVariant: ['tabular-nums']
  },
  number: {
    fontFamily: fonts.bodyMedium,
    fontSize: 17,
    fontWeight: '600',
    lineHeight: 22,
    fontVariant: ['tabular-nums']
  }
} as const satisfies Record<string, TextStyle>;

/**
 * The web's half of the motion rule: hover, focus and state changes ease on the same
 * curve. Native has no CSS transitions, so there the pressable components animate instead.
 */
export const webTransition: ViewStyle = Platform.OS === 'web'
  ? ({ transition: motion.css } as ViewStyle)
  : {};

/**
 * A floating card: pure white on the canvas, a hairline edge and the lightest lift.
 * `borderCurve: 'continuous'` gives iOS its squircle corners; elsewhere it is ignored.
 */
export const cardSurface: ViewStyle = {
  backgroundColor: surfaces.card,
  borderCurve: 'continuous',
  boxShadow: surfaces.shadow
};

/** The tab bar's frosted chrome: translucent white over the canvas, blurred on the web. */
export const chromeSurface: ViewStyle = {
  backgroundColor: surfaces.chrome,
  borderColor: surfaces.edge,
  borderWidth: StyleSheet.hairlineWidth,
  borderCurve: 'continuous',
  boxShadow: '0 8px 30px rgba(0, 0, 0, 0.08)',
  ...(Platform.OS === 'web'
    ? ({ backdropFilter: 'blur(20px) saturate(180%)', WebkitBackdropFilter: 'blur(20px) saturate(180%)' } as ViewStyle)
    : null)
};

/** A filled button: flat colour, continuous corners, nothing painted on top. */
export function accentFill(fill: string): ViewStyle {
  return { backgroundColor: fill, borderCurve: 'continuous' };
}

/** #RRGGBB at an alpha, for washes. */
export function withAlpha(hex: string, alpha: number): string {
  const value = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((offset) => parseInt(value.slice(offset, offset + 2), 16));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** A zone's wash and ink, for chips and highlighted rows. */
export function zoneStyle(tone: ZoneTone): { container: ViewStyle; text: TextStyle } {
  return { container: { backgroundColor: zones[tone].background }, text: { color: zones[tone].text } };
}

