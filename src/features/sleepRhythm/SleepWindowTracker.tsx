import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import type { SleepSession } from '../../engines/circadian';
import { fonts } from '../../styles/theme';
import {
  SLEEP_WINDOW_TIMELINE,
  adjustSleepWindowClock,
  confirmSleepWindow,
  correctSleepWindow,
  inferSleepWindow,
  sleepWindowClockValue,
  sleepWindowSourceLabel,
  suggestAwakePeriod,
  type SleepWindowClockInterval,
  type SleepWindowRecord
} from './sleepWindowEngine';

export type SleepWindowTrackerPalette = {
  surface: string;
  surfaceAlt: string;
  border: string;
  hairline: string;
  text: string;
  muted: string;
  faint: string;
  accent: string;
  accentSoft: string;
  primary: string;
  primaryText: string;
  amber: string;
  chip: string;
};

type SleepWindowTrackerProps = {
  date: string;
  timezone: string;
  sessions: SleepSession[];
  preferredBedtime?: string | null;
  preferredWakeTime?: string | null;
  palette: SleepWindowTrackerPalette;
  isSaving: boolean;
  onSave: (record: SleepWindowRecord) => Promise<boolean>;
};

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'UTC'
  });
}

function formatMinutes(value: number): string {
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  if (hours === 0) return `${minutes}m`;
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
}

function timelineMinute(value: string): number {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return SLEEP_WINDOW_TIMELINE.start_minute;
  const clock = date.getUTCHours() * 60 + date.getUTCMinutes();
  return clock < SLEEP_WINDOW_TIMELINE.start_minute ? clock + 24 * 60 : clock;
}

function timelinePercent(value: string): `${number}%` {
  const span = SLEEP_WINDOW_TIMELINE.end_minute - SLEEP_WINDOW_TIMELINE.start_minute;
  const minute = timelineMinute(value);
  const percent = Math.max(0, Math.min(100, ((minute - SLEEP_WINDOW_TIMELINE.start_minute) / span) * 100));
  return `${percent}%`;
}

function intervalWidth(start: string, end: string): `${number}%` {
  const span = SLEEP_WINDOW_TIMELINE.end_minute - SLEEP_WINDOW_TIMELINE.start_minute;
  const startMinute = timelineMinute(start);
  let endMinute = timelineMinute(end);
  if (endMinute <= startMinute) endMinute += 24 * 60;
  return `${Math.max(0, Math.min(100, ((endMinute - startMinute) / span) * 100))}%`;
}

function awakePeriodsFrom(record: SleepWindowRecord): SleepWindowClockInterval[] {
  return record.intervals
    .filter((interval) => interval.state === 'awake')
    .map((interval) => ({
      id: interval.id,
      start_time: sleepWindowClockValue(interval.start_at),
      end_time: sleepWindowClockValue(interval.end_at)
    }));
}

function TimeAdjuster({
  label,
  value,
  onChange,
  palette
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  palette: SleepWindowTrackerPalette;
}) {
  return (
    <View style={[styles.timeAdjuster, { backgroundColor: palette.chip, borderColor: palette.hairline }]}>
      <Text style={[styles.timeLabel, { color: palette.faint }]}>{label}</Text>
      <View style={styles.timeControlRow}>
        <Pressable
          accessibilityLabel={`Move ${label.toLowerCase()} fifteen minutes earlier`}
          onPress={() => onChange(adjustSleepWindowClock(value, -15))}
          style={({ pressed }) => [styles.timeStepButton, { borderColor: palette.border }, pressed && styles.pressed]}
        >
          <Ionicons color={palette.muted} name="remove" size={18} />
        </Pressable>
        <Text style={[styles.timeValue, { color: palette.text }]}>{formatTime(`2000-01-01T${value}:00.000Z`)}</Text>
        <Pressable
          accessibilityLabel={`Move ${label.toLowerCase()} fifteen minutes later`}
          onPress={() => onChange(adjustSleepWindowClock(value, 15))}
          style={({ pressed }) => [styles.timeStepButton, { borderColor: palette.border }, pressed && styles.pressed]}
        >
          <Ionicons color={palette.muted} name="add" size={18} />
        </Pressable>
      </View>
    </View>
  );
}

