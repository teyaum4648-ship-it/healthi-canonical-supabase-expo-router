import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../../../src/features/auth/AuthProvider';
import { protocolScope } from '../../../src/features/dailyProtocol';
import { DaylightLog } from '../../../src/features/practice/DaylightLog';
import { PacedBreath } from '../../../src/features/practice/PacedBreath';
import { PulseCheck } from '../../../src/features/practice/PulseCheck';
import { ZoneRelease } from '../../../src/features/practice/ZoneRelease';
import {
  anchorDetail,
  anchorHeadline,
  daylightLine,
  eveningNote,
  lightWindow,
  localDaylightStore,
  summariseDaylightDay,
  type DaylightBout,
  type LightWindow
} from '../../../src/features/practice/daylightModel';
import { localDateKey } from '../../../src/features/practice/practiceDate';
import {
  BREATH_RHYTHMS,
  practiceDayLine,
  summarisePracticeDay,
  type PracticeSession
} from '../../../src/features/practice/practiceModel';
import { localPracticeStore } from '../../../src/features/practice/practiceStore';
import {
  comparePulse,
  localPulseStore,
  pulseBaseline,
  pulseContext,
  summarisePulseDay,
  type PulseContext,
  type PulseMethod,
  type PulseReading
} from '../../../src/features/practice/pulseModel';
import {
  localZoneStore,
  regionRelease,
  summariseZoneDay,
  zoneDayLine,
  type TensionRegion,
  type ZoneSession
} from '../../../src/features/practice/zoneModel';
import { colors, hairlineWidth, type } from '../../../src/styles/mobileTheme';

/**
 * Mood — the fourth pillar, and the one that does something rather than reporting.
 *
 * The app was already three quarters of the four-doctors framing without saying so: Diet,
 * Movement and Sleep. The fourth seat was held by a calendar, which is a tool rather than
 * a pillar.
 *
 * Every block here is a lever, not a readout. A mood slider would be self-report in and
 * self-report out — no mechanism, impossible to be wrong, and telling you nothing you did
 * not know when you moved it. So the tab offers four things a person can actually do in
 * under five minutes with no hardware, and each one produces a number the app can be
 * wrong about:
 *
 *   Breathe    — the intervention that works fastest, measured in seconds actually done.
 *   Heart rate — a count, compared only against that person's own resting history.
 *   Daylight   — time outside, weighted by when, because that is what moves the clock.
 *   Tension    — where it sits, why it sits there, and one movement paced by the breath.
 *
 * Ordered by what a person reaches for. Breathing is the thing you open the tab to do at
 * a bad moment, so it stays first and above the fold; the rest is available rather than
 * demanded. Blocks with nothing to say are not rendered, which is why "today" summaries
 * appear only once there is a today.
 */

type Busy = 'pulse' | 'daylight' | 'zone' | null;

