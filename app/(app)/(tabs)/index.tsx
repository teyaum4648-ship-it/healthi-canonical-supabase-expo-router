import { Ionicons } from '@expo/vector-icons';
import { useLocalToday } from '../../../src/features/navigation/useLocalToday';
import { localDay, wallClockIso } from '../../../src/utils/localDay';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { generateCircadianBriefing, type SleepNeedEstimate, type SleepSession } from '../../../src/engines/circadian';
import { generateDayPlan } from '../../../src/engines/dayPlan';
import { calculateMovementSummary, generateMovementReadinessSignal } from '../../../src/engines/movement';
import type { MealLog, NutritionTargets } from '../../../src/engines/nutrition';
import { contributionLabel, readinessLedgerSummary } from '../../../src/engines/readiness';
import { useAuth } from '../../../src/features/auth/AuthProvider';
import { composeDashboardNutritionSummary } from '../../../src/features/dashboard/dashboardComposer';
import { recordFoundationScore } from '../../../src/features/foundations/recordFoundationScore';
import type { FoundationScoreClient } from '../../../src/features/foundations/foundationScorePersistence';
import { ReadinessNowCard } from '../../../src/features/dashboard/ReadinessNowCard';
import { readinessHeadline, readinessZone, sleepGlance } from '../../../src/features/dashboard/dashboardZones';
import { BiomarkerBreakdown } from '../../../src/features/dashboard/premium/BiomarkerBreakdown';
import { BiomarkerEntrySheet } from '../../../src/features/dashboard/premium/BiomarkerEntrySheet';
import { BiomarkerTimeline } from '../../../src/features/dashboard/premium/BiomarkerTimeline';
import { MetricGrid } from '../../../src/features/dashboard/premium/MetricGrid';
import { ReadinessHub } from '../../../src/features/dashboard/premium/ReadinessHub';
import { localBiomarkerStore, saveManualReading } from '../../../src/features/biomarkers/biomarkerStore';
import { BIOMARKER_KINDS, summarizeBiomarker, type BiomarkerKind, type BiomarkerReading } from '../../../src/engines/biomarkers';
import { summarizeLoad } from '../../../src/engines/load';
import { LoggingPrompts } from '../../../src/features/dashboard/LoggingPromptsPanel';
import { TodayDirectionCard } from '../../../src/features/dashboard/TodayDirectionCard';
import { DayThread } from '../../../src/features/dashboard/DayThread';
import type { DayThreadSources } from '../../../src/features/dashboard/dayThreadInput';
import { QuickLog, type QuickLogAction } from '../../../src/features/dashboard/QuickLog';
import { WeekFlipCard } from '../../../src/features/dashboard/WeekFlipCard';
import { dietWeekCard, isRecapDay, moodWeekCard, moveWeekCard, recapWeekKey, sleepWeekCard, weeklyRecap, type WeekCard } from '../../../src/features/dashboard/weekCards';
import { WeeklyRecapRow, WeeklyRecapSheet } from '../../../src/features/dashboard/WeeklyRecap';
import { localDaylightStore, type DaylightBout } from '../../../src/features/practice/daylightModel';
import type { PracticeSession } from '../../../src/features/practice/practiceModel';
import { localPracticeStore } from '../../../src/features/practice/practiceStore';
import { readGoalSetup } from '../../../src/features/nutrition/nutritionGoalStore';
import { addGlassOfWater, GLASS_ML, removeWater } from '../../../src/features/nutrition/quickWater';
import { createDemoWaterStore, readWater, waterForDay, type HydrationClient, type WaterEntry } from '../../../src/features/nutrition/hydrationStore';
import { waterPace } from '../../../src/features/nutrition/waterPace';
import { EMPTY_MIND_ENTRIES, loadMindEntries, mindReadinessSignals, type MindEntries } from '../../../src/features/practice/mindSignals';
import { latestLoadCheck, localLoadCheckStore, personalBaselineFrom, type LoadCheckRecord } from '../../../src/features/loadCheck/loadCheckStore';
import { recordReadiness } from '../../../src/features/trends/readinessHistoryStore';
import { targetRowToTarget as goalTargetsFromRow } from '../../../src/features/nutrition/nutritionTargetModel';
import { loggingPrompts, type LoggingPromptId } from '../../../src/features/dashboard/loggingPrompts';
/*
 * The greeting line ("Good morning, …") is not drawn in 1c. Its helpers stay in
 * src/features/dashboard/homeDashboardPresentation.ts (homeGreeting, greetingForHour,
 * greetingName) so it is easy to bring back.
 */
import { readOnboardingV2Setup } from '../../../src/features/onboarding/onboardingV2Model';
import type { OnboardingV2BaselineSetup } from '../../../src/features/onboarding/onboardingV2Types';
import { getDemoScheduleBlocksForDate } from '../../../src/features/dayPlan/localDemoScheduleStore';
import { buildDayPlanInput } from '../../../src/features/dayPlan/scheduleBlockForms';
import { briefingToDayPlanRhythm } from '../../../src/features/dayPlan/briefingRhythm';
import {
  getScheduleBlocksForDate,
  type DayScheduleBlockRow,
  type DayScheduleBlockSupabaseClient
} from '../../../src/features/dayPlan/scheduleBlockPersistence';
import { getLocalDemoMovementState } from '../../../src/features/movement/localDemoMovementStore';
import { composeDashboardMovementSummary } from '../../../src/features/movement/movementIntegration';
import { movementSignalToDayPlanInput } from '../../../src/features/movement/movementIntegration';
import {
  getWorkoutExerciseEntriesForSession,
  getWorkoutSessionsForRange,
  type MovementSupabaseClient,
  type WorkoutExerciseEntryRow,
  type WorkoutSessionRow,
  workoutExerciseEntryRowToEngineEntry,
  workoutSessionRowToEngineSession
} from '../../../src/features/movement/movementPersistence';
import { getLocalDemoNutritionState } from '../../../src/features/nutrition/localDemoNutritionStore';
import { loadSleepHistory } from '../../../src/features/sleepRhythm/sleepSessionSource';
import {
  getActiveNutritionTarget,
  getMealLogsForDate,
  getRecentMealLogs,
  type MealLogRow,
  type NutritionSupabaseClient,
  type NutritionTargetRow
} from '../../../src/features/nutrition/persistence';
import {
  composeMorningBriefing,
  morningBriefingToDashboardHero,
  readinessToDayPlanInput
} from '../../../src/features/morningBriefing';
import {
  composeDailyProtocol,
  dayModeLabel,
  focusLabel,
  persistReconciledProtocol,
  protocolScope,
  safetyStatusLabel,
  shouldSurfaceSafety
} from '../../../src/features/dailyProtocol';
import type { SleepRhythmSupabaseClient } from '../../../src/features/sleepRhythm/persistence';
import { createDefaultSleepNeedEstimate } from '../../../src/features/sleepRhythm/rhythmInputs';
import { supabase } from '../../../src/lib/supabase';
import { accent, bone, font, HIT, ink, radius, space, surface, type } from '../../../src/styles/daywoven1c';
import { ExploreButton, HairlineRow, SectionTitle, TextLink, ThreadBand, ThreadCard, ThreadHeader } from '../../../src/components/thread/ThreadParts';
import { quickEntryHref } from '../../../src/features/navigation/navigationModel';
import { useSideMenu } from '../../../src/features/navigation/SideMenu';
import { useTabBarSpace } from '../../../src/features/navigation/tabBarSpace';


