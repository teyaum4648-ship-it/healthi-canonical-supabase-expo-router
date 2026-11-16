import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { LoadBand, LoadSummary } from '../../../engines/load';
import { accent, font, ink, radius, surface, type } from '../../../styles/daywoven1c';
import { formatHoursMinutes, type SleepGlance } from '../dashboardZones';

/** How far along the four effort bands today sits: rest is none, very heavy is all four. */
const BAND_STEPS: Record<LoadBand, number> = { rest: 0, light: 1, moderate: 2, heavy: 3, very_heavy: 4 };

/**
 * Component B: last night's sleep against the estimated need, and today's training load,
 * side by side as 1c white cards (P5, P12). Each figure says where it came from, and each
 * card still opens the tab that holds the detail.
 */
export function MetricGrid({ sleep, load, sleepSource, onOpenSleep, onOpenLoad }: {
  sleep: SleepGlance;
  load: LoadSummary;
  /** How last night is known: "measured" from a health app, "logged" by hand. */
  sleepSource?: 'measured' | 'logged' | null;
  onOpenSleep: () => void;
  onOpenLoad: () => void;
}) {
  const sleepValue = sleep.lastNight ? formatHoursMinutes(sleep.lastNight.minutes) : '—';
  const fraction = sleep.fraction === null ? null : Math.min(1, Math.max(0, sleep.fraction));
  const sleepCaption = sleep.lastNight
    ? `${sleep.fraction === null ? '' : `${Math.round(sleep.fraction * 100)}% of `}your ${formatHoursMinutes(sleep.needMinutes)} estimated need`
    : 'Log last night to compare it with your need';
  const loadCaption = load.today.sessions
    ? `${load.today.load} effort × minutes · ${load.today.sessions} session${load.today.sessions === 1 ? '' : 's'}`
    : `${load.activeDays} of 7 days trained`;
  const steps = BAND_STEPS[load.band];

  return (
    <View style={styles.grid}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Last night: ${sleep.lastNight ? `${sleepValue}, ${sleepCaption}` : 'not logged'}. Open Sleep`}
        onPress={onOpenSleep}
        style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      >
        <Text style={styles.label}>Last night{sleep.lastNight && sleepSource ? ` · ${sleepSource}` : ''}</Text>
        <Text adjustsFontSizeToFit minimumFontScale={0.8} numberOfLines={1} style={[styles.value, !sleep.lastNight && styles.valueEmpty]}>{sleepValue}</Text>
        {fraction !== null ? (
          <View style={styles.track}><View style={[styles.fill, { width: `${Math.round(fraction * 100)}%` }]} /></View>
        ) : null}
        <Text style={styles.caption}>{sleepCaption}</Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Today’s load, estimate: ${load.label}. ${loadCaption}. Open Movement`}
        onPress={onOpenLoad}
        style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      >
        <Text style={styles.label}>Today’s load · estimate</Text>
        <Text adjustsFontSizeToFit minimumFontScale={0.8} numberOfLines={1} style={styles.value}>{load.label}</Text>
        <View style={styles.steps}>
          {[1, 2, 3, 4].map((step) => <View key={step} style={[styles.step, step <= steps && styles.stepOn]} />)}
        </View>
        <Text style={styles.caption}>{loadCaption}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', gap: 10 },
  card: { backgroundColor: surface.card, borderColor: ink.border, borderRadius: radius.card, borderWidth: 1, flex: 1, minWidth: 0, padding: 14 },
  pressed: { opacity: 0.72 },
  label: { ...type.caption, color: ink.muted },
  value: { ...type.bigNumber, color: ink.text, fontVariant: ['tabular-nums'], marginTop: 10 },
  valueEmpty: { color: ink.muted },
  track: { backgroundColor: ink.track, height: 4, marginTop: 12 },
  fill: { backgroundColor: accent.lavenderDeep, height: 4 },
  steps: { flexDirection: 'row', gap: 3, marginTop: 12 },
  step: { backgroundColor: ink.border, flex: 1, height: 4 },
  stepOn: { backgroundColor: ink.text },
  caption: { ...type.caption, color: ink.muted, fontFamily: font.body, marginTop: 7 }
});
