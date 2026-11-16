import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { font, HIT, ink, pillarOnCanvas } from '../../styles/daywoven1c';
import { colors, type, fonts } from '../../styles/mobileTheme';
import { pillarColors, pillarTint } from '../../styles/pillarColors';
import type { LoggingPromptId, LoggingPromptRow } from './loggingPrompts';

/**
 * The rows "Why this estimate?" opens on: one per thing a person can add, each with the
 * button that adds it. Rows already covered today stay in place and show a check.
 *
 * `tone` follows the surface it sits on: "sheet" for the current dark sheets (unchanged
 * until Phase 3 moves sheets to 1c), "canvas" for a 1c white card on Today.
 */
export function LoggingPrompts({ rows, onAction, tone = 'sheet' }: { rows: LoggingPromptRow[]; onAction: (id: LoggingPromptId) => void; tone?: 'sheet' | 'canvas' }) {
  const canvas = tone === 'canvas';
  return <View style={styles.list}>
    <Text accessibilityRole={canvas ? 'header' : undefined} style={canvas ? light.heading : styles.heading}>What would complete today</Text>
    {rows.map((row, index) => {
      const color = canvas ? pillarOnCanvas[row.pillar] : pillarColors[row.pillar];
      const last = index === rows.length - 1;
      return <View key={row.id} style={canvas ? [light.row, last && light.last] : [styles.row, last && styles.last]}>
        {canvas
          ? <Ionicons accessible={false} color={color} name={row.icon} size={18} />
          : <View style={[styles.tile, { backgroundColor: pillarTint(row.pillar) }]}>
            <Ionicons accessible={false} color={color} name={row.icon} size={19} />
          </View>}
        <View style={styles.copy}>
          <Text style={canvas ? [light.pillar, { color }] : [styles.pillar, { color }]}>{row.pillarName}</Text>
          <View style={styles.statusLine}>
            {row.done ? <Ionicons accessible={false} color={canvas ? ink.muted : colors.textMuted} name="checkmark-circle" size={15} /> : null}
            <Text style={canvas ? light.status : styles.status}>{row.status}</Text>
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${row.actionLabel}. ${row.pillarName}: ${row.status}`}
          hitSlop={4}
          onPress={() => onAction(row.id)}
          style={({ pressed }) => canvas
            ? [light.pill, pressed && styles.pressed]
            : [styles.pill, { borderColor: color }, row.done && styles.pillQuiet, pressed && styles.pressed]}
        >
          <Text style={canvas ? light.pillText : [styles.pillText, { color }]}>{row.actionLabel}</Text>
        </Pressable>
      </View>;
    })}
    <Text style={canvas ? light.footer : styles.footer}>Skipping one lowers confidence, never your score.</Text>
  </View>;
}

const styles = StyleSheet.create({
  list: { gap: 0 },
  heading: { ...type.body, color: colors.text, fontFamily: fonts.bodySemibold, marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderStrong },
  last: { borderBottomWidth: 0 },
  tile: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, minWidth: 0, gap: 2 },
  pillar: { ...type.caption, fontFamily: fonts.bodySemibold },
  statusLine: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  status: { ...type.caption, fontSize: 14, lineHeight: 20, color: colors.text, flexShrink: 1 },
  pill: { minHeight: 44, minWidth: 76, paddingHorizontal: 14, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  pillQuiet: { borderColor: colors.borderStrong },
  pillText: { ...type.label },
  pressed: { opacity: 0.65 },
  footer: { ...type.caption, color: colors.textMuted, marginTop: 8 }
});

/** The 1c canvas look: hairline rows, ink text, pillar colour only on the small marks. */
const light = StyleSheet.create({
  heading: { fontFamily: font.bodySemibold, fontSize: 14, color: ink.text, marginBottom: 2 },
  row: { alignItems: 'center', borderBottomColor: ink.hairline, borderBottomWidth: 1, flexDirection: 'row', gap: 12, minHeight: 56, paddingVertical: 8 },
  last: { borderBottomWidth: 0 },
  pillar: { fontFamily: font.bodySemibold, fontSize: 11.5 },
  status: { fontFamily: font.body, fontSize: 13, lineHeight: 18, color: ink.text, flexShrink: 1 },
  pill: { alignItems: 'center', borderColor: ink.border, borderRadius: 18, borderWidth: 1, justifyContent: 'center', minHeight: HIT - 8, minWidth: 64, paddingHorizontal: 12 },
  pillText: { fontFamily: font.bodyMedium, fontSize: 12.5, color: ink.text },
  footer: { fontFamily: font.body, fontSize: 11.5, lineHeight: 16, color: ink.muted, marginTop: 6 }
});
