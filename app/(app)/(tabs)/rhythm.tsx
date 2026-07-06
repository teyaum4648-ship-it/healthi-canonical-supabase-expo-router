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
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg';

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
import { colors, hairlineWidth, palette, spacing, type } from '../../../src/styles/theme';

// ─── Utilities ───────────────────────────────────────────────────────────────

const isUuid = (value: string | undefined): value is string =>
  Boolean(value?.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i));

type RhythmDataMode = 'manual' | 'persisted' | 'demo';

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

/** Catmull-Rom → cubic bezier. Blocky bar charts read as templates; a drawn curve reads as an instrument. */
function buildCurvePath(points: Array<{ x: number; y: number }>): string {
  if (points.length < 2) return '';
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/**
 * The screen's signature: today's energy as a single drawn line, with a
 * luminous marker sitting exactly where you are in the day right now.
 */
function EnergyCurve({ points, now }: { points: CircadianEnergyPoint[]; now: string }) {
  const [width, setWidth] = useState(0);
  const height = 132;
  const padTop = 14;
  const padBottom = 30;
  const plotHeight = height - padTop - padBottom;

  const plotted = useMemo(() => {
    if (width === 0 || points.length < 2) return null;
    const coords = points.map((point, index) => ({
      x: (index / (points.length - 1)) * width,
      y: padTop + (1 - Math.min(Math.max(point.estimated_energy, 0), 100) / 100) * plotHeight,
      time: point.time
    }));

    const nowMs = new Date(now).getTime();
    let nowIndex = 0;
    let bestDistance = Number.POSITIVE_INFINITY;
    coords.forEach((coord, index) => {
      const distance = Math.abs(new Date(coord.time).getTime() - nowMs);
      if (distance < bestDistance) {
        bestDistance = distance;
        nowIndex = index;
      }
    });

    const line = buildCurvePath(coords);
    const area = `${line} L ${coords[coords.length - 1].x} ${height - padBottom} L ${coords[0].x} ${height - padBottom} Z`;
    const labelStep = Math.max(1, Math.floor((points.length - 1) / 3));
    const labels = coords
      .filter((_, index) => index % labelStep === 0)
      .slice(0, 4)
      .map((coord) => ({ x: coord.x, text: formatTime(coord.time) }));

    return { coords, line, area, nowPoint: coords[nowIndex], labels };
  }, [height, now, padBottom, padTop, plotHeight, points, width]);

  return (
    <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)} style={styles.curveShell}>
      {plotted ? (
        <>
          <Svg height={height} width={width}>
            <Defs>
              <LinearGradient id="energy-fade" x1="0" x2="0" y1="0" y2="1">
                <Stop offset="0" stopColor={palette.forest} stopOpacity={0.20} />
                <Stop offset="1" stopColor={palette.forest} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Line
              stroke={palette.hairlineSoft}
              strokeWidth={1}
              x1={0}
              x2={width}
              y1={height - padBottom}
              y2={height - padBottom}
            />
            <Path d={plotted.area} fill="url(#energy-fade)" />
            <Path d={plotted.line} fill="none" stroke={palette.forestMid} strokeLinecap="round" strokeWidth={1.6} />
            <Line
              stroke={palette.hairline}
              strokeDasharray="1 4"
              strokeLinecap="round"
              strokeWidth={1}
              x1={plotted.nowPoint.x}
              x2={plotted.nowPoint.x}
              y1={padTop - 4}
              y2={height - padBottom}
            />
            <Circle cx={plotted.nowPoint.x} cy={plotted.nowPoint.y} fill={palette.forest} fillOpacity={0.16} r={8} />
            <Circle cx={plotted.nowPoint.x} cy={plotted.nowPoint.y} fill={palette.forest} r={3} />
          </Svg>
          <View style={styles.curveLabels}>
            {plotted.labels.map((label) => (
              <Text key={`${label.x}`} style={styles.curveLabelText}>
                {label.text}
              </Text>
            ))}
          </View>
        </>
      ) : (
        <View style={{ height }} />
      )}
    </View>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text numberOfLines={1} style={styles.metricValue}>
        {value}
      </Text>
    </View>
  );
}

