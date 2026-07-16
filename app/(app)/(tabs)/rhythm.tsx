import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { TimeField, parse24Hour } from '../../../src/components/TimeField';
import {
  calculateSleepDuration,
  generateCircadianBriefing,
  getRecommendedActivityAt,
  type CircadianBriefing,
  type EnergyZoneLevel,
  type SleepNeedEstimate,
  type SleepSession,
  type TimeWindow
} from '../../../src/engines/circadian';
import { useAuth } from '../../../src/features/auth/AuthProvider';
import { protocolScope, useActiveProtocol } from '../../../src/features/dailyProtocol';
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

/** Format a 24-hour "HH:MM" value as a standard-time label like "10:30 PM". */
function formatClockLabel(value: string): string {
  const parsed = parse24Hour(value);
  if (!parsed) return value;
  return `${parsed.hour12}:${String(parsed.minute).padStart(2, '0')} ${parsed.meridiem}`;
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

// Vertical energy zones: green = high, amber = steady, red = low.
const ZONE_FILL: Record<EnergyZoneLevel, string> = {
  high: 'rgba(62, 158, 110, 0.18)',
  moderate: 'rgba(184, 145, 69, 0.16)',
  low: 'rgba(138, 75, 60, 0.15)'
};
const ZONE_SWATCH: Record<EnergyZoneLevel, string> = {
  high: '#3E9E6E',
  moderate: '#B89145',
  low: palette.clayDark
};
const ZONE_LEGEND: Array<{ level: EnergyZoneLevel; label: string }> = [
  { level: 'high', label: 'Energy high' },
  { level: 'moderate', label: 'Steady' },
  { level: 'low', label: 'Energy low' }
];

/**
 * The screen's signature: today's energy as a single drawn line over green /
 * amber / red energy zones, with peak/low markers, a "now" marker, and a
 * press-and-drag scrubber that reports the time and recommended activity.
 */
function EnergyCurve({ briefing, now }: { briefing: CircadianBriefing; now: string }) {
  const points = briefing.energy_curve;
  const [width, setWidth] = useState(0);
  const [scrubX, setScrubX] = useState<number | null>(null);
  const height = 172;
  const padTop = 16;
  const padBottom = 30;
  const plotHeight = height - padTop - padBottom;

  const yForEnergy = (energy: number) => padTop + (1 - Math.min(Math.max(energy, 0), 100) / 100) * plotHeight;

  const plotted = useMemo(() => {
    if (width === 0 || points.length < 2) return null;
    const t0 = new Date(points[0].time).getTime();
    const tN = new Date(points[points.length - 1].time).getTime();
    const span = Math.max(1, tN - t0);
    const xForTime = (iso: string) => ((new Date(iso).getTime() - t0) / span) * width;

    const coords = points.map((point, index) => ({
      x: (index / (points.length - 1)) * width,
      y: yForEnergy(point.estimated_energy),
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

    const zones = briefing.energy_zones.map((zone) => ({
      x: xForTime(zone.start_at),
      w: Math.max(0, xForTime(zone.end_at) - xForTime(zone.start_at)),
      level: zone.level
    }));
    const extrema = briefing.energy_extrema.map((extreme) => ({
      x: xForTime(extreme.time),
      y: yForEnergy(extreme.energy),
      type: extreme.type,
      text: `${extreme.type === 'peak' ? 'Energy peak' : 'Energy low'} · ${formatTime(extreme.time)}`
    }));

    return { coords, line, area, nowPoint: coords[nowIndex], labels, zones, extrema, t0, span };
  }, [briefing.energy_extrema, briefing.energy_zones, height, now, padBottom, padTop, plotHeight, points, width]);

  const scrub = useMemo(() => {
    if (!plotted || scrubX === null || width === 0) return null;
    const clampedX = Math.max(0, Math.min(width, scrubX));
    const timeIso = new Date(plotted.t0 + (clampedX / width) * plotted.span).toISOString();
    const recommendation = getRecommendedActivityAt(briefing, timeIso);
    return {
      x: clampedX,
      y: yForEnergy(recommendation.energy),
      time: formatTime(timeIso),
      recommendation
    };
  }, [briefing, plotted, scrubX, width]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={styles.curveShell}>
      <View
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
        onResponderGrant={(event) => setScrubX(event.nativeEvent.locationX)}
        onResponderMove={(event) => setScrubX(event.nativeEvent.locationX)}
        onResponderRelease={() => setScrubX(null)}
        onResponderTerminate={() => setScrubX(null)}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
      >
        {plotted ? (
          <>
            {scrub ? (
              <View
                pointerEvents="none"
                style={[
                  styles.scrubCallout,
                  { left: Math.max(0, Math.min(width - 148, scrub.x - 74)) }
                ]}
              >
                <Text style={styles.scrubTime}>{scrub.time}</Text>
                <Text style={styles.scrubActivity}>{scrub.recommendation.label}</Text>
                <Text style={styles.scrubEnergy}>{scrub.recommendation.energy}% energy</Text>
              </View>
            ) : null}
            <Svg height={height} width={width}>
              <Defs>
                <LinearGradient id="energy-fade" x1="0" x2="0" y1="0" y2="1">
                  <Stop offset="0" stopColor={palette.forest} stopOpacity={0.16} />
                  <Stop offset="1" stopColor={palette.forest} stopOpacity={0} />
                </LinearGradient>
              </Defs>
              {plotted.zones.map((zone, index) => (
                <Rect
                  key={`zone-${index}`}
                  fill={ZONE_FILL[zone.level]}
                  height={plotHeight + padTop}
                  width={zone.w}
                  x={zone.x}
                  y={0}
                />
              ))}
              <Line
                stroke={palette.hairlineSoft}
                strokeWidth={1}
                x1={0}
                x2={width}
                y1={height - padBottom}
                y2={height - padBottom}
              />
              <Path d={plotted.area} fill="url(#energy-fade)" />
              <Path d={plotted.line} fill="none" stroke={palette.forestMid} strokeLinecap="round" strokeWidth={1.8} />
              {plotted.extrema.map((extreme, index) => (
                <Circle
                  key={`extreme-${index}`}
                  cx={extreme.x}
                  cy={extreme.y}
                  fill={extreme.type === 'peak' ? ZONE_SWATCH.high : ZONE_SWATCH.low}
                  r={3.5}
                  stroke={palette.paper}
                  strokeWidth={1.5}
                />
              ))}
              {scrub ? (
                <>
                  <Line
                    stroke={palette.forest}
                    strokeLinecap="round"
                    strokeWidth={1.4}
                    x1={scrub.x}
                    x2={scrub.x}
                    y1={padTop - 4}
                    y2={height - padBottom}
                  />
                  <Circle cx={scrub.x} cy={scrub.y} fill={palette.forest} r={4} stroke={palette.paper} strokeWidth={1.5} />
                </>
              ) : (
                <>
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
                </>
              )}
            </Svg>
            <View style={styles.curveLabels}>
              {plotted.labels.map((label) => (
                <Text key={`${label.x}`} style={styles.curveLabelText}>
                  {label.text}
                </Text>
              ))}
            </View>
            {plotted.extrema.length > 0 ? (
              <View style={styles.extremaRow}>
                {plotted.extrema.map((extreme, index) => (
                  <Text key={`extreme-label-${index}`} style={styles.extremaText}>
                    {extreme.text}
                  </Text>
                ))}
              </View>
            ) : null}
          </>
        ) : (
          <View style={{ height }} />
        )}
      </View>
      <View style={styles.legendRow}>
        {ZONE_LEGEND.map((item) => (
          <View key={item.level} style={styles.legendItem}>
            <View style={[styles.legendSwatch, { backgroundColor: ZONE_SWATCH[item.level] }]} />
            <Text style={styles.legendText}>{item.label}</Text>
          </View>
        ))}
        <Text style={styles.legendHint}>Press &amp; drag the graph</Text>
      </View>
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
  const protocolScopeValue = useMemo(() => protocolScope(user?.id), [user?.id]);
  const activeProtocol = useActiveProtocol(protocolScopeValue, today);
  const protocolHasRhythmActions = Boolean(
    activeProtocol?.actions.some((action) => action.kind === 'wind_down' || action.kind === 'caffeine_cutoff')
  );
  const [sleepSessions, setSleepSessions] = useState<SleepSession[]>(() => createDemoSleepSessions(today));
  const [sleepNeed, setSleepNeed] = useState<SleepNeedEstimate>(() => createDefaultSleepNeedEstimate(now));
  const [dataMode, setDataMode] = useState<RhythmDataMode>('demo');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [sleepStartTime, setSleepStartTime] = useState('22:45');
  const [wakeTime, setWakeTime] = useState('06:45');
  const [sleepQuality, setSleepQuality] = useState('4');
  const [inputsTouched, setInputsTouched] = useState(false);

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

  // Live preview: once the user edits the manual inputs, reflect them in the
  // graph + timing immediately (if valid) so quality/times recalculate the rhythm.
  const previewSession = useMemo(() => {
    if (!inputsTouched) return null;
    if (!isValidTimeInput(sleepStartTime) || !isValidTimeInput(wakeTime)) return null;
    const qualityNumber = sleepQuality ? Number(sleepQuality) : null;
    const boundedQuality =
      qualityNumber !== null && Number.isFinite(qualityNumber)
        ? Math.max(1, Math.min(5, Math.round(qualityNumber)))
        : null;
    return createManualSleepSession({
      date: today,
      sleepStartTime,
      wakeTime,
      sleepQuality: boundedQuality,
      createdAt: new Date().toISOString()
    });
  }, [inputsTouched, sleepQuality, sleepStartTime, today, wakeTime]);

  const briefingSessions = useMemo(
    () => (previewSession ? [previewSession, ...sleepSessions.filter((session) => session.date !== today)] : sleepSessions),
    [previewSession, sleepSessions, today]
  );

  const briefing: CircadianBriefing = useMemo(
    () =>
      generateCircadianBriefing({
        date: today,
        timezone: 'UTC',
        recentSleepSessions: briefingSessions,
        sleepNeed,
        preferredBedtime: '22:30',
        now
      }),
    [briefingSessions, now, sleepNeed, today]
  );

  const latestSession = briefingSessions[0];
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
      Alert.alert('Check sleep window', 'Enter a valid sleep and wake time.');
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
          <EnergyCurve briefing={briefing} now={now} />
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
            <Text style={styles.panelHint}>{protocolHasRhythmActions ? 'In today’s protocol' : 'Timing only'}</Text>
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
            <TimeField
              accessibilityLabel="Sleep start time"
              label="Sleep start"
              onChange={(value) => {
                setInputsTouched(true);
                setSleepStartTime(value);
              }}
              value={sleepStartTime}
            />
            <TimeField
              accessibilityLabel="Wake time"
              label="Wake time"
              onChange={(value) => {
                setInputsTouched(true);
                setWakeTime(value);
              }}
              value={wakeTime}
            />
          </View>
          <View style={styles.inputShell}>
            <Text style={styles.inputLabel}>Quality</Text>
            <View style={styles.qualityRow}>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setInputsTouched(true);
                  setSleepQuality('');
                }}
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
                  onPress={() => {
                    setInputsTouched(true);
                    setSleepQuality(String(value));
                  }}
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
                  setInputsTouched(true);
                  setSleepStartTime(start);
                  setWakeTime(wake);
                }}
                style={styles.quickTime}
              >
                <Text style={styles.quickTimeText}>{formatClockLabel(start)} – {formatClockLabel(wake)}</Text>
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
    marginTop: 18,
    position: 'relative'
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
  scrubCallout: {
    backgroundColor: colors.surface,
    borderColor: colors.hairline,
    borderRadius: 12,
    borderWidth: hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 8,
    position: 'absolute',
    top: 0,
    width: 148,
    zIndex: 5
  },
  scrubTime: {
    ...type.number,
    color: colors.text,
    fontSize: 14
  },
  scrubActivity: {
    ...type.label,
    color: colors.accent,
    marginTop: 2
  },
  scrubEnergy: {
    ...type.caption,
    color: colors.textFaint,
    marginTop: 1
  },
  extremaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 8
  },
  extremaText: {
    ...type.caption,
    color: colors.textMuted,
    fontVariant: ['tabular-nums']
  },
  legendRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 12
  },
  legendItem: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6
  },
  legendSwatch: {
    borderRadius: 3,
    height: 9,
    width: 9
  },
  legendText: {
    ...type.caption,
    color: colors.textMuted
  },
  legendHint: {
    ...type.caption,
    color: colors.textFaint,
    marginLeft: 'auto'
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