export function SleepWindowTracker(props: SleepWindowTrackerProps) {
  const inferred = useMemo(() => inferSleepWindow({
    date: props.date,
    timezone: props.timezone,
    sessions: props.sessions,
    preferredBedtime: props.preferredBedtime,
    preferredWakeTime: props.preferredWakeTime
  }), [props.date, props.preferredBedtime, props.preferredWakeTime, props.sessions, props.timezone]);
  const [record, setRecord] = useState(inferred);
  const [editing, setEditing] = useState(false);
  const [startTime, setStartTime] = useState(() => sleepWindowClockValue(inferred.start_at));
  const [endTime, setEndTime] = useState(() => sleepWindowClockValue(inferred.end_at));
  const [awakePeriods, setAwakePeriods] = useState<SleepWindowClockInterval[]>(() => awakePeriodsFrom(inferred));
  const [localSaving, setLocalSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editing) return;
    setRecord(inferred);
    setStartTime(sleepWindowClockValue(inferred.start_at));
    setEndTime(sleepWindowClockValue(inferred.end_at));
    setAwakePeriods(awakePeriodsFrom(inferred));
  }, [editing, inferred]);

  const busy = localSaving || props.isSaving;
  const canConfirm = record.status === 'estimated' || record.status === 'recorded';
  const statusLabel = record.status === 'recorded'
    ? 'Recorded'
    : record.status === 'corrected'
      ? 'Corrected'
      : record.status === 'confirmed'
        ? 'Confirmed'
        : 'Estimated';

  function beginEditing() {
    setStartTime(sleepWindowClockValue(record.start_at));
    setEndTime(sleepWindowClockValue(record.end_at));
    setAwakePeriods(awakePeriodsFrom(record));
    setError(null);
    setEditing(true);
  }

  async function persist(next: SleepWindowRecord) {
    setLocalSaving(true);
    setError(null);
    try {
      const saved = await props.onSave(next);
      if (!saved) {
        setError('This window could not be saved. Your current estimate is still available.');
        return;
      }
      setRecord(next);
      setEditing(false);
    } finally {
      setLocalSaving(false);
    }
  }

  async function confirm() {
    await persist(confirmSleepWindow(record));
  }

  async function saveCorrection() {
    const corrected = correctSleepWindow(record, {
      start_time: startTime,
      end_time: endTime,
      awake_periods: awakePeriods
    });
    if (!corrected) {
      setError('Keep awake periods inside the sleep window and make sure they do not overlap.');
      return;
    }
    await persist(corrected);
  }

  function addAwakePeriod() {
    setAwakePeriods((current) => [...current, suggestAwakePeriod(record, current.length)]);
    setError(null);
  }

  return (
    <View style={styles.sectionPad}>
      <View style={[styles.card, { backgroundColor: props.palette.surface, borderColor: props.palette.border }]}>
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.eyebrow, { color: props.palette.faint }]}>Last night</Text>
            <Text style={[styles.cardTitle, { color: props.palette.text }]}>Your sleep window</Text>
          </View>
          <View style={[styles.statusChip, { backgroundColor: props.palette.accentSoft }]}>
            <Ionicons
              color={props.palette.accent}
              name={record.status === 'confirmed' || record.status === 'corrected' ? 'checkmark-circle' : 'sparkles'}
              size={14}
            />
            <Text style={[styles.statusText, { color: props.palette.accent }]}>{statusLabel}</Text>
          </View>
        </View>

        <View style={styles.rangeRow}>
          <Text style={[styles.range, { color: props.palette.text }]}>
            {formatTime(record.start_at)} <Text style={{ color: props.palette.faint }}>–</Text> {formatTime(record.end_at)}
          </Text>
          <Text style={[styles.duration, { color: props.palette.accent }]}>{formatMinutes(record.asleep_minutes)}</Text>
        </View>
        <Text style={[styles.source, { color: props.palette.muted }]}>{sleepWindowSourceLabel(record)}</Text>

        <View style={[styles.timelineShell, { backgroundColor: props.palette.chip }]}>
          <View style={[styles.timelineBaseline, { backgroundColor: props.palette.hairline }]} />
          {record.intervals.map((interval) => (
            <View
              key={interval.id}
              style={[
                styles.timelineInterval,
                {
                  backgroundColor: interval.state === 'awake' ? props.palette.amber : props.palette.accent,
                  left: timelinePercent(interval.start_at),
                  width: intervalWidth(interval.start_at, interval.end_at)
                }
              ]}
            />
          ))}
        </View>
        <View style={styles.timelineLabels}>
          {['6 PM', 'Midnight', '6 AM', 'Noon'].map((label) => (
            <Text key={label} style={[styles.timelineLabel, { color: props.palette.faint }]}>{label}</Text>
          ))}
        </View>

        <View style={[styles.contextRow, { borderTopColor: props.palette.hairline }]}>
          <Ionicons color={props.palette.faint} name="information-circle-outline" size={17} />
          <Text style={[styles.contextText, { color: props.palette.muted }]}>
            This estimates timing, not sleep stages. Confidence is {record.source_confidence}.
          </Text>
        </View>

        {editing ? (
          <View style={[styles.editor, { borderTopColor: props.palette.hairline }]}>
            <Text style={[styles.editorTitle, { color: props.palette.text }]}>Adjust last night</Text>
            <Text style={[styles.editorSupport, { color: props.palette.muted }]}>Tap − or + to move each time by 15 minutes.</Text>
            <View style={styles.timeGrid}>
              <TimeAdjuster label="Fell asleep" onChange={setStartTime} palette={props.palette} value={startTime} />
              <TimeAdjuster label="Woke up" onChange={setEndTime} palette={props.palette} value={endTime} />
            </View>

            {awakePeriods.map((period, index) => (
              <View key={period.id} style={[styles.awakeCard, { borderColor: props.palette.hairline }]}>
                <View style={styles.awakeHeader}>
                  <View style={styles.awakeTitleRow}>
                    <View style={[styles.awakeDot, { backgroundColor: props.palette.amber }]} />
                    <Text style={[styles.awakeTitle, { color: props.palette.text }]}>Awake period {index + 1}</Text>
                  </View>
                  <Pressable
                    accessibilityLabel={`Remove awake period ${index + 1}`}
                    onPress={() => setAwakePeriods((current) => current.filter((item) => item.id !== period.id))}
                    style={({ pressed }) => [styles.removeButton, pressed && styles.pressed]}
                  >
                    <Ionicons color={props.palette.muted} name="trash-outline" size={18} />
                  </Pressable>
                </View>
                <View style={styles.timeGrid}>
                  <TimeAdjuster
                    label="Awake"
                    onChange={(value) => setAwakePeriods((current) => current.map((item) => item.id === period.id ? { ...item, start_time: value } : item))}
                    palette={props.palette}
                    value={period.start_time}
                  />
                  <TimeAdjuster
                    label="Back asleep"
                    onChange={(value) => setAwakePeriods((current) => current.map((item) => item.id === period.id ? { ...item, end_time: value } : item))}
                    palette={props.palette}
                    value={period.end_time}
                  />
                </View>
              </View>
            ))}

            <Pressable
              accessibilityRole="button"
              onPress={addAwakePeriod}
              style={({ pressed }) => [styles.addAwakeButton, { borderColor: props.palette.border }, pressed && styles.pressed]}
            >
              <Ionicons color={props.palette.accent} name="add-circle-outline" size={18} />
              <Text style={[styles.addAwakeText, { color: props.palette.accent }]}>Add awake time</Text>
            </Pressable>

            {error ? <Text accessibilityRole="alert" style={[styles.errorText, { color: props.palette.amber }]}>{error}</Text> : null}
            <View style={styles.actionRow}>
              <Pressable
                disabled={busy}
                onPress={() => { setEditing(false); setError(null); }}
                style={({ pressed }) => [styles.secondaryAction, { borderColor: props.palette.border }, pressed && styles.pressed, busy && styles.disabled]}
              >
                <Text style={[styles.secondaryActionText, { color: props.palette.muted }]}>Cancel</Text>
              </Pressable>
              <Pressable
                disabled={busy}
                onPress={() => void saveCorrection()}
                style={({ pressed }) => [styles.primaryAction, { backgroundColor: props.palette.primary }, pressed && styles.pressed, busy && styles.disabled]}
              >
                {busy ? <ActivityIndicator color={props.palette.primaryText} /> : <Text style={[styles.primaryActionText, { color: props.palette.primaryText }]}>Save window</Text>}
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.actionRow}>
            {canConfirm ? (
              <Pressable
                disabled={busy}
                onPress={() => void confirm()}
                style={({ pressed }) => [styles.primaryAction, { backgroundColor: props.palette.primary }, pressed && styles.pressed, busy && styles.disabled]}
              >
                {busy ? <ActivityIndicator color={props.palette.primaryText} /> : (
                  <>
                    <Ionicons color={props.palette.primaryText} name="checkmark" size={18} />
                    <Text style={[styles.primaryActionText, { color: props.palette.primaryText }]}>Looks right</Text>
                  </>
                )}
              </Pressable>
            ) : null}
            <Pressable
              disabled={busy}
              onPress={beginEditing}
              style={({ pressed }) => [canConfirm ? styles.secondaryAction : styles.fullAction, { borderColor: props.palette.border }, pressed && styles.pressed, busy && styles.disabled]}
            >
              <Ionicons color={props.palette.accent} name="options-outline" size={17} />
              <Text style={[styles.secondaryActionText, { color: props.palette.accent }]}>{canConfirm ? 'Adjust' : 'Edit window'}</Text>
            </Pressable>
          </View>
        )}
        {!editing && error ? <Text accessibilityRole="alert" style={[styles.errorText, { color: props.palette.amber }]}>{error}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionPad: { paddingHorizontal: 22, paddingTop: 18 },
  card: { borderRadius: 24, borderWidth: StyleSheet.hairlineWidth, padding: 18 },
  headerRow: { alignItems: 'flex-start', flexDirection: 'row', justifyContent: 'space-between' },
  eyebrow: { fontFamily: fonts.bodyMedium, fontSize: 11, letterSpacing: 1.45, lineHeight: 15, textTransform: 'uppercase' },
  cardTitle: { fontFamily: fonts.bodyMedium, fontSize: 20, letterSpacing: -0.35, lineHeight: 25, marginTop: 3 },
  statusChip: { alignItems: 'center', borderRadius: 999, flexDirection: 'row', gap: 5, minHeight: 30, paddingHorizontal: 10 },
  statusText: { fontFamily: fonts.bodyMedium, fontSize: 12, lineHeight: 16 },
  rangeRow: { alignItems: 'baseline', flexDirection: 'row', gap: 12, justifyContent: 'space-between', marginTop: 22 },
  range: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 24, fontVariant: ['tabular-nums'], letterSpacing: -0.6, lineHeight: 30 },
  duration: { fontFamily: fonts.bodyMedium, fontSize: 15, fontVariant: ['tabular-nums'], lineHeight: 20 },
  source: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, marginTop: 3 },
  timelineShell: { borderRadius: 999, height: 18, marginTop: 20, overflow: 'hidden', position: 'relative' },
  timelineBaseline: { height: 2, left: 9, position: 'absolute', right: 9, top: 8 },
  timelineInterval: { borderRadius: 999, bottom: 3, minWidth: 3, position: 'absolute', top: 3 },
  timelineLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 7 },
  timelineLabel: { fontFamily: fonts.body, fontSize: 11, fontVariant: ['tabular-nums'], lineHeight: 15 },
  contextRow: { alignItems: 'flex-start', borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: 8, marginTop: 18, paddingTop: 14 },
  contextText: { flex: 1, fontFamily: fonts.body, fontSize: 13, lineHeight: 19 },
  editor: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 18, paddingTop: 18 },
  editorTitle: { fontFamily: fonts.bodyMedium, fontSize: 17, letterSpacing: -0.2, lineHeight: 22 },
  editorSupport: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, marginTop: 3 },
  timeGrid: { flexDirection: 'row', gap: 9, marginTop: 13 },
  timeAdjuster: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, flex: 1, padding: 10 },
  timeLabel: { fontFamily: fonts.bodyMedium, fontSize: 11, letterSpacing: 0.7, lineHeight: 15, textTransform: 'uppercase' },
  timeControlRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  timeStepButton: { alignItems: 'center', borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, height: 44, justifyContent: 'center', width: 40 },
  timeValue: { fontFamily: fonts.bodyMedium, fontSize: 14, fontVariant: ['tabular-nums'], lineHeight: 19, marginHorizontal: 2 },
  awakeCard: { borderRadius: 17, borderWidth: StyleSheet.hairlineWidth, marginTop: 12, padding: 11 },
  awakeHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  awakeTitleRow: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  awakeDot: { borderRadius: 4, height: 8, width: 8 },
  awakeTitle: { fontFamily: fonts.bodyMedium, fontSize: 14, lineHeight: 19 },
  removeButton: { alignItems: 'center', height: 44, justifyContent: 'center', width: 44 },
  addAwakeButton: { alignItems: 'center', borderRadius: 14, borderStyle: 'dashed', borderWidth: 1, flexDirection: 'row', gap: 7, justifyContent: 'center', marginTop: 12, minHeight: 48 },
  addAwakeText: { fontFamily: fonts.bodyMedium, fontSize: 14, lineHeight: 19 },
  errorText: { fontFamily: fonts.bodyMedium, fontSize: 13, lineHeight: 19, marginTop: 10 },
  actionRow: { flexDirection: 'row', gap: 9, marginTop: 18 },
  primaryAction: { alignItems: 'center', borderRadius: 14, flex: 1, flexDirection: 'row', gap: 7, justifyContent: 'center', minHeight: 50, paddingHorizontal: 14 },
  primaryActionText: { fontFamily: fonts.bodyMedium, fontSize: 14, lineHeight: 19 },
  secondaryAction: { alignItems: 'center', borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, flex: 1, flexDirection: 'row', gap: 7, justifyContent: 'center', minHeight: 50, paddingHorizontal: 14 },
  secondaryActionText: { fontFamily: fonts.bodyMedium, fontSize: 14, lineHeight: 19 },
  fullAction: { alignItems: 'center', borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, flex: 1, flexDirection: 'row', gap: 7, justifyContent: 'center', minHeight: 50, paddingHorizontal: 14 },
  pressed: { opacity: 0.72 },
  disabled: { opacity: 0.5 }
});
