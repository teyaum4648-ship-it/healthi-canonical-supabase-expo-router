import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * The tab bar is a standard bar along the bottom edge, so content ends above it on its own.
 * Screens still ask for a little room at the end of a scroll, and on phones with a home
 * indicator the bar grows by the inset rather than covering it.
 */
export const TAB_BAR_HEIGHT = 60;

/** The bar's full height including the home indicator area. */
export function tabBarHeight(insetBottom: number): number {
  return TAB_BAR_HEIGHT + Math.max(insetBottom, 6);
}

/** Space to leave at the end of a tab's content, so the last item is not flush with the bar. */
export function tabBarSpace(_insetBottom: number, extra = 20): number {
  return extra + 12;
}

export function useTabBarSpace(extra = 20): number {
  return tabBarSpace(useSafeAreaInsets().bottom, extra);
}
