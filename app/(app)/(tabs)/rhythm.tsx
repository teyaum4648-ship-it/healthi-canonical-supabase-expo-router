import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  calculateSleepDuration,
  generateCircadianBriefing,
  type CircadianBriefing,
  type CircadianEnergyPoint,
  type SleepNeedEstimate,
  type SleepSession,
  type TimeWindow
} from '../../../src/engines/circadian';
import { useAuth } from '../../../src/features/auth/AuthProvider';
import {
  getActiveSleepNeedEstimate,
  getRecentSleepSessions,
  saveSleepSession,
  type SleepRhythmSupabaseClient
} from '../../../src/features/sleepRhythm/persistence';
import {
  createDefaultSleepNeedEstimate,
  createDemoSleepSessions,
  createManualSleepSession,
  getConfidenceLabel,
  getSleepSourceLabel
} from '../../../src/features/sleepRhythm/rhythmInputs';
import { supabase } from '../../../src/lib/supabase';
import { fonts, spacing } from '../../../src/styles/theme';

// ─── Utilities ───────────────────────────────────────────────────────────────

const isUuid = (value: string | undefined): value is string =>
  Boolean(value?.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i));

type RhythmDataMode = 'manual' | 'persisted' | 'demo';

const colors = {
  background: '#050506',
  surface: '#0B0D14',
  surfaceMuted: '#121623',
  text: '#F6F2EA',
  textMuted: '#BEB7C9',
  textSubtle: '#817990',
  textInverse: '#100C08',
  border: 'rgba(240, 201, 106, 0.24)',
  borderStrong: 'rgba(240, 201, 106, 0.38)',
  borderMuted: 'rgba(255, 255, 255, 0.08)',
  primary: '#F0C96A',
  primaryMuted: 'rgba(240, 201, 106, 0.12)'
} as const;

const radii = {
  sm: 8,
  md: 12,
  lg: 18,
  full: 999
} as const;

function formatTime(value: string | null | undefined): string {
  if (!value) return 'Not available';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not available';
  const hours = date.getUTCHours();
  const minutes = date.getUTCMinutes();
  const hour12 = hours % 12 || 12;
  const suffix = hours >= 12 ? 'PM' : 'AM';
  return `${hour12}:${String(minutes).padStart(2, '0')} ${suffix}`;
}

