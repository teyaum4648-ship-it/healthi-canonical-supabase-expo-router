import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle
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
import { fonts } from '../../../src/styles/theme';

const isUuid = (value: string | undefined): value is string =>
  Boolean(value?.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i));

type RhythmDataMode = 'manual' | 'persisted' | 'demo';

interface SkyConfig {
  skyTop: string;
  skyBottom: string;
  bodyColor: string;
  bodyY: number;
  isMoon: boolean;
  starOpacity: number;
  accentColor: string;
  periodLabel: string;
  glowColor: string;
}

const stars = [
  { left: '12%', top: 38, size: 2 },
  { left: '22%', top: 78, size: 1.5 },
  { left: '35%', top: 28, size: 1.5 },
  { left: '48%', top: 62, size: 2 },
  { left: '66%', top: 42, size: 1.5 },
  { left: '84%', top: 72, size: 2 },
  { left: '74%', top: 24, size: 1.5 },
  { left: '8%', top: 116, size: 1.5 }
] as const;

function getSkyConfig(hour: number): SkyConfig {
  if (hour >= 5 && hour < 7) {
    const t = (hour - 5) / 2;
    return {
      skyTop: '#06070B',
      skyBottom: lerpHex('#0D0E10', '#24322C', t),
      bodyColor: lerpHex('#BFC6D2', '#F2F4F7', t),
      bodyY: lerp(0.82, 0.34, t),
      isMoon: false,
      starOpacity: lerp(0.6, 0.08, t),
      accentColor: '#D8DEE8',
      periodLabel: 'Dawn',
      glowColor: `rgba(216, 222, 232, ${0.1 + 0.18 * t})`
    };
  }

  if (hour >= 7 && hour < 15) {
    const t = Math.min(1, Math.max(0, (hour - 7) / 8));
    return {
      skyTop: lerpHex('#080A10', '#050506', t),
      skyBottom: lerpHex('#16211F', '#111418', t),
      bodyColor: '#F2F4F7',
      bodyY: lerp(0.24, 0.13, t),
      isMoon: false,
      starOpacity: 0.02,
      accentColor: '#E7EBF2',
      periodLabel: hour < 11 ? 'Morning' : 'Midday',
      glowColor: 'rgba(242, 244, 247, 0.18)'
    };
  }

  if (hour >= 15 && hour < 19) {
    const t = (hour - 15) / 4;
    return {
      skyTop: lerpHex('#050506', '#07080C', t),
      skyBottom: lerpHex('#111418', '#202522', t),
      bodyColor: lerpHex('#F2F4F7', '#CED5E0', t),
      bodyY: lerp(0.16, 0.68, t),
      isMoon: false,
      starOpacity: lerp(0.05, 0.45, t),
      accentColor: '#D8DEE8',
      periodLabel: 'Afternoon',
      glowColor: `rgba(216, 222, 232, ${0.16 + 0.08 * t})`
    };
  }

  if (hour >= 19 && hour < 21) {
    const t = (hour - 19) / 2;
    return {
      skyTop: lerpHex('#07080C', '#050506', t),
      skyBottom: lerpHex('#202522', '#0D0E10', t),
      bodyColor: lerpHex('#CED5E0', '#D8DEE8', t),
      bodyY: lerp(0.7, 0.5, t),
      isMoon: t > 0.5,
      starOpacity: lerp(0.45, 0.95, t),
      accentColor: '#D8DEE8',
      periodLabel: 'Dusk',
      glowColor: `rgba(216, 222, 232, ${0.14 + 0.08 * t})`
    };
  }

  return {
    skyTop: '#050506',
    skyBottom: '#0D0E10',
    bodyColor: '#D8DEE8',
    bodyY: hour >= 21 ? lerp(0.5, 0.2, (hour - 21) / 4) : lerp(0.2, 0.48, hour / 5),
    isMoon: true,
    starOpacity: 1,
    accentColor: '#D8DEE8',
    periodLabel: 'Night',
    glowColor: 'rgba(216, 222, 232, 0.16)'
  };
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}

function lerpHex(c1: string, c2: string, t: number): string {
  const p1 = parseHex(c1);
  const p2 = parseHex(c2);
  const r = Math.round(lerp(p1[0], p2[0], t));
  const g = Math.round(lerp(p1[1], p2[1], t));
  const b = Math.round(lerp(p1[2], p2[2], t));
  return `rgb(${r}, ${g}, ${b})`;
}

