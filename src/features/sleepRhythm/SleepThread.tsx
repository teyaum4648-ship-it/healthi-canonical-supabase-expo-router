import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Eyebrow, SectionTitle, TextLink, ThreadButton } from '../../components/thread/ThreadParts';
import type { CircadianBriefing, SleepSession } from '../../engines/circadian';
import { accent, bone, font, HIT, ink, radius, space, surface, type } from '../../styles/daywoven1c';
import { formatHoursMinutes, sleepGlance } from '../dashboard/dashboardZones';
import { clock } from '../dashboard/dayThreadModel';
import { wallClockMinute } from '../dashboard/dayThreadInput';
import { formatSleepMinutes, sleepPhaseLabel, type OutlookSummary, type SleepProtocolItem } from './sleepPresentation';
import { SleepEnergyChart } from './SleepEnergyChart';
import { buildRhythm, type RhythmRow } from './sleepThreadModel';
import { SleepTwoThread } from './SleepTwoThread';
import type { SleepWindowTrackerPalette } from './SleepWindowTracker';
import { buildTwoProcessDay } from './twoProcessModel';

/** "Today looks steady." from the engine's outlook word, so the headline is the engine's own. */
function outlookHeadline(outlook: OutlookSummary | null): string {
  if (!outlook) return 'Log last night to see today’s energy.';
  return `Today looks ${outlook.headline.toLowerCase()}.`;
}

/** The original Sleep energy chart's colours, set for the charcoal band. */
const BAND_CHART_PALETTE: SleepWindowTrackerPalette = {
  surface: surface.band,
  surfaceAlt: bone.raised,
  border: bone.hairline,
  hairline: bone.hairline,
  text: bone.text,
  muted: bone.muted,
  faint: bone.faint,
  accent: accent.amber,
  accentSoft: accent.amberGap,
  primary: bone.text,
  primaryText: ink.text,
  amber: accent.lavender,
  chip: bone.raised
};

/**
 * The Sleep header band (design language P1): eyebrow, the engine's outlook as the
 * headline, its limiter or timing note as the sub-line, then two views of the day. First
 * the energy forecast, drag to read what each moment suits; then body clock and sleep
 * pressure, the two threads that energy sits between.
 */
export function SleepBand({ briefing, outlook, now, nowMinute, sessions, needMinutes, support, onLogSleep }: {
  briefing: CircadianBriefing;
  outlook: OutlookSummary | null;
  /** The wall clock on the UTC axis, as the briefing's own times are. */
  now: string;
  nowMinute: number;
  sessions: SleepSession[];
  needMinutes: number;
  /** The current phase's own support line, used when the engine has no limiter or timing note. */
  support: string;
  onLogSleep: () => void;
}) {
  const sub = [outlook?.body, outlook?.timing, outlook?.calibrating ? 'Still calibrating, so treat this loosely.' : null].filter(Boolean).join(' ') || support;
  const hasCurve = briefing.energy_curve.length >= 2;
  const twoProcess = useMemo(() => buildTwoProcessDay({
    day: briefing.date.slice(0, 10),
    wakeIso: briefing.wake_time,
    bedIso: briefing.target_bedtime,
    clockMidSleepMinutes: briefing.circadian_phase?.phaseMinutes ?? null,
    sessions,
    needMinutes
  }), [briefing, sessions, needMinutes]);
  return (
    <View>
      <View style={styles.bandEyebrow}><Eyebrow tone="band">Sleep & energy</Eyebrow></View>
      <Text accessibilityRole="header" style={styles.bandTitle}>{outlookHeadline(outlook)}</Text>
      <Text style={styles.bandSub}>{hasCurve ? sub : 'Your energy through the day is estimated from your recent nights. One logged night is enough to start.'}</Text>
      {hasCurve ? (
        <>
          <View style={styles.forecast}>
            <SleepEnergyChart briefing={briefing} now={now} palette={BAND_CHART_PALETTE} />
          </View>
          <SleepTwoThread day={twoProcess} nowMinute={nowMinute} />
        </>
      ) : (
        <ThreadButton tone="band" label="Log last night’s sleep" onPress={onLogSleep} style={styles.bandButton} />
      )}
    </View>
  );
}

