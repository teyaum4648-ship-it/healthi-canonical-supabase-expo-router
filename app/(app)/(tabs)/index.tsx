import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Stop } from 'react-native-svg';

import type { MealLog, NutritionTargets } from '../../../src/engines/nutrition';
import { useAuth } from '../../../src/features/auth/AuthProvider';
import { composeDashboardNutritionSummary } from '../../../src/features/dashboard/dashboardComposer';
import {
  getActiveNutritionTarget,
  getMealLogsForDate,
  type MealLogRow,
  type NutritionSupabaseClient,
  type NutritionTargetRow
} from '../../../src/features/nutrition/persistence';
import { supabase } from '../../../src/lib/supabase';
import { colors, fonts, hairlineWidth, palette, type } from '../../../src/styles/theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const readiness = {
  score: 82,
  label: 'Primed',
  note: 'A hard session is earned today.',
  date: 'Thursday · July 2',
  firstName: 'Tiam'
};

const vitals = [
  {
    label: 'HRV',
    value: '68',
    unit: 'ms',
    delta: '+4',
    points: '2,13 21,11 40,14 59,9 78,10 97,6 116,4'
  },
  {
    label: 'Resting HR',
    value: '54',
    unit: 'bpm',
    delta: '−2',
    points: '2,5 21,7 40,6 59,10 78,9 97,12 116,13'
  }
];

const sleepStages = [
  { label: 'Deep', value: '1:28', width: '19%', color: palette.forest },
  { label: 'REM', value: '1:41', width: '22%', color: palette.forestMid },
  { label: 'Light', value: '4:02', width: '52%', color: palette.forestPale },
  { label: 'Awake', value: '0:31', width: '7%', color: 'rgba(216, 178, 133, 0.55)' }
] as const;

const foodSegments = Array.from({ length: 10 }, (_, index) => index);

const isUuid = (value: string | undefined): value is string =>
  Boolean(value?.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i));

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
        <G origin={`${c}, ${c}`} rotation="-90">
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

