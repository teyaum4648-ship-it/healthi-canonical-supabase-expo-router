import { Platform, StyleSheet, type TextStyle, type ViewStyle } from 'react-native';

import { glass, ground, motion, zones, type ZoneTone } from './tokens';

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

const glassGradient = `linear-gradient(180deg, ${glass.gradient[0]} 0%, ${glass.gradient[1]} 100%)`;

/**
 * The surface every card sits on: a gradient lit from above over a base a shade darker
 * than colors.surface, so it averages out to the same tone, with a one-pixel highlight on
 * the top edge. A drop shadow would be invisible on true black, so there is none.
 *
 * Native draws the gradient itself; the web takes the same string as backgroundImage.
 */
export const glassSurface: ViewStyle = {
  backgroundColor: '#0F1114',
  boxShadow: glass.highlight,
  ...(Platform.OS === 'web'
    ? ({ backgroundImage: glassGradient } as ViewStyle)
    : { experimental_backgroundImage: glassGradient })
};

/** A floating control's frosted chrome: the tab bar and anything that sits over content. */
export const glassChrome: ViewStyle = {
  backgroundColor: glass.chrome,
  borderColor: glass.edge,
  borderWidth: StyleSheet.hairlineWidth,
  boxShadow: `${glass.highlight}, 0 18px 40px rgba(0, 0, 0, 0.55)`,
  ...(Platform.OS === 'web'
    ? ({ backdropFilter: 'blur(24px) saturate(180%)', WebkitBackdropFilter: 'blur(24px) saturate(180%)' } as ViewStyle)
    : null)
};

/**
 * A filled button's sheen: the fill colour lit from above, a highlight along the top edge
 * and a glow in its own colour beneath, which is the one place a shadow shows on black.
 */
export function accentFill(fill: string, top = 'rgba(255, 255, 255, 0.22)'): ViewStyle {
  const sheen = `linear-gradient(180deg, ${top} 0%, rgba(255, 255, 255, 0) 60%)`;
  return {
    backgroundColor: fill,
    boxShadow: `inset 0 1px 0 rgba(255, 255, 255, 0.35), 0 8px 22px ${withAlpha(fill, 0.26)}`,
    ...(Platform.OS === 'web'
      ? ({ backgroundImage: sheen } as ViewStyle)
      : { experimental_backgroundImage: sheen })
  };
}

/** #RRGGBB at an alpha, for glows and washes. */
export function withAlpha(hex: string, alpha: number): string {
  const value = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((offset) => parseInt(value.slice(offset, offset + 2), 16));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Navy-charcoal at the top, settling to near-black: the design's ground, as a CSS gradient. */
const GROUND_GRADIENT = `linear-gradient(180deg, ${ground.top} 0%, ${ground.middle} 34%, ${ground.base} 100%)`;

/**
 * A diffused glow: an ellipse of colour that fades through several steps to nothing, so it
 * reads as light spreading rather than a shape with an edge.
 */
function diffuse(rgb: string, peak: number, size: string, at: string): string {
  const stops = [[1, 0], [0.62, 22], [0.3, 45], [0.1, 68], [0, 100]] as const;
  return `radial-gradient(${size} at ${at}, ${stops.map(([share, offset]) => `rgba(${rgb}, ${+(peak * share).toFixed(4)}) ${offset}%`).join(', ')})`;
}

const NAVY = '96, 128, 196';
const DEEP_NAVY = '70, 96, 160';

/** The cool navy light that sits in the ground on every screen. */
const NAVY_GLOWS = [
  diffuse(NAVY, 0.16, '75% 40%', '95% 0%'),
  diffuse(DEEP_NAVY, 0.08, '85% 40%', '0% 88%')
];

/** The ground with no accent: for screens outside the tabs, such as sign-in and settings. */
export function groundStyle(): ViewStyle {
  const image = [...NAVY_GLOWS, GROUND_GRADIENT].join(', ');
  return {
    backgroundColor: ground.base,
    ...(Platform.OS === 'web' ? ({ backgroundImage: image } as ViewStyle) : { experimental_backgroundImage: image })
  };
}

/**
 * A tab's ambient light on the ground: its accent diffused behind the upper middle of the
 * screen, where the main content sits, with the ground's navy light at the top right and
 * lower left. It sits behind everything and carries no information. React Native 0.83
 * draws the same radial layers natively, so phone and web match.
 */
export function ambientGlow(hex: string): ViewStyle {
  const rgb = withAlpha(hex, 1).slice(5, -4);
  const image = [diffuse(rgb, 0.12, '90% 42%', '50% 22%'), ...NAVY_GLOWS, GROUND_GRADIENT].join(', ');
  return {
    backgroundColor: ground.base,
    ...(Platform.OS === 'web' ? ({ backgroundImage: image } as ViewStyle) : { experimental_backgroundImage: image })
  };
}

/** Glass washed with one accent from its top-left corner: the day's single most important card. */
export function tintedGlass(hex: string): ViewStyle {
  const wash = `linear-gradient(160deg, ${withAlpha(hex, 0.13)} 0%, rgba(235, 240, 255, 0.045) 48%, rgba(235, 240, 255, 0.025) 100%)`;
  return {
    backgroundColor: '#0F1114',
    borderColor: glass.edge,
    borderWidth: StyleSheet.hairlineWidth,
    boxShadow: glass.highlight,
    ...(Platform.OS === 'web' ? ({ backgroundImage: wash } as ViewStyle) : { experimental_backgroundImage: wash })
  };
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
