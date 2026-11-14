import { Platform, StyleSheet, type TextStyle, type ViewStyle } from 'react-native';

import { colors, glass, ground, motion, zones, type ZoneTone } from './tokens';

const systemFont =
  Platform.select({
    ios: 'System',
    android: 'sans-serif',
    web: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif'
  }) ?? 'sans-serif';

export { palette, colors, spacing, radii, hues, glass, ground, motion, surfaces, zones, type ZoneTone } from './tokens';

export const fonts = {
  display: systemFont,
  displayLight: systemFont,
  displayItalic: systemFont,
  body: systemFont,
  bodyMedium: systemFont
} as const;

export const hairlineWidth = StyleSheet.hairlineWidth;

export const type = {
  /* The one big number on a screen: semibold and tight, so it reads as a figure. */
  hero: {
    fontFamily: fonts.display,
    fontSize: 58,
    fontWeight: '600',
    lineHeight: 62,
    letterSpacing: -2.4,
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
    fontSize: 30,
    fontWeight: '700',
    lineHeight: 36,
    letterSpacing: -0.7
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
  /* A small label above a group or a figure: quiet capitals, lightly tracked. */
  eyebrow: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
    letterSpacing: 0.8,
    textTransform: 'uppercase'
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
    letterSpacing: -0.8,
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
 * The surface every card sits on: one flat charcoal on true black. No gradient, edge or
 * glow, so a screen reads as a few calm blocks and the colour is left for the data.
 */
export const glassSurface: ViewStyle = {
  backgroundColor: colors.surface
};

/** Chrome that sits over content, such as the tab bar: solid, a step darker than a card. */
export const glassChrome: ViewStyle = {
  backgroundColor: glass.chrome,
  borderColor: colors.hairline,
  borderWidth: StyleSheet.hairlineWidth
};

/** A filled button: the accent, flat. The `top` argument is kept for callers that pass it. */
export function accentFill(fill: string, _top?: string): ViewStyle {
  return { backgroundColor: fill };
}

/** #RRGGBB at an alpha, for glows and washes. */
export function withAlpha(hex: string, alpha: number): string {
  const value = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((offset) => parseInt(value.slice(offset, offset + 2), 16));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** The ground every screen stands on: true black, the way the health and wearable apps do it. */
export function groundStyle(): ViewStyle {
  return { backgroundColor: ground.base };
}

/** A tab's ground. Plain black now: the tab's colour lives in its data, not behind it. */
export function ambientGlow(_hex: string): ViewStyle {
  return groundStyle();
}

/** The day's single most important card. Flat like the rest; the accent marks it in its content. */
export function tintedGlass(_hex: string): ViewStyle {
  return { backgroundColor: colors.surface };
}

/** The glass card under the name newer components use. */
export const cardSurface = glassSurface;

/** The floating chrome under the name newer components use. */
export const chromeSurface = glassChrome;

/**
 * The web's half of the motion rule: hover, focus and state changes ease on the same
 * curve. Native has no CSS transitions, so there the pressable components animate instead.
 */
export const webTransition: ViewStyle = Platform.OS === 'web'
  ? ({ transition: motion.css } as ViewStyle)
  : {};

/** A zone's wash and ink, for chips and highlighted rows. */
export function zoneStyle(tone: ZoneTone): { container: ViewStyle; text: TextStyle } {
  return { container: { backgroundColor: zones[tone].background }, text: { color: zones[tone].text } };
}
