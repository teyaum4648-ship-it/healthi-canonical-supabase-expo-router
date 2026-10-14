import { Ionicons } from '@expo/vector-icons';
import { Tabs, usePathname } from 'expo-router';
import { BlurView } from 'expo-blur';
import { Platform, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { mainTabs } from '../../../src/features/navigation/navigationModel';
import { SideMenuProvider, useSideMenu } from '../../../src/features/navigation/SideMenu';
import { TAB_BAR_HEIGHT, tabBarBottomGap } from '../../../src/features/navigation/tabBarSpace';

import { ambientGlow, colors, fonts, glassChrome } from '../../../src/styles/mobileTheme';
import { tabAccent } from '../../../src/styles/pillarColors';

type TabIconName = keyof typeof Ionicons.glyphMap;

const hairlineWidthOrOne = Platform.OS === 'web' ? 1 : glassChrome.borderWidth;

const systemFont = Platform.select({
  ios: 'System',
  android: 'sans-serif',
  web: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif'
}) ?? fonts.body;

function tabIcon(outline: TabIconName, filled: TabIconName) {
  return ({ color, focused, size }: { color: string; focused: boolean; size: number }) => (
    <Ionicons color={color} name={focused ? filled : outline} size={size - 2} />
  );
}

export default function AppTabsLayout() {
  return (
    <SideMenuProvider>
      <AppTabs />
    </SideMenuProvider>
  );
}

function AppTabs() {
  const menu = useSideMenu();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const inHomeCalendar = pathname === '/plan';
  return (
    <Tabs
      backBehavior="history"
      screenOptions={() => {
        return {
          headerShown: false,
          sceneStyle: { backgroundColor: colors.background },
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: colors.textFaint,
          tabBarLabelStyle: {
            fontFamily: systemFont,
            fontSize: 10,
            fontWeight: '600',
            letterSpacing: 0
          },
          tabBarItemStyle: { paddingTop: 7, paddingBottom: 6, paddingHorizontal: 0 },
          /*
           * A pill that floats over the content, frosted, the way the system tab bar does.
           * The content scrolls underneath it and blurs through; every tab leaves room at
           * the end of its scroll (useTabBarSpace) so nothing is left hidden behind it.
           */
          tabBarStyle: {
            ...glassChrome,
            backgroundColor: 'rgba(22, 25, 30, 0.55)',
            position: 'absolute',
            left: 12,
            right: 12,
            bottom: tabBarBottomGap(insets.bottom),
            borderTopWidth: hairlineWidthOrOne,
            borderTopColor: glassChrome.borderColor,
            borderRadius: 32,
            height: TAB_BAR_HEIGHT,
            paddingBottom: 0,
            paddingTop: 0,
            paddingHorizontal: 2,
            overflow: 'hidden'
          },
          tabBarBackground: () => <BlurView intensity={40} style={StyleSheet.absoluteFill} tint="dark" />
        };
      }}
    >
      {mainTabs.map((tab) => {
        const homeContext = tab.route === 'index' && inHomeCalendar;
        const accent = tab.route in tabAccent ? tabAccent[tab.route as keyof typeof tabAccent] : colors.accent;
        return <Tabs.Screen key={tab.route} name={tab.route} options={{
          title: tab.label,
          sceneStyle: ambientGlow(accent),
          // Each pillar's tab lights up in its own colour, the way the Health app colours its categories.
          tabBarActiveTintColor: accent,
          // Keep the actual navigation state intact so Home remains tappable from Plan.
          tabBarIcon: (props) => tabIcon(tab.outline, tab.filled)({ ...props, focused: props.focused || homeContext, color: homeContext ? colors.accent : props.color }),
          ...(homeContext ? { tabBarLabelStyle: { fontFamily: systemFont, fontSize: 10, fontWeight: '600' as const, letterSpacing: 0.1, color: colors.accent } } : {})
        }} />;
      })}
      {/*
        The three-line tab opens the side menu in place; it never navigates, so whichever
        tab was open stays open underneath and the menu closes back onto it.
      */}
      <Tabs.Screen
        listeners={{ tabPress: (event) => { event.preventDefault(); menu.open(); } }}
        name="menu"
        options={{
          title: 'Menu',
          tabBarAccessibilityLabel: 'Open the menu',
          /* Icon only and narrower than a pillar: three lines read as "menu" without a word. */
          tabBarLabel: () => null,
          tabBarItemStyle: { flex: 0.6, justifyContent: 'center', paddingBottom: 0, paddingTop: 0 },
          tabBarIcon: ({ color, size }) => <Ionicons color={color} name="menu" size={size + 2} />
        }}
      />
      <Tabs.Screen
        name="plan"
        options={{
          href: null,
          sceneStyle: ambientGlow(colors.accent)
        }}
      />
      {/* Reached from the side menu rather than the bar; see mainTabs. */}
      <Tabs.Screen
        name="settings"
        options={{
          href: null
        }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          href: null,
          sceneStyle: ambientGlow(colors.accent)
        }}
      />
    </Tabs>
  );
}
