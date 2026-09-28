import { useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-native';

import {
  generateCircadianBriefing,
  type CircadianBriefing,
  type SleepNeedEstimate,
  type SleepSession
} from '../../../src/engines/circadian';
import { useAuth } from '../../../src/features/auth/AuthProvider';
import { loadSleepHistory, saveSleepForSource } from '../../../src/features/sleepRhythm/sleepSessionSource';
import { SleepExperience } from '../../../src/features/sleepRhythm/SleepExperience';
import type { SleepRhythmSupabaseClient } from '../../../src/features/sleepRhythm/persistence';
import {
  createDefaultSleepNeedEstimate,
  createManualSleepSession
} from '../../../src/features/sleepRhythm/rhythmInputs';
import {
  sleepWindowToSession,
  type SleepWindowRecord
} from '../../../src/features/sleepRhythm/sleepWindowEngine';
import { supabase } from '../../../src/lib/supabase';
import { useQuickEntry } from '../../../src/features/navigation/useQuickEntry';
import { protocolScope } from '../../../src/features/dailyProtocol';
import {
  localDaylightStore,
  summariseDaylightDay,
  type DaylightBout
} from '../../../src/features/practice/daylightModel';
import { ChronotypeQuiz } from '../../../src/features/sleepRhythm/ChronotypeQuiz';
import { paletteFor } from '../../../src/features/sleepRhythm/SleepExperience';
import {
  chronotypePrior,
  readChronotype,
  saveChronotype,
  type ChronotypeRecord
} from '../../../src/features/sleepRhythm/chronotypeStore';
import { scoreChronotype, suggestDayArchitecture } from '../../../src/engines/circadian';
import type { MorningReport } from '../../../src/engines/circadian/sleepRecoveryAdapter';
import { localBiomarkerStore, saveManualReading } from '../../../src/features/biomarkers/biomarkerStore';
import type { BiomarkerReading } from '../../../src/engines/biomarkers';
import { MorningCheckIn } from '../../../src/features/sleepRhythm/MorningCheckIn';
import { localMorningReportStore, saveMorningReport, type MorningReportRow } from '../../../src/features/sleepRhythm/morningReportStore';

type RhythmDataMode = 'manual' | 'persisted' | 'demo';

const isUuid = (value: string | undefined): value is string =>
  Boolean(value?.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i));

function isValidTimeInput(value: string): boolean {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return false;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
}

function boundedQuality(value: string): number | null {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(1, Math.min(5, Math.round(parsed)));
}

