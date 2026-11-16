import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FluidPressable } from '../../components/mobile/FluidPressable';
import { cardSurface, fonts } from '../../styles/mobileTheme';
import { formatSleepTime } from './sleepPresentation';
import { CAFFEINE_DRINKS, caffeineDay, drinkById, isAfterCutoff, type CaffeineDrink, type CaffeineEntry } from './caffeineLog';
import type { MorningCheckInPalette } from './MorningCheckIn';

const FIRST_ROW = 4;

/**
 * Today's caffeine, above the energy curve it moves.
 *
 * One tap per drink, with the amount on the chip so nobody has to guess what "a coffee"
 * was counted as. The lift it gives the curve is real and borrowed, and the copy says
 * that rather than letting a coffee pass for a good night.
 */
export function CaffeineLog({ palette, entries, today, onBoardMg, cutoff, onAdd, onUndo }: {
  palette: MorningCheckInPalette;
  entries: readonly CaffeineEntry[];
  today: string;
  onBoardMg: number;
  /** Today's suggested caffeine cutoff, as a wall-clock time on the UTC axis. */
  cutoff: string | null;
  onAdd: (drink: CaffeineDrink) => void;
  onUndo: (entry: CaffeineEntry) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const day = caffeineDay(entries, today);
  const late = day.last ? isAfterCutoff(day.last.at, cutoff) : false;
  const drinks = showAll ? CAFFEINE_DRINKS : CAFFEINE_DRINKS.slice(0, FIRST_ROW);
  const lastName = day.last ? drinkById(day.last.drinkId)?.name ?? 'drink' : null;

  return (
    <View style={styles.pad}>
      <View style={[styles.card, { borderColor: palette.border }]}>
        <View>
          <Text style={[styles.eyebrow, { color: palette.faint }]}>Caffeine</Text>
          <Text accessibilityRole="header" style={[styles.title, { color: palette.text }]}>
            {day.count ? `${day.totalMg} mg today` : 'Nothing logged today'}
          </Text>
        </View>
        {onBoardMg >= 10 ? (
          <Text style={[styles.body, { color: palette.muted }]}>
            About {onBoardMg} mg still with you. It lifts the curve below for a while; it does not stand in for sleep.
          </Text>
        ) : (
          <Text style={[styles.body, { color: palette.muted }]}>Log a drink and the energy curve below accounts for it.</Text>
        )}
        {late && cutoff ? (
          <Text style={[styles.note, { color: palette.muted }]}>
            That one came after today’s cutoff of {formatSleepTime(cutoff)}, so some of it may still be with you at bedtime.
          </Text>
        ) : null}
        <View style={styles.chips}>
          {drinks.map((drink) => (
            <FluidPressable
              key={drink.id}
              accessibilityLabel={`Add ${drink.name}, ${drink.serving}, about ${drink.mg} milligrams`}
              accessibilityRole="button"
              onPress={() => onAdd(drink)}
              pressedScale={0.96}
              style={[styles.chip, { backgroundColor: palette.chip }]}
            >
              <Text style={[styles.chipText, { color: palette.text }]}>{drink.name}</Text>
              <Text style={[styles.chipMg, { color: palette.faint }]}>{drink.mg} mg</Text>
            </FluidPressable>
          ))}
          {!showAll ? (
            <Pressable accessibilityRole="button" onPress={() => setShowAll(true)} style={[styles.chip, styles.more]}>
              <Text style={[styles.chipText, { color: palette.accent }]}>More</Text>
            </Pressable>
          ) : null}
        </View>
        <View style={styles.footer}>
          <Text style={[styles.note, { color: palette.faint }]}>Typical servings. Your own drink may differ.</Text>
          {day.last && lastName ? (
            <Pressable accessibilityRole="button" accessibilityLabel={`Undo ${lastName}`} hitSlop={8} onPress={() => onUndo(day.last!)}>
              <Text style={[styles.undo, { color: palette.accent }]}>Undo {lastName.toLowerCase()}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: 20, paddingTop: 16 },
  card: { ...cardSurface, borderRadius: 22, borderWidth: 1, gap: 10, padding: 18 },
  eyebrow: { fontFamily: fonts.bodyMedium, fontSize: 11, letterSpacing: 0, lineHeight: 15 },
  title: { fontFamily: fonts.bodyMedium, fontSize: 20, fontVariant: ['tabular-nums'], letterSpacing: -0.35, lineHeight: 25, marginTop: 3 },
  body: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20 },
  note: { fontFamily: fonts.body, fontSize: 12.5, lineHeight: 17 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { alignItems: 'center', borderCurve: 'continuous', borderRadius: 18, flexDirection: 'row', gap: 6, minHeight: 36, paddingHorizontal: 12, paddingVertical: 8 },
  more: { backgroundColor: 'transparent' },
  chipText: { fontFamily: fonts.bodyMedium, fontSize: 13 },
  chipMg: { fontFamily: fonts.body, fontSize: 12, fontVariant: ['tabular-nums'] },
  footer: { alignItems: 'center', flexDirection: 'row', gap: 12, justifyContent: 'space-between' },
  undo: { fontFamily: fonts.bodyMedium, fontSize: 13 }
});
