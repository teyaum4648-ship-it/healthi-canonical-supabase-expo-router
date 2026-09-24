import { Ionicons } from '@expo/vector-icons';
import { layoutOverlaps } from '../../../src/features/dayPlan/timelineLayout';
import { useCallback, useMemo, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
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

import { TimeField } from '../../../src/components/TimeField';
import { Disclosure } from '../../../src/components/mobile/Disclosure';
import { EntrySheet } from '../../../src/components/mobile/EntrySheet';
import {
  generateCircadianBriefing,
  type CircadianBriefing,
  type TimeWindow
} from '../../../src/engines/circadian';
import {
  generateDayPlan,
  type DayPlanRecommendation,
  type DayScheduleBlockType,
  type GenerateDayPlanInput
} from '../../../src/engines/dayPlan';
import { calculateMovementSummary, generateMovementReadinessSignal } from '../../../src/engines/movement';
import { generateDailyReadiness } from '../../../src/engines/readiness';
import { useAuth } from '../../../src/features/auth/AuthProvider';
import { protocolScope, useActiveProtocol } from '../../../src/features/dailyProtocol';
import type { SleepRhythmSupabaseClient } from '../../../src/features/sleepRhythm/persistence';
import { createDefaultSleepNeedEstimate } from '../../../src/features/sleepRhythm/rhythmInputs';
import { loadSleepHistory } from '../../../src/features/sleepRhythm/sleepSessionSource';
import {
  addDemoScheduleBlock,
  deleteDemoScheduleBlock,
  getDemoScheduleBlocksForDate
} from '../../../src/features/dayPlan/localDemoScheduleStore';
import {
  buildDayPlanInput,
  createDemoScheduleBlockRow,
  createEmptyScheduleBlockForm,
  createScheduleBlockFormForWindow,
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
import { readinessToDayPlanInput } from '../../../src/features/morningBriefing';
import {
  getWorkoutExerciseEntriesForSession,
  getWorkoutSessionsForRange,
  type MovementSupabaseClient,
  workoutExerciseEntryRowToEngineEntry,
  workoutSessionRowToEngineSession
} from '../../../src/features/movement/movementPersistence';
import { isSupabaseConfigured, supabase } from '../../../src/lib/supabase';
import { colors, fonts, hairlineWidth, palette, spacing, type } from '../../../src/styles/mobileTheme';

const isUuid = (value: string | undefined): value is string =>
  Boolean(value?.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i));

function movementRangeStart(date: string): string {
  return new Date(new Date(`${date}T12:00:00.000Z`).getTime() - 6 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

const HOUR_MS = 60 * 60 * 1000;

function formatTime(value: string | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const hours = date.getUTCHours();
  const minutes = date.getUTCMinutes();
  const hour12 = hours % 12 || 12;
  const suffix = hours >= 12 ? 'PM' : 'AM';
  return `${hour12}:${String(minutes).padStart(2, '0')} ${suffix}`;
}

function formatHourLabel(ms: number): string {
  const hours = new Date(ms).getUTCHours();
  const hour12 = hours % 12 || 12;
  return `${hour12} ${hours >= 12 ? 'PM' : 'AM'}`;
}

// ─── Calendar sections (sleep-derived recommendation bands) ───────────────────

type CalendarSection = 'deep_work' | 'exercise' | 'light_movement' | 'wind_down' | 'meal' | 'sleep' | 'neutral';

const SECTION_TINT: Record<CalendarSection, string> = {
  deep_work: 'rgba(30, 144, 255, 0.14)',
  exercise: 'rgba(255, 212, 121, 0.14)',
  light_movement: 'rgba(90, 200, 250, 0.14)',
  wind_down: 'rgba(255, 105, 97, 0.12)',
  meal: 'rgba(255, 255, 255, 0.10)',
  sleep: 'rgba(191, 139, 255, 0.12)',
  neutral: 'rgba(255, 255, 255, 0.07)'
};

const SECTION_ACCENT: Record<CalendarSection, string> = {
  deep_work: palette.forest,
  exercise: '#FFD479',
  light_movement: palette.forestMid,
  wind_down: palette.clayDark,
  meal: palette.faint,
  sleep: palette.inkSoft,
  neutral: palette.faint
};

const SECTION_LABEL: Record<CalendarSection, string> = {
  deep_work: 'Deep work',
  exercise: 'Exercise',
  light_movement: 'Light movement',
  wind_down: 'Wind-down',
  meal: 'Meal',
  sleep: 'Sleep',
  neutral: 'Open'
};

// Which recommended section each block type best correlates to.
const BLOCK_TYPE_SECTION: Record<DayScheduleBlockType, CalendarSection> = {
  work: 'deep_work',
  class: 'deep_work',
  commute: 'light_movement',
  exercise: 'exercise',
  meal: 'meal',
  free_time: 'light_movement',
  recovery: 'wind_down',
  social: 'light_movement',
  appointment: 'light_movement',
  sleep: 'sleep',
  other: 'neutral'
};

const SECTION_BLOCK_TYPE: Record<CalendarSection, DayScheduleBlockType> = {
  deep_work: 'work',
  exercise: 'exercise',
  light_movement: 'free_time',
  wind_down: 'recovery',
  meal: 'meal',
  sleep: 'sleep',
  neutral: 'other'
};

type CalendarBand = { section: CalendarSection; startMs: number; endMs: number; label: string };

function buildRecommendationBands(briefing: CircadianBriefing | null): CalendarBand[] {
  if (!briefing || !briefing.wake_time) return [];
  const bands: CalendarBand[] = [];
  const push = (section: CalendarSection, window: TimeWindow | undefined) => {
    if (!window) return;
    bands.push({
      section,
      startMs: new Date(window.start_at).getTime(),
      endMs: new Date(window.end_at).getTime(),
      label: SECTION_LABEL[section]
    });
  };
  briefing.rhythm_plan.deep_work_windows.forEach((window) => push('deep_work', window));
  briefing.rhythm_plan.best_exercise_windows.forEach((window) => push('exercise', window));
  briefing.rhythm_plan.best_walk_windows.forEach((window) => push('light_movement', window));
  if (briefing.rhythm_plan.wind_down_start && briefing.target_bedtime) {
    bands.push({
      section: 'wind_down',
      startMs: new Date(briefing.rhythm_plan.wind_down_start).getTime(),
      endMs: new Date(briefing.target_bedtime).getTime(),
      label: SECTION_LABEL.wind_down
    });
  }
  return bands;
}

function briefingToDayPlanRhythm(briefing: CircadianBriefing | null): GenerateDayPlanInput['rhythm'] {
  if (!briefing || !briefing.wake_time) return undefined;
  const plan = briefing.rhythm_plan;
  const deepWork = plan.deep_work_windows[0];
  const exercise = plan.best_exercise_windows[0];
  return {
    energy_windows: plan.deep_work_windows.map((window) => ({
      start: window.start_at,
      end: window.end_at,
      label: window.label,
      intensity: 'high' as const
    })),
    deep_work_window: deepWork ? { start: deepWork.start_at, end: deepWork.end_at } : null,
    exercise_window: exercise ? { start: exercise.start_at, end: exercise.end_at } : null,
    caffeine_cutoff: plan.caffeine_cutoff,
    wind_down_start: plan.wind_down_start
  };
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

function sourceLabel(mode: 'remote' | 'demo' | 'calibrating'): string {
  if (mode === 'remote') return 'Synced schedule';
  if (mode === 'demo') return 'Local demo schedule';
  return 'Schedule sync calibrating';
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

const TIMELINE_HOUR_HEIGHT = 60;

function DayTimeline({
  briefing,
  blocks,
  date,
  onAddBlockAt,
  onDeleteBlock
}: {
  briefing: CircadianBriefing | null;
  blocks: DayScheduleBlockRow[];
  date: string;
  onAddBlockAt: (startMs: number, section: CalendarSection) => void;
  onDeleteBlock: (id: string, title: string) => void;
}) {
  const bands = buildRecommendationBands(briefing);
  const wakeMs = new Date(briefing?.wake_time ?? `${date}T06:00:00.000Z`).getTime();
  const bedMs = new Date(briefing?.target_bedtime ?? `${date}T23:00:00.000Z`).getTime();
  const rangeStart = Math.floor(wakeMs / HOUR_MS) * HOUR_MS;
  const rangeEnd = Math.ceil(bedMs / HOUR_MS) * HOUR_MS;
  const totalMs = Math.max(HOUR_MS, rangeEnd - rangeStart);
  const height = (totalMs / HOUR_MS) * TIMELINE_HOUR_HEIGHT;
  const clampMs = (ms: number) => Math.max(rangeStart, Math.min(rangeEnd, ms));
  const yFor = (ms: number) => ((clampMs(ms) - rangeStart) / HOUR_MS) * TIMELINE_HOUR_HEIGHT;
  const hourCount = Math.round(totalMs / HOUR_MS);
  const hours = Array.from({ length: hourCount + 1 }, (_, index) => rangeStart + index * HOUR_MS);
  const hourSlots = hours.slice(0, -1);
  const visibleBlocks = blocks.filter((block) => {
    const start = new Date(block.start_at).getTime();
    const end = new Date(block.end_at).getTime();
    return end > rangeStart && start < rangeEnd;
  });
  /* Overlapping suggestions, and overlapping blocks, sit side by side instead of on top of each other. */
  const bandPlacements = layoutOverlaps(bands);
  const blockPlacements = layoutOverlaps(visibleBlocks.map((block) => ({ startMs: new Date(block.start_at).getTime(), endMs: new Date(block.end_at).getTime() })));
  const columnStyle = ({ column, columns }: { column: number; columns: number }) => ({
    left: `${(column / columns) * 100}%` as const,
    width: `${100 / columns}%` as const
  });

  return (
    <View>
      <View style={[styles.timeline, { height }]}>
        {hourSlots.map((ms, index) => {
          const band = bands.find((item) => ms >= item.startMs && ms < item.endMs);
          const section = band?.section ?? 'neutral';
          return (
            <Pressable
              accessibilityLabel={`Add a block at ${formatHourLabel(ms)}`}
              accessibilityRole="button"
              key={`slot-${ms}`}
              onPress={() => onAddBlockAt(ms, section)}
              style={({ pressed }) => [
                styles.hourSlot,
                { top: index * TIMELINE_HOUR_HEIGHT },
                pressed && styles.hourSlotPressed
              ]}
            />
          );
        })}
        {hours.map((ms, index) => (
          <View key={ms} pointerEvents="none" style={[styles.hourRow, { top: index * TIMELINE_HOUR_HEIGHT }]}>
            <Text style={styles.hourLabel}>{formatHourLabel(ms)}</Text>
            <View style={styles.hourLine} />
          </View>
        ))}
        <View pointerEvents="none" style={styles.bandTrack}>
          {bands.map((band, index) => {
            const top = yFor(band.startMs);
            const bandHeight = Math.max(10, yFor(band.endMs) - top);
            return (
              <View
                key={`band-${index}`}
                style={[styles.band, columnStyle(bandPlacements[index]!), { top, height: bandHeight, backgroundColor: SECTION_TINT[band.section] }]}
              >
                <Text numberOfLines={1} style={[styles.bandLabel, { color: SECTION_ACCENT[band.section] }]}>{band.label}</Text>
              </View>
            );
          })}
        </View>
        <View pointerEvents="box-none" style={styles.blockTrack}>
        {visibleBlocks.map((block, blockIndex) => {
          const top = yFor(new Date(block.start_at).getTime());
          const blockHeight = Math.max(24, yFor(new Date(block.end_at).getTime()) - top);
          const section = BLOCK_TYPE_SECTION[block.block_type] ?? 'neutral';
          const title = block.title ?? defaultScheduleBlockTitle(block.block_type);
          return (
            <Pressable
              key={block.id}
              accessibilityRole="button"
              onPress={() => onDeleteBlock(block.id, title)}
              style={[styles.timelineBlock, columnStyle(blockPlacements[blockIndex]!), { top, height: blockHeight, borderLeftColor: SECTION_ACCENT[section] }]}
            >
              <Text numberOfLines={1} style={styles.timelineBlockTitle}>{title}</Text>
              {blockHeight > 34 ? (
                <Text numberOfLines={1} style={styles.timelineBlockTime}>{formatWindow(block.start_at, block.end_at)}</Text>
              ) : null}
            </Pressable>
          );
        })}
        </View>
      </View>
      <View style={styles.calLegend}>
        {(['deep_work', 'exercise', 'light_movement', 'wind_down'] as CalendarSection[]).map((section) => (
          <View key={section} style={styles.calLegendItem}>
            <View style={[styles.calSwatch, { backgroundColor: SECTION_ACCENT[section] }]} />
            <Text style={styles.calLegendText}>{SECTION_LABEL[section]}</Text>
          </View>
        ))}
      </View>
      {!briefing ? <Text style={styles.metaText}>Sleep rhythm shading will appear when timing data is available.</Text> : null}
      <Text style={styles.metaText}>Tap an open hour to add a block. Tap an existing block to remove it.</Text>
    </View>
  );
}

export default function PlanScreen() {
  const { user, mode } = useAuth();
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const now = useMemo(() => new Date().toISOString(), []);
  const protocolScopeValue = useMemo(() => protocolScope(user?.id), [user?.id]);
  const activeProtocol = useActiveProtocol(protocolScopeValue, today);
  const [blocks, setBlocks] = useState<DayScheduleBlockRow[]>([]);
  const [sleepBriefing, setSleepBriefing] = useState<CircadianBriefing | null>(null);
  const [form, setForm] = useState<ScheduleBlockFormState>(() => createEmptyScheduleBlockForm(today));
  const [status, setStatus] = useState('Schedule blocks help Healthi find useful openings.');
  const [dataMode, setDataMode] = useState<'remote' | 'demo' | 'calibrating'>('demo');
  const [movementInput, setMovementInput] = useState<ReturnType<typeof movementSignalToDayPlanInput> | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showBlockComposer, setShowBlockComposer] = useState(false);
  const [hasBlockDraft, setHasBlockDraft] = useState(false);

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
          setBlocks([]);
          setStatus('Schedule data could not load. The plan will stay in a calibrating state.');
          setDataMode('calibrating');
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

  // Sleep rhythm drives the calendar's recommended sections and the day plan.
  useFocusEffect(
    useCallback(() => {
      let isMounted = true;

      async function loadSleepBriefing() {
        try {
          const client = supabase as unknown as SleepRhythmSupabaseClient;
          const { sessions: sleepSessions, sleepNeed: activeNeed } = await loadSleepHistory({ mode, userId, client });
          if (sleepSessions.length === 0) {
            if (isMounted) setSleepBriefing(null);
            return;
          }
          const sleepNeed = activeNeed
            ? { minutes: activeNeed.minutes, confidence: activeNeed.confidence, basis: activeNeed.basis, updated_at: activeNeed.updated_at }
            : createDefaultSleepNeedEstimate(now);
          const briefing = generateCircadianBriefing({
            date: today,
            timezone: 'UTC',
            recentSleepSessions: sleepSessions,
            sleepNeed,
            preferredBedtime: '22:30',
            now
          });
          if (isMounted) setSleepBriefing(briefing);
        } catch {
          if (isMounted) setSleepBriefing(null);
        }
      }

      void loadSleepBriefing();
      return () => {
        isMounted = false;
      };
    }, [mode, now, today, userId])
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
          if (!isMounted) return;
          setMovementInput(undefined);
        }
      }

      void loadMovementInput();
      return () => {
        isMounted = false;
      };
    }, [canUseRemote, today, userId])
  );

  const rhythmInput = useMemo(() => briefingToDayPlanRhythm(sleepBriefing), [sleepBriefing]);
  const sleepWakeTime = sleepBriefing?.wake_time ?? undefined;
  const sleepBedtime = sleepBriefing?.target_bedtime ?? undefined;

  const preliminaryDayPlan = useMemo(
    () =>
      generateDayPlan(
        buildDayPlanInput({
          date: today,
          scheduleBlocks: blocks,
          movement: movementInput,
          rhythm: rhythmInput,
          wake_time: sleepWakeTime,
          target_bedtime: sleepBedtime
        })
      ),
    [blocks, movementInput, rhythmInput, sleepBedtime, sleepWakeTime, today]
  );
  const unifiedReadiness = useMemo(() => generateDailyReadiness({
    date: today,
    movement: movementInput
      ? {
          readiness_label: movementInput.training_readiness,
          confidence: movementInput.training_readiness ? 'medium' : 'low',
          reason_codes: [...(movementInput.reason_codes ?? [])]
        }
      : undefined,
    schedule: {
      block_count: blocks.length,
      open_window_count: preliminaryDayPlan.open_windows.length,
      next_protected_block: preliminaryDayPlan.protected_blocks[0]?.start ?? null,
      confidence: blocks.length > 0 ? 'medium' : 'low',
      reason_codes: [...preliminaryDayPlan.reason_codes]
    }
  }), [blocks.length, movementInput, preliminaryDayPlan, today]);
  const readinessInput = useMemo(
    () => readinessToDayPlanInput(unifiedReadiness),
    [unifiedReadiness]
  );
  const dayPlan = useMemo(
    () => generateDayPlan(buildDayPlanInput({
      date: today,
      scheduleBlocks: blocks,
      movement: movementInput,
      rhythm: rhythmInput,
      wake_time: sleepWakeTime,
      target_bedtime: sleepBedtime,
      readinessScore: readinessInput.score ?? undefined,
      readinessMode: readinessInput.mode,
      readinessConfidence: readinessInput.confidence,
      readinessReasonCodes: readinessInput.reason_codes
    })),
    [blocks, movementInput, readinessInput, rhythmInput, sleepBedtime, sleepWakeTime, today]
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
      setShowBlockComposer(false);
      setHasBlockDraft(false);
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

  function requestDeleteBlock(blockId: string, title: string) {
    Alert.alert('Remove block', `Remove “${title}” from today’s schedule?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => void handleDeleteBlock(blockId) }
    ]);
  }

  function openBlockComposer(startMs: number, section: CalendarSection) {
    if (!hasBlockDraft) {
      setForm(createScheduleBlockFormForWindow(new Date(startMs).toISOString(), SECTION_BLOCK_TYPE[section]));
      setHasBlockDraft(true);
    }
    setShowBlockComposer(true);
  }

  function closeBlockComposer() {
    setForm(createEmptyScheduleBlockForm(today));
    setHasBlockDraft(false);
    setShowBlockComposer(false);
  }

  function renderPlan() {
    return (
      <View style={styles.stack}>
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <View style={styles.blockHeader}>
              <Text style={styles.cardTitle}>Your day</Text>
              <Text style={styles.metaText}>Tap a time to add a block</Text>
            </View>
            <Pressable
              accessibilityLabel={hasBlockDraft ? 'Continue schedule block draft' : 'Add a schedule block'}
              accessibilityRole="button"
              onPress={() => openBlockComposer(new Date(`${today}T09:00:00.000Z`).getTime(), 'neutral')}
              style={({ pressed }) => [styles.addBlockButton, pressed && styles.pressed]}
            >
              <Ionicons color={colors.primaryText} name="add" size={17} />
              <Text style={styles.addBlockButtonText}>{hasBlockDraft ? 'Continue' : 'Block'}</Text>
            </Pressable>
          </View>
          <Text style={styles.body}>Recommended sections come from your sleep rhythm and stay separate from your saved commitments.</Text>
          <DayTimeline
            blocks={blocks}
            briefing={sleepBriefing}
            date={today}
            onAddBlockAt={openBlockComposer}
            onDeleteBlock={requestDeleteBlock}
          />
        </View>

        <Disclosure title="Schedule guidance" detail="Suggested windows, reasons and confidence">
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

        {activeProtocol && activeProtocol.actions.length > 0 ? (
          <View style={styles.card}>
            <View style={styles.rowBetween}>
              <Text style={styles.cardTitle}>Today's protocol</Text>
              <Text style={styles.metaText}>{titleCase(activeProtocol.day_mode)}</Text>
            </View>
            <View style={styles.list}>
              {activeProtocol.actions.map((action) => (
                <View key={action.id} style={styles.windowRow}>
                  <Ionicons color={colors.accent} name="ellipse" size={8} />
                  <Text style={styles.windowText}>
                    {action.title}{action.time_hint ? ` · ${action.time_hint}` : ''}
                  </Text>
                </View>
              ))}
            </View>
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
        </Disclosure>
      </View>
    );
  }

  function renderBlockComposer() {
    return (
        <View style={[styles.card, styles.composerCard]}>
          <View style={styles.rowBetween}>
            <View style={styles.blockHeader}>
              <Text style={styles.cardTitle}>Add a block</Text>
              <Text style={styles.metaText}>{formatWindow(`${form.date}T${form.start_time}:00.000Z`, `${form.date}T${form.end_time}:00.000Z`)}</Text>
            </View>
            <Pressable
              accessibilityLabel="Discard unsaved block draft"
              accessibilityRole="button"
              disabled={isSaving}
              onPress={closeBlockComposer}
              style={({ pressed }) => [styles.discardDraftButton, pressed && styles.pressed]}
            >
              <Text style={styles.metaText}>Discard draft</Text>
            </Pressable>
          </View>
          <Field label="Title" onChangeText={(value) => updateForm('title', value)} placeholder="Work block" value={form.title} />
          <Field label="Date" onChangeText={(value) => updateForm('date', value)} placeholder="2026-07-12" value={form.date} />
          <View style={styles.twoCol}>
            <TimeField
              accessibilityLabel="Start time"
              label="Start"
              onChange={(value) => updateForm('start_time', value)}
              value={form.start_time}
            />
            <TimeField
              accessibilityLabel="End time"
              label="End"
              onChange={(value) => updateForm('end_time', value)}
              value={form.end_time}
            />
          </View>

          <Text style={styles.fieldLabel}>Block type</Text>
          <Text style={styles.metaText}>Colors show where each type best fits your day.</Text>
          <View style={styles.chipWrap}>
            {scheduleBlockTypes.map((blockType) => {
              const section = BLOCK_TYPE_SECTION[blockType] ?? 'neutral';
              const selected = form.block_type === blockType;
              return (
                <Pressable
                  accessibilityRole="button"
                  key={blockType}
                  onPress={() => updateForm('block_type', blockType)}
                  style={({ pressed }) => [
                    styles.typeChip,
                    selected ? { backgroundColor: SECTION_TINT[section], borderColor: SECTION_ACCENT[section] } : null,
                    pressed && styles.pressed
                  ]}
                >
                  <View style={[styles.typeDot, { backgroundColor: SECTION_ACCENT[section] }]} />
                  <Text style={[styles.chipText, selected && styles.chipTextActive]}>{titleCase(blockType)}</Text>
                </Pressable>
              );
            })}
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
    );
  }

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={['top']} style={styles.safe}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.topBar}>
            <Pressable accessibilityRole="button" onPress={() => router.navigate('/')} style={styles.backHome}><Ionicons name="chevron-back" color={colors.accentMid} size={20} /><Text style={styles.backHomeLabel}>Home</Text></Pressable>
            <Text accessibilityRole="header" style={styles.pageTitle}>Your plan</Text>
            <Text style={styles.subtitle}>{new Date(`${today}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</Text>
          </View>

          <View style={styles.statusLine}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>{isLoading ? 'Loading schedule...' : `${status} ${sourceLabel(dataMode)}.`}</Text>
          </View>

          {renderPlan()}
        </ScrollView>
      </SafeAreaView>
      {showBlockComposer ? <EntrySheet title="Add a schedule block" onClose={() => setShowBlockComposer(false)} busy={isSaving}>{renderBlockComposer()}</EntrySheet> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  backHome: { flexDirection: 'row', alignItems: 'center', minHeight: 44, gap: 4 },
  backHomeLabel: { fontFamily: fonts.body, fontSize: 16, color: colors.accentMid },
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
  composerCard: {
    borderColor: colors.accentPale
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
    height: 44,
    justifyContent: 'center',
    width: 44
  },
  discardDraftButton: {
    minHeight: 44,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center'
  },
  addBlockButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 999,
    flexDirection: 'row',
    gap: 4,
    minHeight: 44,
    paddingHorizontal: 16
  },
  addBlockButtonText: {
    ...type.caption,
    color: colors.primaryText,
    fontFamily: fonts.bodyMedium
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
  typeChip: {
    alignItems: 'center',
    borderColor: colors.hairline,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  typeDot: {
    borderRadius: 4,
    height: 8,
    width: 8
  },
  timeline: {
    marginTop: 14,
    position: 'relative'
  },
  hourRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    left: 0,
    position: 'absolute',
    right: 0
  },
  hourSlot: {
    alignItems: 'center',
    borderRadius: 8,
    height: TIMELINE_HOUR_HEIGHT,
    justifyContent: 'center',
    left: 52,
    opacity: 0.38,
    position: 'absolute',
    right: 4
  },
  hourSlotPressed: {
    backgroundColor: colors.accentWash,
    opacity: 1
  },
  hourLabel: {
    ...type.caption,
    color: colors.textFaint,
    fontVariant: ['tabular-nums'],
    width: 44
  },
  hourLine: {
    backgroundColor: colors.hairlineSoft,
    flex: 1,
    height: hairlineWidth
  },
  bandTrack: {
    bottom: 0,
    left: 52,
    position: 'absolute',
    right: 4,
    top: 0
  },
  blockTrack: {
    bottom: 0,
    left: 96,
    position: 'absolute',
    right: 8,
    top: 0
  },
  band: {
    borderColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    position: 'absolute'
  },
  bandLabel: {
    ...type.caption,
    fontFamily: fonts.bodyMedium,
    fontSize: 11
  },
  timelineBlock: {
    backgroundColor: colors.surface,
    borderColor: colors.hairline,
    borderLeftWidth: 3,
    borderRadius: 10,
    borderWidth: hairlineWidth,
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    position: 'absolute'
  },
  timelineBlockTitle: {
    ...type.label,
    color: colors.text
  },
  timelineBlockTime: {
    ...type.caption,
    color: colors.textFaint,
    fontVariant: ['tabular-nums']
  },
  calLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 16,
    rowGap: 8
  },
  calLegendItem: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    width: '50%'
  },
  calSwatch: {
    borderRadius: 3,
    height: 9,
    width: 9
  },
  calLegendText: {
    ...type.caption,
    color: colors.textMuted
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
