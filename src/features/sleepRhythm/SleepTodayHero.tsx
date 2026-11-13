import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export const sleepV2 = {
  background: '#0C0E13',
  surface: '#151920',
  elevated: '#1A1F28',
  border: '#2B303C',
  text: '#F0F3F7',
  muted: '#B5BDCC',
  faint: '#929EAD',
  lavender: '#B6B2FA',
  lavenderSoft: 'rgba(182, 178, 250, 0.13)',
  blue: '#9FCCFF',
  amber: '#FFC6A6'
} as const;

type SleepTodayHeroProps = {
  phase: {
    label: string;
    energy: string;
    support: string;
    next_shift: string;
  };
  confidence: string;
  hasNight: boolean;
  chronotypeLabel?: string | null;
  onLogSleep: () => void;
  onOpenChronotype?: () => void;
};

export function SleepTodayHero({
  phase,
  confidence,
  hasNight,
  chronotypeLabel,
  onLogSleep,
  onOpenChronotype
}: SleepTodayHeroProps) {
  return (
    <View style={styles.hero}>
      <View style={styles.metaLine}>
        <View style={styles.eyebrowRow}>
          <Ionicons accessible={false} name="moon-outline" size={15} color={sleepV2.lavender} />
          <Text style={styles.eyebrow}>YOUR RHYTHM TODAY</Text>
        </View>
        <Text style={styles.meta}>{confidence} confidence</Text>
      </View>

      <Text accessibilityRole="header" style={styles.title}>{phase.label}</Text>
      <Text style={styles.summary}>{phase.support}</Text>

      <View style={styles.nowRow}>
        <View style={styles.statusChip}>
          <View style={[styles.statusDot, { backgroundColor: phase.energy === 'Low' ? sleepV2.amber : sleepV2.lavender }]} />
          <Text style={styles.statusText}>Estimated energy: {phase.energy}</Text>
        </View>
      </View>

      <View style={styles.shiftRow}>
        <Ionicons accessible={false} name="time-outline" color={sleepV2.blue} size={17} />
        <Text style={styles.shiftText}>{phase.next_shift}</Text>
      </View>

      <View style={styles.actions}>
        <Pressable accessibilityRole="button" accessibilityLabel="Log or correct last night's sleep" onPress={onLogSleep} style={({ pressed }) => [styles.primary, pressed && styles.pressed]}>
          <Ionicons accessible={false} name="add-circle-outline" size={20} color={sleepV2.background} />
          <Text style={styles.primaryText}>{hasNight ? 'Update sleep' : 'Log last night'}</Text>
        </Pressable>
        {onOpenChronotype ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={chronotypeLabel ? `Review your chronotype: ${chronotypeLabel}` : 'Discover your chronotype'}
            onPress={onOpenChronotype}
            style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
          >
            <Ionicons accessible={false} name="compass-outline" size={17} color={sleepV2.lavender} />
            <Text style={styles.secondaryText}>{chronotypeLabel ? 'My clock' : 'Find my clock'}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export function SleepSectionToggle({
  expanded,
  onPress
}: {
  expanded: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={expanded ? 'Hide detailed sleep tracking and history' : 'Explore detailed sleep tracking and history'}
      accessibilityState={{ expanded }}
      onPress={onPress}
      style={({ pressed }) => [styles.detailsToggle, pressed && styles.pressed]}
    >
      <View style={styles.detailsText}>
        <Text style={styles.detailsTitle}>{expanded ? 'Hide sleep details' : 'Explore your sleep details'}</Text>
        <Text style={styles.detailsSubtitle}>Night log, morning check-in, daily rhythm, history and how estimates work</Text>
      </View>
      <Ionicons accessible={false} color={sleepV2.lavender} size={21} name={expanded ? 'chevron-up' : 'chevron-down'} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: sleepV2.surface, borderRadius: 24, borderWidth: 1, borderColor: sleepV2.border, padding: 20, gap: 13 },
  metaLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 7, flexShrink: 1 },
  eyebrow: { fontSize: 11, letterSpacing: 1.1, fontWeight: '700', color: sleepV2.lavender },
  meta: { fontSize: 11, color: sleepV2.faint, textTransform: 'capitalize', flexShrink: 1 },
  title: { fontSize: 29, lineHeight: 35, letterSpacing: -0.8, fontWeight: '700', color: sleepV2.text },
  summary: { fontSize: 15, lineHeight: 23, color: sleepV2.muted },
  nowRow: { flexDirection: 'row', flexWrap: 'wrap' },
  statusChip: { backgroundColor: sleepV2.lavenderSoft, borderRadius: 99, paddingHorizontal: 11, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 12, color: sleepV2.text, fontWeight: '600' },
  shiftRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, borderTopColor: sleepV2.border, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 13 },
  shiftText: { color: sleepV2.blue, fontSize: 13, lineHeight: 19, flex: 1 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 3 },
  primary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 48, borderRadius: 13, paddingHorizontal: 15, backgroundColor: sleepV2.lavender, flexGrow: 1 },
  primaryText: { color: sleepV2.background, fontSize: 14, fontWeight: '700' },
  secondary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, minHeight: 48, borderRadius: 13, borderWidth: 1, borderColor: sleepV2.border, paddingHorizontal: 13 },
  secondaryText: { color: sleepV2.lavender, fontSize: 13, fontWeight: '600' },
  detailsToggle: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 18, paddingHorizontal: 17, borderRadius: 19, borderWidth: 1, borderColor: sleepV2.border, backgroundColor: sleepV2.surface },
  detailsText: { flex: 1, gap: 5 },
  detailsTitle: { fontSize: 16, fontWeight: '700', color: sleepV2.text },
  detailsSubtitle: { fontSize: 12, lineHeight: 18, color: sleepV2.faint },
  pressed: { opacity: 0.72 }
});
