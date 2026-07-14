import { Ionicons } from '@expo/vector-icons';
import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { generateDayPlan, type DayPlanRecommendation } from '../../../src/engines/dayPlan';
import { calculateMovementSummary, generateMovementReadinessSignal } from '../../../src/engines/movement';
import { useAuth } from '../../../src/features/auth/AuthProvider';
import {
  addDemoScheduleBlock,
  deleteDemoScheduleBlock,
  getDemoScheduleBlocksForDate
} from '../../../src/features/dayPlan/localDemoScheduleStore';
import {
  buildDayPlanInput,
  createDemoScheduleBlockRow,
  createEmptyScheduleBlockForm,
  defaultScheduleBlockTitle,
  scheduleBlockFlexibilities,
  scheduleBlockFormToInput,
  scheduleBlockTypes,
  type ScheduleBlockFormState
} from '../../../src/features/dayPlan/scheduleBlockForms';
import {
  deleteDayScheduleBlock,
  getScheduleBlocksForDate,
  saveDayScheduleBlock,
  type DayScheduleBlockRow,
  type DayScheduleBlockSupabaseClient
} from '../../../src/features/dayPlan/scheduleBlockPersistence';
import { getLocalDemoMovementState } from '../../../src/features/movement/localDemoMovementStore';
import { movementSignalToDayPlanInput } from '../../../src/features/movement/movementIntegration';
import {
  getWorkoutExerciseEntriesForSession,
  getWorkoutSessionsForRange,
  type MovementSupabaseClient,
  workoutExerciseEntryRowToEngineEntry,
  workoutSessionRowToEngineSession
} from '../../../src/features/movement/movementPersistence';
import { isSupabaseConfigured, supabase } from '../../../src/lib/supabase';
import { colors, fonts, hairlineWidth, palette, spacing, type } from '../../../src/styles/theme';

type Segment = 'Plan' | 'Schedule' | 'Add Block';

const segments: Segment[] = ['Plan', 'Schedule', 'Add Block'];

const isUuid = (value: string | undefined): value is string =>
  Boolean(value?.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i));

