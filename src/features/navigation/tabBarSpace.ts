import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * The tab bar floats over the content so it can be real frosted glass, which means every
 * tab's scroll has to end clear of it. One number for all of them, so a change to the bar
 * cannot leave one screen's last card hidden underneath.
 */
export const TAB_BAR_HEIGHT = 64;

/** Distance from the bottom of the screen to the bar: the home indicator, or a margin. */
export function tabBarBottomGap(insetBottom: number): number {
  return Math.max(insetBottom, 12);
}

/** Space to leave at the end of a tab's content so its last item clears the bar. */
export function tabBarSpace(insetBottom: number, extra = 20): number {
  return TAB_BAR_HEIGHT + tabBarBottomGap(insetBottom) + extra;
}

export function useTabBarSpace(extra = 20): number {
  return tabBarSpace(useSafeAreaInsets().bottom, extra);
}
