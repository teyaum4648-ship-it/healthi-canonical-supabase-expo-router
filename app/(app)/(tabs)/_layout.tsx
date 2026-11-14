import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { mainTabs } from '../../../src/features/navigation/navigationModel';
import { SideMenuProvider } from '../../../src/features/navigation/SideMenu';
import { tabBarHeight } from '../../../src/features/navigation/tabBarSpace';

import { colors, glassChrome } from '../../../src/styles/mobileTheme';

type TabIconName = keyof typeof Ionicons.glyphMap;

const systemFont = Platform.select({
  ios: 'System',
  android: 'sans-serif',
  web: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif'
}) ?? 'sans-serif';

function tabIcon(outline: TabIconName, filled: TabIconName) {
  return ({ color, focused, size }: { color: string; focused: boolean; size: number }) => (
    <Ionicons color={color} name={focused ? filled : outline} size={size - 1} />
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
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      backBehavior="history"
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.background },
        /* The selected tab is white and filled; the colour on a screen is kept for its data. */
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarLabelStyle: { fontFamily: systemFont, fontSize: 11, fontWeight: '600', letterSpacing: 0, lineHeight: 14 },
        tabBarItemStyle: { paddingBottom: 0, paddingTop: 0 },
        /* A standard bar along the bottom edge, a step darker than the cards, with one hairline. */
        tabBarStyle: {
          backgroundColor: glassChrome.backgroundColor,
          borderTopColor: colors.hairline,
          borderTopWidth: glassChrome.borderWidth,
          elevation: 0,
          height: tabBarHeight(insets.bottom),
          paddingBottom: Math.max(insets.bottom, 6),
          paddingTop: 2
        }
      }}
    >
      {mainTabs.map((tab) => (
        <Tabs.Screen key={tab.route} name={tab.route} options={{ title: tab.label, tabBarIcon: tabIcon(tab.outline, tab.filled) }} />
      ))}
      {/* The menu now opens from the profile button in each screen's header; /menu still resolves. */}
      <Tabs.Screen name="menu" options={{ href: null }} />
      <Tabs.Screen name="plan" options={{ href: null }} />
      {/* Reached from the side menu rather than the bar; see mainTabs. */}
      <Tabs.Screen name="settings" options={{ href: null }} />
      <Tabs.Screen name="progress" options={{ href: null }} />
    </Tabs>
  );
}
