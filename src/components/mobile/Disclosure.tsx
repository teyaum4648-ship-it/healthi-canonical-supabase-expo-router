import { Ionicons } from '@expo/vector-icons';
import { useState, type PropsWithChildren } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, type, glassSurface } from '../../styles/mobileTheme';

export function Disclosure({ title, detail, children, initiallyOpen = false }: PropsWithChildren<{
  title: string; detail?: string; initiallyOpen?: boolean;
}>) {
  const [open, setOpen] = useState(initiallyOpen);
  return (
    <View style={styles.section}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen(!open)} style={({ pressed }) => [styles.header, pressed && styles.pressed]}>
        <View style={styles.copy}>
          <Text style={styles.title}>{title}</Text>
          {detail ? <Text style={styles.detail}>{detail}</Text> : null}
        </View>
        <Ionicons accessible={false} name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
      </Pressable>
      {open ? <View style={styles.content}>{children}</View> : null}
    </View>
  );
}
const styles = StyleSheet.create({
  section: { ...glassSurface, borderRadius: 20, paddingHorizontal: 18 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingVertical: 16 },
  copy: { flex: 1, gap: 4 },
  title: { ...type.body, color: colors.text, fontWeight: '600' },
  detail: { ...type.caption, fontSize: 14, lineHeight: 20, color: colors.textMuted },
  content: { paddingBottom: 18, gap: 12 },
  pressed: { opacity: 0.65 }
});
