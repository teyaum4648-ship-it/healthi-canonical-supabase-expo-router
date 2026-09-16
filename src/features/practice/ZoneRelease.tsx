import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, hairlineWidth, type } from '../../styles/mobileTheme';
import { PacedBreath } from './PacedBreath';
import { rhythmById } from './practiceModel';
import { REGION_RELEASES, regionRelease, type TensionRegion } from './zoneModel';

/**
 * Pick where it sits, get one thing to do about it.
 *
 * Three steps, and the middle one is the point. A list of regions is a self-check; a
 * movement on its own is a stretch off the internet. The mechanism in between is what
 * makes it worth opening — the same argument the food scorer settled on, where naming
 * *why* tapioca reads badly turned a letter grade into something a person can act on.
 *
 * The pacer is the one already on this screen, driven by the rhythm the release names.
 * A held stretch and a breath are the same shape of thing, so they get the same circle
 * rather than a second timer with its own conventions.
 */

export function ZoneRelease({
  onSession,
  busy = false
}: {
  onSession: (region: TensionRegion, seconds: number) => void;
  busy?: boolean;
}) {
  const [region, setRegion] = useState<TensionRegion | null>(null);

  if (!region) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.eyebrow}>TENSION</Text>
        <Text style={styles.title}>Where is it sitting?</Text>
        <Text style={styles.body}>
          Held tension collects in particular places rather than spreading evenly, and it
          tends to be the same places for the same person. Pick the one you can actually
          feel — one at a time does more than a list of five.
        </Text>
        <View style={styles.list}>
          {REGION_RELEASES.map((entry, index) => (
            <View key={entry.id}>
              {index > 0 ? <View style={styles.divider} /> : null}
              <Pressable
                accessibilityHint={entry.recognise}
                accessibilityLabel={entry.label}
                accessibilityRole="button"
                onPress={() => setRegion(entry.id)}
                style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              >
                <View style={styles.rowCopy}>
                  <Text style={styles.rowLabel}>{entry.label}</Text>
                  <Text style={styles.rowNote}>{entry.recognise}</Text>
                </View>
                <Text style={styles.rowMinutes}>{entry.minutes}m</Text>
              </Pressable>
            </View>
          ))}
        </View>
      </View>
    );
  }

  const release = regionRelease(region);
  const rhythm = rhythmById(release.rhythmId);

  return (
    <View style={styles.wrap}>
      <Text style={styles.eyebrow}>TENSION · {release.label.toUpperCase()}</Text>

      <View style={styles.mechanism}>
        <Text style={styles.mechanismText}>{release.mechanism}</Text>
      </View>

      <View style={styles.steps}>
        {release.steps.map((step, index) => (
          <View key={step} style={styles.step}>
            <Text style={styles.stepNumber}>{index + 1}</Text>
            <Text style={styles.stepText}>{step}</Text>
          </View>
        ))}
      </View>

      {release.caution ? (
        <View style={styles.caution}>
          <Text style={styles.cautionLabel}>Careful</Text>
          <Text style={styles.cautionText}>{release.caution}</Text>
        </View>
      ) : null}

      <View style={styles.pacer}>
        <PacedBreath
          idleLabel="Begin"
          onSession={(seconds) => { if (!busy) onSession(region, seconds); }}
          rhythm={rhythm}
        />
        <Text style={styles.pacerNote}>
          {release.minutes} minutes at the {rhythm.name.toLowerCase()} pace. The circle sets
          the tempo — the movement follows the breath, not the other way round.
        </Text>
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={() => setRegion(null)}
        style={({ pressed }) => [styles.textButton, pressed && styles.pressed]}
      >
        <Text style={styles.textButtonLabel}>Somewhere else</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  eyebrow: { ...type.label, color: colors.textFaint, fontSize: 12, letterSpacing: 1.1 },
  title: { ...type.heading, color: colors.text },
  body: { ...type.caption, color: colors.textMuted, lineHeight: 19 },

  list: { gap: 0 },
  row: { alignItems: 'flex-start', flexDirection: 'row', gap: 10, minHeight: 60, paddingVertical: 9 },
  rowCopy: { flex: 1, gap: 2 },
  rowLabel: { ...type.body, color: colors.text, fontWeight: '600' },
  rowNote: { ...type.caption, color: colors.textMuted, lineHeight: 18 },
  rowMinutes: { ...type.label, color: colors.textFaint, fontVariant: ['tabular-nums'] },
  divider: { backgroundColor: colors.border, height: hairlineWidth },

  /* The mechanism gets the accent rail the food findings use, because it is the same
     kind of claim: here is why, in a sentence you can check against your own day. */
  mechanism: {
    backgroundColor: colors.surfaceInset,
    borderLeftColor: colors.accent,
    borderLeftWidth: 3,
    borderRadius: 12,
    padding: 14
  },
  mechanismText: { ...type.caption, color: colors.text, lineHeight: 20 },

  steps: { gap: 10 },
  step: { flexDirection: 'row', gap: 10 },
  stepNumber: {
    ...type.label,
    color: colors.textFaint,
    fontVariant: ['tabular-nums'],
    minWidth: 14,
    textAlign: 'right'
  },
  stepText: { ...type.caption, color: colors.textMuted, flex: 1, lineHeight: 19 },

  caution: {
    backgroundColor: colors.surfaceInset,
    borderColor: colors.danger,
    borderRadius: 12,
    borderWidth: hairlineWidth,
    gap: 3,
    padding: 13
  },
  cautionLabel: { ...type.label, color: colors.danger },
  cautionText: { ...type.caption, color: colors.textMuted, lineHeight: 19 },

  pacer: { alignItems: 'center', gap: 10, paddingTop: 4 },
  pacerNote: { ...type.caption, color: colors.textMuted, lineHeight: 19, textAlign: 'center' },

  textButton: { alignSelf: 'flex-start', justifyContent: 'center', minHeight: 44 },
  textButtonLabel: { ...type.label, color: colors.accent },
  pressed: { opacity: 0.7 }
});
