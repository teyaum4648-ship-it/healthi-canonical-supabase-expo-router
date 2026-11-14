import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card, ProgressBar, SectionLabel } from '../../../src/components/mobile/kit';
import { PILLAR_ORDER, pillarFill } from '../../../src/features/dashboard/premium/pillarRingModel';
import { useReadinessSnapshot } from '../../../src/features/dashboard/readinessSnapshot';
import { readinessSeries, readinessTrend } from '../../../src/features/dashboard/todayModel';
import { useTabBarSpace } from '../../../src/features/navigation/tabBarSpace';
import { colors, fonts, hairlineWidth, zones } from '../../../src/styles/mobileTheme';
import { pillarColors } from '../../../src/styles/pillarColors';

/**
 * Readiness, taken apart: today's number against the person's own recent days, a chart of
 * those days, each input with what it moved, what it means for today, and how sure the
 * estimate is. It shows exactly what Today showed; it never recomputes a second number.
 */

const RANGES = [7, 14, 30] as const;
type Range = (typeof RANGES)[number];

const PILLAR_NAMES = {
  recovery_rhythm: 'Recovery + Rhythm',
  nourishment: 'Nourishment',
  movement_capacity: 'Movement Capacity',
  mind_life_load: 'Mind + Life Load'
} as const;

function signedPoints(value: number): string {
  const rounded = Math.round(value);
  return rounded > 0 ? `+${rounded}` : rounded < 0 ? `−${Math.abs(rounded)}` : '0';
}

