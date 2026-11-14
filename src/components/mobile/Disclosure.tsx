import { Ionicons } from '@expo/vector-icons';
import { useState, type PropsWithChildren, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { colors, hairlineWidth, type, glassSurface } from '../../styles/mobileTheme';

/**
 * A box that opens when it is tapped.
 *
 * Closed, it is one row: what the section is, a one-line summary or value, and a chevron,
 * so a screen reads at a glance. Open, the detail sits under a hairline. Screens use it for
 * anything needed sometimes rather than every time, which keeps the first view short
 * without removing anything.
 *
 * `variant="row"` drops the card so several can share one card in a DisclosureGroup, the
 * way a settings list groups its rows.
 */
export function Disclosure({ title, detail, value, children, initiallyOpen = false, open: heldOpen, variant = 'card', last = false, onToggle }: PropsWithChildren<{
  title: string;
  /** A one-line summary under the title. */
  detail?: string;
  /** A short value at the right of the row, before the chevron. */
  value?: ReactNode;
  initiallyOpen?: boolean;
  /** Holds the box open, for when what is inside needs attention now. */
  open?: boolean;
  variant?: 'card' | 'row';
  /** The last row in a group draws no divider under itself. */
  last?: boolean;
  onToggle?: (open: boolean) => void;
}>) {
  const [ownOpen, setOpen] = useState(initiallyOpen);
  const open = Boolean(heldOpen) || ownOpen;
  const toggle = () => {
    setOpen(!open);
    onToggle?.(!open);
  };
  return (
    <View style={[variant === 'card' ? styles.card : styles.row, variant === 'row' && !last ? styles.divider : null]}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={toggle} style={({ pressed }) => [styles.header, pressed && styles.pressed]}>
        <View style={styles.copy}>
          <Text style={styles.title}>{title}</Text>
          {detail ? <Text numberOfLines={2} style={styles.detail}>{detail}</Text> : null}
        </View>
        {typeof value === 'string' ? <Text numberOfLines={1} style={styles.value}>{value}</Text> : value}
        <Ionicons accessible={false} name={open ? 'chevron-up' : 'chevron-down'} size={17} color={colors.textFaint} />
      </Pressable>
      {open ? <View style={styles.content}>{children}</View> : null}
    </View>
  );
}

/** One card holding several rows: Disclosure rows, or LinkRows that go somewhere. */
export function DisclosureGroup({ children, style }: PropsWithChildren<{ style?: ViewStyle }>) {
  return <View style={[styles.group, style]}>{children}</View>;
}

/** A row in a group that goes somewhere when tapped, with the same look as a Disclosure row. */
export function LinkRow({ title, detail, value, onPress, last = false }: { title: string; detail?: string; value?: string; onPress: () => void; last?: boolean }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.header, styles.row, !last && styles.divider, pressed && styles.pressed]}>
      <View style={styles.copy}>
        <Text style={styles.title}>{title}</Text>
        {detail ? <Text numberOfLines={2} style={styles.detail}>{detail}</Text> : null}
      </View>
      {value ? <Text numberOfLines={1} style={styles.value}>{value}</Text> : null}
      <Ionicons accessible={false} name="chevron-forward" size={17} color={colors.textFaint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { ...glassSurface, borderRadius: 20, paddingHorizontal: 16 },
  group: { ...glassSurface, borderRadius: 20, overflow: 'hidden', paddingHorizontal: 16 },
  row: {},
  divider: { borderBottomColor: colors.hairline, borderBottomWidth: hairlineWidth },
  header: { alignItems: 'center', flexDirection: 'row', gap: 10, minHeight: 56, paddingVertical: 12 },
  copy: { flex: 1, gap: 2, minWidth: 0 },
  title: { ...type.body, color: colors.text, fontWeight: '600', letterSpacing: -0.2, lineHeight: 21 },
  detail: { ...type.caption, color: colors.textMuted },
  value: { ...type.body, color: colors.textMuted, flexShrink: 1, fontVariant: ['tabular-nums'], maxWidth: '45%' },
  content: { borderTopColor: colors.hairline, borderTopWidth: hairlineWidth, gap: 12, paddingBottom: 16, paddingTop: 14 },
  pressed: { opacity: 0.65 }
});
