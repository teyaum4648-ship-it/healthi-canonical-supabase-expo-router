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
import { colors, fonts, radii, spacing } from '../../../src/styles/theme';

const isUuid = (value: string | undefined): value is string =>
  Boolean(value?.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i));

type RhythmDataMode = 'manual' | 'persisted' | 'demo';

function formatTime(value: string | null | undefined): string {
  if (!value) {
    return 'Not available';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Not available';
  }

  const hours = date.getUTCHours();
  const minutes = date.getUTCMinutes();
  const hour12 = hours % 12 || 12;
  const suffix = hours >= 12 ? 'PM' : 'AM';

  return `${hour12}:${String(minutes).padStart(2, '0')} ${suffix}`;
}

function formatDuration(minutes: number | null): string {
  if (minutes === null) {
    return 'Not available';
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  return `${hours}h ${remainingMinutes}m`;
}

function formatDebt(minutes: number | null): string {
  if (minutes === null) {
    return 'Still calibrating';
  }

  if (minutes === 0) {
    return 'Low recent debt';
  }

  return `${formatDuration(minutes)} recent debt`;
}

function formatWindow(window: TimeWindow | undefined): string {
  if (!window) {
    return 'Estimated window unavailable';
  }

  return `${formatTime(window.start_at)} - ${formatTime(window.end_at)}`;
}

function phaseTitle(label: string): string {
  return label
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function getLatestSleepDuration(session: SleepSession | undefined): number | null {
  if (!session) {
    return null;
  }

  if (typeof session.duration_minutes === 'number') {
    return session.duration_minutes;
  }

  return calculateSleepDuration(session.sleep_start_at, session.sleep_end_at);
}

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
          <Text style={styles.energyLabel}>{phaseTitle(point.label)}</Text>
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
        <Ionicons color={colors.lavenderMist} name={icon} size={18} />
      </View>
      <View style={styles.timingText}>
        <Text style={styles.timingTitle}>{title}</Text>
        <Text style={styles.timingLabel}>{label}</Text>
      </View>
      <Text style={styles.timingValue}>{value}</Text>
    </View>
  );
}

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

        if (!isMounted) {
          return;
        }

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
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadSleepRhythmData();

    return () => {
      isMounted = false;
    };
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
  const dataModeCopy =
    dataMode === 'demo'
      ? 'Your rhythm estimate is based on demo sleep data. Confidence will improve as Healthi learns from confirmed sleep sessions.'
      : dataMode === 'manual'
        ? 'Your rhythm estimate is based on the manual sleep window you entered.'
        : 'Your rhythm estimate is based on your saved sleep sessions.';

  async function handleManualSubmit() {
    const qualityNumber = Number(sleepQuality);
    const boundedQuality = Number.isFinite(qualityNumber)
      ? Math.max(1, Math.min(5, Math.round(qualityNumber)))
      : null;
    const manualSession = createManualSleepSession({
      date: today,
      sleepStartTime,
      wakeTime,
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
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>Sleep + Rhythm</Text>
          <Text style={styles.title}>Today's Rhythm</Text>
          <Text style={styles.subtitle}>
            Healthi uses your sleep and wake pattern to estimate today's energy windows.
          </Text>
        </View>

        <View style={styles.mainCard}>
          <View style={styles.cardHeader}>
            <View>
              <Text style={styles.cardEyebrow}>Current phase</Text>
              <Text style={styles.phase}>{phaseTitle(briefing.current_phase)}</Text>
            </View>
            {isLoading ? <ActivityIndicator color={colors.signalGreen} /> : null}
          </View>
          <Text style={styles.cardCopy}>{dataModeCopy}</Text>
          <View style={styles.metricsGrid}>
            <Metric label="Source" value={sourceLabel} />
            <Metric label="Confidence" value={confidenceLabel} />
            <Metric
              label="Last sleep"
              value={`${formatTime(latestSession?.sleep_start_at)} - ${formatTime(latestSession?.sleep_end_at)}`}
            />
            <Metric label="Duration" value={formatDuration(sleepDuration)} />
            <Metric label="7-day debt" value={formatDebt(briefing.sleep_debt_7_day.total_sleep_debt_minutes)} />
            <Metric label="Target bedtime" value={formatTime(briefing.target_bedtime)} />
          </View>
        </View>

        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            <Text style={styles.panelTitle}>Energy curve preview</Text>
            <Text style={styles.panelMeta}>Estimated</Text>
          </View>
          <EnergyCurvePreview points={briefing.energy_curve} />
        </View>

        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            <Text style={styles.panelTitle}>Organize your day</Text>
            <Text style={styles.panelMeta}>Timing only</Text>
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

        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            <Text style={styles.panelTitle}>Manual sleep window</Text>
            <Text style={styles.panelMeta}>Optional</Text>
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
                placeholderTextColor={colors.mutedViolet}
                style={styles.inputButton}
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
                placeholderTextColor={colors.mutedViolet}
                style={styles.inputButton}
                value={wakeTime}
              />
            </View>
            <View style={styles.inputShell}>
              <Text style={styles.inputLabel}>Quality</Text>
              <Text style={styles.inputHint}>1-5</Text>
              <Pressable style={styles.qualityRow}>
                {[1, 2, 3, 4, 5].map((value) => (
                  <Pressable
                    key={value}
                    accessibilityRole="button"
                    onPress={() => setSleepQuality(String(value))}
                    style={[styles.qualityDot, sleepQuality === String(value) ? styles.qualityDotActive : null]}
                  >
                    <Text style={styles.qualityText}>{value}</Text>
                  </Pressable>
                ))}
              </Pressable>
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
                <Text style={styles.quickTimeText}>
                  {start} - {wake}
                </Text>
              </Pressable>
            ))}
          </View>
          <Pressable
            accessibilityRole="button"
            disabled={isSaving}
            onPress={handleManualSubmit}
            style={[styles.submitButton, isSaving ? styles.disabledButton : null]}
          >
            <Text style={styles.submitText}>{isSaving ? 'Updating rhythm...' : 'Update rhythm estimate'}</Text>
          </Pressable>
        </View>

        <View style={styles.note}>
          <Ionicons color={colors.signalGreen} name="information-circle-outline" size={18} />
          <Text style={styles.noteText}>
            This is a wellness estimate. Healthi will improve the rhythm model as more confirmed sleep
            data is added. Wearable sync is coming later.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.midnightPlum
  },
  scroll: {
    gap: spacing.md,
    padding: spacing.lg,
    paddingBottom: spacing.xl
  },
  header: {
    gap: spacing.xs,
    paddingTop: spacing.md
  },
  eyebrow: {
    color: colors.signalGreen,
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
    textTransform: 'uppercase'
  },
  title: {
    color: colors.cosmicWhite,
    fontFamily: fonts.display,
    fontSize: 38,
    fontWeight: '400',
    lineHeight: 44
  },
  subtitle: {
    maxWidth: 680,
    color: colors.mutedViolet,
    fontFamily: fonts.body,
    fontSize: 16,
    lineHeight: 24
  },
  mainCard: {
    gap: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(238, 232, 247, 0.18)',
    borderRadius: radii.md,
    backgroundColor: 'rgba(58, 33, 95, 0.58)',
    padding: spacing.lg
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md
  },
  cardEyebrow: {
    color: colors.mutedViolet,
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    textTransform: 'uppercase'
  },
  phase: {
    color: colors.cosmicWhite,
    fontFamily: fonts.display,
    fontSize: 32,
    lineHeight: 38
  },
  cardCopy: {
    color: colors.lavenderMist,
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 23
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm
  },
  metric: {
    minWidth: 145,
    flexGrow: 1,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: 'rgba(238, 232, 247, 0.12)',
    borderRadius: radii.sm,
    backgroundColor: 'rgba(19, 10, 33, 0.46)',
    padding: spacing.md
  },
  metricLabel: {
    color: colors.mutedViolet,
    fontFamily: fonts.body,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase'
  },
  metricValue: {
    color: colors.cosmicWhite,
    fontFamily: fonts.body,
    fontSize: 16,
    fontWeight: '800'
  },
  panel: {
    gap: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(238, 232, 247, 0.14)',
    borderRadius: radii.md,
    backgroundColor: 'rgba(24, 13, 42, 0.72)',
    padding: spacing.md
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md
  },
  panelTitle: {
    color: colors.cosmicWhite,
    fontFamily: fonts.body,
    fontSize: 17,
    fontWeight: '800'
  },
  panelMeta: {
    color: colors.signalGreen,
    fontFamily: fonts.body,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase'
  },
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
    backgroundColor: 'rgba(238, 232, 247, 0.08)'
  },
  energyFill: {
    borderTopLeftRadius: radii.sm,
    borderTopRightRadius: radii.sm,
    backgroundColor: colors.signalGreen
  },
  energyTime: {
    color: colors.lavenderMist,
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: '800'
  },
  energyLabel: {
    minHeight: 28,
    color: colors.mutedViolet,
    fontFamily: fonts.body,
    fontSize: 10,
    lineHeight: 13,
    textAlign: 'center'
  },
  timingList: {
    gap: spacing.sm
  },
  timingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(238, 232, 247, 0.12)',
    borderRadius: radii.sm,
    backgroundColor: 'rgba(58, 33, 95, 0.32)',
    padding: spacing.md
  },
  timingIcon: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.sm,
    backgroundColor: 'rgba(111, 175, 142, 0.18)'
  },
  timingText: {
    flex: 1,
    gap: 2
  },
  timingTitle: {
    color: colors.cosmicWhite,
    fontFamily: fonts.body,
    fontSize: 15,
    fontWeight: '800'
  },
  timingLabel: {
    color: colors.mutedViolet,
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase'
  },
  timingValue: {
    maxWidth: 148,
    color: colors.lavenderMist,
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'right'
  },
  mutedCopy: {
    color: colors.mutedViolet,
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
    color: colors.lavenderMist,
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase'
  },
  inputHint: {
    color: colors.mutedViolet,
    fontFamily: fonts.body,
    fontSize: 11
  },
  inputButton: {
    minHeight: 48,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(238, 232, 247, 0.14)',
    borderRadius: radii.sm,
    backgroundColor: 'rgba(19, 10, 33, 0.54)',
    color: colors.cosmicWhite,
    fontFamily: fonts.body,
    fontSize: 17,
    fontWeight: '800',
    paddingHorizontal: spacing.md
  },
  qualityRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs
  },
  qualityDot: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(238, 232, 247, 0.14)',
    borderRadius: radii.sm,
    backgroundColor: 'rgba(19, 10, 33, 0.54)'
  },
  qualityDotActive: {
    borderColor: colors.signalGreen,
    backgroundColor: 'rgba(111, 175, 142, 0.22)'
  },
  qualityText: {
    color: colors.cosmicWhite,
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: '800'
  },
  quickTimes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm
  },
  quickTime: {
    borderWidth: 1,
    borderColor: 'rgba(238, 232, 247, 0.14)',
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  quickTimeText: {
    color: colors.lavenderMist,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '800'
  },
  submitButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.sm,
    backgroundColor: colors.signalGreen,
    paddingHorizontal: spacing.lg
  },
  disabledButton: {
    opacity: 0.58
  },
  submitText: {
    color: colors.midnightPlum,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.1,
    textTransform: 'uppercase'
  },
  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(111, 175, 142, 0.26)',
    borderRadius: radii.md,
    backgroundColor: 'rgba(111, 175, 142, 0.1)',
    padding: spacing.md
  },
  noteText: {
    flex: 1,
    color: colors.lavenderMist,
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 20
  }
});
