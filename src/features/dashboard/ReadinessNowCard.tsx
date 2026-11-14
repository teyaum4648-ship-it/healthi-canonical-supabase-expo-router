import AsyncStorage from '@react-native-async-storage/async-storage';
import { useIsFocused } from '@react-navigation/native';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ActivityIndicator, AppState, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { EntrySheet } from '../../components/mobile/EntrySheet';
import { ActionRow } from '../../components/mobile/ActionRow';
import type { DailyReadinessResult } from '../../engines/readiness';
import { accentFill, colors, glass, glassSurface, type } from '../../styles/mobileTheme';
import { localDay } from '../../utils/localDay';
import { createDemoWaterStore, type WaterEntry } from '../nutrition/hydrationStore';
import { quickEntryHref } from '../navigation/navigationModel';
import { SleepTimePicker } from '../sleepRhythm/SleepTimePicker';
import { readinessHeadline, readinessZone } from './dashboardZones';
import { LoggingPrompts } from './LoggingPromptsPanel';
import { ReadinessHub } from './premium/ReadinessHub';
import type { PillarReading } from './premium/pillarRingModel';
import type { ZoneTone } from '../../styles/mobileTheme';
import type { DataConfidence } from '../../types/common';
import { loggingPrompts, type LoggingPromptId } from './loggingPrompts';
import {
  domainNames, evaluateReadinessNow, localWakeTimestamp, READINESS_NOW_POLICY, shouldRemindAboutLunch,
  type IntakeAnswer, type ReadinessCheckin, type ReadinessReminderPreferences
} from './readinessNow';
import { createReadinessNowDemoStore, type ReadinessNowDemoData } from './readinessNowStore';

const store = createReadinessNowDemoStore(AsyncStorage);
const waterStore = createDemoWaterStore(AsyncStorage);
const timePalette = {
  surface: colors.surface, surfaceAlt: colors.surfaceInset, border: colors.borderStrong, hairline: colors.hairline,
  text: colors.text, muted: colors.textMuted, faint: colors.textMuted, accent: colors.accentMid,
  accentSoft: colors.accentSoft, primary: colors.primary, primaryText: colors.primaryText, amber: '#F2C87E', chip: colors.surfaceMuted
};
const timeLabel = (value: string) => new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
function clockLabel(value: string) {
  const [h, m] = value.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}
function Button({ title, label, onPress, disabled = false, secondary = false, grow = false, wide = false }: { title: string; label?: string; onPress: () => void; disabled?: boolean; secondary?: boolean; grow?: boolean; wide?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.button, secondary && styles.secondary, grow && styles.grow, wide && styles.wide, (pressed || disabled) && { opacity: .6 }]}><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85} style={[styles.buttonText, secondary && styles.secondaryText]}>{title}</Text></Pressable>;
}
function Choices<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; title: string }[]; onChange: (value: T) => void }) {
  return <View style={styles.group}><Text style={styles.heading}>{label}</Text><View style={styles.choices}>{options.map(o => <Pressable key={o.value} accessibilityRole="radio" accessibilityLabel={`${label}: ${o.title}`} accessibilityState={{ checked: o.value === value }} onPress={() => onChange(o.value)} style={[styles.choice, o.value === value && styles.selected]}><Text style={styles.body}>{o.title}</Text></Pressable>)}</View></View>;
}