function parseHex(h: string): [number, number, number] {
  const hex = h.replace('#', '');
  return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
}

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
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
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
  return labels[label] ?? label.split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

function getRhythmLead(briefing: CircadianBriefing): string {
  const window = briefing.rhythm_plan.deep_work_windows[0];
  if (!window) return 'Rhythm estimate is still calibrating.';
  return `Deep focus peaks around ${formatWindow(window)}.`;
}

function getLatestSleepDuration(session: SleepSession | undefined): number | null {
  if (!session) return null;
  if (typeof session.duration_minutes === 'number') return session.duration_minutes;
  return calculateSleepDuration(session.sleep_start_at, session.sleep_end_at);
}

function CelestialHeader({
  skyConfig,
  localTime
}: {
  skyConfig: SkyConfig;
  localTime: string;
}) {
  const bodyTop = 28 + skyConfig.bodyY * 130;

  return (
    <View style={[cel.root, { backgroundColor: skyConfig.skyTop }]}>
      <View style={[cel.lowerSky, { backgroundColor: skyConfig.skyBottom }]} />
      <View style={[cel.horizonGlow, { backgroundColor: skyConfig.glowColor }]} />
      {stars.map((star, index) => (
        <View
          key={`${star.left}-${star.top}-${index}`}
          style={[
            cel.star,
            {
              left: star.left,
              opacity: skyConfig.starOpacity,
              top: star.top,
              height: star.size,
              width: star.size,
              borderRadius: star.size / 2
            }
          ]}
        />
      ))}
      <View
        style={[
          cel.bodyGlow,
          {
            backgroundColor: skyConfig.glowColor,
            top: bodyTop - 36
          }
        ]}
      />
      <View
        style={[
          cel.body,
          {
            backgroundColor: skyConfig.bodyColor,
            top: bodyTop
          }
        ]}
      >
        {skyConfig.isMoon ? <View style={[cel.moonCut, { backgroundColor: skyConfig.skyTop }]} /> : null}
      </View>
      <View style={cel.content}>
        <View style={cel.liveBadge}>
          <View style={[cel.liveDot, { backgroundColor: skyConfig.accentColor }]} />
          <Text style={cel.liveText}>{localTime} LOCAL</Text>
        </View>
        <Text style={[cel.eyebrow, { color: skyConfig.accentColor }]}>Sleep + Rhythm</Text>
        <Text style={cel.title}>Today's Rhythm</Text>
        <Text style={cel.subtitle}>Circadian estimate from your sleep pattern.</Text>
      </View>
    </View>
  );
}

const cel = StyleSheet.create({
  root: {
    height: 200,
    overflow: 'hidden',
    position: 'relative',
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22
  },
  lowerSky: {
    bottom: 0,
    height: 118,
    left: 0,
    opacity: 0.86,
    position: 'absolute',
    right: 0
  },
  horizonGlow: {
    bottom: -70,
    height: 140,
    left: '14%',
    opacity: 0.9,
    position: 'absolute',
    right: '14%',
    borderRadius: 100
  },
  star: {
    backgroundColor: '#F2F4F7',
    position: 'absolute'
  },
  bodyGlow: {
    height: 88,
    opacity: 0.92,
    position: 'absolute',
    right: '11%',
    width: 88,
    borderRadius: 44
  },
  body: {
    height: 28,
    overflow: 'hidden',
    position: 'absolute',
    right: '18%',
    width: 28,
    borderRadius: 14
  },
  moonCut: {
    height: 26,
    position: 'absolute',
    right: -6,
    top: -3,
    width: 26,
    borderRadius: 13
  },
  content: {
    bottom: 0,
    gap: 3,
    left: 0,
    padding: 18,
    position: 'absolute',
    right: 0
  },
  liveBadge: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 100,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    marginBottom: 6,
    paddingHorizontal: 10,
    paddingVertical: 3
  },
  liveDot: { borderRadius: 3, height: 6, width: 6 },
  liveText: {
    color: 'rgba(255,255,255,0.7)',
    fontFamily: fonts.body,
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 1
  },
  eyebrow: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 2.5,
    textTransform: 'uppercase'
  },
  title: {
    color: '#E8EAF2',
    fontFamily: fonts.display,
    fontSize: 29,
    fontWeight: '300',
    letterSpacing: 0,
    lineHeight: 34
  },
  subtitle: {
    color: 'rgba(255,255,255,0.45)',
    fontFamily: fonts.body,
    fontSize: 12
  }
});

