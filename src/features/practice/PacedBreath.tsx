import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { useReducedMotion } from '../../components/mobile/useReducedMotion';
import { colors, type } from '../../styles/mobileTheme';
import { cycleMs, type BreathRhythm } from './practiceModel';

/**
 * The pacer, as a component rather than a block of one screen.
 *
 * This is the circle from the Sleep wind-down tab, lifted out so Mood can use it too
 * and so the rhythm can be an argument. The animation is the same one: a glow, a ring
 * and a core scaling together, because three layers moving at once reads as breath
 * where a single circle reads as a loading spinner.
 *
 * It counts what was actually done rather than what was chosen. A person who starts a
 * five-minute session and stops after ninety seconds did ninety seconds, and recording
 * the five would be the same lie as averaging in a meal nobody ate.
 *
 * Under reduced motion the circle stops scaling and breathes in opacity instead. That
 * is the distinction the preference actually asks for — vestibular motion goes, the
 * information stays — and dropping the cue altogether would leave the pacer with
 * nothing to pace against.
 */

type Palette = {
  accent: string;
  accentSoft: string;
  text: string;
  faint: string;
  primaryText: string;
};

const DEFAULT_PALETTE: Palette = {
  accent: colors.accent,
  accentSoft: colors.accentWash,
  text: colors.text,
  faint: colors.textFaint,
  primaryText: colors.primaryText
};

export function PacedBreath({ rhythm, palette = DEFAULT_PALETTE, onSession, idleLabel = 'Breathe' }: {
  rhythm: BreathRhythm;
  palette?: Palette;
  /** Called with whole seconds when a run ends, however it ended. */
  onSession?: (seconds: number) => void;
  idleLabel?: string;
}) {
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const reduced = useReducedMotion();
  const wave = useRef(new Animated.Value(0)).current;
  const startedAt = useRef<number | null>(null);

  useEffect(() => {
    if (!running) {
      wave.stopAnimation();
      wave.setValue(0);
      return;
    }
    /*
     * A hold of zero still needs a delay of zero in the sequence rather than a dropped
     * step, so the cycle length stays exactly what the rhythm says it is.
     */
    const cycle = Animated.loop(
      Animated.sequence([
        Animated.timing(wave, { toValue: 1, duration: rhythm.inhaleMs, useNativeDriver: true }),
        Animated.delay(rhythm.holdMs),
        Animated.timing(wave, { toValue: 0, duration: rhythm.exhaleMs, useNativeDriver: true })
      ])
    );
    cycle.start();
    return () => cycle.stop();
  }, [running, rhythm, wave]);

  /* One driver, two readings: the size of the breath, or only its brightness. */
  const scale = wave.interpolate({ inputRange: [0, 1], outputRange: [1, reduced ? 1 : 1.28] });
  const glowOpacity = wave.interpolate({ inputRange: [0, 1], outputRange: reduced ? [0.25, 0.75] : [0.45, 0.45] });

  // A visible clock, because "how long have I been doing this" is the only thing a
  // person wants to know mid-session and counting cycles in your head defeats the point.
  useEffect(() => {
    if (!running) return;
    const tick = setInterval(() => {
      if (startedAt.current !== null) setElapsed(Math.floor((Date.now() - startedAt.current) / 1000));
    }, 1000);
    return () => clearInterval(tick);
  }, [running]);

  function toggle() {
    if (running) {
      const seconds = startedAt.current === null ? 0 : Math.round((Date.now() - startedAt.current) / 1000);
      startedAt.current = null;
      setRunning(false);
      setElapsed(0);
      if (seconds > 0) onSession?.(seconds);
      return;
    }
    startedAt.current = Date.now();
    setElapsed(0);
    setRunning(true);
  }

  const clock = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}`;

  return (
    <View style={styles.wrap}>
      <Pressable
        accessibilityLabel={running ? 'Stop the breathing pacer' : `Start the ${rhythm.name} breathing pacer`}
        accessibilityRole="button"
        onPress={toggle}
        style={styles.button}
      >
        <Animated.View style={[styles.glow, { backgroundColor: palette.accentSoft, opacity: glowOpacity, transform: [{ scale }] }]} />
        <Animated.View style={[styles.ring, { borderColor: palette.accent, transform: [{ scale }] }]} />
        <Animated.View style={[styles.core, { backgroundColor: palette.accent, transform: [{ scale }] }]}>
          <Text style={[styles.coreText, { color: palette.primaryText }]}>{running ? clock : idleLabel}</Text>
        </Animated.View>
      </Pressable>
      <Text style={[styles.hint, { color: palette.faint }]}>
        {running
          ? `Tap to stop · ${Math.round(cycleMs(rhythm) / 1000)}s a cycle`
          : reduced
            ? 'Tap to start, and follow the glow'
            : 'Tap to start, and follow the circle'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 10 },
  button: { alignItems: 'center', height: 210, justifyContent: 'center', width: 210 },
  glow: { borderRadius: 105, height: 210, position: 'absolute', width: 210 },
  ring: { borderRadius: 82, borderWidth: 1, height: 164, position: 'absolute', width: 164 },
  core: { alignItems: 'center', borderRadius: 66, height: 132, justifyContent: 'center', width: 132 },
  coreText: { ...type.label, fontVariant: ['tabular-nums'] },
  hint: { ...type.caption }
});
