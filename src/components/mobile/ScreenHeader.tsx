import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useSideMenu } from '../../features/navigation/SideMenu';
import { colors, type } from '../../styles/mobileTheme';

/** The date the way every header shows it: "TUE, NOV 10". */
export function headerDate(date = new Date()): string {
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

/**
 * The opener the tab screens share: a small date above a large title, any actions the
 * screen needs, and the profile button that opens the menu (account, settings, connected
 * apps). One component so every tab starts the same way.
 */
export function ScreenHeader({ title, eyebrow = headerDate(), actions }: { title: string; eyebrow?: string | null; actions?: ReactNode }) {
  const menu = useSideMenu();
  return (
    <View style={styles.row}>
      <View style={styles.copy}>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <Text accessibilityRole="header" numberOfLines={1} style={styles.title}>{title}</Text>
      </View>
      {actions}
      <Pressable accessibilityLabel="Your profile and settings" accessibilityRole="button" hitSlop={4} onPress={menu.open} style={({ pressed }) => [styles.profile, pressed && styles.pressed]}>
        <Ionicons accessible={false} color={colors.text} name="person-outline" size={19} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  copy: { flex: 1, gap: 2, minWidth: 0 },
  eyebrow: { ...type.eyebrow, color: colors.textMuted },
  title: { ...type.largeTitle, color: colors.text },
  profile: { alignItems: 'center', backgroundColor: colors.surfaceInset, borderRadius: 22, height: 44, justifyContent: 'center', width: 44 },
  pressed: { opacity: 0.7 }
});
