import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { dayTitle, shiftDay } from '../../features/navigation/navigationModel';
import { colors, type } from '../../styles/mobileTheme';

export function DayNavigator({ date, today, onChange, earliest, disabled = false, palette }: {
  date: string; today: string; onChange: (date: string) => void; earliest?: string; disabled?: boolean;
  palette?: { text: string; muted: string; accent: string; surfaceAlt: string };
}) {
  const previousDisabled = disabled || Boolean(earliest && date <= earliest);
  const foreground = palette?.text ?? colors.text;
  const secondary = palette?.muted ?? colors.textMuted;
  const accent = palette?.accent ?? colors.accentMid;
  const surface = { backgroundColor: palette?.surfaceAlt ?? colors.surfaceInset };
  return (
    <View style={styles.row}>
      <Pressable accessibilityRole="button" accessibilityLabel="Previous day" disabled={previousDisabled} onPress={() => onChange(shiftDay(date, -1))} style={[styles.arrow, surface, previousDisabled && styles.disabled]}>
        <Ionicons name="chevron-back" size={21} color={foreground} />
      </Pressable>
      <View style={styles.copy}>
        <Text style={[styles.title, { color: foreground }]}>{dayTitle(date, today)}</Text>
        <Text style={[styles.date, { color: secondary }]}>{new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</Text>
      </View>
      {date !== today ? <Pressable accessibilityRole="button" disabled={disabled} onPress={() => onChange(today)} style={styles.today}><Text style={[styles.todayText, { color: accent }]}>Today</Text></Pressable> : null}
      <Pressable accessibilityRole="button" accessibilityLabel="Next day" disabled={disabled || date >= today} onPress={() => onChange(shiftDay(date, 1))} style={[styles.arrow, surface, (disabled || date >= today) && styles.disabled]}>
        <Ionicons name="chevron-forward" size={21} color={foreground} />
      </Pressable>
    </View>
  );
}
const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  copy: { flex: 1, gap: 2 },
  arrow: { minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center', borderRadius: 14, backgroundColor: colors.surfaceInset },
  title: { ...type.body, fontWeight: '600', color: colors.text },
  date: { ...type.caption, color: colors.textMuted },
  today: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 },
  todayText: { ...type.label, color: colors.accentMid },
  disabled: { opacity: 0.3 }
});
