import { useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-native';

import {
  generateCircadianBriefing,
  type CircadianBriefing,
  type SleepNeedEstimate,
  type SleepSession
} from '../../../src/engines/circadian';
import { useAuth } from '../../../src/features/auth/AuthProvider';
import {
  getLocalSleepWindowSessions,
  saveLocalSleepWindowSession
} from '../../../src/features/sleepRhythm/localSleepWindowStore';
import { SleepExperience } from '../../../src/features/sleepRhythm/SleepExperience';
import {
  getActiveSleepNeedEstimate,
  getRecentSleepSessions,
  saveSleepSession,
  type SleepRhythmSupabaseClient
} from '../../../src/features/sleepRhythm/persistence';
import {
  createDefaultSleepNeedEstimate,
  createDemoSleepSessions,
  createManualSleepSession
} from '../../../src/features/sleepRhythm/rhythmInputs';
import {
  sleepWindowToSession,
  type SleepWindowRecord
} from '../../../src/features/sleepRhythm/sleepWindowEngine';
import { supabase } from '../../../src/lib/supabase';

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
  const { user } = useAuth();
  const [now, setNow] = useState(() => new Date().toISOString());
  const today = now.slice(0, 10);
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
    const interval = setInterval(() => setNow(new Date().toISOString()), 60_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadSleepRhythmData() {
      const userId = user?.id;
      if (!isUuid(userId)) {
        const localSessions = await getLocalSleepWindowSessions().catch(() => []);
        if (isMounted) {
          setSleepSessions(localSessions.length > 0 ? localSessions : createDemoSleepSessions(today));
          setSleepNeed(createDefaultSleepNeedEstimate(now));
          setDataMode(localSessions.length > 0 ? 'manual' : 'demo');
          setIsLoading(false);
        }
        return;
      }

      try {
        const client = supabase as unknown as SleepRhythmSupabaseClient;
        const [recentSessions, activeNeed] = await Promise.all([
          getRecentSleepSessions(client, userId, 21),
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

    void loadSleepRhythmData();
    return () => {
      isMounted = false;
    };
  }, [today, user?.id]); // now is intentionally excluded so the minute timer does not refetch persistence.

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
      if (isUuid(userId)) {
        await saveSleepSession(supabase as unknown as SleepRhythmSupabaseClient, userId, manualSession);
      } else {
        await saveLocalSleepWindowSession(manualSession);
      }
      setSleepSessions((current) => [manualSession, ...current.filter((session) => session.date !== today)]);
      setDataMode('manual');
      setInputsTouched(false);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to save this sleep window right now.';
      await saveLocalSleepWindowSession(manualSession).catch(() => undefined);
      Alert.alert('Saved on this device', `${message} Your local rhythm view has still been updated.`);
      setSleepSessions((current) => [manualSession, ...current.filter((session) => session.date !== today)]);
      setDataMode('manual');
      setInputsTouched(false);
      return true;
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSleepWindowSave(record: SleepWindowRecord) {
    const sleepSession = sleepWindowToSession(record, new Date().toISOString());

    setIsSaving(true);
    try {
      const userId = user?.id;
      if (isUuid(userId)) {
        await saveSleepSession(supabase as unknown as SleepRhythmSupabaseClient, userId, {
          ...sleepSession,
          correction_of_session_id: record.corrected_by_user && isUuid(record.based_on_session_id ?? undefined)
            ? record.based_on_session_id
            : null,
          original_source_id: record.based_on_session_id
        });
      } else {
        await saveLocalSleepWindowSession(sleepSession);
      }
      setSleepSessions((current) => [sleepSession, ...current.filter((session) => session.date !== record.date)]);
      setDataMode(isUuid(userId) ? 'persisted' : 'manual');
      setInputsTouched(false);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to sync this sleep window right now.';
      await saveLocalSleepWindowSession(sleepSession).catch(() => undefined);
      Alert.alert('Saved on this device', `${message} Your sleep window is still available here.`);
      setSleepSessions((current) => [sleepSession, ...current.filter((session) => session.date !== record.date)]);
      setDataMode('manual');
      setInputsTouched(false);
      return true;
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <SleepExperience
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
