import { Ionicons } from '@expo/vector-icons';
import { useLocalToday } from '../../../src/features/navigation/useLocalToday';
import { localDay } from '../../../src/utils/localDay';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useIsFocused } from '@react-navigation/native';
import { Animated, Easing, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, G, Line, Polyline } from 'react-native-svg';

import { generateCircadianBriefing, type SleepNeedEstimate, type SleepSession } from '../../../src/engines/circadian';
import { generateDayPlan } from '../../../src/engines/dayPlan';
import { calculateMovementSummary, generateMovementReadinessSignal } from '../../../src/engines/movement';
import type { MealLog, NutritionTargets } from '../../../src/engines/nutrition';
import { useAuth } from '../../../src/features/auth/AuthProvider';
import { composeDashboardNutritionSummary } from '../../../src/features/dashboard/dashboardComposer';
import { ReadinessNowCard } from '../../../src/features/dashboard/ReadinessNowCard';
import {
  aggregateDashboardMacros,
  boundedProgress,
  driverStatusProgress,
  greetingForHour,
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
import { fonts, type } from '../../../src/styles/theme';
import { ActionRow } from '../../../src/components/mobile/ActionRow';
import { Disclosure } from '../../../src/components/mobile/Disclosure';
import { useReducedMotion } from '../../../src/components/mobile/useReducedMotion';
import { quickEntryHref } from '../../../src/features/navigation/navigationModel';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const demoOnboardingResultKey = 'healthi:demo:onboardingResult';
const homePalette = {
  background: '#000000',
  surface: '#121214',
  surfaceRaised: '#1C1C1E',
  surfaceSoft: '#242426',
  border: 'rgba(255, 255, 255, 0.075)',
  borderStrong: 'rgba(255, 255, 255, 0.12)',
  blue: '#0A84FF',
  blueBright: '#64D2FF',
  blueSoft: '#5AC8FA',
  cyan: '#63E6CE',
  violet: '#BF8BFF',
  amber: '#FFD479',
  text: '#F5F5F7',
  textMuted: '#A1A1A6',
  textFaint: '#6E6E73',
  track: '#2C2C2E',
  white: '#FFFFFF'
} as const;

const homeFont = Platform.select({
  ios: 'System',
  android: 'sans-serif',
  web: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif'
}) ?? fonts.body;

const domainAccent = {
  recovery_rhythm: homePalette.violet,
  nourishment: homePalette.cyan,
  movement_capacity: homePalette.blueSoft,
  mind_life_load: homePalette.amber
} as const;

const isUuid = (value: string | undefined): value is string =>
  Boolean(value?.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i));