function CheckinSheet({ onClose, onSave }: { onClose: () => void; onSave: (c: ReadinessCheckin) => Promise<void> }) {
  // Deliberately blank on each opening: yesterday's or a stale answer is not a current confirmation.
  const [food, setFood] = useState<IntakeAnswer>('unknown');
  const [water, setWater] = useState<IntakeAnswer>('unknown');
  const [energy, setEnergy] = useState<ReadinessCheckin['energy']>('unknown');
  const [demand, setDemand] = useState<ReadinessCheckin['demand']>('unknown');
  const [wake, setWake] = useState<string | null>(null);
  const [wakeDay, setWakeDay] = useState<'today' | 'yesterday'>('today');
  const [picker, setPicker] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function save() {
    const now = new Date();
    const wokeAt = wake ? localWakeTimestamp(wake, wakeDay === 'yesterday', now) : null;
    if (wake && !wokeAt) { setError('Choose a wake time within the past 24 hours, or leave it unknown.'); return; }
    setBusy(true); setError(null);
    try {
      await onSave({ id: now.toISOString(), at: now.toISOString(), woke_at: wokeAt, food, water, energy, demand });
      onClose();
    } catch { setError('Your check-in could not be saved. Your answers are still here—try again.'); }
    finally { setBusy(false); }
  }
  if (picker) return <SleepTimePicker label="Woke up" value={wake ?? ''} palette={timePalette} onCancel={() => setPicker(false)} onDone={value => { setWake(value); setPicker(false); }} />;
  const intakeOptions: { value: IntakeAnswer; title: string }[] = [{ value: 'some', title: 'Yes' }, { value: 'none', title: 'Not yet' }, { value: 'unknown', title: 'Skip' }];
  return <EntrySheet title="How are you right now?" onClose={onClose} busy={busy} footer={<Button title={busy ? 'Saving…' : 'Update my picture'} disabled={busy} onPress={() => void save()} />}>
    <Text style={styles.muted}>A quick check-in before your next activity. Skip anything you’re unsure about. This does not create meal, water, or sleep logs.</Text>
    <ActionRow title="When did you wake up?" detail={wake ? `${clockLabel(wake)} · ${wakeDay}` : 'Optional · tap to choose a time'} icon="sunny-outline" onPress={() => setPicker(true)} last />
    {wake ? <><Choices label="Wake day" value={wakeDay} options={[{ value: 'today', title: 'Today' }, { value: 'yesterday', title: 'Yesterday' }]} onChange={setWakeDay} /><Button secondary title="Leave wake time unknown" onPress={() => setWake(null)} /></> : null}
    <Choices label="Have you eaten since waking?" value={food} options={intakeOptions} onChange={setFood} />
    <Choices label="Have you had water since waking?" value={water} options={intakeOptions} onChange={setWater} />
    <Choices label="Your energy right now" value={energy} options={[{ value: 'steady', title: 'Steady' }, { value: 'tired', title: 'Tired' }, { value: 'unknown', title: 'Skip' }]} onChange={setEnergy} />
    <Choices label="How has your day felt?" value={demand} options={[{ value: 'usual', title: 'Usual' }, { value: 'demanding', title: 'Demanding' }, { value: 'unknown', title: 'Skip' }]} onChange={setDemand} />
    {error ? <Text accessibilityRole="alert" style={styles.notice}>{error}</Text> : null}
    <Text style={styles.muted}>Saved on this device for this demo. An estimate is not permission to train through pain or override professional guidance.</Text>
  </EntrySheet>;
}

function ReminderSheet({ initial, onClose, onSave }: { initial: ReadinessReminderPreferences; onClose: () => void; onSave: (p: ReadinessReminderPreferences) => Promise<void> }) {
  const [draft, setDraft] = useState(initial);
  const [picker, setPicker] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  if (picker) return <SleepTimePicker label="Usual lunch" value={draft.lunchTime} palette={timePalette} onCancel={() => setPicker(false)} onDone={value => { setDraft(d => ({ ...d, lunchTime: value })); setPicker(false); }} />;
  return <EntrySheet title="Gentle reminders" onClose={onClose} busy={busy} footer={<Button disabled={busy} title={busy ? 'Saving…' : 'Save preferences'} onPress={() => { setBusy(true); setError(false); void onSave(draft).then(onClose).catch(() => setError(true)).finally(() => setBusy(false)); }} />}>
    <Text style={styles.muted}>Only on Home while you have the demo open. No phone alerts, background tracking, or repeated notifications.</Text>
    <View style={styles.row}><Text style={[styles.heading, { flex: 1 }]}>Remind me to log lunch</Text><Switch accessibilityLabel="Lunch reminders" value={draft.enabled} onValueChange={enabled => setDraft(d => ({ ...d, enabled }))} /></View>
    <ActionRow title="Usual lunch time" detail={clockLabel(draft.lunchTime)} icon="time-outline" onPress={() => setPicker(true)} last />
    <Choices label="Remind me after" value={String(draft.delayMinutes)} options={['30', '45', '60'].map(value => ({ value, title: `${value} min` }))} onChange={value => setDraft(d => ({ ...d, delayMinutes: Number(value) as 30 | 45 | 60 }))} />
    <Text style={styles.muted}>Quiet hours: 9 PM–8 AM. A recent meal log or “Yes, I ate” check-in keeps the reminder quiet. Your lunch preference is never treated as proof you ate.</Text>
    {error ? <Text accessibilityRole="alert" style={styles.notice}>Preferences could not save. Please try again.</Text> : null}
  </EntrySheet>;
}

