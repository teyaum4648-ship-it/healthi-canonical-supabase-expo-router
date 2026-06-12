import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

import { colors } from '../../../src/styles/theme';

type TabIconName = keyof typeof Ionicons.glyphMap;

function tabIcon(name: TabIconName) {
  return ({ color, size }: { color: string; size: number }) => (
    <Ionicons color={color} name={name} size={size} />
  );
}

export default function AppTabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.gold,
        tabBarInactiveTintColor: colors.mutedViolet,
        tabBarStyle: {
          borderTopColor: 'rgba(214, 168, 79, 0.26)',
          backgroundColor: colors.midnightPlum
        }
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: tabIcon('today-outline')
        }}
      />
      <Tabs.Screen
        name="movement"
        options={{
          title: 'Movement',
          tabBarIcon: tabIcon('body-outline')
        }}
      />
      <Tabs.Screen
        name="rhythm"
        options={{
          title: 'Rhythm',
          tabBarIcon: tabIcon('moon-outline')
        }}
      />
      <Tabs.Screen
        name="food"
        options={{
          title: 'Food',
          tabBarIcon: tabIcon('nutrition-outline')
        }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          title: 'Progress',
          tabBarIcon: tabIcon('trending-up-outline')
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: tabIcon('settings-outline')
        }}
      />
    </Tabs>
  );
}
