import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { BlurView } from 'expo-blur';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { HIT, ink, surface, tabBar, type } from '../../styles/daywoven1c';
import { mainTabs } from './navigationModel';
import { TAB_BAR_HEIGHT, tabBarBottomPadding } from './tabBarSpace';

/**
 * The 1c bottom bar (handoff Phase 2): Today, Sleep, Food, Move, Mind, full width along the
 * bottom, frosted over the content, with a hairline on top. Active is ink and semibold,
 * inactive is muted; there is no colour per tab. Routes that are not in `mainTabs` (Plan,
 * Trends, Settings, the old Menu) are never drawn, but stay reachable by route.
 *
 * `litRoute` keeps a tab lit while a screen it owns is showing (Today while Plan is open).
 */
export function ThreadTabBar({ state, navigation, insets, litRoute }: BottomTabBarProps & { litRoute?: string | null }) {
  const current = state.routes[state.index]?.name;
  return (
    <View
      accessibilityRole="tablist"
      style={[styles.bar, { height: TAB_BAR_HEIGHT + Math.max(0, insets.bottom), paddingBottom: tabBarBottomPadding(insets.bottom) }]}
    >
      <BlurView intensity={30} style={StyleSheet.absoluteFill} tint="light" />
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.tint]} />
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
    borderTopColor: ink.hairline,
    borderTopWidth: 1,
    bottom: 0,
    flexDirection: 'row',
    left: 0,
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingTop: tabBar.paddingTop,
    position: 'absolute',
    right: 0
  },
  tint: { backgroundColor: surface.tabBar },
  item: { alignItems: 'center', flex: 1, gap: 3, justifyContent: 'center', minHeight: HIT, minWidth: 0 },
  label: { lineHeight: 14 },
  pressed: { opacity: 0.6 }
});