function DataCard({
  children,
  delay = 0,
  style
}: {
  children: React.ReactNode;
  delay?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      delay,
      duration: 550,
      easing: Easing.out(Easing.cubic),
      toValue: 1,
      useNativeDriver: true
    }).start();
  }, [anim, delay]);

  return (
    <Animated.View
      style={[
        dc.card,
        style,
        {
          opacity: anim,
          transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }]
        }
      ]}
    >
      {children}
    </Animated.View>
  );
}

const dc = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    borderWidth: 1,
    gap: 13,
    overflow: 'hidden',
    padding: 16
  }
});

function SectionHeader({ label, tag }: { label: string; tag?: string }) {
  return (
    <View style={sh.row}>
      <Text style={sh.label}>{label}</Text>
      {tag ? <View style={sh.tagWrap}><Text style={sh.tag}>{tag}</Text></View> : null}
    </View>
  );
}

const sh = StyleSheet.create({
  row: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  label: { color: '#E8EAF2', fontFamily: fonts.body, fontSize: 13, fontWeight: '600' },
  tagWrap: {
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 100,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2
  },
  tag: {
    color: 'rgba(255,255,255,0.4)',
    fontFamily: fonts.body,
    fontSize: 8,
    fontWeight: '600',
    letterSpacing: 1.2,
    textTransform: 'uppercase'
  }
});

function StatPill({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <View style={sp.root}>
      <Text style={sp.label}>{label}</Text>
      <Text style={[sp.value, accent ? { color: accent } : null]}>{value}</Text>
    </View>
  );
}

const sp = StyleSheet.create({
  root: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderColor: 'rgba(255,255,255,0.07)',
    borderRadius: 10,
    borderWidth: 1,
    flex: 1,
    gap: 4,
    minWidth: 130,
    padding: 11
  },
  label: {
    color: 'rgba(255,255,255,0.35)',
    fontFamily: fonts.body,
    fontSize: 8,
    fontWeight: '600',
    letterSpacing: 1.3,
    textTransform: 'uppercase'
  },
  value: {
    color: '#E8EAF2',
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '600'
  }
});

function EnergyCurve({ points }: { points: CircadianEnergyPoint[] }) {
  const sampled = points.filter((_point, index) => index % 3 === 0).slice(0, 6);
  const visible = sampled.length > 0 ? sampled : points.slice(0, 5);
  const max = Math.max(...visible.map((point) => point.estimated_energy), 1);
  const barAnims = useRef(visible.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    Animated.stagger(
      80,
      barAnims.map((anim) =>
        Animated.timing(anim, {
          duration: 700,
          easing: Easing.out(Easing.back(1.2)),
          toValue: 1,
          useNativeDriver: false
        })
      )
    ).start();
  }, [barAnims]);

  function barColor(energy: number): string {
    if (energy >= 70) return '#F2F4F7';
    if (energy >= 40) return '#D8DEE8';
    return 'rgba(255,255,255,0.24)';
  }

  return (
    <View style={ec.root}>
      {visible.map((point, index) => {
        const pct = Math.max((point.estimated_energy / max) * 100, 6);
        return (
          <View key={point.time} style={ec.col}>
            <View style={ec.track}>
              <Animated.View
                style={[
                  ec.fill,
                  {
                    backgroundColor: barColor(point.estimated_energy),
                    height: barAnims[index].interpolate({
                      inputRange: [0, 1],
                      outputRange: ['4%', `${pct}%`]
                    })
                  }
                ]}
              />
            </View>
            <Text style={ec.time}>{formatTime(point.time)}</Text>
            <Text style={ec.lbl}>{phaseLabel(point.label).split(' ')[0]}</Text>
          </View>
        );
      })}
    </View>
  );
}

