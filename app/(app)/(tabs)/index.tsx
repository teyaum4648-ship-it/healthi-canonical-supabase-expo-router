import { Ionicons } from '@expo/vector-icons';
import { useLocalToday } from '../../../src/features/navigation/useLocalToday';
import { localDay, wallClockIso } from '../../../src/utils/localDay';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Line, Polyline } from 'react-native-svg';

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
import { WeekFlipCard } from '../../../src/features/dashboard/WeekFlipCard';
import { dietWeekCard, isRecapDay, moodWeekCard, moveWeekCard, recapWeekKey, sleepWeekCard, weeklyRecap, type WeekCard } from '../../../src/features/dashboard/weekCards';
import { WeeklyRecapRow, WeeklyRecapSheet } from '../../../src/features/dashboard/WeeklyRecap';
import { localDaylightStore, type DaylightBout } from '../../../src/features/practice/daylightModel';
import type { PracticeSession } from '../../../src/features/practice/practiceModel';
import { localPracticeStore } from '../../../src/features/practice/practiceStore';
import { readGoalSetup } from '../../../src/features/nutrition/nutritionGoalStore';
import { addGlassOfWater, GLASS_ML, removeWater } from '../../../src/features/nutrition/quickWater';
import type { HydrationClient } from '../../../src/features/nutrition/hydrationStore';
import { dietAccents } from '../../../src/features/nutrition/DietDashboard';
import { recordReadiness } from '../../../src/features/trends/readinessHistoryStore';
import { targetRowToTarget as goalTargetsFromRow } from '../../../src/features/nutrition/nutritionTargetModel';
import { loggingPrompts, type LoggingPromptId } from '../../../src/features/dashboard/loggingPrompts';
import {
  boundedProgress,
  greetingForHour,
  greetingName,
  homeGreeting,
  recentSleepTrend
} from '../../../src/features/dashboard/homeDashboardPresentation';
import { readOnboardingV2Setup } from '../../../src/features/onboarding/onboardingV2Model';
import type { OnboardingV2BaselineSetup } from '../../../src/features/onboarding/onboardingV2Types';
import { getDemoScheduleBlocksForDate } from '../../../src/features/dayPlan/localDemoScheduleStore';
import { buildDayPlanInput } from '../../../src/features/dayPlan/scheduleBlockForms';
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
  morningBriefingToDashboardHero
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
import { fonts, glass, glassSurface, hues, tintedGlass, type } from '../../../src/styles/mobileTheme';
import { pillarColors } from '../../../src/styles/pillarColors';
import { ActionRow } from '../../../src/components/mobile/ActionRow';
import { Disclosure } from '../../../src/components/mobile/Disclosure';
import { quickEntryHref } from '../../../src/features/navigation/navigationModel';


const demoOnboardingResultKey = 'healthi:demo:onboardingResult';
const recapDismissedKey = 'healthi:recap:dismissed:v1';
const waterColor = dietAccents.water;
const homePalette = {
  background: '#08090C',
  surface: '#15171B',
  surfaceRaised: '#1E2126',
  surfaceSoft: '#272A30',
  border: 'rgba(255, 255, 255, 0.075)',
  borderStrong: 'rgba(255, 255, 255, 0.12)',
  blue: '#8FE3C4',
  blueBright: '#8FFFD6',
  blueSoft: '#A6EAD2',
  cyan: '#A6EAD2',
  violet: '#B4A6F6',
  amber: '#F2C87E',
  text: '#F5F7FA',
  textMuted: '#A9B0BA',
  textFaint: '#8C939D',
  track: '#2A2E35',
  white: '#F5F7FA',
  onAccent: '#0A0D13'
} as const;

const homeFont = Platform.select({
  ios: 'System',
  android: 'sans-serif',
  web: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif'
}) ?? fonts.body;

const isUuid = (value: string | undefined): value is string =>
  Boolean(value?.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i));

