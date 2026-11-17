import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Eyebrow, TextLink, ThreadButton } from '../../components/thread/ThreadParts';
import type { NutrientSummary, NutritionTargets } from '../../engines/nutrition';
import { accent, bone, font, HIT, ink, pillar, radius, space, surface, type } from '../../styles/daywoven1c';
import { energyLine, foodHeadline, intakeBars, type IntakeBar } from './foodBandModel';

/* Marks on the band: amber is energy; the three macros keep distinct, light-on-dark colours. */
const BAR_COLOUR: Record<IntakeBar['key'], string> = {
  energy: accent.amber,
  protein: accent.lavender,
  carbs: pillar.nourishment,
  fat: bone.text
};

/**
 * The Food header band (design language P1): eyebrow, a headline from the diary, the
 * intake line, then the hero, the day's intake against working targets, and the two
 * things to do next (add a meal, scan a product).
 */
export function FoodBand({ summary, targets, mealCount, isToday, dayLabel, onAddMeal, onScan, onNutrients }: {
  summary: NutrientSummary;
  targets: NutritionTargets;
  mealCount: number;
  isToday: boolean;
  dayLabel: string;
  onAddMeal: () => void;
  onScan: () => void;
  onNutrients: () => void;
}) {
  const bars = intakeBars(summary, targets);
  return (
    <View>
      <View style={styles.eyebrow}><Eyebrow tone="band">Food</Eyebrow></View>
      <Text accessibilityRole="header" style={styles.title}>{foodHeadline(mealCount, isToday, dayLabel)}</Text>
      <Text style={styles.sub}>{energyLine(summary, targets.calories_target)}</Text>
      <View style={styles.bars}>
        {bars.map((bar) => (
          <View key={bar.key} accessible accessibilityLabel={`${bar.label}: ${bar.value}, ${bar.target}`} style={styles.bar}>
            <View style={styles.barHead}>
              <View style={styles.barName}>
                <View style={[styles.swatch, { backgroundColor: BAR_COLOUR[bar.key] }]} />
                <Text style={styles.barLabel}>{bar.label}</Text>
              </View>
              <Text style={styles.barValue}>{bar.value}<Text style={styles.barTarget}>  {bar.target}</Text></Text>
            </View>
            {bar.fill === null ? (
              <View style={styles.trackNone} />
            ) : (
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${Math.round(Math.min(1, bar.fill) * 100)}%`, backgroundColor: BAR_COLOUR[bar.key] }]} />
                {bar.targetMark !== null ? <View style={[styles.mark, { left: `${Math.round(bar.targetMark * 100)}%` }]} /> : null}
              </View>
            )}
          </View>
        ))}
      </View>
      <View style={styles.actions}>
        <ThreadButton tone="band" label="Add meal" onPress={onAddMeal} style={styles.action} trailing={<Ionicons accessible={false} color={ink.text} name="add" size={18} />} />
        <ThreadButton tone="band" variant="secondary" label="Scan barcode" accessibilityLabel="Scan a product barcode" onPress={onScan} style={styles.action} trailing={<Ionicons accessible={false} color={bone.text} name="barcode-outline" size={18} />} />
      </View>
      <TextLink tone="band" label="Calories and nutrient details" onPress={onNutrients} />
    </View>
  );
}

export type QuickAddTile = { label: string; icon: keyof typeof Ionicons.glyphMap; accessibilityLabel: string; onPress: () => void };

/** Quick add (design language P6): equal tiles, one icon and one word each. */
export function FoodQuickAdd({ tiles }: { tiles: QuickAddTile[] }) {
  return (
    <View style={styles.tiles}>
      {tiles.map((tile) => (
        <Pressable key={tile.label} accessibilityRole="button" accessibilityLabel={tile.accessibilityLabel} onPress={tile.onPress} style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]}>
          <Ionicons accessible={false} color={ink.text} name={tile.icon} size={20} />
          <Text numberOfLines={2} style={styles.tileLabel}>{tile.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  eyebrow: { marginTop: 22 },
  title: { ...type.sleepTitle, color: bone.text, marginTop: 10 },
  sub: { ...type.body, color: bone.soft, marginTop: 10 },
  bars: { gap: 14, marginTop: 20 },
  bar: { gap: 7 },
  barHead: { alignItems: 'baseline', flexDirection: 'row', gap: 8, justifyContent: 'space-between' },
  barName: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  swatch: { borderRadius: radius.swatch, height: 8, width: 8 },
  barLabel: { color: bone.soft, fontFamily: font.body, fontSize: 12.5 },
  barValue: { color: bone.text, fontFamily: font.bodyMedium, fontSize: 13.5, fontVariant: ['tabular-nums'], flexShrink: 1, textAlign: 'right' },
  barTarget: { color: bone.muted, fontFamily: font.body, fontSize: 12 },
  track: { backgroundColor: bone.ringTrack, height: 6, position: 'relative' },
  trackNone: { borderColor: bone.outline, borderStyle: 'dashed', borderWidth: 1, height: 6 },
  fill: { height: 6 },
  mark: { backgroundColor: bone.text, height: 12, marginLeft: -1, position: 'absolute', top: -3, width: 2 },
  /* Side by side on most phones; on a narrow one they stack rather than cut a label short. */
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 20 },
  action: { flexBasis: 150, flexGrow: 1 },
  tiles: { flexDirection: 'row', gap: 8, marginTop: 12 },
  tile: { alignItems: 'center', backgroundColor: surface.card, borderColor: ink.border, borderRadius: radius.tile, borderWidth: 1, flex: 1, gap: 5, height: 66, justifyContent: 'center', minHeight: HIT, minWidth: 0 },
  tilePressed: { backgroundColor: surface.canvas },
  tileLabel: { color: ink.text, fontFamily: font.bodyMedium, fontSize: 11, textAlign: 'center' },
  spacer: { height: space.sm }
});
