import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Animated, Easing, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useReducedMotion } from '../../components/mobile/useReducedMotion';
import { APP_NAME, APP_VERSION } from '../../constants/brand';
import { supabase } from '../../lib/supabase';
import { colors, hairlineWidth, type } from '../../styles/mobileTheme';
import { useAuth } from '../auth/AuthProvider';
import { protocolScope } from '../dailyProtocol';
import { ConnectedHealthRow } from '../health/ConnectedHealthRow';
import { healthSource } from '../health/healthSource';
import { legalIndexUrl } from '../legal/legalLinks';
import type { SleepRhythmSupabaseClient } from '../sleepRhythm/persistence';
import { loadSleepHistory, saveSleepForSource } from '../sleepRhythm/sleepSessionSource';

/**
 * The menu behind the three-line tab: the account, the places that are not a pillar, and
 * the apps daywoven connects to.
 *
 * It slides in from the right because that is where the tab that opens it sits, so the
 * sheet comes from the thing that was tapped. Under reduced motion it fades instead.
 * Everything in it is a destination elsewhere in the app; nothing here is a second copy.
 */

type SideMenu = { open: () => void; close: () => void };
const SideMenuContext = createContext<SideMenu | null>(null);

export function useSideMenu(): SideMenu {
  const menu = useContext(SideMenuContext);
  if (!menu) throw new Error('useSideMenu needs a SideMenuProvider above it.');
  return menu;
}

const DURATION_MS = 260;

export function SideMenuProvider({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(false);
  // An Animated.Value made once; held in state so render never reads a ref.
  const [progress] = useState(() => new Animated.Value(0));
  const reduced = useReducedMotion();
  const { width } = useWindowDimensions();
  const panelWidth = Math.min(Math.round(width * 0.86), 360);

  const open = useCallback(() => {
    setVisible(true);
  }, []);

  const close = useCallback(() => {
    Animated.timing(progress, { toValue: 0, duration: reduced ? 120 : 200, easing: Easing.in(Easing.cubic), useNativeDriver: true })
      .start(() => setVisible(false));
  }, [progress, reduced]);

  useEffect(() => {
    if (!visible) return;
    progress.setValue(0);
    Animated.timing(progress, { toValue: 1, duration: reduced ? 140 : DURATION_MS, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [progress, reduced, visible]);

  const value = useMemo(() => ({ open, close }), [open, close]);
  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [reduced ? 0 : panelWidth, 0] });

  return (
    <SideMenuContext.Provider value={value}>
      {children}
      <Modal animationType="none" onRequestClose={close} statusBarTranslucent transparent visible={visible}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: progress }]}>
          <Pressable accessibilityLabel="Close the menu" accessibilityRole="button" onPress={close} style={StyleSheet.absoluteFill} />
        </Animated.View>
        <Animated.View
          accessibilityViewIsModal
          style={[styles.panel, { width: panelWidth, opacity: reduced ? progress : 1, transform: [{ translateX }] }]}
        >
          <SideMenuContent onClose={close} />
        </Animated.View>
      </Modal>
    </SideMenuContext.Provider>
  );
}

function MenuRow({ icon, title, detail, onPress }: { icon: keyof typeof Ionicons.glyphMap; title: string; detail?: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <View style={styles.rowIcon}><Ionicons accessible={false} color={colors.accent} name={icon} size={19} /></View>
      <View style={styles.rowCopy}>
        <Text style={styles.rowTitle}>{title}</Text>
        {detail ? <Text style={styles.rowDetail}>{detail}</Text> : null}
      </View>
      <Ionicons accessible={false} color={colors.textFaint} name="chevron-forward" size={16} />
    </Pressable>
  );
}

