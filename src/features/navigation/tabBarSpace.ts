import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { tabBar } from '../../styles/daywoven1c';

/**
 * The 1c tab bar runs the full width of the screen along the bottom, frosted over the
 * content, so every tab's scroll has to end clear of it. One number for all of them, so a
 * change to the bar cannot leave one screen's last card hidden underneath.
 *
 * Its height above the home indicator: top padding, the tab item (a 23pt icon in the
 * 23pt icon, a 3pt gap and a 14pt label line) and the bottom padding.
 */
export const TAB_BAR_HEIGHT = tabBar.paddingTop + tabBar.iconSize + 3 + 14 + tabBar.paddingBottom;

/** The bar's own bottom padding: its fixed padding plus the home indicator, when there is one. */
export function tabBarBottomPadding(insetBottom: number): number {
  return tabBar.paddingBottom + Math.max(0, insetBottom);
}

/** Space to leave at the end of a tab's content so its last item clears the bar. */
export function tabBarSpace(insetBottom: number, extra = 20): number {
  return TAB_BAR_HEIGHT + Math.max(0, insetBottom) + extra;
}

export function useTabBarSpace(extra = 20): number {
  return tabBarSpace(useSafeAreaInsets().bottom, extra);
}
