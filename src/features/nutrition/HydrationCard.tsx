import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { EntrySheet } from '../../components/mobile/EntrySheet';
import { SegmentedControl } from '../../components/mobile/SegmentedControl';
import { colors, type } from '../../styles/mobileTheme';
import { tabAccent } from '../../styles/pillarColors';
import { dietAccents } from './DietDashboard';
import { createDemoWaterStore, createWaterEntry, formatWater, readWater, saveWater, undoWater, waterAmountMl, waterForDay, type HydrationClient, type WaterEntry, type WaterUnit } from './hydrationStore';

const demoStore = createDemoWaterStore(AsyncStorage);
export function HydrationCard({ userId, demo, client, date }: { userId: string | null; demo: boolean; client: HydrationClient | null; date: string }) {
  const [entries, setEntries] = useState<WaterEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [unit, setUnit] = useState<WaterUnit>('mL');
  const [amount, setAmount] = useState('250');
  const [error, setError] = useState('');
  const [lastAdded, setLastAdded] = useState<WaterEntry | null>(null);
  const [notice, setNotice] = useState('');
  const pending = useRef<WaterEntry | null>(null);
  const lock = useRef(false);
  const mounted = useRef(true);
  const allowed = Boolean(userId && (demo && userId === 'demo-user' || !demo && client));
  const parsed = waterAmountMl(amount, unit);
  const total = entries.reduce((sum, entry) => sum + entry.amount_ml, 0);
  async function load() {
    setLoading(true); setError(''); setLoadFailed(false);
    try {
      if (!allowed || !userId) throw new Error('Water logging is unavailable for this account.');
      const rows = demo ? waterForDay(await demoStore.read(), 'demo-user', date) : await readWater(client!, userId, date);
      if (mounted.current) setEntries(rows);
    } catch { if (mounted.current) { setError('Water entries could not load. Retry before adding water.'); setLoadFailed(true); } }
    finally { if (mounted.current) setLoading(false); }
  }
  useEffect(() => { mounted.current = true; void load(); return () => { mounted.current = false; }; }, []);
  async function add(amountMl: number) {
    if (lock.current || !allowed || !userId || loading || loadFailed) return;
    lock.current = true; setBusy(true); setError('');
    const entry = pending.current ?? createWaterEntry(amountMl, userId, date);
    pending.current = entry;
    try {
      if (demo) await demoStore.save(entry); else await saveWater(client!, userId, entry);
      if (mounted.current) { setEntries(rows => [...rows.filter(e => e.id !== entry.id), entry]); setLastAdded(entry); setNotice(`${formatWater(entry.amount_ml, unit)} added`); setSheet(false); }
      pending.current = null;
    } catch { if (mounted.current) setError('Water was not confirmed saved. Retry to safely finish this entry.'); }
    finally { lock.current = false; if (mounted.current) setBusy(false); }
  }
  async function undo() {
    if (lock.current || !lastAdded || !userId) return;
    lock.current = true; setBusy(true); setError('');
    try {
      if (demo) await demoStore.undo(lastAdded.id); else await undoWater(client!, userId, lastAdded.id);
      if (mounted.current) { setEntries(rows => rows.filter(e => e.id !== lastAdded.id)); setLastAdded(null); setNotice('Last water entry removed'); }
    } catch { if (mounted.current) setError('Could not undo. Your water entry is still saved.'); }
    finally { lock.current = false; if (mounted.current) setBusy(false); }
  }
  return <>
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={styles.icon} />
        <View style={styles.copy}><Text style={styles.title}>Water</Text><Text style={styles.detail}>{loading ? 'Loading…' : loadFailed ? 'Unable to load' : entries.length ? `${formatWater(total, unit)} logged` : 'Not logged yet'}</Text></View>
        <Pressable accessibilityRole="button" accessibilityLabel="Add water" disabled={!allowed || loading || loadFailed || busy} onPress={() => { setSheet(true); setError(''); }} style={[styles.add, (!allowed || loading || loadFailed || busy) && styles.dim]}><Ionicons name="add" size={20} color={dietAccents.water} /><Text style={styles.addText}>Add</Text></Pressable>
      </View>
      {notice ? <View style={styles.row}><Text accessibilityLiveRegion="polite" style={[styles.detail, styles.copy]}>{notice}</Text>{lastAdded ? <Pressable accessibilityRole="button" accessibilityLabel="Undo last water entry" disabled={busy} onPress={() => void undo()} style={styles.textButton}><Text style={styles.addText}>Undo</Text></Pressable> : null}</View> : null}
      {error && !sheet ? <Text accessibilityRole="alert" style={styles.detail}>{error}</Text> : null}
      {loadFailed ? <Pressable accessibilityRole="button" onPress={() => void load()} style={styles.textButton}><Text style={styles.addText}>Retry loading water</Text></Pressable> : null}
      {pending.current && !sheet ? <Pressable accessibilityRole="button" disabled={busy} onPress={() => void add(pending.current!.amount_ml)} style={styles.textButton}><Text style={styles.addText}>Retry adding water</Text></Pressable> : null}
    </View>
    {sheet ? <EntrySheet title="Add water" onClose={() => setSheet(false)} busy={busy} footer={<Pressable accessibilityRole="button" disabled={busy || (!pending.current && parsed === null)} onPress={() => { const ml = pending.current?.amount_ml ?? parsed; if (ml !== null) void add(ml); }} style={[styles.primary, (busy || (!pending.current && parsed === null)) && styles.dim]}>{busy ? <ActivityIndicator color={colors.primaryText} /> : <Text style={styles.primaryText}>{pending.current ? 'Retry water entry' : `Add ${parsed !== null ? formatWater(parsed, unit) : 'water'}`}</Text>}</Pressable>}>
      <Text style={styles.detail}>{date} · {demo ? 'Saved on this device' : 'Saved to your account'}</Text>
      <SegmentedControl options={['mL', 'fl oz'] as const} value={unit} onChange={next => { if (busy || pending.current) return; setUnit(next); setAmount(next === 'mL' ? '250' : '8'); }} />
      <View style={styles.quickRow}>{(unit === 'mL' ? ['250', '500', '750'] : ['8', '16', '24']).map(value => <Pressable key={value} accessibilityRole="button" disabled={busy || Boolean(pending.current)} onPress={() => { const ml = waterAmountMl(value, unit); if (ml !== null) void add(ml); }} style={[styles.quick, busy && styles.dim]}><Text style={styles.quickText}>+ {value} {unit}</Text></Pressable>)}</View>
      <Text style={styles.label}>Custom amount</Text>
      <TextInput accessibilityLabel={`Water amount in ${unit}`} editable={!busy && !pending.current} keyboardType="decimal-pad" value={amount} onChangeText={setAmount} selectTextOnFocus style={styles.input} />
      {parsed === null ? <Text style={styles.detail}>Enter an amount from 1 to 5,000 mL (up to 169 fl oz) per entry.</Text> : null}
      <Text style={styles.detail}>Amounts are logged as plain water. This is an intake record, not a hydration score.</Text>
      {error ? <Text accessibilityRole="alert" style={styles.detail}>{error}</Text> : null}
    </EntrySheet> : null}
  </>;
}
const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 12, gap: 8 }, row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10 }, icon: { width: 7, height: 7, backgroundColor: dietAccents.water, borderRadius: 3.5 }, copy: { flex: 1, minWidth: 110, gap: 3 }, title: { ...type.body, fontSize: 15, fontWeight: '600', color: colors.text }, detail: { ...type.caption, color: colors.textMuted }, label: { ...type.label, color: colors.text }, add: { minHeight: 36, paddingHorizontal: 12, backgroundColor: colors.surfaceInset, borderRadius: 18, flexDirection: 'row', alignItems: 'center', gap: 4 }, addText: { ...type.label, color: dietAccents.water }, textButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 }, dim: { opacity: 0.4 }, quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, quick: { flexGrow: 1, minHeight: 50, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, backgroundColor: '#10252D', borderRadius: 14 }, quickText: { ...type.body, fontWeight: '600', color: dietAccents.water }, input: { ...type.numberLg, color: colors.text, minHeight: 60, paddingHorizontal: 16, borderRadius: 14, backgroundColor: colors.surfaceInset }, primary: { minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: tabAccent.food }, primaryText: { ...type.body, color: colors.primaryText, fontWeight: '600' }
});
