import { Ionicons } from '@expo/vector-icons';
import { movementReasonLines } from '../../../src/features/movement/movementReasonCopy';
import { useLocalToday } from '../../../src/features/navigation/useLocalToday';
import { StepsToday } from '../../../src/features/health/StepsToday';
import { onPillar, tabAccent } from '../../../src/styles/pillarColors';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
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

import { generateCircadianBriefing } from '../../../src/engines/circadian';
import { MovementProgress } from '../../../src/features/movement/MovementProgress';
import { buildExerciseProgress, exerciseKey, normalizeExerciseName } from '../../../src/features/movement/exerciseProgress';
import { buildTrainingCoverage } from '../../../src/features/movement/trainingCoverage';
import {
  suggestNextSession,
  suggestionsForSession,
  type ProgressionSuggestion
} from '../../../src/features/movement/exerciseProgression';
import { WorkoutSessionLogger, type LoggerView } from '../../../src/features/movement/WorkoutSessionLogger';
import { WorkoutStarter } from '../../../src/features/movement/WorkoutStarterView';
import {
  addMovement as addStarterMovement,
  applySource,
  applyStarterToQuickDraft,
  canStart,
  createStarterDraft,
  moveMovement as moveStarterMovement,
  recentSources,
  removeMovement as removeStarterMovement,
  starterFromQuickDraft,
  routineSource,
  templateSource,
  toQuickWorkoutDraft,
  updateMovement as updateStarterMovement,
  type StarterDraft,
  type StarterSource,
  type StarterTab
} from '../../../src/features/movement/workoutStarter';
import {
  readRoutines,
  removeRoutine,
  routineFromExercises,
  routineScope,
  upsertRoutine,
  writeRoutines,
  type Routine
} from '../../../src/features/movement/routineStore';
import {
  adjustRestTimer,
  createRestTimer,
  restRemainingSeconds,
  toggleRestTimer,
  type RestTimer
} from '../../../src/features/movement/restTimer';
import { DEFAULT_WEIGHT_UNIT, type WeightUnit } from '../../../src/features/movement/weightUnits';
import { readWeightUnit, weightUnitScope } from '../../../src/features/movement/weightUnitStore';
import {
  clearWorkoutDraft,
  readWorkoutDraft,
  workoutDraftScope,
  writeWorkoutDraft
} from '../../../src/features/movement/workoutDraftStore';
import { restCompleteFeedback, sessionSavedFeedback, setLoggedFeedback } from '../../../src/features/movement/sessionFeedback';
import {
  DEFAULT_REST_ENABLED,
  readRestEnabled,
  restPreferenceScope,
  writeRestEnabled
} from '../../../src/features/movement/restPreferenceStore';
import { summarizeQuickWorkout } from '../../../src/features/movement/workoutSummary';
import { buildSessionRecap, type SessionRecap as SessionRecapModel } from '../../../src/features/movement/sessionRecap';
import { SessionRecap } from '../../../src/features/movement/SessionRecapView';
import {
  calculateMovementSummary,
  calculateMovementScore,
  type ProgressionTally,
  generateAdaptiveMovementPlan,
  generateMovementReadinessSignal,
  type MovementExerciseCategory
} from '../../../src/engines/movement';
import { useAuth } from '../../../src/features/auth/AuthProvider';
import { protocolScope, useActiveProtocol } from '../../../src/features/dailyProtocol';
import {
  deriveNutritionMoveSignal,
  deriveSleepMoveSignal,
  mealLogRowToMealLog,
  type MoveNutritionSignal,
  type MoveSleepSignal
} from '../../../src/features/movement/contextSignals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  calculateFoodQuality,
  calculateFoodResponse,
  calculateNourishmentScore,
  calculateNutrientSummary
} from '../../../src/engines/nutrition';
import { recordFoundationScore } from '../../../src/features/foundations/recordFoundationScore';
import type { FoundationScoreClient } from '../../../src/features/foundations/foundationScorePersistence';
import {
  blockedMovementPatterns,
  getMovementPatternPermissions,
  type MovementPatternPermissionClient
} from '../../../src/features/movement/patternPermissionPersistence';
import { getLocalDemoNutritionState } from '../../../src/features/nutrition/localDemoNutritionStore';
import { readGoalSetup } from '../../../src/features/nutrition/nutritionGoalStore';
import { unsetNutritionTargets } from '../../../src/features/nutrition/nutritionGoalEngine';
import { targetRowToTarget } from '../../../src/features/nutrition/nutritionTargetModel';
import {
  getActiveNutritionTarget,
  getMealLogsForDate,
  type NutritionSupabaseClient
} from '../../../src/features/nutrition/persistence';
import type { SleepRhythmSupabaseClient } from '../../../src/features/sleepRhythm/persistence';
import { createDefaultSleepNeedEstimate } from '../../../src/features/sleepRhythm/rhythmInputs';
import { loadSleepHistory } from '../../../src/features/sleepRhythm/sleepSessionSource';
import {
  addDemoExerciseLibraryItem,
  addDemoWorkoutExerciseEntries,
  addDemoWorkoutSession,
  addDemoWorkoutSetEntries,
  deleteDemoWorkoutSession,
  getLocalDemoMovementState
} from '../../../src/features/movement/localDemoMovementStore';
import { createMovementPreviewFixture } from '../../../src/features/movement/movementPreviewFixtures';
import {
  deleteWorkoutSession,
  getExerciseLibraryItems,
  getWorkoutExerciseEntriesForSession,
  getWorkoutSetEntriesForSession,
  getWorkoutSessionsForRange,
  saveExerciseLibraryItem,
  saveWorkoutExerciseEntries,
  saveWorkoutSession,
  saveWorkoutSetEntries,
  type ExerciseLibraryItemRow,
  type ExerciseMovementPattern,
  type MovementSupabaseClient,
  type WorkoutExerciseEntryRow,
  type WorkoutSessionRow,
  type WorkoutSetEntryRow,
  workoutExerciseEntryRowToEngineEntry,
  workoutSessionRowToEngineSession
} from '../../../src/features/movement/movementPersistence';
import {
  attachPreviousWorkout,
  copyPreviousSet,
  createDemoQuickWorkoutRows,
  createQuickExerciseDraft,
  createQuickSetDraft,
  createQuickWorkoutFromTemplate,
  isMovementLogWithinSafetyGuidance,
  quickWorkoutToInputs,
  removeQuickSetDraft,
  type QuickWorkoutDraft
} from '../../../src/features/movement/workoutQuickLog';
import {
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
import { colors, hairlineWidth, spacing, type, cardSurface } from '../../../src/styles/mobileTheme';
import { ActionRow } from '../../../src/components/mobile/ActionRow';
import { DayNavigator } from '../../../src/components/mobile/DayNavigator';
import { Disclosure } from '../../../src/components/mobile/Disclosure';
import { SegmentedControl } from '../../../src/components/mobile/SegmentedControl';
import { MovementPillarCard } from '../../../src/features/movement/MovementPillarCard';
import { MobilityScreenFlow } from '../../../src/features/movement/MobilityScreenFlow';
import {
  readMovementScreens,
  saveMovementScreen,
  toMovementScreen,
  type StoredMovementScreen
} from '../../../src/features/movement/movementScreenStore';
import { useQuickEntry } from '../../../src/features/navigation/useQuickEntry';

type Segment = 'Today' | 'Train' | 'Library' | 'History';
type LibraryFilter = 'all' | (typeof exerciseCategories)[number];

const segments: Segment[] = ['Today', 'Train', 'History'];
const movePalette = {
  background: '#F5F5F7',
  surface: '#FFFFFF',
  ink: '#1D1D1F',
  green: '#0071A4',
  greenMid: '#0071A4',
  slate: '#6E6E73',
  line: 'rgba(0, 0, 0, 0.045)',
  lineStrong: 'rgba(0, 0, 0, 0.072)',
  wash: 'rgba(0, 113, 164, 0.096)'
} as const;
const isUuid = (value: string | undefined): value is string =>
  Boolean(value?.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i));

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

