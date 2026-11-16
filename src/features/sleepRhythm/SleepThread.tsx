import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type AccessibilityActionEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Svg, { Circle, Line, Path, Polyline, Rect } from 'react-native-svg';

import { Eyebrow, SectionTitle, TextLink, ThreadButton } from '../../components/thread/ThreadParts';
import { getRecommendedActivityAt, type CircadianBriefing, type SleepSession } from '../../engines/circadian';
import { accent, bone, font, HIT, ink, radius, space, surface, type } from '../../styles/daywoven1c';
import { formatHoursMinutes, sleepGlance } from '../dashboard/dashboardZones';
import { clock } from '../dashboard/dayThreadModel';
import { wallClockMinute } from '../dashboard/dayThreadInput';
import { formatSleepMinutes, sleepPhaseLabel, type OutlookSummary, type SleepProtocolItem } from './sleepPresentation';
import { buildRhythm, buildSleepChart, minuteAtX, readSleepChart, SLEEP_CHART, type RhythmRow } from './sleepThreadModel';

/** "Today looks steady." from the engine's outlook word, so the headline is the engine's own. */
function outlookHeadline(outlook: OutlookSummary | null): string {
  if (!outlook) return 'Log last night to see today’s energy.';
  return `Today looks ${outlook.headline.toLowerCase()}.`;
}

/**
 * The Sleep header band (design language P1): eyebrow, the engine's outlook as the
 * headline, its limiter or timing note as the sub-line, then the screen's one hero, the
 * energy chart with a live readout.
 */
export function SleepBand({ briefing, outlook, nowMinute, support, onLogSleep }: {
  briefing: CircadianBriefing;
  outlook: OutlookSummary | null;
  nowMinute: number;
  /** The current phase's own support line, used when the engine has no limiter or timing note. */
  support: string;
  onLogSleep: () => void;
}) {
  const sub = [outlook?.body, outlook?.timing, outlook?.calibrating ? 'Still calibrating, so treat this loosely.' : null].filter(Boolean).join(' ') || support;
  const hasCurve = briefing.energy_curve.length >= 2;
  return (
    <View>
      <View style={styles.bandEyebrow}><Eyebrow tone="band">Sleep & energy</Eyebrow></View>
      <Text accessibilityRole="header" style={styles.bandTitle}>{outlookHeadline(outlook)}</Text>
      <Text style={styles.bandSub}>{hasCurve ? sub : 'Your energy through the day is estimated from your recent nights. One logged night is enough to start.'}</Text>
      {hasCurve ? (
        <SleepEnergyThread briefing={briefing} nowMinute={nowMinute} />
      ) : (
        <ThreadButton tone="band" label="Log last night’s sleep" onPress={onLogSleep} style={styles.bandButton} />
      )}
    </View>
  );
}

/**
 * The energy curve on the band, in the 1c chart grammar (P8, P9): amber line, solid where
 * lived and dotted where predicted, the person's usual range as a wash, one baseline, sparse
 * hour labels and no gridlines. Drag across it to read the estimate at any time.
 */
