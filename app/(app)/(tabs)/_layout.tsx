import { Tabs, usePathname } from 'expo-router';

import { mainTabs } from '../../../src/features/navigation/navigationModel';
import { SideMenuProvider, useSideMenu } from '../../../src/features/navigation/SideMenu';
import { ThreadTabBar } from '../../../src/features/navigation/ThreadTabBar';
import { surface } from '../../../src/styles/daywoven1c';

export default function AppTabsLayout() {
  return (
    <SideMenuProvider>
      <AppTabs />
    </SideMenuProvider>
  );
}

/**
 * The 1c bottom tabs: Today, Sleep, Food, Move, Mind (see ThreadTabBar). Colour says what
 * data is, not which tab is open. The side menu that the old Menu tab opened now opens
 * from the "You" avatar on Today; its route stays so /menu still resolves.
 */
function AppTabs() {
  const menu = useSideMenu();
  const pathname = usePathname();
  /* Plan opens from Today's header, so Today stays lit while it is showing. */
  const litRoute = pathname === '/plan' ? 'index' : null;
  return (
    <Tabs
      backBehavior="history"
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: surface.canvas } }}
      tabBar={(props) => <ThreadTabBar {...props} litRoute={litRoute} />}
    >
      {mainTabs.map((tab) => <Tabs.Screen key={tab.route} name={tab.route} options={{ title: tab.label }} />)}
      {/*
        The old three-line Menu tab. It is off the bar now; the side menu opens from the
        "You" avatar on Today. The route stays, so a direct visit to /menu still opens it.
      */}
      <Tabs.Screen
        listeners={{ tabPress: (event) => { event.preventDefault(); menu.open(); } }}
        name="menu"
        options={{ href: null, title: 'Menu' }}
      />
      <Tabs.Screen name="plan" options={{ href: null }} />
      {/* Reached from the side menu rather than the bar; see mainTabs. */}
      <Tabs.Screen name="settings" options={{ href: null }} />
      <Tabs.Screen name="progress" options={{ href: null }} />
    </Tabs>
  );
}