function formatLoggedAt(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function EditorialLabel({ children }: { children: string }) {
  return <Text style={styles.editorialLabel}>{children}</Text>;
}

function PageHeading({ section, title, action }: { section: string; title: string; action?: ReactNode }) {
  return (
    <View>
      <EditorialLabel>{section}</EditorialLabel>
      <View style={styles.pageHeadingRow}>
        <Text style={styles.pageTitle}>{title}</Text>
        {action}
      </View>
    </View>
  );
}

function Divider() {
  return <View style={styles.editorialDivider} />;
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

export default function MovementScreen() {
  const { user, mode } = useAuth();
  const { moveFixture } = useLocalSearchParams<{ moveFixture?: string | string[] }>();
  /* The local day, not the UTC one: an evening workout in the Americas was being dated tomorrow. */
  const today = useLocalToday();
  const now = useMemo(() => new Date().toISOString(), []);
  const protocolScopeValue = useMemo(() => protocolScope(user?.id), [user?.id]);
  const activeProtocol = useActiveProtocol(protocolScopeValue, today);
  const trainingLimited = Boolean(activeProtocol && !activeProtocol.safety.training_allowed);
  const usePreviewFixture = __DEV__ && (Array.isArray(moveFixture) ? moveFixture[0] : moveFixture) === 'full';
  const [activeSegment, setActiveSegment] = useState<Segment>('Today');
  const [screenOpen, setScreenOpen] = useState(false);
  const [movementScreens, setMovementScreens] = useState<StoredMovementScreen[]>([]);
  const [sleepDebtHours, setSleepDebtHours] = useState<number | null>(null);
  const [isLogging, setIsLogging] = useState(false);
  const [isQuickLogging, setIsQuickLogging] = useState(false);
  const [starterOpen, setStarterOpen] = useState(false);
  /** 'edit' means the starter is changing the session already underway. */
  const [starterMode, setStarterMode] = useState<'start' | 'edit'>('start');
  const [starterDraft, setStarterDraft] = useState<StarterDraft>(() => createStarterDraft());
  /** Why the last start attempt was refused, shown beside the start button. */
  const [starterNotice, setStarterNotice] = useState('');
  const [historyDay, setHistoryDay] = useState(today);
  const [historyView, setHistoryView] = useState<'Progress' | 'All recent' | 'By day'>('All recent');
  const scrollRef = useRef<ScrollView>(null);
  const scrollPositions = useRef<Record<string, number>>({});
  const [quickDraft, setQuickDraft] = useState<QuickWorkoutDraft | null>(null);
  const [libraryQuery, setLibraryQuery] = useState('');
  const [libraryFilter, setLibraryFilter] = useState<LibraryFilter>('all');
  const [feeling, setFeeling] = useState<string | null>(null);
  const [sleepSignal, setSleepSignal] = useState<{ signal: MoveSleepSignal; summary: string }>({
    signal: 'unknown',
    summary: 'Sleep is still calibrating for today.'
  });
  const [nutritionSignal, setNutritionSignal] = useState<{ signal: MoveNutritionSignal; summary: string }>({
    signal: 'unknown',
    summary: 'Fueling is still calibrating from logged meals.'
  });
  /*
   * Today's nourishment score, only to explain a movement limiter — never to move the
   * movement score, which would double-count the same day's food. It stays null while the
   * nourishment pillar itself withholds a number for thin coverage, and the explanation
   * then falls back to reasons that do not need it.
   */
  const [nourishmentScore, setNourishmentScore] = useState<number | null>(null);
  const [sessions, setSessions] = useState<WorkoutSessionRow[]>([]);
  const [entries, setEntries] = useState<WorkoutExerciseEntryRow[]>([]);
  const [workoutSets, setWorkoutSets] = useState<WorkoutSetEntryRow[]>([]);
  const [library, setLibrary] = useState<ExerciseLibraryItemRow[]>(() => starterExerciseRows());
  const [draft, setDraft] = useState<WorkoutDraft>(() => createEmptyWorkoutDraft(today));
  const [dataMode, setDataMode] = useState<'remote' | 'demo'>('demo');
  const [status, setStatus] = useState('Log a workout to begin shaping your movement signal.');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [weightUnit, setWeightUnit] = useState<WeightUnit>(DEFAULT_WEIGHT_UNIT);
  const [loggerView, setLoggerView] = useState<LoggerView>('Focus');
  const [focusIndex, setFocusIndex] = useState(0);
  const [restTimer, setRestTimer] = useState<RestTimer | null>(null);
  const [restEnabled, setRestEnabled] = useState(DEFAULT_REST_ENABLED);
  const [timerNow, setTimerNow] = useState(() => new Date().toISOString());
  const [undoSnapshot, setUndoSnapshot] = useState<{ draft: QuickWorkoutDraft; label: string } | null>(null);
  const [draftRestored, setDraftRestored] = useState(false);
  const [recap, setRecap] = useState<{ draft: QuickWorkoutDraft; finishedAt: string; sessionDate: string } | null>(null);
  /** Why the last finish attempt did not save, shown in the logger's own footer. */
  const [saveNotice, setSaveNotice] = useState('');
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [suggestions, setSuggestions] = useState<Map<string, ProgressionSuggestion>>(() => new Map());
  const [acceptedSuggestions, setAcceptedSuggestions] = useState<Set<string>>(() => new Set());
  const routineScopeValue = useMemo(() => routineScope(user?.id), [user?.id]);
  const draftScope = useMemo(() => workoutDraftScope(user?.id), [user?.id]);
  const unitScope = useMemo(() => weightUnitScope(user?.id), [user?.id]);
  useQuickEntry(openQuickLauncher, !isLoading);
  useEffect(() => {
    const frame = requestAnimationFrame(() => scrollRef.current?.scrollTo({ y: scrollPositions.current[activeSegment] ?? 0, animated: false }));
    return () => cancelAnimationFrame(frame);
  }, [activeSegment]);

  const userId = user?.id;
  const canUseRemote = Boolean(isSupabaseConfigured && isUuid(userId));
  const shouldUseRemote = canUseRemote && dataMode === 'remote';

  const loadMovement = useCallback(async () => {
    setIsLoading(true);
    try {
      if (usePreviewFixture) {
        const fixture = createMovementPreviewFixture(today);
        setSessions(fixture.workoutSessions);
        setEntries(fixture.workoutExerciseEntries);
        setWorkoutSets(fixture.workoutSetEntries);
        setLibrary(fixture.exerciseLibrary);
        setDataMode('demo');
        setStatus('Development preview fixture active. Nothing here is saved.');
        return;
      }
      if (canUseRemote && userId) {
        const client = supabase as unknown as MovementSupabaseClient;
        const [sessionRows, libraryRows] = await Promise.all([
          getWorkoutSessionsForRange(client, userId, historyStart(today), today),
          getExerciseLibraryItems(client, userId)
        ]);
        const entryRows = (await Promise.all(
          sessionRows.map((session) => getWorkoutExerciseEntriesForSession(client, userId, session.id))
        )).flat();
        const setRows = (await Promise.all(
          sessionRows.map((session) => getWorkoutSetEntriesForSession(client, userId, session.id).catch(() => []))
        )).flat();
        setSessions(sessionRows);
        setEntries(entryRows);
        setWorkoutSets(setRows);
        setLibrary(libraryRows.length > 0 ? libraryRows : starterExerciseRows());
        setDataMode('remote');
        setStatus(sessionRows.length > 0 ? 'Based on logged workouts.' : 'Log a workout to begin shaping your movement signal.');
        return;
      }

      const state = await getLocalDemoMovementState();
      setSessions(state.workoutSessions);
      setEntries(state.workoutExerciseEntries);
      setWorkoutSets(state.workoutSetEntries);
      setLibrary(state.exerciseLibrary.length > 0 ? state.exerciseLibrary : starterExerciseRows());
      setDataMode('demo');
      setStatus(state.workoutSessions.length > 0 ? 'Based on local demo workout logs.' : 'Log a workout to begin shaping your movement signal.');
    } catch {
      if (canUseRemote) {
        setSessions([]);
        setEntries([]);
        setWorkoutSets([]);
        setLibrary(starterExerciseRows());
        setDataMode('remote');
        setStatus('Your workouts could not sync. Please try again when connected.');
        return;
      }
      const state = await getLocalDemoMovementState().catch(() => ({
        exerciseLibrary: [],
        workoutSessions: [],
        workoutExerciseEntries: [],
        workoutSetEntries: []
      }));
      setSessions(state.workoutSessions);
      setEntries(state.workoutExerciseEntries);
      setWorkoutSets(state.workoutSetEntries);
      setLibrary(state.exerciseLibrary.length > 0 ? state.exerciseLibrary : starterExerciseRows());
      setDataMode('demo');
      setStatus('Movement sync is unavailable. Local demo logging is active.');
    } finally {
      setIsLoading(false);
    }
  }, [canUseRemote, today, usePreviewFixture, userId]);

  useFocusEffect(
    useCallback(() => {
      void loadMovement();
    }, [loadMovement])
  );

  // Sleep and diet also shape today's movement readiness, so pull both here.
  useFocusEffect(
    useCallback(() => {
      let isMounted = true;

      async function loadContextSignals() {
        if (usePreviewFixture) {
          setSleepSignal({ signal: 'supportive', summary: 'Recent sleep timing looks steady enough to support normal movement capacity.' });
          setNutritionSignal({ signal: 'supportive', summary: 'Logged meals provide supportive fueling context for today.' });
          return;
        }
        try {
          const sleepClient = supabase as unknown as SleepRhythmSupabaseClient;
          const { sessions: sleepSessions, sleepNeed: activeNeed } = await loadSleepHistory({ mode, userId, client: sleepClient });
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
          const debtMinutes = briefing.sleep_debt_7_day?.nightly_average_debt_minutes ?? null;
          if (isMounted) setSleepDebtHours(typeof debtMinutes === 'number' ? debtMinutes / 60 : null);
          if (isMounted) setSleepSignal(sleepSessions.length > 0
            ? deriveSleepMoveSignal(briefing)
            : { signal: 'unknown', summary: 'Log your first sleep window to add recovery context.' });
        } catch {
          if (isMounted) setSleepSignal({ signal: 'unknown', summary: 'Sleep is still calibrating for today.' });
        }

        try {
          const meals =
            canUseRemote && userId
              ? (await getMealLogsForDate(supabase as unknown as NutritionSupabaseClient, userId, today)).map(
                  mealLogRowToMealLog
                )
              : (await getLocalDemoNutritionState()).mealLogs;
          if (isMounted) setNutritionSignal(deriveNutritionMoveSignal(today, meals));

          const targets = canUseRemote && userId
            ? targetRowToTarget(await getActiveNutritionTarget(supabase as unknown as NutritionSupabaseClient, userId))
            : (await readGoalSetup(userId ?? null, mode === 'demo', null, AsyncStorage).catch(() => null))?.targets ?? unsetNutritionTargets;
          const nutrientSummary = calculateNutrientSummary({ date: today, meals, targets });
          const nourishment = calculateNourishmentScore({
            date: today,
            nutrientSummary,
            foodQuality: calculateFoodQuality({ date: today, meals, nutrientSummary }),
            foodResponse: calculateFoodResponse({ date: today, meals }),
            targets
          });
          if (isMounted) setNourishmentScore(nourishment.score);
        } catch {
          if (isMounted) {
            setNutritionSignal({ signal: 'unknown', summary: 'Fueling is still calibrating from logged meals.' });
            setNourishmentScore(null);
          }
        }
      }

      void loadContextSignals();
      return () => {
        isMounted = false;
      };
    }, [canUseRemote, mode, now, today, usePreviewFixture, userId])
  );

  const engineSessions = useMemo(() => sessions.map(workoutSessionRowToEngineSession), [sessions]);
  const engineEntries = useMemo(() => entries.map(workoutExerciseEntryRowToEngineEntry), [entries]);
  useEffect(() => {
    let active = true;
    void readMovementScreens(protocolScope(userId)).then((rows) => {
      if (active) setMovementScreens(rows);
    });
    return () => { active = false; };
  }, [userId]);

  /*
   * What the logged lifts are doing, as counts rather than as a list. The progression
   * suggestions already carry this reading per exercise; the pillar only needs the shape
   * of it, and a lift with too little history stays unknown rather than counting against.
   */
  const progressionTally = useMemo((): ProgressionTally | null => {
    const actions = [...suggestions.values()].map((suggestion) => suggestion.action);
    if (actions.length === 0) return null;
    return {
      progressing: actions.filter((action) => action === 'add_load' || action === 'add_rep').length,
      holding: actions.filter((action) => action === 'repeat' || action === 'hold_technique').length,
      regressing: actions.filter((action) => action === 'reduce').length,
      unknown: actions.filter((action) => action === 'no_history').length
    };
  }, [suggestions]);

  const restDays7d = useMemo(() => {
    const trained = new Set<string>();
    for (const session of engineSessions) {
      const day = session.session_date.slice(0, 10);
      if (day <= today && day > historyStart(today)) trained.add(day);
    }
    /*
     * Seven days off is not a well-rested week if none of them followed training. Rest is
     * a ratio to load, so with nothing logged there is nothing for it to be a ratio of --
     * and reporting it as a perfect seven let this one term carry the whole pillar.
     */
    if (trained.size === 0) return null;
    return Math.max(0, 7 - trained.size);
  }, [engineSessions, today]);

  const summary = useMemo(
    () => calculateMovementSummary({ date: today, sessions: engineSessions, exerciseEntries: engineEntries }),
    [engineEntries, engineSessions, today]
  );

  /*
   * Patterns a safety rule has put out of bounds. The screen engine honours these and
   * withholds exercise suggestions for any pattern listed, but movement_pattern_permissions
   * has no reader in the app yet, so this is empty and is the seam that fills it.
   */
  /*
   * Read rather than assumed empty. A read that fails leaves the list alone instead of
   * clearing it: failing to reach the table is not evidence that a pattern is safe.
   */
  const [blockedPatterns, setBlockedPatterns] = useState<string[]>([]);
  useEffect(() => {
    if (!canUseRemote || !userId) return;
    let active = true;
    getMovementPatternPermissions(supabase as unknown as MovementPatternPermissionClient, userId)
      .then((rows) => { if (active) setBlockedPatterns(blockedMovementPatterns(rows)); })
      .catch(() => undefined);
    return () => { active = false; };
  }, [canUseRemote, userId]);

  const latestScreen = useMemo(
    () => toMovementScreen(movementScreens[0], blockedPatterns),
    [movementScreens, blockedPatterns]
  );

  const movementPillar = useMemo(
    () => calculateMovementScore({
      date: today,
      summary,
      progression: progressionTally,
      restDays7d,
      screen: latestScreen,
      context: { sleep_debt_hours: sleepDebtHours, nourishment_score: nourishmentScore }
    }),
    [latestScreen, nourishmentScore, progressionTally, restDays7d, sleepDebtHours, summary, today]
  );
  /* Keep today's reading so the pillar has a past, not just a present. */
  useEffect(() => {
    void recordFoundationScore({
      domain: 'movement_capacity',
      score: movementPillar,
      userId: userId ?? null,
      demo: mode === 'demo',
      client: canUseRemote ? (supabase as unknown as FoundationScoreClient) : null
    });
  }, [canUseRemote, mode, movementPillar, userId]);

  const signal = useMemo(
    () =>
      generateMovementReadinessSignal({
        summary,
        sleep_signal: sleepSignal.signal,
        nutrition_signal: nutritionSignal.signal
      }),
    [nutritionSignal.signal, sleepSignal.signal, summary]
  );
  const adaptivePlan = useMemo(
    () =>
      generateAdaptiveMovementPlan({
        signal,
        summary,
        training_allowed: !trainingLimited,
        sleep_signal: sleepSignal.signal,
        nutrition_signal: nutritionSignal.signal
      }),
    [nutritionSignal.signal, signal, sleepSignal.signal, summary, trainingLimited]
  );
  const capacityIndex = ['restore', 'technique', 'build', 'push'].indexOf(adaptivePlan.capacity);
  const filteredLibrary = useMemo(() => {
    const query = libraryQuery.trim().toLowerCase();
    return library.filter((item) => {
      const matchesCategory = libraryFilter === 'all' || item.category === libraryFilter;
      const matchesQuery = !query || [item.name, item.category, item.movement_pattern ?? '', ...(item.equipment ?? [])]
        .some((value) => value.toLowerCase().includes(query));
      return matchesCategory && matchesQuery;
    });
  }, [library, libraryFilter, libraryQuery]);
  const libraryGroups = useMemo(
    () =>
      exerciseCategories
        .map((category) => ({ category, items: filteredLibrary.filter((item) => item.category === category) }))
        .filter((group) => group.items.length > 0),
    [filteredLibrary]
  );
  const movementMix = useMemo(() => {
    const known = summary.strength_session_count + summary.cardio_session_count + summary.mobility_recovery_session_count;
    const rows = [
      { label: 'Strength', count: summary.strength_session_count, color: movePalette.green },
      { label: 'Cardio', count: summary.cardio_session_count, color: movePalette.greenMid },
      { label: 'Mobility + recovery', count: summary.mobility_recovery_session_count, color: '#6E6E73' },
      { label: 'Mixed + sport', count: Math.max(0, summary.workout_count - known), color: movePalette.slate }
    ];
    const max = Math.max(1, ...rows.map((row) => row.count));
    return rows.map((row) => ({ ...row, width: `${Math.max(row.count > 0 ? 12 : 0, (row.count / max) * 100)}%` as const }));
  }, [summary]);
  const weeklyDays = useMemo(() => {
    const end = new Date(`${today}T12:00:00.000Z`);
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(end.getTime() - (6 - index) * 24 * 60 * 60 * 1000);
      const iso = date.toISOString().slice(0, 10);
      const daySessions = sessions.filter((session) => session.session_date.slice(0, 10) === iso);
      const category = daySessions[0]?.workout_type ?? null;
      return {
        iso,
        label: date.toLocaleDateString(undefined, { weekday: 'narrow', timeZone: 'UTC' }),
        category,
        isToday: iso === today
      };
    });
  }, [sessions, today]);
  const historyWeeks = useMemo(() => {
    const end = new Date(`${today}T23:59:59.999Z`).getTime();
    const rows = Array.from({ length: 4 }, (_, index) => {
      const rangeEnd = end - index * 7 * 24 * 60 * 60 * 1000;
      const rangeStart = rangeEnd - 6 * 24 * 60 * 60 * 1000;
      const matching = sessions.filter((session) => {
        const value = new Date(`${session.session_date.slice(0, 10)}T12:00:00.000Z`).getTime();
        return value >= rangeStart && value <= rangeEnd;
      });
      return {
        label: index === 0 ? 'This week' : `${index}w ago`,
        minutes: matching.reduce((total, session) => total + (session.duration_minutes ?? 0), 0),
        count: matching.length
      };
    }).reverse();
    const max = Math.max(1, ...rows.map((row) => row.minutes));
    return rows.map((row) => ({ ...row, width: `${(row.minutes / max) * 100}%` as const }));
  }, [sessions, today]);
  const sessionPlot = useMemo(() => {
    const recent = sessions.slice(0, 12);
    const maxDuration = Math.max(1, ...recent.map((session) => session.duration_minutes ?? 0));
    return recent.map((session) => {
      const effort = session.perceived_effort ?? 5;
      const duration = session.duration_minutes ?? 0;
      return {
        id: session.id,
        title: session.title,
        left: `${8 + (Math.min(10, Math.max(1, effort)) / 10) * 82}%` as const,
        top: `${82 - (duration / maxDuration) * 68}%` as const,
        color: session.workout_type === 'strength'
          ? movePalette.green
          : session.workout_type === 'cardio'
            ? movePalette.greenMid
            : session.workout_type === 'mobility' || session.workout_type === 'recovery'
              ? '#6E6E73'
              : movePalette.slate
      };
    });
  }, [sessions]);
  const recentPattern = useMemo(() => {
    const minutes = sessions.map((session) => session.duration_minutes).filter((value): value is number => value !== null);
    const averageMinutes = minutes.length > 0 ? Math.round(minutes.reduce((sum, value) => sum + value, 0) / minutes.length) : 0;
    const counts = sessions.reduce<Record<string, number>>((result, session) => {
      result[session.workout_type] = (result[session.workout_type] ?? 0) + 1;
      return result;
    }, {});
    const mostFrequent = Object.entries(counts).sort((left, right) => right[1] - left[1])[0]?.[0] ?? 'calibrating';
    return { averageMinutes, mostFrequent };
  }, [sessions]);
  /**
   * The shelf behind the starter: what you saved, what ships with the app, and what
   * you actually did. Recent reads the entries too, so repeating a session brings its
   * movements rather than only its name.
   */
  /**
   * The recap, derived rather than frozen.
   *
   * It reads the same engines the screen already runs, so anything that changes what
   * they know — classifying a movement from the recap itself — changes the recap. The
   * saved rows are in state by the render that first shows it, because the setters in
   * the save handler and the one that opens this are applied in the same batch.
   */
  const recapModel = useMemo<SessionRecapModel | null>(() => {
    if (!recap) return null;
    const progress = buildExerciseProgress({ sessions, entries, sets: workoutSets, unit: weightUnit });
    const sessionDay = recap.sessionDate.slice(0, 10);
    return buildSessionRecap({
      summary: summarizeQuickWorkout(recap.draft, recap.finishedAt),
      progress,
      coverage: buildTrainingCoverage({ sessions, entries, sets: workoutSets, library, today }),
      sessionDate: recap.sessionDate,
      // Only the movements just trained; a suggestion for something untouched today
      // would read as a verdict on a session it was not part of.
      suggestions: progress
        .filter((item) => item.last_performed?.slice(0, 10) === sessionDay)
        .map((item) => suggestNextSession({
          progress: item,
          capacity: adaptivePlan.capacity,
          trainingAllowed: adaptivePlan.training_allowed,
          today,
          unit: weightUnit
        }))
    });
  }, [adaptivePlan.capacity, adaptivePlan.training_allowed, entries, library, recap, sessions, today, weightUnit, workoutSets]);

  const starterSources = useMemo<Record<StarterTab, StarterSource[]>>(() => ({
    Routines: routines.map(routineSource),
    Templates: workoutTemplates.map(templateSource),
    Recent: recentSources({ sessions, entries, formatDate })
  }), [entries, routines, sessions]);

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

  useEffect(() => {
    let active = true;
    void readRoutines(routineScopeValue).then((stored) => { if (active) setRoutines(stored); });
    return () => { active = false; };
  }, [routineScopeValue]);

  function persistRoutines(next: Routine[]) {
    setRoutines(next);
    void writeRoutines(routineScopeValue, next);
  }

  /** Save what was actually trained, so the next session starts from it. */
  function saveRoutineFromDraft(source?: QuickWorkoutDraft) {
    const draft = source ?? quickDraft;
    if (!draft) return;
    const routine = routineFromExercises(
      draft.title,
      draft.workout_type,
      draft.exercises.map((exercise) => ({
        exercise_name: exercise.exercise_name,
        exercise_library_item_id: exercise.exercise_library_item_id,
        category: exercise.category,
        setCount: exercise.sets.length
      }))
    );
    if (!routine) {
      setStatus('Give the session a name and at least one movement before saving it as a routine.');
      return;
    }
    persistRoutines(upsertRoutine(routines, routine));
    setStatus(`Saved "${routine.title}" to your routines.`);
  }

  function startFromRoutine(routine: Routine) {
    startQuickWorkout({
      title: routine.title,
      workout_type: routine.workout_type,
      started_at: new Date().toISOString(),
      weight_unit: weightUnit,
      exercises: routine.exercises.map((exercise) =>
        createQuickExerciseDraft(exercise.exercise_name, exercise.category, exercise.sets, exercise.exercise_library_item_id))
    });
  }

  // Unit preference lives in Settings; Move only reads it.
  useEffect(() => {
    let active = true;
    void readWeightUnit(unitScope).then((unit) => { if (active) setWeightUnit(unit); });
    return () => { active = false; };
  }, [unitScope]);

  const restScope = useMemo(() => restPreferenceScope(userId), [userId]);
  useEffect(() => {
    let active = true;
    void readRestEnabled(restScope).then((enabled) => { if (active) setRestEnabled(enabled); });
    return () => { active = false; };
  }, [restScope]);

  /** Turning it off also ends the rest already running; nobody means "after this one". */
  function updateRestEnabled(enabled: boolean) {
    setRestEnabled(enabled);
    if (!enabled) setRestTimer(null);
    void writeRestEnabled(restScope, enabled);
  }

  // Resume an interrupted session. A workout is unrecoverable if lost, so the
  // draft is restored before anything else can overwrite it.
  useEffect(() => {
    let active = true;
    void readWorkoutDraft(draftScope).then((stored) => {
      if (!active || !stored) return;
      setQuickDraft((current) => {
        if (current) return current;
        setDraftRestored(true);
        return stored;
      });
    });
    return () => { active = false; };
  }, [draftScope]);

  // Persist every edit, debounced so typing does not thrash storage.
  useEffect(() => {
    if (!quickDraft) return;
    const handle = setTimeout(() => { void writeWorkoutDraft(draftScope, quickDraft); }, 400);
    return () => clearTimeout(handle);
  }, [draftScope, quickDraft]);

  // Tick only while resting, and derive remaining time from timestamps so a
  // backgrounded phone still shows the right number on return.
  useEffect(() => {
    if (!restTimer || !restTimer.running_since) return;
    const handle = setInterval(() => setTimerNow(new Date().toISOString()), 1000);
    return () => clearInterval(handle);
  }, [restTimer]);

  // Announce rest ending once per timer, since the lifter is usually not
  // watching the screen for it.
  const restAnnouncedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!restTimer) {
      restAnnouncedFor.current = null;
      return;
    }
    if (restAnnouncedFor.current === restTimer.set_id) return;
    if (restRemainingSeconds(restTimer, timerNow) > 0) return;
    restAnnouncedFor.current = restTimer.set_id;
    restCompleteFeedback();
  }, [restTimer, timerNow]);

  function isSafetyCompatible(category: string): boolean {
    return adaptivePlan.training_allowed || category === 'mobility' || category === 'recovery';
  }

  /** Snapshot before a destructive edit so Undo can restore it. */
  function rememberForUndo(label: string) {
    if (quickDraft) setUndoSnapshot({ draft: quickDraft, label });
  }

  function handleUndo() {
    if (!undoSnapshot) return;
    setQuickDraft(undoSnapshot.draft);
    setUndoSnapshot(null);
  }

  /**
   * Marking a set complete stamps the time and starts the rest timer, so the
   * only thing a lifter has to do between sets is one tap.
   */
  function completeQuickSet(exerciseId: string, setId: string) {
    // Read the set from current state rather than from inside the updater: a
    // state updater is not guaranteed to have run by the next statement, so
    // deciding the rest timer from a value it assigns would use stale data.
    const target = quickDraft?.exercises
      .find((exercise) => exercise.id === exerciseId)?.sets
      .find((set) => set.id === setId);
    if (!target) return;

    const completedAt = new Date().toISOString();
    const nowCompleted = !target.completed;
    const restSeconds = Number(target.rest_seconds) || 90;

    setQuickDraft((current) => current ? {
      ...current,
      exercises: current.exercises.map((exercise) => exercise.id === exerciseId
        ? {
            ...exercise,
            sets: exercise.sets.map((set) => set.id === setId
              ? { ...set, completed: nowCompleted, completed_at: nowCompleted ? completedAt : null }
              : set)
          }
        : exercise)
    } : current);

    if (nowCompleted) setLoggedFeedback();

    if (nowCompleted && restEnabled && restSeconds > 0) {
      setTimerNow(completedAt);
      setRestTimer(createRestTimer(exerciseId, setId, restSeconds, completedAt));
    } else if (!nowCompleted) {
      setRestTimer((current) => current && current.set_id === setId ? null : current);
    }
  }

  function duplicateQuickSet(exerciseId: string, setId: string) {
    rememberForUndo('Undo duplicate');
    setQuickDraft((current) => current ? {
      ...current,
      exercises: current.exercises.map((exercise) => {
        if (exercise.id !== exerciseId) return exercise;
        const source = exercise.sets.find((set) => set.id === setId);
        if (!source) return exercise;
        const copy = {
          ...createQuickSetDraft(exercise.sets.length + 1),
          weight: source.weight,
          reps: source.reps,
          rpe: source.rpe,
          rest_seconds: source.rest_seconds,
          warmup: source.warmup
        };
        return { ...exercise, sets: [...exercise.sets, copy] };
      })
    } : current);
  }

  function moveQuickExercise(exerciseId: string, direction: -1 | 1) {
    setQuickDraft((current) => {
      if (!current) return current;
      const index = current.exercises.findIndex((exercise) => exercise.id === exerciseId);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= current.exercises.length) return current;
      const exercises = [...current.exercises];
      [exercises[index], exercises[target]] = [exercises[target], exercises[index]];
      return { ...current, exercises };
    });
  }

  function removeQuickExercise(exerciseId: string) {
    rememberForUndo('Undo remove movement');
    setQuickDraft((current) => {
      if (!current || current.exercises.length <= 1) return current;
      return { ...current, exercises: current.exercises.filter((exercise) => exercise.id !== exerciseId) };
    });
    setFocusIndex((current) => Math.max(0, current - 1));
  }

  /**
   * Fill the focused exercise's sets from its suggestion. Only ever runs from a
   * tap, and the fields stay editable afterwards like any other.
   */
  function acceptSuggestion() {
    const exercise = quickDraft?.exercises[focusIndex];
    if (!exercise) return;
    const key = exerciseKey({
      exercise_library_item_id: exercise.exercise_library_item_id,
      exercise_name: exercise.exercise_name
    });
    const suggestion = suggestions.get(key);
    if (!suggestion) return;

    rememberForUndo('Undo suggested targets');
    setQuickDraft((current) => current ? {
      ...current,
      exercises: current.exercises.map((item) => item.id !== exercise.id ? item : {
        ...item,
        sets: item.sets.map((set) => set.completed ? set : {
          ...set,
          weight: suggestion.target_weight === null ? set.weight : String(suggestion.target_weight),
          reps: suggestion.target_reps === null ? set.reps : String(suggestion.target_reps)
        })
      })
    } : current);
    setAcceptedSuggestions((current) => new Set(current).add(key));
  }

  function focusedSuggestion(): ProgressionSuggestion | null {
    const exercise = quickDraft?.exercises[focusIndex];
    if (!exercise) return null;
    return suggestions.get(exerciseKey({
      exercise_library_item_id: exercise.exercise_library_item_id,
      exercise_name: exercise.exercise_name
    })) ?? null;
  }

  function discardQuickDraft() {
    setQuickDraft(null);
    setRestTimer(null);
    setUndoSnapshot(null);
    setIsQuickLogging(false);
    setDraftRestored(false);
    void clearWorkoutDraft(draftScope);
  }

  function startQuickWorkout(nextDraft: QuickWorkoutDraft) {
    if (!isSafetyCompatible(nextDraft.workout_type)) {
      setStatus('Today’s protocol keeps that routine outside the suggested movement range. Choose mobility or recovery instead.');
      return;
    }
    setStarterOpen(false);
    // Computed once, here, and never again for this session: targets must not
    // change under someone who is mid-workout.
    const prepared = attachPreviousWorkout(
      {
        ...nextDraft,
        weight_unit: weightUnit,
        note: feeling ? `Felt ${feeling.toLowerCase()} before training` : null
      },
      sessions,
      entries,
      workoutSets
    );
    setSuggestions(suggestionsForSession({
      progress: buildExerciseProgress({ sessions, entries, sets: workoutSets, unit: weightUnit }),
      exerciseKeys: prepared.exercises.map((exercise) => exerciseKey({
        exercise_library_item_id: exercise.exercise_library_item_id,
        exercise_name: exercise.exercise_name
      })),
      capacity: adaptivePlan.capacity,
      trainingAllowed: adaptivePlan.training_allowed,
      today,
      unit: weightUnit
    }));
    setAcceptedSuggestions(new Set());
    setQuickDraft(prepared);
    setFocusIndex(0);
    setLoggerView('Focus');
    setRestTimer(null);
    setUndoSnapshot(null);
    setDraftRestored(false);
    setActiveSegment('Train');
    setIsLogging(false);
    setIsQuickLogging(true);
    setStatus('Session ready. One movement at a time, with last time beside today.');
  }

  function openQuickLauncher() {
    if (quickDraft) { setActiveSegment('Train'); setIsQuickLogging(true); return; }
    if (isLogging) { setActiveSegment('Train'); return; }
    // A fresh draft each time. Carrying yesterday's half-typed session forward reads
    // as a bug, and the shelf below makes starting from something a single tap anyway.
    setStarterDraft(addStarterMovement(createStarterDraft()));
    setStarterMode('start');
    setStarterNotice('');
    setStarterOpen(true);
  }

  /**
   * Back, from inside a running session.
   *
   * The list was built on the starter, so that is where back goes — adding or dropping
   * a movement mid-session used to mean finding a button inside the logger's Overview
   * tab. Nothing is applied until the person comes forward again.
   */
  function openStarterForEdit() {
    if (!quickDraft) return;
    setStarterDraft(starterFromQuickDraft(quickDraft));
    setStarterMode('edit');
    setStarterNotice('');
    setStarterOpen(true);
  }

  function applyStarterEdit() {
    if (!quickDraft) return;
    if (!canStart(starterDraft)) {
      setStarterNotice('A session needs at least one named movement.');
      return;
    }
    const next = applyStarterToQuickDraft(quickDraft, starterDraft);
    if (!isSafetyCompatible(next.workout_type)) {
      setStarterNotice('Today’s protocol keeps this session outside the suggested movement range.');
      return;
    }
    setQuickDraft(next);
    // The focused movement can outlive the list it pointed into.
    setFocusIndex((current) => Math.min(current, Math.max(0, next.exercises.length - 1)));
    setStarterOpen(false);
    setStarterNotice('');
  }

  function startFromStarter() {
    const next = toQuickWorkoutDraft(starterDraft, { weightUnit });
    if (!next) {
      setStarterNotice('Name at least one movement to start.');
      return;
    }
    if (!isSafetyCompatible(next.workout_type)) {
      setStarterNotice('Today’s protocol keeps this session outside the suggested movement range. Mobility or recovery fits better.');
      return;
    }
    setStarterOpen(false);
    setStarterNotice('');
    startQuickWorkout(next);
  }

  function openQuickTemplate(template: (typeof workoutTemplates)[number]) {
    startQuickWorkout(createQuickWorkoutFromTemplate(template));
  }

  function updateQuickExercise(exerciseId: string, update: Partial<QuickWorkoutDraft['exercises'][number]>) {
    setQuickDraft((current) => current ? {
      ...current,
      exercises: current.exercises.map((exercise) => exercise.id === exerciseId ? { ...exercise, ...update } : exercise)
    } : current);
  }

  function updateQuickSet(
    exerciseId: string,
    setId: string,
    update: Partial<QuickWorkoutDraft['exercises'][number]['sets'][number]>
  ) {
    setQuickDraft((current) => current ? {
      ...current,
      exercises: current.exercises.map((exercise) => exercise.id === exerciseId
        ? { ...exercise, sets: exercise.sets.map((set) => set.id === setId ? { ...set, ...update } : set) }
        : exercise)
    } : current);
  }

  function addQuickSet(exerciseId: string) {
    setQuickDraft((current) => current ? {
      ...current,
      exercises: current.exercises.map((exercise) => exercise.id === exerciseId
        ? { ...exercise, sets: [...exercise.sets, createQuickSetDraft(exercise.sets.length + 1)] }
        : exercise)
    } : current);
  }

  function removeQuickSet(exerciseId: string, setId: string) {
    rememberForUndo('Undo remove set');
    setQuickDraft((current) => current ? {
      ...current,
      exercises: current.exercises.map((exercise) => exercise.id === exerciseId
        ? removeQuickSetDraft(exercise, setId)
        : exercise)
    } : current);
  }

  function addQuickExercise(item?: ExerciseLibraryItemRow) {
    setQuickDraft((current) => current ? {
      ...current,
      exercises: [...current.exercises, createQuickExerciseDraft(item?.name ?? '', item?.category ?? 'strength')]
    } : current);
  }

  function applyPreviousSet(exerciseId: string, setIndex: number) {
    setQuickDraft((current) => current ? {
      ...current,
      exercises: current.exercises.map((exercise) => exercise.id === exerciseId
        ? copyPreviousSet(exercise, setIndex)
        : exercise)
    } : current);
  }

  // A refusal describes the session that was refused, so it survives until the lifter
  // changes something — then it is stale and goes.
  useEffect(() => { setSaveNotice(''); }, [quickDraft]);

  async function handleQuickSave() {
    if (!quickDraft) return;
    setSaveNotice('');
    const finishedAt = new Date().toISOString();
    const result = quickWorkoutToInputs(quickDraft, shouldUseRemote ? 'manual' : 'demo', finishedAt);
    if (!result.ok) {
      setStatus(result.error);
      setSaveNotice(result.error);
      return;
    }
    if (!isMovementLogWithinSafetyGuidance(
      adaptivePlan.training_allowed,
      result.value.session.workout_type,
      result.value.exercises.map((exercise) => exercise.category)
    )) {
      const refusal = 'Today’s protocol keeps this session outside the suggested movement range. Choose mobility or recovery instead.';
      setStatus(refusal);
      setSaveNotice(refusal);
      return;
    }

    setIsSaving(true);
    let savedRows: { session: WorkoutSessionRow; exercises: WorkoutExerciseEntryRow[]; sets: WorkoutSetEntryRow[] } | null = null;
    try {
      if (usePreviewFixture) {
        const rows = createDemoQuickWorkoutRows(result.value, 'development-move-preview', finishedAt);
        setSessions((current) => [rows.session, ...current]);
        setEntries((current) => [...rows.exercises, ...current]);
        setWorkoutSets((current) => [...rows.sets, ...current]);
        savedRows = { session: rows.session, exercises: rows.exercises, sets: rows.sets };
        setStatus('Preview workout added for this render only. Nothing was saved.');
      } else if (shouldUseRemote && userId) {
        const client = supabase as unknown as MovementSupabaseClient;
        const session = await saveWorkoutSession(client, userId, result.value.session);
        const savedExercises = await saveWorkoutExerciseEntries(
          client,
          userId,
          result.value.exercises.map((exercise) => ({ ...exercise, workout_session_id: session.id }))
        );
        const savedSets = await saveWorkoutSetEntries(
          client,
          userId,
          result.value.sets.map((set) => ({
            ...set.input,
            workout_session_id: session.id,
            workout_exercise_entry_id: savedExercises[set.exercise_index].id
          }))
        );
        setSessions((current) => [session, ...current]);
        setEntries((current) => [...savedExercises, ...current]);
        setWorkoutSets((current) => [...savedSets, ...current]);
        savedRows = { session, exercises: savedExercises, sets: savedSets };
        setDataMode('remote');
        setStatus('Workout saved with an automatic date and time.');
      } else {
        const rows = createDemoQuickWorkoutRows(result.value, 'demo-user', finishedAt);
        await addDemoWorkoutSession(rows.session);
        await addDemoWorkoutExerciseEntries(rows.exercises);
        await addDemoWorkoutSetEntries(rows.sets);
        setSessions((current) => [rows.session, ...current]);
        setEntries((current) => [...rows.exercises, ...current]);
        setWorkoutSets((current) => [...rows.sets, ...current]);
        savedRows = { session: rows.session, exercises: rows.exercises, sets: rows.sets };
        setDataMode('demo');
        setStatus('Workout saved locally with an automatic date and time.');
      }
      sessionSavedFeedback();

      // Only what the recap is *of* is stored; the recap itself is derived below, so
      // answering a question on it — what kind of movement is this — recomputes the
      // coverage it was asking about instead of leaving a screen that ignores the tap.
      setRecap({
        draft: quickDraft,
        finishedAt,
        sessionDate: savedRows?.session.session_date ?? today
      });

      setQuickDraft(null);
      setIsQuickLogging(false);
      setRestTimer(null);
      setUndoSnapshot(null);
      setDraftRestored(false);
      setFocusIndex(0);
      void clearWorkoutDraft(draftScope);
    } catch {
      const failure = 'Workout could not be saved yet. It is still here on this device — try again when you have a connection.';
      setStatus(failure);
      setSaveNotice(failure);
    } finally {
      setIsSaving(false);
    }
  }

  /**
   * Teaching the library what a movement is.
   *
   * Coverage reads a movement's pattern from the library and never guesses it from a
   * name, so anything typed freehand — "bench" rather than "Bench Press" — drops out
   * of the week's balance and the read says so. One answer fixes it everywhere: the
   * match is by name, so every session already logged under that name is classified
   * too, not just the ones after this.
   */
  async function classifyMovement(exerciseName: string, pattern: ExerciseMovementPattern) {
    const name = exerciseName.trim();
    if (!name) return;
    const now = new Date().toISOString();
    const input = {
      name,
      category: (pattern === 'mobility' ? 'mobility' : pattern === 'locomotion' ? 'cardio' : 'strength') as MovementExerciseCategory,
      movement_pattern: pattern,
      primary_muscles: [],
      equipment: [],
      is_default: false,
      source: 'manual' as const,
      source_confidence: 'high' as const,
      reason_codes: ['user_classified_movement']
    };

    try {
      if (shouldUseRemote && userId) {
        const saved = await saveExerciseLibraryItem(supabase as unknown as MovementSupabaseClient, userId, input);
        setLibrary((current) => [saved, ...current.filter((item) => item.id !== saved.id)]);
      } else {
        const row: ExerciseLibraryItemRow = {
          ...input,
          id: `classified-${normalizeExerciseName(name).replace(/\s+/g, '-')}`,
          user_id: 'demo-user',
          created_at: now,
          updated_at: now
        };
        await addDemoExerciseLibraryItem(row);
        setLibrary((current) => [row, ...current.filter((item) => item.id !== row.id)]);
      }
      setStatus(`${name} counts as ${pattern} work from now on, including what you have already logged.`);
    } catch {
      setStatus('That could not be saved just now. Your workout is safe; try again later.');
    }
  }

  function openBlankWorkout() {
    const nextDraft = createEmptyWorkoutDraft(today);
    if (!adaptivePlan.training_allowed) {
      nextDraft.workout_type = 'recovery';
      nextDraft.title = 'Gentle Movement';
    }
    setDraft(nextDraft);
    setActiveSegment('Train');
    setIsQuickLogging(false);
    setIsLogging(true);
    setStatus('New workout ready. Add only the details that are useful to you.');
  }

  function openCustomMovement() {
    const nextDraft = createEmptyWorkoutDraft(today);
    nextDraft.exercises = [createEmptyExerciseDraft(adaptivePlan.training_allowed ? 'strength' : 'recovery')];
    setDraft(nextDraft);
    setActiveSegment('Train');
    setIsQuickLogging(false);
    setIsLogging(true);
    setStatus('Custom movement ready. Name it and add only the details you want to track.');
  }

  function addLibraryMovement(item: ExerciseLibraryItemRow) {
    if (!isSafetyCompatible(item.category)) {
      setStatus('Today’s protocol keeps this movement outside the suggested movement range.');
      return;
    }
    addExercise(item);
    setActiveSegment('Train');
    setIsQuickLogging(false);
    setIsLogging(true);
    setStatus(`${item.name} added to your session.`);
  }

  async function handleSave() {
    const result = workoutDraftToInputs(draft, shouldUseRemote ? 'manual' : 'demo');
    if (!result.ok) {
      setStatus(result.error);
      return;
    }
    if (!isMovementLogWithinSafetyGuidance(
      adaptivePlan.training_allowed,
      result.session.workout_type,
      result.exercises.map((exercise) => exercise.category)
    )) {
      setStatus('Today’s protocol keeps this session outside the suggested movement range. Choose mobility or recovery instead.');
      return;
    }

    setIsSaving(true);
    try {
      if (usePreviewFixture) {
        const rows = createDemoWorkoutRows(result);
        setSessions((current) => [rows.session, ...current.filter((item) => item.id !== rows.session.id)]);
        setEntries((current) => [...rows.exercises, ...current]);
        setStatus('Preview workout added for this render only. Nothing was saved.');
      } else if (shouldUseRemote && userId) {
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
      setIsLogging(false);
    } catch {
      setStatus('Workout could not save. Review the details and try again.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(sessionId: string) {
    try {
      if (usePreviewFixture) {
        setSessions((current) => current.filter((item) => item.id !== sessionId));
        setEntries((current) => current.filter((item) => item.workout_session_id !== sessionId));
        setWorkoutSets((current) => current.filter((item) => item.workout_session_id !== sessionId));
        setStatus('Preview workout removed for this render only. Nothing was saved.');
        return;
      }
      if (shouldUseRemote && userId) {
        await deleteWorkoutSession(supabase as unknown as MovementSupabaseClient, userId, sessionId);
      } else {
        await deleteDemoWorkoutSession(sessionId);
      }
      setSessions((current) => current.filter((item) => item.id !== sessionId));
      setEntries((current) => current.filter((item) => item.workout_session_id !== sessionId));
      setWorkoutSets((current) => current.filter((item) => item.workout_session_id !== sessionId));
      setStatus('Workout removed. Your movement signal has been updated.');
    } catch {
      Alert.alert('Unable to remove workout', 'The workout could not be removed right now.');
    }
  }

  function renderToday() {
    return (
      <View style={styles.page}>
        {/* No page heading: the navigation title reads "Move" and the segment above reads "Today". */}
        <MovementPillarCard
          causes={movementPillar.limiter_causes}
          hasScreen={movementScreens.length > 0}
          onOpenScreen={() => setScreenOpen(true)}
          palette={{
            surface: movePalette.surface,
            ink: movePalette.ink,
            accent: movePalette.greenMid,
            muted: movePalette.slate,
            line: movePalette.lineStrong,
            wash: movePalette.wash
          }}
          score={movementPillar}
        />

        {trainingLimited ? (
          <View style={styles.protocolNote}>
            <Ionicons color={movePalette.greenMid} name="shield-checkmark-outline" size={16} />
            <Text style={styles.protocolNoteText}>
              Today's protocol suggests keeping training easy. Gentle movement or rest is a good use of today.
            </Text>
          </View>
        ) : null}

        {draftRestored && quickDraft ? (
          <View style={styles.resumeNote}>
            <Ionicons color={movePalette.greenMid} name="refresh-outline" size={16} />
            <Text style={styles.resumeNoteText}>Your last session was still open. Pick up where you left off.</Text>
          </View>
        ) : null}

        <Pressable accessibilityRole="button" onPress={openQuickLauncher} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
          <Ionicons name={quickDraft ? 'play' : 'add'} color={onPillar} size={22} />
          <Text style={styles.primaryButtonText}>{quickDraft ? 'Resume workout' : 'Start workout'}</Text>
        </Pressable>

        {quickDraft ? (
          <Pressable accessibilityRole="button" onPress={discardQuickDraft} style={styles.textAction}>
            <Text style={styles.textActionLabel}>Discard the open session</Text>
          </Pressable>
        ) : null}

        <View style={styles.verdictBlock}>
          <Text style={styles.verdict}>{adaptivePlan.verdict}</Text>
          <Text style={styles.lede}>{adaptivePlan.explanation}</Text>
          <View style={styles.capacityLabels}>
            {['Restore', 'Technique', 'Build', 'Push'].map((label, index) => (
              <Text key={label} style={[styles.capacityLabel, index === capacityIndex && styles.capacityLabelActive]}>{label}</Text>
            ))}
          </View>
          <View style={styles.capacityRail}>
            {[0, 1, 2, 3].map(index => <View key={index} style={[styles.capacitySegment, index === capacityIndex && styles.capacitySegmentActive]} />)}
          </View>
          <Text style={styles.rangeMeta}>Suggested effort {adaptivePlan.effort_range.min}–{adaptivePlan.effort_range.max} of 10 · readiness comes from Home</Text>
          <View style={styles.reasonList}>
            {movementReasonLines(adaptivePlan.reason_codes).map(line => (
              <View key={line} style={styles.reasonRow}>
                <View style={styles.reasonDot} />
                <Text style={styles.reasonLine}>{line}</Text>
              </View>
            ))}
          </View>
        </View>
        <Divider />

        <View style={styles.feelingPanel}>
          <Text style={styles.feelingTitle}>How are you feeling?</Text>
          <Text style={styles.feelingHint}>Optional · saved with the session so you can read it back later.</Text>
          <View style={styles.chipWrap}>
            {['Heavy', 'Steady', 'Energized', 'Sore'].map((item) => (
              <Chip key={item} label={item} onPress={() => setFeeling(feeling === item ? null : item)} selected={feeling === item} />
            ))}
          </View>
        </View>

        <Disclosure detail="Objective, what supports today, and your recent mix" title="More about today">
        <View>
          <EditorialLabel>Today’s objective</EditorialLabel>
          <Text style={styles.objective}>{adaptivePlan.objective}</Text>
          <View style={styles.agenda}>
            {adaptivePlan.agenda.map((item) => (
              <View key={item.timing} style={styles.agendaRow}>
                <Text style={styles.agendaWhen}>{item.timing.toUpperCase()}</Text>
                <Text style={styles.agendaCopy}>{item.guidance}</Text>
              </View>
            ))}
          </View>
        </View>

        <View>
          <EditorialLabel>Supporting today</EditorialLabel>
          <View style={styles.supportList}>
            {adaptivePlan.support.map((item) => (
              <View key={item.key} style={styles.supportRow}>
                <Ionicons
                  color={movePalette.greenMid}
                  name={item.key === 'sleep' ? 'moon-outline' : item.key === 'nutrition' ? 'nutrition-outline' : 'pulse-outline'}
                  size={17}
                />
                <View style={styles.supportCopy}>
                  <Text style={styles.supportTitle}>{item.label}</Text>
                  <Text style={styles.supportBody}>{item.summary}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        <View>
          <EditorialLabel>Your movement mix</EditorialLabel>
          <View style={styles.mixList}>
            {movementMix.map((lane) => (
              <View key={lane.label}>
                <View style={styles.mixHeading}><Text style={styles.mixLabel}>{lane.label}</Text><Text style={styles.monoMeta}>{lane.count}</Text></View>
                <View style={styles.mixRail}><View style={[styles.mixFill, { backgroundColor: lane.color, width: lane.width }]} /></View>
              </View>
            ))}
          </View>
          <Text style={styles.mixInsight}>{adaptivePlan.movement_mix_insight}</Text>
        </View>
        </Disclosure>

        <Divider />

        <View>
          <StepsToday scope={protocolScopeValue} today={today} />
          <EditorialLabel>This week</EditorialLabel>
          <View style={styles.weekRow}>
            {weeklyDays.map((day) => {
              const dotColor = day.category === 'strength'
                ? movePalette.green
                : day.category === 'cardio'
                  ? movePalette.greenMid
                  : day.category === 'mobility' || day.category === 'recovery'
                    ? '#6E6E73'
                    : day.category
                      ? movePalette.slate
                      : 'transparent';
              return (
                <View key={day.iso} style={styles.weekDay}>
                  <Text style={[styles.weekLabel, day.isToday && styles.weekLabelToday]}>{day.label}</Text>
                  <View style={[styles.weekDot, { backgroundColor: dotColor }, day.isToday && styles.weekDotToday]} />
                </View>
              );
            })}
          </View>
          <View style={styles.weekLegend}>
            <Text style={styles.monoMeta}>{summary.workout_count} sessions</Text>
            <Text style={styles.monoMeta}>{summary.total_minutes} minutes</Text>
            <Text style={styles.monoMeta}>{summary.recent_high_effort_count} high effort</Text>
          </View>
        </View>
      </View>
    );
  }

  function renderLogWorkout() {
    return (
      <View style={styles.page}>
        <PageHeading
          action={<Pressable onPress={() => setIsLogging(false)} style={styles.textAction}><Text style={styles.textActionLabel}>Back</Text></Pressable>}
          section="MOVE · TRAIN"
          title={draft.title || 'Build a session'}
        />
        <View style={styles.panel}>
          <EditorialLabel>Session details</EditorialLabel>
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

        <View style={styles.panel}>
          <View style={styles.rowBetween}>
            <EditorialLabel>Exercises</EditorialLabel>
            <Pressable onPress={() => addExercise()} style={({ pressed }) => [styles.iconTextButton, pressed && styles.pressed]}>
              <Ionicons color={movePalette.green} name="add" size={17} />
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
                <Pressable accessibilityLabel={`Remove ${item.exercise_name || `exercise ${index + 1}`}`} onPress={() => updateDraft('exercises', draft.exercises.filter((exerciseItem) => exerciseItem.id !== item.id))} style={styles.iconButton}>
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
          {isSaving ? <ActivityIndicator color={onPillar} /> : <Ionicons color={onPillar} name="checkmark" size={20} />}
          <Text style={styles.primaryButtonText}>{isSaving ? 'Saving…' : 'Save Workout'}</Text>
        </Pressable>
      </View>
    );
  }

  function renderTrain() {
    if (isLogging) return renderLogWorkout();
    return (
      <View style={styles.page}>
        <PageHeading
          action={<Pressable onPress={openBlankWorkout} style={styles.textAction}><Text style={styles.textActionLabel}>+ New</Text></Pressable>}
          section="MOVE · TRAIN"
          title="Templates"
        />
        <Text style={styles.sectionIntro}>
          Choose a starting point that fits today’s {titleCase(adaptivePlan.capacity)} range, then adjust it to your context.
        </Text>

        {routines.length > 0 ? (
          <>
            <EditorialLabel>Your routines</EditorialLabel>
            {routines.map((routine) => (
              <View key={routine.id} style={styles.templateCard}>
                <View style={styles.templateCopy}>
                  <Text style={styles.templateTitle}>{routine.title}</Text>
                  <Text style={styles.monoLine}>
                    {routine.exercises.length} exercises · {routine.exercises.reduce((count, item) => count + item.sets, 0)} sets
                  </Text>
                  <Text style={styles.templateMeta} numberOfLines={1}>
                    {routine.exercises.map((item) => item.exercise_name).join(' · ')}
                  </Text>
                </View>
                <View style={styles.templateActions}>
                  <Pressable
                    accessibilityLabel={`Start ${routine.title}`}
                    accessibilityRole="button"
                    disabled={!isSafetyCompatible(routine.workout_type)}
                    onPress={() => startFromRoutine(routine)}
                    style={({ pressed }) => [styles.templateStart, !isSafetyCompatible(routine.workout_type) && styles.disabled, pressed && styles.pressed]}
                  >
                    <Text style={styles.templateStartText}>
                      {isSafetyCompatible(routine.workout_type) ? 'Start' : 'Limited today'}
                    </Text>
                  </Pressable>
                  <Pressable
                    accessibilityLabel={`Delete ${routine.title}`}
                    accessibilityRole="button"
                    onPress={() => persistRoutines(removeRoutine(routines, routine.id))}
                    style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
                  >
                    <Ionicons color={colors.danger} name="trash-outline" size={17} />
                  </Pressable>
                </View>
              </View>
            ))}
            <Divider />
          </>
        ) : null}

        <EditorialLabel>Starting points</EditorialLabel>
        {workoutTemplates.map((template) => (
          <View key={template.id} style={styles.templateCard}>
            <View style={styles.templateCopy}>
              <View style={styles.rowBetween}>
                <Text style={styles.templateTitle}>{template.title}</Text>
                {adaptivePlan.recommended_session_types.includes(template.workout_type) ? (
                  <Text style={styles.fitTag}>Today</Text>
                ) : null}
              </View>
              <Text style={styles.monoLine}>{template.exercises.length} exercises · {template.duration_minutes} min</Text>
              <Text style={styles.templateMeta}>{titleCase(template.workout_type)} · target effort {template.perceived_effort}</Text>
            </View>
            <View style={styles.templateActions}>
              <Pressable
                disabled={!isSafetyCompatible(template.workout_type)}
                onPress={() => openQuickTemplate(template)}
                style={({ pressed }) => [styles.templateStart, !isSafetyCompatible(template.workout_type) && styles.disabled, pressed && styles.pressed]}
              >
                <Text style={styles.templateStartText}>{isSafetyCompatible(template.workout_type) ? 'Start' : 'Limited today'}</Text>
              </Pressable>
              <Pressable
                disabled={!isSafetyCompatible(template.workout_type)}
                onPress={() => openQuickTemplate(template)}
                style={({ pressed }) => [styles.templatePreview, !isSafetyCompatible(template.workout_type) && styles.disabled, pressed && styles.pressed]}
              >
                <Text style={styles.templatePreviewText}>Open ledger</Text>
              </Pressable>
            </View>
          </View>
        ))}
        <Pressable onPress={openBlankWorkout} style={({ pressed }) => [styles.outlineAction, pressed && styles.pressed]}>
          <View style={styles.outlineActionCopyWrap}>
            <Text style={styles.outlineActionTitle}>Log from scratch</Text>
            <Text style={styles.outlineActionCopy}>Build a session with only the details you want to track.</Text>
          </View>
          <Ionicons color={movePalette.ink} name="arrow-forward" size={17} />
        </Pressable>
        <Divider />
        {renderLibrarySection()}
      </View>
    );
  }

  function renderLibrarySection() {
    return (
      <View style={styles.page}>
        <View style={styles.rowBetween}>
          <EditorialLabel>Movement library</EditorialLabel>
          <Pressable accessibilityRole="button" onPress={openCustomMovement} style={styles.textAction}>
            <Text style={styles.textActionLabel}>+ Custom</Text>
          </Pressable>
        </View>
        <View style={styles.searchBox}>
          <Ionicons color={movePalette.slate} name="search" size={17} />
          <TextInput
            onChangeText={setLibraryQuery}
            placeholder="Search movements"
            placeholderTextColor="#6E6E73"
            style={styles.searchInput}
            value={libraryQuery}
          />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.libraryFilters}>
          {(['all', ...exerciseCategories] as LibraryFilter[]).map((category) => (
            <Chip key={category} label={titleCase(category)} onPress={() => setLibraryFilter(category)} selected={libraryFilter === category} />
          ))}
        </ScrollView>
        {filteredLibrary.length === 0 ? (
          <Text style={styles.emptyLibrary}>No movements match that search.</Text>
        ) : (
          <View style={styles.libraryList}>
            {libraryGroups.map((group) => (
              <View key={group.category} style={styles.libraryGroup}>
                <Text style={styles.libraryGroupTitle}>{titleCase(group.category)}</Text>
                {group.items.map((item, index) => (
                  <Pressable
                    disabled={!isSafetyCompatible(item.category)}
                    key={item.id}
                    onPress={() => addLibraryMovement(item)}
                    style={({ pressed }) => [styles.libraryItem, index === 0 && styles.libraryItemFirst, !isSafetyCompatible(item.category) && styles.disabled, pressed && styles.pressed]}
                  >
                    <View style={styles.libraryItemCopy}>
                      <Text style={styles.libraryItemTitle}>{item.name}</Text>
                      <Text style={styles.libraryItemMeta}>{titleCase(item.movement_pattern ?? item.category)} emphasis</Text>
                    </View>
                    <View style={styles.libraryItemAside}>
                      <Text style={styles.libraryItemCategory}>{item.is_default ? 'Healthi movement' : 'Custom'}</Text>
                      <Text style={styles.monoMeta}>{item.equipment?.join(', ') || 'No equipment'}</Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            ))}
          </View>
        )}
        <Text style={styles.footnote}>Select a movement to add it to the current workout draft.</Text>
      </View>
    );
  }

  function renderHistory() {
    const visibleSessions = historyView === 'By day' ? sessions.filter((session) => session.session_date?.slice(0, 10) === historyDay) : sessions;
    return (
      <View style={styles.page}>
        {/* The segment above already identifies History. */}
        <SegmentedControl options={['All recent', 'By day', 'Progress'] as const} value={historyView} onChange={setHistoryView} />
        {historyView === 'Progress' ? (
          <MovementProgress
            entries={entries}
            library={library}
            sessions={sessions}
            sets={workoutSets}
            today={today}
            unit={weightUnit}
          />
        ) : null}
        {historyView === 'By day' ? <DayNavigator date={historyDay} today={today} earliest={historyStart(today)} onChange={setHistoryDay} /> : null}
        {historyView !== 'Progress' ? <EditorialLabel>Sessions</EditorialLabel> : null}
        {historyView === 'Progress' ? null : visibleSessions.length === 0 ? (
          <View style={styles.emptyHistory}><Text style={styles.templateTitle}>No workouts for this view</Text><Text style={styles.body}>Your recent sessions will appear here after you log one.</Text></View>
        ) : visibleSessions.map((session) => {
          const sessionEntries = entries.filter((entry) => entry.workout_session_id === session.id);
          return (
            <View key={session.id} style={styles.sessionRow}>
              <Text style={styles.sessionDate}>{formatDate(session.session_date)}</Text>
              <View style={styles.rowBetween}>
                <View style={styles.historyTitleWrap}>
                  <Text style={styles.sessionTitle}>{session.title}</Text>
                  <Text style={styles.sessionMeta}>{titleCase(session.workout_type)} · {sessionEntries.length} exercises · {session.source === 'demo' ? 'Local demo' : 'Logged'}</Text>
                </View>
                <View style={styles.sessionAside}>
                  <Text style={styles.sessionMinutes}>{session.duration_minutes ?? '—'} min</Text>
                  <Text style={styles.sessionEffort}>Effort {session.perceived_effort ?? '—'}</Text>
                </View>
                <Pressable accessibilityLabel={`Delete ${session.title}`} onPress={() => handleDelete(session.id)} style={styles.iconButton}>
                  <Ionicons color={colors.danger} name="trash-outline" size={17} />
                </Pressable>
              </View>
            </View>
          );
        })}

        {historyView === 'Progress' ? null : (
        <Disclosure title="Movement patterns" detail="Training load, effort and recent trends">
        <Text style={styles.historyInsight}>
          {sessions.length === 0
            ? 'Your first session will begin a useful movement pattern.'
            : summary.consistency === 'steady'
              ? 'Your recent rhythm is steady enough to learn from.'
              : 'Each complete log makes the next movement suggestion more personal.'}
        </Text>

        <View style={styles.historyPlotCard}>
          <View style={styles.plotArea}>
            <View style={[styles.plotGridLine, { top: '25%' }]} />
            <View style={[styles.plotGridLine, { top: '50%' }]} />
            <View style={[styles.plotGridLine, { top: '75%' }]} />
            {sessionPlot.map((point) => (
              <View
                accessibilityLabel={`${point.title} session marker`}
                key={point.id}
                style={[styles.plotDot, { backgroundColor: point.color, left: point.left, top: point.top }]}
              />
            ))}
          </View>
          <View style={styles.plotAxisRow}>
            <Text style={styles.plotAxisLabel}>Lower effort</Text>
            <Text style={styles.plotAxisTitle}>Session effort</Text>
            <Text style={styles.plotAxisLabel}>Higher</Text>
          </View>
          <View style={styles.plotLegend}>
            <Text style={styles.plotLegendText}>Dot height reflects duration</Text>
            <Text style={styles.plotLegendText}>{sessionPlot.length} recent sessions</Text>
          </View>
        </View>

        <Divider />

        <View>
          <EditorialLabel>Positive mirror</EditorialLabel>
          <Text style={styles.mirrorLine}>{adaptivePlan.movement_mix_insight}</Text>
          <View style={styles.mirrorTag}><Text style={styles.monoLine}>{summary.workout_count} sessions · {summary.total_minutes} minutes · {summary.confidence} confidence</Text></View>
        </View>

        <Divider />

        <View>
          <EditorialLabel>Load history</EditorialLabel>
          <View style={styles.loadRows}>
            {historyWeeks.map((week) => (
              <View key={week.label} style={styles.loadRow}>
                <Text style={styles.loadLabel}>{week.label}</Text>
                <View style={styles.loadRail}><View style={[styles.loadFill, { width: week.width }]} /></View>
                <Text style={styles.loadValue}>{week.minutes}m</Text>
              </View>
            ))}
          </View>
        </View>

        <Divider />

        <View>
          <EditorialLabel>Recent pattern</EditorialLabel>
          <View style={styles.patternRows}>
            <View style={styles.patternRow}><Text style={styles.patternLabel}>Most frequent</Text><Text style={styles.patternValue}>{titleCase(recentPattern.mostFrequent)}</Text></View>
            <View style={styles.patternRow}><Text style={styles.patternLabel}>Average duration</Text><Text style={styles.patternValue}>{recentPattern.averageMinutes || '—'} min</Text></View>
            <View style={styles.patternRow}><Text style={styles.patternLabel}>Current training load</Text><Text style={styles.patternValue}>{summary.estimated_training_load || '—'}</Text></View>
          </View>
        </View>

        <Divider />


        </Disclosure>
        )}
      </View>
    );
  }

  if (starterOpen) {
    return (
      <SafeAreaView edges={['top']} style={styles.safe}>
        <WorkoutStarter
          capacityNote={adaptivePlan.training_allowed
            ? `Today reads as a ${adaptivePlan.capacity} day · suggested effort ${adaptivePlan.effort_range.min}–${adaptivePlan.effort_range.max} of 10`
            : 'Today’s protocol suggests mobility or recovery. Other sessions cannot be started.'}
          draft={starterDraft}
          isAllowed={(source) => isSafetyCompatible(source.workout_type)}
          notice={starterNotice || null}
          onAddMovement={() => setStarterDraft((current) => addStarterMovement(current))}
          onChangeTitle={(title) => setStarterDraft((current) => ({ ...current, title }))}
          onClose={() => { setStarterOpen(false); setStarterNotice(''); }}
          onMoveMovement={(id, direction) => setStarterDraft((current) => moveStarterMovement(current, id, direction))}
          onPickSource={(source) => { setStarterNotice(''); setStarterDraft(applySource(source)); }}
          onRemoveMovement={(id) => setStarterDraft((current) => removeStarterMovement(current, id))}
          mode={starterMode}
          onLeave={() => { setStarterOpen(false); setIsQuickLogging(false); setActiveSegment('Today'); }}
          onStart={starterMode === 'edit' ? applyStarterEdit : startFromStarter}
          onUpdateMovement={(id, update) => setStarterDraft((current) => updateStarterMovement(current, id, update))}
          sources={starterSources}
        />
      </SafeAreaView>
    );
  }

  // A finished session owns the screen before Today does. Saving used to drop a
  // dismissible card onto a screen the lifter had already left, which made the work
  // feel filed rather than finished.
  if (recap && recapModel) {
    return (
      <SafeAreaView edges={['top']} style={styles.safe}>
        <SessionRecap
          onDone={() => { setRecap(null); setActiveSegment('Today'); }}
          onClassify={(name, pattern) => void classifyMovement(name, pattern)}
          onSaveRoutine={() => saveRoutineFromDraft(recap.draft)}
          recap={recapModel}
          savedLocally={!shouldUseRemote}
        />
      </SafeAreaView>
    );
  }

  // An open session owns the screen too. Nothing competes with the set in front of
  // the lifter, and the finish action stays pinned rather than scrolling away.
  if (isQuickLogging && quickDraft) {
    return (
      <SafeAreaView edges={['top']} style={styles.safe}>
        <WorkoutSessionLogger
          canUndo={undoSnapshot !== null}
          draft={quickDraft}
          focusIndex={focusIndex}
          now={timerNow}
          onAddExercise={() => addQuickExercise()}
          onAddSet={addQuickSet}
          onAdjustRest={(delta) => setRestTimer((current) => current ? adjustRestTimer(current, delta) : current)}
          onCompleteSet={completeQuickSet}
          onDuplicateSet={duplicateQuickSet}
          onExit={openStarterForEdit}
          notice={saveNotice || null}
          onFinish={() => void handleQuickSave()}
          onFocusIndexChange={setFocusIndex}
          onMoveExercise={moveQuickExercise}
          onRemoveExercise={removeQuickExercise}
          onRemoveSet={removeQuickSet}
          onAcceptSuggestion={acceptSuggestion}
          onSaveRoutine={saveRoutineFromDraft}
          suggestion={focusedSuggestion()}
          suggestionAccepted={(() => {
            const exercise = quickDraft.exercises[focusIndex];
            if (!exercise) return false;
            return acceptedSuggestions.has(exerciseKey({
              exercise_library_item_id: exercise.exercise_library_item_id,
              exercise_name: exercise.exercise_name
            }));
          })()}
          onRenameExercise={(exerciseId, exercise_name) => updateQuickExercise(exerciseId, { exercise_name })}
          onSetRestEnabled={updateRestEnabled}
          onSkipRest={() => setRestTimer(null)}
          onToggleRest={() => setRestTimer((current) => current ? toggleRestTimer(current, new Date().toISOString()) : current)}
          onUndo={handleUndo}
          onUpdateSet={updateQuickSet}
          onViewChange={setLoggerView}
          restEnabled={restEnabled}
          restTimer={restTimer}
          saveState={isSaving ? 'saving' : 'idle'}
          savedLocally={!shouldUseRemote}
          undoLabel={undoSnapshot?.label ?? null}
          unit={weightUnit}
          view={loggerView}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <ScrollView ref={scrollRef} onScroll={(event) => { scrollPositions.current[activeSegment] = event.nativeEvent.contentOffset.y; }} scrollEventThrottle={100} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false}>
        <View style={styles.navigationHeader}><Text accessibilityRole="header" style={styles.navigationTitle}>Movement</Text>{activeSegment === 'Train' ? <Pressable accessibilityRole="button" onPress={() => setActiveSegment('Today')} style={styles.textAction}><Text style={styles.textActionLabel}>‹ Back to Movement · draft kept</Text></Pressable> : <SegmentedControl options={segments} value={activeSegment} onChange={setActiveSegment} />}</View>

        {usePreviewFixture ? (
          <View style={styles.previewBanner}>
            <View style={styles.previewDot} />
            <Text style={styles.previewBannerText}>Full Move preview fixture · nothing is saved</Text>
          </View>
        ) : null}

        {isLoading ? <View style={styles.loading}><ActivityIndicator color={movePalette.green} /><Text style={styles.meta}>Loading movement data…</Text></View> : null}
        {!isLoading && screenOpen ? (
          <View style={styles.page}>
            <MobilityScreenFlow
              blockedPatterns={blockedPatterns}
              initial={latestScreen}
              palette={{
                surface: movePalette.surface,
                ink: movePalette.ink,
                accent: movePalette.greenMid,
                muted: movePalette.slate,
                line: movePalette.lineStrong,
                wash: movePalette.wash
              }}
              onClose={() => setScreenOpen(false)}
              onSave={(result) => {
                void saveMovementScreen(protocolScope(userId), {
                  date: today,
                  findings: result.findings,
                  postureFlags: result.postureFlags
                }).then((rows) => {
                  setMovementScreens(rows);
                  setScreenOpen(false);
                  setStatus('Movement check saved. It now feeds your movement score.');
                });
              }}
            />
          </View>
        ) : null}
        {!isLoading && !screenOpen && activeSegment === 'Today' ? renderToday() : null}
        {!isLoading && !screenOpen && activeSegment === 'Train' ? renderTrain() : null}
        {!isLoading && !screenOpen && activeSegment === 'History' ? renderHistory() : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: 'transparent' },
  scroll: { paddingBottom: 28 },
  navigationHeader: { paddingHorizontal: 20, paddingTop: 18, gap: 16 },
  navigationTitle: { ...type.largeTitle, color: colors.text },
  resumeNote: {
    alignItems: 'center',
    backgroundColor: movePalette.wash,
    borderRadius: 14,
    flexDirection: 'row',
    gap: 9,
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  resumeNoteText: { ...type.caption, color: movePalette.ink, flex: 1 },
  segmentRow: {
    borderBottomColor: movePalette.line,
    borderBottomWidth: hairlineWidth,
    gap: 18,
    paddingHorizontal: 22,
    paddingTop: 6
  },
  segment: { borderBottomColor: 'transparent', borderBottomWidth: 2, minHeight: 48, justifyContent: 'center' },
  segmentActive: { borderBottomColor: movePalette.green },
  segmentText: { ...type.caption, color: '#6E6E73', fontFamily: type.label.fontFamily, fontSize: 12 },
  segmentTextActive: { color: movePalette.green },
  previewBanner: { alignItems: 'center', alignSelf: 'center', backgroundColor: movePalette.wash, borderColor: 'rgba(0, 113, 164, 0.128)', borderRadius: 14, borderWidth: hairlineWidth, flexDirection: 'row', gap: 7, marginHorizontal: 22, marginTop: 14, paddingHorizontal: 11, paddingVertical: 8 },
  previewDot: { backgroundColor: movePalette.greenMid, borderRadius: 3, height: 6, width: 6 },
  previewBannerText: { ...type.caption, color: movePalette.green, fontSize: 13 },
  page: { gap: 22, paddingHorizontal: 22, paddingTop: 30 },
  pageHeadingRow: { alignItems: 'flex-end', flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  pageTitle: { ...type.title, color: movePalette.ink, fontSize: 30, lineHeight: 37 },
  editorialLabel: {
    ...type.eyebrow,
    color: '#6E6E73',
    fontSize: 12,
    letterSpacing: 0,
    lineHeight: 15
  },
  editorialDivider: { backgroundColor: movePalette.line, height: hairlineWidth, marginVertical: 2 },
  verdictBlock: { paddingTop: 4 },
  verdict: { ...type.voice, color: movePalette.ink, fontSize: 28, lineHeight: 35, marginTop: 14 },
  lede: { ...type.body, color: '#424245', lineHeight: 22, marginTop: 10 },
  whyTitle: { ...type.label, color: movePalette.ink, marginTop: 22 },
  reasonList: { gap: 9, marginTop: 11 },
  reasonRow: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  reasonDot: { backgroundColor: movePalette.greenMid, borderRadius: 3, height: 5, width: 5 },
  reasonLine: { ...type.caption, color: '#6E6E73', flex: 1 },
  protocolNote: { alignItems: 'flex-start', backgroundColor: movePalette.wash, borderColor: 'rgba(0, 113, 164, 0.128)', borderRadius: 14, borderWidth: hairlineWidth, flexDirection: 'row', gap: 9, padding: 14 },
  protocolNoteText: { ...type.caption, color: '#424245', flex: 1 },
  primaryButton: { alignItems: 'center', alignSelf: 'stretch', backgroundColor: tabAccent.movement, borderRadius: 14, flexDirection: 'row', gap: 10, justifyContent: 'center', minHeight: 56, paddingHorizontal: 18 },
  primaryButtonText: { ...type.label, color: onPillar, fontSize: 15 },
  changedRow: { gap: 8 },
  changedCopy: { ...type.body, color: '#6E6E73' },
  capacityLabels: { flexDirection: 'row', marginTop: 15 },
  capacityLabel: { ...type.caption, color: '#6E6E73', flex: 1, fontSize: 12, textAlign: 'center' },
  capacityLabelActive: { color: movePalette.green, fontFamily: type.label.fontFamily },
  capacityRail: { flexDirection: 'row', gap: 3, marginTop: 8 },
  capacitySegment: { backgroundColor: 'rgba(0, 0, 0, 0.048)', borderRadius: 3, flex: 1, height: 6 },
  capacitySegmentActive: { backgroundColor: movePalette.green },
  capacityPanel: { ...cardSurface, borderColor: movePalette.line, borderRadius: 15, borderWidth: hairlineWidth, marginTop: 14, padding: 16 },
  capacityTitle: { ...type.heading, color: movePalette.ink, fontSize: 18, lineHeight: 24 },
  body: { ...type.body, color: '#6E6E73', marginTop: 8 },
  monoMeta: { ...type.caption, color: '#6E6E73', fontVariant: ['tabular-nums'], fontSize: 13 },
  rangeMeta: { ...type.caption, color: movePalette.greenMid, fontVariant: ['tabular-nums'], marginTop: 12 },
  objective: { ...type.voice, color: movePalette.ink, fontSize: 22, lineHeight: 29, marginTop: 13 },
  agenda: { borderTopColor: movePalette.line, borderTopWidth: hairlineWidth, marginTop: 18 },
  agendaRow: { alignItems: 'flex-start', borderBottomColor: movePalette.line, borderBottomWidth: hairlineWidth, flexDirection: 'row', gap: 16, paddingVertical: 13 },
  agendaWhen: { ...type.eyebrow, color: movePalette.greenMid, fontSize: 12, lineHeight: 17, width: 44 },
  agendaCopy: { ...type.body, color: '#424245', flex: 1, fontSize: 13.5, lineHeight: 20 },
  supportList: { gap: 16, marginTop: 16 },
  supportRow: { alignItems: 'flex-start', flexDirection: 'row', gap: 12 },
  supportCopy: { flex: 1 },
  supportTitle: { ...type.label, color: movePalette.ink },
  supportBody: { ...type.caption, color: '#6E6E73', marginTop: 3 },
  feelingPanel: { ...cardSurface, borderColor: movePalette.line, borderRadius: 16, borderWidth: hairlineWidth, padding: 16 },
  feelingTitle: { ...type.heading, color: movePalette.ink, fontSize: 18, lineHeight: 23 },
  feelingHint: { ...type.caption, color: '#6E6E73', marginTop: 4 },
  mixList: { gap: 14, marginTop: 16 },
  mixHeading: { alignItems: 'baseline', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  mixLabel: { ...type.label, color: movePalette.ink, fontSize: 12.5 },
  mixRail: { backgroundColor: 'rgba(0, 0, 0, 0.048)', borderRadius: 3, height: 6, overflow: 'hidden' },
  mixFill: { borderRadius: 3, height: 6 },
  mixInsight: { ...type.voice, color: '#424245', marginTop: 16 },
  weekRow: { flexDirection: 'row', marginTop: 16 },
  weekDay: { alignItems: 'center', flex: 1, gap: 9 },
  weekLabel: { ...type.caption, color: '#6E6E73', fontSize: 12 },
  weekLabelToday: { color: movePalette.green, fontFamily: type.label.fontFamily },
  weekDot: { borderColor: movePalette.lineStrong, borderRadius: 6, borderWidth: 1, height: 11, width: 11 },
  weekDotToday: { borderColor: movePalette.green, borderWidth: 2 },
  weekLegend: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 16 },
  panel: { ...cardSurface, borderColor: movePalette.line, borderRadius: 16, borderWidth: hairlineWidth, padding: 18 },
  ledgerHero: { ...cardSurface, borderColor: 'rgba(0, 113, 164, 0.12)', borderRadius: 16, borderWidth: hairlineWidth, padding: 17 },
  ledgerTitleInput: { ...type.heading, borderBottomColor: movePalette.line, borderBottomWidth: hairlineWidth, color: movePalette.ink, fontSize: 22, lineHeight: 28, minHeight: 48, paddingBottom: 8, paddingTop: 2 },
  ledgerTimestampRow: { alignItems: 'center', flexDirection: 'row', gap: 7, marginTop: 12 },
  ledgerTimestamp: { ...type.caption, color: movePalette.greenMid, flex: 1, fontSize: 13, fontVariant: ['tabular-nums'] },
  ledgerHelp: { ...type.body, color: '#6E6E73', fontSize: 13.5, lineHeight: 20, marginTop: 12 },
  addMovementChip: { alignItems: 'center', borderColor: movePalette.green, borderRadius: 14, borderWidth: hairlineWidth, flexDirection: 'row', gap: 5, justifyContent: 'center', minHeight: 44, paddingHorizontal: 14 },
  addMovementChipText: { ...type.caption, color: movePalette.green, fontFamily: type.label.fontFamily },
  ledgerExerciseCard: { ...cardSurface, borderColor: movePalette.line, borderRadius: 16, borderWidth: hairlineWidth, overflow: 'hidden', paddingBottom: 14, paddingTop: 16 },
  ledgerExerciseHeading: { alignItems: 'flex-start', flexDirection: 'row', paddingHorizontal: 16 },
  ledgerExerciseTitleWrap: { flex: 1 },
  ledgerExerciseIndex: { ...type.eyebrow, color: movePalette.greenMid, fontSize: 12, letterSpacing: 0 },
  ledgerExerciseTitle: { ...type.heading, borderBottomColor: movePalette.line, borderBottomWidth: hairlineWidth, color: movePalette.ink, fontSize: 19, lineHeight: 24, marginRight: 10, marginTop: 3, minHeight: 48, paddingVertical: 8 },
  ledgerPreviousDate: { ...type.caption, color: '#6E6E73', fontSize: 13, marginTop: 6 },
  ledgerCategoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 16, paddingVertical: 13 },
  ledgerCategoryChip: { borderColor: movePalette.lineStrong, borderRadius: 14, borderWidth: hairlineWidth, justifyContent: 'center', minHeight: 44, paddingHorizontal: 12, paddingVertical: 8 },
  ledgerCategoryChipActive: { backgroundColor: movePalette.wash, borderColor: 'rgba(0, 113, 164, 0.224)' },
  ledgerCategoryText: { ...type.caption, color: '#6E6E73', fontSize: 12 },
  ledgerCategoryTextActive: { color: movePalette.green, fontFamily: type.label.fontFamily },
  ledgerSetCountRow: { alignItems: 'center', borderBottomColor: movePalette.line, borderBottomWidth: hairlineWidth, borderTopColor: movePalette.line, borderTopWidth: hairlineWidth, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  ledgerSetCountCopy: { flex: 1, paddingRight: 12 },
  ledgerSetCountTitle: { ...type.label, color: movePalette.ink, fontSize: 13 },
  ledgerSetCountHint: { ...type.caption, color: '#6E6E73', fontSize: 13, marginTop: 2 },
  ledgerSetStepper: { alignItems: 'center', borderColor: 'rgba(0, 113, 164, 0.16)', borderRadius: 14, borderWidth: hairlineWidth, flexDirection: 'row', overflow: 'hidden' },
  ledgerStepperButton: { alignItems: 'center', ...cardSurface, height: 44, justifyContent: 'center', width: 44 },
  ledgerSetCountValue: { ...type.label, borderLeftColor: movePalette.line, borderLeftWidth: hairlineWidth, borderRightColor: movePalette.line, borderRightWidth: hairlineWidth, color: movePalette.ink, fontSize: 14, textAlign: 'center', width: 34 },
  ledgerSheet: { borderBottomColor: movePalette.line, borderBottomWidth: hairlineWidth, borderTopColor: movePalette.line, borderTopWidth: hairlineWidth, minWidth: 662 },
  ledgerHeaderRow: { alignItems: 'center', backgroundColor: '#F5F5F7', flexDirection: 'row', minHeight: 34, paddingHorizontal: 10 },
  ledgerHeader: { ...type.eyebrow, color: '#6E6E73', fontSize: 13, letterSpacing: 0, textAlign: 'center' },
  ledgerSetRow: { alignItems: 'center', borderTopColor: movePalette.line, borderTopWidth: hairlineWidth, flexDirection: 'row', minHeight: 54, paddingHorizontal: 10 },
  ledgerSetRowComplete: { backgroundColor: 'rgba(0, 113, 164, 0.044)' },
  ledgerSetColumn: { width: 104 },
  ledgerPreviousColumn: { width: 126 },
  ledgerInputColumn: { width: 76 },
  ledgerRestColumn: { width: 76 },
  ledgerDoneColumn: { width: 54 },
  ledgerSetIdentity: { alignItems: 'center', flexDirection: 'row', justifyContent: 'center' },
  ledgerSetNumber: { ...type.label, color: movePalette.ink, fontSize: 12, textAlign: 'center', width: 22 },
  ledgerPreviousCell: { alignItems: 'center', flexDirection: 'row', gap: 5, justifyContent: 'center', minHeight: 48, paddingHorizontal: 4 },
  ledgerPreviousValue: { ...type.caption, color: '#6E6E73', fontSize: 13, fontVariant: ['tabular-nums'] },
  ledgerCellInput: { ...type.body, borderLeftColor: movePalette.line, borderLeftWidth: hairlineWidth, color: movePalette.ink, fontSize: 13, minHeight: 48, paddingHorizontal: 5, textAlign: 'center' },
  ledgerDoneButton: { alignItems: 'center', borderColor: movePalette.green, borderRadius: 10, borderWidth: hairlineWidth, height: 44, justifyContent: 'center', marginHorizontal: 6 },
  ledgerDoneButtonActive: { backgroundColor: movePalette.green },
  ledgerRemoveButton: { alignItems: 'center', flexDirection: 'row', gap: 2, height: 44, justifyContent: 'center', width: 70 },
  ledgerRemoveText: { ...type.caption, color: colors.danger, fontFamily: type.label.fontFamily, fontSize: 12 },
  ledgerAddSet: { alignItems: 'center', alignSelf: 'flex-start', flexDirection: 'row', gap: 4, minHeight: 44, paddingHorizontal: 16, paddingTop: 10 },
  ledgerAddSetText: { ...type.label, color: movePalette.green, fontSize: 12 },
  ledgerFinishBar: { alignItems: 'center', backgroundColor: '#F5F5F7', borderColor: movePalette.lineStrong, borderRadius: 16, borderWidth: hairlineWidth, flexDirection: 'row', gap: 12, padding: 15 },
  ledgerFinishCopy: { flex: 1 },
  ledgerFinishTitle: { ...type.label, color: movePalette.ink, fontSize: 14 },
  ledgerFinishHint: { ...type.caption, color: movePalette.slate, fontSize: 13, lineHeight: 18, marginTop: 3 },
  ledgerFinishButton: { alignItems: 'center', backgroundColor: movePalette.green, borderRadius: 14, flexDirection: 'row', gap: 6, justifyContent: 'center', minHeight: 48, minWidth: 104, paddingHorizontal: 14 },
  ledgerFinishButtonText: { ...type.label, color: '#FFFFFF' },
  ledgerStatus: { ...type.caption, color: '#6E6E73', fontSize: 13, textAlign: 'center' },
  field: { marginTop: 15 },
  fieldLabel: { ...type.label, color: '#6E6E73', marginTop: 12 },
  input: { ...type.body, backgroundColor: movePalette.background, borderColor: movePalette.lineStrong, borderRadius: 14, borderWidth: hairlineWidth, color: movePalette.ink, minHeight: 48, paddingHorizontal: 13, paddingVertical: 11 },
  textarea: { minHeight: 84, textAlignVertical: 'top' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 9 },
  chip: { alignItems: 'center', borderColor: movePalette.lineStrong, borderRadius: 14, borderWidth: hairlineWidth, justifyContent: 'center', minHeight: 44, paddingHorizontal: 14 },
  chipSelected: { backgroundColor: movePalette.green, borderColor: movePalette.green },
  chipText: { ...type.caption, color: 'rgba(0, 0, 0, 0.12)', fontFamily: type.label.fontFamily },
  chipTextSelected: { color: '#FFFFFF' },
  twoFields: { flexDirection: 'row', gap: 10 },
  threeFields: { flexDirection: 'row', gap: 8 },
  flexField: { flex: 1, minWidth: 0 },
  rowBetween: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  iconTextButton: { alignItems: 'center', flexDirection: 'row', gap: 4, minHeight: 44, paddingHorizontal: 6 },
  iconText: { ...type.label, color: movePalette.green },
  iconButton: { alignItems: 'center', justifyContent: 'center', minHeight: 44, minWidth: 44 },
  libraryScroller: { marginHorizontal: -4, marginTop: 10 },
  libraryRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 4 },
  emptyCopy: { ...type.caption, color: '#6E6E73', marginTop: 16 },
  exerciseCard: { borderTopColor: movePalette.line, borderTopWidth: hairlineWidth, marginTop: 20, paddingTop: 16 },
  exerciseIndex: { ...type.eyebrow, color: '#6E6E73' },
  textAction: { alignItems: 'center', justifyContent: 'center', minHeight: 44, paddingHorizontal: 6 },
  textActionLabel: { ...type.label, color: movePalette.green },
  sectionIntro: { ...type.body, color: '#6E6E73', marginTop: -10 },
  templateCard: { ...cardSurface, borderColor: movePalette.line, borderRadius: 16, borderWidth: hairlineWidth, padding: 16 },
  templateCopy: { flex: 1 },
  templateTitle: { ...type.heading, color: movePalette.ink, fontSize: 19, lineHeight: 25 },
  monoLine: { ...type.caption, color: '#6E6E73', fontVariant: ['tabular-nums'], marginTop: 7 },
  templateMeta: { ...type.caption, color: '#6E6E73', marginTop: 4 },
  fitTag: { ...type.eyebrow, color: movePalette.greenMid, fontSize: 12 },
  templateActions: { flexDirection: 'row', gap: 8, marginTop: 14 },
  templateStart: { alignItems: 'center', backgroundColor: movePalette.green, borderRadius: 14, flex: 1, justifyContent: 'center', minHeight: 48 },
  templateStartText: { ...type.label, color: '#FFFFFF' },
  templatePreview: { alignItems: 'center', borderColor: movePalette.lineStrong, borderRadius: 14, borderWidth: hairlineWidth, justifyContent: 'center', minHeight: 48, minWidth: 92 },
  templatePreviewText: { ...type.label, color: movePalette.ink },
  outlineAction: { alignItems: 'center', borderColor: movePalette.lineStrong, borderRadius: 15, borderWidth: hairlineWidth, flexDirection: 'row', justifyContent: 'space-between', minHeight: 64, padding: 16 },
  outlineActionCopyWrap: { flex: 1, paddingRight: spacing.md },
  outlineActionTitle: { ...type.label, color: movePalette.ink, fontSize: 14 },
  outlineActionCopy: { ...type.caption, color: '#6E6E73', marginTop: 3 },
  footnote: { ...type.caption, color: '#6E6E73' },
  searchBox: { alignItems: 'center', ...cardSurface, borderColor: movePalette.lineStrong, borderRadius: 14, borderWidth: hairlineWidth, flexDirection: 'row', gap: 10, paddingHorizontal: 14 },
  searchInput: { ...type.body, color: movePalette.ink, flex: 1, minHeight: 48, paddingVertical: 10 },
  libraryFilters: { gap: 8, paddingRight: 22 },
  libraryList: { gap: 24, marginTop: 2 },
  libraryGroup: { gap: 0 },
  libraryGroupTitle: { ...type.eyebrow, color: movePalette.greenMid, fontSize: 12, letterSpacing: 0, marginBottom: 8 },
  libraryItem: { alignItems: 'center', borderTopColor: movePalette.line, borderTopWidth: hairlineWidth, flexDirection: 'row', gap: 12, minHeight: 62, paddingHorizontal: 2, paddingVertical: 12 },
  libraryItemFirst: { borderTopWidth: 0 },
  libraryItemCopy: { flex: 1 },
  libraryItemTitle: { ...type.label, color: movePalette.ink, fontSize: 14 },
  libraryItemMeta: { ...type.caption, color: '#6E6E73', marginTop: 3 },
  libraryItemAside: { alignItems: 'flex-end', maxWidth: '42%' },
  libraryItemCategory: { ...type.caption, color: '#6E6E73', fontSize: 12 },
  emptyLibrary: { ...type.body, color: '#6E6E73', paddingVertical: 40, textAlign: 'center' },
  historyInsight: { ...type.voice, color: movePalette.ink, fontSize: 24, lineHeight: 31, marginTop: -6 },
  historyPlotCard: { ...cardSurface, borderColor: movePalette.line, borderRadius: 16, borderWidth: hairlineWidth, padding: 14 },
  plotArea: { height: 172, overflow: 'hidden', position: 'relative' },
  plotGridLine: { backgroundColor: 'rgba(0, 0, 0, 0.042)', height: hairlineWidth, left: 0, position: 'absolute', right: 0 },
  plotDot: { borderColor: movePalette.surface, borderRadius: 6, borderWidth: 1.5, height: 12, marginLeft: -6, marginTop: -6, position: 'absolute', width: 12 },
  plotAxisRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  plotAxisLabel: { ...type.caption, color: '#6E6E73', fontSize: 12 },
  plotAxisTitle: { ...type.caption, color: movePalette.greenMid, fontSize: 12 },
  plotLegend: { borderTopColor: movePalette.line, borderTopWidth: hairlineWidth, flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, paddingTop: 10 },
  plotLegendText: { ...type.caption, color: '#6E6E73', fontSize: 12 },
  loadRows: { gap: 12, marginTop: 16 },
  loadRow: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  loadLabel: { ...type.caption, color: '#6E6E73', fontSize: 12, width: 54 },
  loadRail: { backgroundColor: 'rgba(0, 0, 0, 0.04)', borderRadius: 5, flex: 1, height: 10, overflow: 'hidden' },
  loadFill: { backgroundColor: movePalette.green, borderRadius: 5, height: 10 },
  loadValue: { ...type.caption, color: '#6E6E73', fontSize: 12, textAlign: 'right', width: 34 },
  patternRows: { borderTopColor: movePalette.line, borderTopWidth: hairlineWidth, marginTop: 12 },
  patternRow: { alignItems: 'center', borderBottomColor: movePalette.line, borderBottomWidth: hairlineWidth, flexDirection: 'row', justifyContent: 'space-between', minHeight: 52 },
  patternLabel: { ...type.label, color: movePalette.ink },
  patternValue: { ...type.caption, color: '#6E6E73', fontVariant: ['tabular-nums'] },
  mirrorLine: { ...type.voice, color: movePalette.ink, fontSize: 22, lineHeight: 29, marginTop: 14 },
  mirrorTag: { alignSelf: 'flex-start', backgroundColor: movePalette.wash, borderColor: 'rgba(0, 113, 164, 0.136)', borderRadius: 14, borderWidth: hairlineWidth, marginTop: 14, paddingHorizontal: 12, paddingVertical: 8 },
  emptyHistory: { paddingVertical: 14 },
  sessionRow: { borderTopColor: movePalette.line, borderTopWidth: hairlineWidth, paddingVertical: 13 },
  sessionDate: { ...type.caption, color: '#6E6E73', fontSize: 12, marginBottom: 5 },
  historyTitleWrap: { flex: 1, paddingRight: 8 },
  sessionTitle: { ...type.label, color: movePalette.ink, fontSize: 13.5 },
  sessionMeta: { ...type.caption, color: '#6E6E73', fontSize: 13, marginTop: 2 },
  sessionAside: { alignItems: 'flex-end', marginRight: 2 },
  sessionMinutes: { ...type.caption, color: '#6E6E73', fontVariant: ['tabular-nums'] },
  sessionEffort: { ...type.caption, color: '#6E6E73', fontSize: 12, marginTop: 2 },
  meta: { ...type.caption, color: '#6E6E73' },
  disabled: { opacity: 0.38 },
  pressed: { opacity: 0.68 },
  loading: { alignItems: 'center', gap: 10, paddingVertical: 48 }
});
