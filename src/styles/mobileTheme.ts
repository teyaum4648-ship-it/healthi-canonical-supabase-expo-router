import { Platform, StyleSheet, type TextStyle, type ViewStyle } from 'react-native';

import { colors, glass } from './tokens';

const systemFont =
  Platform.select({
    ios: 'System',
    android: 'sans-serif',
    web: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif'
  }) ?? 'sans-serif';

export { palette, colors, spacing, radii, hues, glass } from './tokens';

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

/**
 * A tab's ambient light: its accent glowing faintly from above the screen and gone by the
 * first third, over true black. It sits behind everything and carries no information.
 */
export function ambientGlow(hex: string): ViewStyle {
  const web = `radial-gradient(130% 46% at 50% -8%, ${withAlpha(hex, 0.16)} 0%, ${withAlpha(hex, 0.06)} 45%, rgba(0, 0, 0, 0) 80%)`;
  const native = `linear-gradient(180deg, ${withAlpha(hex, 0.12)} 0%, ${withAlpha(hex, 0.045)} 20%, rgba(0, 0, 0, 0) 40%)`;
  return {
    backgroundColor: colors.background,
    ...(Platform.OS === 'web' ? ({ backgroundImage: web } as ViewStyle) : { experimental_backgroundImage: native })
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