const LEVEL_COLOUR: Record<RhythmRow['level'], string> = { high: accent.amber, low: accent.lavender, moderate: ink.track, wind_down: ink.hairline };

export type RhythmStep = {
  item: SleepProtocolItem;
  icon: keyof typeof Ionicons.glyphMap;
  /** "8:17–9:17 AM", or one time for a point like the caffeine cutoff. */
  range: string;
  /** "Now", "Upcoming", "Earlier" or "Done", from the screen's own clock. */
  status: string;
  done: boolean;
};

/** Steps in the order the day meets them; a step the engine could not place yet goes last. */
function byTime(steps: RhythmStep[]): RhythmStep[] {
  return [...steps].sort((a, b) => (a.item.start_at ?? '9999').localeCompare(b.item.start_at ?? '9999'));
}

/**
 * "Today's rhythm": the day's energy windows as a 10pt composition bar (P10), then the
 * day's steps from the sleep protocol as a timeline, in time order. Each step keeps the
 * engine's own window and reason. Tap the icon to mark it done; tap the row for why it
 * sits there. Without steps the high and low windows are listed instead.
 */
export function TodaysRhythm({ briefing, protocol, steps = [], onToggleStep, onOpenStep }: {
  briefing: CircadianBriefing;
  protocol: SleepProtocolItem[];
  steps?: RhythmStep[];
  onToggleStep?: (id: SleepProtocolItem['id']) => void;
  onOpenStep?: (item: SleepProtocolItem) => void;
}) {
  const rhythm = useMemo(() => buildRhythm(briefing, protocol, sleepPhaseLabel), [briefing, protocol]);
  const ordered = useMemo(() => byTime(steps), [steps]);
  if (!rhythm.segments.length && !ordered.length) return null;
  const doneCount = ordered.filter((step) => step.done).length;
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <SectionTitle>Today’s rhythm</SectionTitle>
        {ordered.length ? <Text style={styles.sectionMeta}>{doneCount} of {ordered.length} done</Text> : null}
      </View>
      {rhythm.segments.length ? (
        <>
          <View accessible accessibilityLabel={`Today in windows: ${rhythm.rows.map((row) => `${row.name} ${row.range}`).join(', ')}`} style={styles.rhythmBar}>
            {rhythm.segments.map((segment, index) => (
              <View key={index} style={{ backgroundColor: segment.level === 'moderate' ? ink.track : segment.level === 'wind_down' ? ink.hairline : LEVEL_COLOUR[segment.level], flex: segment.share, height: 10 }} />
            ))}
          </View>
          <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={styles.legend}>
            <View style={styles.legendItem}><View style={[styles.legendSwatch, { backgroundColor: accent.amber }]} /><Text style={styles.legendText}>Higher energy</Text></View>
            <View style={styles.legendItem}><View style={[styles.legendSwatch, { backgroundColor: accent.lavender }]} /><Text style={styles.legendText}>Dip</Text></View>
            <View style={styles.legendItem}><View style={[styles.legendSwatch, { backgroundColor: ink.hairline }]} /><Text style={styles.legendText}>Wind-down</Text></View>
          </View>
        </>
      ) : null}

      {ordered.length ? (
        <View style={styles.steps}>
          {ordered.map((step, index) => {
            const isNow = step.status === 'Now' && !step.done;
            const last = index === ordered.length - 1;
            return (
              <View key={step.item.id} style={styles.step}>
                <View style={styles.stepRail}>
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: step.done }}
                    accessibilityLabel={`${step.item.name}: ${step.done ? 'done' : 'mark as done'}`}
                    hitSlop={6}
                    onPress={() => onToggleStep?.(step.item.id)}
                    style={({ pressed }) => [styles.stepIcon, isNow && styles.stepIconNow, step.done && styles.stepIconDone, pressed && styles.pressed]}
                  >
                    <Ionicons accessible={false} color={step.done ? bone.text : isNow ? accent.amberDeep : ink.text} name={step.done ? 'checkmark' : step.icon} size={17} />
                  </Pressable>
                  {last ? null : <View style={styles.stepLine} />}
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${step.item.name}, ${step.range}, ${step.done ? 'done' : step.status}. ${step.item.reason}`}
                  accessibilityHint="Shows why this step sits here"
                  onPress={() => onOpenStep?.(step.item)}
                  style={({ pressed }) => [styles.stepBody, last && styles.stepBodyLast, pressed && styles.pressed]}
                >
                  <View style={styles.stepHead}>
                    <Text style={[styles.stepName, step.done && styles.stepNameDone]}>{step.item.name}</Text>
                    <Text style={[styles.stepStatus, isNow && styles.stepStatusNow]}>{step.done ? 'Done' : step.status}</Text>
                  </View>
                  <Text style={styles.stepTime}>{step.range}</Text>
                  <Text style={styles.stepReason}>{step.item.reason}</Text>
                </Pressable>
              </View>
            );
          })}
        </View>
      ) : (
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
      )}
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
  forecast: { marginHorizontal: -space.gutter },
  bandButton: { alignSelf: 'flex-start', marginTop: 18, paddingHorizontal: 18 },
  section: { marginTop: space.section },
  sectionHead: { alignItems: 'baseline', flexDirection: 'row', gap: 8, justifyContent: 'space-between' },
  sectionMeta: { ...type.caption, color: ink.muted, flexShrink: 1, textAlign: 'right' },
  rhythmBar: { flexDirection: 'row', gap: 3, marginTop: 14 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 8 },
  legendItem: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  legendSwatch: { borderRadius: radius.swatch, height: 8, width: 8 },
  legendText: { ...type.small, color: ink.muted },
  steps: { marginTop: 18 },
  step: { flexDirection: 'row', gap: 14 },
  stepRail: { alignItems: 'center', width: 38 },
  stepIcon: { alignItems: 'center', backgroundColor: surface.card, borderColor: ink.border, borderRadius: 19, borderWidth: 1, height: 38, justifyContent: 'center', width: 38 },
  stepIconNow: { borderColor: accent.amberDeep, borderWidth: 1.5 },
  stepIconDone: { backgroundColor: ink.text, borderColor: ink.text },
  stepLine: { backgroundColor: ink.hairline, flex: 1, marginVertical: 4, width: 2 },
  stepBody: { flex: 1, minWidth: 0, paddingBottom: 18, paddingTop: 1 },
  stepBodyLast: { paddingBottom: 4 },
  stepHead: { alignItems: 'baseline', flexDirection: 'row', gap: 10, justifyContent: 'space-between' },
  stepName: { ...type.bodyStrong, color: ink.text, flexShrink: 1 },
  stepNameDone: { color: ink.muted, textDecorationLine: 'line-through' },
  stepStatus: { ...type.small, color: ink.muted },
  stepStatusNow: { color: accent.amberDeep, fontFamily: font.bodySemibold },
  stepTime: { color: ink.text, fontFamily: font.body, fontSize: 13, fontVariant: ['tabular-nums'], lineHeight: 18, marginTop: 2 },
  stepReason: { ...type.caption, color: ink.muted, marginTop: 3 },
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
  tonightTime: { color: bone.text, fontFamily: font.display, fontSize: 38, fontVariant: ['tabular-nums'], lineHeight: 47, marginTop: 6 },
  tonightNote: { color: bone.soft, fontFamily: font.body, fontSize: 12, lineHeight: 17, marginTop: 8 },
  tonightSide: { flex: 1, justifyContent: 'center' },
  tonightFigure: { paddingVertical: 6 },
  tonightFigureValue: { color: ink.text, fontFamily: font.display, fontSize: 24, fontVariant: ['tabular-nums'], lineHeight: 30 },
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
