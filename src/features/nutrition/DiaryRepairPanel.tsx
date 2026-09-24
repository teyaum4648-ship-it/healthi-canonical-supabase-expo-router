import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../components/Button';
import { dayTitle } from '../navigation/navigationModel';
import { findLocalDemoMisfiledMealLogs, repairLocalDemoMealLogs } from './localDemoNutritionStore';
import type { MisfiledMealLog } from './misfiledMealLogs';
import { colors, fonts, spacing } from '../../styles/mobileTheme';

function movedLine(entry: MisfiledMealLog, today: string): string {
  return `${entry.meal.name} · sitting on ${dayTitle(entry.filedOn, today).toLowerCase()}, entered on ${dayTitle(entry.enteredOn, today).toLowerCase()}`;
}

/**
 * Find and fix entries the manual meal form filed under the wrong day.
 *
 * Nothing moves until it has been listed and confirmed: this is somebody's own record of
 * what they ate, and a repair that silently rewrites it is worse than the defect it fixes.
 */
export function DiaryRepairPanel({ today }: { today: string }) {
  const [entries, setEntries] = useState<MisfiledMealLog[] | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState('');

  const scan = useCallback(async () => {
    setError('');
    setDone('');
    try { setEntries(await findLocalDemoMisfiledMealLogs()); }
    catch { setError('Your diary could not be read, so nothing was checked and nothing was changed.'); }
  }, []);

  useEffect(() => { void scan(); }, [scan]);

  async function repair() {
    setBusy(true);
    setError('');
    try {
      const result = await repairLocalDemoMealLogs((entries ?? []).map((entry) => entry.meal.id).filter((id): id is string => Boolean(id)));
      setEntries(result.remaining);
      setConfirming(false);
      setDone(result.moved === 0
        ? 'Nothing needed moving.'
        : `${result.moved} ${result.moved === 1 ? 'entry was' : 'entries were'} moved onto the day you entered them.`);
    } catch { setError('The repair could not finish. Your diary is unchanged.'); }
    finally { setBusy(false); }
  }

  if (entries === null && !error) return <ActivityIndicator accessibilityLabel="Checking your diary" />;

  return <View style={s.stack}>
    <Text style={s.title}>Entries filed on the wrong day</Text>
    <Text style={s.detail}>
      An earlier version of the manual meal form stamped an entry with the day the screen opened
      rather than the day you saved it. Entries where those two disagree are listed here.
    </Text>
    {error ? <Text accessibilityRole="alert" style={s.detail}>{error}</Text> : null}
    {done ? <Text style={s.detail}>{done}</Text> : null}
    {entries && entries.length > 0 ? <>
      <View style={s.list}>
        {entries.map((entry) => <Text key={entry.meal.id ?? `${entry.meal.name}-${entry.meal.logged_at}`} style={s.item}>{movedLine(entry, today)}</Text>)}
      </View>
      {confirming ? <>
        <Text style={s.detail}>Move {entries.length === 1 ? 'this entry' : `these ${entries.length} entries`} onto the day you entered {entries.length === 1 ? 'it' : 'them'}? Nothing else in your diary changes.</Text>
        <Button label="Move them" isLoading={busy} onPress={() => void repair()} />
        <Button label="Leave them as they are" variant="secondary" onPress={() => setConfirming(false)} />
      </> : <Button label={`Review and fix ${entries.length}`} variant="secondary" onPress={() => setConfirming(true)} />}
    </> : entries ? <Text style={s.detail}>Nothing looks misfiled. Every entry sits on the day it was entered.</Text> : null}
  </View>;
}

const s = StyleSheet.create({
  stack: { gap: spacing.sm },
  title: { color: colors.text, fontFamily: fonts.display, fontSize: 28, lineHeight: 34 },
  detail: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 16, lineHeight: 23 },
  list: { backgroundColor: colors.surfaceInset, borderRadius: 14, gap: spacing.xs, padding: spacing.sm },
  item: { color: colors.text, fontFamily: fonts.body, fontSize: 15, lineHeight: 22 }
});