function movementRangeStart(date: string): string {
  return new Date(new Date(`${date}T12:00:00.000Z`).getTime() - 6 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function displayDate(value: string): string {
  return new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
    .format(new Date(`${value}T12:00:00`));
}

function readinessIcon(domain: string): keyof typeof Ionicons.glyphMap {
  if (domain === 'recovery_rhythm') return 'moon-outline';
  if (domain === 'nourishment') return 'nutrition-outline';
  if (domain === 'movement_capacity') return 'walk-outline';
  return 'sparkles-outline';
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
    select(columns: 'initial_foundation_scores'): {
      eq(column: 'user_id', value: string): {
        order(column: 'generated_at', options: { ascending: boolean }): {
          limit(count: number): Promise<{
            data: Array<{ initial_foundation_scores?: unknown }> | null;
            error: { message?: string } | null;
          }>;
        };
      };
    };
  };
};

type QuickLogAction = {
  label: string;
  detail: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  onPress: () => void;
};

function QuickLog({ actions, notice }: { actions: QuickLogAction[]; notice?: { text: string; onUndo?: () => void } | null }) {
  return (
    <View style={styles.quickLogSection}>
      <View style={styles.quickLogHeader}>
        <Text style={styles.quickLogTitle}>Quick log</Text>
      </View>
      <View style={styles.quickLogRow}>
        {actions.map((action) => (
          <Pressable
            accessibilityLabel={`${action.label}. ${action.detail}`}
            accessibilityRole="button"
            key={action.label}
            onPress={action.onPress}
            style={({ pressed }) => [styles.quickLogButton, pressed && styles.quickLogButtonPressed]}
          >
            <View style={[styles.quickLogIcon, { backgroundColor: `${action.color}1C` }]}>
              <Ionicons color={action.color} name={action.icon} size={20} />
            </View>
            <Text style={styles.quickLogLabel}>{action.label}</Text>
          </Pressable>
        ))}
      </View>
      {notice ? (
        <View accessibilityLiveRegion="polite" style={styles.quickNotice}>
          <Ionicons accessible={false} color={homePalette.textMuted} name="checkmark-circle" size={16} />
          <Text style={styles.quickNoticeText}>{notice.text}</Text>
          {notice.onUndo ? <Pressable accessibilityRole="button" hitSlop={8} onPress={notice.onUndo} style={styles.quickUndo}><Text style={styles.quickUndoText}>Undo</Text></Pressable> : null}
        </View>
      ) : null}
    </View>
  );
}

function ProgressRail({ progress, color }: { progress: number; color: string }) {
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { backgroundColor: color, width: `${Math.round(progress * 100)}%` }]} />
    </View>
  );
}

function SleepSparkline({ values }: { values: number[] }) {
  if (values.length < 2) {
    return (
      <View style={styles.emptyChart}>
        <Ionicons color={homePalette.textFaint} name="pulse-outline" size={22} />
        <Text style={styles.emptyChartText}>Two recorded nights will reveal your rhythm trend.</Text>
      </View>
    );
  }

  const width = 300;
  const height = 76;
  const padding = 6;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, 30);
  const points = values.map((value, index) => {
    const x = padding + (index / Math.max(values.length - 1, 1)) * (width - padding * 2);
    const y = height - padding - ((value - min) / range) * (height - padding * 2);
    return `${x},${y}`;
  }).join(' ');

  return (
    <View style={styles.chartShell}>
      <Svg height="76" preserveAspectRatio="none" viewBox={`0 0 ${width} ${height}`} width="100%">
        <Line stroke={homePalette.track} strokeWidth="1" x1="0" x2={width} y1="24" y2="24" />
        <Line stroke={homePalette.track} strokeWidth="1" x1="0" x2={width} y1="52" y2="52" />
        <Polyline
          fill="none"
          points={points}
          stroke={homePalette.blue}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="3"
        />
      </Svg>
    </View>
  );
}

