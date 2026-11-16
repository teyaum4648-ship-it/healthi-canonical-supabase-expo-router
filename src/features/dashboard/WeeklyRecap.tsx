import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { EntrySheet } from '../../components/mobile/EntrySheet';
import { accent, font, HIT, ink, radius } from '../../styles/daywoven1c';
import { colors, type } from '../../styles/mobileTheme';
import { pillarColors } from '../../styles/pillarColors';
import type { WeeklyRecap } from './weekCards';

/**
 * The single row Today shows on Sunday and Monday, as a 1c amber-wash row. It can be put
 * away for the week. The row and the dismiss button are separate targets of at least 44pt.
 */
export function WeeklyRecapRow({ onOpen, onDismiss }: { onOpen: () => void; onDismiss: () => void }) {
  return <View style={styles.row}>
    <Pressable accessibilityRole="button" accessibilityLabel="Your week in review. Open" onPress={onOpen} style={({ pressed }) => [styles.rowMain, pressed && styles.pressed]}>
      <Ionicons accessible={false} color={ink.text} name="sparkles-outline" size={19} />
      <View style={styles.rowCopy}>
        <Text style={styles.rowTitle}>Your week in review</Text>
        <Text style={styles.rowDetail}>Four lines and one thing for next week</Text>
      </View>
      <Text style={styles.rowOpen}>Open</Text>
    </Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel="Not now" accessibilityHint="Hides this week’s review" onPress={onDismiss} style={({ pressed }) => [styles.dismiss, pressed && styles.pressed]}>
      <Ionicons accessible={false} color={ink.text} name="close" size={17} />
    </Pressable>
  </View>;
}

export function WeeklyRecapSheet({ recap, onClose, onTrends }: { recap: WeeklyRecap; onClose: () => void; onTrends: () => void }) {
  return <EntrySheet title="Your week" onClose={onClose} footer={
    <Pressable accessibilityRole="button" onPress={onTrends} style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
      <Text style={styles.buttonText}>See Trends</Text>
    </Pressable>
  }>
    <Text style={styles.lede}>The last seven days, described rather than graded.</Text>
    <View style={styles.list}>
      {recap.lines.map((line, index) => <View key={line.id} style={[styles.line, index === recap.lines.length - 1 && styles.lineLast]}>
        <View style={[styles.dot, { backgroundColor: pillarColors[line.pillar] }]} />
        <View style={styles.lineCopy}>
          <Text style={styles.lineTitle}>{line.title}</Text>
          <Text style={styles.lineText}>{line.text}</Text>
        </View>
      </View>)}
    </View>
    <View style={styles.focus}>
      <Text style={styles.focusLabel}>For next week</Text>
      {recap.focus
        ? <><Text style={styles.focusTitle}>{recap.focus.headline}</Text><Text style={styles.lineText}>{recap.focus.detail}</Text></>
        : <Text style={styles.lineText}>Nothing to change. Keep the week you just had.</Text>}
    </View>
  </EntrySheet>;
}

const styles = StyleSheet.create({
  row: { alignItems: 'center', backgroundColor: accent.amberWash, borderRadius: radius.card, flexDirection: 'row', marginTop: 16, paddingLeft: 16, paddingRight: 4 },
  rowMain: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: 12, minHeight: HIT, paddingVertical: 12 },
  rowCopy: { flex: 1, gap: 2, minWidth: 0 },
  rowTitle: { fontFamily: font.bodySemibold, fontSize: 14, color: ink.text },
  rowDetail: { fontFamily: font.body, fontSize: 12, lineHeight: 16.8, color: ink.mutedOnWash },
  rowOpen: { fontFamily: font.bodySemibold, fontSize: 13.5, color: ink.text, paddingHorizontal: 10 },
  dismiss: { alignItems: 'center', height: HIT, justifyContent: 'center', width: HIT },
  pressed: { opacity: 0.6 },
  lede: { ...type.body, color: colors.textMuted },
  list: { backgroundColor: colors.surfaceInset, borderRadius: 16, paddingHorizontal: 14 },
  line: { flexDirection: 'row', gap: 12, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderStrong },
  lineLast: { borderBottomWidth: 0 },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 7 },
  lineCopy: { flex: 1, gap: 2 },
  lineTitle: { ...type.label, color: colors.text },
  lineText: { ...type.body, fontSize: 15, lineHeight: 21, color: colors.textMuted },
  focus: { gap: 4 },
  focusLabel: { ...type.caption, fontWeight: '600', color: colors.accent },
  focusTitle: { ...type.body, fontWeight: '600', color: colors.text },
  button: { minHeight: 50, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  buttonText: { ...type.body, fontWeight: '600', color: colors.primaryText }
});