export function SleepEnergyThread({ briefing, nowMinute }: { briefing: CircadianBriefing; nowMinute: number }) {
  const [width, setWidth] = useState(0);
  const [scrubMinute, setScrubMinute] = useState<number | null>(null);
  const chart = useMemo(() => buildSleepChart({ briefing, nowMinute, width }), [briefing, nowMinute, width]);
  const reading = useMemo(() => readSleepChart(briefing, scrubMinute ?? nowMinute, width), [briefing, nowMinute, scrubMinute, width]);
  const activity = useMemo(() => {
    if (!reading) return null;
    const day = briefing.date.slice(0, 10);
    const iso = `${day}T${reading.time}:00.000Z`;
    return wallClockMinute(iso, day) === null ? null : getRecommendedActivityAt(briefing, iso).label;
  }, [briefing, reading]);

  const pan = Gesture.Pan()
    .runOnJS(true)
    .activeOffsetX([-6, 6])
    .failOffsetY([-14, 14])
    .onStart((event) => setScrubMinute(minuteAtX(briefing, event.x, width)))
    .onUpdate((event) => setScrubMinute(minuteAtX(briefing, event.x, width)));

  const onAction = (event: AccessibilityActionEvent) => {
    const from = scrubMinute ?? nowMinute;
    if (event.nativeEvent.actionName === 'increment') setScrubMinute(from + 15);
    if (event.nativeEvent.actionName === 'decrement') setScrubMinute(from - 15);
  };

  return (
    <View>
      <View style={styles.readout}>
        <Text style={styles.readoutTime}>{reading ? `${reading.time} · ${sleepPhaseLabel(reading.phase)}` : '—'}</Text>
        <Text style={styles.readoutLevel}>{reading?.level ? `${reading.level} energy · est.` : 'est.'}</Text>
      </View>
      {activity ? <Text style={styles.readoutActivity}>Suits {activity.toLowerCase()}</Text> : null}
      <GestureDetector gesture={pan}>
        <View
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel="Estimated energy through today"
          accessibilityHint="Drag to read energy at a time"
          accessibilityValue={{ text: reading ? `${reading.time}, ${sleepPhaseLabel(reading.phase)}, ${reading.level ?? 'no'} energy, estimate` : 'No estimate' }}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={onAction}
          onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
          style={styles.chart}
        >
          {width > 0 ? (
            <Svg width={width} height={SLEEP_CHART.height}>
              {chart.usual ? <Rect x={0} y={chart.usual.top} width={width} height={Math.max(1, chart.usual.bottom - chart.usual.top)} fill={bone.raised} /> : null}
              {chart.area ? <Path d={chart.area} fill={accent.amberGap} /> : null}
              <Line x1={0} x2={width} y1={chart.baselineY} y2={chart.baselineY} stroke={bone.hairline} strokeWidth={1} />
              {chart.nowX !== null ? <Line x1={chart.nowX} x2={chart.nowX} y1={SLEEP_CHART.top - 6} y2={chart.baselineY} stroke={bone.outline} strokeWidth={1} /> : null}
              {chart.lived ? <Polyline points={chart.lived} fill="none" stroke={accent.amber} strokeWidth={2} strokeLinejoin="round" /> : null}
              {chart.predicted ? <Polyline points={chart.predicted} fill="none" stroke={accent.amber} strokeWidth={2} strokeDasharray={[2, 4]} strokeLinecap="round" /> : null}
              {reading ? (
                <>
                  {scrubMinute !== null ? <Line x1={reading.x} x2={reading.x} y1={reading.y} y2={chart.baselineY} stroke={bone.text} strokeWidth={2} /> : null}
                  <Circle cx={reading.x} cy={reading.y} r={4.5} fill={surface.band} stroke={accent.amber} strokeWidth={2} />
                </>
              ) : null}
            </Svg>
          ) : null}
          {chart.usual ? <Text style={[styles.usualLabel, { top: Math.max(0, chart.usual.top - 15) }]}>Your usual</Text> : null}
          <View style={styles.hours}>
            {chart.hourLabels.map((label) => (
              <Text key={label.label} style={[styles.hour, { left: Math.min(Math.max(0, label.x - 8), Math.max(0, width - 16)) }]}>{label.label}</Text>
            ))}
          </View>
        </View>
      </GestureDetector>
    </View>
  );
}

const LEVEL_COLOUR: Record<RhythmRow['level'], string> = { high: accent.amber, low: accent.lavender, moderate: ink.track, wind_down: ink.hairline };

