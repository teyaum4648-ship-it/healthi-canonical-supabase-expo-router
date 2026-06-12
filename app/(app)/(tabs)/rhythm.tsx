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

// Design tokens
const C = {
  bg: '#050506',
  surface: '#0D0E10',
  surfaceRaised: '#15171A',
  border: '#24272D',
  borderGlow: 'rgba(218, 223, 232, 0.24)',
  silver: '#D8DEE8',
  silverGlow: 'rgba(216, 222, 232, 0.16)',
  platinum: '#F2F4F7',
  platinumGlow: 'rgba(242, 244, 247, 0.12)',
  graphite: '#A5ACB8',
  text: '#EEF1F5',
  textSub: '#A7ADB8',
  textMuted: '#69717E',
  white: '#FFFFFF'
};

const R = { xs: 6, sm: 10, md: 14, lg: 20, xl: 28 };

// Helpers
const isUuid = (value: string | undefined): value is string =>
  Boolean(value?.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i));

type RhythmDataMode = 'manual' | 'persisted' | 'demo';

function formatTime(value: string | null | undefined): string {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  const hours = date.getUTCHours();
  const minutes = date.getUTCMinutes();
  const hour12 = hours % 12 || 12;
  const suffix = hours >= 12 ? 'PM' : 'AM';
  return `${hour12}:${String(minutes).padStart(2, '0')} ${suffix}`;
}

function formatDuration(minutes: number | null): string {
  if (minutes === null) return 'N/A';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
}

function formatDebt(minutes: number | null): string {
  if (minutes === null) return 'Calibrating';
  if (minutes === 0) return 'No debt';
  return formatDuration(minutes);
}

function formatWindow(window: TimeWindow | undefined): string {
  if (!window) return 'N/A';
  return `${formatTime(window.start_at)} - ${formatTime(window.end_at)}`;
}

function phaseTitle(label: string): string {
  return label.split('_').map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
}

function phaseLabel(label: string): string {
  const labels: Record<string, string> = {
    wake_grogginess: 'Wake Ramp',
    rising: 'Rising Energy',
    morning_peak: 'Morning Peak',
    afternoon_dip: 'Recovery Dip',
    second_peak: 'Second Peak',
    wind_down: 'Wind-Down',
    sleep_window: 'Sleep Window',
    unknown: 'Calibrating'
  };
  return labels[label] ?? phaseTitle(label);
}

function getRhythmLead(briefing: CircadianBriefing): string {
  const deepWorkWindow = briefing.rhythm_plan.deep_work_windows[0];
  if (!deepWorkWindow) return "Rhythm estimate is still calibrating.";
  return `Deep focus peaks around ${formatWindow(deepWorkWindow)}.`;
}

function getLatestSleepDuration(session: SleepSession | undefined): number | null {
  if (!session) return null;
  if (typeof session.duration_minutes === 'number') return session.duration_minutes;
  return calculateSleepDuration(session.sleep_start_at, session.sleep_end_at);
}

function getEnergyColor(energy: number): string {
  if (energy >= 70) return C.platinum;
  if (energy >= 40) return C.silver;
  return C.textMuted;
}

// Sub-components

function EnergyCurvePreview({ points }: { points: CircadianEnergyPoint[] }) {
  const sampledPoints = points.filter((_p, i) => i % 3 === 0).slice(0, 6);
  const visible = sampledPoints.length > 0 ? sampledPoints : points.slice(0, 5);
  const max = Math.max(...visible.map((p) => p.estimated_energy), 1);

  return (
    <View style={ec.root}>
      {visible.map((point) => {
        const pct = Math.max((point.estimated_energy / max) * 100, 8);
        const color = getEnergyColor(point.estimated_energy);
        return (
          <View key={point.time} style={ec.col}>
            <View style={ec.track}>
              <View style={[ec.fill, { height: `${pct}%`, backgroundColor: color }]} />
            </View>
            <Text style={ec.time}>{formatTime(point.time)}</Text>
            <Text style={ec.label}>{phaseLabel(point.label)}</Text>
          </View>
        );
      })}
    </View>
  );
}