function formatDuration(minutes: number | null): string {
  if (minutes === null) return 'Not available';
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

function formatDebt(minutes: number | null): string {
  if (minutes === null) return 'Still calibrating';
  if (minutes === 0) return 'Low recent debt';
  return `${formatDuration(minutes)} recent debt`;
}

function formatWindow(window: TimeWindow | undefined): string {
  if (!window) return 'Unavailable';
  return `${formatTime(window.start_at)} – ${formatTime(window.end_at)}`;
}

function phaseTitle(label: string): string {
  return label
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function phaseLabel(label: string): string {
  const labels: Record<string, string> = {
    wake_grogginess: 'Wake-up ramp',
    rising: 'Rising energy',
    morning_peak: 'Morning peak',
    afternoon_dip: 'Lower-energy window',
    second_peak: 'Second peak',
    wind_down: 'Wind-down',
    sleep_window: 'Sleep window',
    unknown: 'Calibrating'
  };
  return labels[label] ?? phaseTitle(label);
}

function getRhythmLead(briefing: CircadianBriefing): string {
  const deepWorkWindow = briefing.rhythm_plan.deep_work_windows[0];
  if (!deepWorkWindow) return "Healthi is still calibrating today's rhythm estimate.";
  return `Deep work looks strongest around ${formatWindow(deepWorkWindow)}.`;
}

function getLatestSleepDuration(session: SleepSession | undefined): number | null {
  if (!session) return null;
  if (typeof session.duration_minutes === 'number') return session.duration_minutes;
  return calculateSleepDuration(session.sleep_start_at, session.sleep_end_at);
}

function isValidTimeInput(value: string): boolean {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return false;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function EnergyCurvePreview({ points }: { points: CircadianEnergyPoint[] }) {
  const sampledPoints = points.filter((_point, index) => index % 3 === 0).slice(0, 6);
  const visiblePoints = sampledPoints.length > 0 ? sampledPoints : points.slice(0, 5);

  return (
    <View style={styles.energyCurve}>
      {visiblePoints.map((point) => (
        <View key={point.time} style={styles.energyPoint}>
          <View style={styles.energyTrack}>
            <View style={[styles.energyFill, { height: `${Math.max(point.estimated_energy, 12)}%` }]} />
          </View>
          <Text style={styles.energyTime}>{formatTime(point.time)}</Text>
          <Text style={styles.energyLabel}>{phaseLabel(point.label)}</Text>
        </View>
      ))}
    </View>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

// Redesigned: value is right-aligned, cleaner for time-window data
function TimingCard({
  icon,
  title,
  label,
  value
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.timingCard}>
      <View style={styles.timingIcon}>
        <Ionicons color={colors.primary} name={icon} size={15} />
      </View>
      <View style={styles.timingText}>
        <Text style={styles.timingTitle}>{title}</Text>
        <Text style={styles.timingLabel}>{label}</Text>
      </View>
      <Text style={styles.timingValue}>{value}</Text>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function RhythmScreen() {
  const { user } = useAuth();
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const now = useMemo(() => new Date().toISOString(), []);
  const [sleepSessions, setSleepSessions] = useState<SleepSession[]>(() => createDemoSleepSessions(today));
  const [sleepNeed, setSleepNeed] = useState<SleepNeedEstimate>(() => createDefaultSleepNeedEstimate(now));
  const [dataMode, setDataMode] = useState<RhythmDataMode>('demo');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [sleepStartTime, setSleepStartTime] = useState('22:45');
  const [wakeTime, setWakeTime] = useState('06:45');
  const [sleepQuality, setSleepQuality] = useState('4');

  useEffect(() => {
    let isMounted = true;

    async function loadSleepRhythmData() {
      const userId = user?.id;

      if (!isUuid(userId)) {
        if (isMounted) {
          setSleepSessions(createDemoSleepSessions(today));
          setSleepNeed(createDefaultSleepNeedEstimate(now));
          setDataMode('demo');
          setIsLoading(false);
        }
        return;
      }

      try {
        const client = supabase as unknown as SleepRhythmSupabaseClient;
        const [recentSessions, activeNeed] = await Promise.all([
          getRecentSleepSessions(client, userId, 14),
          getActiveSleepNeedEstimate(client, userId)
        ]);

        if (!isMounted) return;

        setSleepSessions(recentSessions.length > 0 ? recentSessions : createDemoSleepSessions(today));
        setSleepNeed(
          activeNeed
            ? {
                minutes: activeNeed.minutes,
                confidence: activeNeed.confidence,
                basis: activeNeed.basis,
                updated_at: activeNeed.updated_at
              }
            : createDefaultSleepNeedEstimate(now)
        );
        setDataMode(recentSessions.length > 0 ? 'persisted' : 'demo');
      } catch {
        if (isMounted) {
          setSleepSessions(createDemoSleepSessions(today));
          setSleepNeed(createDefaultSleepNeedEstimate(now));
          setDataMode('demo');
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadSleepRhythmData();
    return () => { isMounted = false; };
  }, [now, today, user?.id]);

  const briefing: CircadianBriefing = useMemo(
    () =>
      generateCircadianBriefing({
        date: today,
        timezone: 'UTC',
        recentSleepSessions: sleepSessions,
        sleepNeed,
        preferredBedtime: '22:30',
        now
      }),
    [now, sleepNeed, sleepSessions, today]
  );

  const latestSession = sleepSessions[0];
  const sleepDuration = getLatestSleepDuration(latestSession);
  const sourceLabel = getSleepSourceLabel(briefing.source_summary.sleep_source);
  const confidenceLabel = getConfidenceLabel(briefing.confidence);
  const rhythmLead = getRhythmLead(briefing);
  const dataModeCopy =
    dataMode === 'demo'
      ? "Demo data is active. Add a manual sleep window when you want today's estimate to reflect your night."
      : dataMode === 'manual'
        ? "Manual sleep data is active for today's rhythm estimate."
        : "Saved sleep data is active for today's rhythm estimate.";

  async function handleManualSubmit() {
    const normalizedSleepStartTime = sleepStartTime.trim();
    const normalizedWakeTime = wakeTime.trim();

    if (!isValidTimeInput(normalizedSleepStartTime) || !isValidTimeInput(normalizedWakeTime)) {
      Alert.alert('Check sleep window', 'Use 24-hour time like 22:45 and 06:45.');
      return;
    }

    const qualityNumber = sleepQuality ? Number(sleepQuality) : null;
    const boundedQuality =
      qualityNumber !== null && Number.isFinite(qualityNumber)
        ? Math.max(1, Math.min(5, Math.round(qualityNumber)))
        : null;
    const manualSession = createManualSleepSession({
      date: today,
      sleepStartTime: normalizedSleepStartTime,
      wakeTime: normalizedWakeTime,
      sleepQuality: boundedQuality,
      createdAt: new Date().toISOString()
    });

    setIsSaving(true);

    try {
      const userId = user?.id;
      if (isUuid(userId)) {
        await saveSleepSession(supabase as unknown as SleepRhythmSupabaseClient, userId, manualSession);
      }
      setSleepSessions((current) => [manualSession, ...current.filter((session) => session.date !== today)]);
      setDataMode('manual');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to save this sleep window right now.';
      Alert.alert('Sleep window not saved', message);
      setSleepSessions((current) => [manualSession, ...current.filter((session) => session.date !== today)]);
      setDataMode('manual');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <Text style={styles.eyebrow}>Sleep + Rhythm</Text>
          <Text style={styles.title}>Today's Rhythm</Text>
          <Text style={styles.subtitle}>
            Healthi uses your sleep and wake pattern to estimate today's energy windows.
          </Text>
        </View>

        {/* ── Main card ──────────────────────────────────────────────────── */}
        <View style={styles.mainCard}>
          {/* Signature gold crown strip */}
          <View style={styles.cardAccent} />

          <View style={styles.cardInner}>
            {/* Phase + badge row */}
            <View style={styles.cardHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardEyebrow}>Current phase</Text>
                <Text style={styles.phase}>{phaseLabel(briefing.current_phase)}</Text>
              </View>
              <View style={styles.statusStack}>
                <View style={styles.dataBadge}>
                  <Text style={styles.dataBadgeText}>{sourceLabel}</Text>
                </View>
                {isLoading ? <ActivityIndicator color={colors.primary} size="small" /> : null}
              </View>
            </View>

            <View style={styles.divider} />

            {/* Lead signal */}
            <View style={styles.leadSignal}>
              <Text style={styles.leadLabel}>Today's strongest signal</Text>
              <Text style={styles.leadText}>{rhythmLead}</Text>
              <Text style={styles.leadSubcopy}>
                {confidenceLabel}. {dataModeCopy}
              </Text>
            </View>

            <View style={styles.divider} />
          </View>

          {/* Metrics mosaic — bleeds to card edges */}
          <View style={styles.metricsGrid}>
            <Metric label="Source" value={sourceLabel} />
            <Metric label="Confidence" value={confidenceLabel} />
            <Metric
              label="Last sleep"
              value={`${formatTime(latestSession?.sleep_start_at)} – ${formatTime(latestSession?.sleep_end_at)}`}
            />
            <Metric label="Duration" value={formatDuration(sleepDuration)} />
            <Metric label="7-day debt" value={formatDebt(briefing.sleep_debt_7_day.total_sleep_debt_minutes)} />
            <Metric label="Target bedtime" value={formatTime(briefing.target_bedtime)} />
          </View>
        </View>

        {/* ── Energy curve ───────────────────────────────────────────────── */}
        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.panelTitle}>Energy curve</Text>
              <Text style={styles.panelSubtitle}>Estimated from your sleep window</Text>
            </View>
            <View style={styles.panelBadge}>
              <Text style={styles.panelBadgeText}>Estimated</Text>
            </View>
          </View>
          <EnergyCurvePreview points={briefing.energy_curve} />
        </View>

        {/* ── Organize your day ──────────────────────────────────────────── */}
        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.panelTitle}>Organize your day</Text>
              <Text style={styles.panelSubtitle}>Based on today's circadian rhythm</Text>
            </View>
            <View style={styles.panelBadge}>
              <Text style={styles.panelBadgeText}>Timing only</Text>
            </View>
          </View>
          <View style={styles.timingList}>
            <TimingCard
              icon="sparkles-outline"
              title="Deep work"
              label="Best window"
              value={formatWindow(briefing.rhythm_plan.deep_work_windows[0])}
            />
            <TimingCard
              icon="flash-outline"
              title="Exercise"
              label="Suggested window"
              value={formatWindow(briefing.rhythm_plan.best_exercise_windows[0])}
            />
            <TimingCard
              icon="walk-outline"
              title="Walk / light movement"
              label="Suggested window"
              value={formatWindow(briefing.rhythm_plan.best_walk_windows[0])}
            />
            <TimingCard
              icon="leaf-outline"
              title="Breathing / reset"
              label="Suggested window"
              value={formatWindow(briefing.rhythm_plan.breathing_windows[0])}
            />
            {briefing.rhythm_plan.nap_windows[0] ? (
              <TimingCard
                icon="moon-outline"
                title="Short nap"
                label="Possible window"
                value={formatWindow(briefing.rhythm_plan.nap_windows[0])}
              />
            ) : null}
            <TimingCard
              icon="cafe-outline"
              title="Caffeine cutoff"
              label="Estimated from bedtime"
              value={formatTime(briefing.rhythm_plan.caffeine_cutoff)}
            />
            <TimingCard
              icon="cloudy-night-outline"
              title="Wind-down"
              label="Suggested start"
              value={formatTime(briefing.rhythm_plan.wind_down_start)}
            />
          </View>
        </View>

        {/* ── Manual sleep window ────────────────────────────────────────── */}
        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.panelTitle}>Manual sleep window</Text>
              <Text style={styles.panelSubtitle}>Regenerate today's rhythm estimate</Text>
            </View>
            <View style={styles.panelBadge}>
              <Text style={styles.panelBadgeText}>Optional</Text>
            </View>
          </View>
          <Text style={styles.mutedCopy}>
            Add last night's sleep and wake time to regenerate today's rhythm estimate.
          </Text>
          <View style={styles.inputGrid}>
            <View style={styles.inputShell}>
              <Text style={styles.inputLabel}>Sleep start</Text>
              <Text style={styles.inputHint}>24h time</Text>
              <TextInput
                accessibilityLabel="Sleep start time"
                autoCapitalize="none"
                keyboardType="numbers-and-punctuation"
                maxLength={5}
                onChangeText={setSleepStartTime}
                placeholder="22:45"
                placeholderTextColor={colors.textSubtle}
                style={styles.inputField}
                value={sleepStartTime}
              />
            </View>
            <View style={styles.inputShell}>
              <Text style={styles.inputLabel}>Wake time</Text>
              <Text style={styles.inputHint}>24h time</Text>
              <TextInput
                accessibilityLabel="Wake time"
                autoCapitalize="none"
                keyboardType="numbers-and-punctuation"
                maxLength={5}
                onChangeText={setWakeTime}
                placeholder="06:45"
                placeholderTextColor={colors.textSubtle}
                style={styles.inputField}
                value={wakeTime}
              />
            </View>
            <View style={styles.inputShell}>
              <Text style={styles.inputLabel}>Quality</Text>
              <Text style={styles.inputHint}>Optional</Text>
              <View style={styles.qualityRow}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setSleepQuality('')}
                  style={[styles.qualityUnset, sleepQuality === '' ? styles.qualityItemActive : null]}
                >
                  <Text style={[styles.qualityUnsetText, sleepQuality === '' ? styles.qualityTextActive : null]}>
                    Not sure
                  </Text>
                </Pressable>
                {[1, 2, 3, 4, 5].map((value) => (
                  <Pressable
                    key={value}
                    accessibilityRole="button"
                    onPress={() => setSleepQuality(String(value))}
                    style={[styles.qualityDot, sleepQuality === String(value) ? styles.qualityItemActive : null]}
                  >
                    <Text style={[styles.qualityText, sleepQuality === String(value) ? styles.qualityTextActive : null]}>
                      {value}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>
          <View style={styles.quickTimes}>
            {[
              ['22:30', '06:30'],
              ['23:15', '07:00'],
              ['00:00', '07:15']
            ].map(([start, wake]) => (
              <Pressable
                key={`${start}-${wake}`}
                accessibilityRole="button"
                onPress={() => {
                  setSleepStartTime(start);
                  setWakeTime(wake);
                }}
                style={styles.quickTime}
              >
                <Text style={styles.quickTimeText}>{start} – {wake}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable
            accessibilityRole="button"
            disabled={isSaving}
            onPress={handleManualSubmit}
            style={[styles.submitButton, isSaving ? styles.disabledButton : null]}
          >
            {isSaving
              ? <ActivityIndicator color={colors.textInverse} size="small" />
              : <Text style={styles.submitText}>Update rhythm estimate</Text>
            }
          </Pressable>
        </View>

        {/* ── Footer note ────────────────────────────────────────────────── */}
        <View style={styles.note}>
          <Ionicons color={colors.primary} name="information-circle-outline" size={15} />
          <Text style={styles.noteText}>
            This is a wellness estimate. Healthi will improve the rhythm model as more confirmed sleep
            data is added. Wearable sync is coming later.
          </Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({

  // ── Layout
  safeArea: {
    flex: 1,
    backgroundColor: colors.background
  },
  scroll: {
    gap: spacing.lg,
    padding: spacing.lg,
    paddingBottom: 56
  },

  // ── Header
  header: {
    gap: 6,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm
  },
  eyebrow: {
    color: colors.primary,
    fontFamily: fonts.body,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 2.5,
    textTransform: 'uppercase'
  },
  title: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: 40,
    fontWeight: '400',
    lineHeight: 46
  },
  subtitle: {
    maxWidth: 680,
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 23,
    marginTop: 2
  },

  // ── Main card
  mainCard: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 28,
    elevation: 8
  },
  // Signature element: 2px gold crown at the top of the hero card
  cardAccent: {
    height: 2,
    backgroundColor: colors.primary
  },
  cardInner: {
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md
  },
  cardEyebrow: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    marginBottom: 4
  },
  phase: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: 30,
    lineHeight: 36
  },
  statusStack: {
    alignItems: 'flex-end',
    gap: spacing.sm
  },
  dataBadge: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.full,
    backgroundColor: colors.primaryMuted,
    paddingHorizontal: 10,
    paddingVertical: 4
  },
  dataBadgeText: {
    color: colors.primary,
    fontFamily: fonts.body,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase'
  },
  divider: {
    height: 1,
    backgroundColor: colors.borderMuted,
    marginHorizontal: -spacing.lg
  },
  leadSignal: {
    gap: 6
  },
  leadLabel: {
    color: colors.primary,
    fontFamily: fonts.body,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 2
  },
  leadText: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: 18,
    lineHeight: 26
  },
  leadSubcopy: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 2
  },

  // ── Metrics mosaic — bleeds flush to card edges
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 1,
    backgroundColor: colors.borderMuted
  },
  metric: {
    minWidth: 145,
    flexGrow: 1,
    gap: 4,
    backgroundColor: colors.surfaceMuted,
    padding: spacing.md
  },
  metricLabel: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 1.4,
    textTransform: 'uppercase'
  },
  metricValue: {
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 15,
    fontWeight: '600'
  },

  // ── Panels
  panel: {
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md
  },
  panelTitle: {
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2
  },
  panelSubtitle: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 12
  },
  panelBadge: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start'
  },
  panelBadgeText: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase'
  },

  // ── Energy curve
  energyCurve: {
    minHeight: 184,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm
  },
  energyPoint: {
    flex: 1,
    minWidth: 44,
    alignItems: 'center',
    gap: spacing.xs
  },
  energyTrack: {
    width: '100%',
    height: 100,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceMuted
  },
  energyFill: {
    borderTopLeftRadius: radii.sm,
    borderTopRightRadius: radii.sm,
    backgroundColor: colors.primary,
    opacity: 0.82
  },
  energyTime: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 10,
    fontWeight: '600'
  },
  energyLabel: {
    minHeight: 28,
    color: colors.textSubtle,
    fontFamily: fonts.body,
    fontSize: 9,
    lineHeight: 12,
    textAlign: 'center'
  },

  // ── Timing cards
  timingList: {
    gap: 6
  },
  timingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderMuted,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceMuted,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md
  },
  timingIcon: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.sm,
    backgroundColor: colors.primaryMuted
  },
  timingText: {
    flex: 1,
    gap: 2
  },
  timingTitle: {
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 14,
    fontWeight: '600'
  },
  timingLabel: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 0.6,
    textTransform: 'uppercase'
  },
  timingValue: {
    color: colors.primary,
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'right'
  },

  // ── Manual input
  mutedCopy: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 21
  },
  inputGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm
  },
  inputShell: {
    minWidth: 130,
    flexGrow: 1,
    gap: spacing.xs
  },
  inputLabel: {
    color: colors.primary,
    fontFamily: fonts.body,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.6,
    textTransform: 'uppercase'
  },
  inputHint: {
    color: colors.textSubtle,
    fontFamily: fonts.body,
    fontSize: 11
  },
  inputField: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceMuted,
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 16,
    fontWeight: '500',
    paddingHorizontal: spacing.md
  },
  qualityRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6
  },
  qualityUnset: {
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: spacing.sm
  },
  qualityUnsetText: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: '600'
  },
  qualityDot: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceMuted
  },
  qualityItemActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryMuted
  },
  qualityText: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: '600'
  },
  qualityTextActive: {
    color: colors.primary
  },
  quickTimes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm
  },
  quickTime: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  quickTimeText: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.3
  },
  submitButton: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.32,
    shadowRadius: 14,
    elevation: 6
  },
  disabledButton: {
    opacity: 0.55
  },
  submitText: {
    color: colors.textInverse,
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.6,
    textTransform: 'uppercase'
  },

  // ── Footer note
  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    padding: spacing.md
  },
  noteText: {
    flex: 1,
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 19
  }
});