/** "Today's rhythm": a 10pt composition bar of the day's windows, then the windows themselves as hairline rows. */
export function TodaysRhythm({ briefing, protocol }: { briefing: CircadianBriefing; protocol: SleepProtocolItem[] }) {
  const rhythm = useMemo(() => buildRhythm(briefing, protocol, sleepPhaseLabel), [briefing, protocol]);
  if (!rhythm.segments.length) return null;
  return (
    <View style={styles.section}>
      <SectionTitle>Today’s rhythm</SectionTitle>
      <View accessible accessibilityLabel={`Today in windows: ${rhythm.rows.map((row) => `${row.name} ${row.range}`).join(', ')}`} style={styles.rhythmBar}>
        {rhythm.segments.map((segment, index) => (
          <View key={index} style={{ backgroundColor: segment.level === 'moderate' ? ink.track : segment.level === 'wind_down' ? ink.hairline : LEVEL_COLOUR[segment.level], flex: segment.share, height: 10 }} />
        ))}
      </View>
      <View style={styles.rows}>
        {rhythm.rows.map((row, index) => (
          <View key={row.id} accessible accessibilityLabel={`${row.name}, ${row.range}${row.fit ? `. ${row.fit}` : ''}`} style={[styles.row, index === rhythm.rows.length - 1 && styles.rowLast]}>
            <View style={[styles.swatch, { backgroundColor: row.level === 'wind_down' ? ink.track : LEVEL_COLOUR[row.level] }]} />
            <View style={styles.rowCopy}>
              <View style={styles.rowHead}>
                <Text style={styles.rowTitle}>{row.name}</Text>
                <Text style={styles.rowTime}>{row.range}</Text>
              </View>
              {row.fit ? <Text style={styles.rowDetail}>{row.fit}</Text> : null}
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

/**
 * "Tonight": the one dark card on Sleep (P5), "In bed by" the target bedtime with the
 * sleep opportunity against the need, beside the caffeine cutoff and wind-down start.
 */
export function TonightSummary({ briefing, needMinutes }: { briefing: CircadianBriefing; needMinutes: number }) {
  const day = briefing.date.slice(0, 10);
  const bed = wallClockMinute(briefing.target_bedtime, day);
  const wake = wallClockMinute(briefing.wake_time, day);
  const caffeine = wallClockMinute(briefing.rhythm_plan.caffeine_cutoff, day);
  const windDown = wallClockMinute(briefing.rhythm_plan.wind_down_start, day);
  const opportunity = bed !== null && wake !== null ? ((wake + 1440) - bed + 1440) % 1440 : null;
  const meets = opportunity !== null && opportunity >= needMinutes;
  return (
    <View style={styles.tonight}>
      <View accessible accessibilityLabel={bed === null ? 'Bedtime still calibrating' : `In bed by ${clock(bed)}. ${opportunity === null ? '' : `${formatSleepMinutes(opportunity)} opportunity`}`} style={styles.tonightCard}>
        <Text style={styles.tonightLabel}>In bed by</Text>
        <Text style={styles.tonightTime}>{bed === null ? '—' : clock(bed)}</Text>
        <Text style={styles.tonightNote}>
          {opportunity === null
            ? 'Still calibrating from your logged nights.'
            : `${formatSleepMinutes(opportunity)} opportunity, ${meets ? 'in tune with your estimated need' : 'shorter than your estimated need'}`}
        </Text>
      </View>
      <View style={styles.tonightSide}>
        <View accessible accessibilityLabel={`Last caffeine ${caffeine === null ? 'still calibrating' : clock(caffeine)}`} style={styles.tonightFigure}>
          <Text style={styles.tonightFigureValue}>{caffeine === null ? '—' : clock(caffeine)}</Text>
          <Text style={styles.tonightFigureLabel}>Last caffeine</Text>
        </View>
        <View style={styles.tonightDivider} />
        <View accessible accessibilityLabel={`Wind-down ${windDown === null ? 'still calibrating' : clock(windDown)}`} style={styles.tonightFigure}>
          <Text style={styles.tonightFigureValue}>{windDown === null ? '—' : clock(windDown)}</Text>
          <Text style={styles.tonightFigureLabel}>Wind-down</Text>
        </View>
      </View>
    </View>
  );
}

function sourceTag(source: SleepSession['source'] | undefined): string {
  if (source === 'healthkit') return 'Measured · Apple Health';
  if (source === 'health_connect') return 'Measured · Health Connect';
  if (source === 'wearable') return 'Measured · wearable';
  if (source === 'phone_motion' || source === 'phone_activity') return 'Estimated · phone';
  if (source === 'estimated') return 'Estimated';
  if (source === 'demo') return 'Logged · demo';
  return 'Logged by you';
}

function compact(minutes: number): string {
  return formatHoursMinutes(minutes).replace(' ', '');
}

/**
 * "Last 7 nights" (P8, P12): one column per night with a 4pt bar filled against the
 * estimated need. A night that was not logged is a dashed outline labelled "none", never a
 * zero. Last night is lavender. Then the debt and confidence sentence and the source.
 */
export function LastSevenNights({ briefing, sessions, today, needMinutes, onLogSleep }: {
  briefing: CircadianBriefing;
  sessions: SleepSession[];
  today: string;
  needMinutes: number;
  onLogSleep: () => void;
}) {
  const glance = useMemo(() => sleepGlance({ sessions, today, needMinutes }), [needMinutes, sessions, today]);
  const missing = glance.series.filter((night) => night.minutes === null).length;
  const latest = [...sessions].sort((a, b) => b.date.localeCompare(a.date))[0];
  const debt = briefing.sleep_debt_7_day.total_sleep_debt_minutes;
  const sentence = [
    `Each bar is filled against your estimated need of ${formatSleepMinutes(needMinutes)}.`,
    debt !== null && debt > 0 ? `Sleep debt is about ${formatSleepMinutes(debt)}.` : null,
    missing > 0 ? `${missing === 1 ? 'One night was' : `${missing} nights were`} not logged, so confidence stays ${briefing.confidence}.` : `Confidence is ${briefing.confidence}.`
  ].filter(Boolean).join(' ');
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <SectionTitle>Last 7 nights</SectionTitle>
        <Text style={styles.sectionMeta}>{latest ? sourceTag(latest.source) : 'Nothing logged yet'}</Text>
      </View>
      <View style={styles.nights}>
        {glance.series.map((night, index) => {
          const last = index === glance.series.length - 1;
          const fill = night.minutes === null || needMinutes <= 0 ? null : Math.min(1, night.minutes / needMinutes);
          const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'narrow' }).format(new Date(`${night.date}T12:00:00`));
          return (
            <View key={night.date} accessible accessibilityLabel={`${new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(new Date(`${night.date}T12:00:00`))}: ${night.minutes === null ? 'not logged' : formatSleepMinutes(night.minutes)}`} style={styles.night}>
              {fill === null ? (
                <View style={styles.nightNone} />
              ) : (
                <View style={styles.nightTrack}><View style={[styles.nightFill, { width: `${Math.round(fill * 100)}%`, backgroundColor: last ? accent.lavenderDeep : ink.text }]} /></View>
              )}
              <Text style={[styles.nightValue, last && styles.nightValueLast, fill === null && styles.nightValueNone]}>{night.minutes === null ? 'none' : compact(night.minutes)}</Text>
              <Text style={[styles.nightDay, last && styles.nightValueLast]}>{weekday}</Text>
            </View>
          );
        })}
      </View>
      <Text style={styles.nightsNote}>{sentence}</Text>
      <TextLink label="Log or correct last night" onPress={onLogSleep} />
    </View>
  );
}

/** The chronotype row (56pt): the existing estimate, opening the existing questions. */
export function ChronotypeRow({ label, onOpen }: { label?: string | null; onOpen?: () => void }) {
  if (!onOpen) return null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label ? `Chronotype: ${label}, estimate. Retake the clock questions` : 'Find your chronotype. Six questions about your clock'}
      onPress={onOpen}
      style={({ pressed }) => [styles.chrono, pressed && styles.pressed]}
    >
      <Text style={styles.chronoText} numberOfLines={2}>
        <Text style={styles.chronoStrong}>Chronotype</Text>
        {label ? ` · ${label} (estimate)` : ' · Six questions about your clock'}
      </Text>
      <Ionicons accessible={false} color={ink.text} name="chevron-forward" size={16} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bandEyebrow: { marginTop: 22 },
  bandTitle: { ...type.sleepTitle, color: bone.text, marginTop: 10 },
  bandSub: { ...type.body, color: bone.soft, marginTop: 10 },
  bandButton: { alignSelf: 'flex-start', marginTop: 18, paddingHorizontal: 18 },
  readout: { alignItems: 'baseline', flexDirection: 'row', gap: 10, justifyContent: 'space-between', marginTop: 20, minHeight: 24 },
  readoutTime: { color: bone.text, flexShrink: 1, fontFamily: font.display, fontSize: 20, fontVariant: ['tabular-nums'] },
  readoutLevel: { color: bone.soft, fontFamily: font.body, fontSize: 12.5 },
  readoutActivity: { color: bone.muted, fontFamily: font.body, fontSize: 12, marginTop: 2 },
  chart: { height: SLEEP_CHART.height, marginTop: 8 },
  usualLabel: { color: bone.label, fontFamily: font.body, fontSize: 10.5, position: 'absolute', right: 0 },
  hours: { bottom: 0, height: 16, left: 0, position: 'absolute', right: 0 },
  hour: { color: bone.label, fontFamily: font.body, fontSize: 10.5, fontVariant: ['tabular-nums'], position: 'absolute', width: 16, textAlign: 'center' },
  section: { marginTop: space.section },
  sectionHead: { alignItems: 'baseline', flexDirection: 'row', gap: 8, justifyContent: 'space-between' },
  sectionMeta: { ...type.caption, color: ink.muted, flexShrink: 1, textAlign: 'right' },
  rhythmBar: { flexDirection: 'row', gap: 3, marginTop: 14 },
  rows: { marginTop: 12 },
  row: { borderTopColor: ink.hairline, borderTopWidth: 1, flexDirection: 'row', gap: 12, minHeight: HIT, paddingVertical: 11 },
  rowLast: { borderBottomColor: ink.hairline, borderBottomWidth: 1 },
  swatch: { borderRadius: radius.swatch, height: 10, marginTop: 5, width: 10 },
  rowCopy: { flex: 1, gap: 2, minWidth: 0 },
  rowHead: { alignItems: 'baseline', flexDirection: 'row', gap: 8, justifyContent: 'space-between' },
  rowTitle: { ...type.bodyStrong, color: ink.text, flexShrink: 1 },
  rowTime: { color: ink.text, fontFamily: font.body, fontSize: 13.5, fontVariant: ['tabular-nums'] },
  rowDetail: { ...type.caption, color: ink.muted },
  tonight: { flexDirection: 'row', gap: 14, marginTop: 14 },
  tonightCard: { backgroundColor: surface.band, borderRadius: radius.card, flex: 1.15, padding: 16 },
  tonightLabel: { color: bone.muted, fontFamily: font.body, fontSize: 12.5 },
  tonightTime: { color: bone.text, fontFamily: font.display, fontSize: 38, fontVariant: ['tabular-nums'], lineHeight: 44, marginTop: 6 },
  tonightNote: { color: bone.soft, fontFamily: font.body, fontSize: 12, lineHeight: 17, marginTop: 8 },
  tonightSide: { flex: 1, justifyContent: 'center' },
  tonightFigure: { paddingVertical: 6 },
  tonightFigureValue: { color: ink.text, fontFamily: font.display, fontSize: 24, fontVariant: ['tabular-nums'], lineHeight: 28 },
  tonightFigureLabel: { ...type.caption, color: ink.muted, marginTop: 2 },
  tonightDivider: { backgroundColor: ink.hairline, height: 1, marginVertical: 6 },
  nights: { flexDirection: 'row', gap: 6, marginTop: 14 },
  night: { alignItems: 'center', flex: 1, gap: 6, minWidth: 0 },
  nightTrack: { alignSelf: 'stretch', backgroundColor: ink.track, height: 4 },
  nightFill: { height: 4 },
  nightNone: { alignSelf: 'stretch', borderColor: ink.border, borderStyle: 'dashed', borderWidth: 1, height: 6 },
  nightValue: { color: ink.text, fontFamily: font.body, fontSize: 12, fontVariant: ['tabular-nums'] },
  nightValueLast: { fontFamily: font.bodySemibold },
  nightValueNone: { color: ink.muted },
  nightDay: { color: ink.muted, fontFamily: font.body, fontSize: 11 },
  nightsNote: { ...type.body, color: ink.muted, marginTop: 12 },
  chrono: { alignItems: 'center', borderBottomColor: ink.hairline, borderBottomWidth: 1, borderTopColor: ink.hairline, borderTopWidth: 1, flexDirection: 'row', gap: 10, marginTop: space.xxl, minHeight: 56 },
  chronoText: { color: ink.muted, flex: 1, fontFamily: font.body, fontSize: 14 },
  chronoStrong: { color: ink.text, fontFamily: font.bodyMedium, fontSize: 15 },
  pressed: { opacity: 0.65 }
});
