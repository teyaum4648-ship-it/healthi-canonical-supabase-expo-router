import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { Button } from '../../../src/components/Button';
import { Card } from '../../../src/components/Card';
import { Screen } from '../../../src/components/Screen';
import { SectionHeader } from '../../../src/components/SectionHeader';
import { LegalLinks } from '../../../src/features/legal/LegalLinksPanel';
import { Disclosure } from '../../../src/components/mobile/Disclosure';
import { SegmentedControl } from '../../../src/components/mobile/SegmentedControl';
import { useAuth } from '../../../src/features/auth/AuthProvider';
import { dayModeLabel, protocolScope, useActiveProtocol } from '../../../src/features/dailyProtocol';
import { DEFAULT_WEIGHT_UNIT, WEIGHT_UNITS, type WeightUnit } from '../../../src/features/movement/weightUnits';
import { readWeightUnit, weightUnitScope, writeWeightUnit } from '../../../src/features/movement/weightUnitStore';
import { ALLERGEN_GROUPS, ALLERGEN_GROUP_LABELS, type AllergenGroup } from '../../../src/features/nutrition/allergens';
import {
  allergenProfileScope,
  readAllergenProfile,
  toggleAllergenGroup,
  writeAllergenProfile
} from '../../../src/features/nutrition/allergenProfileStore';
import {
  confidenceLabel as trendsConfidenceLabel,
  type TrendsDomainCard,
  type TrendsRangeDays
} from '../../../src/engines/trends';
import { DiaryRepairPanel } from '../../../src/features/nutrition/DiaryRepairPanel';
import { useLocalToday } from '../../../src/features/navigation/useLocalToday';
import { loadProfileScreenModel } from '../../../src/features/profile/profileComposer';
import type { ProfileScreenModel } from '../../../src/features/profile/profileTypes';
import { loadTrendsScreenModel } from '../../../src/features/trends/trendsComposer';
import type { TrendsScreenModel } from '../../../src/features/trends/trendsTypes';
import { isSupabaseConfigured, supabase } from '../../../src/lib/supabase';
import { colors, fonts, spacing } from '../../../src/styles/mobileTheme';

function statusLabel(value: 'ready' | 'partial' | 'calibrating'): string {
  return value === 'ready' ? 'Ready' : value === 'partial' ? 'Early pattern' : 'Calibrating';
}

const macroColors = [colors.accent, colors.accentMid, colors.accentSoft];
const trendRangeOptions: TrendsRangeDays[] = [7, 14, 30];

function trendStatusLabel(card: TrendsDomainCard): string {
  return card.status === 'calibrating' ? 'Calibrating' : card.status.charAt(0).toUpperCase() + card.status.slice(1);
}

function trendSourceLabel(model: TrendsScreenModel): string {
  if (model.summary.source_label === 'demo') return 'Demo data';
  if (model.summary.source_label === 'logged') return 'Based on logged data';
  return 'Based on available data';
}

function MacroTendencyDonut({ slices }: { slices: ProfileScreenModel['blueprint']['nourishment']['macro_tendency'] }) {
  const size = 108;
  const strokeWidth = 13;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <View style={styles.donutWrap}>
      <Svg height={size} width={size}>
        <Circle cx={size / 2} cy={size / 2} fill="none" r={radius} stroke={colors.track} strokeWidth={strokeWidth} />
        {slices.map((slice, index) => {
          const dash = (slice.weight / 100) * circumference;
          const segment = (
            <Circle
              cx={size / 2}
              cy={size / 2}
              fill="none"
              key={slice.nutrient}
              r={radius}
              stroke={macroColors[index]}
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={-offset}
              strokeLinecap="round"
              strokeWidth={strokeWidth}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          );
          offset += dash;
          return segment;
        })}
      </Svg>
      <View style={styles.donutCenter} pointerEvents="none">
        <Text style={styles.donutLabel}>Macro</Text>
        <Text style={styles.donutSubLabel}>tendency</Text>
      </View>
    </View>
  );
}