export default function RhythmScreen() {
  const { user, mode } = useAuth();
  const [now, setNow] = useState(() => new Date().toISOString());
  const today = now.slice(0, 10);
  const [sleepSessions, setSleepSessions] = useState<SleepSession[]>([]);
  const [sleepNeed, setSleepNeed] = useState<SleepNeedEstimate>(() => createDefaultSleepNeedEstimate(now));
  const [dataMode, setDataMode] = useState<RhythmDataMode>('demo');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [sleepStartTime, setSleepStartTime] = useState('22:45');
  const [wakeTime, setWakeTime] = useState('06:45');
  /*
   * Starts unanswered rather than at 4. The old default silently asserted a good night on
   * behalf of anyone who never touched the form, and that value carried the largest single
   * weight in the forecast. An unset value now lowers confidence instead.
   */
  const [sleepQuality, setSleepQuality] = useState('');
  const [inputsTouched, setInputsTouched] = useState(false);
  const [logRequest, setLogRequest] = useState(0);
  useQuickEntry(() => setLogRequest((value) => value + 1), !isLoading);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date().toISOString()), 60_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadSleepRhythmData() {
      const userId = user?.id;
      try {
        const client = supabase as unknown as SleepRhythmSupabaseClient;
        const { sessions: recentSessions, sleepNeed: activeNeed } = await loadSleepHistory({ mode, userId, client });

        if (!isMounted) return;
        setSleepSessions(recentSessions);
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
        setDataMode(mode === 'account' ? 'persisted' : recentSessions.length > 0 ? 'manual' : 'demo');
      } catch {
        if (isMounted) {
          setSleepSessions([]);
          setSleepNeed(createDefaultSleepNeedEstimate(now));
          setDataMode(mode === 'account' ? 'persisted' : 'demo');
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    void loadSleepRhythmData();
    return () => {
      isMounted = false;
    };
  }, [mode, today, user?.id]); // now is intentionally excluded so the minute timer does not refetch persistence.

  const previewSession = useMemo(() => {
    if (!inputsTouched || !isValidTimeInput(sleepStartTime) || !isValidTimeInput(wakeTime)) return null;
    return createManualSleepSession({
      date: today,
      sleepStartTime,
      wakeTime,
      sleepQuality: boundedQuality(sleepQuality),
      createdAt: now
    });
  }, [inputsTouched, now, sleepQuality, sleepStartTime, today, wakeTime]);

  const briefingSessions = useMemo(
    () => previewSession
      ? [previewSession, ...sleepSessions.filter((session) => session.date !== today)]
      : sleepSessions,
    [previewSession, sleepSessions, today]
  );

  /*
   * Morning light is already being logged on the Mood tab, so the circadian engine reads
   * it rather than asking for it twice. It is the strongest zeitgeber there is, and it is
   * the one input here that was sitting in the app unused.
   */
  const [daylight, setDaylight] = useState<DaylightBout[]>([]);
  useEffect(() => {
    let active = true;
    void localDaylightStore.read(protocolScope(user?.id)).then((rows) => {
      if (active) setDaylight(rows);
    });
    return () => { active = false; };
  }, [user?.id]);

  /*
   * The clock someone described, used until their logged nights say otherwise. It also
   * replaces the 22:30 bedtime that used to be hardcoded here for everybody.
   */
  const [chronotype, setChronotype] = useState<ChronotypeRecord | null>(null);
  const [quizOpen, setQuizOpen] = useState(false);
  useEffect(() => {
    let active = true;
    void readChronotype(protocolScope(user?.id)).then((record) => {
      if (active) setChronotype(record);
    });
    return () => { active = false; };
  }, [user?.id]);

  /*
   * This morning's answers and pulse, for the sleep-to-energy prediction. The pulse is
   * the same resting-heart-rate reading Home shows, so it is typed once and read in both.
   */
  const [morningReports, setMorningReports] = useState<MorningReportRow[]>([]);
  const [biomarkers, setBiomarkers] = useState<BiomarkerReading[]>([]);
  useEffect(() => {
    let active = true;
    const scope = protocolScope(user?.id);
    void Promise.all([localMorningReportStore.read(scope), localBiomarkerStore.read(scope)]).then(([reports, readings]) => {
      if (!active) return;
      setMorningReports(reports);
      setBiomarkers(readings);
    });
    return () => { active = false; };
  }, [user?.id]);
  const morningReport = useMemo<MorningReport | null>(() => morningReports.find((row) => row.date === today) ?? null, [morningReports, today]);
  const morningPulses = useMemo(() => {
    const latest = new Map<string, BiomarkerReading>();
    for (const reading of biomarkers) {
      if (reading.kind !== 'resting_heart_rate') continue;
      const current = latest.get(reading.date);
      if (!current || reading.recorded_at > current.recorded_at) latest.set(reading.date, reading);
    }
    return [...latest.values()].map((reading) => ({ date: reading.date, bpm: reading.value }));
  }, [biomarkers]);
  async function updateMorningReport(patch: MorningReport) {
    const scope = protocolScope(user?.id);
    setMorningReports((rows) => rows.some((row) => row.date === today)
      ? rows.map((row) => (row.date === today ? { ...row, ...patch } : row))
      : [...rows, { ...patch, date: today, recordedAt: new Date().toISOString() }]);
    setMorningReports(await saveMorningReport(scope, today, patch));
  }
  async function saveMorningPulse(bpm: number) {
    setBiomarkers(await saveManualReading(protocolScope(user?.id), { kind: 'resting_heart_rate', value: bpm, date: today }));
  }

  const preferredBedtime = useMemo(() => {
    if (!chronotype || chronotype.accepted === false) return null;
    const bedtime = suggestDayArchitecture({
      preferredMidSleepMinutes: chronotype.preferredMidSleepMinutes,
      sleepNeedMinutes: sleepNeed.minutes
    }).find((slot) => slot.id === 'sleep');
    if (!bedtime) return null;
    const minutes = chronotype.slotOverrides.sleep ?? bedtime.startMinutes;
    return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
  }, [chronotype, sleepNeed]);

  const light = useMemo(() => {
    const morningDates = [...new Set(
      daylight.filter((bout) => bout.window === 'early' || bout.window === 'morning').map((bout) => bout.date)
    )];
    return { morningDates, todayMinutes: summariseDaylightDay(daylight, today).morningMinutes };
  }, [daylight, today]);

  const briefing: CircadianBriefing = useMemo(
    () => generateCircadianBriefing({
      date: today,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      recentSleepSessions: briefingSessions,
      sleepNeed,
      preferredBedtime,
      now,
      refreshment: boundedQuality(sleepQuality),
      morningLightDates: light.morningDates,
      morningLightMinutes: light.todayMinutes > 0 ? light.todayMinutes : null,
      chronotypeMidSleepMinutes: chronotypePrior(chronotype),
      morningReport,
      morningPulses
    }),
    [briefingSessions, chronotype, light, morningPulses, morningReport, now, preferredBedtime, sleepNeed, sleepQuality, today]
  );

  const lastNight = useMemo(() => briefingSessions.find((session) => session.date === today) ?? null, [briefingSessions, today]);
  const awakeFromWindow = useMemo(() => {
    const awake = (lastNight?.sleep_intervals ?? []).filter((interval) => interval.state === 'awake');
    if (!awake.length) return null;
    const minutes = awake.reduce((sum, interval) => sum + Math.max(0, (Date.parse(interval.end_at) - Date.parse(interval.start_at)) / 60000), 0);
    return { count: awake.length, minutes };
  }, [lastNight]);

  async function persistChronotype(answers: Record<string, string>, accepted: boolean, slotOverrides: Record<string, number>) {
    const scored = scoreChronotype(answers);
    const saved = await saveChronotype(protocolScope(user?.id), {
      answers,
      chronotype: scored.chronotype,
      preferredMidSleepMinutes: scored.preferredMidSleepMinutes,
      accepted,
      slotOverrides
    });
    setChronotype(saved);
    setQuizOpen(false);
  }

  async function handleManualSubmit() {
    const normalizedStart = sleepStartTime.trim();
    const normalizedWake = wakeTime.trim();

    if (!isValidTimeInput(normalizedStart) || !isValidTimeInput(normalizedWake)) {
      Alert.alert('Check sleep window', 'Enter a valid sleep and wake time.');
      return false;
    }

    const manualSession = createManualSleepSession({
      date: today,
      sleepStartTime: normalizedStart,
      wakeTime: normalizedWake,
      sleepQuality: boundedQuality(sleepQuality),
      createdAt: new Date().toISOString()
    });

    setIsSaving(true);
    try {
      const userId = user?.id;
      await saveSleepForSource({ mode, userId, client: supabase as unknown as SleepRhythmSupabaseClient }, manualSession);
      setSleepSessions((current) => [manualSession, ...current.filter((session) => session.date !== today)]);
      setDataMode(mode === 'account' ? 'persisted' : 'manual');
      setInputsTouched(false);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to save this sleep window right now.';
      Alert.alert('Sleep window not saved', `${message} Your draft is still open. Please try again.`);
      return false;
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSleepWindowSave(record: SleepWindowRecord) {
    const sleepSession = sleepWindowToSession(record, new Date().toISOString());

    setIsSaving(true);
    try {
      const userId = user?.id;
      await saveSleepForSource({ mode, userId, client: supabase as unknown as SleepRhythmSupabaseClient }, {
          ...sleepSession,
          correction_of_session_id: record.corrected_by_user && isUuid(record.based_on_session_id ?? undefined)
            ? record.based_on_session_id
            : null,
          original_source_id: record.based_on_session_id
      });
      setSleepSessions((current) => [sleepSession, ...current.filter((session) => session.date !== record.date)]);
      setDataMode(mode === 'account' ? 'persisted' : 'manual');
      setInputsTouched(false);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to sync this sleep window right now.';
      Alert.alert('Sleep window not saved', `${message} Your draft is still open. Please try again.`);
      return false;
    } finally {
      setIsSaving(false);
    }
  }

  if (quizOpen) {
    return (
      <ChronotypeQuiz
        initialAnswers={chronotype?.answers}
        palette={paletteFor(now)}
        sleepNeedMinutes={sleepNeed.minutes}
        onAccept={({ answers, slotOverrides }) => { void persistChronotype(answers, true, slotOverrides); }}
        onDecline={(answers) => { void persistChronotype(answers, false, {}); }}
        onClose={() => setQuizOpen(false)}
      />
    );
  }

  return (
    <SleepExperience
      chronotypeLabel={chronotype && chronotype.accepted !== false ? scoreChronotype(chronotype.answers).label : null}
      onOpenChronotype={() => setQuizOpen(true)}
      logRequest={logRequest}
      briefing={briefing}
      dataMode={dataMode}
      isLoading={isLoading}
      isSaving={isSaving}
      now={now}
      onSaveManual={handleManualSubmit}
      onSaveSleepWindow={handleSleepWindowSave}
      onSleepQualityChange={(value) => { setInputsTouched(true); setSleepQuality(value); }}
      onSleepStartTimeChange={(value) => { setInputsTouched(true); setSleepStartTime(value); }}
      onWakeTimeChange={(value) => { setInputsTouched(true); setWakeTime(value); }}
      sleepNeed={sleepNeed}
      sleepQuality={sleepQuality}
      sleepSessions={briefingSessions}
      sleepStartTime={sleepStartTime}
      wakeTime={wakeTime}
      morningSlot={
        <MorningCheckIn
          palette={paletteFor(now)}
          hasNight={lastNight !== null}
          report={morningReport}
          awakeFromWindow={awakeFromWindow}
          recovery={briefing.sleep_recovery ?? null}
          savedPulse={morningPulses.find((pulse) => pulse.date === today)?.bpm ?? null}
          onChange={(patch) => { void updateMorningReport(patch); }}
          onSavePulse={saveMorningPulse}
        />
      }
    />
  );
}
