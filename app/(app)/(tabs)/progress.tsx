import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  confidenceLabel,
  type TrendsDomainCard,
  type TrendsRangeDays
} from '../../../src/engines/trends';
import { useAuth } from '../../../src/features/auth/AuthProvider';
import { protocolScope, useActiveProtocol } from '../../../src/features/dailyProtocol';
import { loadTrendsScreenModel } from '../../../src/features/trends/trendsComposer';
import type { TrendsScreenModel } from '../../../src/features/trends/trendsTypes';
import { Card } from '../../../src/components/Card';
import { Screen } from '../../../src/components/Screen';
import { SectionHeader } from '../../../src/components/SectionHeader';
import { isSupabaseConfigured, supabase } from '../../../src/lib/supabase';
import { colors, fonts, radii, spacing } from '../../../src/styles/mobileTheme';

const rangeOptions: TrendsRangeDays[] = [7, 14, 30];

function statusLabel(card: TrendsDomainCard): string {
  return card.status === 'calibrating' ? 'Calibrating' : card.status.charAt(0).toUpperCase() + card.status.slice(1);
}

function sourceLabel(model: TrendsScreenModel): string {
  if (model.summary.source_label === 'demo') return 'Demo data';
  if (model.summary.source_label === 'logged') return 'Based on logged data';
  return 'Based on available data';
}