const ec = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    minHeight: 160
  },
  col: { flex: 1, alignItems: 'center', gap: 6 },
  track: {
    width: '100%',
    height: 96,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    borderRadius: 6,
    backgroundColor: '#161B28'
  },
  fill: {
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    opacity: 0.85
  },
  time: {
    color: C.text,
    fontFamily: fonts.body,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3
  },
  label: {
    minHeight: 26,
    color: C.textMuted,
    fontFamily: fonts.body,
    fontSize: 9,
    lineHeight: 13,
    textAlign: 'center'
  }
});

function StatPill({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <View style={[sp.root, accent && sp.accented]}>
      <Text style={sp.label}>{label}</Text>
      <Text style={[sp.value, accent && sp.accentValue]}>{value}</Text>
    </View>
  );
}

const sp = StyleSheet.create({
  root: {
    flex: 1,
    minWidth: 130,
    padding: 14,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
    gap: 5
  },
  accented: {
    borderColor: C.borderGlow,
    backgroundColor: C.surfaceRaised
  },
  label: {
    color: C.textMuted,
    fontFamily: fonts.body,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.3,
    textTransform: 'uppercase'
  },
  value: {
    color: C.text,
    fontFamily: fonts.body,
    fontSize: 15,
    fontWeight: '700'
  },
  accentValue: {
    color: C.silver
  }
});

function TimingRow({
  icon,
  title,
  subtitle,
  value,
  isLast
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  value: string;
  isLast?: boolean;
}) {
  return (
    <View style={[tr.root, !isLast && tr.withBorder]}>
      <View style={tr.iconWrap}>
        <Ionicons color={C.silver} name={icon} size={16} />
      </View>
      <View style={tr.body}>
        <Text style={tr.title}>{title}</Text>
        <Text style={tr.sub}>{subtitle}</Text>
      </View>
      <Text style={tr.value}>{value}</Text>
    </View>
  );
}

const tr = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13
  },
  withBorder: {
    borderBottomWidth: 1,
    borderBottomColor: C.border
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.silverGlow
  },
  body: { flex: 1, gap: 2 },
  title: {
    color: C.text,
    fontFamily: fonts.body,
    fontSize: 14,
    fontWeight: '600'
  },
  sub: {
    color: C.textMuted,
    fontFamily: fonts.body,
    fontSize: 11,
    letterSpacing: 0.2
  },
  value: {
    color: C.silver,
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'right',
    maxWidth: 120
  }
});

function SectionHeader({ label, tag }: { label: string; tag?: string }) {
  return (
    <View style={sh.root}>
      <Text style={sh.label}>{label}</Text>
      {tag ? <View style={sh.tagWrap}><Text style={sh.tag}>{tag}</Text></View> : null}
    </View>
  );
}

const sh = StyleSheet.create({
  root: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  label: {
    color: C.text,
    fontFamily: fonts.body,
    fontSize: 16,
    fontWeight: '700'
  },
  tagWrap: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface
  },
  tag: {
    color: C.textMuted,
    fontFamily: fonts.body,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.1,
    textTransform: 'uppercase'
  }
});