const ec = StyleSheet.create({
  root: { alignItems: 'flex-end', flexDirection: 'row', gap: 6, height: 120 },
  col: { alignItems: 'center', flex: 1, gap: 4, height: '100%', justifyContent: 'flex-end' },
  track: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 4,
    flex: 1,
    justifyContent: 'flex-end',
    maxHeight: 80,
    overflow: 'hidden',
    width: '100%'
  },
  fill: { borderTopLeftRadius: 3, borderTopRightRadius: 3, width: '100%' },
  time: {
    color: '#E8EAF2',
    fontFamily: fonts.body,
    fontSize: 9,
    fontWeight: '600',
    opacity: 0.6
  },
  lbl: {
    color: 'rgba(255,255,255,0.3)',
    fontFamily: fonts.body,
    fontSize: 8,
    lineHeight: 12,
    textAlign: 'center'
  }
});

function TimingRow({
  iconName,
  iconColor,
  iconBg,
  isLast,
  sub,
  title,
  value,
  valueColor
}: {
  iconName: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  iconBg: string;
  title: string;
  sub: string;
  value: string;
  valueColor?: string;
  isLast?: boolean;
}) {
  return (
    <View style={[tr.root, !isLast && tr.bordered]}>
      <View style={[tr.icon, { backgroundColor: iconBg }]}>
        <Ionicons color={iconColor} name={iconName} size={14} />
      </View>
      <View style={tr.body}>
        <Text style={tr.title}>{title}</Text>
        <Text style={tr.sub}>{sub}</Text>
      </View>
      <Text style={[tr.val, valueColor ? { color: valueColor } : null]}>{value}</Text>
    </View>
  );
}

