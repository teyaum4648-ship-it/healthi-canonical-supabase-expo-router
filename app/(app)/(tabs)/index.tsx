import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { generateCircadianBriefing } from '../../../src/engines/circadian';
import { composeDashboardModel, type DashboardModel } from '../../../src/features/dashboard/dashboardComposer';
import { createDefaultSleepNeedEstimate, createDemoSleepSessions } from '../../../src/features/sleepRhythm/rhythmInputs';
import { fonts } from '../../../src/styles/theme';

type IconName = keyof typeof Ionicons.glyphMap;

const C = {
  bg: '#040407',
  panel: 'rgba(12, 13, 18, 0.94)',
  panelRaised: 'rgba(20, 21, 29, 0.92)',
  border: 'rgba(231, 190, 96, 0.26)',
  borderSoft: 'rgba(255,255,255,0.08)',
  gold: '#F0C96A',
  goldDim: '#B89148',
  violet: '#9A6DFF',
  lavender: '#C7B5FF',
  green: '#A7E46A',
  pink: '#FF6F9F',
  text: '#F7F2EA',
  textSub: '#BEB7C9',
  textMuted: '#817990'
};

function formatDateLabel(date: string): string {
  const parsed = new Date(`${date.slice(0, 10)}T12:00:00.000Z`);
  return parsed.toLocaleDateString('en-US', { month: 'long', day: 'numeric', weekday: 'long', timeZone: 'UTC' });
}

function readinessArc(score: number): { rotate: string; color: string }[] {
  const filled = Math.max(1, Math.min(4, Math.round(score / 25)));
  return [0, 1, 2, 3].map((index) => ({
    rotate: `${index * 90}deg`,
    color: index < filled ? C.gold : 'rgba(255,255,255,0.07)'
  }));
}

function Card({ children, style }: { children: React.ReactNode; style?: object }) {
  return <View style={[s.card, style]}>{children}</View>;
}

function Label({ children }: { children: React.ReactNode }) {
  return <Text style={s.label}>{children}</Text>;
}

function ReadinessHero({ model }: { model: DashboardModel }) {
  return (
    <View style={s.heroWrap}>
      <View style={s.heroGlow} />
      <View style={s.heroRing}>
        {readinessArc(model.readiness.score).map((arc) => (
          <View
            key={arc.rotate}
            style={[
              s.arc,
              {
                borderTopColor: arc.color,
                borderRightColor: arc.color,
                transform: [{ rotate: arc.rotate }]
              }
            ]}
          />
        ))}
        <View style={s.heroInner}>
          <Label>TODAY'S READINESS</Label>
          <Text style={s.score}>{model.readiness.score}</Text>
          <Text style={s.heroStatus}>{model.readiness.label}</Text>
          <Text style={s.heroSummary}>{model.readiness.summary}</Text>
        </View>
      </View>
      <View style={s.confidencePill}>
        <View style={s.goldDot} />
        <Text style={s.confidenceText}>Confidence: {model.readiness.confidence}</Text>
      </View>
    </View>
  );
}

function DriverTile({ tile }: { tile: DashboardModel['drivers'][number] }) {
  const colorById: Record<string, string> = {
    sleep_quality: C.lavender,
    recovery: C.pink,
    training_load: C.violet
  };
  const color = colorById[tile.id] ?? C.gold;

  return (
    <Card style={s.driverCard}>
      <View style={[s.iconOrb, { borderColor: `${color}66`, backgroundColor: `${color}14` }]}>
        <Ionicons color={color} name={tile.icon as IconName} size={24} />
      </View>
      <View style={s.driverBody}>
        <Label>{tile.label}</Label>
        <Text style={s.driverValue}>{tile.value}</Text>
        <Text style={[s.driverStatus, { color }]}>{tile.status}</Text>
        <Text style={s.sourceText}>{tile.source} - {tile.confidence}</Text>
      </View>
    </Card>
  );
}

