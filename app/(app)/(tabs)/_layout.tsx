import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

import { colors, fonts, hairlineWidth } from '../../../src/styles/theme';

type TabIconName = keyof typeof Ionicons.glyphMap;

function tabIcon(outline: TabIconName, filled: TabIconName) {
  return ({ color, focused, size }: { color: string; focused: boolean; size: number }) => (
    <Ionicons color={color} name={focused ? filled : outline} size={size - 2} />
  );
}

export default function AppTabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarLabelStyle: {
          fontFamily: fonts.bodyMedium,
          fontSize: 10,
          fontWeight: '500',
          letterSpacing: 0.2
        },
        tabBarStyle: {
          borderTopColor: colors.hairline,
          borderTopWidth: hairlineWidth,
          backgroundColor: colors.background,
          height: 74,
          paddingBottom: 12,
          paddingTop: 10
        }
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
          title: 'Trends',
          tabBarIcon: tabIcon('trending-up-outline', 'trending-up')
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
