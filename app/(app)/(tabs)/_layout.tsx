import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { Platform } from 'react-native';

import { colors, fonts, hairlineWidth } from '../../../src/styles/theme';

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
      screenOptions={({ route }) => {
        const homeIsFocused = route.name === 'index';
        return {
          headerShown: false,
          tabBarActiveTintColor: homeIsFocused ? '#0A84FF' : colors.accent,
          tabBarInactiveTintColor: homeIsFocused ? '#6E6E73' : colors.textFaint,
          tabBarLabelStyle: {
            fontFamily: homeIsFocused ? systemFont : fonts.bodyMedium,
            fontSize: 10,
            fontWeight: '500',
            letterSpacing: 0.2
          },
          tabBarStyle: {
            borderTopColor: homeIsFocused ? 'rgba(255, 255, 255, 0.075)' : colors.hairline,
            borderTopWidth: hairlineWidth,
            backgroundColor: homeIsFocused ? '#08080A' : colors.background,
            height: 74,
            paddingBottom: 12,
            paddingTop: 10
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