/** Sparkline with a gradient area fill — chart-library defaults kill the instrument read. */
function Sparkline({ points, id }: { points: string; id: string }) {
  const pairs = points
    .trim()
    .split(/\s+/)
    .map((pair) => pair.split(',').map(Number) as [number, number]);
  const last = pairs[pairs.length - 1];
  const line = `M ${pairs.map(([x, y]) => `${x} ${y}`).join(' L ')}`;
  const area = `${line} L ${last[0]} 20 L ${pairs[0][0]} 20 Z`;

  return (
    <Svg height={22} viewBox="0 0 120 22" width="100%">
      <Defs>
        <LinearGradient id={`fade-${id}`} x1="0" x2="0" y1="0" y2="1">
          <Stop offset="0" stopColor={palette.forest} stopOpacity={0.22} />
          <Stop offset="1" stopColor={palette.forest} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Path d={area} fill={`url(#fade-${id})`} />
      <Path d={line} fill="none" stroke={palette.forestMid} strokeLinecap="round" strokeWidth={1.4} />
      <Circle cx={last[0]} cy={last[1]} fill={palette.forest} fillOpacity={0.18} r={5} />
      <Circle cx={last[0]} cy={last[1]} fill={palette.forest} r={2.2} />
    </Svg>
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

function VitalsGrid() {
  return (
    <View style={styles.vitalsGrid}>
      {vitals.map((item, index) => (
        <View key={item.label} style={[styles.vitalCell, index === 0 ? styles.vitalDivider : null]}>
          <Text style={styles.instrumentLabel}>{item.label}</Text>
          <View style={styles.vitalReadout}>
            <Text style={styles.vitalValue}>{item.value}</Text>
            <Text style={styles.unit}>{item.unit}</Text>
            <Text style={styles.delta}>{item.delta}</Text>
          </View>
          <Sparkline id={item.label} points={item.points} />
        </View>
      ))}
    </View>
  );
}

export default function DashboardScreen() {
  const { user } = useAuth();
  const today = new Date().toISOString().slice(0, 10);
  const [nutritionMeals, setNutritionMeals] = useState<MealLog[]>([]);
  const [nutritionTargets, setNutritionTargets] = useState<NutritionTargets | null>(null);
  const [nutritionSource, setNutritionSource] = useState<'remote' | 'calibrating'>('calibrating');

  useEffect(() => {
    const userId = user?.id;

    if (!isUuid(userId)) {
      setNutritionMeals([]);
      setNutritionTargets(null);
      setNutritionSource('calibrating');
      return;
    }

    let isMounted = true;
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
  }, [today, user?.id]);

  const nutritionSummary = composeDashboardNutritionSummary({
    date: today,
    meals: nutritionMeals,
    targets: nutritionTargets,
    demoMode: nutritionSource === 'calibrating' && nutritionMeals.some((meal) => meal.source === 'demo')
  });
  const activeFoodSegments =
    nutritionSummary.meal_count === 0
      ? 0
      : nutritionSummary.food_quality_label === 'Supportive'
        ? 8
        : nutritionSummary.food_quality_label === 'Steady'
          ? 6
          : 4;

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.date}>{readiness.date}</Text>
          <Text style={styles.greeting}>Good morning, {readiness.firstName}</Text>
        </View>

        <ReadinessRing score={readiness.score} />
        <Text style={styles.readinessNote}>
          {readiness.label} — {readiness.note}
        </Text>

        <Section>
          <VitalsGrid />
        </Section>

        <Section>
          <SectionHeader title="Sleep architecture" unit="hrs" value="7:42" />
          <View style={styles.sleepBar}>
            {sleepStages.map((stage) => (
              <View key={stage.label} style={[styles.sleepSegment, { width: stage.width, backgroundColor: stage.color }]} />
            ))}
          </View>
          <View style={styles.legendRow}>
            {sleepStages.slice(0, 3).map((stage) => (
              <View key={stage.label} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: stage.color }]} />
                <Text style={styles.legendText}>
                  {stage.label} {stage.value}
                </Text>
              </View>
            ))}
          </View>
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
            <Text style={styles.compactLabel}>Activity</Text>
            <Text style={styles.compactValue}>Light</Text>
            <Text style={styles.compactCopy}>Best window: late morning</Text>
          </View>
          <View style={styles.compactPanel}>
            <View style={styles.compactIcon}>
              <Ionicons color={colors.accent} name="leaf-outline" size={17} />
            </View>
            <Text style={styles.compactLabel}>Stress</Text>
            <Text style={styles.compactValue}>Low</Text>
            <Text style={styles.compactCopy}>Keep the evening quiet</Text>
          </View>
        </View>

        <Section>
          <SectionHeader title="Today's focus" />
          <Text style={styles.focusTitle}>Load the morning.</Text>
          <Text style={styles.sectionCopy}>
            Your rhythm supports focused work and harder training before early afternoon.
          </Text>
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
    paddingBottom: 26,
    paddingHorizontal: 30,
    paddingTop: 18,
    textAlign: 'center'
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
  vitalsGrid: {
    flexDirection: 'row'
  },
  vitalCell: {
    flex: 1,
    paddingVertical: 12
  },
  vitalDivider: {
    borderRightColor: colors.hairlineSoft,
    borderRightWidth: hairlineWidth,
    marginRight: 16,
    paddingRight: 16
  },
  instrumentLabel: {
    ...type.eyebrow,
    color: colors.textFaint
  },
  vitalReadout: {
    alignItems: 'baseline',
    flexDirection: 'row',
    gap: 5,
    marginBottom: 8,
    marginTop: 6
  },
  vitalValue: {
    ...type.numberLg,
    color: colors.text
  },
  delta: {
    ...type.caption,
    color: colors.accent,
    fontFamily: fonts.bodyMedium,
    fontWeight: '500',
    marginLeft: 'auto'
  },
  sleepBar: {
    borderRadius: 3,
    flexDirection: 'row',
    gap: 3,
    height: 9,
    marginTop: 14,
    overflow: 'hidden'
  },
  sleepSegment: {
    borderRadius: 2,
    height: 9
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginTop: 12
  },
  legendItem: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6
  },
  legendDot: {
    borderRadius: 3,
    height: 6,
    width: 6
  },
  legendText: {
    ...type.caption,
    color: colors.textMuted
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
  focusTitle: {
    ...type.title,
    color: colors.text,
    fontSize: 21,
    lineHeight: 27,
    marginTop: 10
  }
});