function movementRangeStart(date: string): string {
  return new Date(new Date(`${date}T12:00:00.000Z`).getTime() - 6 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function titleCase(value: string): string {
  return value.split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

function displayDate(value: string): string {
  return new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
    .format(new Date(`${value}T12:00:00`));
}

function sleepDurationLabel(session: SleepSession | null): string {
  if (typeof session?.duration_minutes !== 'number') return 'Calibrating';
  return `${Math.floor(session.duration_minutes / 60)}h ${session.duration_minutes % 60}m`;
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

function ReadinessRing({ score, emptyLabel = 'Calibrating' }: { score: number | null; emptyLabel?: string }) {
  const reducedMotion = useReducedMotion();
  const size = 128;
  const c = size / 2;
  const arcRadius = 48;
  const circumference = 2 * Math.PI * arcRadius;
  const tickCount = 48;
  const targetScore = score ?? 0;
  const litTicks = Math.round((targetScore / 100) * tickCount);

  const progress = useRef(new Animated.Value(0)).current;
  const [displayScore, setDisplayScore] = useState(0);

  useEffect(() => {
    const listener = progress.addListener(({ value }) => {
      setDisplayScore(Math.round(value));
    });
    Animated.timing(progress, {
      toValue: targetScore,
      duration: reducedMotion ? 0 : 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false
    }).start();
    return () => progress.removeListener(listener);
  }, [progress, targetScore, reducedMotion]);

  const dashOffset = progress.interpolate({
    inputRange: [0, 100],
    outputRange: [circumference, 0]
  });
  const headOpacity = progress.interpolate({
    inputRange: [0, Math.max(targetScore - 4, 1), Math.max(targetScore, 2)],
    outputRange: [0, 0, 1]
  });

  const headAngle = (targetScore / 100) * Math.PI * 2;
  const headX = c + arcRadius * Math.cos(headAngle);
  const headY = c + arcRadius * Math.sin(headAngle);

  return (
    <View accessible accessibilityRole="image" accessibilityLabel={score === null ? `Readiness: ${emptyLabel}` : `Estimated readiness: ${score} out of 100`} style={styles.ringShell}>
      <Svg height={size} viewBox={`0 0 ${size} ${size}`} width={size}>
        <G transform={`rotate(-90 ${c} ${c})`}>
          {Array.from({ length: tickCount }, (_, tick) => {
            const angle = (tick / tickCount) * Math.PI * 2;
            const isMajor = tick % 8 === 0;
            const inner = isMajor ? 55 : 57;
            const outer = 61;
            const lit = tick < litTicks;
            return (
              <Line
                key={tick}
                stroke={lit ? 'rgba(100, 210, 255, 0.45)' : homePalette.track}
                strokeLinecap="round"
                strokeWidth={1.1}
                x1={c + inner * Math.cos(angle)}
                x2={c + outer * Math.cos(angle)}
                y1={c + inner * Math.sin(angle)}
                y2={c + outer * Math.sin(angle)}
              />
            );
          })}
          <Circle cx={c} cy={c} fill="none" r={arcRadius} stroke={homePalette.track} strokeWidth={5} />
          <AnimatedCircle
            cx={c}
            cy={c}
            fill="none"
            r={arcRadius}
            stroke={homePalette.blue}
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            strokeWidth={5}
          />
          {score !== null ? (
            <>
              <AnimatedCircle cx={headX} cy={headY} fill={homePalette.blue} opacity={headOpacity} r={8} fillOpacity={0.18} />
              <AnimatedCircle cx={headX} cy={headY} fill={homePalette.blueBright} opacity={headOpacity} r={3.2} />
            </>
          ) : null}
        </G>
      </Svg>
      <View style={styles.ringCenter}>
        <Text style={[styles.score, score === null && styles.scoreCalibrating]}>{score === null ? '—' : displayScore}</Text>
        <Text style={styles.scoreLabel}>{score === null ? emptyLabel : '/ 100'}</Text>
      </View>
    </View>
  );
}

function Panel({ children, style }: { children: React.ReactNode; style?: object }) {
  return <View style={[styles.panel, style]}>{children}</View>;
}

function PanelHeader({ title, action }: { title: string; action?: string }) {
  return (
    <View style={styles.panelHeader}>
      <Text style={styles.panelTitle}>{title}</Text>
      {action ? <Text style={styles.panelAction}>{action}</Text> : null}
    </View>
  );
}

type QuickLogAction = {
  label: string;
  detail: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  onPress: () => void;
};

function QuickLog({ actions }: { actions: QuickLogAction[] }) {
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
  const { user, mode } = useAuth();
  const isFocused = useIsFocused();
  const today = useLocalToday();
  const [readinessCheckinRequest, setReadinessCheckinRequest] = useState(0);
  const [nutritionMeals, setNutritionMeals] = useState<MealLog[]>([]);
  const [nutritionTargets, setNutritionTargets] = useState<NutritionTargets | null>(null);
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
          setNutritionTargets(null);
          setNutritionSource(todayMeals.length > 0 ? 'demo' : 'calibrating');
        })
        .catch(() => {
          if (!isMounted) return;
          setNutritionMeals([]);
          setNutritionTargets(null);
          setNutritionSource('calibrating');
        });

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
        setNutritionSource('remote');
      })
      .catch(() => {
        if (!isMounted) return;
        setNutritionMeals([]);
        setNutritionTargets(null);
        setNutritionSource('calibrating');
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
        now: new Date().toISOString()
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
  const firstName = typeof user?.user_metadata?.first_name === 'string' ? user.user_metadata.first_name : 'there';

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
  useEffect(() => {
    // Home is the generator/writer of the active daily protocol; reconcile keeps
    // any action states the user set (done/skipped/deferred) across regenerations.
    void persistReconciledProtocol(protocolScopeValue, protocolModel.protocol);
  }, [protocolModel, protocolScopeValue]);
  const protocol = protocolModel.protocol;
  const protocolActions = protocol.actions.slice(0, 3);
  const primaryAction = protocol.actions.find((action) => action.status === 'pending') ?? protocol.actions[0];
  const macroTotals = aggregateDashboardMacros(nutritionMeals);
  const sleepTrend = recentSleepTrend(sleepSessions);
  const nextScheduleBlock = scheduleBlocks.find((block) => new Date(block.end_at).getTime() >= Date.now()) ?? null;
  const foundationSourceCount = [rhythmSource, nutritionSource, movementSource, scheduleSource]
    .filter((source) => source !== 'calibrating').length;
  const visibleReadinessScore = dashboardHero.source_label === 'calibrating' ? null : dashboardHero.score;
  const sourceLabel = dashboardHero.source_label === 'logged'
    ? 'Live signals'
    : dashboardHero.source_label === 'demo'
      ? 'Demo signals'
      : 'Signals calibrating';
  const greeting = greetingForHour(new Date().getHours());
  const quickLogActions: QuickLogAction[] = [
    { label: 'Food', detail: 'Search, scan, or build a meal', icon: 'nutrition-outline', color: homePalette.cyan, onPress: () => router.navigate(quickEntryHref('food')) },
    { label: 'Workout', detail: 'Open the fast workout logger', icon: 'barbell-outline', color: homePalette.blueSoft, onPress: () => router.navigate(quickEntryHref('workout')) },
    { label: 'Sleep', detail: 'Add last night’s sleep', icon: 'moon-outline', color: homePalette.violet, onPress: () => router.navigate(quickEntryHref('sleep')) },
    { label: 'Check-in', detail: mode === 'demo' ? 'Update how you feel right now' : 'Record how today felt', icon: 'pulse-outline', color: homePalette.amber, onPress: () => mode === 'demo' ? setReadinessCheckinRequest(n => n + 1) : router.push('/closeout') }
  ];

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      {isFocused ? <StatusBar style="light" /> : null}
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.date}>{displayDate(today)}</Text>
            <Text style={styles.greeting}>{greeting}, {firstName}</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Open your plan and calendar" onPress={() => router.navigate('/plan')} style={({ pressed }) => [styles.calendarButton, pressed && styles.pressed]}>
            <Ionicons name="calendar-outline" color={homePalette.blueSoft} size={22} />
            <Text style={styles.calendarLabel}>Plan</Text>
          </Pressable>
        </View>

        {mode === 'demo' ? <ReadinessNowCard base={morningBriefing.readiness} mealTimes={nutritionMeals.map(m => m.logged_at)} safetyActive={shouldSurfaceSafety(protocol.safety.status)} checkinRequest={readinessCheckinRequest} renderRing={score => <ReadinessRing score={score} emptyLabel="No estimate" />} /> : <View style={styles.heroCard}>
          <View style={styles.heroGlow}>
            <View style={styles.heroTopRow}>
              <View style={styles.heroCopy}>
                <Text style={styles.liveText}>Today's direction</Text>
                <Text style={styles.dayMode}>{dayModeLabel(protocol.day_mode)}</Text>
                <Text style={styles.heroLabel}>{dashboardHero.label}</Text>
              </View>
              <ReadinessRing score={visibleReadinessScore} />
            </View>
            <Text style={styles.homeSummary}>{dashboardHero.summary}</Text>
            <Text style={styles.homeMeta}>{sourceLabel} · {dashboardHero.confidence} confidence</Text>
          </View>
        </View>}

        <Pressable accessibilityRole="button" onPress={() => router.navigate('/protocol')} style={({ pressed }) => [styles.homeNextAction, pressed && styles.pressed]}>
          <View style={styles.primaryActionCopy}>
            <Text style={styles.homeEyebrow}>{mode === 'demo' ? 'Daily plan · starting point' : 'Next best action'}</Text>
            <Text style={styles.primaryActionTitle}>{primaryAction?.title ?? dashboardHero.top_action}</Text>
            <Text style={styles.homeDetail}>{primaryAction?.detail ?? protocol.summary}</Text>
          </View>
          <Ionicons accessible={false} color={homePalette.blueSoft} name="chevron-forward" size={20} />
        </Pressable>
        {shouldSurfaceSafety(protocol.safety.status) ? (
          <View style={styles.safetyRow}>
            <Ionicons color={homePalette.amber} name="shield-checkmark-outline" size={18} />
            <Text style={styles.safetyText}>{safetyStatusLabel(protocol.safety.status)} · easier guidance today</Text>
          </View>
        ) : null}

        <QuickLog actions={quickLogActions} />

        <Panel>
          <PanelHeader title="Your day" />
          <ActionRow
            title={nextScheduleBlock?.title ?? (nextScheduleBlock ? titleCase(nextScheduleBlock.block_type) : 'Your calendar is open')}
            detail={nextScheduleBlock ? `${formatClockTime(nextScheduleBlock.start_at)} – ${formatClockTime(nextScheduleBlock.end_at)} · View your plan` : 'Tap a time in your plan to add a block.'}
            icon="calendar-outline"
            onPress={() => router.navigate('/plan')}
            last
          />
        </Panel>

        <Disclosure title="What informed today?" detail={`${foundationSourceCount} of 4 foundations have available signals`}>
          <Text style={styles.homeDetail}>These are the inputs behind your daily guidance. Missing information lowers confidence, not your score.</Text>
          {morningBriefing.driver_cards.map((driver, index) => (
            <ActionRow key={driver.domain} title={driver.label} detail={driver.detail} value={titleCase(driver.status)} icon={readinessIcon(driver.domain)} onPress={() => router.navigate(foundationRoute(driver.domain))} last={index === morningBriefing.driver_cards.length - 1} />
          ))}
          <ActionRow title="See the full daily protocol" detail="Reasons, confidence and your next steps" icon="list-outline" onPress={() => router.navigate('/protocol')} last />
        </Disclosure>

        <Panel>
          <PanelHeader title="At a glance" />
          <ActionRow title="Food" detail={nutritionSummary.meal_count ? `${nutritionSummary.meal_count} meals logged${macroTotals.has_nutrition ? ` · ${macroTotals.calories} kcal reported` : ''}` : 'No meals logged today'} icon="nutrition-outline" onPress={() => router.navigate('/food')} />
          <ActionRow title="Movement" detail={`${movementCard.workout_count} sessions in the last 7 days`} icon="barbell-outline" onPress={() => router.navigate('/movement')} />
          <ActionRow title="Sleep" detail={latestSleepSession ? `${sleepDurationLabel(latestSleepSession)} · latest recorded night` : 'Add your first sleep window'} icon="moon-outline" onPress={() => router.navigate('/rhythm')} last />
        </Panel>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  calendarButton: { alignItems: 'center', flexDirection: 'row', gap: 7, minHeight: 44, paddingHorizontal: 12, borderRadius: 14, backgroundColor: homePalette.surfaceRaised },
  calendarLabel: { fontFamily: homeFont, fontSize: 14, fontWeight: '600', color: homePalette.blueSoft },
  homeSummary: { fontFamily: homeFont, fontSize: 16, lineHeight: 23, color: homePalette.textMuted, marginTop: 12 },
  homeMeta: { fontFamily: homeFont, fontSize: 13, lineHeight: 19, color: homePalette.textMuted, marginTop: 10 },
  homeNextAction: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 18, paddingHorizontal: 20, borderRadius: 20, backgroundColor: homePalette.surfaceRaised },
  homeEyebrow: { fontFamily: homeFont, fontSize: 14, fontWeight: '500', color: homePalette.blueSoft, marginBottom: 6 },
  homeDetail: { fontFamily: homeFont, fontSize: 16, lineHeight: 23, color: homePalette.textMuted, marginTop: 4 },
  safe: {
    backgroundColor: homePalette.background,
    flex: 1
  },
  scroll: {
    gap: 13,
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
    color: homePalette.text,
    fontFamily: homeFont,
    fontSize: 25,
    fontWeight: '600',
    letterSpacing: -0.55,
    lineHeight: 31,
    marginTop: 4
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
    color: homePalette.white,
    fontFamily: homeFont,
    fontSize: 14,
    fontWeight: '600'
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.992 }]
  },
  quickLogSection: {
    backgroundColor: homePalette.surface,
    borderColor: homePalette.border,
    borderRadius: 20,
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
    gap: 7,
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
    paddingHorizontal: 3,
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
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
    marginTop: 7
  },
  heroCard: {
    backgroundColor: homePalette.surface,
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
    backgroundColor: 'rgba(10, 132, 255, 0.12)',
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
    backgroundColor: homePalette.surface,
    borderColor: homePalette.border,
    borderRadius: 22,
    borderWidth: 1,
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
    backgroundColor: homePalette.surface,
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
    backgroundColor: 'rgba(10, 132, 255, 0.13)',
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
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
    marginTop: 4
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
    backgroundColor: homePalette.surface,
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
    backgroundColor: 'rgba(10, 132, 255, 0.13)',
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
