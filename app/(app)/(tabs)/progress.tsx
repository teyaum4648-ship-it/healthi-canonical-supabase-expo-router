import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  daysLoggedLabel,
  type TrendsDomain,
  type TrendsDomainCard,
  type TrendsRangeDays
} from '../../../src/engines/trends';
import { SegmentedControl } from '../../../src/components/mobile/SegmentedControl';
import { useAuth } from '../../../src/features/auth/AuthProvider';
import { useLocalToday } from '../../../src/features/navigation/useLocalToday';
import { TrendBarChart } from '../../../src/features/trends/TrendBarChart';
import { loadTrendsScreenModel } from '../../../src/features/trends/trendsComposer';
import type { TrendsScreenModel } from '../../../src/features/trends/trendsTypes';
import { isSupabaseConfigured, supabase } from '../../../src/lib/supabase';
import { colors, type, glassSurface } from '../../../src/styles/mobileTheme';
import { pillarColors } from '../../../src/styles/pillarColors';
import { useTabBarSpace } from '../../../src/features/navigation/tabBarSpace';

const rangeLabels = ['7 days', '14 days', '30 days'] as const;
type RangeLabel = typeof rangeLabels[number];
const rangeDaysFor: Record<RangeLabel, TrendsRangeDays> = { '7 days': 7, '14 days': 14, '30 days': 30 };

const domainColor: Record<TrendsDomain, string> = { ...pillarColors, readiness: colors.accent };
const domainRoute: Record<TrendsDomain, '/rhythm' | '/food' | '/movement' | '/mood' | '/'> = {
  recovery_rhythm: '/rhythm', nourishment: '/food', movement_capacity: '/movement', mind_life_load: '/mood', readiness: '/'
};

function statusLabel(card: TrendsDomainCard): string {
  return card.status === 'calibrating' ? 'Calibrating' : card.status.charAt(0).toUpperCase() + card.status.slice(1);
}

function sourceLabel(model: TrendsScreenModel): string {
  if (model.summary.source_label === 'demo') return 'Logged on this device';
  if (model.summary.source_label === 'logged') return 'From your account';
  return 'From what’s available';
}

function DomainCard({ card, rangeDays }: { card: TrendsDomainCard; rangeDays: number }) {
  const color = domainColor[card.domain];
  return <View style={styles.card}>
    <View style={styles.cardHeader}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={styles.cardTitle}>{card.title}</Text>
      <Text style={styles.status}>{statusLabel(card)}</Text>
    </View>
    <Text style={styles.value}>{card.value_label}</Text>
    <TrendBarChart series={card.series} color={color} unit={card.series_unit} label={card.series_label} />
    <Text style={styles.detail}>{card.detail}</Text>
    <Text style={styles.meta}>{daysLoggedLabel(card.days_logged, rangeDays)}</Text>
  </View>;
}

/**
 * Trends: a chart per pillar, over the last 7, 14 or 30 days.
 *
 * Reached from Home's "This week", so it carries its own way back. Each card says what it
 * is built from in days, and draws a day with nothing logged as a gap. The day's protocol
 * and a list of "insights" that repeated each card's own text used to sit here too; one
 * is a to-do rather than a trend and the other said everything twice.
 */
export default function ProgressScreen() {
  const tabSpace = useTabBarSpace();
  const { user } = useAuth();
  const [range, setRange] = useState<RangeLabel>('7 days');
  const rangeDays = rangeDaysFor[range];
  const [model, setModel] = useState<TrendsScreenModel | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const today = useLocalToday();

  const load = useCallback(async () => {
    setIsLoading(true);
    const next = await loadTrendsScreenModel({
      today,
      range_days: rangeDays,
      user_id: user?.id,
      is_demo_mode: user?.id === 'demo-user' || !isSupabaseConfigured,
      supabase_client: supabase
    });
    setModel(next);
    setIsLoading(false);
  }, [rangeDays, today, user?.id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const summary = model?.summary;
  const focus = summary?.next_focus;
  const focusRoute = focus && focus.domain !== 'balanced' ? domainRoute[focus.domain] : null;

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: tabSpace }]} showsVerticalScrollIndicator={false}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back to Home" hitSlop={8} onPress={() => router.canGoBack() ? router.back() : router.navigate('/')} style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
          <Ionicons color={colors.accent} name="chevron-back" size={22} />
          <Text style={styles.backText}>Home</Text>
        </Pressable>
        <Text accessibilityRole="header" style={styles.title}>Trends</Text>
        <Text style={styles.subtitle}>Patterns from what you’ve logged. A day with nothing logged is left out, not counted as zero.</Text>

        <SegmentedControl options={rangeLabels} value={range} onChange={setRange} />

        {isLoading || !summary || !model ? (
          <View style={[styles.card, styles.loading]}>
            <ActivityIndicator color={colors.accent} />
            <Text style={styles.detail}>Gathering what you’ve logged.</Text>
          </View>
        ) : (
          <>
            <View style={styles.card}>
              <Text style={styles.overviewTitle}>{summary.overview.headline}</Text>
              <Text style={styles.detail}>{summary.overview.detail}</Text>
              <Text style={styles.meta}>{daysLoggedLabel(summary.days_logged, rangeDays)} · {sourceLabel(model)}</Text>
            </View>

            {focus ? (
              <Pressable
                accessibilityRole={focusRoute ? 'button' : undefined}
                disabled={!focusRoute}
                onPress={() => focusRoute && router.navigate(focusRoute)}
                style={({ pressed }) => [styles.card, styles.focus, pressed && styles.pressed]}
              >
                <View style={styles.focusCopy}>
                  <Text style={styles.focusLabel}>Next focus</Text>
                  <Text style={styles.focusTitle}>{focus.title}</Text>
                  <Text style={styles.detail}>{focus.detail}</Text>
                </View>
                {focusRoute ? <Ionicons accessible={false} color={colors.textMuted} name="chevron-forward" size={18} /> : null}
              </Pressable>
            ) : null}

            {summary.domain_cards.map((card) => <DomainCard key={card.domain} card={card} rangeDays={rangeDays} />)}

            {model.load_error ? <Text style={styles.note}>Some trends couldn’t load. They’ll fill in as data becomes available.</Text> : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: 'transparent' },
  scroll: { gap: 14, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40 },
  back: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', minHeight: 44, marginLeft: -6 },
  backText: { ...type.body, color: colors.accent },
  pressed: { opacity: 0.6 },
  title: { ...type.largeTitle, color: colors.text },
  subtitle: { ...type.body, color: colors.textMuted, marginTop: -8 },
  card: { ...glassSurface, borderRadius: 20, padding: 18, gap: 10 },
  loading: { alignItems: 'center', minHeight: 140, justifyContent: 'center' },
  overviewTitle: { ...type.heading, color: colors.text },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  cardTitle: { ...type.label, color: colors.text, flex: 1 },
  status: { ...type.caption, color: colors.textMuted },
  value: { ...type.heading, color: colors.text },
  detail: { ...type.body, fontSize: 15, lineHeight: 21, color: colors.textMuted },
  meta: { ...type.caption, color: colors.textMuted },
  focus: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  focusCopy: { flex: 1, gap: 4 },
  focusLabel: { ...type.caption, fontWeight: '600', color: colors.accent },
  focusTitle: { ...type.body, fontWeight: '600', color: colors.text },
  note: { ...type.caption, color: colors.textMuted, textAlign: 'center' }
});
