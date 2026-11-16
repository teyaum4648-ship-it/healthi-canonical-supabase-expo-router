import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useEffect, useState } from 'react';
import { Keyboard, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { HIT, ink, surface, tabBar, type } from '../../styles/daywoven1c';
import { mainTabs } from './navigationModel';
import { TAB_BAR_HEIGHT, tabBarBottomPadding } from './tabBarSpace';

/**
 * While the keyboard is up the bar steps aside, so the field being typed in and the button
 * that saves it get the room. On iOS the keyboard covers the bar anyway; on Android the
 * window resizes, and a bar riding on top of the keyboard would take that room.
 */
function useKeyboardOpen(): boolean {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, () => setOpen(true));
    const hide = Keyboard.addListener(hideEvent, () => setOpen(false));
    return () => { show.remove(); hide.remove(); };
  }, []);
  return open;
}

/**
 * The 1c bottom bar (handoff Phase 2): Today, Sleep, Food, Move, Mind, full width along the
 * bottom, with a hairline on top.
 *
 * It sits in the layout, below the screen, rather than floating over it. A floating bar
 * made every screen guess its height to keep a last button clear, and a screen that
 * guessed wrong (the pinned "Finish workout" footer) lost the button underneath it. In the
 * layout, nothing can be under the bar, on any screen size, safe area or text size. Active is ink and semibold,
 * inactive is muted; there is no colour per tab. Routes that are not in `mainTabs` (Plan,
 * Trends, Settings, the old Menu) are never drawn, but stay reachable by route.
 *
 * `litRoute` keeps a tab lit while a screen it owns is showing (Today while Plan is open).
 */
export function ThreadTabBar({ state, navigation, insets, litRoute }: BottomTabBarProps & { litRoute?: string | null }) {
  const current = state.routes[state.index]?.name;
  const keyboardOpen = useKeyboardOpen();
  if (keyboardOpen) return null;
  return (
    <View
      accessibilityRole="tablist"
      style={[styles.bar, { minHeight: TAB_BAR_HEIGHT + Math.max(0, insets.bottom), paddingBottom: tabBarBottomPadding(insets.bottom) }]}
    >
      {mainTabs.map((tab) => {
        const route = state.routes.find((candidate) => candidate.name === tab.route);
        if (!route) return null;
        const active = current === tab.route || litRoute === tab.route;
        const color = active ? ink.text : ink.muted;
        return (
          <Pressable
            key={tab.route}
            accessibilityRole="tab"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected: active }}
            onPress={() => {
              const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!event.defaultPrevented && current !== tab.route) navigation.navigate(route.name, route.params);
            }}
            onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
            style={({ pressed }) => [styles.item, pressed && styles.pressed]}
          >
            <Ionicons accessible={false} color={color} name={active ? tab.filled : tab.outline} size={tabBar.iconSize} />
            <Text numberOfLines={1} style={[active ? type.tabLabelActive : type.tabLabel, styles.label, { color }]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: surface.canvas,
    borderTopColor: ink.hairline,
    borderTopWidth: 1,
    flexDirection: 'row',
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingTop: tabBar.paddingTop
  },
  item: { alignItems: 'center', flex: 1, gap: 3, justifyContent: 'center', minHeight: HIT, minWidth: 0 },
  label: { minHeight: 14 },
  pressed: { opacity: 0.6 }
});