// Main screen

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
            ? { minutes: activeNeed.minutes, confidence: activeNeed.confidence, basis: activeNeed.basis, updated_at: activeNeed.updated_at }
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
    () => generateCircadianBriefing({
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

  const dataModeNote =
    dataMode === 'demo'
      ? 'Running on demo data. Log last night to personalize your curve.'
      : dataMode === 'manual'
        ? 'Showing your manually logged sleep.'
        : 'Synced from your saved sleep data.';

  async function handleManualSubmit() {
    const qualityNumber = sleepQuality ? Number(sleepQuality) : null;
    const boundedQuality =
      qualityNumber !== null && Number.isFinite(qualityNumber)
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
      setSleepSessions((curr) => [manualSession, ...curr.filter((s) => s.date !== today)]);
      setDataMode('manual');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to save this sleep window right now.';
      Alert.alert('Sleep window not saved', message);
      setSleepSessions((curr) => [manualSession, ...curr.filter((s) => s.date !== today)]);
      setDataMode('manual');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={s.header}>
          <Text style={s.eyebrow}>Sleep + Rhythm</Text>
          <Text style={s.title}>Today's Rhythm</Text>
          <Text style={s.subtitle}>
            Energy windows estimated from your sleep pattern.
          </Text>
        </View>

        {/* Hero card */}
        <View style={s.heroCard}>
          {/* Phase + badge row */}
          <View style={s.heroTop}>
            <View style={s.heroLeft}>
              <Text style={s.heroEyebrow}>Current phase</Text>
              <Text style={s.heroPhase}>{phaseLabel(briefing.current_phase)}</Text>
            </View>
            <View style={s.heroBadgeStack}>
              <View style={[s.badge, s.badgeSilver]}>
                <View style={s.badgeDot} />
                <Text style={s.badgeText}>{sourceLabel}</Text>
              </View>
              {isLoading ? <ActivityIndicator color={C.silver} size="small" /> : null}
            </View>
          </View>

          {/* Lead signal */}
          <View style={s.leadBox}>
            <Text style={s.leadEyebrow}>Strongest signal today</Text>
            <Text style={s.leadText}>{rhythmLead}</Text>
            <Text style={s.leadSub}>{confidenceLabel} · {dataModeNote}</Text>
          </View>

          {/* Metrics grid */}
          <View style={s.statsGrid}>
            <StatPill label="Sleep" value={`${formatTime(latestSession?.sleep_start_at)} - ${formatTime(latestSession?.sleep_end_at)}`} />
            <StatPill label="Duration" value={formatDuration(sleepDuration)} />
            <StatPill label="7-day debt" value={formatDebt(briefing.sleep_debt_7_day.total_sleep_debt_minutes)} accent />
            <StatPill label="Target bedtime" value={formatTime(briefing.target_bedtime)} accent />
          </View>
        </View>

        {/* Energy curve */}
        <View style={s.card}>
          <SectionHeader label="Energy curve" tag="Estimated" />
          <EnergyCurvePreview points={briefing.energy_curve} />
        </View>

        {/* Day plan */}
        <View style={s.card}>
          <SectionHeader label="Organise your day" tag="Timing only" />
          <View>
            <TimingRow
              icon="sparkles-outline"
              title="Deep focus"
              subtitle="Best window"
              value={formatWindow(briefing.rhythm_plan.deep_work_windows[0])}
            />
            <TimingRow
              icon="flash-outline"
              title="Exercise"
              subtitle="Suggested window"
              value={formatWindow(briefing.rhythm_plan.best_exercise_windows[0])}
            />
            <TimingRow
              icon="walk-outline"
              title="Light movement"
              subtitle="Walk or stretch"
              value={formatWindow(briefing.rhythm_plan.best_walk_windows[0])}
            />
            <TimingRow
              icon="leaf-outline"
              title="Breathing reset"
              subtitle="Suggested window"
              value={formatWindow(briefing.rhythm_plan.breathing_windows[0])}
            />
            {briefing.rhythm_plan.nap_windows[0] ? (
              <TimingRow
                icon="moon-outline"
                title="Short nap"
                subtitle="Possible window"
                value={formatWindow(briefing.rhythm_plan.nap_windows[0])}
              />
            ) : null}
            <TimingRow
              icon="cafe-outline"
              title="Caffeine cutoff"
              subtitle="Based on target bedtime"
              value={formatTime(briefing.rhythm_plan.caffeine_cutoff)}
            />
            <TimingRow
              icon="cloudy-night-outline"
              title="Wind-down"
              subtitle="Start here"
              value={formatTime(briefing.rhythm_plan.wind_down_start)}
              isLast
            />
          </View>
        </View>

        {/* Log sleep */}
        <View style={s.card}>
          <SectionHeader label="Log sleep" tag="Optional" />
          <Text style={s.inputDesc}>
            Enter last night's times to update your rhythm estimate.
          </Text>

          {/* Time inputs */}
          <View style={s.timeRow}>
            <View style={s.timeField}>
              <Text style={s.inputLabel}>Fell asleep</Text>
              <TextInput
                accessibilityLabel="Sleep start time"
                autoCapitalize="none"
                keyboardType="numbers-and-punctuation"
                maxLength={5}
                onChangeText={setSleepStartTime}
                placeholder="22:45"
                placeholderTextColor={C.textMuted}
                style={s.timeInput}
                value={sleepStartTime}
              />
            </View>
            <View style={s.timeDivider}>
              <Text style={s.timeDividerText}>to</Text>
            </View>
            <View style={s.timeField}>
              <Text style={s.inputLabel}>Woke up</Text>
              <TextInput
                accessibilityLabel="Wake time"
                autoCapitalize="none"
                keyboardType="numbers-and-punctuation"
                maxLength={5}
                onChangeText={setWakeTime}
                placeholder="06:45"
                placeholderTextColor={C.textMuted}
                style={s.timeInput}
                value={wakeTime}
              />
            </View>
          </View>

          {/* Quick-fill presets */}
          <View style={s.presetRow}>
            {[['22:30', '06:30'], ['23:15', '07:00'], ['00:00', '07:15']].map(([start, wake]) => (
              <Pressable
                key={`${start}-${wake}`}
                accessibilityRole="button"
                onPress={() => { setSleepStartTime(start); setWakeTime(wake); }}
                style={s.preset}
              >
                <Text style={s.presetText}>{start} - {wake}</Text>
              </Pressable>
            ))}
          </View>

          {/* Quality */}
          <View style={s.qualityBlock}>
            <Text style={s.inputLabel}>Sleep quality <Text style={s.optional}>(optional)</Text></Text>
            <View style={s.qualityRow}>
              <Pressable
                accessibilityRole="button"
                onPress={() => setSleepQuality('')}
                style={[s.qualityChip, sleepQuality === '' && s.qualityChipActive]}
              >
                <Text style={[s.qualityChipText, sleepQuality === '' && s.qualityChipTextActive]}>Not sure</Text>
              </Pressable>
              {[1, 2, 3, 4, 5].map((v) => (
                <Pressable
                  key={v}
                  accessibilityRole="button"
                  onPress={() => setSleepQuality(String(v))}
                  style={[s.qualityChip, s.qualityNumChip, sleepQuality === String(v) && s.qualityChipActive]}
                >
                  <Text style={[s.qualityChipText, sleepQuality === String(v) && s.qualityChipTextActive]}>{v}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Submit */}
          <Pressable
            accessibilityRole="button"
            disabled={isSaving}
            onPress={handleManualSubmit}
            style={[s.submitBtn, isSaving && s.submitDisabled]}
          >
            {isSaving
              ? <ActivityIndicator color={C.bg} size="small" />
              : <Text style={s.submitText}>Update rhythm estimate</Text>
            }
          </Pressable>
        </View>

        {/* Footer note */}
        <View style={s.footNote}>
          <Ionicons color={C.textMuted} name="information-circle-outline" size={15} />
          <Text style={s.footNoteText}>
            Wellness estimate only. Accuracy improves with more logged nights. Wearable sync coming soon.
          </Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

// Styles

const s = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: C.bg
  },
  scroll: {
    padding: 20,
    paddingBottom: 48,
    gap: 14
  },

  // Header
  header: {
    gap: 6,
    paddingTop: 8,
    paddingBottom: 4
  },
  eyebrow: {
    color: C.silver,
    fontFamily: fonts.body,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2.2,
    textTransform: 'uppercase'
  },
  title: {
    color: C.text,
    fontFamily: fonts.display,
    fontSize: 34,
    fontWeight: '300',
    lineHeight: 40,
    letterSpacing: 0
  },
  subtitle: {
    color: C.textSub,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 21
  },

  // Hero card
  heroCard: {
    borderWidth: 1,
    borderColor: C.borderGlow,
    borderRadius: R.xl,
    backgroundColor: C.surface,
    padding: 20,
    gap: 18,
    shadowColor: C.silver,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 32
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12
  },
  heroLeft: { gap: 4 },
  heroEyebrow: {
    color: C.textMuted,
    fontFamily: fonts.body,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase'
  },
  heroPhase: {
    color: C.text,
    fontFamily: fonts.display,
    fontSize: 28,
    fontWeight: '300',
    lineHeight: 34,
    letterSpacing: 0
  },
  heroBadgeStack: {
    alignItems: 'flex-end',
    gap: 8
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 100,
    borderWidth: 1
  },
  badgeSilver: {
    borderColor: 'rgba(242, 244, 247, 0.28)',
    backgroundColor: C.platinumGlow
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.platinum
  },
  badgeText: {
    color: C.platinum,
    fontFamily: fonts.body,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase'
  },

  // Lead signal
  leadBox: {
    gap: 6,
    padding: 16,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: C.borderGlow,
    backgroundColor: C.surfaceRaised
  },
  leadEyebrow: {
    color: C.silver,
    fontFamily: fonts.body,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase'
  },
  leadText: {
    color: C.text,
    fontFamily: fonts.body,
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 24,
    letterSpacing: 0
  },
  leadSub: {
    color: C.textSub,
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 18
  },

  // Stats grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },

  // Generic card
  card: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: R.xl,
    backgroundColor: C.surface,
    padding: 20,
    gap: 16
  },

  // Log sleep
  inputDesc: {
    color: C.textSub,
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 20,
    marginTop: -4
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10
  },
  timeField: { flex: 1, gap: 6 },
  timeDivider: {
    paddingBottom: 12
  },
  timeDividerText: {
    color: C.textMuted,
    fontFamily: fonts.body,
    fontSize: 16
  },
  inputLabel: {
    color: C.textMuted,
    fontFamily: fonts.body,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.3,
    textTransform: 'uppercase'
  },
  optional: {
    color: C.textMuted,
    fontWeight: '400',
    textTransform: 'none',
    letterSpacing: 0,
    fontSize: 10
  },
  timeInput: {
    height: 48,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: R.sm,
    backgroundColor: C.surfaceRaised,
    color: C.text,
    fontFamily: fonts.body,
    fontSize: 18,
    fontWeight: '700',
    paddingHorizontal: 14,
    textAlign: 'center'
  },

  // Quick presets
  presetRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap'
  },
  preset: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surfaceRaised
  },
  presetText: {
    color: C.textSub,
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3
  },

  // Quality
  qualityBlock: { gap: 8 },
  qualityRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6
  },
  qualityChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surfaceRaised
  },
  qualityNumChip: {
    minWidth: 42,
    alignItems: 'center'
  },
  qualityChipActive: {
    borderColor: C.silver,
    backgroundColor: C.silverGlow
  },
  qualityChipText: {
    color: C.textSub,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '600'
  },
  qualityChipTextActive: {
    color: C.silver
  },

  // Submit
  submitBtn: {
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: R.md,
    backgroundColor: C.silver,
    marginTop: 2
  },
  submitDisabled: { opacity: 0.5 },
  submitText: {
    color: C.bg,
    fontFamily: fonts.body,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.4
  },

  // Footer
  footNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: 4,
    paddingTop: 4
  },
  footNoteText: {
    flex: 1,
    color: C.textMuted,
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 18
  }
});