function FocusCard({ model }: { model: DashboardModel }) {
  return (
    <Card style={s.focusCard}>
      <View style={s.focusArt}>
        <View style={s.focusStar} />
        <View style={s.focusHorizon} />
      </View>
      <View style={s.focusBody}>
        <Label>TODAY'S FOCUS</Label>
        <Text style={s.focusTitle}>{model.focus.title}</Text>
        <Text style={s.focusCopy}>{model.focus.body}</Text>
        <View style={s.tagRow}>
          {model.focus.tags.map((tag) => (
            <View key={tag} style={s.tag}>
              <Ionicons color={C.violet} name="sparkles-outline" size={13} />
              <Text style={s.tagText}>{tag}</Text>
            </View>
          ))}
        </View>
      </View>
      <View style={s.whyPanel}>
        <Label>WHY THIS?</Label>
        {model.focus.why.slice(0, 4).map((reason) => (
          <View key={reason} style={s.reasonRow}>
            <Ionicons color={C.violet} name="checkmark-circle-outline" size={17} />
            <Text style={s.reasonText}>{reason}</Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

function ProgressBar({ value, max, color = C.violet }: { value: number; max: number; color?: string }) {
  const width = max > 0 ? `${Math.min(100, Math.round((value / max) * 100))}%` : '28%';
  return (
    <View style={s.progressTrack}>
      <View style={[s.progressFill, { backgroundColor: color, width: width as `${number}%` }]} />
    </View>
  );
}

function TrainingCard({ model, onPress }: { model: DashboardModel; onPress: () => void }) {
  return (
    <Card style={s.stackCard}>
      <View style={s.cardTopRow}>
        <Label>TRAINING</Label>
        <View style={s.miniBadge}><Text style={s.miniBadgeText}>{model.training.source}</Text></View>
      </View>
      <Text style={s.cardTitle}>{model.training.title}</Text>
      <Text style={s.cardSub}>{model.training.subtitle}</Text>
      <View style={s.divider} />
      <Text style={s.metricLabel}>THIS WEEK</Text>
      <Text style={s.metricBig}>{model.training.weeklyProgress.completed} / {model.training.weeklyProgress.target || '--'} sets</Text>
      <ProgressBar value={model.training.weeklyProgress.completed} max={model.training.weeklyProgress.target} />
      <Pressable accessibilityRole="button" onPress={onPress} style={s.goldButton}>
        <Text style={s.goldButtonText}>{model.training.cta}</Text>
        <Ionicons color="#15100A" name="chevron-forward" size={18} />
      </Pressable>
    </Card>
  );
}

function NutritionCard({ model, onPress }: { model: DashboardModel; onPress: () => void }) {
  return (
    <Card style={s.stackCard}>
      <Label>NUTRITION / FOOD RESPONSE</Label>
      <MetricRow label="Calories" value={`${model.nutrition.calories.current} / ${model.nutrition.calories.target || '--'}`} />
      <ProgressBar value={model.nutrition.calories.current} max={model.nutrition.calories.target} />
      <MetricRow label="Protein" value={`${model.nutrition.protein.current} / ${model.nutrition.protein.target || '--'}g`} />
      <ProgressBar value={model.nutrition.protein.current} max={model.nutrition.protein.target} />
      <MetricRow label="Meals Logged" value={`${model.nutrition.mealsLogged.current} / ${model.nutrition.mealsLogged.target || '--'}`} />
      <ProgressBar value={model.nutrition.mealsLogged.current} max={model.nutrition.mealsLogged.target} />
      <View style={s.foodResponse}>
        <Ionicons color={C.green} name="leaf-outline" size={20} />
        <Text style={s.foodResponseText}>{model.nutrition.foodResponse}</Text>
      </View>
      <Pressable accessibilityRole="button" onPress={onPress} style={s.outlineButton}>
        <Text style={s.outlineButtonText}>{model.nutrition.cta}</Text>
        <Ionicons color={C.gold} name="add-circle-outline" size={20} />
      </Pressable>
    </Card>
  );
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.metricRow}>
      <Text style={s.metricText}>{label}</Text>
      <Text style={s.metricValue}>{value}</Text>
    </View>
  );
}

function SleepRhythmCard({ model, onPress }: { model: DashboardModel; onPress: () => void }) {
  return (
    <Card style={s.stackCard}>
      <View style={s.cardTopRow}>
        <Label>SLEEP & RHYTHM</Label>
        <Text style={s.sourceText}>{model.sleepRhythm.source}</Text>
      </View>
      <MetricRow label="Duration" value={model.sleepRhythm.duration} />
      <MetricRow label="Quality" value={model.sleepRhythm.quality} />
      <MetricRow label="Sleep Debt" value={model.sleepRhythm.sleepDebt} />
      <MetricRow label="Rhythm Phase" value={model.sleepRhythm.rhythmPhase} />
      <View style={s.divider} />
      <MetricRow label="Bedtime Target" value={model.sleepRhythm.bedtimeTarget} />
      <MetricRow label="Wind-down Start" value={model.sleepRhythm.windDownStart} />
      <Pressable accessibilityRole="button" onPress={onPress} style={s.outlineButton}>
        <Ionicons color={C.gold} name="moon-outline" size={18} />
        <Text style={s.outlineButtonText}>{model.sleepRhythm.cta}</Text>
        <Ionicons color={C.gold} name="chevron-forward" size={18} />
      </Pressable>
    </Card>
  );
}

function QuickAction({ action, onPress }: { action: DashboardModel['quickActions'][number]; onPress: () => void }) {
  const iconById: Record<string, IconName> = {
    log_meal: 'restaurant-outline',
    start_workout: 'walk-outline',
    log_sleep: 'moon-outline'
  };

  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={s.quickAction}>
      <View style={s.quickIcon}>
        <Ionicons color={C.text} name={iconById[action.id]} size={22} />
      </View>
      <View>
        <Text style={s.quickLabel}>{action.label}</Text>
        <Text style={s.quickSub}>{action.subtitle}</Text>
      </View>
    </Pressable>
  );
}

export default function DashboardScreen() {
  const router = useRouter();
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const model = useMemo(() => {
    const sessions = createDemoSleepSessions(today);
    const briefing = generateCircadianBriefing({
      date: today,
      timezone: 'UTC',
      recentSleepSessions: sessions,
      sleepNeed: createDefaultSleepNeedEstimate(new Date().toISOString()),
      preferredBedtime: '22:30',
      now: new Date().toISOString()
    });

    return composeDashboardModel({
      date: today,
      circadianBriefing: briefing,
      recentSleepSession: sessions[0] ?? null,
      demoMode: true
    });
  }, [today]);

  function go(route: DashboardModel['quickActions'][number]['route']) {
    router.push(route);
  }

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.header}>
          <View style={s.logoMark}><Text style={s.logoText}>H</Text></View>
          <Text style={s.brand}>Healthi</Text>
          <Text style={s.date}>{formatDateLabel(model.date)}</Text>
        </View>

        <ReadinessHero model={model} />

        <View style={s.driverGrid}>
          {model.drivers.map((driver) => <DriverTile key={driver.id} tile={driver} />)}
        </View>

        <FocusCard model={model} />

        <View style={s.stackGrid}>
          <TrainingCard model={model} onPress={() => go('/movement')} />
          <NutritionCard model={model} onPress={() => go('/food')} />
          <SleepRhythmCard model={model} onPress={() => go('/rhythm')} />
        </View>

        <View style={s.quickStrip}>
          {model.quickActions.map((action) => (
            <QuickAction key={action.id} action={action} onPress={() => go(action.route)} />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { backgroundColor: C.bg, flex: 1 },
  scroll: {
    gap: 18,
    paddingBottom: 34,
    paddingHorizontal: 18,
    paddingTop: 12
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10
  },
  logoMark: {
    alignItems: 'center',
    borderColor: C.gold,
    borderRadius: 24,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    shadowColor: C.gold,
    shadowOpacity: 0.3,
    shadowRadius: 12,
    width: 42
  },
  logoText: { color: C.gold, fontFamily: fonts.display, fontSize: 22 },
  brand: { color: C.gold, flex: 1, fontFamily: fonts.display, fontSize: 28 },
  date: { color: C.textSub, fontFamily: fonts.body, fontSize: 13 },
  card: {
    backgroundColor: C.panel,
    borderColor: C.border,
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    padding: 16,
    shadowColor: C.violet,
    shadowOpacity: 0.14,
    shadowRadius: 18
  },
  label: {
    color: C.gold,
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase'
  },
  heroWrap: { alignItems: 'center', paddingVertical: 10 },
  heroGlow: {
    backgroundColor: 'rgba(240,201,106,0.18)',
    borderRadius: 130,
    height: 260,
    position: 'absolute',
    top: 0,
    width: 260
  },
  heroRing: {
    alignItems: 'center',
    borderColor: 'rgba(240,201,106,0.18)',
    borderRadius: 130,
    borderWidth: 1,
    height: 244,
    justifyContent: 'center',
    width: 244
  },
  arc: {
    borderColor: 'transparent',
    borderRadius: 120,
    borderRightWidth: 5,
    borderTopWidth: 5,
    height: 222,
    position: 'absolute',
    width: 222
  },
  heroInner: { alignItems: 'center', maxWidth: 180 },
  score: {
    color: C.gold,
    fontFamily: fonts.display,
    fontSize: 86,
    lineHeight: 96,
    shadowColor: C.gold,
    shadowOpacity: 0.45,
    shadowRadius: 18
  },
  heroStatus: { color: C.text, fontFamily: fonts.body, fontSize: 26, fontWeight: '600' },
  heroSummary: { color: C.textSub, fontFamily: fonts.body, fontSize: 14, lineHeight: 20, marginTop: 8, textAlign: 'center' },
  confidencePill: {
    alignItems: 'center',
    backgroundColor: 'rgba(240,201,106,0.09)',
    borderColor: C.border,
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    marginTop: -5,
    paddingHorizontal: 16,
    paddingVertical: 9
  },
  goldDot: { backgroundColor: C.gold, borderRadius: 4, height: 8, width: 8 },
  confidenceText: { color: C.gold, fontFamily: fonts.body, fontSize: 13 },
  driverGrid: { gap: 12 },
  driverCard: { alignItems: 'center', flexDirection: 'row', gap: 14 },
  iconOrb: {
    alignItems: 'center',
    borderRadius: 30,
    borderWidth: 1,
    height: 58,
    justifyContent: 'center',
    width: 58
  },
  driverBody: { flex: 1, gap: 3 },
  driverValue: { color: C.text, fontFamily: fonts.body, fontSize: 22, fontWeight: '600' },
  driverStatus: { fontFamily: fonts.body, fontSize: 14, fontWeight: '700' },
  sourceText: { color: C.textMuted, fontFamily: fonts.body, fontSize: 12 },
  focusCard: { gap: 15, padding: 0 },
  focusArt: { backgroundColor: '#0B0B1E', height: 130, overflow: 'hidden' },
  focusStar: {
    backgroundColor: C.gold,
    borderRadius: 40,
    height: 44,
    left: 56,
    position: 'absolute',
    shadowColor: C.gold,
    shadowOpacity: 0.85,
    shadowRadius: 34,
    top: 32,
    width: 44
  },
  focusHorizon: {
    backgroundColor: 'rgba(154,109,255,0.32)',
    borderRadius: 160,
    bottom: -72,
    height: 150,
    left: 18,
    position: 'absolute',
    right: 18
  },
  focusBody: { gap: 9, paddingHorizontal: 16 },
  focusTitle: { color: C.text, fontFamily: fonts.body, fontSize: 28, fontWeight: '600' },
  focusCopy: { color: C.textSub, fontFamily: fonts.body, fontSize: 16, lineHeight: 24 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: C.borderSoft,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 7,
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  tagText: { color: C.textSub, fontFamily: fonts.body, fontSize: 12 },
  whyPanel: {
    borderTopColor: C.borderSoft,
    borderTopWidth: 1,
    gap: 10,
    padding: 16
  },
  reasonRow: { alignItems: 'center', flexDirection: 'row', gap: 9 },
  reasonText: { color: C.textSub, fontFamily: fonts.body, fontSize: 14 },
  stackGrid: { gap: 12 },
  stackCard: { gap: 12 },
  cardTopRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  miniBadge: {
    backgroundColor: 'rgba(154,109,255,0.12)',
    borderColor: C.borderSoft,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4
  },
  miniBadgeText: { color: C.lavender, fontFamily: fonts.body, fontSize: 12 },
  cardTitle: { color: C.text, fontFamily: fonts.body, fontSize: 22, fontWeight: '600' },
  cardSub: { color: C.textSub, fontFamily: fonts.body, fontSize: 15 },
  divider: { backgroundColor: C.borderSoft, height: 1 },
  metricLabel: { color: C.gold, fontFamily: fonts.body, fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },
  metricBig: { color: C.text, fontFamily: fonts.body, fontSize: 22 },
  progressTrack: { backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 5, height: 7, overflow: 'hidden' },
  progressFill: { borderRadius: 5, height: '100%' },
  goldButton: {
    alignItems: 'center',
    backgroundColor: C.gold,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 6,
    paddingVertical: 15
  },
  goldButtonText: { color: '#15100A', fontFamily: fonts.body, fontSize: 16, fontWeight: '800' },
  metricRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  metricText: { color: C.textSub, fontFamily: fonts.body, fontSize: 14 },
  metricValue: { color: C.text, fontFamily: fonts.body, fontSize: 14, fontWeight: '600' },
  foodResponse: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: C.borderSoft,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    padding: 12
  },
  foodResponseText: { color: C.textSub, flex: 1, fontFamily: fonts.body, fontSize: 13, lineHeight: 18 },
  outlineButton: {
    alignItems: 'center',
    borderColor: C.border,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    paddingVertical: 12
  },
  outlineButtonText: { color: C.gold, fontFamily: fonts.body, fontSize: 15, fontWeight: '700' },
  quickStrip: { gap: 10 },
  quickAction: {
    alignItems: 'center',
    backgroundColor: C.panelRaised,
    borderColor: C.border,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 14,
    padding: 14
  },
  quickIcon: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 25,
    height: 50,
    justifyContent: 'center',
    width: 50
  },
  quickLabel: { color: C.text, fontFamily: fonts.body, fontSize: 17, fontWeight: '600' },
  quickSub: { color: C.textMuted, fontFamily: fonts.body, fontSize: 13 }
});
