import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Animated, Easing, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, G, Line } from 'react-native-svg';

import { generateCircadianBriefing, type SleepNeedEstimate, type SleepSession } from '../../../src/engines/circadian';
import { generateDayPlan } from '../../../src/engines/dayPlan';
import { calculateMovementSummary, generateMovementReadinessSignal } from '../../../src/engines/movement';
import type { MealLog, NutritionTargets } from '../../../src/engines/nutrition';
import { useAuth } from '../../../src/features/auth/AuthProvider';
import { composeDashboardNutritionSummary } from '../../../src/features/dashboard/dashboardComposer';
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
  getActiveSleepNeedEstimate,
  getRecentSleepSessions,
  type SleepRhythmSupabaseClient
} from '../../../src/features/sleepRhythm/persistence';
import {
  createDefaultSleepNeedEstimate,
  createDemoSleepSessions
} from '../../../src/features/sleepRhythm/rhythmInputs';
import { supabase } from '../../../src/lib/supabase';
import { colors, hairlineWidth, palette, type } from '../../../src/styles/theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const foodSegments = Array.from({ length: 10 }, (_, index) => index);
const demoOnboardingResultKey = 'healthi:demo:onboardingResult';

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
  return 'calendar-outline';
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

/**
 * Signature element: a 64-tick chronometer bezel. Ticks light in jade up to
 * the score; the arc sweeps in on mount with a luminous head. The dial IS
 * the brand — everything else on the screen stays quiet around it.
 */
function ReadinessRing({ score }: { score: number }) {
  const size = 208;
  const c = size / 2;
  const arcRadius = 82;
  const circumference = 2 * Math.PI * arcRadius;
  const tickCount = 64;
  const litTicks = Math.round((score / 100) * tickCount);

  const progress = useRef(new Animated.Value(0)).current;
  const [displayScore, setDisplayScore] = useState(0);

  useEffect(() => {
    const listener = progress.addListener(({ value }) => {
      setDisplayScore(Math.round(value));
    });
    Animated.timing(progress, {
      toValue: score,
      duration: 1200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false
    }).start();
    return () => progress.removeListener(listener);
  }, [progress, score]);

  const dashOffset = progress.interpolate({
    inputRange: [0, 100],
    outputRange: [circumference, 0]
  });
  const headOpacity = progress.interpolate({
    inputRange: [0, Math.max(score - 4, 1), score],
    outputRange: [0, 0, 1]
  });

  const headAngle = (score / 100) * Math.PI * 2;
  const headX = c + arcRadius * Math.cos(headAngle);
  const headY = c + arcRadius * Math.sin(headAngle);

  return (
    <View style={styles.ringShell}>
      <Svg height={size} viewBox={`0 0 ${size} ${size}`} width={size}>
        <G transform={`rotate(-90 ${c} ${c})`}>
          {Array.from({ length: tickCount }, (_, tick) => {
            const angle = (tick / tickCount) * Math.PI * 2;
            const isMajor = tick % 8 === 0;
            const inner = isMajor ? 92 : 95;
            const outer = 99;
            const lit = tick < litTicks;
            return (
              <Line
                key={tick}
                stroke={lit ? 'rgba(124, 217, 175, 0.38)' : palette.hairline}
                strokeLinecap="round"
                strokeWidth={1.1}
                x1={c + inner * Math.cos(angle)}
                x2={c + outer * Math.cos(angle)}
                y1={c + inner * Math.sin(angle)}
                y2={c + outer * Math.sin(angle)}
              />
            );
          })}
          <Circle cx={c} cy={c} fill="none" r={arcRadius} stroke={palette.hairlineSoft} strokeWidth={2} />
          <AnimatedCircle
            cx={c}
            cy={c}
            fill="none"
            r={arcRadius}
            stroke={palette.forest}
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            strokeWidth={2.5}
          />
          <AnimatedCircle cx={headX} cy={headY} fill={palette.forest} opacity={headOpacity} r={7.5} fillOpacity={0.16} />
          <AnimatedCircle cx={headX} cy={headY} fill={palette.forest} opacity={headOpacity} r={3.2} />
        </G>
      </Svg>
      <View style={styles.ringCenter}>
        <Text style={styles.score}>{displayScore}</Text>
        <Text style={styles.scoreLabel}>Readiness</Text>
      </View>
    </View>
  );
}

function Section({ children }: { children: React.ReactNode }) {
  return <View style={styles.section}>{children}</View>;
}

function SectionHeader({ title, value, unit }: { title: string; value?: string; unit?: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {value ? (
        <Text style={styles.sectionValue}>
          {value}
          {unit ? <Text style={styles.unit}> {unit}</Text> : null}
        </Text>
      ) : null}
    </View>
  );
}

