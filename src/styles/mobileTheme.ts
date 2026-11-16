import { Platform, StyleSheet, type TextStyle, type ViewStyle } from 'react-native';

import { font, ink, surface } from './daywoven1c';
import { glass, motion, zones, type ZoneTone } from './tokens';

export { palette, colors, spacing, radii, hues, glass, ground, motion, surfaces, zones, type ZoneTone } from './tokens';

/**
 * 1c type: Jost for display, Inter for everything read. React Native needs one family per
 * weight (a custom family ignores fontWeight on iOS), so each weight is its own entry and
 * the ramp below names the family rather than setting fontWeight. Fraunces stays loaded in
 * app/_layout.tsx for anything not yet moved, but no theme style uses it.
 */
export const fonts = {
  display: font.display,
  displayMedium: font.displayMedium,
  displayLight: font.display,
  displayItalic: font.display,
  body: font.body,
  bodyMedium: font.bodyMedium,
  bodySemibold: font.bodySemibold
} as const;

export const hairlineWidth = StyleSheet.hairlineWidth;

export const type = {
  hero: {
    fontFamily: fonts.display,
    fontSize: 56,
    lineHeight: 58,
    letterSpacing: -1,
    fontVariant: ['tabular-nums']
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 30,
    lineHeight: 34,
    letterSpacing: -0.3
  },
  /** Every screen's name, the same size everywhere. */
  largeTitle: {
    fontFamily: fonts.display,
    fontSize: 30,
    lineHeight: 34,
    letterSpacing: -0.3
  },
  /** A section title on the canvas (design language P2). */
  heading: {
    fontFamily: fonts.displayMedium,
    fontSize: 20,
    lineHeight: 26
  },
  voice: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22
  },
  /** The 1c eyebrow: small, semibold, tracked capitals. */
  eyebrow: {
    fontFamily: fonts.bodySemibold,
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 1,
    textTransform: 'uppercase'
  },
  label: {
    fontFamily: fonts.bodySemibold,
    fontSize: 14,
    lineHeight: 19
  },
  body: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22
  },
  caption: {
    fontFamily: fonts.body,
    fontSize: 12.5,
    lineHeight: 17.5
  },
  numberLg: {
    fontFamily: fonts.display,
    fontSize: 28,
    lineHeight: 32,
    fontVariant: ['tabular-nums']
  },
  number: {
    fontFamily: fonts.bodySemibold,
    fontSize: 17,
    lineHeight: 22,
    fontVariant: ['tabular-nums']
  }
} as const satisfies Record<string, TextStyle>;

/** The family that carries a given weight, for places that would otherwise set fontWeight. */
export function fontForWeight(weight: TextStyle['fontWeight'], display = false): string {
  const numeric = typeof weight === 'number' ? weight : weight === 'bold' ? 700 : Number(weight ?? 400);
  if (display) return numeric >= 500 ? fonts.displayMedium : fonts.display;
  if (numeric >= 600) return fonts.bodySemibold;
  if (numeric >= 500) return fonts.bodyMedium;
  return fonts.body;
}

/**
 * The surface every card sits on. In 1c that is a flat white card with a hairline edge
 * (design language P5); the old top-lit glass gradient is retired.
 */
export const glassSurface: ViewStyle = {
  backgroundColor: surface.card,
  borderColor: glass.edge,
  borderWidth: 1
};

/** A floating control's chrome: the canvas tint with a hairline, no glow or shadow. */
export const glassChrome: ViewStyle = {
  backgroundColor: glass.chrome,
  borderColor: ink.hairline,
  borderWidth: StyleSheet.hairlineWidth
};

/** A filled control. Flat in 1c: the fill colour and nothing else. */
export function accentFill(fill: string, _top?: string): ViewStyle {
  return { backgroundColor: fill };
}

/** #RRGGBB at an alpha, for washes. */
export function withAlpha(hex: string, alpha: number): string {
  const value = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((offset) => parseInt(value.slice(offset, offset + 2), 16));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** The ground for screens outside the tabs, such as sign-in and settings: the plain canvas. */
export function groundStyle(): ViewStyle {
  return { backgroundColor: surface.canvas };
}

/**
 * A tab's ground. 1c has no colour per tab and no glow, so every tab stands on the plain
 * canvas; the argument stays so callers do not change.
 */
export function ambientGlow(_hex?: string): ViewStyle {
  return { backgroundColor: surface.canvas };
}

/** The day's single most important card: a white card with a hairline edge in 1c. */
export function tintedGlass(_hex?: string): ViewStyle {
  return { backgroundColor: surface.card, borderColor: glass.edge, borderWidth: 1 };
}

/** The card under the name newer components use. */
export const cardSurface = glassSurface;

/** The chrome under the name newer components use. */
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
