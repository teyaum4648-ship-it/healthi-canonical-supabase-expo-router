import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { FluidPressable } from '../../../components/mobile/FluidPressable';
import type { LoadSummary } from '../../../engines/load';
import { cardSurface, colors, surfaces, type } from '../../../styles/mobileTheme';
import { pillarColors } from '../../../styles/pillarColors';
import { formatHoursMinutes, type SleepGlance } from '../dashboardZones';
import { MiniBars } from './MiniBars';
import { ZoneChip } from './ZoneChip';

function MetricCard({ icon, iconColor, title, value, unit, caption, zone, zoneLabel, bars, barsColor, barsLabel, onPress, accessibilityLabel }: {
  icon: 'moon' | 'flame';
  iconColor: string;
  title: string;
  value: string;
  unit?: string;
  caption: string;
  zone: SleepGlance['zone'];
  zoneLabel: string;
  bars: (number | null)[];
  barsColor: string;
  barsLabel: string;
  onPress: () => void;
  accessibilityLabel: string;
}) {
  return (
    <FluidPressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress} style={styles.card} hoverStyle={styles.cardHover}>
      <View style={styles.titleRow}>
        <Ionicons accessible={false} color={iconColor} name={icon} size={15} />
        <Text style={styles.title}>{title}</Text>
        <Ionicons accessible={false} color={colors.textMuted} name="chevron-forward" size={14} style={styles.chevron} />
      </View>
      <View style={styles.valueRow}>
        <Text adjustsFontSizeToFit minimumFontScale={0.8} numberOfLines={1} style={[styles.value, value === '—' && styles.valueEmpty]}>{value}</Text>
        {unit ? <Text style={styles.unit}>{unit}</Text> : null}
      </View>
      <Text numberOfLines={2} style={styles.caption}>{caption}</Text>
      <ZoneChip tone={zone} label={zoneLabel} />
      <MiniBars values={bars} color={barsColor} label={barsLabel} />
    </FluidPressable>
  );
}

/**
 * Component B: last night's sleep and today's training load, side by side on the canvas.
 * Each card is one number, one caption, one zone and the shape of the week, and opens the
 * tab that holds the detail.
 */
export function MetricGrid({ sleep, load, onOpenSleep, onOpenLoad }: {
  sleep: SleepGlance;
  load: LoadSummary;
  onOpenSleep: () => void;
  onOpenLoad: () => void;
}) {
  const sleepValue = sleep.lastNight ? formatHoursMinutes(sleep.lastNight.minutes) : '—';
  const sleepCaption = sleep.lastNight
    ? `of ${formatHoursMinutes(sleep.needMinutes)} estimated need`
    : 'Log last night to compare it with your need';
  const loadCaption = load.today.sessions
    ? `effort × minutes · ${load.today.sessions} session${load.today.sessions === 1 ? '' : 's'}`
    : `${load.activeDays} of 7 days trained`;

  return (
    <View style={styles.grid}>
      <MetricCard
        icon="moon"
        iconColor={pillarColors.recovery_rhythm}
        title="Sleep"
        value={sleepValue}
        caption={sleepCaption}
        zone={sleep.zone}
        zoneLabel={sleep.label}
        bars={sleep.series.map((night) => night.minutes)}
        barsColor={pillarColors.recovery_rhythm}
        barsLabel={`Sleep over the last seven nights, ${sleep.nightsLogged} logged`}
        onPress={onOpenSleep}
        accessibilityLabel={`Sleep: ${sleep.lastNight ? `${sleepValue} last night, ${sleep.label}` : 'last night not logged'}. Open Sleep`}
      />
      <MetricCard
        icon="flame"
        iconColor={pillarColors.movement_capacity}
        title="Load"
        value={load.today.load ? String(load.today.load) : '0'}
        caption={loadCaption}
        zone={load.zone}
        zoneLabel={load.label}
        bars={load.series.map((day) => (day.load > 0 ? day.load : null))}
        barsColor={pillarColors.movement_capacity}
        barsLabel={`Training load over the last seven days, ${load.activeDays} days with training`}
        onPress={onOpenLoad}
        accessibilityLabel={`Load today: ${load.today.load}, ${load.label}. Open Movement`}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', gap: 12 },
  card: {
    ...cardSurface,
    borderColor: surfaces.edge,
    borderRadius: 16,
    borderWidth: 1,
    flex: 1,
    gap: 8,
    padding: 16
  },
  cardHover: { boxShadow: '0 2px 4px rgba(0, 0, 0, 0.04), 0 10px 28px rgba(0, 0, 0, 0.07)' },
  titleRow: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  title: { ...type.label, color: colors.text, flex: 1 },
  chevron: { marginRight: -2 },
  valueRow: { alignItems: 'baseline', flexDirection: 'row', gap: 4, marginTop: 2 },
  value: { color: colors.text, flexShrink: 1, fontSize: 28, fontVariant: ['tabular-nums'], fontWeight: '700', letterSpacing: -0.8, lineHeight: 32 },
  valueEmpty: { color: colors.textMuted },
  unit: { ...type.caption, color: colors.textMuted },
  caption: { ...type.caption, color: colors.textMuted, fontSize: 12, lineHeight: 16, minHeight: 32 }
});
