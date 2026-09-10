import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { fonts } from '../../styles/mobileTheme';
import type { SleepWindowTrackerPalette } from './SleepWindowTracker';
import { SleepTimeWheel } from './SleepTimeWheel';
import { sleepClockParts, sleepClockValue } from './sleepTimePickerModel';

const HOURS = Array.from({ length: 12 }, (_, index) => String(index + 1));
const MINUTES = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, '0'));
const PERIODS = ['AM', 'PM'] as const;

/** Mounted when opened. Cancel discards the draft; Done updates the parent editor only. */
export function SleepTimePicker({ label, value, palette, onCancel, onDone }: {
  label: string;
  value: string;
  palette: SleepWindowTrackerPalette;
  onCancel: () => void;
  onDone: (value: string) => void;
}) {
  const initial = sleepClockParts(value);
  const [draft, setDraft] = useState(initial ?? { hour: 12, minute: 0, period: 'AM' as const });
  const [changed, setChanged] = useState(false);
  const { fontScale, height } = useWindowDimensions();
  const rowHeight = Math.max(48, Math.ceil(30 * fontScale));
  const visibleRows = height < 520 ? 3 : 5;
  const output = sleepClockValue(draft);
  const valid = Boolean(output && (initial || changed));
  return (
    <Modal transparent visible animationType="slide" onRequestClose={onCancel} statusBarTranslucent>
      <View style={styles.backdrop}>
        <Pressable accessibilityLabel="Cancel time selection" onPress={onCancel} style={StyleSheet.absoluteFill} />
        <SafeAreaView edges={['bottom']} style={[styles.sheet, { backgroundColor: palette.surface, maxHeight: height }]}>
          <View style={[styles.header, { borderBottomColor: palette.border }]}>
            <Pressable accessibilityRole="button" onPress={onCancel} style={styles.action}><Text style={[styles.actionText, { color: palette.muted }]}>Cancel</Text></Pressable>
            <Text accessibilityRole="header" style={[styles.title, { color: palette.text }]}>{label}</Text>
            <Pressable accessibilityRole="button" disabled={!valid} onPress={() => { if (valid && output) onDone(output); }} style={styles.action}><Text style={[styles.actionText, { color: valid ? palette.accent : palette.faint, fontWeight: '600' }]}>Done</Text></Pressable>
          </View>
          <View style={styles.labels}>
            {['Hour', 'Minute', 'AM / PM'].map((text) => <Text key={text} style={[styles.label, { color: palette.muted }]}>{text}</Text>)}
          </View>
          <View style={styles.wheels}>
            <View pointerEvents="none" style={[styles.selection, { backgroundColor: palette.chip, borderColor: palette.border, top: rowHeight * Math.floor(visibleRows / 2), height: rowHeight }]} />
            <SleepTimeWheel label={`${label} hour`} options={HOURS} index={draft.hour - 1} onChange={(index) => { setChanged(true); setDraft((current) => ({ ...current, hour: index + 1 })); }} rowHeight={rowHeight} visibleRows={visibleRows} textColor={palette.text} mutedColor={palette.muted} />
            <SleepTimeWheel label={`${label} minute`} options={MINUTES} index={draft.minute} onChange={(minute) => { setChanged(true); setDraft((current) => ({ ...current, minute })); }} rowHeight={rowHeight} visibleRows={visibleRows} textColor={palette.text} mutedColor={palette.muted} />
            <SleepTimeWheel label={`${label} AM or PM`} options={PERIODS} index={draft.period === 'AM' ? 0 : 1} onChange={(index) => { setChanged(true); setDraft((current) => ({ ...current, period: PERIODS[index] })); }} rowHeight={rowHeight} visibleRows={visibleRows} textColor={palette.text} mutedColor={palette.muted} />
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(3,7,5,0.34)' },
  sheet: { borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingBottom: 16, width: '100%', maxWidth: 520, alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth },
  action: { minHeight: 48, minWidth: 64, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  actionText: { fontFamily: fonts.body, fontSize: 16 },
  title: { flex: 1, fontFamily: fonts.bodyMedium, fontWeight: '600', fontSize: 17, textAlign: 'center' },
  labels: { flexDirection: 'row', paddingHorizontal: 18, paddingTop: 18 },
  label: { flex: 1, fontFamily: fonts.body, fontSize: 14, textAlign: 'center' },
  wheels: { flexDirection: 'row', marginHorizontal: 18, marginTop: 4, position: 'relative' },
  selection: { left: 0, right: 0, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, position: 'absolute' }
});