export default function SettingsScreen() {
  const { signOut, user, profile, mode, startDemo } = useAuth();
  const actualToday = useLocalToday();
  const [confirmDemoReset, setConfirmDemoReset] = useState(false);
  const [isResettingDemo, setIsResettingDemo] = useState(false);
  const [demoResetError, setDemoResetError] = useState('');
  const [model, setModel] = useState<ProfileScreenModel | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [trendRangeDays, setTrendRangeDays] = useState<TrendsRangeDays>(7);
  const [weightUnit, setWeightUnit] = useState<WeightUnit>(DEFAULT_WEIGHT_UNIT);
  const [avoidingAllergens, setAvoidingAllergens] = useState<AllergenGroup[]>([]);
  const [trendsModel, setTrendsModel] = useState<TrendsScreenModel | null>(null);
  const [isTrendsLoading, setIsTrendsLoading] = useState(true);
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const protocolScopeValue = useMemo(() => protocolScope(user?.id), [user?.id]);
  const activeProtocol = useActiveProtocol(protocolScopeValue, today);
  const protocolDone = activeProtocol?.actions.filter((action) => action.status === 'done').length ?? 0;

  const load = useCallback(async () => {
    setIsLoading(true);
    const next = await loadProfileScreenModel({
      profile: profile
        ? {
            id: profile.id,
            display_name: profile.display_name,
            primary_goal: profile.primary_goal,
            onboarding_status: profile.onboarding_status
          }
        : null,
      email: user?.email,
      is_demo_mode: user?.id === 'demo-user' || !isSupabaseConfigured,
      supabase_client: supabase
    });
    setModel(next);
    setIsLoading(false);
  }, [profile, user?.email, user?.id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const loadTrends = useCallback(async () => {
    setIsTrendsLoading(true);
    const next = await loadTrendsScreenModel({
      today,
      range_days: trendRangeDays,
      user_id: user?.id,
      is_demo_mode: user?.id === 'demo-user' || !isSupabaseConfigured,
      supabase_client: supabase
    });
    setTrendsModel(next);
    setIsTrendsLoading(false);
  }, [today, trendRangeDays, user?.id]);

  useFocusEffect(
    useCallback(() => {
      void loadTrends();
    }, [loadTrends])
  );

  const unitScope = useMemo(() => weightUnitScope(user?.id), [user?.id]);
  const allergenScope = useMemo(() => allergenProfileScope(user?.id), [user?.id]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void readWeightUnit(unitScope).then((unit) => { if (active) setWeightUnit(unit); });
      return () => { active = false; };
    }, [unitScope])
  );

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void readAllergenProfile(allergenScope).then((groups) => { if (active) setAvoidingAllergens(groups); });
      return () => { active = false; };
    }, [allergenScope])
  );

  function handleWeightUnitChange(unit: WeightUnit) {
    setWeightUnit(unit);
    void writeWeightUnit(unitScope, unit);
  }

  function handleAllergenToggle(group: AllergenGroup) {
    const next = toggleAllergenGroup(avoidingAllergens, group);
    setAvoidingAllergens(next);
    void writeAllergenProfile(allergenScope, next);
  }

  async function handleSignOut() {
    try {
      await signOut();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to sign out right now.';
      Alert.alert('Sign out failed', message);
    }
  }

  const baseline = model?.baseline;

  return (
    <Screen contentStyle={styles.content}>
      <SectionHeader
        eyebrow="Profile"
        title="You"
        body="Your progress, profile and preferences."
      />

      {isLoading || !model || !baseline ? (
        <Card style={styles.loadingCard}>
          <ActivityIndicator color={colors.accent} />
          <Text style={styles.loadingText}>Organizing your available data.</Text>
        </Card>
      ) : (
        <>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Your trends</Text>
            <Text style={styles.sectionCaption}>Your recent patterns</Text>
          </View>

          <View accessibilityRole="tablist" style={styles.trendRangeSelector}>
            {trendRangeOptions.map((option) => {
              const selected = option === trendRangeDays;
              return (
                <Pressable
                  accessibilityRole="tab"
                  accessibilityState={{ selected }}
                  key={option}
                  onPress={() => setTrendRangeDays(option)}
                  style={[styles.trendRangeOption, selected && styles.trendRangeOptionSelected]}
                >
                  <Text style={[styles.trendRangeText, selected && styles.trendRangeTextSelected]}>{option} days</Text>
                </Pressable>
              );
            })}
          </View>

          {isTrendsLoading || !trendsModel ? (
            <Card style={styles.trendLoadingCard}>
              <ActivityIndicator color={colors.accent} />
              <Text style={styles.loadingText}>Gathering your available patterns.</Text>
            </Card>
          ) : (
            <>
              <Card style={styles.trendOverviewCard}>
                <View style={styles.trendTopline}>
                  <Text style={styles.cardEyebrow}>OVERVIEW</Text>
                  <Text style={styles.trendSource}>{trendSourceLabel(trendsModel)}</Text>
                </View>
                <Text style={styles.trendOverviewTitle}>{trendsModel.summary.overview.headline}</Text>
                <Text style={styles.detail}>{trendsModel.summary.overview.detail}</Text>
                <Text style={styles.meta}>{trendsConfidenceLabel(trendsModel.summary.confidence)}</Text>
              </Card>

              <View style={styles.trendDomainGrid}>
                {trendsModel.summary.domain_cards.map((card) => (
                  <Card key={card.domain} style={styles.trendDomainCard}>
                    <View style={styles.trendTopline}>
                      <Text style={styles.trendDomainTitle}>{card.title}</Text>
                      <Text style={[styles.trendStatus, card.status === 'watch' && styles.trendStatusWatch]}>{trendStatusLabel(card)}</Text>
                    </View>
                    <Text style={styles.trendDomainValue}>{card.value_label}</Text>
                    <Text style={styles.detail}>{card.detail}</Text>
                    <Text style={styles.meta}>{trendsConfidenceLabel(card.confidence)}</Text>
                  </Card>
                ))}
              </View>

              {trendsModel.summary.insights.length > 0 ? (
                <Card style={styles.trendInsightCard}>
                  <Text style={styles.cardEyebrow}>WHAT IS SHOWING UP</Text>
                  {trendsModel.summary.insights.map((insight) => (
                    <View key={insight.id} style={styles.trendInsightRow}>
                      <Text style={styles.trendInsightTitle}>{insight.title}</Text>
                      <Text style={styles.detail}>{insight.detail}</Text>
                      <Text style={styles.meta}>{trendsConfidenceLabel(insight.confidence)}</Text>
                    </View>
                  ))}
                </Card>
              ) : null}

              <Card style={styles.trendFocusCard}>
                <Text style={styles.cardEyebrow}>NEXT FOCUS</Text>
                <Text style={styles.trendFocusTitle}>{trendsModel.summary.next_focus.title}</Text>
                <Text style={styles.trendFocusDetail}>{trendsModel.summary.next_focus.detail}</Text>
              </Card>
            </>
          )}

          <Disclosure title="Your profile and preferences" detail="Goals, nourishment, sleep and movement context">
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Your profile</Text>
            <Text style={styles.sectionCaption}>Available signals</Text>
          </View>
          {baseline.profile_cards.length ? baseline.profile_cards.map((card) => (
            <Card key={card.id} style={styles.profileCard}>
              <Text style={styles.profileTitle}>{card.title}</Text>
              <Text style={styles.profileValue}>{card.value}</Text>
              <Text style={styles.detail}>{card.detail}</Text>
            </Card>
          )) : (
            <Card>
              <Text style={styles.profileTitle}>Baseline details</Text>
              <Text style={styles.detail}>Complete setup to add your goal and personal context.</Text>
            </Card>
          )}

          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Your personal blueprint</Text>
            <Text style={styles.sectionCaption}>What shapes your plan</Text>
          </View>

          <Card style={styles.blueprintCard}>
            <Text style={styles.cardEyebrow}>NOURISHMENT PREFERENCES</Text>
            <Text style={styles.blueprintTitle}>{model.blueprint.nourishment.pattern_label}</Text>
            <Text style={styles.detail}>{model.blueprint.nourishment.detail}</Text>
            <View style={styles.nourishmentRow}>
              <MacroTendencyDonut slices={model.blueprint.nourishment.macro_tendency} />
              <View style={styles.macroLegend}>
                {model.blueprint.nourishment.macro_tendency.map((slice, index) => (
                  <View key={slice.nutrient} style={styles.macroLegendRow}>
                    <View style={[styles.macroDot, { backgroundColor: macroColors[index] }]} />
                    <Text style={styles.macroLabel}>{slice.nutrient}</Text>
                    <Text style={styles.macroValue}>{slice.tendency}</Text>
                  </View>
                ))}
              </View>
            </View>
            <Text style={styles.miniHeading}>Often logged meals</Text>
            <Text style={styles.detail}>{model.blueprint.nourishment.often_logged_meals.length ? model.blueprint.nourishment.often_logged_meals.join(' · ') : 'Log a few meals to show the meals you return to most often.'}</Text>
            <Text style={styles.miniHeading}>Meal rhythm</Text>
            {model.blueprint.nourishment.meal_timing.map((item) => <Text key={item} style={styles.bulletCopy}>• {item}</Text>)}
            <Text style={styles.readinessNote}>{model.blueprint.nourishment.readiness_note}</Text>
          </Card>

          <Card style={styles.blueprintCard}>
            <Text style={styles.cardEyebrow}>SLEEP RHYTHM</Text>
            <Text style={styles.blueprintTitle}>Your sleep context</Text>
            <Text style={styles.miniHeading}>Biggest friction</Text>
            {model.blueprint.sleep.biggest_friction.map((item) => <Text key={item} style={styles.bulletCopy}>• {item}</Text>)}
            <Text style={styles.miniHeading}>Strongest supporters</Text>
            {model.blueprint.sleep.biggest_supporters.map((item) => <Text key={item} style={styles.bulletCopy}>• {item}</Text>)}
            <Text style={styles.miniHeading}>Rhythm cues</Text>
            {model.blueprint.sleep.rhythm_tips.map((tip) => (
              <View key={tip.title} style={styles.tipRow}>
                <Text style={styles.tipTitle}>{tip.title}</Text>
                <Text style={styles.detail}>{tip.detail}</Text>
              </View>
            ))}
            <Text style={styles.readinessNote}>{model.blueprint.sleep.readiness_note}</Text>
          </Card>

          <Card style={styles.blueprintCard}>
            <Text style={styles.cardEyebrow}>MOVEMENT SUMMARY</Text>
            <Text style={styles.blueprintTitle}>Your training context</Text>
            <View style={styles.movementMetrics}>
              <View style={styles.metricItem}>
                <Text style={styles.metricValue}>{model.blueprint.movement.total_minutes}</Text>
                <Text style={styles.metricLabel}>Minutes this week</Text>
              </View>
              <View style={styles.metricItem}>
                <Text style={styles.metricValue}>{model.blueprint.movement.average_effort ?? '—'}</Text>
                <Text style={styles.metricLabel}>Average effort</Text>
              </View>
              <View style={styles.metricItem}>
                <Text style={styles.metricValue}>{model.blueprint.movement.mobility_recovery_sessions}</Text>
                <Text style={styles.metricLabel}>Mobility / recovery</Text>
              </View>
            </View>
            <Text style={styles.detail}>Training pattern: {model.blueprint.movement.consistency_label}</Text>
            <Text style={styles.miniHeading}>Movement context</Text>
            {model.blueprint.movement.movement_notes.map((item) => <Text key={item} style={styles.bulletCopy}>• {item}</Text>)}
            <Text style={styles.detail}>{model.blueprint.movement.mobility_note}</Text>
            <Text style={styles.readinessNote}>{model.blueprint.movement.readiness_note}</Text>
          </Card>

          <Card style={styles.calibrationCard}>
            <Text style={styles.cardEyebrow}>CALIBRATION</Text>
            <Text style={styles.calibrationTitle}>{baseline.calibration.completion_label}</Text>
            <Text style={styles.detail}>{baseline.calibration.detail}</Text>
            <View style={styles.domainList}>
              {baseline.calibration.domains.map((domain) => (
                <View key={domain.domain} style={styles.domainRow}>
                  <View style={styles.domainText}>
                    <Text style={styles.domainLabel}>{domain.label}</Text>
                    <Text style={styles.domainDetail}>{domain.detail}</Text>
                  </View>
                  <Text style={[styles.domainStatus, domain.status === 'calibrating' && styles.domainStatusCalibrating]}>{statusLabel(domain.status)}</Text>
                </View>
              ))}
            </View>
          </Card>

          <Card>
            <Text style={styles.cardEyebrow}>TRAINING UNITS</Text>
            <Text style={styles.preferenceTitle}>Weight unit</Text>
            <Text style={styles.detail}>New sets are logged in this unit. Sets you have already saved keep the unit they were recorded in.</Text>
            <View style={styles.unitControl}>
              <SegmentedControl onChange={handleWeightUnitChange} options={WEIGHT_UNITS} value={weightUnit} />
            </View>
          </Card>

          <Card>
            <Text style={styles.cardEyebrow}>ALLERGENS</Text>
            <Text style={styles.preferenceTitle}>Groups to watch for</Text>
            <Text style={styles.detail}>
              Healthi flags these when a food's label declares them. It cannot tell you a food
              is free of an allergen — many records carry no allergen statement at all — so
              always check the packet.
            </Text>
            <View style={styles.allergenWrap}>
              {ALLERGEN_GROUPS.map((group) => {
                const selected = avoidingAllergens.includes(group);
                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    key={group}
                    onPress={() => handleAllergenToggle(group)}
                    style={[styles.allergenChip, selected && styles.allergenChipSelected]}
                  >
                    <Text style={selected ? styles.allergenChipTextSelected : styles.allergenChipText}>
                      {ALLERGEN_GROUP_LABELS[group]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Card>

          <Card>
            <Text style={styles.cardEyebrow}>PREFERENCES</Text>
            {baseline.preferences.map((preference) => (
              <View key={preference.id} style={styles.preferenceRow}>
                <Text style={styles.preferenceTitle}>{preference.title}</Text>
                <Text style={styles.detail}>{preference.detail}</Text>
              </View>
            ))}
          </Card>

          <Card style={styles.nextStepsCard}>
            <Text style={styles.cardEyebrow}>NEXT STEPS</Text>
            {baseline.next_steps.map((step) => (
              <View key={step.id} style={styles.stepRow}>
                <View style={styles.stepDot} />
                <View style={styles.stepText}>
                  <Text style={styles.stepTitle}>{step.title}</Text>
                  <Text style={styles.detail}>{step.detail}</Text>
                </View>
              </View>
            ))}
          </Card>

          </Disclosure>
          <LegalLinks />

        <Disclosure title="Account and baseline" detail={model.account.label}>
          <Card style={styles.accountCard}>
            <Text style={styles.cardEyebrow}>ACCOUNT</Text>
            <Text style={styles.accountTitle}>{model.account.label}</Text>
            <Text style={styles.detail}>{model.account.detail}</Text>
            <Text style={styles.meta}>{model.account.source_label === 'demo' ? 'Local demo mode' : model.account.source_label === 'logged' ? 'Saved profile data' : 'Setup status'}</Text>
          </Card>

          <Card style={styles.baselineCard}>
            <Text style={styles.cardEyebrow}>YOUR BASELINE</Text>
            <Text style={styles.baselineTitle}>{baseline.headline}</Text>
            <Text style={styles.baselineDetail}>{baseline.detail}</Text>
            <Text style={styles.meta}>Confidence: {baseline.confidence}</Text>
          </Card>

          {activeProtocol ? (
            <Card>
              <Text style={styles.cardEyebrow}>TODAY'S PROTOCOL</Text>
              <Text style={styles.baselineTitle}>{activeProtocol.headline}</Text>
              <Text style={styles.meta}>
                {dayModeLabel(activeProtocol.day_mode)} · {protocolDone}/{activeProtocol.actions.length} done · Confidence: {activeProtocol.confidence}
              </Text>
            </Card>
          ) : null}

          <Button label="Log out" onPress={handleSignOut} variant="secondary" />
          </Disclosure>
          <Text style={styles.footer}>Healthi provides general wellness guidance based on available data.</Text>

          {model.load_error ? <Text style={styles.errorNote}>Some profile details are still calibrating while data becomes available.</Text> : null}
        </>
      )}
      {mode === 'demo' ? (
        <Disclosure title="Diary check" detail="Find entries filed on the wrong day">
          <DiaryRepairPanel today={actualToday} />
        </Disclosure>
      ) : null}
      {mode === 'demo' ? (
        <Disclosure title="Demo settings" detail="Reset this device’s demo history">
          <Text style={styles.cardEyebrow}>YOUR DEMO</Text>
          <Text style={styles.baselineTitle}>A fresh start, whenever you need it</Text>
          <Text style={styles.detail}>Your demo entries stay on this device. Resetting starts onboarding again with empty sleep, food, movement, and plan history.</Text>
          {confirmDemoReset ? <>
            <Text style={styles.detail}>Remove this device’s demo history? Personal account data is not affected.</Text>
            <Button label="Reset demo and start again" isLoading={isResettingDemo} onPress={async () => {
              setIsResettingDemo(true);
              setDemoResetError('');
              try { await startDemo(true); }
              catch { setDemoResetError('Reset could not finish. Please try again.'); }
              finally { setIsResettingDemo(false); }
            }} />
            <Button variant="secondary" label="Cancel" onPress={() => setConfirmDemoReset(false)} />
          </> : <Button variant="secondary" label="Start fresh demo" onPress={() => setConfirmDemoReset(true)} />}
          {demoResetError ? <Text accessibilityRole="alert" style={styles.detail}>{demoResetError}</Text> : null}
        </Disclosure>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 28 },
  loadingCard: { alignItems: 'center', justifyContent: 'center', minHeight: 150 },
  loadingText: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 14 },
  accountCard: { backgroundColor: colors.surfaceInset },
  baselineCard: { backgroundColor: colors.surfaceMuted, borderColor: colors.borderStrong },
  cardEyebrow: { color: colors.accent, fontFamily: fonts.bodyMedium, fontSize: 12, letterSpacing: 1.4 },
  accountTitle: { color: colors.text, fontFamily: fonts.display, fontSize: 27, lineHeight: 33 },
  baselineTitle: { color: colors.text, fontFamily: fonts.display, fontSize: 28, lineHeight: 34 },
  baselineDetail: { color: colors.text, fontFamily: fonts.body, fontSize: 15, lineHeight: 22 },
  detail: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 16, lineHeight: 23 },
  meta: { color: colors.textMuted, fontFamily: fonts.bodyMedium, fontSize: 12, marginTop: spacing.xs },
  sectionRow: { alignItems: 'baseline', flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm },
  sectionTitle: { color: colors.text, fontFamily: fonts.display, fontSize: 22 },
  sectionCaption: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 12 },
  trendRangeSelector: { alignSelf: 'flex-start', backgroundColor: colors.surfaceInset, borderColor: colors.border, borderRadius: 999, borderWidth: 1, flexDirection: 'row', gap: 4, padding: 4 },
  trendRangeOption: { borderRadius: 999, minWidth: 66, paddingHorizontal: spacing.sm, paddingVertical: spacing.sm },
  trendRangeOptionSelected: { backgroundColor: colors.accent },
  trendRangeText: { color: colors.textMuted, fontFamily: fonts.bodyMedium, fontSize: 12, textAlign: 'center' },
  trendRangeTextSelected: { color: colors.primaryText },
  trendLoadingCard: { alignItems: 'center', gap: spacing.sm, justifyContent: 'center', minHeight: 120 },
  trendOverviewCard: { backgroundColor: colors.surfaceMuted, borderColor: colors.borderStrong, gap: spacing.sm },
  trendTopline: { alignItems: 'baseline', flexDirection: 'row', gap: spacing.sm, justifyContent: 'space-between' },
  trendSource: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 12 },
  trendOverviewTitle: { color: colors.text, fontFamily: fonts.display, fontSize: 26, lineHeight: 32 },
  trendDomainGrid: { gap: spacing.sm },
  trendDomainCard: { gap: spacing.xs },
  trendDomainTitle: { color: colors.text, flex: 1, fontFamily: fonts.bodyMedium, fontSize: 14 },
  trendStatus: { color: colors.accentMid, fontFamily: fonts.bodyMedium, fontSize: 12 },
  trendStatusWatch: { color: colors.danger },
  trendDomainValue: { color: colors.text, fontFamily: fonts.display, fontSize: 22, lineHeight: 28 },
  trendInsightCard: { gap: spacing.sm },
  trendInsightRow: { borderTopColor: colors.hairlineSoft, borderTopWidth: 1, gap: 3, paddingTop: spacing.sm },
  trendInsightTitle: { color: colors.text, fontFamily: fonts.bodyMedium, fontSize: 14 },
  trendFocusCard: { backgroundColor: colors.accent, borderColor: colors.accent, gap: spacing.xs },
  trendFocusTitle: { color: colors.primaryText, fontFamily: fonts.display, fontSize: 23, lineHeight: 29 },
  trendFocusDetail: { color: colors.primaryText, fontFamily: fonts.body, fontSize: 14, lineHeight: 21, opacity: 0.9 },
  profileCard: { gap: spacing.xs },
  profileTitle: { color: colors.textMuted, fontFamily: fonts.bodyMedium, fontSize: 13 },
  profileValue: { color: colors.text, fontFamily: fonts.display, fontSize: 23, lineHeight: 29 },
  blueprintCard: { gap: spacing.sm },
  blueprintTitle: { color: colors.text, fontFamily: fonts.display, fontSize: 24, lineHeight: 30 },
  nourishmentRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.lg },
  donutWrap: { alignItems: 'center', height: 108, justifyContent: 'center', width: 108 },
  donutCenter: { alignItems: 'center', justifyContent: 'center', position: 'absolute' },
  donutLabel: { color: colors.text, fontFamily: fonts.bodyMedium, fontSize: 12 },
  donutSubLabel: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 12 },
  macroLegend: { flex: 1, gap: spacing.sm },
  macroLegendRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.xs },
  macroDot: { borderRadius: 4, height: 8, width: 8 },
  macroLabel: { color: colors.text, flex: 1, fontFamily: fonts.bodyMedium, fontSize: 13 },
  macroValue: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 12, textTransform: 'capitalize' },
  miniHeading: { color: colors.text, fontFamily: fonts.bodyMedium, fontSize: 13, marginTop: spacing.xs },
  bulletCopy: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 13, lineHeight: 20 },
  readinessNote: { borderTopColor: colors.hairlineSoft, borderTopWidth: 1, color: colors.accent, fontFamily: fonts.body, fontSize: 12, lineHeight: 18, marginTop: spacing.xs, paddingTop: spacing.sm },
  tipRow: { gap: 2, paddingVertical: 2 },
  tipTitle: { color: colors.text, fontFamily: fonts.bodyMedium, fontSize: 13 },
  movementMetrics: { flexDirection: 'row', gap: spacing.sm },
  metricItem: { backgroundColor: colors.surfaceInset, flex: 1, gap: 2, padding: spacing.sm },
  metricValue: { color: colors.text, fontFamily: fonts.display, fontSize: 22, lineHeight: 27 },
  metricLabel: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 12, lineHeight: 14 },
  calibrationCard: { gap: spacing.sm },
  calibrationTitle: { color: colors.text, fontFamily: fonts.display, fontSize: 24, lineHeight: 30 },
  domainList: { borderTopColor: colors.hairline, borderTopWidth: 1, marginTop: spacing.xs },
  domainRow: { alignItems: 'center', borderBottomColor: colors.hairlineSoft, borderBottomWidth: 1, flexDirection: 'row', gap: spacing.sm, justifyContent: 'space-between', paddingVertical: spacing.sm },
  domainText: { flex: 1, gap: 2 },
  domainLabel: { color: colors.text, fontFamily: fonts.bodyMedium, fontSize: 14 },
  domainDetail: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 12, lineHeight: 17 },
  domainStatus: { color: colors.accentMid, fontFamily: fonts.bodyMedium, fontSize: 12, textAlign: 'right' },
  domainStatusCalibrating: { color: colors.textMuted },
  preferenceRow: { gap: 2, paddingVertical: spacing.xs },
  unitControl: { marginTop: spacing.sm },
  allergenWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: spacing.sm },
  allergenChip: {
    minHeight: 44,
    paddingHorizontal: 14,
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceInset
  },
  allergenChipSelected: { borderColor: colors.accent, backgroundColor: colors.accentWash },
  allergenChipText: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 14 },
  allergenChipTextSelected: { color: colors.text, fontFamily: fonts.bodyMedium, fontSize: 14 },
  preferenceTitle: { color: colors.text, fontFamily: fonts.bodyMedium, fontSize: 14 },
  nextStepsCard: { backgroundColor: colors.surfaceInset },
  stepRow: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.sm, paddingVertical: spacing.xs },
  stepDot: { backgroundColor: colors.accent, borderRadius: 4, height: 7, marginTop: 7, width: 7 },
  stepText: { flex: 1, gap: 2 },
  stepTitle: { color: colors.text, fontFamily: fonts.bodyMedium, fontSize: 14 },
  footer: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  errorNote: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 12, lineHeight: 18, textAlign: 'center' }
});