export default function DashboardScreen() {
  const { user } = useAuth();
  const today = new Date().toISOString().slice(0, 10);
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
          const todayMeals = state.mealLogs.filter((meal) => meal.logged_at.slice(0, 10) === today);
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

      if (!isUuid(userId)) {
        const demoSessions = createDemoSleepSessions(today);
        setSleepSessions(demoSessions);
        setSleepNeed(createDefaultSleepNeedEstimate());
        setRhythmSource('demo');
        return () => {
          isMounted = false;
        };
      }

      const client = supabase as unknown as SleepRhythmSupabaseClient;
      Promise.all([
        getRecentSleepSessions(client, userId, 14),
        getActiveSleepNeedEstimate(client, userId)
      ])
        .then(([sessions, estimate]) => {
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
          setRhythmSource(sessions.length > 0 ? 'remote' : 'calibrating');
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
    }, [today, user?.id])
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
  const activeFoodSegments =
    nutritionSummary.meal_count === 0
      ? 0
      : nutritionSummary.food_quality_label === 'Supportive'
        ? 8
        : nutritionSummary.food_quality_label === 'Steady'
          ? 6
          : 4;
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

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.date}>{displayDate(today)}</Text>
          <Text style={styles.greeting}>Good morning, {firstName}</Text>
        </View>

        <ReadinessRing score={dashboardHero.score} />
        <Text style={styles.readinessNote}>
          {dashboardHero.label} · {dashboardHero.top_action}
        </Text>
        <Text style={styles.briefingMeta}>
          {dashboardHero.source_label === 'logged'
            ? 'Based on available data'
            : dashboardHero.source_label === 'demo'
              ? 'Demo signals'
              : 'Still calibrating'} · Confidence: {dashboardHero.confidence}
        </Text>

        <Section>
          <SectionHeader title="System drivers" value={titleCase(morningBriefing.readiness.mode)} />
          <View style={styles.driverGrid}>
            {morningBriefing.driver_cards.map((driver) => (
              <View key={driver.domain} style={styles.driverCell}>
                <View style={styles.driverHeader}>
                  <Ionicons color={colors.accent} name={readinessIcon(driver.domain)} size={16} />
                  <Text style={styles.driverLabel}>{driver.label}</Text>
                </View>
                <Text style={styles.driverStatus}>{driver.status}</Text>
                <Text style={styles.driverDetail}>{driver.detail}</Text>
              </View>
            ))}
          </View>
        </Section>

        <Section>
          <SectionHeader title="Sleep + rhythm" value={sleepDurationLabel(latestSleepSession)} />
          <Text style={styles.sectionCopy}>{rhythmDriver?.detail ?? 'Sleep timing is still calibrating.'}</Text>
          <Text style={styles.sourceCopy}>
            {circadianBriefing.current_phase === 'unknown'
              ? 'Rhythm phase calibrating'
              : `Current phase: ${titleCase(circadianBriefing.current_phase)}`} · {titleCase(rhythmSource)} · Confidence: {circadianBriefing.confidence}
          </Text>
        </Section>

        <Section>
          <SectionHeader title="Food response" value={nutritionSummary.food_quality_label} />
          <View style={styles.foodScoreBar}>
            {foodSegments.map((segment) => (
              <View
                key={segment}
                style={[
                  styles.foodScoreSegment,
                  {
                    backgroundColor:
                      segment < activeFoodSegments
                        ? palette.forest
                        : segment === activeFoodSegments && activeFoodSegments > 0
                          ? palette.forestPale
                          : palette.hairline
                  }
                ]}
              />
            ))}
          </View>
          <View style={styles.nutritionGrid}>
            <View style={styles.nutritionCell}>
              <Text style={styles.nutritionLabel}>Meals</Text>
              <Text style={styles.nutritionValue}>{nutritionSummary.meal_count}</Text>
            </View>
            <View style={styles.nutritionCell}>
              <Text style={styles.nutritionLabel}>Calories</Text>
              <Text style={styles.nutritionValue}>{nutritionSummary.calorie_label}</Text>
            </View>
            <View style={styles.nutritionCell}>
              <Text style={styles.nutritionLabel}>Protein</Text>
              <Text style={styles.nutritionValue}>{nutritionSummary.protein_label}</Text>
            </View>
            <View style={styles.nutritionCell}>
              <Text style={styles.nutritionLabel}>Response</Text>
              <Text style={styles.nutritionValue}>{nutritionSummary.food_response_label}</Text>
            </View>
          </View>
          <Text style={styles.sectionCopy}>
            {nutritionSummary.readiness_support_label}
          </Text>
          <Text style={styles.sourceCopy}>
            {nutritionSummary.source_label === 'logged' ? 'Based on logged meals.' : nutritionSummary.next_action} Confidence: {nutritionSummary.confidence}.
          </Text>
        </Section>

        <View style={styles.twoColumn}>
          <View style={styles.compactPanel}>
            <View style={styles.compactIcon}>
              <Ionicons color={colors.accent} name="walk-outline" size={17} />
            </View>
            <Text style={styles.compactLabel}>Movement</Text>
            <Text style={styles.compactValue}>{movementCard.label}</Text>
            <Text style={styles.compactCopy}>{movementCard.workout_count} workouts · {movementCard.total_minutes} min</Text>
            <Text style={styles.compactCopy}>{movementCard.suggested_next_action}</Text>
            <Text style={styles.compactSource}>Confidence: {movementCard.confidence} · {titleCase(movementCard.source_label)}</Text>
          </View>
          <View style={styles.compactPanel}>
            <View style={styles.compactIcon}>
              <Ionicons color={colors.accent} name="calendar-outline" size={17} />
            </View>
            <Text style={styles.compactLabel}>Schedule</Text>
            <Text style={styles.compactValue}>{scheduleBlocks.length} blocks</Text>
            <Text style={styles.compactCopy}>{preliminaryDayPlan.open_windows.length} open windows found</Text>
            <Text style={styles.compactSource}>Confidence: {preliminaryDayPlan.confidence} · {titleCase(scheduleSource)}</Text>
          </View>
        </View>

        <Section>
          <SectionHeader title="Today's focus" />
          <Text style={styles.focusTitle}>{dashboardHero.focus}</Text>
          <Text style={styles.sectionCopy}>{dashboardHero.summary}</Text>
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background
  },
  scroll: {
    paddingBottom: 96
  },
  header: {
    paddingHorizontal: 26,
    paddingTop: 22
  },
  date: {
    ...type.eyebrow,
    color: colors.textFaint
  },
  greeting: {
    ...type.title,
    color: colors.text,
    marginTop: 7
  },
  ringShell: {
    alignItems: 'center',
    alignSelf: 'center',
    height: 208,
    justifyContent: 'center',
    marginTop: 30,
    width: 208
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
    ...type.hero,
    color: colors.text,
    fontSize: 74,
    lineHeight: 78
  },
  scoreLabel: {
    ...type.eyebrow,
    color: colors.textFaint,
    marginTop: 6
  },
  readinessNote: {
    ...type.voice,
    color: colors.accent,
    paddingHorizontal: 30,
    paddingTop: 18,
    textAlign: 'center'
  },
  briefingMeta: {
    ...type.caption,
    color: colors.textFaint,
    paddingBottom: 26,
    paddingHorizontal: 30,
    paddingTop: 8,
    textAlign: 'center',
    textTransform: 'capitalize'
  },
  section: {
    backgroundColor: colors.surface,
    borderTopColor: colors.hairlineSoft,
    borderTopWidth: hairlineWidth,
    paddingHorizontal: 26,
    paddingVertical: 18
  },
  sectionHeader: {
    alignItems: 'baseline',
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  sectionTitle: {
    ...type.label,
    color: colors.text
  },
  sectionValue: {
    ...type.number,
    color: colors.text
  },
  unit: {
    ...type.caption,
    color: colors.textFaint
  },
  driverGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 14
  },
  driverCell: {
    backgroundColor: colors.surfaceInset,
    borderRadius: 12,
    minWidth: '46%',
    padding: 12,
    width: '48%'
  },
  driverHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 7
  },
  driverLabel: {
    ...type.eyebrow,
    color: colors.textFaint,
    flex: 1
  },
  driverStatus: {
    ...type.label,
    color: colors.text,
    marginTop: 9,
    textTransform: 'capitalize'
  },
  driverDetail: {
    ...type.caption,
    color: colors.textMuted,
    marginTop: 4
  },
  foodScoreBar: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 14
  },
  foodScoreSegment: {
    borderRadius: 2,
    flex: 1,
    height: 4
  },
  nutritionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14
  },
  nutritionCell: {
    backgroundColor: colors.surfaceInset,
    borderRadius: 12,
    flexGrow: 1,
    minWidth: '46%',
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  nutritionLabel: {
    ...type.eyebrow,
    color: colors.textFaint
  },
  nutritionValue: {
    ...type.number,
    color: colors.text,
    marginTop: 4
  },
  sectionCopy: {
    ...type.caption,
    color: colors.textMuted,
    marginTop: 11
  },
  sourceCopy: {
    ...type.caption,
    color: colors.textFaint,
    marginTop: 6
  },
  twoColumn: {
    backgroundColor: colors.surface,
    borderTopColor: colors.hairlineSoft,
    borderTopWidth: hairlineWidth,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 26,
    paddingVertical: 18
  },
  compactPanel: {
    borderColor: colors.hairline,
    borderRadius: 18,
    borderWidth: hairlineWidth,
    flex: 1,
    padding: 14
  },
  compactIcon: {
    alignItems: 'center',
    backgroundColor: colors.accentWash,
    borderRadius: 999,
    height: 32,
    justifyContent: 'center',
    marginBottom: 12,
    width: 32
  },
  compactLabel: {
    ...type.eyebrow,
    color: colors.textFaint
  },
  compactValue: {
    ...type.heading,
    color: colors.text,
    marginTop: 4
  },
  compactCopy: {
    ...type.caption,
    color: colors.textMuted,
    marginTop: 4
  },
  compactSource: {
    ...type.caption,
    color: colors.textFaint,
    fontSize: 10,
    lineHeight: 14,
    marginTop: 8
  },
  focusTitle: {
    ...type.title,
    color: colors.text,
    fontSize: 21,
    lineHeight: 27,
    marginTop: 10
  }
});