/** Device-local demo only. The account Home continues using its existing daily briefing. */
export function ReadinessNowCard({ base, mealTimes, safetyActive, details, checkinRequest = 0, sleepMissing, sessionsThisWeek, refreshKey = 0, onCheckinSaved, trendFor, onOpenDetail, onReading }: {
  base: DailyReadinessResult; mealTimes: string[]; safetyActive: boolean;
  /** The biomarker breakdown, revealed under the ring with what moved the estimate. */
  details?: ReactNode; checkinRequest?: number;
  /** Whether last night is missing, and the week's session count, for the logging rows. */
  sleepMissing: boolean; sessionsThisWeek: number | null;
  /** Bumped by Home when it logs something this card reads, such as a glass of water. */
  refreshKey?: number;
  /** Called after a check-in is saved, so Home can read its answers into readiness. */
  onCheckinSaved?: () => void;
  /** Today against the person's own recent days, for whatever number this card settles on. */
  trendFor?: (score: number | null) => { text: string; direction: 'up' | 'down' | 'flat' } | null;
  onOpenDetail?: () => void;
  /** Reports the number shown, so the week strip and the breakdown screen match it. */
  onReading?: (reading: { score: number | null; zone: ZoneTone; word: string; insight: string; pillars: readonly PillarReading[]; confidence: DataConfidence }) => void;
}) {
  const focused = useIsFocused();
  const [now, setNow] = useState(() => new Date().toISOString());
  const day = localDay(now);
  const [data, setData] = useState<ReadinessNowDemoData | null>(null);
  const [water, setWater] = useState<WaterEntry[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [sheet, setSheet] = useState<'checkin' | 'why' | 'reminders' | null>(null);
  const [savingReminder, setSavingReminder] = useState(false);
  const [reminderError, setReminderError] = useState(false);
  useEffect(() => { if (checkinRequest) setSheet('checkin'); }, [checkinRequest]);
  useEffect(() => {
    if (!focused) return;
    const tick = () => setNow(new Date().toISOString());
    tick();
    const interval = setInterval(tick, 30000);
    const app = AppState.addEventListener('change', state => { if (state === 'active') tick(); });
    const onVisible = () => { if (document.visibilityState === 'visible') tick(); };
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(interval); app.remove(); if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisible); };
  }, [focused]);
  useFocusEffect(useCallback(() => {
    let active = true;
    setData(null); setLoadError(false);
    void Promise.all([store.read(), waterStore.read()]).then(([next, entries]) => { if (active) { setData(next); setWater(entries); } }).catch(() => { if (active) setLoadError(true); });
    return () => { active = false; };
  }, [day, retry, refreshKey]));
  const result = useMemo(() => evaluateReadinessNow({ now, base, mealTimes, waterTimes: water.map(w => w.logged_at), checkins: data?.checkins ?? [], safetyActive }), [now, base, mealTimes, water, data, safetyActive]);
  const waterToday = useMemo(() => water.filter(w => localDay(w.logged_at) === day).length, [water, day]);
  const shownZone = readinessZone(result.publicScore, safetyActive);
  const shownHeadline = readinessHeadline(shownZone, result.attention[0]?.text ?? result.summary);
  useEffect(() => {
    if (!data) return;
    onReading?.({ score: result.publicScore, zone: shownZone, word: shownHeadline.word, insight: shownHeadline.insight, pillars: result.ledger, confidence: result.confidence });
  }, [data, onReading, result.confidence, result.ledger, result.publicScore, shownHeadline.insight, shownHeadline.word, shownZone]);
  const promptRows = useMemo(() => data ? loggingPrompts({
    sleepMissing,
    checkin: result.checkin ? { at: result.checkin.at, stale: (result.ageMinutes ?? 0) > READINESS_NOW_POLICY.freshnessMinutes } : null,
    mealsToday: mealTimes.filter(t => localDay(t) === day).length,
    waterToday,
    sessionsThisWeek,
    clock: timeLabel
  }) : null, [data, sleepMissing, result.checkin, result.ageMinutes, mealTimes, day, waterToday, sessionsThisWeek]);
  function promptAction(id: LoggingPromptId) {
    setSheet(id === 'checkin' ? 'checkin' : null);
    if (id === 'sleep') router.navigate(quickEntryHref('sleep'));
    if (id === 'food') router.navigate(quickEntryHref('food'));
    if (id === 'movement') router.navigate(quickEntryHref('workout'));
  }
  async function saveReminders(prefs: ReadinessReminderPreferences) { setData(await store.saveReminders(prefs)); }
  async function quietReminder(kind: 'later' | 'today') {
    if (!data) return;
    setSavingReminder(true); setReminderError(false);
    try { await saveReminders({ ...data.reminders, ...(kind === 'today' ? { dismissedDay: day } : { snoozedUntil: new Date(Date.now() + 30 * 60000).toISOString() }) }); }
    catch { setReminderError(true); }
    finally { setSavingReminder(false); }
  }
  if (!data) return <View style={styles.card}><Text style={styles.heading}>Readiness now</Text>{loadError ? <><Text accessibilityRole="alert" style={styles.muted}>Your saved context could not load. We won’t show a number based on a partial read.</Text><Button secondary title="Try again" onPress={() => setRetry(n => n + 1)} /></> : <ActivityIndicator accessibilityLabel="Loading readiness context" color={colors.accentMid} />}</View>;
  const remind = focused && shouldRemindAboutLunch(now, data.reminders, mealTimes, data.checkins);
  const zone = shownZone;
  const headline = shownHeadline;
  return <>
    {/*
      The estimate stands on the page rather than in a box: the ring, what it means, what
      each foundation contributed, one line of context and the two things to do next.
    */}
    <ReadinessHub
      score={result.publicScore}
      zone={zone}
      word={headline.word}
      insight={headline.insight}
      note={headline.insight === (result.attention[0]?.text ?? result.summary) ? undefined : result.attention[0]?.text}
      meta={`${timeLabel(now)} · ${result.publicScore !== null ? `${result.confidence === 'low' ? 'Limited' : 'Moderate'} confidence` : 'No current number yet'} · ${result.checkin ? `Checked in ${timeLabel(result.checkin.at)}${result.state === 'update_needed' ? ', update needed' : ''}` : 'No check-in yet'} · Demo`}
      primaryLabel={result.checkin ? 'Update check-in' : 'Check in'}
      onPrimary={() => setSheet('checkin')}
      onWhy={() => setSheet('why')}
      details={details}
      pillars={result.ledger}
      trend={trendFor?.(result.publicScore) ?? null}
      onOpenDetail={onOpenDetail}
    />
    {remind ? <View style={styles.card}><Text style={styles.heading}>A moment for your food diary?</Text><Text style={styles.muted}>If you’ve had lunch, you can add it now. An empty diary doesn’t mean you skipped a meal.</Text><Button title="Log lunch" onPress={() => router.navigate(quickEntryHref('food'))} /><View style={styles.choices}><Button secondary disabled={savingReminder} title="In 30 minutes" onPress={() => void quietReminder('later')} /><Button secondary disabled={savingReminder} title="Not today" onPress={() => void quietReminder('today')} /></View>{reminderError ? <Text accessibilityRole="alert" style={styles.notice}>Could not save that preference. Please try again.</Text> : null}</View> : null}
    {sheet === 'checkin' ? <CheckinSheet onClose={() => setSheet(null)} onSave={async c => { setData(await store.saveCheckin(c)); setNow(new Date().toISOString()); onCheckinSaved?.(); }} /> : null}
    {sheet === 'reminders' ? <ReminderSheet initial={data.reminders} onSave={saveReminders} onClose={() => setSheet(null)} /> : null}
    {sheet === 'why' ? <EntrySheet title="Your current picture" onClose={() => setSheet(null)}>
      {promptRows ? <LoggingPrompts rows={promptRows} onAction={promptAction} /> : null}
      <Text style={styles.muted}>{result.summary}</Text>
      <Text style={styles.heading}>What’s supporting you</Text>
      {result.supporting.length ? result.supporting.map(row => <Text key={row.domain} style={styles.body}>{domainNames[row.domain]} · {row.text}</Text>) : <Text style={styles.muted}>Supportive signals will appear as you add real context.</Text>}
      <Text style={styles.heading}>What to consider</Text>
      {result.attention.length ? result.attention.map(row => <Text key={row.domain} style={styles.body}>{domainNames[row.domain]} · {row.text}</Text>) : <Text style={styles.muted}>No additional watch signal from the available context. This is not a safety clearance.</Text>}
      <Text style={styles.heading}>Still unknown</Text>
      {result.unknown.length ? result.unknown.map(text => <Text key={text} style={styles.muted}>{text}</Text>) : <Text style={styles.muted}>The check-in is current. Logged information still cannot measure your physiology.</Text>}
      <Text style={styles.heading}>How the estimate is built</Text>
      <Text style={styles.muted}>Experimental demo policy v{result.policyVersion}. Baseline: {base.contributions?.baseline ?? 'unavailable'} points. Missing information adds no deduction. Check-ins replace a foundation’s contribution, not stack onto it. The existing daily protocol is unchanged.</Text>
      {result.ledger.map(row => <View key={row.domain} style={styles.auditRow}><Text style={styles.body}>{domainNames[row.domain]}: {row.before > 0 ? '+' : ''}{row.before}{row.before !== row.contribution ? ` → ${row.contribution}` : ''} points</Text><Text style={styles.muted}>{row.missing ? 'Base evidence incomplete.' : base.driver_cards.find(d => d.domain === row.domain)?.detail}{row.explanation ? ` ${row.explanation}` : ''}</Text></View>)}
      <ActionRow title="Lunch reminder" detail={data.reminders.enabled ? `On · ${clockLabel(data.reminders.lunchTime)}` : 'Off'} icon="notifications-outline" onPress={() => setSheet('reminders')} last />
      <Text style={styles.muted}>A check-in stays current for two hours. With a confirmed wake time, “no water” is considered after four hours awake and “no food” after six. These are cautious demo rules—not biological cutoffs. They never compound with each clock tick. Morning has room for routines; an old morning check-in cannot masquerade as a fresh evening assessment.</Text>
    </EntrySheet> : null}
  </>;
}