function TimingRow({
  icon,
  title,
  label,
  value,
  isLast
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  label: string;
  value: string;
  isLast?: boolean;
}) {
  return (
    <View style={[styles.timingRow, isLast ? null : styles.timingRowDivider]}>
      <View style={styles.timingIcon}>
        <Ionicons color={colors.accent} name={icon} size={15} />
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
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <Text style={styles.eyebrow}>Sleep · Rhythm</Text>
          <Text style={styles.title}>Today's rhythm</Text>
        </View>

        {/* ── Hero: current phase + energy curve ─────────────────────────── */}
        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroEyebrow}>Current phase</Text>
              <Text style={styles.phase}>{phaseLabel(briefing.current_phase)}</Text>
            </View>
            {isLoading ? (
              <ActivityIndicator color={colors.accent} size="small" />
            ) : (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{sourceLabel}</Text>
              </View>
            )}
          </View>
          <EnergyCurve now={now} points={briefing.energy_curve} />
          <Text style={styles.leadText}>{rhythmLead}</Text>
          <Text style={styles.leadSubcopy}>
            {confidenceLabel}. {dataModeCopy}
          </Text>
        </View>

        {/* ── Metrics mosaic ─────────────────────────────────────────────── */}
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

        {/* ── Organize your day ──────────────────────────────────────────── */}
        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            <Text style={styles.panelTitle}>Organize your day</Text>
            <Text style={styles.panelHint}>Timing only</Text>
          </View>
          <View>
            <TimingRow
              icon="sparkles-outline"
              label="Best window"
              title="Deep work"
              value={formatWindow(briefing.rhythm_plan.deep_work_windows[0])}
            />
            <TimingRow
              icon="flash-outline"
              label="Suggested window"
              title="Exercise"
              value={formatWindow(briefing.rhythm_plan.best_exercise_windows[0])}
            />
            <TimingRow
              icon="walk-outline"
              label="Suggested window"
              title="Walk / light movement"
              value={formatWindow(briefing.rhythm_plan.best_walk_windows[0])}
            />
            <TimingRow
              icon="leaf-outline"
              label="Suggested window"
              title="Breathing / reset"
              value={formatWindow(briefing.rhythm_plan.breathing_windows[0])}
            />
            {briefing.rhythm_plan.nap_windows[0] ? (
              <TimingRow
                icon="moon-outline"
                label="Possible window"
                title="Short nap"
                value={formatWindow(briefing.rhythm_plan.nap_windows[0])}
              />
            ) : null}
            <TimingRow
              icon="cafe-outline"
              label="Estimated from bedtime"
              title="Caffeine cutoff"
              value={formatTime(briefing.rhythm_plan.caffeine_cutoff)}
            />
            <TimingRow
              icon="cloudy-night-outline"
              isLast
              label="Suggested start"
              title="Wind-down"
              value={formatTime(briefing.rhythm_plan.wind_down_start)}
            />
          </View>
        </View>

        {/* ── Manual sleep window ────────────────────────────────────────── */}
        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            <Text style={styles.panelTitle}>Manual sleep window</Text>
            <Text style={styles.panelHint}>Optional</Text>
          </View>
          <Text style={styles.mutedCopy}>
            Add last night's sleep and wake time to regenerate today's rhythm estimate.
          </Text>
          <View style={styles.inputGrid}>
            <View style={styles.inputShell}>
              <Text style={styles.inputLabel}>Sleep start</Text>
              <TextInput
                accessibilityLabel="Sleep start time"
                autoCapitalize="none"
                keyboardType="numbers-and-punctuation"
                maxLength={5}
                onChangeText={setSleepStartTime}
                placeholder="22:45"
                placeholderTextColor={colors.textFaint}
                style={styles.inputField}
                value={sleepStartTime}
              />
            </View>
            <View style={styles.inputShell}>
              <Text style={styles.inputLabel}>Wake time</Text>
              <TextInput
                accessibilityLabel="Wake time"
                autoCapitalize="none"
                keyboardType="numbers-and-punctuation"
                maxLength={5}
                onChangeText={setWakeTime}
                placeholder="06:45"
                placeholderTextColor={colors.textFaint}
                style={styles.inputField}
                value={wakeTime}
              />
            </View>
          </View>
          <View style={styles.inputShell}>
            <Text style={styles.inputLabel}>Quality</Text>
            <View style={styles.qualityRow}>
              <Pressable
                accessibilityRole="button"
                onPress={() => setSleepQuality('')}
                style={[styles.qualityUnset, sleepQuality === '' ? styles.qualityItemActive : null]}
              >
                <Text style={[styles.qualityText, sleepQuality === '' ? styles.qualityTextActive : null]}>
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
            style={({ pressed }) => [
              styles.submitButton,
              isSaving ? styles.disabledButton : null,
              pressed ? styles.pressedButton : null
            ]}
          >
            {isSaving
              ? <ActivityIndicator color={colors.textInverse} size="small" />
              : <Text style={styles.submitText}>Update rhythm estimate</Text>
            }
          </Pressable>
        </View>

        {/* ── Footer note ────────────────────────────────────────────────── */}
        <View style={styles.note}>
          <Ionicons color={colors.textFaint} name="information-circle-outline" size={14} />
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
    paddingBottom: 96
  },

  // ── Header
  header: {
    paddingHorizontal: 26,
    paddingTop: 22
  },
  eyebrow: {
    ...type.eyebrow,
    color: colors.textFaint
  },
  title: {
    ...type.title,
    color: colors.text,
    marginTop: 7
  },

  // ── Hero
  hero: {
    paddingHorizontal: 26,
    paddingTop: 26
  },
  heroTop: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between'
  },
  heroEyebrow: {
    ...type.eyebrow,
    color: colors.textFaint
  },
  phase: {
    ...type.hero,
    color: colors.text,
    fontSize: 36,
    letterSpacing: -1.2,
    lineHeight: 42,
    marginTop: 8
  },
  badge: {
    borderColor: colors.hairline,
    borderRadius: 999,
    borderWidth: hairlineWidth,
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  badgeText: {
    ...type.eyebrow,
    color: colors.textMuted,
    letterSpacing: 1.2
  },
  curveShell: {
    marginTop: 18
  },
  curveLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6
  },
  curveLabelText: {
    ...type.caption,
    color: colors.textFaint,
    fontVariant: ['tabular-nums']
  },
  leadText: {
    ...type.voice,
    color: colors.accent,
    marginTop: 18
  },
  leadSubcopy: {
    ...type.caption,
    color: colors.textMuted,
    marginBottom: 24,
    marginTop: 6
  },

  // ── Metrics mosaic — hairline grid, flush cells
  metricsGrid: {
    backgroundColor: colors.hairlineSoft,
    borderBottomColor: colors.hairlineSoft,
    borderBottomWidth: hairlineWidth,
    borderTopColor: colors.hairlineSoft,
    borderTopWidth: hairlineWidth,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: hairlineWidth
  },
  metric: {
    backgroundColor: colors.surface,
    flexGrow: 1,
    gap: 6,
    minWidth: '46%',
    paddingHorizontal: 26,
    paddingVertical: 15
  },
  metricLabel: {
    ...type.eyebrow,
    color: colors.textFaint
  },
  metricValue: {
    ...type.number,
    color: colors.text,
    fontSize: 16,
    lineHeight: 21
  },

  // ── Panels
  panel: {
    paddingHorizontal: 26,
    paddingTop: 24
  },
  panelHeader: {
    alignItems: 'baseline',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4
  },
  panelTitle: {
    ...type.label,
    color: colors.text
  },
  panelHint: {
    ...type.eyebrow,
    color: colors.textFaint,
    letterSpacing: 1.2
  },

  // ── Timing rows
  timingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: 13
  },
  timingRowDivider: {
    borderBottomColor: colors.hairlineSoft,
    borderBottomWidth: hairlineWidth
  },
  timingIcon: {
    alignItems: 'center',
    backgroundColor: colors.accentWash,
    borderRadius: 999,
    height: 30,
    justifyContent: 'center',
    width: 30
  },
  timingText: {
    flex: 1,
    gap: 2
  },
  timingTitle: {
    ...type.label,
    color: colors.text
  },
  timingLabel: {
    ...type.caption,
    color: colors.textFaint
  },
  timingValue: {
    ...type.number,
    color: colors.text,
    fontSize: 14,
    lineHeight: 19,
    textAlign: 'right'
  },

  // ── Manual input
  mutedCopy: {
    ...type.caption,
    color: colors.textMuted,
    marginBottom: 16,
    marginTop: 8
  },
  inputGrid: {
    flexDirection: 'row',
    gap: spacing.sm
  },
  inputShell: {
    flex: 1,
    gap: 8,
    marginBottom: 14
  },
  inputLabel: {
    ...type.eyebrow,
    color: colors.textFaint
  },
  inputField: {
    backgroundColor: colors.surfaceInset,
    borderColor: colors.hairline,
    borderRadius: 12,
    borderWidth: hairlineWidth,
    color: colors.text,
    fontSize: 16,
    fontVariant: ['tabular-nums'],
    fontWeight: '400',
    minHeight: 48,
    paddingHorizontal: 14
  },
  qualityRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6
  },
  qualityUnset: {
    alignItems: 'center',
    borderColor: colors.hairline,
    borderRadius: 10,
    borderWidth: hairlineWidth,
    height: 40,
    justifyContent: 'center',
    paddingHorizontal: 12
  },
  qualityDot: {
    alignItems: 'center',
    borderColor: colors.hairline,
    borderRadius: 10,
    borderWidth: hairlineWidth,
    height: 40,
    justifyContent: 'center',
    width: 40
  },
  qualityItemActive: {
    backgroundColor: colors.accentWash,
    borderColor: colors.accent
  },
  qualityText: {
    ...type.caption,
    color: colors.textMuted,
    fontVariant: ['tabular-nums']
  },
  qualityTextActive: {
    color: colors.accent
  },
  quickTimes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: 18
  },
  quickTime: {
    borderColor: colors.hairline,
    borderRadius: 999,
    borderWidth: hairlineWidth,
    paddingHorizontal: 13,
    paddingVertical: 8
  },
  quickTimeText: {
    ...type.caption,
    color: colors.textMuted,
    fontVariant: ['tabular-nums']
  },
  submitButton: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: 14,
    justifyContent: 'center',
    minHeight: 52
  },
  pressedButton: {
    opacity: 0.85
  },
  disabledButton: {
    opacity: 0.55
  },
  submitText: {
    ...type.label,
    color: colors.textInverse
  },

  // ── Footer note
  note: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: 26,
    paddingTop: 26
  },
  noteText: {
    ...type.caption,
    color: colors.textFaint,
    flex: 1
  }
});