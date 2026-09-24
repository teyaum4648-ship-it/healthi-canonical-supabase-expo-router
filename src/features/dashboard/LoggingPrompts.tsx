import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, type } from '../../styles/mobileTheme';
import { pillarColors, pillarTint } from '../../styles/pillarColors';
import type { LoggingPromptId, LoggingPromptRow } from './loggingPrompts';

/**
 * The rows "Why this estimate?" opens on: one per thing a person can add, each with the
 * button that adds it. Rows already covered today stay in place and show a check.
 */
export function LoggingPrompts({ rows, onAction }: { rows: LoggingPromptRow[]; onAction: (id: LoggingPromptId) => void }) {
  return <View style={styles.list}>
    <Text style={styles.heading}>What would complete today</Text>
    {rows.map((row, index) => {
      const color = pillarColors[row.pillar];
      return <View key={row.id} style={[styles.row, index === rows.length - 1 && styles.last]}>
        <View style={[styles.tile, { backgroundColor: pillarTint(row.pillar) }]}>
          <Ionicons accessible={false} color={color} name={row.icon} size={19} />
        </View>
        <View style={styles.copy}>
          <Text style={[styles.pillar, { color }]}>{row.pillarName}</Text>
          <View style={styles.statusLine}>
            {row.done ? <Ionicons accessible={false} color={colors.textMuted} name="checkmark-circle" size={15} /> : null}
            <Text style={styles.status}>{row.status}</Text>
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${row.actionLabel}. ${row.pillarName}: ${row.status}`}
          hitSlop={4}
          onPress={() => onAction(row.id)}
          style={({ pressed }) => [styles.pill, { borderColor: color }, row.done && styles.pillQuiet, pressed && styles.pressed]}
        >
          <Text style={[styles.pillText, { color }]}>{row.actionLabel}</Text>
        </Pressable>
      </View>;
    })}
    <Text style={styles.footer}>Skipping one lowers confidence, never your score.</Text>
  </View>;
}

const styles = StyleSheet.create({
  list: { gap: 0 },
  heading: { ...type.body, color: colors.text, fontWeight: '600', marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderStrong },
  last: { borderBottomWidth: 0 },
  tile: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, minWidth: 0, gap: 2 },
  pillar: { ...type.caption, fontWeight: '600' },
  statusLine: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  status: { ...type.caption, fontSize: 14, lineHeight: 20, color: colors.text, flexShrink: 1 },
  pill: { minHeight: 44, minWidth: 76, paddingHorizontal: 14, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  pillQuiet: { borderColor: colors.borderStrong },
  pillText: { ...type.label },
  pressed: { opacity: 0.65 },
  footer: { ...type.caption, color: colors.textMuted, marginTop: 8 }
});