function movementRangeStart(date: string): string {
  return new Date(new Date(`${date}T12:00:00.000Z`).getTime() - 6 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function formatTime(value: string | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const hours = date.getUTCHours();
  const minutes = date.getUTCMinutes();
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function formatWindow(start?: string, end?: string): string {
  if (!start && !end) return 'Timing calibrating';
  if (!end) return formatTime(start);
  return `${formatTime(start)} - ${formatTime(end)}`;
}

function titleCase(value: string): string {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function sortedBlocks(blocks: DayScheduleBlockRow[]): DayScheduleBlockRow[] {
  return [...blocks].sort((a, b) => a.start_at.localeCompare(b.start_at) || a.id.localeCompare(b.id));
}

function sourceLabel(mode: 'remote' | 'demo'): string {
  return mode === 'remote' ? 'Synced schedule' : 'Local demo schedule';
}

function priorityTone(priority: DayPlanRecommendation['priority']): string {
  if (priority === 'high') return colors.accent;
  if (priority === 'medium') return colors.accentMid;
  return colors.textMuted;
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  multiline
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        multiline={multiline}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textFaint}
        style={[styles.input, multiline && styles.textarea]}
        value={value}
      />
    </View>
  );
}

function Chip({
  label,
  selected,
  onPress
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.chip, selected && styles.chipActive, pressed && styles.pressed]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

export default function PlanScreen() {
  const { user } = useAuth();
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [activeSegment, setActiveSegment] = useState<Segment>('Plan');
  const [blocks, setBlocks] = useState<DayScheduleBlockRow[]>([]);
  const [form, setForm] = useState<ScheduleBlockFormState>(() => createEmptyScheduleBlockForm(today));
  const [status, setStatus] = useState('Schedule blocks help Healthi find useful openings.');
  const [dataMode, setDataMode] = useState<'remote' | 'demo'>('demo');
  const [movementInput, setMovementInput] = useState<ReturnType<typeof movementSignalToDayPlanInput> | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const userId = user?.id;
  const canUseRemote = Boolean(isSupabaseConfigured && isUuid(userId));

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;

      async function loadBlocks() {
        setIsLoading(true);
        try {
          if (canUseRemote && userId) {
            const rows = await getScheduleBlocksForDate(supabase as unknown as DayScheduleBlockSupabaseClient, userId, today);
            if (!isMounted) return;
            setBlocks(sortedBlocks(rows));
            setDataMode('remote');
            setStatus(rows.length > 0 ? 'Schedule blocks loaded.' : 'Add schedule blocks so Healthi can find useful openings.');
            return;
          }

          const rows = await getDemoScheduleBlocksForDate(today);
          if (!isMounted) return;
          setBlocks(sortedBlocks(rows));
          setDataMode('demo');
          setStatus(rows.length > 0 ? 'Local demo schedule loaded.' : 'Add schedule blocks so Healthi can find useful openings.');
        } catch {
          if (!isMounted) return;
          setStatus('Schedule data could not load. You can still use local demo blocks.');
          setDataMode('demo');
        } finally {
          if (isMounted) setIsLoading(false);
        }
      }

      loadBlocks();
      return () => {
        isMounted = false;
      };
    }, [canUseRemote, today, userId])
  );

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;

      async function loadMovementInput() {
        try {
          if (canUseRemote && userId) {
            const client = supabase as unknown as MovementSupabaseClient;
            const sessions = await getWorkoutSessionsForRange(client, userId, movementRangeStart(today), today);
            const entries = (await Promise.all(
              sessions.map((session) => getWorkoutExerciseEntriesForSession(client, userId, session.id))
            )).flat();
            if (!isMounted) return;
            const summary = calculateMovementSummary({
              date: today,
              sessions: sessions.map(workoutSessionRowToEngineSession),
              exerciseEntries: entries.map(workoutExerciseEntryRowToEngineEntry)
            });
            setMovementInput(movementSignalToDayPlanInput(generateMovementReadinessSignal({ summary })));
            return;
          }

          const state = await getLocalDemoMovementState();
          if (!isMounted) return;
          const summary = calculateMovementSummary({
            date: today,
            sessions: state.workoutSessions.map(workoutSessionRowToEngineSession),
            exerciseEntries: state.workoutExerciseEntries.map(workoutExerciseEntryRowToEngineEntry)
          });
          setMovementInput(movementSignalToDayPlanInput(generateMovementReadinessSignal({ summary })));
        } catch {
          const state = await getLocalDemoMovementState().catch(() => null);
          if (!isMounted || !state) return;
          const summary = calculateMovementSummary({
            date: today,
            sessions: state.workoutSessions.map(workoutSessionRowToEngineSession),
            exerciseEntries: state.workoutExerciseEntries.map(workoutExerciseEntryRowToEngineEntry)
          });
          setMovementInput(movementSignalToDayPlanInput(generateMovementReadinessSignal({ summary })));
        }
      }

      void loadMovementInput();
      return () => {
        isMounted = false;
      };
    }, [canUseRemote, today, userId])
  );

  const dayPlan = useMemo(
    () =>
      generateDayPlan(
        buildDayPlanInput({
          date: today,
          scheduleBlocks: blocks,
          movement: movementInput
        })
      ),
    [blocks, movementInput, today]
  );

  function updateForm<K extends keyof ScheduleBlockFormState>(key: K, value: ScheduleBlockFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSaveBlock() {
    const result = scheduleBlockFormToInput(form, canUseRemote ? 'manual' : 'demo');
    if (!result.ok) {
      setStatus(result.error);
      return;
    }

    setIsSaving(true);
    try {
      if (canUseRemote && userId) {
        const saved = await saveDayScheduleBlock(supabase as unknown as DayScheduleBlockSupabaseClient, userId, result.input);
        setBlocks((current) => sortedBlocks([saved, ...current.filter((item) => item.id !== saved.id)]));
        setStatus('Schedule block saved.');
      } else {
        const localBlock = createDemoScheduleBlockRow(result.input);
        await addDemoScheduleBlock(localBlock);
        setBlocks((current) => sortedBlocks([localBlock, ...current.filter((item) => item.id !== localBlock.id)]));
        setStatus('Schedule block saved locally.');
      }

      setForm(createEmptyScheduleBlockForm(today));
      setActiveSegment('Plan');
    } catch {
      setStatus('Schedule block could not save. Check the block details and try again.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteBlock(blockId: string) {
    try {
      if (canUseRemote && userId) {
        await deleteDayScheduleBlock(supabase as unknown as DayScheduleBlockSupabaseClient, userId, blockId);
      } else {
        await deleteDemoScheduleBlock(blockId);
      }
      setBlocks((current) => current.filter((item) => item.id !== blockId));
      setStatus('Schedule block removed.');
    } catch {
      Alert.alert('Unable to remove block', 'The schedule block could not be removed right now.');
    }
  }

  function renderPlan() {
    return (
      <View style={styles.stack}>
        <View style={[styles.card, styles.heroCard]}>
          <Text style={styles.eyebrow}>Today</Text>
          <Text style={styles.heroTitle}>{dayPlan.primary_focus}</Text>
          <Text style={styles.body}>{dayPlan.summary}</Text>
          <View style={styles.metricRow}>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>Confidence</Text>
              <Text style={styles.metricValue}>{titleCase(dayPlan.confidence)}</Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>Open windows</Text>
              <Text style={styles.metricValue}>{dayPlan.open_windows.length}</Text>
            </View>
          </View>
        </View>

        {dayPlan.missing_data.length > 0 ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Still calibrating</Text>
            <Text style={styles.body}>
              Missing: {dayPlan.missing_data.map(titleCase).join(', ')}. Based on available data.
            </Text>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Recommendations</Text>
          {dayPlan.recommendations.length > 0 ? (
            <View style={styles.list}>
              {dayPlan.recommendations.map((item) => (
                <View key={item.id} style={styles.recommendation}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.recommendationTitle}>{item.title}</Text>
                    <Text style={[styles.priority, { color: priorityTone(item.priority) }]}>{titleCase(item.priority)}</Text>
                  </View>
                  <Text style={styles.body}>{item.detail}</Text>
                  <Text style={styles.metaText}>
                    {formatWindow(item.start, item.end)} · Confidence: {item.confidence}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.body}>Add schedule blocks so Healthi can shape the day.</Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Open windows</Text>
          {dayPlan.open_windows.length > 0 ? (
            <View style={styles.list}>
              {dayPlan.open_windows.slice(0, 5).map((window) => (
                <View key={`${window.start}-${window.end}`} style={styles.windowRow}>
                  <Ionicons color={colors.accent} name="time-outline" size={16} />
                  <Text style={styles.windowText}>
                    {formatWindow(window.start, window.end)} · {window.duration_minutes} min
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.body}>No clear openings yet. Add or adjust blocks to improve the estimate.</Text>
          )}
        </View>

        <View style={styles.reasonWrap}>
          {dayPlan.reason_codes.slice(0, 5).map((reason) => (
            <View key={reason} style={styles.reasonPill}>
              <Text style={styles.reasonText}>{titleCase(reason)}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  }

  function renderSchedule() {
    return (
      <View style={styles.stack}>
        {blocks.length > 0 ? (
          blocks.map((block) => (
            <View key={block.id} style={styles.card}>
              <View style={styles.rowBetween}>
                <View style={styles.blockHeader}>
                  <Text style={styles.cardTitle}>{block.title ?? defaultScheduleBlockTitle(block.block_type)}</Text>
                  <Text style={styles.metaText}>{formatWindow(block.start_at, block.end_at)}</Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => handleDeleteBlock(block.id)}
                  style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
                >
                  <Ionicons color={colors.danger} name="trash-outline" size={17} />
                </Pressable>
              </View>
              <View style={styles.reasonWrap}>
                <View style={styles.reasonPill}><Text style={styles.reasonText}>{titleCase(block.block_type)}</Text></View>
                <View style={styles.reasonPill}>
                  <Text style={styles.reasonText}>{block.is_protected ? 'Protected' : titleCase(block.flexibility)}</Text>
                </View>
                <View style={styles.reasonPill}><Text style={styles.reasonText}>{titleCase(block.source)}</Text></View>
              </View>
              {block.description ? <Text style={styles.body}>{block.description}</Text> : null}
              {block.location ? <Text style={styles.metaText}>{block.location}</Text> : null}
            </View>
          ))
        ) : (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>No schedule blocks yet</Text>
            <Text style={styles.body}>Add schedule blocks so Healthi can find useful openings in your day.</Text>
          </View>
        )}
      </View>
    );
  }

  function renderAddBlock() {
    return (
      <View style={styles.stack}>
        <View style={styles.card}>
          <Field label="Title" onChangeText={(value) => updateForm('title', value)} placeholder="Work block" value={form.title} />
          <Field label="Date" onChangeText={(value) => updateForm('date', value)} placeholder="2026-07-12" value={form.date} />
          <View style={styles.twoCol}>
            <Field label="Start" onChangeText={(value) => updateForm('start_time', value)} placeholder="09:00" value={form.start_time} />
            <Field label="End" onChangeText={(value) => updateForm('end_time', value)} placeholder="17:30" value={form.end_time} />
          </View>

          <Text style={styles.fieldLabel}>Block type</Text>
          <View style={styles.chipWrap}>
            {scheduleBlockTypes.map((type) => (
              <Chip
                key={type}
                label={titleCase(type)}
                onPress={() => updateForm('block_type', type)}
                selected={form.block_type === type}
              />
            ))}
          </View>

          <Text style={styles.fieldLabel}>Flexibility</Text>
          <View style={styles.chipWrap}>
            {scheduleBlockFlexibilities.map((flexibility) => (
              <Chip
                key={flexibility}
                label={titleCase(flexibility)}
                onPress={() => updateForm('flexibility', flexibility)}
                selected={form.flexibility === flexibility}
              />
            ))}
          </View>

          <Pressable
            accessibilityRole="switch"
            accessibilityState={{ checked: form.is_protected }}
            onPress={() => updateForm('is_protected', !form.is_protected)}
            style={({ pressed }) => [styles.toggle, pressed && styles.pressed]}
          >
            <View style={[styles.toggleDot, form.is_protected && styles.toggleDotActive]} />
            <Text style={styles.toggleText}>{form.is_protected ? 'Protected block' : 'Flexible block'}</Text>
          </Pressable>

          <Field
            label="Description"
            multiline
            onChangeText={(value) => updateForm('description', value)}
            placeholder="Optional context"
            value={form.description}
          />
          <Field label="Location" onChangeText={(value) => updateForm('location', value)} placeholder="Optional" value={form.location} />

          <Pressable
            accessibilityRole="button"
            disabled={isSaving}
            onPress={handleSaveBlock}
            style={({ pressed }) => [styles.primaryButton, (pressed && !isSaving) && styles.pressed, isSaving && styles.disabled]}
          >
            {isSaving ? <ActivityIndicator color={colors.textInverse} /> : <Text style={styles.primaryButtonText}>Save block</Text>}
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={['top']} style={styles.safe}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.topBar}>
            <Text style={styles.pageEyebrow}>Plan</Text>
            <Text style={styles.pageTitle}>Today’s Plan</Text>
            <Text style={styles.subtitle}>
              Healthi uses your schedule, rhythm, fueling, and readiness signals to shape the day.
            </Text>
          </View>

          <View style={styles.segmentBar}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {segments.map((segment) => (
                <Pressable
                  accessibilityRole="button"
                  key={segment}
                  onPress={() => setActiveSegment(segment)}
                  style={[styles.segment, activeSegment === segment && styles.segmentActive]}
                >
                  <Text style={[styles.segmentText, activeSegment === segment && styles.segmentTextActive]}>{segment}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <View style={styles.segmentBaseline} />
          </View>

          <View style={styles.statusLine}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>{isLoading ? 'Loading schedule...' : `${status} ${sourceLabel(dataMode)}.`}</Text>
          </View>

          {activeSegment === 'Plan' ? renderPlan() : null}
          {activeSegment === 'Schedule' ? renderSchedule() : null}
          {activeSegment === 'Add Block' ? renderAddBlock() : null}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background
  },
  safe: {
    flex: 1
  },
  scroll: {
    paddingBottom: 118
  },
  topBar: {
    paddingHorizontal: 26,
    paddingTop: 22
  },
  pageEyebrow: {
    ...type.eyebrow,
    color: colors.textFaint
  },
  pageTitle: {
    ...type.title,
    color: colors.text,
    marginTop: 7
  },
  subtitle: {
    ...type.body,
    color: colors.textMuted,
    marginTop: 8
  },
  segmentBar: {
    marginTop: 22
  },
  segmentBaseline: {
    backgroundColor: colors.hairlineSoft,
    height: hairlineWidth
  },
  segment: {
    borderBottomColor: 'transparent',
    borderBottomWidth: 2,
    marginLeft: 26,
    paddingBottom: 12
  },
  segmentActive: {
    borderBottomColor: colors.accent
  },
  segmentText: {
    ...type.caption,
    color: colors.textMuted,
    fontFamily: fonts.bodyMedium
  },
  segmentTextActive: {
    color: colors.text
  },
  statusLine: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 26,
    paddingTop: 16
  },
  statusDot: {
    backgroundColor: colors.accent,
    borderRadius: 3,
    height: 5,
    width: 5
  },
  statusText: {
    ...type.caption,
    color: colors.textMuted,
    flex: 1
  },
  stack: {
    gap: 14,
    marginTop: 14,
    paddingHorizontal: 16
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.hairline,
    borderRadius: 24,
    borderWidth: 1,
    gap: 12,
    padding: 18
  },
  heroCard: {
    borderColor: palette.forestPale
  },
  eyebrow: {
    ...type.eyebrow,
    color: colors.accent
  },
  heroTitle: {
    ...type.title,
    color: colors.text
  },
  cardTitle: {
    ...type.heading,
    color: colors.text
  },
  body: {
    ...type.body,
    color: colors.textMuted
  },
  metaText: {
    ...type.caption,
    color: colors.textFaint
  },
  rowBetween: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between'
  },
  metricRow: {
    flexDirection: 'row',
    gap: 10
  },
  metric: {
    backgroundColor: colors.surfaceInset,
    borderColor: colors.hairlineSoft,
    borderRadius: 16,
    borderWidth: 1,
    flex: 1,
    padding: 12
  },
  metricLabel: {
    ...type.caption,
    color: colors.textFaint
  },
  metricValue: {
    ...type.number,
    color: colors.text,
    marginTop: 5
  },
  list: {
    gap: 10
  },
  recommendation: {
    borderTopColor: colors.hairlineSoft,
    borderTopWidth: hairlineWidth,
    gap: 6,
    paddingTop: 12
  },
  recommendationTitle: {
    ...type.label,
    color: colors.text
  },
  priority: {
    ...type.caption,
    fontFamily: fonts.bodyMedium
  },
  windowRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8
  },
  windowText: {
    ...type.caption,
    color: colors.textMuted,
    flex: 1
  },
  reasonWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  reasonPill: {
    backgroundColor: colors.accentWash,
    borderColor: colors.accentPale,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  reasonText: {
    ...type.caption,
    color: colors.accent
  },
  blockHeader: {
    flex: 1,
    gap: 3
  },
  iconButton: {
    alignItems: 'center',
    borderColor: colors.hairline,
    borderRadius: 16,
    borderWidth: 1,
    height: 34,
    justifyContent: 'center',
    width: 34
  },
  field: {
    gap: 7
  },
  fieldLabel: {
    ...type.eyebrow,
    color: colors.textFaint,
    marginTop: 2
  },
  input: {
    backgroundColor: colors.surfaceInset,
    borderColor: colors.hairline,
    borderRadius: 14,
    borderWidth: 1,
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 15,
    minHeight: 48,
    paddingHorizontal: 14
  },
  textarea: {
    minHeight: 82,
    paddingTop: 12,
    textAlignVertical: 'top'
  },
  twoCol: {
    flexDirection: 'row',
    gap: 10
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  chip: {
    borderColor: colors.hairline,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  chipActive: {
    backgroundColor: colors.accentWash,
    borderColor: colors.accentPale
  },
  chipText: {
    ...type.caption,
    color: colors.textMuted,
    fontFamily: fonts.bodyMedium
  },
  chipTextActive: {
    color: colors.accent
  },
  toggle: {
    alignItems: 'center',
    borderColor: colors.hairline,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    minHeight: 48,
    paddingHorizontal: 12
  },
  toggleDot: {
    backgroundColor: colors.hairline,
    borderRadius: 7,
    height: 14,
    width: 14
  },
  toggleDotActive: {
    backgroundColor: colors.accent
  },
  toggleText: {
    ...type.label,
    color: colors.text
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 16,
    justifyContent: 'center',
    minHeight: 52
  },
  primaryButtonText: {
    color: colors.primaryText,
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    letterSpacing: 1.1,
    textTransform: 'uppercase'
  },
  pressed: {
    opacity: 0.82
  },
  disabled: {
    opacity: 0.55
  }
});
