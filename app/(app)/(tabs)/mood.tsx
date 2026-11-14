import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useMemo, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SegmentedControl } from '../../../src/components/mobile/SegmentedControl';
import { calculateMindScore, type MindSuggestion } from '../../../src/engines/mind';
import { useAuth } from '../../../src/features/auth/AuthProvider';
import type { ReadinessCheckin } from '../../../src/features/dashboard/readinessNow';
import { createReadinessNowDemoStore } from '../../../src/features/dashboard/readinessNowStore';
import { moodWeekCard } from '../../../src/features/dashboard/weekCards';
import { getDemoScheduleBlocksForDate } from '../../../src/features/dayPlan/localDemoScheduleStore';
import { getScheduleBlocksForDate, type DayScheduleBlockSupabaseClient } from '../../../src/features/dayPlan/scheduleBlockPersistence';
import { MoodToday } from '../../../src/features/practice/MoodToday';
import { HeadCheckCard, PracticeHeadCheck } from '../../../src/features/practice/HeadCheckCard';
import {
  createHeadCheck,
  headShift,
  latestHeadCheck,
  localHeadCheckStore,
  shiftsByTechnique,
  type HeadCheck,
  type HeadMoment,
  type HeadRating,
  type HeadShift
} from '../../../src/features/practice/headCheck';
import { moodRings, moodScoreInput, moodWeek } from '../../../src/features/practice/moodDashboardModel';
import type { SleepRhythmSupabaseClient } from '../../../src/features/sleepRhythm/persistence';
import { loadSleepHistory } from '../../../src/features/sleepRhythm/sleepSessionSource';
import type { SleepSession } from '../../../src/engines/circadian/types';
import { supabase } from '../../../src/lib/supabase';
import { protocolScope } from '../../../src/features/dailyProtocol';
import { CyclicBreathRounds } from '../../../src/features/practice/CyclicBreathRounds';
import { DaylightLog } from '../../../src/features/practice/DaylightLog';
import { MoodHabits } from '../../../src/features/practice/MoodHabitsPanel';
import { PacedBreath } from '../../../src/features/practice/PacedBreath';
import { PulseCheck } from '../../../src/features/practice/PulseCheck';
import { TechniquePicker } from '../../../src/features/practice/TechniquePicker';
import { ZoneRelease } from '../../../src/features/practice/ZoneRelease';
import {
  patternLine,
  techniqueById,
  type BreathTechnique
} from '../../../src/features/practice/breathTechniques';
import {
  createCustomHabit,
  DEFAULT_HABIT_IDS,
  localCustomHabitStore,
  localHabitCompletionStore,
  localRoutineStore,
  resolveRoutine,
  summariseHabitDay,
  type HabitCompletion,
  type MoodHabit
} from '../../../src/features/practice/moodHabits';
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
import { colors, hairlineWidth, type, glassSurface } from '../../../src/styles/mobileTheme';
import { tabAccent } from '../../../src/styles/pillarColors';
import { useTabBarSpace } from '../../../src/features/navigation/tabBarSpace';
import { ScreenHeader } from '../../../src/components/mobile/ScreenHeader';

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
 *
 * Those levers live under Practice. Today is the readout every other tab already had: the
 * day's Mind + Life Load from signals the app holds (sleep against need, today's plan, the
 * morning check-in, pulse against the person's own range, resets done — see engines/mind),
 * what weighs most, and one suggested reset that opens the practice it names.
 */

type Busy = 'pulse' | 'daylight' | 'zone' | null;
type Segment = 'Today' | 'Practice' | 'Trends';
const SEGMENTS: readonly Segment[] = ['Today', 'Practice', 'Trends'];
const checkinStore = createReadinessNowDemoStore(AsyncStorage);
const isUuid = (value: string | undefined): value is string =>
  Boolean(value?.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i));

