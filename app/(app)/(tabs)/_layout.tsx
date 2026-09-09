import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { Platform } from 'react-native';

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
  return (
    <Tabs
      screenOptions={() => {
        return {
          headerShown: false,
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: colors.textFaint,
          tabBarLabelStyle: {
            fontFamily: systemFont,
            fontSize: 11,
            fontWeight: '600',
            letterSpacing: 0.1
          },
          tabBarStyle: {
            borderTopColor: colors.hairline,
            borderTopWidth: hairlineWidth,
            backgroundColor: '#08080A',
            height: 78,
            paddingBottom: 14,
            paddingTop: 9
          }
        };
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: tabIcon('home-outline', 'home')
        }}
      />
      <Tabs.Screen
        name="plan"
        options={{
          title: 'Plan',
          tabBarIcon: tabIcon('calendar-outline', 'calendar')
        }}
      />
      <Tabs.Screen
        name="movement"
        options={{
          title: 'Move',
          tabBarIcon: tabIcon('body-outline', 'body')
        }}
      />
      <Tabs.Screen
        name="rhythm"
        options={{
          title: 'Sleep',
          tabBarIcon: tabIcon('moon-outline', 'moon')
        }}
      />
      <Tabs.Screen
        name="food"
        options={{
          title: 'Diet',
          tabBarIcon: tabIcon('nutrition-outline', 'nutrition')
        }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          href: null
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'You',
          tabBarIcon: tabIcon('person-outline', 'person')
        }}
      />
    </Tabs>
  );
}