export default function DashboardScreen() {
  const { user, mode, profile } = useAuth();
  const isFocused = useIsFocused();
  const today = useLocalToday();
  const [readinessCheckinRequest, setReadinessCheckinRequest] = useState(0);
  const [recapOpen, setRecapOpen] = useState(false);
  const [waterNotice, setWaterNotice] = useState<{ id: string | null; text: string } | null>(null);
  const [waterVersion, setWaterVersion] = useState(0);
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
            const parsed = value ? JSON.parse(value) as { baselineProfile?: { initial_foundation_scores?: unknown } } : null;
            setBaselineSetup(readOnboardingV2Setup(parsed?.baselineProfile?.initial_foundation_scores));
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
        .select('initial_foundation_scores')
        .eq('user_id', userId)
        .order('generated_at', { ascending: false })
        .limit(1)
        .then(({ data, error }) => {
          if (!isMounted) return;
          setBaselineSetup(error ? null : readOnboardingV2Setup(data?.[0]?.initial_foundation_scores));
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
          schedule: scheduleSource === 'remote' ? 'logged' : scheduleSource
        },
        baseline_mode: baselineSetup?.baseline_mode
      }),
    [
      circadianBriefing,
      baselineSetup?.baseline_mode,
      latestSleepSession,
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
  const firstName = greetingName(user?.user_metadata?.first_name, profile?.display_name, mode === 'demo');

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
  const protocolScopeValue = useMemo(() => protocolScope(user?.id), [user?.id]);
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
  const sleepTrend = recentSleepTrend(sleepSessions);
  const foundationSourceCount = [rhythmSource, nutritionSource, movementSource, scheduleSource]
    .filter((source) => source !== 'calibrating').length;
  const visibleReadinessScore = dashboardHero.source_label === 'calibrating' ? null : dashboardHero.score;
  const sourceLabel = dashboardHero.source_label === 'logged'
    ? 'Live signals'
    : dashboardHero.source_label === 'demo'
      ? 'Demo signals'
      : 'Signals calibrating';
  const greeting = greetingForHour(new Date().getHours());
  const openCheckin = () => mode === 'demo' ? setReadinessCheckinRequest(n => n + 1) : router.push('/closeout');
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
    { label: 'Food', detail: 'Search, scan, or build a meal', icon: 'nutrition-outline', color: pillarColors.nourishment, onPress: () => router.navigate(quickEntryHref('food')) },
    { label: 'Water', detail: `Add a ${GLASS_ML} mL glass`, icon: 'water-outline', color: waterColor, onPress: () => void logGlass() },
    { label: 'Workout', detail: 'Open the fast workout logger', icon: 'barbell-outline', color: pillarColors.movement_capacity, onPress: () => router.navigate(quickEntryHref('workout')) },
    { label: 'Sleep', detail: 'Add last night’s sleep', icon: 'moon-outline', color: pillarColors.recovery_rhythm, onPress: () => router.navigate(quickEntryHref('sleep')) },
    { label: 'Check-in', detail: mode === 'demo' ? 'Update how you feel right now' : 'Record how today felt', icon: 'pulse-outline', color: pillarColors.mind_life_load, onPress: openCheckin }
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
  const biomarkerBreakdown = <BiomarkerBreakdown summaries={biomarkerSummaries} onEdit={(kind) => setBiomarkerSheet({ kind, date: today })} />;
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
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* The date shares a line with the buttons so the greeting gets the full width, like a large title. */}
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.date}>{displayDate(today)}</Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable accessibilityRole="button" accessibilityLabel="Open your plan and calendar" onPress={() => router.navigate('/plan')} style={({ pressed }) => [styles.calendarButton, pressed && styles.pressed]}>
              <Ionicons name="calendar-outline" color={homePalette.blueSoft} size={22} />
              <Text style={styles.calendarLabel}>Plan</Text>
            </Pressable>
            {/*
              "You" used to hold a fifth of the tab bar. Mood needed that slot and is a
              pillar rather than a settings screen, so the profile lives here instead —
              the place every other app keeps it.
            */}
            <Pressable accessibilityRole="button" accessibilityLabel="Open your profile and settings" onPress={() => router.navigate('/settings')} style={({ pressed }) => [styles.profileButton, pressed && styles.pressed]}>
              <Ionicons name="person-outline" color={homePalette.blueSoft} size={21} />
            </Pressable>
          </View>
        </View>
        <Text accessibilityRole="header" style={styles.greeting}>{homeGreeting(greeting, firstName)}</Text>

        {/*
          Component A: one score, one sentence. The biomarkers wait behind a tap on the ring.
          The demo's card owns its check-in and "Why this estimate?" sheets; an account
          reads the morning briefing and checks in through the evening closeout.
        */}
        {mode === 'demo' ? (
          <ReadinessNowCard base={morningBriefing.readiness} mealTimes={mealTimes} safetyActive={shouldSurfaceSafety(protocol.safety.status)} checkinRequest={readinessCheckinRequest} refreshKey={waterVersion} sleepMissing={sleepMissing} sessionsThisWeek={sessionsThisWeek} details={biomarkerBreakdown} />
        ) : (
          <ReadinessHub
            score={visibleReadinessScore}
            zone={accountZone}
            word={accountHeadline.word}
            insight={accountHeadline.insight}
            meta={`${dayModeLabel(protocol.day_mode)} · ${sourceLabel} · ${dashboardHero.confidence} confidence`}
            primaryLabel="Check in"
            onPrimary={openCheckin}
            details={biomarkerBreakdown}
            pillars={morningBriefing.driver_cards}
          />
        )}
        {shouldSurfaceSafety(protocol.safety.status) ? (
          <View style={styles.safetyRow}>
            <Ionicons color={homePalette.amber} name="shield-checkmark-outline" size={18} />
            <Text style={styles.safetyText}>{safetyStatusLabel(protocol.safety.status)} · easier guidance today</Text>
          </View>
        ) : null}

        {/* Component B: last night and today's load, side by side. */}
        <MetricGrid sleep={sleepAtGlance} load={loadToday} onOpenSleep={() => router.navigate('/rhythm')} onOpenLoad={() => router.navigate('/movement')} />

        {/* Component C: the week's resting heart rate, a line and a day-by-day log. */}
        <BiomarkerTimeline summary={restingHeartRate} today={today} color={homePalette.blueBright} onEditDay={(date) => setBiomarkerSheet({ kind: 'resting_heart_rate', date })} />

        <QuickLog actions={quickLogActions} notice={waterNotice ? { text: waterNotice.text, onUndo: waterNotice.id ? () => void undoGlass(waterNotice.id!) : undefined } : null} />

        <Pressable accessibilityRole="button" onPress={() => router.navigate('/protocol')} style={({ pressed }) => [styles.homeNextAction, pressed && styles.pressed]}>
          <View style={styles.primaryActionCopy}>
            <Text style={styles.homeEyebrow}>{mode === 'demo' ? 'Daily plan · starting point' : 'Next best action'}</Text>
            <Text style={styles.primaryActionTitle}>{primaryAction?.title ?? dashboardHero.top_action}</Text>
            <Text style={styles.homeDetail}>{primaryAction?.detail ?? protocol.summary}</Text>
          </View>
          <Ionicons accessible={false} color={homePalette.blueSoft} name="chevron-forward" size={20} />
        </Pressable>

        {/* In the demo the readiness card has its own "Why this estimate?"; one is enough. */}
        {mode !== 'demo' ? (
        <Disclosure title="Why this estimate?" detail={readinessLedgerSummary(morningBriefing.readiness.baseline_score, morningBriefing.readiness.score, morningBriefing.readiness.raw_score)}>
          <LoggingPrompts rows={promptRows} onAction={promptAction} />
          <Text style={styles.homeDetail}>These are the inputs behind your daily guidance, and the points each one moved. Missing information lowers confidence, not your score — {foundationSourceCount} of 4 foundations have signals today.</Text>
          {morningBriefing.driver_cards.map((driver, index) => (
            <ActionRow key={driver.domain} title={driver.label} detail={driver.detail} value={contributionLabel(driver)} icon={readinessIcon(driver.domain)} onPress={() => router.navigate(foundationRoute(driver.domain))} last={index === morningBriefing.driver_cards.length - 1} />
          ))}
          <ActionRow title="See the full daily protocol" detail="Reasons, confidence and your next steps" icon="list-outline" onPress={() => router.navigate('/protocol')} last />
        </Disclosure>
        ) : null}

        {showRecap ? <WeeklyRecapRow onOpen={() => setRecapOpen(true)} onDismiss={dismissRecap} /> : null}
        {recapOpen ? <WeeklyRecapSheet recap={weeklyRecap(weekCards)} onClose={() => setRecapOpen(false)} onTrends={() => { setRecapOpen(false); router.navigate('/progress'); }} /> : null}

        <View style={styles.weekSection}>
          <View style={styles.weekHeader}>
            <Text accessibilityRole="header" style={styles.weekTitle}>This week</Text>
            <Pressable accessibilityRole="link" accessibilityLabel="Open Trends" hitSlop={8} onPress={() => router.navigate('/progress')} style={({ pressed }) => [styles.weekLink, pressed && styles.pressed]}>
              <Text style={styles.weekLinkText}>Trends</Text>
              <Ionicons accessible={false} color={homePalette.blueSoft} name="chevron-forward" size={15} />
            </Pressable>
          </View>
          <Text style={styles.weekHint}>Tap a card to see what to work on.</Text>
          {[weekCards.slice(0, 2), weekCards.slice(2, 4)].map((pair) => (
            <View key={pair[0]!.id} style={styles.weekRow}>
              {pair.map((card) => <WeekFlipCard key={card.id} card={card} onAction={weekCardAction} />)}
            </View>
          ))}
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
  weekSection: { gap: 10, marginTop: 4 },
  weekHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 },
  weekTitle: { fontFamily: homeFont, fontSize: 19, fontWeight: '600', letterSpacing: -0.3, color: homePalette.text },
  weekHint: { fontFamily: homeFont, fontSize: 13, lineHeight: 18, color: homePalette.textMuted, paddingHorizontal: 4, marginTop: -6 },
  weekLink: { flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 44, paddingLeft: 12 },
  weekLinkText: { fontFamily: homeFont, fontSize: 15, fontWeight: '500', color: homePalette.blueSoft },
  weekRow: { flexDirection: 'row', gap: 10 },
  headerActions: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  profileButton: {
    ...glassSurface,
    alignItems: 'center',
    borderColor: glass.edge,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    height: 44,
    justifyContent: 'center',
    width: 44
  },
  calendarButton: { ...glassSurface, alignItems: 'center', flexDirection: 'row', gap: 7, minHeight: 44, paddingLeft: 12, paddingRight: 14, borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, borderColor: glass.edge },
  calendarLabel: { fontFamily: homeFont, fontSize: 14, fontWeight: '600', color: homePalette.blueSoft },
  homeSummary: { fontFamily: homeFont, fontSize: 16, lineHeight: 23, color: homePalette.textMuted, marginTop: 12 },
  homeMeta: { fontFamily: homeFont, fontSize: 13, lineHeight: 19, color: homePalette.textMuted, marginTop: 10 },
  homeNextAction: { ...tintedGlass(hues.mint), flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 20, paddingHorizontal: 20, borderRadius: 24 },
  homeEyebrow: { fontFamily: homeFont, fontSize: 14, fontWeight: '500', color: homePalette.blueSoft, marginBottom: 6 },
  homeDetail: { fontFamily: homeFont, fontSize: 16, lineHeight: 23, color: homePalette.textMuted, marginTop: 4 },
  safe: {
    backgroundColor: 'transparent',
    flex: 1
  },
  scroll: {
    gap: 16,
    paddingBottom: 28,
    paddingHorizontal: 20
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingBottom: 3,
    paddingTop: 20
  },
  headerCopy: {
    flex: 1
  },
  date: {
    color: homePalette.textMuted,
    fontFamily: homeFont,
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: 0.25,
    lineHeight: 20
  },
  greeting: {
    ...type.largeTitle,
    color: homePalette.text,
    fontFamily: homeFont,
    marginTop: -8,
    paddingHorizontal: 4
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: homePalette.blue,
    borderColor: 'rgba(255,255,255,0.24)',
    borderRadius: 20,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    width: 40
  },
  avatarText: {
    color: homePalette.onAccent,
    fontFamily: homeFont,
    fontSize: 14,
    fontWeight: '600'
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.992 }]
  },
  quickNotice: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, paddingHorizontal: 4, minHeight: 32 },
  quickNoticeText: { flex: 1, fontFamily: homeFont, fontSize: 14, lineHeight: 19, color: homePalette.textMuted },
  quickUndo: { minHeight: 32, justifyContent: 'center', paddingHorizontal: 6 },
  quickUndoText: { fontFamily: homeFont, fontSize: 15, fontWeight: '600', color: homePalette.blueSoft },
  quickLogSection: {
    ...glassSurface,
    borderColor: glass.edge,
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 13,
    paddingBottom: 13,
    paddingTop: 12
  },
  quickLogHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 3
  },
  quickLogTitle: {
    color: homePalette.text,
    fontFamily: homeFont,
    fontSize: 14.5,
    fontWeight: '600',
    letterSpacing: -0.15,
    lineHeight: 20
  },
  quickLogHint: {
    color: homePalette.textMuted,
    fontFamily: homeFont,
    fontSize: 13,
    lineHeight: 19
  },
  quickLogRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 11
  },
  quickLogButton: {
    alignItems: 'center',
    borderColor: 'transparent',
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    minWidth: 56,
    minHeight: 78,
    paddingHorizontal: 1,
    paddingVertical: 9
  },
  quickLogButtonPressed: {
    backgroundColor: homePalette.surfaceRaised,
    borderColor: homePalette.border
  },
  quickLogIcon: {
    alignItems: 'center',
    borderRadius: 12,
    height: 38,
    justifyContent: 'center',
    width: 38
  },
  quickLogLabel: {
    color: homePalette.text,
    fontFamily: homeFont,
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 20,
    marginTop: 7
  },
  heroCard: {
    ...glassSurface,
    borderColor: homePalette.borderStrong,
    borderRadius: 26,
    borderWidth: 1,
    elevation: 2,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 18
  },
  heroGlow: {
    padding: 18
  },
  heroTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    minHeight: 128
  },
  heroCopy: {
    flex: 1,
    minWidth: 126,
    paddingLeft: 2,
    paddingRight: 4
  },
  livePill: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(143, 227, 196, 0.12)',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 7,
    paddingHorizontal: 9,
    paddingVertical: 6
  },
  liveDot: {
    backgroundColor: homePalette.blueSoft,
    borderRadius: 4,
    height: 7,
    width: 7
  },
  liveText: {
    ...type.eyebrow,
    color: homePalette.blueSoft,
    fontFamily: homeFont,
    fontWeight: '600',
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0
  },
  dayMode: {
    color: homePalette.text,
    fontFamily: homeFont,
    fontSize: 27,
    fontWeight: '600',
    letterSpacing: -0.7,
    lineHeight: 33,
    marginTop: 8
  },
  heroLabel: {
    ...type.caption,
    color: homePalette.textMuted,
    fontFamily: homeFont,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 7
  },
  ringShell: {
    alignItems: 'center',
    height: 128,
    justifyContent: 'center',
    width: 128
  },
  ringCenter: {
    alignItems: 'center',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0
  },
  score: {
    color: homePalette.text,
    fontFamily: homeFont,
    fontSize: 44,
    fontVariant: ['tabular-nums'],
    fontWeight: '600',
    lineHeight: 50
  },
  scoreCalibrating: {
    color: homePalette.textMuted
  },
  scoreHero: {
    fontWeight: '600',
    letterSpacing: -2
  },
  ringEyebrow: {
    color: homePalette.textFaint,
    fontFamily: homeFont,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2
  },
  scoreLabel: {
    ...type.eyebrow,
    color: homePalette.textMuted,
    fontFamily: homeFont,
    fontSize: 12,
    letterSpacing: 0,
    marginTop: 2
  },
  heroSummaryRow: {
    alignItems: 'center',
    borderTopColor: homePalette.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 12,
    paddingTop: 15
  },
  heroSummaryCopy: {
    flex: 1
  },
  heroSummary: {
    color: homePalette.textMuted,
    fontFamily: homeFont,
    fontSize: 13.5,
    lineHeight: 20
  },
  heroMeta: {
    ...type.caption,
    color: homePalette.textFaint,
    fontFamily: homeFont,
    marginTop: 7,
    textTransform: 'capitalize'
  },
  roundArrow: {
    alignItems: 'center',
    backgroundColor: homePalette.blue,
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36
  },
  panel: {
    ...glassSurface,
    borderColor: glass.edge,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    elevation: 1,
    padding: 17
  },
  panelHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  panelTitle: {
    color: homePalette.text,
    fontFamily: homeFont,
    fontSize: 15.5,
    fontWeight: '600',
    letterSpacing: -0.2,
    lineHeight: 21
  },
  panelAction: {
    ...type.caption,
    color: homePalette.blueSoft,
    fontFamily: homeFont,
    textTransform: 'capitalize'
  },
  foundationList: {
    gap: 15,
    marginTop: 17
  },
  foundationRow: {
    alignItems: 'center',
    borderRadius: 13,
    flexDirection: 'row',
    gap: 11,
    marginHorizontal: -5,
    minHeight: 46,
    paddingHorizontal: 5,
    paddingVertical: 4
  },
  foundationRowPressed: {
    backgroundColor: homePalette.surfaceRaised
  },
  foundationIcon: {
    alignItems: 'center',
    borderRadius: 13,
    height: 38,
    justifyContent: 'center',
    width: 38
  },
  foundationBody: {
    flex: 1,
    gap: 7
  },
  foundationLabelRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  foundationLabel: {
    ...type.label,
    color: homePalette.textMuted,
    fontFamily: homeFont
  },
  foundationStatus: {
    ...type.caption,
    fontFamily: homeFont,
    fontWeight: '600'
  },
  progressTrack: {
    backgroundColor: homePalette.track,
    borderRadius: 999,
    height: 5,
    overflow: 'hidden'
  },
  progressFill: {
    borderRadius: 999,
    height: '100%'
  },
  coverageRow: {
    alignItems: 'center',
    borderTopColor: homePalette.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 8,
    marginTop: 17,
    paddingTop: 13
  },
  coverageText: {
    ...type.caption,
    color: homePalette.textFaint,
    fontFamily: homeFont
  },
  primaryAction: {
    ...glassSurface,
    borderColor: homePalette.border,
    borderRadius: 20,
    borderWidth: 1,
    elevation: 1,
    overflow: 'hidden'
  },
  primaryActionGradient: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    padding: 16
  },
  primaryActionIcon: {
    alignItems: 'center',
    backgroundColor: 'rgba(143, 227, 196, 0.13)',
    borderRadius: 15,
    height: 42,
    justifyContent: 'center',
    width: 42
  },
  primaryActionCopy: {
    flex: 1
  },
  primaryActionEyebrow: {
    ...type.eyebrow,
    color: homePalette.textFaint,
    fontFamily: homeFont,
    fontSize: 10,
    letterSpacing: 0.25
  },
  primaryActionTitle: {
    color: homePalette.white,
    fontFamily: homeFont,
    fontSize: 20,
    fontWeight: '600',
    letterSpacing: -0.3,
    lineHeight: 25,
    marginTop: 2
  },
  primaryActionDetail: {
    ...type.caption,
    color: homePalette.textMuted,
    fontFamily: homeFont,
    marginTop: 3
  },
  safetyRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    marginTop: 9
  },
  safetyText: {
    ...type.caption,
    color: homePalette.amber,
    flex: 1,
    fontFamily: homeFont
  },
  calorieRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 11,
    marginTop: 18
  },
  metricEyebrow: {
    ...type.eyebrow,
    color: homePalette.textFaint,
    fontFamily: homeFont,
    fontSize: 10,
    letterSpacing: 0.2
  },
  calorieValue: {
    color: homePalette.text,
    fontFamily: homeFont,
    fontSize: 36,
    fontVariant: ['tabular-nums'],
    fontWeight: '600',
    lineHeight: 42,
    marginTop: 3
  },
  calorieTargetWrap: {
    alignItems: 'flex-end',
    paddingBottom: 5
  },
  calorieTarget: {
    ...type.number,
    color: homePalette.textMuted,
    fontFamily: homeFont,
    marginTop: 3
  },
  macroGrid: {
    flexDirection: 'row',
    gap: 9,
    marginTop: 16
  },
  macroCell: {
    backgroundColor: homePalette.surfaceRaised,
    borderRadius: 14,
    flex: 1,
    gap: 7,
    padding: 11
  },
  macroLabel: {
    ...type.caption,
    color: homePalette.textFaint,
    fontFamily: homeFont
  },
  macroValue: {
    ...type.number,
    color: homePalette.text,
    fontFamily: homeFont,
    fontWeight: '600'
  },
  inlineAction: {
    alignItems: 'center',
    borderTopColor: homePalette.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 7,
    justifyContent: 'flex-end',
    marginTop: 15,
    paddingTop: 13
  },
  inlineActionText: {
    ...type.label,
    color: homePalette.blue,
    fontFamily: homeFont,
    fontWeight: '600'
  },
  twoColumn: {
    flexDirection: 'row',
    gap: 12
  },
  miniCard: {
    ...glassSurface,
    borderColor: homePalette.border,
    borderRadius: 20,
    borderWidth: 1,
    flex: 1,
    minHeight: 170,
    padding: 15
  },
  miniIcon: {
    alignItems: 'center',
    borderRadius: 13,
    height: 38,
    justifyContent: 'center',
    marginBottom: 14,
    width: 38
  },
  miniEyebrow: {
    ...type.eyebrow,
    color: homePalette.textFaint,
    fontFamily: homeFont,
    fontSize: 10,
    letterSpacing: 0.2
  },
  miniValue: {
    color: homePalette.text,
    fontFamily: homeFont,
    fontSize: 32,
    fontVariant: ['tabular-nums'],
    fontWeight: '600',
    lineHeight: 37,
    marginTop: 5
  },
  miniValueSmall: {
    color: homePalette.text,
    fontFamily: homeFont,
    fontSize: 22,
    fontWeight: '600',
    lineHeight: 28,
    marginTop: 7
  },
  miniUnit: {
    ...type.caption,
    color: homePalette.textMuted,
    fontFamily: homeFont,
    marginTop: 1
  },
  miniDetail: {
    ...type.caption,
    color: homePalette.textFaint,
    fontFamily: homeFont,
    marginTop: 8
  },
  trendTopRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 18
  },
  trendValue: {
    color: homePalette.text,
    fontFamily: homeFont,
    fontSize: 28,
    fontVariant: ['tabular-nums'],
    fontWeight: '600',
    lineHeight: 34,
    marginTop: 4
  },
  confidencePill: {
    backgroundColor: homePalette.surfaceSoft,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  confidenceText: {
    ...type.caption,
    color: homePalette.textMuted,
    fontFamily: homeFont,
    textTransform: 'capitalize'
  },
  chartShell: {
    height: 76,
    marginTop: 14,
    width: '100%'
  },
  emptyChart: {
    alignItems: 'center',
    backgroundColor: homePalette.surfaceRaised,
    borderRadius: 14,
    flexDirection: 'row',
    gap: 9,
    marginTop: 14,
    minHeight: 76,
    paddingHorizontal: 13
  },
  emptyChartText: {
    ...type.caption,
    color: homePalette.textFaint,
    flex: 1,
    fontFamily: homeFont
  },
  trendCaption: {
    ...type.caption,
    color: homePalette.textMuted,
    fontFamily: homeFont,
    marginTop: 9
  },
  focusTitle: {
    color: homePalette.text,
    fontFamily: homeFont,
    fontSize: 19,
    fontWeight: '600',
    letterSpacing: -0.35,
    lineHeight: 25,
    marginTop: 15
  },
  actionPreviewList: {
    gap: 9,
    marginTop: 15
  },
  actionPreviewRow: {
    alignItems: 'center',
    backgroundColor: homePalette.surfaceRaised,
    borderRadius: 12,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 9
  },
  actionIndex: {
    alignItems: 'center',
    backgroundColor: 'rgba(143, 227, 196, 0.13)',
    borderRadius: 10,
    height: 24,
    justifyContent: 'center',
    width: 24
  },
  actionIndexText: {
    ...type.caption,
    color: homePalette.blueSoft,
    fontFamily: homeFont,
    fontWeight: '600'
  },
  actionPreviewText: {
    ...type.label,
    color: homePalette.textMuted,
    flex: 1,
    fontFamily: homeFont
  }
});
