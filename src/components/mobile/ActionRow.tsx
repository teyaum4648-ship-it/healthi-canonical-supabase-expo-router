import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { font, HIT, ink } from '../../styles/daywoven1c';

/**
 * A 1c hairline row (design language P4): title and detail on the left, a right-aligned
 * tabular value, a chevron, and a hairline between rows. No card around each row.
 */
export function ActionRow({ title, detail, icon, onPress, value, last = false }: {
  title: string;
  detail?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  value?: string;
  last?: boolean;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.row, last && styles.last, pressed && styles.pressed]}>
      {icon ? <Ionicons accessible={false} color={ink.text} name={icon} size={20} /> : null}
      <View style={styles.copy}>
        <Text style={styles.title}>{title}</Text>
        {detail ? <Text style={styles.detail}>{detail}</Text> : null}
      </View>
      {value ? <Text style={styles.value}>{value}</Text> : null}
      <Ionicons accessible={false} color={ink.muted} name="chevron-forward" size={16} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: 'center', borderBottomColor: ink.hairline, borderBottomWidth: 1, flexDirection: 'row', gap: 12, minHeight: HIT + 8, paddingVertical: 12 },
  last: { borderBottomWidth: 0 },
  pressed: { opacity: 0.65 },
  copy: { flex: 1, gap: 2, minWidth: 0 },
  title: { color: ink.text, fontFamily: font.bodyMedium, fontSize: 14.5, lineHeight: 20 },
  detail: { color: ink.muted, fontFamily: font.body, fontSize: 12, lineHeight: 17 },
  value: { color: ink.text, fontFamily: font.body, fontSize: 13.5, fontVariant: ['tabular-nums'], maxWidth: '35%', textAlign: 'right' }
});