export default function MoodScreen() {
  const tabSpace = useTabBarSpace();
  const { user, mode } = useAuth();
  const scope = useMemo(() => protocolScope(user?.id), [user?.id]);
  const date = localDateKey();

  const [sessions, setSessions] = useState<PracticeSession[]>([]);
  const [pulses, setPulses] = useState<PulseReading[]>([]);
  const [bouts, setBouts] = useState<DaylightBout[]>([]);
  const [zones, setZones] = useState<ZoneSession[]>([]);
  const [techniqueId, setTechniqueId] = useState('settle');
  const [routineIds, setRoutineIds] = useState<string[]>(DEFAULT_HABIT_IDS);
  const [customHabits, setCustomHabits] = useState<MoodHabit[]>([]);
  const [completions, setCompletions] = useState<HabitCompletion[]>([]);
  const [roundsAcknowledged, setRoundsAcknowledged] = useState(false);
  const [busy, setBusy] = useState<Busy>(null);
  const [segment, setSegment] = useState<Segment>('Today');
  const [sleepSessions, setSleepSessions] = useState<SleepSession[]>([]);
  const [sleepNeedMinutes, setSleepNeedMinutes] = useState<number | null>(null);
  const [scheduleBlocks, setScheduleBlocks] = useState<number | null>(null);
  const [checkins, setCheckins] = useState<ReadinessCheckin[]>([]);
  const [heads, setHeads] = useState<HeadCheck[]>([]);
  /* The before-and-after around one breathing session. */
  const [beforeHead, setBeforeHead] = useState<HeadRating | null>(null);
  const [awaitingAfter, setAwaitingAfter] = useState(false);
  const [lastShift, setLastShift] = useState<HeadShift | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void Promise.all([
        localPracticeStore.read(scope),
        localPulseStore.read(scope),
        localDaylightStore.read(scope),
        localZoneStore.read(scope),
        localHabitCompletionStore.read(scope),
        localCustomHabitStore.read(scope),
        localRoutineStore.read(scope),
        localHeadCheckStore.read(scope)
      ]).then(([breath, pulse, daylight, zone, done, custom, routine, head]) => {
        if (!active) return;
        setHeads(head);
        setSessions(breath);
        setPulses(pulse);
        setBouts(daylight);
        setZones(zone);
        setCompletions(done);
        setCustomHabits(custom);
        /* An empty store means a new person, not an emptied routine — those are
           different, and the second one writes a row with an empty list. */
        if (routine.length > 0) setRoutineIds(routine[0].habitIds);
        setRoundsAcknowledged(breath.some((row) => row.rhythmId === 'cyclic_hyperventilation'));
      });
      return () => { active = false; };
    }, [scope])
  );

  /*
   * The day's other signals, for the Today view. Each is read on its own and a failure
   * leaves that signal unknown, which lowers confidence rather than breaking the tab.
   */
  useFocusEffect(
    useCallback(() => {
      let active = true;
      const userId = user?.id;
      void loadSleepHistory({ mode, userId, client: supabase as unknown as SleepRhythmSupabaseClient })
        .then(({ sessions: nights, sleepNeed }) => { if (active) { setSleepSessions(nights); setSleepNeedMinutes(sleepNeed?.minutes ?? null); } })
        .catch(() => { if (active) setSleepSessions([]); });
      void (isUuid(userId)
        ? getScheduleBlocksForDate(supabase as unknown as DayScheduleBlockSupabaseClient, userId, date)
        : getDemoScheduleBlocksForDate(date))
        .then((blocks) => { if (active) setScheduleBlocks(blocks.length); })
        .catch(() => { if (active) setScheduleBlocks(null); });
      void checkinStore.read()
        .then((data) => { if (active) setCheckins(data.checkins); })
        .catch(() => { if (active) setCheckins([]); });
      return () => { active = false; };
    }, [date, mode, user?.id])
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

  const technique = techniqueById(techniqueId);
  const routine = useMemo(() => resolveRoutine(routineIds, customHabits), [routineIds, customHabits]);
  const habitDay = useMemo(
    () => summariseHabitDay(completions, routine, date),
    [completions, routine, date]
  );
  const evening = eveningNote(daylightDay);

  const mind = useMemo(() => calculateMindScore(moodScoreInput({
    today: date, sleepSessions, sleepNeedMinutes, scheduleBlocks, checkins, pulses, baseline,
    practice: day, daylight: daylightDay, zones: zoneDay, habits: habitDay, heads
  }), new Date().getHours()), [date, sleepSessions, sleepNeedMinutes, scheduleBlocks, checkins, pulses, baseline, day, daylightDay, zoneDay, habitDay, heads]);
  const latestHead = useMemo(() => latestHeadCheck(heads, date), [heads, date]);
  const helps = useMemo(() => shiftsByTechnique(heads), [heads]);
  const rings = useMemo(() => moodRings({ practice: day, daylight: daylightDay, habits: habitDay, zones: zoneDay }), [day, daylightDay, habitDay, zoneDay]);
  const week = useMemo(() => moodWeek(sessions, date), [sessions, date]);
  const weekCard = useMemo(() => moodWeekCard({ today: date, practice: sessions, daylight: bouts }), [date, sessions, bouts]);

  /* The suggestion opens the practice it names, ready to start. */
  function followSuggestion(suggestion: MindSuggestion) {
    if (suggestion.techniqueId) setTechniqueId(suggestion.techniqueId);
    setSegment('Practice');
  }

  async function recordHead(rating: HeadRating, moment: HeadMoment) {
    const row = createHeadCheck({ date, rating, moment, techniqueId: moment === 'now' ? null : technique.id });
    setHeads((current) => [...current, row]);
    setHeads(await localHeadCheckStore.append(scope, row));
  }

  function answerBefore(rating: HeadRating) {
    setBeforeHead(rating);
    setLastShift(null);
    void recordHead(rating, 'before');
  }

  function answerAfter(rating: HeadRating) {
    if (beforeHead) setLastShift(headShift(beforeHead, rating));
    setBeforeHead(null);
    setAwaitingAfter(false);
    void recordHead(rating, 'after');
  }

  async function recordBreath(seconds: number) {
    /* Long enough to have done something; the question after a five-second tap is noise. */
    if (seconds >= 30) setAwaitingAfter(true);
    const session: PracticeSession = {
      id: `breath-${Date.now()}`,
      date,
      rhythmId: technique.id,
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

  async function persistRoutine(ids: string[]) {
    setRoutineIds(ids);
    /* A single replaced row rather than an append, so the routine has one current value
       rather than a history that has to be folded. */
    await localRoutineStore.replace(scope, [{ id: 'routine', habitIds: ids }]);
  }

  async function addHabit(id: string) {
    if (routineIds.includes(id)) return;
    await persistRoutine([...routineIds, id]);
  }

  async function removeHabit(id: string) {
    await persistRoutine(routineIds.filter((existing) => existing !== id));
  }

  async function addCustomHabit(name: string, minutes: number) {
    const habit = createCustomHabit(name, minutes);
    setCustomHabits((current) => [...current, habit]);
    setCustomHabits(await localCustomHabitStore.append(scope, habit));
    await persistRoutine([...routineIds, habit.id]);
  }

  async function toggleHabit(habit: MoodHabit) {
    const alreadyDone = habitDay.completedIds.includes(habit.id);
    if (alreadyDone) {
      /* Unticking drops today's rows for that habit rather than writing a negative one,
         so a mis-tap leaves no trace to reason about later. */
      const kept = completions.filter((row) => !(row.date === date && row.habitId === habit.id));
      setCompletions(kept);
      setCompletions(await localHabitCompletionStore.replace(scope, kept));
      return;
    }
    const row: HabitCompletion = {
      id: `habit-${Date.now()}`,
      date,
      habitId: habit.id,
      completedAt: new Date().toISOString()
    };
    setCompletions((current) => [...current, row]);
    setCompletions(await localHabitCompletionStore.append(scope, row));
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
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: tabSpace }]} showsVerticalScrollIndicator={false}>
        <ScreenHeader title="Mood" />
        <SegmentedControl options={SEGMENTS} value={segment} onChange={setSegment} />

        {segment === 'Today' ? <HeadCheckCard helps={helps} latest={latestHead} onAnswer={(rating) => void recordHead(rating, 'now')} /> : null}
        {segment === 'Today' ? <MoodToday onSuggestion={followSuggestion} rings={rings} score={mind} week={week} /> : null}

        {segment === 'Trends' ? (
          <View style={styles.panel}>
            <Text style={styles.eyebrow}>The last seven days</Text>
            <Text style={styles.readingHeadline}>{weekCard.back.headline}</Text>
            <Text style={styles.readingDetail}>{weekCard.back.detail}</Text>
            <View style={styles.row}>
              <Text style={styles.rowName}>{weekCard.front.label.replace(/^./, (letter) => letter.toUpperCase())}</Text>
              <Text style={styles.rowValue}>{weekCard.front.value}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.row}>
              <Text style={styles.rowName}>Breathing time</Text>
              <Text style={styles.rowValue}>{weekCard.front.caption}</Text>
            </View>
            <Pressable accessibilityRole="link" onPress={() => router.navigate('/progress')} style={({ pressed }) => [styles.trendsLink, pressed && styles.pressed]}>
              <Text style={styles.trendsLinkText}>Open Trends for every pillar</Text>
            </Pressable>
          </View>
        ) : null}

        {segment === 'Practice' ? (<>
        <View style={styles.practiceHead}>
          <Text style={styles.subtitle}>Something you can do now</Text>
          <Text style={styles.meta}>{practiceDayLine(day)}</Text>
        </View>

        {/*
          Rounds get their own runner. The pattern is fast breaths, then a retention only
          the person can end, then a fixed recovery hold — a repeating cycle cannot
          express that, and pretending it could would mean pacing a technique wrongly.
        */}
        <View style={styles.panel}>
          {technique.structure === 'rounds' ? (
            <CyclicBreathRounds
              acknowledged={roundsAcknowledged}
              onAcknowledge={() => setRoundsAcknowledged(true)}
              onSession={(seconds) => void recordBreath(seconds)}
              technique={technique}
            />
          ) : (
            <>
              <View style={styles.breathHead}>
                <Text style={styles.breathName}>{technique.name}</Text>
                <Text style={styles.ratio}>{patternLine(technique)}</Text>
              </View>
              <PacedBreath onSession={(seconds) => void recordBreath(seconds)} technique={technique} />
              <Text style={styles.purpose}>{technique.when}</Text>
              {technique.caution ? <Text style={styles.inlineCaution}>{technique.caution}</Text> : null}
            </>
          )}
          <PracticeHeadCheck
            awaitingAfter={awaitingAfter}
            before={beforeHead}
            onAfter={answerAfter}
            onBefore={answerBefore}
            onSkip={() => { setAwaitingAfter(false); setBeforeHead(null); }}
            shift={lastShift}
          />
        </View>

        <View style={styles.panel}>
          <TechniquePicker onSelect={(next: BreathTechnique) => setTechniqueId(next.id)} selectedId={technique.id} />
        </View>

        <View style={styles.panel}>
          <MoodHabits
            day={habitDay}
            onAdd={(habit) => void addHabit(habit.id)}
            onAddCustom={(name, minutes) => void addCustomHabit(name, minutes)}
            onRemove={(habit) => void removeHabit(habit.id)}
            onToggle={(habit) => void toggleHabit(habit)}
            routine={routine}
          />
        </View>

        <View style={styles.panel}>
          <PulseCheck busy={busy === 'pulse'} onReading={(bpm, context, method) => void recordPulse(bpm, context, method)} />
        </View>

        {latestComparison ? (
          <View style={styles.panel}>
            <Text style={styles.eyebrow}>Latest reading</Text>
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
            <Text style={styles.eyebrow}>Today’s light</Text>
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
            <Text style={styles.eyebrow}>Released today</Text>
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
            <Text style={styles.eyebrow}>Breathing today</Text>
            {day.sessions.map((session, index) => {
              const item = techniqueById(session.rhythmId);
              const minutes = Math.floor(session.seconds / 60);
              return (
                <View key={session.id}>
                  {index > 0 ? <View style={styles.divider} /> : null}
                  <View style={styles.row}>
                    <Text style={styles.rowName}>{item.name}</Text>
                    <Text style={styles.rowValue}>
                      {minutes > 0 ? `${minutes}m ${session.seconds % 60}s` : `${session.seconds}s`}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        ) : null}

        </>) : null}

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
  safe: { backgroundColor: 'transparent', flex: 1 },
  scroll: { gap: 14, paddingBottom: 40, paddingHorizontal: 18, paddingTop: 8 },

  header: { gap: 4, paddingTop: 6 },
  practiceHead: { gap: 4, paddingHorizontal: 4 },
  trendsLink: { alignItems: 'center', backgroundColor: colors.surfaceInset, borderRadius: 14, justifyContent: 'center', marginTop: 4, minHeight: 48 },
  trendsLinkText: { ...type.label, color: tabAccent.mood },
  eyebrow: { ...type.label, color: colors.textMuted, fontSize: 13, letterSpacing: 0 },
  title: { ...type.largeTitle, color: colors.text },
  subtitle: { ...type.body, fontWeight: '600', color: colors.text },
  meta: { ...type.body, color: colors.textMuted },

  panel: {
    ...glassSurface,
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
  chipActive: { backgroundColor: tabAccent.mood },
  chipText: { ...type.label, color: colors.textMuted },
  chipTextActive: { color: colors.primaryText },
  purpose: { ...type.caption, color: colors.textMuted, lineHeight: 19 },
  breathHead: { alignItems: 'baseline', flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between' },
  breathName: { ...type.heading, color: colors.text },
  inlineCaution: { ...type.caption, color: colors.danger, lineHeight: 19 },
  ratio: { ...type.label, color: colors.textFaint, fontVariant: ['tabular-nums'] },

  readingHeadline: { ...type.heading, color: colors.text },
  readingDetail: { ...type.body, color: colors.textMuted, lineHeight: 22 },
  readingMeta: { ...type.caption, color: colors.textFaint, lineHeight: 18 },
  note: {
    ...type.caption,
    backgroundColor: colors.surfaceInset,
    borderLeftColor: tabAccent.mood,
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