const demoOnboardingResultKey = 'healthi:demo:onboardingResult';
const recapDismissedKey = 'healthi:recap:dismissed:v1';
const isUuid = (value: string | undefined): value is string =>
  Boolean(value?.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i));

function movementRangeStart(date: string): string {
  return new Date(new Date(`${date}T12:00:00.000Z`).getTime() - 6 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** "Mon 16 Nov" beside the wordmark; read aloud in full. */
function displayDate(value: string): string {
  return new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
    .format(new Date(`${value}T12:00:00`));
}

function spokenDate(value: string): string {
  return new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
    .format(new Date(`${value}T12:00:00`));
}

/** How last night is known, for the figure's tag: a health app measured it, or it was logged. */
function sleepSourceTag(source: SleepSession['source'] | undefined): 'measured' | 'logged' | null {
  if (!source || source === 'estimated') return null;
  return source === 'manual' || source === 'user_corrected' || source === 'demo' ? 'logged' : 'measured';
}

function formatClockTime(value: string | null | undefined): string {
  if (!value) return 'Open';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Open';
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(date);
}

function foundationRoute(domain: 'recovery_rhythm' | 'nourishment' | 'movement_capacity' | 'mind_life_load') {
  if (domain === 'recovery_rhythm') return '/rhythm' as const;
  if (domain === 'nourishment') return '/food' as const;
  if (domain === 'movement_capacity') return '/movement' as const;
  return '/plan' as const;
}

function mealRowToMealLog(row: MealLogRow): MealLog {
  return {
    id: row.id,
    user_id: row.user_id,
    logged_at: row.logged_at,
    meal_type: row.meal_type,
    name: row.name,
    source: row.source,
    source_confidence: row.source_confidence,
    calories: row.calories,
    protein_g: row.protein_g,
    carbs_g: row.carbs_g,
    fat_g: row.fat_g,
    fiber_g: row.fiber_g,
    sugar_g: row.sugar_g,
    sodium_mg: row.sodium_mg,
    micronutrients: row.micronutrients ?? null,
    ingredients: row.ingredients,
    quality_flags: row.quality_flags,
    user_response: row.user_response,
    corrected_by_user: row.corrected_by_user,
    confirmed_by_user: row.confirmed_by_user,
    reason_codes: row.reason_codes,
    created_at: row.created_at
  };
}

function targetRowToTarget(row: NutritionTargetRow | null): NutritionTargets | null {
  if (!row) return null;

  return {
    calories_target: row.calories_target,
    protein_g_target: row.protein_g_target,
    carbs_g_target: row.carbs_g_target,
    fat_g_target: row.fat_g_target,
    fiber_g_target: row.fiber_g_target,
    sodium_mg_limit: row.sodium_mg_limit,
    confidence: row.confidence,
    basis: row.basis
  };
}

type DashboardBaselineClient = {
  from(table: 'baseline_profiles'): {
    select(columns: 'initial_foundation_scores, hydration_target_ml'): {
      eq(column: 'user_id', value: string): {
        order(column: 'generated_at', options: { ascending: boolean }): {
          limit(count: number): Promise<{
            data: Array<{ initial_foundation_scores?: unknown; hydration_target_ml?: number | null }> | null;
            error: { message?: string } | null;
          }>;
        };
      };
    };
  };
};

export default function DashboardScreen() {
  const tabSpace = useTabBarSpace();
  const { user, mode } = useAuth();
  const sideMenu = useSideMenu();
  const isFocused = useIsFocused();
  const today = useLocalToday();
  const [readinessCheckinRequest, setReadinessCheckinRequest] = useState(0);
  const [showExtendedHome, setShowExtendedHome] = useState(false);
  const [recapOpen, setRecapOpen] = useState(false);
  const [waterNotice, setWaterNotice] = useState<{ id: string | null; text: string } | null>(null);
  const [waterVersion, setWaterVersion] = useState(0);
  const [waterToday, setWaterToday] = useState<WaterEntry[]>([]);
  const [waterTargetMl, setWaterTargetMl] = useState<number | null>(null);
  const [mindEntries, setMindEntries] = useState<MindEntries>(EMPTY_MIND_ENTRIES);
  const [mindVersion, setMindVersion] = useState(0);
  const [loadCheck, setLoadCheck] = useState<LoadCheckRecord | null>(null);
  const protocolScopeValue = useMemo(() => protocolScope(user?.id), [user?.id]);
  const waterBusy = useRef(false);
  const [recapDismissedWeek, setRecapDismissedWeek] = useState<string | null | undefined>(undefined);
  const [nutritionMeals, setNutritionMeals] = useState<MealLog[]>([]);
  const [nutritionTargets, setNutritionTargets] = useState<NutritionTargets | null>(null);
  /* The week's meals and the person's own goals, for the Diet card. The readiness inputs above stay today-only. */
  const [weekMeals, setWeekMeals] = useState<MealLog[]>([]);
  const [goalTargets, setGoalTargets] = useState<NutritionTargets | null>(null);
  const [practiceSessions, setPracticeSessions] = useState<PracticeSession[]>([]);
  const [daylightBouts, setDaylightBouts] = useState<DaylightBout[]>([]);
  const [nutritionSource, setNutritionSource] = useState<'remote' | 'demo' | 'calibrating'>('calibrating');
  const [movementSessions, setMovementSessions] = useState<WorkoutSessionRow[]>([]);
  const [movementEntries, setMovementEntries] = useState<WorkoutExerciseEntryRow[]>([]);
  const [movementSource, setMovementSource] = useState<'remote' | 'demo' | 'calibrating'>('calibrating');
  const [sleepSessions, setSleepSessions] = useState<SleepSession[]>([]);
  const [sleepNeed, setSleepNeed] = useState<SleepNeedEstimate>(() => createDefaultSleepNeedEstimate());
  const [rhythmSource, setRhythmSource] = useState<'remote' | 'demo' | 'calibrating'>('calibrating');
  const [scheduleBlocks, setScheduleBlocks] = useState<DayScheduleBlockRow[]>([]);
  const [scheduleSource, setScheduleSource] = useState<'remote' | 'demo' | 'calibrating'>('calibrating');
  const [baselineSetup, setBaselineSetup] = useState<OnboardingV2BaselineSetup | null>(null);
  const [biomarkerReadings, setBiomarkerReadings] = useState<BiomarkerReading[]>([]);
  const [biomarkerSheet, setBiomarkerSheet] = useState<{ kind: BiomarkerKind; date: string } | null>(null);

  useFocusEffect(
    useCallback(() => {
      const userId = user?.id;
      let isMounted = true;

      if (!isUuid(userId)) {
        AsyncStorage.getItem(demoOnboardingResultKey)
          .then((value) => {
            if (!isMounted) return;
            const parsed = value ? JSON.parse(value) as { baselineProfile?: { initial_foundation_scores?: unknown; hydration_target_ml?: number | null } } : null;
            setBaselineSetup(readOnboardingV2Setup(parsed?.baselineProfile?.initial_foundation_scores));
            setWaterTargetMl(parsed?.baselineProfile?.hydration_target_ml ?? null);
          })
          .catch(() => {
            if (isMounted) setBaselineSetup(null);
          });
        return () => {
          isMounted = false;
        };
      }

      (supabase as unknown as DashboardBaselineClient)
        .from('baseline_profiles')
        .select('initial_foundation_scores, hydration_target_ml')
        .eq('user_id', userId)
        .order('generated_at', { ascending: false })
        .limit(1)
        .then(({ data, error }) => {
          if (!isMounted) return;
          setBaselineSetup(error ? null : readOnboardingV2Setup(data?.[0]?.initial_foundation_scores));
          setWaterTargetMl(error ? null : data?.[0]?.hydration_target_ml ?? null);
        })
        .catch(() => {
          if (isMounted) setBaselineSetup(null);
        });

      return () => {
        isMounted = false;
      };
    }, [user?.id])
  );

  useFocusEffect(
    useCallback(() => {
    const userId = user?.id;
    let isMounted = true;

    if (!isUuid(userId)) {
      getLocalDemoNutritionState()
        .then((state) => {
          if (!isMounted) return;
          const todayMeals = state.mealLogs.filter((meal) => localDay(meal.logged_at) === today);
          setNutritionMeals(todayMeals);
          setWeekMeals(state.mealLogs);
          setNutritionTargets(null);
          setNutritionSource(todayMeals.length > 0 ? 'demo' : 'calibrating');
        })
        .catch(() => {
          if (!isMounted) return;
          setNutritionMeals([]);
          setWeekMeals([]);
          setNutritionTargets(null);
          setNutritionSource('calibrating');
        });
      readGoalSetup(null, true, null, AsyncStorage)
        .then((setup) => { if (isMounted) setGoalTargets(setup?.status === 'estimated' ? setup.targets : null); })
        .catch(() => { if (isMounted) setGoalTargets(null); });

      return () => {
        isMounted = false;
      };
    }

    const client = supabase as unknown as NutritionSupabaseClient;

    Promise.all([
      getMealLogsForDate(client, userId, today),
      getActiveNutritionTarget(client, userId)
    ])
      .then(([mealRows, targetRow]) => {
        if (!isMounted) return;
        setNutritionMeals(mealRows.map(mealRowToMealLog));
        setNutritionTargets(targetRowToTarget(targetRow));
        setGoalTargets(goalTargetsFromRow(targetRow));
        setNutritionSource('remote');
      })
      .catch(() => {
        if (!isMounted) return;
        setNutritionMeals([]);
        setNutritionTargets(null);
        setGoalTargets(null);
        setNutritionSource('calibrating');
      });
    /* A week of meals is a few dozen rows; 150 leaves room for a heavy logger. */
    getRecentMealLogs(client, userId, 150)
      .then((rows) => { if (isMounted) setWeekMeals(rows.map(mealRowToMealLog)); })
      .catch(() => { if (isMounted) setWeekMeals([]); });

    return () => {
      isMounted = false;
    };
    }, [today, user?.id])
  );

  useFocusEffect(
    useCallback(() => {
      const userId = user?.id;
      let isMounted = true;

      const client = supabase as unknown as SleepRhythmSupabaseClient;
      loadSleepHistory({ mode, userId, client })
        .then(({ sessions, sleepNeed: estimate }) => {
          if (!isMounted) return;
          setSleepSessions(sessions);
          setSleepNeed(
            estimate
              ? {
                  minutes: estimate.minutes,
                  confidence: estimate.confidence,
                  basis: [...estimate.basis],
                  updated_at: estimate.updated_at
                }
              : createDefaultSleepNeedEstimate()
          );
          setRhythmSource(sessions.length > 0 ? mode === 'account' ? 'remote' : 'demo' : 'calibrating');
        })
        .catch(() => {
          if (!isMounted) return;
          setSleepSessions([]);
          setSleepNeed(createDefaultSleepNeedEstimate());
          setRhythmSource('calibrating');
        });

      return () => {
        isMounted = false;
      };
    }, [mode, today, user?.id])
  );

  /* Today's water, so a glass logged here or in Diet counts toward readiness. */
  useFocusEffect(
    useCallback(() => {
      let active = true;
      const userId = user?.id;
      const load = mode === 'demo'
        ? createDemoWaterStore(AsyncStorage).read().then((rows) => waterForDay(rows, 'demo-user', today))
        : isUuid(userId)
          ? readWater(supabase as unknown as HydrationClient, userId, today)
          : Promise.resolve([]);
      load
        .then((rows) => { if (active) setWaterToday(rows); })
        .catch(() => { if (active) setWaterToday([]); });
      return () => { active = false; };
    }, [mode, today, user?.id, waterVersion])
  );
  const waterTodayMl = useMemo(() => waterToday.reduce((sum, row) => sum + row.amount_ml, 0), [waterToday]);

  /* The load check, which sets where readiness starts for this person. */
  useFocusEffect(
    useCallback(() => {
      let active = true;
      localLoadCheckStore.read(protocolScopeValue)
        .then((rows) => { if (active) setLoadCheck(latestLoadCheck(rows)); })
        .catch(() => { if (active) setLoadCheck(null); });
      return () => { active = false; };
    }, [protocolScopeValue])
  );

  /* Mood entries and check-ins, which bring Mind + Life Load into readiness. */
  useFocusEffect(
    useCallback(() => {
      let active = true;
      loadMindEntries(protocolScopeValue, AsyncStorage)
        .then((entries) => { if (active) setMindEntries(entries); })
        .catch(() => { if (active) setMindEntries(EMPTY_MIND_ENTRIES); });
      return () => { active = false; };
    }, [protocolScopeValue, mindVersion])
  );

  useFocusEffect(
    useCallback(() => {
      const userId = user?.id;
      let isMounted = true;

      const load = isUuid(userId)
        ? getScheduleBlocksForDate(
            supabase as unknown as DayScheduleBlockSupabaseClient,
            userId,
            today
          ).then((blocks) => ({ blocks, source: 'remote' as const }))
        : getDemoScheduleBlocksForDate(today).then((blocks) => ({ blocks, source: 'demo' as const }));

      load
        .then(({ blocks, source }) => {
          if (!isMounted) return;
          setScheduleBlocks(blocks);
          setScheduleSource(blocks.length > 0 ? source : 'calibrating');
        })
        .catch(() => {
          if (!isMounted) return;
          setScheduleBlocks([]);
          setScheduleSource('calibrating');
        });

      return () => {
        isMounted = false;
      };
    }, [today, user?.id])
  );

  useFocusEffect(
    useCallback(() => {
      const userId = user?.id;
      let isMounted = true;

      if (!isUuid(userId)) {
        getLocalDemoMovementState()
          .then((state) => {
            if (!isMounted) return;
            setMovementSessions(state.workoutSessions);
            setMovementEntries(state.workoutExerciseEntries);
            setMovementSource(state.workoutSessions.length > 0 ? 'demo' : 'calibrating');
          })
          .catch(() => {
            if (!isMounted) return;
            setMovementSessions([]);
            setMovementEntries([]);
            setMovementSource('calibrating');
          });
        return () => {
          isMounted = false;
        };
      }

      const client = supabase as unknown as MovementSupabaseClient;
      getWorkoutSessionsForRange(client, userId, movementRangeStart(today), today)
        .then(async (sessions) => ({
          sessions,
          entries: (await Promise.all(
            sessions.map((session) => getWorkoutExerciseEntriesForSession(client, userId, session.id))
          )).flat()
        }))
        .then(({ sessions, entries }) => {
          if (!isMounted) return;
          setMovementSessions(sessions);
          setMovementEntries(entries);
          setMovementSource('remote');
        })
        .catch(() => {
          if (!isMounted) return;
          setMovementSessions([]);
          setMovementEntries([]);
          setMovementSource('calibrating');
        });

      return () => {
        isMounted = false;
      };
    }, [today, user?.id])
  );

  const nutritionSummary = composeDashboardNutritionSummary({
    date: today,
    meals: nutritionMeals,
    targets: nutritionTargets,
    demoMode: nutritionSource === 'demo'
  });
  /* Keep today's reading so the pillar has a past, not just a present. */
  const nourishmentPillar = nutritionSummary.nourishment_pillar;
  useEffect(() => {
    if (!nourishmentPillar) return;
    void recordFoundationScore({
      domain: 'nourishment',
      score: nourishmentPillar,
      userId: user?.id ?? null,
      demo: mode === 'demo',
      client: mode === 'demo' ? null : (supabase as unknown as FoundationScoreClient)
    });
  }, [mode, nourishmentPillar, user?.id]);

  const movementSummary = calculateMovementSummary({
    date: today,
    sessions: movementSessions.map(workoutSessionRowToEngineSession),
    exerciseEntries: movementEntries.map(workoutExerciseEntryRowToEngineEntry)
  });
  const movementSignal = generateMovementReadinessSignal({
    summary: movementSummary
  });
  const movementCard = composeDashboardMovementSummary({
    summary: movementSummary,
    signal: movementSignal,
    demoMode: movementSource === 'demo'
  });
  const latestSleepSession = sleepSessions[0] ?? null;
  const circadianBriefing = useMemo(
    () =>
      generateCircadianBriefing({
        date: today,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        recentSleepSessions: sleepSessions,
        sleepNeed,
        now: wallClockIso()
      }),
    [sleepNeed, sleepSessions, today]
  );
  const preliminaryDayPlan = useMemo(
    () =>
      generateDayPlan(
        buildDayPlanInput({
          date: today,
          scheduleBlocks,
          wake_time: circadianBriefing.wake_time ?? undefined,
          target_bedtime: circadianBriefing.target_bedtime ?? undefined,
          nutritionMealCount: nutritionSummary.meal_count,
          movement: movementSignalToDayPlanInput(movementSignal)
        })
      ),
    [circadianBriefing.target_bedtime, circadianBriefing.wake_time, movementSignal, nutritionSummary.meal_count, scheduleBlocks, today]
  );
  const mindSignals = useMemo(() => mindReadinessSignals(mindEntries, today), [mindEntries, today]);
  const hydrationToday = useMemo(() => {
    if (waterTodayMl <= 0) return null;
    const utcMinute = (iso: string | null | undefined) => {
      const date = iso ? new Date(iso) : null;
      return date && !Number.isNaN(date.getTime()) ? date.getUTCHours() * 60 + date.getUTCMinutes() : null;
    };
    const now = new Date();
    return {
      ml_today: waterTodayMl,
      pace: waterPace({
        mlToday: waterTodayMl,
        targetMl: waterTargetMl,
        wakeMinute: utcMinute(circadianBriefing.wake_time),
        bedMinute: utcMinute(circadianBriefing.target_bedtime),
        nowMinute: now.getHours() * 60 + now.getMinutes()
      })
    };
  }, [circadianBriefing.target_bedtime, circadianBriefing.wake_time, waterTargetMl, waterTodayMl]);
  const entrySource = mode === 'demo' ? 'demo' as const : 'logged' as const;
  const personalBaseline = useMemo(() => personalBaselineFrom(loadCheck), [loadCheck]);
  const morningBriefing = useMemo(
    () =>
      composeMorningBriefing({
        date: today,
        rhythm: {
          briefing: circadianBriefing,
          recent_sleep_session: latestSleepSession
        },
        nutrition: nutritionSummary,
        movement: {
          summary: movementSummary,
          signal: movementSignal
        },
        schedule: {
          block_count: scheduleBlocks.length,
          day_plan: preliminaryDayPlan
        },
        sources: {
          rhythm: rhythmSource === 'remote' ? 'logged' : rhythmSource,
          nutrition: nutritionSource === 'remote' ? 'logged' : nutritionSource,
          movement: movementSource === 'remote' ? 'logged' : movementSource,
          schedule: scheduleSource === 'remote' ? 'logged' : scheduleSource,
          hydration: hydrationToday ? entrySource : 'calibrating',
          mind: mindSignals ? entrySource : 'calibrating'
        },
        hydration: hydrationToday,
        mind: mindSignals,
        baseline_mode: baselineSetup?.baseline_mode,
        personal_baseline: personalBaseline
      }),
    [
      circadianBriefing,
      baselineSetup?.baseline_mode,
      entrySource,
      hydrationToday,
      latestSleepSession,
      mindSignals,
      personalBaseline,
      movementSignal,
      movementSource,
      movementSummary,
      nutritionSource,
      nutritionSummary,
      preliminaryDayPlan,
      rhythmSource,
      scheduleBlocks.length,
      scheduleSource,
      today
    ]
  );
  const dashboardHero = morningBriefingToDashboardHero(morningBriefing);
  const rhythmDriver = morningBriefing.driver_cards.find((driver) => driver.domain === 'recovery_rhythm');

  const protocolModel = useMemo(
    () =>
      composeDailyProtocol({
        date: today,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        readiness: morningBriefing.readiness,
        circadian: circadianBriefing,
        nutrition: nutritionSummary,
        movement: { signal: movementSignal },
        dayPlan: preliminaryDayPlan,
        baseline: baselineSetup
          ? {
              baseline_mode: baselineSetup.baseline_mode,
              primary_focus: baselineSetup.primary_focus,
              confidence: baselineSetup.confidence
            }
          : null,
        source: morningBriefing.source_label
      }),
    [baselineSetup, circadianBriefing, morningBriefing, movementSignal, nutritionSummary, preliminaryDayPlan, today]
  );
  useFocusEffect(
    useCallback(() => {
      let active = true;
      localBiomarkerStore.read(protocolScopeValue)
        .then((rows) => { if (active) setBiomarkerReadings(rows); })
        .catch(() => { if (active) setBiomarkerReadings([]); });
      return () => { active = false; };
    }, [protocolScopeValue])
  );
  const biomarkerSummaries = useMemo(
    () => BIOMARKER_KINDS.map((kind) => summarizeBiomarker(biomarkerReadings, kind, today)),
    [biomarkerReadings, today]
  );
  const restingHeartRate = biomarkerSummaries.find((summary) => summary.kind === 'resting_heart_rate')!;
  const sleepAtGlance = useMemo(
    () => sleepGlance({ sessions: sleepSessions, today, needMinutes: sleepNeed.minutes }),
    [sleepNeed.minutes, sleepSessions, today]
  );
  const loadToday = useMemo(() => summarizeLoad(movementSessions, today), [movementSessions, today]);
  async function saveBiomarker(kind: BiomarkerKind, value: number, date: string) {
    setBiomarkerReadings(await saveManualReading(protocolScopeValue, { kind, value, date }));
  }
  /* Keep today's estimate so Trends can average it; a calibrating day is left out, not recorded as 70. */
  const readinessToday = morningBriefing.readiness;
  useEffect(() => {
    if (readinessToday.label === 'calibrating' || readinessToday.date.slice(0, 10) !== today) return;
    void recordReadiness(protocolScopeValue, {
      date: today,
      score: readinessToday.score,
      label: readinessToday.label,
      confidence: readinessToday.confidence,
      recordedAt: new Date().toISOString()
    }).catch(() => undefined);
  }, [protocolScopeValue, readinessToday.confidence, readinessToday.date, readinessToday.label, readinessToday.score, today]);
  useFocusEffect(
    useCallback(() => {
      let isMounted = true;
      Promise.all([localPracticeStore.read(protocolScopeValue), localDaylightStore.read(protocolScopeValue)])
        .then(([practice, daylight]) => {
          if (!isMounted) return;
          setPracticeSessions(practice);
          setDaylightBouts(daylight);
        })
        .catch(() => {
          if (!isMounted) return;
          setPracticeSessions([]);
          setDaylightBouts([]);
        });
      return () => {
        isMounted = false;
      };
    }, [protocolScopeValue])
  );
  useEffect(() => {
    // Home is the generator/writer of the active daily protocol; reconcile keeps
    // any action states the user set (done/skipped/deferred) across regenerations.
    void persistReconciledProtocol(protocolScopeValue, protocolModel.protocol);
  }, [protocolModel, protocolScopeValue]);
  const protocol = protocolModel.protocol;
  const protocolActions = protocol.actions.slice(0, 3);
  const primaryAction = protocol.actions.find((action) => action.status === 'pending') ?? protocol.actions[0];
  const mealTimes = useMemo(() => nutritionMeals.map((meal) => meal.logged_at), [nutritionMeals]);
  const foundationSourceCount = [rhythmSource, nutritionSource, movementSource, scheduleSource]
    .filter((source) => source !== 'calibrating').length;
  const visibleReadinessScore = dashboardHero.source_label === 'calibrating' ? null : dashboardHero.score;
  const sourceLabel = dashboardHero.source_label === 'logged'
    ? 'Live signals'
    : dashboardHero.source_label === 'demo'
      ? 'Demo signals'
      : 'Signals calibrating';
  const openCheckin = () => {
    if (mode === 'demo') {
      // The readiness card is always mounted at the top of Home.
      setReadinessCheckinRequest(n => n + 1);
    } else {
      router.push('/closeout');
    }
  };
  const waterTarget = { demo: mode === 'demo', userId: user?.id ?? null, client: mode === 'demo' ? null : (supabase as unknown as HydrationClient), storage: AsyncStorage };
  useEffect(() => {
    if (!waterNotice) return;
    const timer = setTimeout(() => setWaterNotice(null), 6000);
    return () => clearTimeout(timer);
  }, [waterNotice]);
  async function logGlass() {
    if (waterBusy.current) return;
    waterBusy.current = true;
    try {
      const entry = await addGlassOfWater({ ...waterTarget, day: today });
      setWaterNotice({ id: entry.id, text: `Glass of water added · ${GLASS_ML} mL` });
      setWaterVersion((value) => value + 1);
    } catch {
      setWaterNotice({ id: null, text: 'Water wasn’t saved. Try again, or add it in Diet.' });
    } finally {
      waterBusy.current = false;
    }
  }
  async function undoGlass(id: string) {
    setWaterNotice(null);
    try {
      await removeWater(waterTarget, id);
      setWaterVersion((value) => value + 1);
    } catch {
      setWaterNotice({ id: null, text: 'Couldn’t remove it here. You can remove it in Diet.' });
    }
  }
  const quickLogActions: QuickLogAction[] = [
    { label: 'Food', detail: 'Search, scan, or build a meal', icon: 'restaurant-outline', onPress: () => router.navigate(quickEntryHref('food')) },
    { label: 'Water', detail: `Add a ${GLASS_ML} mL glass`, icon: 'water-outline', count: waterToday.length, onPress: () => void logGlass() },
    { label: 'Workout', detail: 'Open the fast workout logger', icon: 'barbell-outline', onPress: () => router.navigate(quickEntryHref('workout')) },
    { label: 'Sleep', detail: 'Add last night’s sleep', icon: 'moon-outline', onPress: () => router.navigate(quickEntryHref('sleep')) },
    { label: 'Check-in', detail: mode === 'demo' ? 'Update how you feel right now' : 'Record how today felt', icon: 'pulse-outline', onPress: openCheckin }
  ];
  /* A night is dated by the morning it ends on, so last night is the session dated today. */
  const sleepMissing = !sleepSessions.some((session) => session.date.slice(0, 10) === today);
  const sessionsThisWeek = movementCard.workout_count;
  const mealsToday = nutritionSummary.meal_count;
  const promptRows = useMemo(() => loggingPrompts({
    sleepMissing,
    checkin: undefined,
    mealsToday,
    waterToday: null,
    sessionsThisWeek,
    clock: formatClockTime
  }), [mealsToday, sessionsThisWeek, sleepMissing]);
  const weekCards = useMemo(() => [
    sleepWeekCard({
      today,
      sessions: sleepSessions,
      needMinutes: sleepNeed.minutes,
      debtMinutes: circadianBriefing.sleep_debt_7_day.total_sleep_debt_minutes,
      targetBedtime: circadianBriefing.target_bedtime
    }),
    dietWeekCard({ today, meals: weekMeals, targets: goalTargets }),
    moveWeekCard({ today, sessions: movementSessions }),
    moodWeekCard({ today, practice: practiceSessions, daylight: daylightBouts })
  ], [circadianBriefing, daylightBouts, goalTargets, movementSessions, practiceSessions, sleepNeed.minutes, sleepSessions, today, weekMeals]);
  const recapKey = recapWeekKey(today);
  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(recapDismissedKey).then((value) => { if (active) setRecapDismissedWeek(value); }).catch(() => { if (active) setRecapDismissedWeek(null); });
    return () => { active = false; };
  }, []);
  /* Only on Sunday and Monday, and only until put away for the week; undefined means still reading. */
  const showRecap = isRecapDay(new Date(`${today}T12:00:00`)) && recapDismissedWeek !== undefined && recapDismissedWeek !== recapKey;
  function dismissRecap() {
    setRecapDismissedWeek(recapKey);
    void AsyncStorage.setItem(recapDismissedKey, recapKey).catch(() => undefined);
  }
  const accountZone = readinessZone(visibleReadinessScore, shouldSurfaceSafety(protocol.safety.status));
  const accountHeadline = readinessHeadline(accountZone, dashboardHero.summary);
  /* With nothing logged there is no number to check in against, so the button asks for an entry. */
  const needsEntry = morningBriefing.readiness.reason_codes.includes('readiness_needs_entry');
  const biomarkerBreakdown = <BiomarkerBreakdown summaries={biomarkerSummaries} onEdit={(kind) => setBiomarkerSheet({ kind, date: today })} />;
  /*
   * "Your day" places the plan the way /plan does: the same rhythm windows from the
   * briefing, with today's readiness. Display only; the briefing and protocol above keep
   * using preliminaryDayPlan, unchanged.
   */
  const threadReadiness = useMemo(() => readinessToDayPlanInput(morningBriefing.readiness), [morningBriefing.readiness]);
  const threadDayPlan = useMemo(
    () =>
      generateDayPlan(
        buildDayPlanInput({
          date: today,
          scheduleBlocks,
          wake_time: circadianBriefing.wake_time ?? undefined,
          target_bedtime: circadianBriefing.target_bedtime ?? undefined,
          nutritionMealCount: nutritionSummary.meal_count,
          movement: movementSignalToDayPlanInput(movementSignal),
          rhythm: briefingToDayPlanRhythm(circadianBriefing),
          readinessScore: threadReadiness.score ?? undefined,
          readinessMode: threadReadiness.mode,
          readinessConfidence: threadReadiness.confidence,
          readinessReasonCodes: threadReadiness.reason_codes
        })
      ),
    [circadianBriefing, movementSignal, nutritionSummary.meal_count, scheduleBlocks, threadReadiness, today]
  );
  const todaySleep = sleepSessions.find((session) => session.date.slice(0, 10) === today);
  const threadSources = useMemo<Omit<DayThreadSources, 'nowMinute'>>(() => ({
    today,
    briefing: circadianBriefing,
    lastNight: sleepAtGlance.lastNight ? { minutes: sleepAtGlance.lastNight.minutes } : null,
    meals: nutritionMeals,
    water: waterToday,
    workouts: movementSessions,
    plan: threadDayPlan,
    glassMl: GLASS_ML
  }), [circadianBriefing, movementSessions, nutritionMeals, sleepAtGlance.lastNight, threadDayPlan, today, waterToday]);
  const safetyActive = shouldSurfaceSafety(protocol.safety.status);
  const accountWhy = (
    <View>
      <HairlineRow tone="band" title="Your starting point" detail={readinessLedgerSummary(morningBriefing.readiness.baseline_score, morningBriefing.readiness.score, morningBriefing.readiness.raw_score)} value={String(morningBriefing.readiness.baseline_score)} />
      {morningBriefing.driver_cards.map((driver, index) => (
        <HairlineRow
          key={driver.domain}
          tone="band"
          title={driver.label}
          detail={driver.detail}
          value={contributionLabel(driver)}
          accessibilityHint="Opens where this signal comes from"
          onPress={() => router.navigate(foundationRoute(driver.domain))}
          last={index === morningBriefing.driver_cards.length - 1}
        />
      ))}
      <Text style={styles.whyNote}>{foundationSourceCount} of 4 foundations have signals today. Missing information lowers confidence, not your score.</Text>
      <TextLink tone="band" label="See the full daily protocol" onPress={() => router.navigate('/protocol')} />
    </View>
  );
  function weekCardAction(card: WeekCard) {
    if (card.back.quickEntry) router.navigate(quickEntryHref(card.back.quickEntry));
    else router.navigate(card.back.route);
  }
  function promptAction(id: LoggingPromptId) {
    if (id === 'checkin') openCheckin();
    else router.navigate(quickEntryHref(id === 'movement' ? 'workout' : id));
  }

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: tabSpace }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <ThreadBand>
          <ThreadHeader
            date={displayDate(today)}
            dateAccessibilityLabel={spokenDate(today)}
            right={
              <>
                <Pressable accessibilityRole="button" accessibilityLabel="Open your plan and calendar" onPress={() => router.navigate('/plan')} style={({ pressed }) => [styles.planButton, pressed && styles.pressed]}>
                  <Ionicons accessible={false} name="calendar-outline" color={bone.text} size={19} />
                  <Text style={styles.planLabel}>Plan</Text>
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel="You · profile and settings" onPress={sideMenu.open} style={({ pressed }) => [styles.youButton, pressed && styles.pressed]}>
                  <View style={styles.avatar}>
                    <Ionicons accessible={false} name="person-outline" color={ink.text} size={17} />
                  </View>
                </Pressable>
              </>
            }
          />

          {/*
            Readiness is the first thing on Today, in the band. The demo's card owns its
            check-in and "Why this estimate?" sheets; an account reads the morning briefing,
            checks in through the evening close-out, and opens "Why" inline.
          */}
          {mode === 'demo' ? (
            <ReadinessNowCard base={morningBriefing.readiness} mealTimes={mealTimes} safetyActive={safetyActive} checkinRequest={readinessCheckinRequest} refreshKey={waterVersion} onCheckinSaved={() => setMindVersion((value) => value + 1)} sleepMissing={sleepMissing} sessionsThisWeek={sessionsThisWeek} />
          ) : (
            <ReadinessHub
              score={visibleReadinessScore}
              zone={accountZone}
              word={accountHeadline.word}
              insight={accountHeadline.insight}
              meta={`${dayModeLabel(protocol.day_mode)} · ${sourceLabel} · ${dashboardHero.confidence} confidence`}
              primaryLabel={needsEntry ? 'Log last night’s sleep' : 'Check in'}
              onPrimary={needsEntry ? () => router.navigate(quickEntryHref('sleep')) : openCheckin}
              whyPanel={accountWhy}
              pillars={morningBriefing.driver_cards}
            />
          )}
        </ThreadBand>

        <View style={styles.canvas}>
          <TodayDirectionCard
            headline={needsEntry ? 'Start with last night’s sleep' : primaryAction?.title ?? dashboardHero.top_action}
            explanation={needsEntry ? 'Your sleep entry helps Daywoven build a more useful picture of today. Add it to get started.' : primaryAction?.detail ?? protocol.summary}
            source={sourceLabel}
            confidence={dashboardHero.confidence}
            availableFoundationCount={foundationSourceCount}
            drivers={morningBriefing.driver_cards}
            primaryLabel={needsEntry ? 'Log last night’s sleep' : 'Open today’s plan'}
            onPrimary={needsEntry ? () => router.navigate(quickEntryHref('sleep')) : () => router.navigate('/protocol')}
            onFullPlan={() => router.navigate('/protocol')}
          />
          {/* Safety guidance is always visible here, above Quick log, and never inside a disclosure. */}
          {shouldSurfaceSafety(protocol.safety.status) ? (
            <View accessible accessibilityRole="alert" style={styles.safetyRow}>
              <Ionicons accessible={false} color={accent.amberDeep} name="shield-checkmark-outline" size={19} />
              <Text style={styles.safetyText}>{safetyStatusLabel(protocol.safety.status)} · easier guidance today</Text>
            </View>
          ) : null}

          <QuickLog actions={quickLogActions} notice={waterNotice ? { text: waterNotice.text, onUndo: waterNotice.id ? () => void undoGlass(waterNotice.id!) : undefined } : null} />

          <SectionTitle style={styles.dayTitle}>Your day</SectionTitle>
        </View>

        <DayThread sources={threadSources} onLogSleep={() => router.navigate(quickEntryHref('sleep'))} />

        <View style={styles.lower}>
          <ExploreButton
            title={showExtendedHome ? 'Hide the detailed picture' : 'Explore your analysis'}
            detail="Biomarker trends, your starting point and the reasons behind your plan"
            expanded={showExtendedHome}
            accessibilityLabel={showExtendedHome ? 'Hide detailed wellness analysis' : 'Explore your detailed wellness analysis'}
            onPress={() => setShowExtendedHome(value => !value)}
          />
          {showExtendedHome ? (
            <View style={styles.analysis}>
              <Pressable
                accessibilityHint="Opens the load check"
                accessibilityRole="button"
                onPress={() => router.navigate('/load-check')}
                style={({ pressed }) => [styles.startingPoint, pressed && styles.pressed]}
              >
                <Ionicons accessible={false} color={ink.text} name={personalBaseline ? 'flag-outline' : 'compass-outline'} size={19} />
                <View style={styles.startingCopy}>
                  <Text style={styles.startingTitle}>{personalBaseline ? `Your days start at ${personalBaseline.score}` : 'Set your starting point'}</Text>
                  <Text style={styles.startingDetail}>{personalBaseline ? 'From your load check. Retake it any time.' : 'A short load check, so readiness starts from you instead of 70.'}</Text>
                </View>
                <Ionicons accessible={false} color={ink.muted} name="chevron-forward" size={16} />
              </Pressable>

              {/* Last night against need, and today's load, side by side. */}
              <MetricGrid sleep={sleepAtGlance} load={loadToday} sleepSource={sleepSourceTag(todaySleep?.source)} onOpenSleep={() => router.navigate('/rhythm')} onOpenLoad={() => router.navigate('/movement')} />

              {/* The week's resting heart rate, with any day's reading one tap away. */}
              <BiomarkerTimeline summary={restingHeartRate} today={today} onEditDay={(date) => setBiomarkerSheet({ kind: 'resting_heart_rate', date })} />

              {/* Moved here from the readiness ring in 1c. */}
              {biomarkerBreakdown}

              <Pressable accessibilityRole="button" onPress={() => router.navigate('/protocol')} style={({ pressed }) => [styles.nextAction, pressed && styles.pressed]}>
                <View style={styles.startingCopy}>
                  <Text style={styles.nextEyebrow}>{mode === 'demo' ? 'Daily plan · starting point' : 'Next best action'}</Text>
                  <Text style={styles.nextTitle}>{primaryAction?.title ?? dashboardHero.top_action}</Text>
                  <Text style={styles.nextDetail}>{primaryAction?.detail ?? protocol.summary}</Text>
                </View>
                <Ionicons accessible={false} color={bone.text} name="chevron-forward" size={18} />
              </Pressable>

              {/* An account's logging rows used to sit inside "Why this estimate?"; they stay reachable here. The demo keeps them in its own sheet. */}
              {mode !== 'demo' ? (
                <ThreadCard>
                  <LoggingPrompts tone="canvas" rows={promptRows} onAction={promptAction} />
                </ThreadCard>
              ) : null}
            </View>
          ) : null}

          {showRecap ? <WeeklyRecapRow onOpen={() => setRecapOpen(true)} onDismiss={dismissRecap} /> : null}
          {recapOpen ? <WeeklyRecapSheet recap={weeklyRecap(weekCards)} onClose={() => setRecapOpen(false)} onTrends={() => { setRecapOpen(false); router.navigate('/progress'); }} /> : null}

          <View style={styles.weekHeader}>
            <SectionTitle>This week</SectionTitle>
            <Pressable accessibilityRole="link" accessibilityLabel="Open Trends" onPress={() => router.navigate('/progress')} style={({ pressed }) => [styles.weekLink, pressed && styles.pressed]}>
              <Text style={styles.weekLinkText}>Trends</Text>
              <Ionicons accessible={false} color={ink.text} name="chevron-forward" size={15} />
            </Pressable>
          </View>
          <Text style={styles.weekHint}>Tap a card to see what to work on.</Text>
          <View style={styles.weekGrid}>
            {[weekCards.slice(0, 2), weekCards.slice(2, 4)].map((pair) => (
              <View key={pair[0]!.id} style={styles.weekRow}>
                {pair.map((card) => <WeekFlipCard key={card.id} card={card} onAction={weekCardAction} />)}
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
      {biomarkerSheet ? (
        <BiomarkerEntrySheet
          initialKind={biomarkerSheet.kind}
          date={biomarkerSheet.date}
          readings={biomarkerReadings}
          onSave={(kind, value) => saveBiomarker(kind, value, biomarkerSheet.date)}
          onClose={() => setBiomarkerSheet(null)}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  /* The top inset is the band's colour, so the status bar sits on charcoal (light content). */
  safe: { backgroundColor: surface.band, flex: 1 },
  scroll: { backgroundColor: surface.canvas, flex: 1 },
  pressed: { opacity: 0.72 },
  planButton: { alignItems: 'center', flexDirection: 'row', gap: 6, minHeight: HIT, paddingHorizontal: 10 },
  planLabel: { fontFamily: font.bodyMedium, fontSize: 13, color: bone.text },
  youButton: { alignItems: 'center', height: HIT, justifyContent: 'center', width: HIT },
  avatar: { alignItems: 'center', backgroundColor: bone.text, borderRadius: 16, height: 32, justifyContent: 'center', width: 32 },
  whyNote: { ...type.caption, color: bone.muted, marginTop: 10 },
  canvas: { paddingHorizontal: space.gutter },
  safetyRow: { alignItems: 'center', backgroundColor: surface.card, borderColor: ink.border, borderRadius: radius.tile, borderWidth: 1, flexDirection: 'row', gap: 10, marginTop: 14, paddingHorizontal: 14, paddingVertical: 12 },
  safetyText: { ...type.body, color: ink.text, flex: 1 },
  dayTitle: { marginTop: space.section },
  lower: { paddingBottom: 28, paddingHorizontal: space.gutter },
  analysis: { gap: 10, marginTop: 10 },
  startingPoint: { alignItems: 'center', backgroundColor: surface.card, borderColor: ink.border, borderRadius: radius.card, borderWidth: 1, flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  startingCopy: { flex: 1, gap: 2, minWidth: 0 },
  startingTitle: { fontFamily: font.bodySemibold, fontSize: 14, color: ink.text },
  startingDetail: { ...type.caption, color: ink.muted },
  nextAction: { alignItems: 'center', backgroundColor: surface.band, borderRadius: radius.card, flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  nextEyebrow: { fontFamily: font.bodySemibold, fontSize: 10.5, letterSpacing: 0.84, textTransform: 'uppercase', color: bone.muted },
  nextTitle: { fontFamily: font.bodyMedium, fontSize: 15, lineHeight: 20, color: bone.text, marginTop: 2 },
  nextDetail: { ...type.caption, color: bone.soft },
  weekHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginTop: space.xxl },
  weekLink: { alignItems: 'center', flexDirection: 'row', gap: 2, minHeight: HIT, paddingLeft: 12 },
  weekLinkText: { fontFamily: font.bodyMedium, fontSize: 14, color: ink.text },
  weekHint: { ...type.caption, fontSize: 12.5, color: ink.muted, marginTop: -4 },
  weekGrid: { gap: 10, marginTop: 12 },
  weekRow: { flexDirection: 'row', gap: 10 }
});
