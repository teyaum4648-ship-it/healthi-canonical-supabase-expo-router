import { Ionicons } from '@expo/vector-icons';
import { Tabs, usePathname } from 'expo-router';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { mainTabs } from '../../../src/features/navigation/navigationModel';

import { colors, fonts, hairlineWidth } from '../../../src/styles/mobileTheme';

type TabIconName = keyof typeof Ionicons.glyphMap;

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
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarLabelStyle: {
            fontFamily: systemFont,
            fontSize: 12,
            fontWeight: '600',
            letterSpacing: 0.1
          },
          tabBarStyle: {
            borderTopColor: colors.hairline,
            borderTopWidth: hairlineWidth,
            backgroundColor: '#08080A',
            height: 62 + Math.max(insets.bottom, 8),
            paddingBottom: Math.max(insets.bottom, 8),
            paddingTop: 9
          }
        };
      }}
    >
      {mainTabs.map((tab) => {
        const homeContext = tab.route === 'index' && inHomeCalendar;
        return <Tabs.Screen key={tab.route} name={tab.route} options={{
          title: tab.label,
          // Keep the actual navigation state intact so Home remains tappable from Plan.
          tabBarIcon: (props) => tabIcon(tab.outline, tab.filled)({ ...props, focused: props.focused || homeContext, color: homeContext ? colors.accent : props.color }),
          ...(homeContext ? { tabBarLabelStyle: { fontFamily: systemFont, fontSize: 12, fontWeight: '600' as const, letterSpacing: 0.1, color: colors.accent } } : {})
        }} />;
      })}
      <Tabs.Screen
        name="plan"
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