const styles = StyleSheet.create({
  card: { ...glassSurface, padding: 20, borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, borderColor: glass.edge, gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { ...type.heading, color: colors.text, fontSize: 24, lineHeight: 30 },
  headCopy: { flex: 1, minWidth: 0, gap: 4 },
  buttonRow: { flexDirection: 'row', gap: 10, alignSelf: 'stretch', marginTop: 4 },
  grow: { flex: 1, paddingHorizontal: 10 },
  wide: { flex: 1.45 },
  heading: { ...type.body, fontWeight: '600', color: colors.text, marginTop: 4 },
  eyebrow: { ...type.caption, fontSize: 14, color: colors.accentMid, fontWeight: '600' },
  body: { ...type.body, color: colors.text },
  muted: { ...type.body, color: colors.textMuted, lineHeight: 23 },
  meta: { ...type.caption, color: colors.textMuted, lineHeight: 20 },
  button: { minHeight: 50, borderRadius: 16, ...accentFill(colors.primary), justifyContent: 'center', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16 },
  buttonText: { ...type.body, color: colors.primaryText, fontWeight: '600' },
  secondaryText: { color: colors.text },
  secondary: { ...glassSurface, borderWidth: StyleSheet.hairlineWidth, borderColor: glass.edge },
  group: { gap: 10, marginVertical: 6 },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: { minHeight: 46, paddingVertical: 11, paddingHorizontal: 16, borderRadius: 13, backgroundColor: colors.surfaceInset, borderWidth: 1, borderColor: colors.borderStrong },
  selected: { backgroundColor: colors.accentWash, borderColor: colors.accentMid },
  notice: { ...type.body, color: '#F2C87E' },
  auditRow: { borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.borderStrong, paddingTop: 12, gap: 4 }
});