export default function MoodScreen() {
  const { user } = useAuth();
  const scope = useMemo(() => protocolScope(user?.id), [user?.id]);
  const date = localDateKey();

  const [sessions, setSessions] = useState<PracticeSession[]>([]);
  const [pulses, setPulses] = useState<PulseReading[]>([]);
  const [bouts, setBouts] = useState<DaylightBout[]>([]);
  const [zones, setZones] = useState<ZoneSession[]>([]);
  const [rhythmId, setRhythmId] = useState(BREATH_RHYTHMS[0].id);
  const [busy, setBusy] = useState<Busy>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void Promise.all([
        localPracticeStore.read(scope),
        localPulseStore.read(scope),
        localDaylightStore.read(scope),
        localZoneStore.read(scope)
      ]).then(([breath, pulse, daylight, zone]) => {
        if (!active) return;
        setSessions(breath);
        setPulses(pulse);
        setBouts(daylight);
        setZones(zone);
      });
      return () => { active = false; };
    }, [scope])
  );

  const day = useMemo(() => summarisePracticeDay(sessions, date), [sessions, date]);
  const pulseDay = useMemo(() => summarisePulseDay(pulses, date), [pulses, date]);
  const daylightDay = useMemo(() => summariseDaylightDay(bouts, date), [bouts, date]);
  const zoneDay = useMemo(() => summariseZoneDay(zones, date), [zones, date]);

  /* Built from the whole history, not today — a baseline made of one day is not one. */
  const baseline = useMemo(() => pulseBaseline(pulses), [pulses]);
  const latestComparison = useMemo(
    () => (pulseDay.latest && baseline ? comparePulse(pulseDay.latest.bpm, baseline) : null),
    [pulseDay.latest, baseline]
  );

  const rhythm = BREATH_RHYTHMS.find((item) => item.id === rhythmId) ?? BREATH_RHYTHMS[0];
  const evening = eveningNote(daylightDay);

  async function recordBreath(seconds: number) {
    const session: PracticeSession = {
      id: `breath-${Date.now()}`,
      date,
      rhythmId: rhythm.id,
      seconds,
      finishedAt: new Date().toISOString()
    };
    /* Optimistic, so the count moves the instant the circle stops. */
    setSessions((current) => [...current, session]);
    setSessions(await localPracticeStore.append(scope, session));
  }

  async function recordPulse(bpm: number, context: PulseContext, method: PulseMethod) {
    const reading: PulseReading = {
      id: `pulse-${Date.now()}`,
      date,
      bpm,
      context,
      method,
      takenAt: new Date().toISOString()
    };
    setBusy('pulse');
    setPulses((current) => [...current, reading]);
    setPulses(await localPulseStore.append(scope, reading));
    setBusy(null);
  }

  async function recordDaylight(minutes: number, window: LightWindow, estimated: boolean) {
    const bout: DaylightBout = {
      id: `light-${Date.now()}`,
      date,
      minutes,
      window,
      estimated,
      loggedAt: new Date().toISOString()
    };
    setBusy('daylight');
    setBouts((current) => [...current, bout]);
    setBouts(await localDaylightStore.append(scope, bout));
    setBusy(null);
  }

  async function recordZone(region: TensionRegion, seconds: number) {
    const session: ZoneSession = {
      id: `zone-${Date.now()}`,
      date,
      region,
      seconds,
      finishedAt: new Date().toISOString()
    };
    setBusy('zone');
    setZones((current) => [...current, session]);
    setZones(await localZoneStore.append(scope, session));
    setBusy(null);
  }

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>MOOD</Text>
          <Text style={styles.title}>Something you can do now</Text>
          <Text style={styles.meta}>{practiceDayLine(day)}</Text>
        </View>

        <View style={styles.panel}>
          <PacedBreath onSession={(seconds) => void recordBreath(seconds)} rhythm={rhythm} />
        </View>

        <View style={styles.panel}>
          <Text style={styles.eyebrow}>PACE</Text>
          <View style={styles.chips}>
            {BREATH_RHYTHMS.map((item) => {
              const active = item.id === rhythm.id;
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  key={item.id}
                  onPress={() => setRhythmId(item.id)}
                  style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && styles.pressed]}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{item.name}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.purpose}>{rhythm.purpose}</Text>
          <Text style={styles.ratio}>
            {Math.round(rhythm.inhaleMs / 1000)} in
            {rhythm.holdMs > 0 ? ` · ${Math.round(rhythm.holdMs / 1000)} hold` : ''}
            {` · ${Math.round(rhythm.exhaleMs / 1000)} out`}
          </Text>
        </View>

        <View style={styles.panel}>
          <PulseCheck busy={busy === 'pulse'} onReading={(bpm, context, method) => void recordPulse(bpm, context, method)} />
        </View>

        {latestComparison ? (
          <View style={styles.panel}>
            <Text style={styles.eyebrow}>LATEST READING</Text>
            <Text style={styles.readingHeadline}>{latestComparison.headline}</Text>
            <Text style={styles.readingDetail}>{latestComparison.detail}</Text>
            <Text style={styles.readingMeta}>
              {pulseDay.latest ? pulseContext(pulseDay.latest.context).label : ''}
              {baseline ? ` · usual range from ${baseline.sampleSize} resting ${baseline.sampleSize === 1 ? 'reading' : 'readings'}` : ''}
            </Text>
          </View>
        ) : null}

        <View style={styles.panel}>
          <DaylightLog busy={busy === 'daylight'} onLog={(minutes, window, estimated) => void recordDaylight(minutes, window, estimated)} />
        </View>

        {daylightDay.bouts.length > 0 ? (
          <View style={styles.panel}>
            <Text style={styles.eyebrow}>TODAY'S LIGHT</Text>
            <Text style={styles.readingHeadline}>{anchorHeadline(daylightDay)}</Text>
            <Text style={styles.readingDetail}>{anchorDetail(daylightDay)}</Text>
            <Text style={styles.readingMeta}>{daylightLine(daylightDay)}</Text>
            {daylightDay.bouts.map((bout, index) => (
              <View key={bout.id}>
                {index > 0 ? <View style={styles.divider} /> : null}
                <View style={styles.row}>
                  <Text style={styles.rowName}>{lightWindow(bout.window).label}</Text>
                  <Text style={styles.rowValue}>
                    {bout.estimated ? '~' : ''}{bout.minutes}m
                  </Text>
                </View>
              </View>
            ))}
            {evening ? <Text style={styles.note}>{evening}</Text> : null}
          </View>
        ) : null}

        <View style={styles.panel}>
          <ZoneRelease busy={busy === 'zone'} onSession={(region, seconds) => void recordZone(region, seconds)} />
        </View>

        {zoneDay.sessions.length > 0 ? (
          <View style={styles.panel}>
            <Text style={styles.eyebrow}>RELEASED TODAY</Text>
            <Text style={styles.readingMeta}>{zoneDayLine(zoneDay)}</Text>
            {zoneDay.regions.map((region, index) => (
              <View key={region}>
                {index > 0 ? <View style={styles.divider} /> : null}
                <View style={styles.row}>
                  <Text style={styles.rowName}>{regionRelease(region).label}</Text>
                  <Text style={styles.rowValue}>done</Text>
                </View>
              </View>
            ))}
          </View>
        ) : null}

        {day.sessions.length > 0 ? (
          <View style={styles.panel}>
            <Text style={styles.eyebrow}>BREATHING TODAY</Text>
            {day.sessions.map((session, index) => {
              const item = BREATH_RHYTHMS.find((entry) => entry.id === session.rhythmId);
              const minutes = Math.floor(session.seconds / 60);
              return (
                <View key={session.id}>
                  {index > 0 ? <View style={styles.divider} /> : null}
                  <View style={styles.row}>
                    <Text style={styles.rowName}>{item?.name ?? 'Breathing'}</Text>
                    <Text style={styles.rowValue}>
                      {minutes > 0 ? `${minutes}m ${session.seconds % 60}s` : `${session.seconds}s`}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        ) : null}

        {/*
          Not decoration. Everything above suggests a physical action, and a person having
          a genuinely bad moment should not have to leave the tab to find out this is not
          the thing to lean on.
        */}
        <Text style={styles.disclaimer}>
          None of this is medical advice, and none of it can tell you why a number moved.
          If something feels wrong, ask a professional. In an emergency call 911; for
          crisis support in the US, call or text 988.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { backgroundColor: colors.background, flex: 1 },
  scroll: { gap: 14, paddingBottom: 40, paddingHorizontal: 18, paddingTop: 8 },

  header: { gap: 4, paddingVertical: 6 },
  eyebrow: { ...type.label, color: colors.textFaint, fontSize: 12, letterSpacing: 1.1 },
  title: { ...type.title, color: colors.text },
  meta: { ...type.body, color: colors.textMuted },

  panel: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: hairlineWidth,
    gap: 12,
    padding: 18
  },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    backgroundColor: colors.surfaceInset,
    borderRadius: 999,
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 16
  },
  chipActive: { backgroundColor: colors.accent },
  chipText: { ...type.label, color: colors.textMuted },
  chipTextActive: { color: colors.primaryText },
  purpose: { ...type.caption, color: colors.textMuted, lineHeight: 19 },
  ratio: { ...type.label, color: colors.textFaint, fontVariant: ['tabular-nums'] },

  readingHeadline: { ...type.heading, color: colors.text },
  readingDetail: { ...type.body, color: colors.textMuted, lineHeight: 22 },
  readingMeta: { ...type.caption, color: colors.textFaint, lineHeight: 18 },
  note: {
    ...type.caption,
    backgroundColor: colors.surfaceInset,
    borderLeftColor: colors.accentMid,
    borderLeftWidth: 3,
    borderRadius: 10,
    color: colors.textMuted,
    lineHeight: 19,
    marginTop: 4,
    padding: 12
  },

  row: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  rowName: { ...type.body, color: colors.text },
  rowValue: { ...type.body, color: colors.textMuted, fontVariant: ['tabular-nums'] },
  divider: { backgroundColor: colors.border, height: hairlineWidth, marginVertical: 10 },
  pressed: { opacity: 0.7 },

  disclaimer: { ...type.caption, color: colors.textFaint, lineHeight: 18, paddingHorizontal: 4, paddingTop: 4 }
});
