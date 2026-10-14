import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { SleepSession } from '../../engines/circadian';
import { colors, type } from '../../styles/mobileTheme';
import type { HealthSource } from './healthImport';
import { syncHealth } from './healthSync';

const appName = Platform.OS === 'android' ? 'Health Connect' : 'Apple Health';

/**
 * The "Connected apps" row. Where a health app can be reached it brings in the last week;
 * where it cannot — the web demo, Expo Go — it says what will happen rather than offering
 * a button that does nothing.
 */
export function ConnectedHealthRow({ source, scope, readSleep, saveSleep }: {
  source: HealthSource; scope: string; readSleep: () => Promise<SleepSession[]>; saveSleep: (session: SleepSession) => Promise<void>;
}) {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    source.isAvailable().then((value) => { if (active) setAvailable(value); }).catch(() => { if (active) setAvailable(false); });
    return () => { active = false; };
  }, [source]);

  async function connect() {
    setBusy(true); setMessage(null);
    try {
      const result = await syncHealth(source, { scope, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC', now: new Date(), readSleep, saveSleep });
      setMessage(result
        ? `${result.nightsSaved} ${result.nightsSaved === 1 ? 'night' : 'nights'} and ${result.stepDays} ${result.stepDays === 1 ? 'day' : 'days'} of steps brought in.${result.nightsKept ? ` ${result.nightsKept} ${result.nightsKept === 1 ? 'night' : 'nights'} you logged yourself stayed as you had them.` : ''}`
        : `${appName} isn’t available on this device.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Nothing was brought in. Try again.');
    } finally {
      setBusy(false);
    }
  }

  const detail = available
    ? 'Bring in the last week of sleep and steps. Nights you log yourself always stay as you logged them.'
    : Platform.OS === 'web'
      ? 'Sleep and steps come in through the iPhone and Android apps. Nights you log yourself always stay as you logged them.'
      : `${appName} works in the installed daywoven app; this preview build cannot reach it.`;

  return <View style={styles.row}>
    <View style={styles.icon}><Ionicons accessible={false} color="#FF6B81" name="heart" size={18} /></View>
    <View style={styles.copy}>
      <Text style={styles.title}>{appName}</Text>
      <Text style={styles.detail}>{available === null ? 'Checking…' : detail}</Text>
      {message ? <Text accessibilityLiveRegion="polite" style={styles.detail}>{message}</Text> : null}
    </View>
    {available ? (
      <Pressable accessibilityRole="button" disabled={busy} onPress={() => void connect()} style={({ pressed }) => [styles.button, (pressed || busy) && styles.pressed]}>
        {busy ? <ActivityIndicator color={colors.accent} /> : <Text style={styles.buttonText}>Connect</Text>}
      </Pressable>
    ) : null}
  </View>;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingVertical: 14 },
  icon: { width: 30, height: 30, borderRadius: 8, backgroundColor: 'rgba(255, 107, 129, 0.16)', alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, gap: 3 },
  title: { ...type.body, fontWeight: '600', color: colors.text },
  detail: { ...type.caption, fontSize: 14, lineHeight: 20, color: colors.textMuted },
  button: { minHeight: 44, minWidth: 88, paddingHorizontal: 14, borderRadius: 22, backgroundColor: colors.surfaceInset, alignItems: 'center', justifyContent: 'center' },
  buttonText: { ...type.label, color: colors.accent },
  pressed: { opacity: 0.6 }
});