export default function ProgressScreen() {
  const { user } = useAuth();
  const [rangeDays, setRangeDays] = useState<TrendsRangeDays>(7);
  const [model, setModel] = useState<TrendsScreenModel | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const protocolScopeValue = useMemo(() => protocolScope(user?.id), [user?.id]);
  const activeProtocol = useActiveProtocol(protocolScopeValue, today);
  const protocolDone = activeProtocol?.actions.filter((action) => action.status === 'done').length ?? 0;

  const load = useCallback(async () => {
    setIsLoading(true);
    const next = await loadTrendsScreenModel({
      today: new Date().toISOString().slice(0, 10),
      range_days: rangeDays,
      user_id: user?.id,
      is_demo_mode: user?.id === 'demo-user' || !isSupabaseConfigured,
      supabase_client: supabase
    });
    setModel(next);
    setIsLoading(false);
  }, [rangeDays, user?.id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const summary = model?.summary;

  return (
    <Screen contentStyle={styles.content}>
      <SectionHeader eyebrow="Progress" title="Trends" body="Patterns from your logged data." />

      <View accessibilityRole="tablist" style={styles.rangeSelector}>
        {rangeOptions.map((option) => {
          const selected = option === rangeDays;
          return (
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              key={option}
              onPress={() => setRangeDays(option)}
              style={[styles.rangeOption, selected && styles.rangeOptionSelected]}
            >
              <Text style={[styles.rangeText, selected && styles.rangeTextSelected]}>{option} days</Text>
            </Pressable>
          );
        })}
      </View>

      {isLoading || !summary ? (
        <Card style={styles.loadingCard}>
          <ActivityIndicator color={colors.accent} />
          <Text style={styles.loadingText}>Gathering your available signals.</Text>
        </Card>
      ) : (
        <>
          <Card style={styles.overviewCard}>
            <View style={styles.overviewTopline}>
              <Text style={styles.cardEyebrow}>OVERVIEW</Text>
              <Text style={styles.sourceText}>{sourceLabel(model)}</Text>
            </View>
            <Text style={styles.overviewTitle}>{summary.overview.headline}</Text>
            <Text style={styles.overviewDetail}>{summary.overview.detail}</Text>
            <Text style={styles.confidenceText}>{confidenceLabel(summary.confidence)}</Text>
          </Card>

          {activeProtocol && activeProtocol.actions.length > 0 ? (
            <Card style={styles.overviewCard}>
              <Text style={styles.cardEyebrow}>TODAY'S PROTOCOL</Text>
              <Text style={styles.overviewTitle}>{protocolDone}/{activeProtocol.actions.length} actions done</Text>
              <Text style={styles.confidenceText}>Follow-through builds your trends over time.</Text>
            </Card>
          ) : null}

          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Your signals</Text>
            <Text style={styles.sectionCaption}>{rangeDays}-day view</Text>
          </View>

          {summary.domain_cards.map((card) => (
            <Card key={card.domain} style={styles.domainCard}>
              <View style={styles.domainHeader}>
                <Text style={styles.domainTitle}>{card.title}</Text>
                <Text style={[styles.status, card.status === 'watch' && styles.statusWatch]}>{statusLabel(card)}</Text>
              </View>
              <Text style={styles.domainValue}>{card.value_label}</Text>
              <Text style={styles.domainDetail}>{card.detail}</Text>
              <Text style={styles.domainConfidence}>{confidenceLabel(card.confidence)}</Text>
            </Card>
          ))}

          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>What is showing up</Text>
            <Text style={styles.sectionCaption}>Early patterns</Text>
          </View>

          {summary.insights.map((insight) => (
            <Card key={insight.id} style={styles.insightCard}>
              <Text style={styles.insightTitle}>{insight.title}</Text>
              <Text style={styles.insightDetail}>{insight.detail}</Text>
              <Text style={styles.domainConfidence}>{confidenceLabel(insight.confidence)}</Text>
            </Card>
          ))}

          <Card style={styles.focusCard}>
            <Text style={styles.cardEyebrow}>NEXT FOCUS</Text>
            <Text style={styles.focusTitle}>{summary.next_focus.title}</Text>
            <Text style={styles.focusDetail}>{summary.next_focus.detail}</Text>
          </Card>

          {model.load_error ? (
            <Text style={styles.note}>Some trends are still calibrating while data becomes available.</Text>
          ) : null}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 116
  },
  rangeSelector: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surfaceInset,
    borderColor: colors.border,
    borderRadius: radii.full,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    padding: 4
  },
  rangeOption: {
    borderRadius: radii.full,
    minWidth: 66,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm
  },
  rangeOptionSelected: {
    backgroundColor: colors.accent
  },
  rangeText: {
    color: colors.textMuted,
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    textAlign: 'center'
  },
  rangeTextSelected: {
    color: colors.primaryText
  },
  loadingCard: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 150
  },
  loadingText: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 14
  },
  overviewCard: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.borderStrong,
    gap: spacing.sm
  },
  overviewTopline: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  cardEyebrow: {
    color: colors.accent,
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    letterSpacing: 1.4
  },
  sourceText: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 12
  },
  overviewTitle: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: 28,
    lineHeight: 34
  },
  overviewDetail: {
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22
  },
  confidenceText: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 12,
    marginTop: spacing.xs
  },
  sectionHeaderRow: {
    alignItems: 'baseline',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm
  },
  sectionTitle: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: 22
  },
  sectionCaption: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 12
  },
  domainCard: {
    gap: spacing.xs
  },
  domainHeader: {
    alignItems: 'baseline',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm
  },
  domainTitle: {
    color: colors.text,
    flex: 1,
    fontFamily: fonts.bodyMedium,
    fontSize: 15
  },
  status: {
    color: colors.accentMid,
    fontFamily: fonts.bodyMedium,
    fontSize: 12
  },
  statusWatch: {
    color: colors.danger
  },
  domainValue: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: 23,
    lineHeight: 29
  },
  domainDetail: {
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 21
  },
  domainConfidence: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 12,
    marginTop: spacing.xs
  },
  insightCard: {
    gap: spacing.xs
  },
  insightTitle: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: 20,
    lineHeight: 26
  },
  insightDetail: {
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 21
  },
  focusCard: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
    gap: spacing.sm
  },
  focusTitle: {
    color: colors.primaryText,
    fontFamily: fonts.display,
    fontSize: 26,
    lineHeight: 32
  },
  focusDetail: {
    color: colors.primaryText,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 21,
    opacity: 0.9
  },
  note: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center'
  }
});