const tr = StyleSheet.create({
  root: { alignItems: 'center', flexDirection: 'row', gap: 10, paddingVertical: 10 },
  bordered: { borderBottomColor: 'rgba(255,255,255,0.06)', borderBottomWidth: 1 },
  icon: { alignItems: 'center', borderRadius: 8, flexShrink: 0, height: 30, justifyContent: 'center', width: 30 },
  body: { flex: 1, gap: 1 },
  title: { color: '#E8EAF2', fontFamily: fonts.body, fontSize: 13, fontWeight: '500' },
  sub: {
    color: 'rgba(255,255,255,0.35)',
    fontFamily: fonts.body,
    fontSize: 9,
    letterSpacing: 0.3
  },
  val: {
    color: 'rgba(255,255,255,0.6)',
    fontFamily: fonts.body,
    fontSize: 10,
    fontWeight: '600',
    maxWidth: 110,
    textAlign: 'right'
  }
});

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
  const [localTime, setLocalTime] = useState('');
  const [skyConfig, setSkyConfig] = useState(() => getSkyConfig(new Date().getHours() + new Date().getMinutes() / 60));

  useEffect(() => {
    function tick() {
      const date = new Date();
      const h = String(date.getHours()).padStart(2, '0');
      const m = String(date.getMinutes()).padStart(2, '0');
      const sec = String(date.getSeconds()).padStart(2, '0');
      setLocalTime(`${h}:${m}:${sec}`);
      setSkyConfig(getSkyConfig(date.getHours() + date.getMinutes() / 60));
    }

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadSleepRhythmData() {
      const userId = user?.id;

      if (!isUuid(userId)) {
        if (mounted) {
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

        if (!mounted) return;

        setSleepSessions(recentSessions.length > 0 ? recentSessions : createDemoSleepSessions(today));
        setSleepNeed(
          activeNeed
            ? { minutes: activeNeed.minutes, confidence: activeNeed.confidence, basis: activeNeed.basis, updated_at: activeNeed.updated_at }
            : createDefaultSleepNeedEstimate(now)
        );
        setDataMode(recentSessions.length > 0 ? 'persisted' : 'demo');
      } catch {
        if (mounted) {
          setSleepSessions(createDemoSleepSessions(today));
          setSleepNeed(createDefaultSleepNeedEstimate(now));
          setDataMode('demo');
        }
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    loadSleepRhythmData();
    return () => { mounted = false; };
  }, [now, today, user?.id]);

  const briefing: CircadianBriefing = useMemo(
    () => generateCircadianBriefing({
      date: today,
      now,
      preferredBedtime: '22:30',
      recentSleepSessions: sleepSessions,
      sleepNeed,
      timezone: 'UTC'
    }),
    [now, sleepNeed, sleepSessions, today]
  );

  const latestSession = sleepSessions[0];
  const sleepDuration = getLatestSleepDuration(latestSession);
  const sourceLabel = getSleepSourceLabel(briefing.source_summary.sleep_source);
  const confidenceLabel = getConfidenceLabel(briefing.confidence);
  const rhythmLead = getRhythmLead(briefing);
  const accent = skyConfig.accentColor;

  const dataModeNote =
    dataMode === 'demo'
      ? 'Running on demo data. Log last night to personalize.'
      : dataMode === 'manual'
        ? 'Showing manually logged sleep.'
        : 'Synced from saved sleep data.';

  async function handleManualSubmit() {
    const qualityNumber = sleepQuality ? Number(sleepQuality) : null;
    const boundedQuality =
      qualityNumber !== null && Number.isFinite(qualityNumber)
        ? Math.max(1, Math.min(5, Math.round(qualityNumber)))
        : null;
    const manualSession = createManualSleepSession({
      createdAt: new Date().toISOString(),
      date: today,
      sleepQuality: boundedQuality,
      sleepStartTime,
      wakeTime
    });

    setIsSaving(true);

    try {
      const userId = user?.id;
      if (isUuid(userId)) {
        await saveSleepSession(supabase as unknown as SleepRhythmSupabaseClient, userId, manualSession);
      }
      setSleepSessions((curr) => [manualSession, ...curr.filter((session) => session.date !== today)]);
      setDataMode('manual');
    } catch (error) {
      Alert.alert('Sleep window not saved', error instanceof Error ? error.message : 'Try again later.');
      setSleepSessions((curr) => [manualSession, ...curr.filter((session) => session.date !== today)]);
      setDataMode('manual');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <CelestialHeader localTime={localTime} skyConfig={skyConfig} />

        <DataCard delay={0}>
          <View style={s.phaseRow}>
            <View>
              <Text style={s.phaseEyebrow}>Current phase</Text>
              <Text style={s.phaseName}>{phaseLabel(briefing.current_phase)}</Text>
            </View>
            <View style={[s.sourceBadge, { backgroundColor: `${accent}18`, borderColor: `${accent}44` }]}>
              <View style={[s.sourceDot, { backgroundColor: accent }]} />
              <Text style={[s.sourceTxt, { color: accent }]}>{sourceLabel}</Text>
              {isLoading ? <ActivityIndicator color={accent} size="small" style={s.sourceLoader} /> : null}
            </View>
          </View>

          <View style={s.leadBox}>
            <Text style={[s.leadEyebrow, { color: accent }]}>Strongest signal today</Text>
            <Text style={s.leadText}>{rhythmLead}</Text>
            <Text style={s.leadSub}>{confidenceLabel} - {dataModeNote}</Text>
          </View>

          <View style={s.statsGrid}>
            <StatPill label="Sleep" value={`${formatTime(latestSession?.sleep_start_at)} - ${formatTime(latestSession?.sleep_end_at)}`} />
            <StatPill label="Duration" value={formatDuration(sleepDuration)} />
            <StatPill label="7-day debt" value={formatDebt(briefing.sleep_debt_7_day.total_sleep_debt_minutes)} accent={accent} />
            <StatPill label="Target bedtime" value={formatTime(briefing.target_bedtime)} accent={accent} />
          </View>
        </DataCard>

        <DataCard delay={100}>
          <SectionHeader label="Energy curve" tag="Estimated" />
          <EnergyCurve points={briefing.energy_curve} />
        </DataCard>

        <DataCard delay={200}>
          <SectionHeader label="Organize your day" tag="Timing only" />
          <View>
            <TimingRow
              iconBg="rgba(216,222,232,0.12)"
              iconColor="#F2F4F7"
              iconName="sparkles-outline"
              sub="Best window"
              title="Deep focus"
              value={formatWindow(briefing.rhythm_plan.deep_work_windows[0])}
              valueColor="#F2F4F7"
            />
            <TimingRow
              iconBg="rgba(216,222,232,0.1)"
              iconColor="#D8DEE8"
              iconName="flash-outline"
              sub="Suggested window"
              title="Exercise"
              value={formatWindow(briefing.rhythm_plan.best_exercise_windows[0])}
              valueColor="#D8DEE8"
            />
            <TimingRow
              iconBg="rgba(255,255,255,0.05)"
              iconColor="rgba(255,255,255,0.6)"
              iconName="walk-outline"
              sub="Walk or stretch"
              title="Light movement"
              value={formatWindow(briefing.rhythm_plan.best_walk_windows[0])}
            />
            <TimingRow
              iconBg="rgba(255,255,255,0.05)"
              iconColor="rgba(255,255,255,0.6)"
              iconName="leaf-outline"
              sub="Suggested window"
              title="Breathing reset"
              value={formatWindow(briefing.rhythm_plan.breathing_windows[0])}
            />
            {briefing.rhythm_plan.nap_windows[0] ? (
              <TimingRow
                iconBg="rgba(216,222,232,0.08)"
                iconColor="#D8DEE8"
                iconName="moon-outline"
                sub="Possible window"
                title="Short nap"
                value={formatWindow(briefing.rhythm_plan.nap_windows[0])}
                valueColor="#D8DEE8"
              />
            ) : null}
            <TimingRow
              iconBg="rgba(255,255,255,0.05)"
              iconColor="#D8DEE8"
              iconName="cafe-outline"
              sub="Based on bedtime"
              title="Caffeine cutoff"
              value={formatTime(briefing.rhythm_plan.caffeine_cutoff)}
              valueColor="#D8DEE8"
            />
            <TimingRow
              iconBg="rgba(216,222,232,0.08)"
              iconColor="#D8DEE8"
              iconName="cloudy-night-outline"
              isLast
              sub="Start here"
              title="Wind-down"
              value={formatTime(briefing.rhythm_plan.wind_down_start)}
              valueColor="#D8DEE8"
            />
          </View>
        </DataCard>

        <DataCard delay={300}>
          <SectionHeader label="Log sleep" tag="Optional" />
          <Text style={s.logDesc}>Enter last night's times to update your rhythm estimate.</Text>

          <View style={s.timeRow}>
            <View style={s.timeField}>
              <Text style={s.inputLbl}>Fell asleep</Text>
              <View style={s.timeDisplay}><Text style={s.timeDisplayTxt}>{sleepStartTime}</Text></View>
            </View>
            <Text style={s.timeConnector}>to</Text>
            <View style={s.timeField}>
              <Text style={s.inputLbl}>Woke up</Text>
              <View style={s.timeDisplay}><Text style={s.timeDisplayTxt}>{wakeTime}</Text></View>
            </View>
          </View>

          <View style={s.presets}>
            {[['22:30', '06:30'], ['23:15', '07:00'], ['00:00', '07:15']].map(([start, wake]) => (
              <Pressable
                key={`${start}-${wake}`}
                accessibilityRole="button"
                onPress={() => { setSleepStartTime(start); setWakeTime(wake); }}
                style={s.preset}
              >
                <Text style={s.presetTxt}>{start} - {wake}</Text>
              </Pressable>
            ))}
          </View>

          <View>
            <Text style={[s.inputLbl, s.qualityLabel]}>
              Sleep quality <Text style={s.optional}>(optional)</Text>
            </Text>
            <View style={s.qualityRow}>
              <Pressable
                accessibilityRole="button"
                onPress={() => setSleepQuality('')}
                style={[s.qChip, sleepQuality === '' && s.qChipActive]}
              >
                <Text style={s.qTxt}>Not sure</Text>
              </Pressable>
              {[1, 2, 3, 4, 5].map((value) => (
                <Pressable
                  key={value}
                  accessibilityRole="button"
                  onPress={() => setSleepQuality(String(value))}
                  style={[s.qChip, s.qNum, sleepQuality === String(value) && { backgroundColor: `${accent}18`, borderColor: `${accent}88` }]}
                >
                  <Text style={[s.qTxt, sleepQuality === String(value) && { color: accent }]}>{value}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          <Pressable
            accessibilityRole="button"
            disabled={isSaving}
            onPress={handleManualSubmit}
            style={[s.submitBtn, { backgroundColor: `${accent}18`, borderColor: `${accent}44` }, isSaving && s.submitDisabled]}
          >
            {isSaving
              ? <ActivityIndicator color={accent} size="small" />
              : <Text style={[s.submitTxt, { color: accent }]}>Update rhythm estimate</Text>
            }
          </Pressable>
        </DataCard>

        <View style={s.footnote}>
          <Ionicons color="rgba(255,255,255,0.25)" name="information-circle-outline" size={13} style={s.footnoteIcon} />
          <Text style={s.footnoteTxt}>Wellness estimate. Accuracy improves with more logged nights. Wearable sync coming soon.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { backgroundColor: '#050506', flex: 1 },
  scroll: { gap: 12, paddingBottom: 44, paddingHorizontal: 16 },
  phaseRow: { alignItems: 'flex-start', flexDirection: 'row', gap: 10, justifyContent: 'space-between' },
  phaseEyebrow: {
    color: 'rgba(255,255,255,0.35)',
    fontFamily: fonts.body,
    fontSize: 8,
    fontWeight: '600',
    letterSpacing: 1.5,
    marginBottom: 4,
    textTransform: 'uppercase'
  },
  phaseName: {
    color: '#E8EAF2',
    fontFamily: fonts.display,
    fontSize: 22,
    fontWeight: '300',
    letterSpacing: 0
  },
  sourceBadge: {
    alignItems: 'center',
    borderRadius: 100,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 4,
    marginTop: 2,
    paddingHorizontal: 9,
    paddingVertical: 4
  },
  sourceDot: { borderRadius: 2.5, height: 5, width: 5 },
  sourceTxt: {
    fontFamily: fonts.body,
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase'
  },
  sourceLoader: { marginLeft: 4 },
  leadBox: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(255,255,255,0.07)',
    borderRadius: 10,
    borderWidth: 1,
    gap: 5,
    padding: 13
  },
  leadEyebrow: {
    fontFamily: fonts.body,
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 1.5,
    opacity: 0.7,
    textTransform: 'uppercase'
  },
  leadText: {
    color: '#E8EAF2',
    fontFamily: fonts.body,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20
  },
  leadSub: {
    color: 'rgba(255,255,255,0.4)',
    fontFamily: fonts.body,
    fontSize: 11,
    lineHeight: 16
  },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  logDesc: {
    color: 'rgba(255,255,255,0.4)',
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 18,
    marginTop: -4
  },
  timeRow: { alignItems: 'flex-end', flexDirection: 'row', gap: 8 },
  timeField: { flex: 1, gap: 5 },
  inputLbl: {
    color: 'rgba(255,255,255,0.35)',
    fontFamily: fonts.body,
    fontSize: 8,
    fontWeight: '600',
    letterSpacing: 1.3,
    textTransform: 'uppercase'
  },
  timeDisplay: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center'
  },
  timeDisplayTxt: {
    color: '#E8EAF2',
    fontFamily: fonts.body,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 1
  },
  timeConnector: {
    color: 'rgba(255,255,255,0.25)',
    fontFamily: fonts.body,
    fontSize: 12,
    paddingBottom: 12
  },
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  preset: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 100,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  presetTxt: {
    color: 'rgba(255,255,255,0.55)',
    fontFamily: fonts.body,
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 0.3
  },
  qualityLabel: { marginBottom: 8 },
  optional: {
    fontWeight: '400',
    letterSpacing: 0,
    opacity: 0.4,
    textTransform: 'none'
  },
  qualityRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  qChip: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderColor: 'rgba(255,255,255,0.09)',
    borderRadius: 7,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  qChipActive: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: 'rgba(255,255,255,0.35)'
  },
  qNum: { alignItems: 'center', minWidth: 38 },
  qTxt: {
    color: 'rgba(255,255,255,0.6)',
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: '500'
  },
  submitBtn: {
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    height: 48,
    justifyContent: 'center',
    marginTop: 2
  },
  submitDisabled: { opacity: 0.5 },
  submitTxt: {
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.5,
    textTransform: 'uppercase'
  },
  footnote: { alignItems: 'flex-start', flexDirection: 'row', gap: 7, paddingHorizontal: 2 },
  footnoteIcon: { marginTop: 1 },
  footnoteTxt: {
    color: 'rgba(255,255,255,0.25)',
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 11,
    lineHeight: 17
  }
});
