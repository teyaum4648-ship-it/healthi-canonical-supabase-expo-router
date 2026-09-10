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
  const [sleepQuality, setSleepQuality] = useState('4');
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

  const briefing: CircadianBriefing = useMemo(
    () => generateCircadianBriefing({
      date: today,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      recentSleepSessions: briefingSessions,
      sleepNeed,
      preferredBedtime: '22:30',
      now
    }),
    [briefingSessions, now, sleepNeed, today]
  );

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

  return (
    <SleepExperience
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
    />
  );
}
