import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, type } from '../../styles/mobileTheme';

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
      {icon ? <Ionicons color={colors.accent} name={icon} size={22} /> : null}
      <View style={styles.copy}>
        <Text style={styles.title}>{title}</Text>
        {detail ? <Text style={styles.detail}>{detail}</Text> : null}
      </View>
      {value ? <Text style={styles.value}>{value}</Text> : null}
      <Ionicons accessible={false} color={colors.textMuted} name="chevron-forward" size={17} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: 'center', flexDirection: 'row', gap: 12, minHeight: 64, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderStrong },
  last: { borderBottomWidth: 0 },
  pressed: { opacity: 0.65 },
  copy: { flex: 1, minWidth: 0, gap: 3 },
  title: { ...type.body, color: colors.text, fontWeight: '600' },
  detail: { ...type.caption, fontSize: 14, lineHeight: 20, color: colors.textMuted },
  value: { ...type.label, color: colors.textMuted, maxWidth: '30%', textAlign: 'right' }
});
