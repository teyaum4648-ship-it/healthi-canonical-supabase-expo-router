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

import { calculateMovementSummary, generateMovementReadinessSignal } from '../../../src/engines/movement';
import { useAuth } from '../../../src/features/auth/AuthProvider';
import {
  addDemoWorkoutExerciseEntries,
  addDemoWorkoutSession,
  deleteDemoWorkoutSession,
  getLocalDemoMovementState
} from '../../../src/features/movement/localDemoMovementStore';
import {
  deleteWorkoutSession,
  getExerciseLibraryItems,
  getWorkoutExerciseEntriesForSession,
  getWorkoutSessionsForRange,
  saveWorkoutExerciseEntries,
  saveWorkoutSession,
  type ExerciseLibraryItemRow,
  type MovementSupabaseClient,
  type WorkoutExerciseEntryRow,
  type WorkoutSessionRow,
  workoutExerciseEntryRowToEngineEntry,
  workoutSessionRowToEngineSession
} from '../../../src/features/movement/movementPersistence';
import {
  applyWorkoutTemplate,
  createDemoWorkoutRows,
  createEmptyExerciseDraft,
  createEmptyWorkoutDraft,
  exerciseCategories,
  starterExerciseRows,
  workoutDraftToInputs,
  workoutTemplates,
  workoutTypes,
  type WorkoutDraft,
  type WorkoutExerciseDraft
} from '../../../src/features/movement/workoutForms';
import { isSupabaseConfigured, supabase } from '../../../src/lib/supabase';
import { colors, hairlineWidth, radii, spacing, type } from '../../../src/styles/theme';

type Segment = 'Today' | 'Log Workout' | 'Templates' | 'History' | 'Movement Signal';

const segments: Segment[] = ['Today', 'Log Workout', 'Templates', 'History', 'Movement Signal'];
const isUuid = (value: string | undefined): value is string =>
  Boolean(value?.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i));