function shortDate(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function headerDate(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' }).toUpperCase();
}

export default function ReadinessScreen() {
  const snapshot = useReadinessSnapshot();
  const tabSpace = useTabBarSpace(24);
  const [range, setRange] = useState<Range>(14);
  const series = useMemo(
    () => (snapshot ? readinessSeries(snapshot.history, snapshot.date, snapshot.score, range) : []),
    [range, snapshot]
  );
  const trend = snapshot ? readinessTrend(snapshot.score, snapshot.history, snapshot.date, range) : null;

  const back = (
    <View style={styles.nav}>
      <Pressable accessibilityLabel="Back to Today" accessibilityRole="button" hitSlop={8} onPress={() => router.navigate('/')} style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
        <Ionicons accessible={false} color={colors.text} name="chevron-back" size={20} />
        <Text style={styles.backText}>Today</Text>
      </Pressable>
      <Text accessibilityRole="header" style={styles.navTitle}>Readiness</Text>
      <View style={styles.navSpacer} />
    </View>
  );

  if (!snapshot) {
    return (
      <SafeAreaView edges={['top']} style={styles.safe}>
        {back}
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Open Today first, and the breakdown of today’s estimate will be here.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const zone = zones[snapshot.zone];
  const known = series.filter((day): day is { date: string; score: number } => day.score !== null);
  const chartMax = 100;
  const chartMin = known.length ? Math.max(0, Math.min(40, ...known.map((day) => day.score)) - 5) : 40;
  const toHeight = (score: number) => ((score - chartMin) / (chartMax - chartMin)) * 120;

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      {back}
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: tabSpace }]} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>{headerDate(snapshot.date)}</Text>
          <View style={styles.heroLine}>
            <Text style={styles.heroValue}>{snapshot.score ?? '—'}</Text>
            <View style={styles.heroSide}>
              <Text style={[styles.heroWord, { color: zone.text }]}>{snapshot.word}</Text>
              {trend ? (
                <View style={styles.trendRow}>
                  <Ionicons accessible={false} color={trend.direction === 'down' ? zones.warning.text : zones.optimal.text} name={trend.direction === 'up' ? 'caret-up' : trend.direction === 'down' ? 'caret-down' : 'remove'} size={10} />
                  <Text style={styles.trendText}>{trend.text.replace(/ your \d+-day baseline/, ' baseline')}</Text>
                </View>
              ) : <Text style={styles.trendText}>Building your baseline</Text>}
            </View>
          </View>
        </View>

        <Card>
          <View style={styles.chartTop}>
            <View accessibilityRole="tablist" style={styles.segments}>
              {RANGES.map((option) => (
                <Pressable key={option} accessibilityRole="tab" accessibilityState={{ selected: range === option }} onPress={() => setRange(option)} style={[styles.segment, range === option && styles.segmentOn]}>
                  <Text style={[styles.segmentText, range === option && styles.segmentTextOn]}>{option}D</Text>
                </Pressable>
              ))}
            </View>
            {trend ? <Text style={styles.baselineKey}>- - -  Baseline {trend.baseline}</Text> : null}
          </View>
          <View accessible accessibilityLabel={`Readiness over ${range} days: ${known.length} days recorded`} style={styles.chart}>
            {trend ? <View style={[styles.baseline, { bottom: toHeight(trend.baseline) }]} /> : null}
            {series.map((day, index) => (
              <View key={day.date} style={styles.barSlot}>
                {day.score !== null ? (
                  <View style={[styles.bar, { backgroundColor: index === series.length - 1 ? zone.solid : '#3A3D43', height: Math.max(4, toHeight(day.score)) }]} />
                ) : <View style={styles.barEmpty} />}
              </View>
            ))}
          </View>
          <View style={styles.chartAxis}>
            <Text style={styles.axisText}>{shortDate(series[0]!.date)}</Text>
            <Text style={[styles.axisText, styles.axisToday]}>Today</Text>
          </View>
          {known.length < 3 ? <Text style={styles.chartNote}>Each day you open Today adds a bar. Your baseline appears after three days.</Text> : null}
        </Card>

        <View>
          <SectionLabel>Contributors</SectionLabel>
          <Card padded={false} style={styles.list}>
            <View style={styles.contributor}>
              <View style={styles.contributorTop}>
                <Text style={styles.contributorName}>Sleep duration</Text>
                <Text style={styles.contributorValue}>{snapshot.sleep.minutes === null ? '—' : `${Math.floor(snapshot.sleep.minutes / 60)}h ${String(Math.round(snapshot.sleep.minutes % 60)).padStart(2, '0')}m`}</Text>
              </View>
              <ProgressBar color={pillarColors.recovery_rhythm} fraction={snapshot.sleep.minutes === null ? null : snapshot.sleep.minutes / snapshot.sleep.needMinutes} />
              <Text style={styles.contributorDetail}>{snapshot.sleep.detail}</Text>
            </View>
            <View style={styles.contributor}>
              <View style={styles.contributorTop}>
                <Text style={styles.contributorName}>Resting heart rate</Text>
                <Text style={styles.contributorValue}>{snapshot.restingHeartRate.bpm === null ? '—' : `${snapshot.restingHeartRate.bpm} bpm`}</Text>
              </View>
              <Text style={styles.contributorDetail}>{snapshot.restingHeartRate.detail}</Text>
            </View>
            <View style={styles.contributor}>
              <View style={styles.contributorTop}>
                <Text style={styles.contributorName}>Training</Text>
                <Text style={styles.contributorValue}>{snapshot.training.value}</Text>
              </View>
              <Text style={styles.contributorDetail}>{snapshot.training.detail}</Text>
            </View>
            {PILLAR_ORDER.map((domain, index) => {
              const reading = snapshot.pillars.find((pillar) => pillar.domain === domain);
              const driver = snapshot.drivers.find((item) => item.domain === domain);
              const fill = pillarFill(reading);
              return (
                <View key={domain} style={[styles.contributor, index === PILLAR_ORDER.length - 1 && styles.contributorLast]}>
                  <View style={styles.contributorTop}>
                    <Text style={styles.contributorName}>{PILLAR_NAMES[domain]}</Text>
                    <Text style={styles.contributorValue}>{reading && !reading.missing ? `${signedPoints(reading.contribution)} pts` : 'No signal'}</Text>
                  </View>
                  <ProgressBar color={pillarColors[domain]} fraction={fill} />
                  <Text style={styles.contributorDetail}>{driver?.detail ?? 'No signal yet. Missing data lowers confidence, never your score.'}</Text>
                </View>
              );
            })}
          </Card>
        </View>

        <View>
          <SectionLabel>What it means</SectionLabel>
          <Card padded={false} style={styles.list}>
            <View style={styles.contributor}>
              <Text style={styles.meaning}>{snapshot.insight}</Text>
            </View>
            <View style={[styles.contributor, styles.contributorLast]}>
              <View style={styles.contributorTop}>
                <Text style={styles.contributorName}>Confidence</Text>
                <Text style={styles.contributorValue}>{snapshot.confidence[0]!.toUpperCase()}{snapshot.confidence.slice(1)}</Text>
              </View>
              <Text style={styles.contributorDetail}>{snapshot.signals.present} of {snapshot.signals.total} signals in. Missing data lowers confidence, never your score.</Text>
            </View>
          </Card>
        </View>

        <Text style={styles.footer}>General wellness guidance, not medical advice.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { backgroundColor: colors.background, flex: 1 },
  pressed: { opacity: 0.65 },
  nav: { alignItems: 'center', flexDirection: 'row', minHeight: 48, paddingHorizontal: 12 },
  back: { alignItems: 'center', flexDirection: 'row', gap: 2, minHeight: 44, minWidth: 80 },
  backText: { color: colors.text, fontFamily: fonts.body, fontSize: 16 },
  navTitle: { color: colors.text, flex: 1, fontFamily: fonts.bodyMedium, fontSize: 16, fontWeight: '600', textAlign: 'center' },
  navSpacer: { minWidth: 80 },
  scroll: { gap: 24, paddingHorizontal: 16, paddingTop: 8 },
  empty: { padding: 24 },
  emptyText: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 15, lineHeight: 21 },
  hero: { gap: 4, paddingHorizontal: 4 },
  eyebrow: { color: colors.textMuted, fontFamily: fonts.bodyMedium, fontSize: 12, fontWeight: '600', letterSpacing: 0.8 },
  heroLine: { alignItems: 'flex-end', flexDirection: 'row', gap: 14 },
  heroValue: { color: colors.text, fontFamily: fonts.display, fontSize: 76, fontVariant: ['tabular-nums'], fontWeight: '700', letterSpacing: -3, lineHeight: 80 },
  heroSide: { gap: 3, paddingBottom: 12 },
  heroWord: { fontFamily: fonts.bodyMedium, fontSize: 16, fontWeight: '600' },
  trendRow: { alignItems: 'center', flexDirection: 'row', gap: 4 },
  trendText: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 13 },
  chartTop: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  segments: { backgroundColor: colors.surfaceInset, borderRadius: 10, flexDirection: 'row', padding: 2 },
  segment: { alignItems: 'center', borderRadius: 8, justifyContent: 'center', minHeight: 32, minWidth: 44, paddingHorizontal: 10 },
  segmentOn: { backgroundColor: colors.surfaceMuted },
  segmentText: { color: colors.textMuted, fontFamily: fonts.bodyMedium, fontSize: 13, fontWeight: '600' },
  segmentTextOn: { color: colors.text },
  baselineKey: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 12 },
  chart: { alignItems: 'flex-end', flexDirection: 'row', gap: 3, height: 124, position: 'relative' },
  baseline: { borderColor: zones.optimal.solid, borderStyle: 'dashed', borderTopWidth: 1, left: 0, opacity: 0.7, position: 'absolute', right: 0 },
  barSlot: { alignItems: 'center', flex: 1, height: '100%', justifyContent: 'flex-end' },
  bar: { borderRadius: 3, width: '80%' },
  barEmpty: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 1, height: 2, width: '80%' },
  chartAxis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  axisText: { color: colors.textFaint, fontFamily: fonts.body, fontSize: 11 },
  axisToday: { color: colors.text, fontWeight: '600' },
  chartNote: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 13, lineHeight: 18, marginTop: 10 },
  list: { paddingHorizontal: 16 },
  contributor: { borderBottomColor: colors.hairline, borderBottomWidth: hairlineWidth, gap: 8, paddingVertical: 14 },
  contributorLast: { borderBottomWidth: 0 },
  contributorTop: { alignItems: 'baseline', flexDirection: 'row', justifyContent: 'space-between' },
  contributorName: { color: colors.text, fontFamily: fonts.bodyMedium, fontSize: 15, fontWeight: '600' },
  contributorValue: { color: colors.text, fontFamily: fonts.display, fontSize: 15, fontVariant: ['tabular-nums'], fontWeight: '700' },
  contributorDetail: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 13, lineHeight: 18 },
  meaning: { color: colors.text, fontFamily: fonts.bodyMedium, fontSize: 16, fontWeight: '500', lineHeight: 22 },
  footer: { color: colors.textFaint, fontFamily: fonts.body, fontSize: 12, textAlign: 'center' }
});
