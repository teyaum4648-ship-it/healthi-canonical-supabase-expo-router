import { tabBar } from '../../styles/daywoven1c';

/**
 * The 1c tab bar runs the full width of the screen along the bottom, in the layout below
 * each tab's screen (see ThreadTabBar), so a screen's own content always ends above it.
 *
 * Its height above the home indicator: top padding, the tab item (a 23pt icon in the
 * 23pt icon, a 3pt gap and a 14pt label line) and the bottom padding.
 */
export const TAB_BAR_HEIGHT = tabBar.paddingTop + tabBar.iconSize + 3 + 14 + tabBar.paddingBottom;

/** The bar's own bottom padding: its fixed padding plus the home indicator, when there is one. */
export function tabBarBottomPadding(insetBottom: number): number {
  return tabBar.paddingBottom + Math.max(0, insetBottom);
}

/**
 * Space to leave at the end of a tab's content. The bar and the home indicator are already
 * outside the screen, so this is only breathing room above the bar, the same everywhere.
 * `insetBottom` stays in the signature for callers that pass it; it no longer adds anything.
 */
export function tabBarSpace(_insetBottom: number, extra = 20): number {
  return Math.max(0, extra);
}

export function useTabBarSpace(extra = 20): number {
  return tabBarSpace(0, extra);
}