function SideMenuContent({ onClose }: { onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { user, profile, mode, signOut } = useAuth();
  const scope = useMemo(() => protocolScope(user?.id), [user?.id]);
  const name = (user?.user_metadata?.first_name as string | undefined) ?? profile?.display_name ?? null;
  const shownName = mode === 'demo' ? 'Demo' : name || 'Your account';
  const legal = legalIndexUrl();
  const sleepSource = { mode, userId: user?.id, client: supabase as unknown as SleepRhythmSupabaseClient };

  function go(href: Href) {
    onClose();
    router.navigate(href);
  }

  return (
    <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }]}>
      <View style={styles.header}>
        <Text accessibilityRole="header" style={styles.wordmark}>{APP_NAME}</Text>
        <Pressable accessibilityLabel="Close the menu" accessibilityRole="button" hitSlop={8} onPress={onClose} style={styles.close}>
          <Ionicons color={colors.text} name="close" size={22} />
        </Pressable>
      </View>

      <View style={styles.account}>
        <View style={styles.avatar}><Text style={styles.avatarLetter}>{shownName.slice(0, 1).toUpperCase()}</Text></View>
        <View style={styles.rowCopy}>
          <Text style={styles.accountName}>{shownName}</Text>
          <Text style={styles.rowDetail}>{mode === 'demo' ? 'Saved on this device only' : user?.email ?? 'Signed in'}</Text>
        </View>
      </View>

      <Text style={styles.groupLabel}>You</Text>
      <View style={styles.group}>
        <MenuRow detail="Goals, allergens, units and your baseline" icon="person-circle-outline" onPress={() => go('/settings')} title="Profile and preferences" />
        <MenuRow detail="Where your readiness starts each day" icon="compass-outline" onPress={() => go('/load-check')} title="Load check" />
        <MenuRow detail="Sleep, food, movement and mood over time" icon="stats-chart-outline" onPress={() => go('/progress')} title="Trends" />
        <MenuRow detail="Your day, block by block" icon="calendar-outline" onPress={() => go('/plan')} title="Plan and calendar" />
        <MenuRow detail="Close the day in a minute" icon="moon-outline" onPress={() => go('/closeout')} title="Evening check-in" />
      </View>

      <Text style={styles.groupLabel}>Extensions</Text>
      <View style={[styles.group, styles.extensions]}>
        <ConnectedHealthRow
          readSleep={async () => (await loadSleepHistory(sleepSource)).sessions}
          saveSleep={(session) => saveSleepForSource(sleepSource, session)}
          scope={scope}
          source={healthSource}
        />
      </View>

      {legal ? (
        <>
          <Text style={styles.groupLabel}>About</Text>
          <View style={styles.group}>
            <MenuRow detail="Privacy, terms, cookies and accessibility" icon="document-text-outline" onPress={() => void Linking.openURL(legal)} title="Legal and privacy" />
          </View>
        </>
      ) : null}

      <Pressable accessibilityRole="button" onPress={() => { onClose(); void signOut(); }} style={({ pressed }) => [styles.signOut, pressed && styles.pressed]}>
        <Text style={styles.signOutText}>{mode === 'demo' ? 'Leave the demo' : 'Sign out'}</Text>
      </Pressable>
      <Text style={styles.version}>{APP_NAME} {APP_VERSION} · general wellness guidance</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: 'rgba(4, 6, 10, 0.55)' },
  panel: {
    backgroundColor: '#12161D',
    borderLeftColor: colors.border,
    borderLeftWidth: hairlineWidth,
    bottom: 0,
    position: 'absolute',
    right: 0,
    shadowColor: '#000',
    shadowOffset: { width: -8, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    top: 0
  },
  content: { gap: 10, paddingHorizontal: 20 },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  wordmark: { ...type.heading, color: colors.text, fontSize: 22, fontWeight: '700', letterSpacing: -0.6 },
  close: { alignItems: 'center', height: 40, justifyContent: 'center', marginRight: -8, width: 40 },
  account: { alignItems: 'center', flexDirection: 'row', gap: 12, paddingVertical: 8 },
  avatar: { alignItems: 'center', backgroundColor: colors.accentWash, borderRadius: 22, height: 44, justifyContent: 'center', width: 44 },
  avatarLetter: { ...type.label, color: colors.accent, fontSize: 18 },
  accountName: { ...type.label, color: colors.text, fontSize: 17 },
  groupLabel: { ...type.label, color: colors.textMuted, fontSize: 13, letterSpacing: 0, marginTop: 14 },
  group: { backgroundColor: 'rgba(235, 240, 255, 0.04)', borderColor: colors.border, borderRadius: 16, borderWidth: hairlineWidth, overflow: 'hidden' },
  extensions: { paddingHorizontal: 14 },
  row: { alignItems: 'center', borderBottomColor: colors.hairlineSoft, borderBottomWidth: hairlineWidth, flexDirection: 'row', gap: 12, minHeight: 56, paddingHorizontal: 14, paddingVertical: 10 },
  rowIcon: { alignItems: 'center', width: 24 },
  rowCopy: { flex: 1, gap: 2, minWidth: 0 },
  rowTitle: { ...type.label, color: colors.text },
  rowDetail: { ...type.caption, color: colors.textMuted },
  pressed: { opacity: 0.7 },
  signOut: { alignItems: 'center', borderColor: colors.border, borderRadius: 14, borderWidth: hairlineWidth, justifyContent: 'center', marginTop: 22, minHeight: 48 },
  signOutText: { ...type.label, color: colors.text },
  version: { ...type.caption, color: colors.textFaint, marginTop: 6, textAlign: 'center' }
});