function weekStart(date: string): string {
  return new Date(new Date(`${date}T12:00:00.000Z`).getTime() - 6 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function historyStart(date: string): string {
  return new Date(new Date(`${date}T12:00:00.000Z`).getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function titleCase(value: string): string {
  return value.split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

function formatDate(value: string): string {
  const date = new Date(`${value.slice(0, 10)}T12:00:00.000Z`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
  multiline
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'numeric' | 'decimal-pad';
  multiline?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        keyboardType={keyboardType}
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

function Chip({ label, selected, onPress }: { label: string; selected?: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.chip, selected && styles.chipSelected, pressed && styles.pressed]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

export default function MovementScreen() {
  const { user } = useAuth();
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [activeSegment, setActiveSegment] = useState<Segment>('Today');
  const [sessions, setSessions] = useState<WorkoutSessionRow[]>([]);
  const [entries, setEntries] = useState<WorkoutExerciseEntryRow[]>([]);
  const [library, setLibrary] = useState<ExerciseLibraryItemRow[]>(() => starterExerciseRows());
  const [draft, setDraft] = useState<WorkoutDraft>(() => createEmptyWorkoutDraft(today));
  const [dataMode, setDataMode] = useState<'remote' | 'demo'>('demo');
  const [status, setStatus] = useState('Log a workout to begin shaping your movement signal.');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const userId = user?.id;
  const canUseRemote = Boolean(isSupabaseConfigured && isUuid(userId));
  const shouldUseRemote = canUseRemote && dataMode === 'remote';

  const loadMovement = useCallback(async () => {
    setIsLoading(true);
    try {
      if (canUseRemote && userId) {
        const client = supabase as unknown as MovementSupabaseClient;
        const [sessionRows, libraryRows] = await Promise.all([
          getWorkoutSessionsForRange(client, userId, historyStart(today), today),
          getExerciseLibraryItems(client, userId)
        ]);
        const entryRows = (await Promise.all(
          sessionRows.map((session) => getWorkoutExerciseEntriesForSession(client, userId, session.id))
        )).flat();
        setSessions(sessionRows);
        setEntries(entryRows);
        setLibrary(libraryRows.length > 0 ? libraryRows : starterExerciseRows());
        setDataMode('remote');
        setStatus(sessionRows.length > 0 ? 'Based on logged workouts.' : 'Log a workout to begin shaping your movement signal.');
        return;
      }

      const state = await getLocalDemoMovementState();
      setSessions(state.workoutSessions);
      setEntries(state.workoutExerciseEntries);
      setLibrary(state.exerciseLibrary.length > 0 ? state.exerciseLibrary : starterExerciseRows());
      setDataMode('demo');
      setStatus(state.workoutSessions.length > 0 ? 'Based on local demo workout logs.' : 'Log a workout to begin shaping your movement signal.');
    } catch {
      const state = await getLocalDemoMovementState().catch(() => ({
        exerciseLibrary: [],
        workoutSessions: [],
        workoutExerciseEntries: []
      }));
      setSessions(state.workoutSessions);
      setEntries(state.workoutExerciseEntries);
      setLibrary(state.exerciseLibrary.length > 0 ? state.exerciseLibrary : starterExerciseRows());
      setDataMode('demo');
      setStatus('Movement sync is unavailable. Local demo logging is active.');
    } finally {
      setIsLoading(false);
    }
  }, [canUseRemote, today, userId]);

  useFocusEffect(
    useCallback(() => {
      void loadMovement();
    }, [loadMovement])
  );

  const engineSessions = useMemo(() => sessions.map(workoutSessionRowToEngineSession), [sessions]);
  const engineEntries = useMemo(() => entries.map(workoutExerciseEntryRowToEngineEntry), [entries]);
  const summary = useMemo(
    () => calculateMovementSummary({ date: today, sessions: engineSessions, exerciseEntries: engineEntries }),
    [engineEntries, engineSessions, today]
  );
  const signal = useMemo(() => generateMovementReadinessSignal({ summary }), [summary]);

  function updateDraft<K extends keyof WorkoutDraft>(key: K, value: WorkoutDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function updateExercise(id: string, update: Partial<WorkoutExerciseDraft>) {
    setDraft((current) => ({
      ...current,
      exercises: current.exercises.map((item) => item.id === id ? { ...item, ...update } : item)
    }));
  }

  function addExercise(item?: ExerciseLibraryItemRow) {
    const next = createEmptyExerciseDraft(item?.category ?? 'strength');
    if (item) next.exercise_name = item.name;
    updateDraft('exercises', [...draft.exercises, next]);
  }

  async function handleSave() {
    const result = workoutDraftToInputs(draft, shouldUseRemote ? 'manual' : 'demo');
    if (!result.ok) {
      setStatus(result.error);
      return;
    }

    setIsSaving(true);
    try {
      if (shouldUseRemote && userId) {
        const client = supabase as unknown as MovementSupabaseClient;
        const session = await saveWorkoutSession(client, userId, result.session);
        const savedEntries = await saveWorkoutExerciseEntries(
          client,
          userId,
          result.exercises.map((entry) => ({ ...entry, workout_session_id: session.id }))
        );
        setSessions((current) => [session, ...current.filter((item) => item.id !== session.id)]);
        setEntries((current) => [...savedEntries, ...current]);
        setDataMode('remote');
        setStatus('Workout saved. Your movement signal has been updated.');
      } else {
        const rows = createDemoWorkoutRows(result);
        await addDemoWorkoutSession(rows.session);
        await addDemoWorkoutExerciseEntries(rows.exercises);
        setSessions((current) => [rows.session, ...current.filter((item) => item.id !== rows.session.id)]);
        setEntries((current) => [...rows.exercises, ...current]);
        setDataMode('demo');
        setStatus('Workout saved locally. Your movement signal has been updated.');
      }
      setDraft(createEmptyWorkoutDraft(today));
      setActiveSegment('Today');
    } catch {
      setStatus('Workout could not save. Review the details and try again.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(sessionId: string) {
    try {
      if (shouldUseRemote && userId) {
        await deleteWorkoutSession(supabase as unknown as MovementSupabaseClient, userId, sessionId);
      } else {
        await deleteDemoWorkoutSession(sessionId);
      }
      setSessions((current) => current.filter((item) => item.id !== sessionId));
      setEntries((current) => current.filter((item) => item.workout_session_id !== sessionId));
      setStatus('Workout removed. Your movement signal has been updated.');
    } catch {
      Alert.alert('Unable to remove workout', 'The workout could not be removed right now.');
    }
  }

  function renderToday() {
    return (
      <View style={styles.stack}>
        <View style={[styles.card, styles.heroCard]}>
          <View style={styles.signalIcon}>
            <Ionicons color={colors.accent} name="body-outline" size={24} />
          </View>
          <Text style={styles.eyebrow}>Movement readiness</Text>
          <Text style={styles.heroTitle}>{titleCase(signal.label)}</Text>
          <Text style={styles.body}>{signal.summary}</Text>
          <View style={styles.metricRow}>
            <Metric label="Workouts" value={String(summary.workout_count)} />
            <Metric label="Minutes" value={String(summary.total_minutes)} />
            <Metric label="Load" value={summary.estimated_training_load > 0 ? String(summary.estimated_training_load) : '—'} />
          </View>
          <View style={styles.rule} />
          <Text style={styles.nextAction}>{signal.suggested_next_action}</Text>
          <Text style={styles.meta}>Confidence: {signal.confidence} · {dataMode === 'remote' ? 'Synced logs' : 'Local demo logs'}</Text>
        </View>

        <Pressable onPress={() => setActiveSegment('Log Workout')} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
          <Ionicons color={colors.textInverse} name="add" size={20} />
          <Text style={styles.primaryButtonText}>Log Workout</Text>
        </Pressable>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>This week</Text>
          <View style={styles.breakdownRow}>
            <View style={styles.breakdownItem}><Text style={styles.breakdownValue}>{summary.strength_session_count}</Text><Text style={styles.meta}>Strength</Text></View>
            <View style={styles.breakdownItem}><Text style={styles.breakdownValue}>{summary.cardio_session_count}</Text><Text style={styles.meta}>Cardio</Text></View>
            <View style={styles.breakdownItem}><Text style={styles.breakdownValue}>{summary.mobility_recovery_session_count}</Text><Text style={styles.meta}>Reset</Text></View>
            <View style={styles.breakdownItem}><Text style={styles.breakdownValue}>{summary.recent_high_effort_count}</Text><Text style={styles.meta}>High effort</Text></View>
          </View>
        </View>
      </View>
    );
  }

  function renderLogWorkout() {
    return (
      <View style={styles.stack}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Workout details</Text>
          <Field label="Title" onChangeText={(value) => updateDraft('title', value)} placeholder="Morning strength" value={draft.title} />
          <Text style={styles.fieldLabel}>Workout type</Text>
          <View style={styles.chipWrap}>
            {workoutTypes.map((item) => <Chip key={item} label={titleCase(item)} onPress={() => updateDraft('workout_type', item)} selected={draft.workout_type === item} />)}
          </View>
          <Field label="Date" onChangeText={(value) => updateDraft('session_date', value)} placeholder="2026-07-13" value={draft.session_date} />
          <View style={styles.twoFields}>
            <View style={styles.flexField}><Field keyboardType="numeric" label="Minutes" onChangeText={(value) => updateDraft('duration_minutes', value)} placeholder="45" value={draft.duration_minutes} /></View>
            <View style={styles.flexField}><Field keyboardType="numeric" label="Effort 1–10" onChangeText={(value) => updateDraft('perceived_effort', value)} placeholder="7" value={draft.perceived_effort} /></View>
          </View>
          <Field label="Notes" multiline onChangeText={(value) => updateDraft('session_note', value)} placeholder="Optional session note" value={draft.session_note} />
        </View>

        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.cardTitle}>Exercises</Text>
            <Pressable onPress={() => addExercise()} style={({ pressed }) => [styles.iconTextButton, pressed && styles.pressed]}>
              <Ionicons color={colors.accent} name="add" size={17} />
              <Text style={styles.iconText}>Add</Text>
            </Pressable>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.libraryScroller}>
            <View style={styles.libraryRow}>
              {library.slice(0, 10).map((item) => <Chip key={item.id} label={item.name} onPress={() => addExercise(item)} />)}
            </View>
          </ScrollView>
          {draft.exercises.length === 0 ? <Text style={styles.emptyCopy}>Exercises are optional. Cardio, mobility, and recovery sessions can be logged with time and effort only.</Text> : null}
          {draft.exercises.map((item, index) => (
            <View key={item.id} style={styles.exerciseCard}>
              <View style={styles.rowBetween}>
                <Text style={styles.exerciseIndex}>Exercise {index + 1}</Text>
                <Pressable onPress={() => updateDraft('exercises', draft.exercises.filter((exerciseItem) => exerciseItem.id !== item.id))} style={styles.iconButton}>
                  <Ionicons color={colors.danger} name="close" size={17} />
                </Pressable>
              </View>
              <Field label="Name" onChangeText={(value) => updateExercise(item.id, { exercise_name: value })} placeholder="Exercise name" value={item.exercise_name} />
              <Text style={styles.fieldLabel}>Category</Text>
              <View style={styles.chipWrap}>
                {exerciseCategories.map((category) => <Chip key={category} label={titleCase(category)} onPress={() => updateExercise(item.id, { category })} selected={item.category === category} />)}
              </View>
              <View style={styles.threeFields}>
                <View style={styles.flexField}><Field keyboardType="numeric" label="Sets" onChangeText={(value) => updateExercise(item.id, { sets: value })} value={item.sets} /></View>
                <View style={styles.flexField}><Field keyboardType="numeric" label="Reps" onChangeText={(value) => updateExercise(item.id, { reps: value })} value={item.reps} /></View>
                <View style={styles.flexField}><Field keyboardType="decimal-pad" label="Weight" onChangeText={(value) => updateExercise(item.id, { weight: value })} value={item.weight} /></View>
              </View>
              <View style={styles.threeFields}>
                <View style={styles.flexField}><Field keyboardType="decimal-pad" label="Distance" onChangeText={(value) => updateExercise(item.id, { distance: value })} value={item.distance} /></View>
                <View style={styles.flexField}><Field keyboardType="numeric" label="Minutes" onChangeText={(value) => updateExercise(item.id, { duration_minutes: value })} value={item.duration_minutes} /></View>
                <View style={styles.flexField}><Field keyboardType="numeric" label="Effort" onChangeText={(value) => updateExercise(item.id, { effort: value })} value={item.effort} /></View>
              </View>
              <Field label="Notes" onChangeText={(value) => updateExercise(item.id, { notes: value })} placeholder="Optional" value={item.notes} />
            </View>
          ))}
        </View>

        <Pressable disabled={isSaving} onPress={handleSave} style={({ pressed }) => [styles.primaryButton, (pressed || isSaving) && styles.pressed]}>
          {isSaving ? <ActivityIndicator color={colors.textInverse} /> : <Ionicons color={colors.textInverse} name="checkmark" size={20} />}
          <Text style={styles.primaryButtonText}>{isSaving ? 'Saving…' : 'Save Workout'}</Text>
        </Pressable>
      </View>
    );
  }

  function renderTemplates() {
    return (
      <View style={styles.stack}>
        {workoutTemplates.map((template) => (
          <Pressable
            key={template.id}
            onPress={() => {
              setDraft(applyWorkoutTemplate(template, today));
              setActiveSegment('Log Workout');
              setStatus(`${template.title} loaded. Edit any detail before saving.`);
            }}
            style={({ pressed }) => [styles.card, styles.templateCard, pressed && styles.pressed]}
          >
            <View style={styles.rowBetween}>
              <View style={styles.templateCopy}>
                <Text style={styles.cardTitle}>{template.title}</Text>
                <Text style={styles.body}>{titleCase(template.workout_type)} · {template.duration_minutes} min · {template.exercises.length} {template.exercises.length === 1 ? 'movement' : 'movements'}</Text>
              </View>
              <Ionicons color={colors.accent} name="arrow-forward" size={19} />
            </View>
          </Pressable>
        ))}
        <Text style={styles.footnote}>Templates are starting points. Every field stays editable before you save.</Text>
      </View>
    );
  }

  function renderHistory() {
    return (
      <View style={styles.stack}>
        {sessions.length === 0 ? (
          <View style={styles.card}><Text style={styles.cardTitle}>No workouts yet</Text><Text style={styles.body}>Your recent sessions will appear here after you log one.</Text></View>
        ) : sessions.map((session) => {
          const sessionEntries = entries.filter((entry) => entry.workout_session_id === session.id);
          return (
            <View key={session.id} style={styles.card}>
              <View style={styles.rowBetween}>
                <View style={styles.historyTitleWrap}>
                  <Text style={styles.cardTitle}>{session.title}</Text>
                  <Text style={styles.meta}>{formatDate(session.session_date)} · {titleCase(session.workout_type)} · {session.source === 'demo' ? 'Local demo' : 'Logged'}</Text>
                </View>
                <Pressable onPress={() => handleDelete(session.id)} style={styles.iconButton}>
                  <Ionicons color={colors.danger} name="trash-outline" size={17} />
                </Pressable>
              </View>
              <View style={styles.historyMetrics}>
                <Text style={styles.historyMetric}>{session.duration_minutes ?? '—'} min</Text>
                <Text style={styles.historyMetric}>Effort {session.perceived_effort ?? '—'}</Text>
                <Text style={styles.historyMetric}>{sessionEntries.length} exercises</Text>
              </View>
            </View>
          );
        })}
      </View>
    );
  }

  function renderSignal() {
    return (
      <View style={styles.stack}>
        <View style={styles.card}>
          <Text style={styles.eyebrow}>Current signal</Text>
          <Text style={styles.heroTitle}>{titleCase(signal.label)}</Text>
          <Text style={styles.body}>{signal.summary}</Text>
          <View style={styles.signalScale}><View style={[styles.signalFill, { width: `${signal.score}%` }]} /></View>
          <View style={styles.rowBetween}><Text style={styles.meta}>Score {signal.score}</Text><Text style={styles.meta}>Confidence: {signal.confidence}</Text></View>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>What shapes this</Text>
          <Text style={styles.body}>Workout frequency, duration, effort, recent high-effort sessions, and available readiness signals. Missing logs lower confidence rather than counting against you.</Text>
          <View style={styles.reasonWrap}>
            {signal.reason_codes.map((reason) => <View key={reason} style={styles.reasonPill}><Text style={styles.reasonText}>{titleCase(reason)}</Text></View>)}
          </View>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Suggested next step</Text>
          <Text style={styles.body}>{signal.suggested_next_action}</Text>
          <Text style={styles.footnote}>General wellness guidance based on available data.</Text>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>Movement intelligence</Text>
          <Text style={styles.title}>Move with context.</Text>
          <Text style={styles.subtitle}>Build a useful training history, then let your recent pattern shape today’s movement signal.</Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.segmentRow}>
          {segments.map((segment) => (
            <Pressable key={segment} onPress={() => setActiveSegment(segment)} style={[styles.segment, activeSegment === segment && styles.segmentActive]}>
              <Text style={[styles.segmentText, activeSegment === segment && styles.segmentTextActive]}>{segment}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.statusBar}>
          <View style={[styles.statusDot, { backgroundColor: dataMode === 'remote' ? colors.accent : colors.accentSoft }]} />
          <Text style={styles.statusText}>{status}</Text>
        </View>

        {isLoading ? <View style={styles.loading}><ActivityIndicator color={colors.accent} /><Text style={styles.meta}>Loading movement data…</Text></View> : null}
        {!isLoading && activeSegment === 'Today' ? renderToday() : null}
        {!isLoading && activeSegment === 'Log Workout' ? renderLogWorkout() : null}
        {!isLoading && activeSegment === 'Templates' ? renderTemplates() : null}
        {!isLoading && activeSegment === 'History' ? renderHistory() : null}
        {!isLoading && activeSegment === 'Movement Signal' ? renderSignal() : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingBottom: 108 },
  header: { paddingHorizontal: 24, paddingTop: 22 },
  eyebrow: { ...type.eyebrow, color: colors.accent },
  title: { ...type.title, color: colors.text, marginTop: 7 },
  subtitle: { ...type.body, color: colors.textMuted, marginTop: 8, maxWidth: 560 },
  segmentRow: { gap: 8, paddingHorizontal: 20, paddingVertical: 20 },
  segment: { borderBottomColor: 'transparent', borderBottomWidth: 1, minHeight: 42, justifyContent: 'center', paddingHorizontal: 8 },
  segmentActive: { borderBottomColor: colors.accent },
  segmentText: { ...type.caption, color: colors.textFaint },
  segmentTextActive: { color: colors.accent, fontFamily: type.label.fontFamily },
  statusBar: { alignItems: 'center', flexDirection: 'row', gap: 8, paddingHorizontal: 24, paddingBottom: 16 },
  statusDot: { borderRadius: 4, height: 6, width: 6 },
  statusText: { ...type.caption, color: colors.textMuted, flex: 1 },
  stack: { gap: 14, paddingHorizontal: 16 },
  card: { backgroundColor: colors.surface, borderColor: colors.hairline, borderRadius: radii.md, borderWidth: hairlineWidth, padding: 20 },
  heroCard: { paddingTop: 24 },
  signalIcon: { alignItems: 'center', backgroundColor: colors.accentWash, borderRadius: 24, height: 46, justifyContent: 'center', marginBottom: 18, width: 46 },
  heroTitle: { ...type.heading, color: colors.text, marginTop: 7 },
  body: { ...type.body, color: colors.textMuted, marginTop: 8 },
  meta: { ...type.caption, color: colors.textFaint },
  metricRow: { flexDirection: 'row', gap: 8, marginTop: 22 },
  metric: { flex: 1 },
  metricValue: { ...type.numberLg, color: colors.text },
  metricLabel: { ...type.caption, color: colors.textFaint, marginTop: 2 },
  rule: { backgroundColor: colors.hairlineSoft, height: hairlineWidth, marginVertical: 18 },
  nextAction: { ...type.voice, color: colors.accent, marginBottom: 8 },
  primaryButton: { alignItems: 'center', alignSelf: 'stretch', backgroundColor: colors.accent, borderRadius: radii.sm, flexDirection: 'row', gap: 8, justifyContent: 'center', minHeight: 50, paddingHorizontal: 18 },
  primaryButtonText: { ...type.label, color: colors.textInverse },
  pressed: { opacity: 0.68 },
  cardTitle: { ...type.heading, color: colors.text, fontSize: 19, lineHeight: 25 },
  breakdownRow: { flexDirection: 'row', gap: 6, marginTop: 18 },
  breakdownItem: { flex: 1 },
  breakdownValue: { ...type.number, color: colors.text },
  field: { marginTop: 16 },
  fieldLabel: { ...type.label, color: colors.textMuted, marginTop: 14 },
  input: { ...type.body, backgroundColor: colors.surfaceInset, borderColor: colors.hairline, borderRadius: radii.sm, borderWidth: hairlineWidth, color: colors.text, minHeight: 46, paddingHorizontal: 13, paddingVertical: 11 },
  textarea: { minHeight: 84, textAlignVertical: 'top' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 9 },
  chip: { alignItems: 'center', borderColor: colors.hairline, borderRadius: radii.full, borderWidth: hairlineWidth, justifyContent: 'center', minHeight: 38, paddingHorizontal: 13 },
  chipSelected: { backgroundColor: colors.accentWash, borderColor: colors.accentPale },
  chipText: { ...type.caption, color: colors.textMuted },
  chipTextSelected: { color: colors.accent, fontFamily: type.label.fontFamily },
  twoFields: { flexDirection: 'row', gap: 10 },
  threeFields: { flexDirection: 'row', gap: 8 },
  flexField: { flex: 1, minWidth: 0 },
  rowBetween: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  iconTextButton: { alignItems: 'center', flexDirection: 'row', gap: 4, minHeight: 44, paddingHorizontal: 6 },
  iconText: { ...type.label, color: colors.accent },
  iconButton: { alignItems: 'center', justifyContent: 'center', minHeight: 44, minWidth: 44 },
  libraryScroller: { marginHorizontal: -4, marginTop: 10 },
  libraryRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 4 },
  emptyCopy: { ...type.caption, color: colors.textFaint, marginTop: 16 },
  exerciseCard: { borderTopColor: colors.hairlineSoft, borderTopWidth: hairlineWidth, marginTop: 20, paddingTop: 16 },
  exerciseIndex: { ...type.eyebrow, color: colors.textFaint },
  templateCard: { minHeight: 94, justifyContent: 'center' },
  templateCopy: { flex: 1, paddingRight: spacing.md },
  footnote: { ...type.caption, color: colors.textFaint, marginTop: 12 },
  historyTitleWrap: { flex: 1, paddingRight: 10 },
  historyMetrics: { borderTopColor: colors.hairlineSoft, borderTopWidth: hairlineWidth, flexDirection: 'row', gap: 14, marginTop: 16, paddingTop: 14 },
  historyMetric: { ...type.caption, color: colors.textMuted },
  signalScale: { backgroundColor: colors.track, borderRadius: radii.full, height: 6, marginBottom: 10, marginTop: 22, overflow: 'hidden' },
  signalFill: { backgroundColor: colors.accent, borderRadius: radii.full, height: 6 },
  reasonWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 18 },
  reasonPill: { backgroundColor: colors.accentWash, borderRadius: radii.full, paddingHorizontal: 10, paddingVertical: 7 },
  reasonText: { ...type.caption, color: colors.accent, fontSize: 11 },
  loading: { alignItems: 'center', gap: 10, paddingVertical: 48 }
});
