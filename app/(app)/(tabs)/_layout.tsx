import { Ionicons } from '@expo/vector-icons';
import { Tabs, usePathname } from 'expo-router';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { mainTabs } from '../../../src/features/navigation/navigationModel';

import { colors, fonts, chromeSurface } from '../../../src/styles/mobileTheme';
import { tabAccent } from '../../../src/styles/pillarColors';

type TabIconName = keyof typeof Ionicons.glyphMap;

const hairlineWidthOrOne = Platform.OS === 'web' ? 1 : chromeSurface.borderWidth;

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
            letterSpacing: 0.1
          },
          tabBarItemStyle: { paddingTop: 7, paddingBottom: 6 },
          /*
           * A pill that floats above the bottom edge, the way the system tab bar does now.
           * It stays in the layout rather than over the content, so nothing on any screen
           * has to make room for it; the margin around it is the page's own black.
           */
          tabBarStyle: {
            ...chromeSurface,
            position: 'relative',
            borderTopWidth: hairlineWidthOrOne,
            borderTopColor: chromeSurface.borderColor,
            borderRadius: 32,
            height: 64,
            marginHorizontal: 16,
            marginBottom: Math.max(insets.bottom, 12),
            marginTop: 6,
            paddingBottom: 0,
            paddingTop: 0,
            paddingHorizontal: 6,
            overflow: 'hidden'
          }
        };
      }}
    >
      {mainTabs.map((tab) => {
        const homeContext = tab.route === 'index' && inHomeCalendar;
        const accent = tab.route in tabAccent ? tabAccent[tab.route as keyof typeof tabAccent] : colors.accent;
        return <Tabs.Screen key={tab.route} name={tab.route} options={{
          title: tab.label,
          // Each pillar's tab lights up in its own colour, the way the Health app colours its categories.
          tabBarActiveTintColor: accent,
          // Keep the actual navigation state intact so Home remains tappable from Plan.
          tabBarIcon: (props) => tabIcon(tab.outline, tab.filled)({ ...props, focused: props.focused || homeContext, color: homeContext ? colors.accent : props.color }),
          ...(homeContext ? { tabBarLabelStyle: { fontFamily: systemFont, fontSize: 10, fontWeight: '600' as const, letterSpacing: 0.1, color: colors.accent } } : {})
        }} />;
      })}
      <Tabs.Screen
        name="plan"
        options={{
          href: null
        }}
      />
      {/* Reached from the Home header rather than the bar; see mainTabs. */}
      <Tabs.Screen
        name="settings"
        options={{
          href: null
        }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          href: null
        }}
      />
    </Tabs>
  );
}
