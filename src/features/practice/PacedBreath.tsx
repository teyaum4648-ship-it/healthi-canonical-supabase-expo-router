import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { useReducedMotion } from '../../components/mobile/useReducedMotion';
import { colors, type } from '../../styles/mobileTheme';
import { BreathCircle, DEFAULT_BREATH_PALETTE, type BreathPalette } from './BreathCircle';
import { cycleMs, phaseTarget, type BreathTechnique } from './breathTechniques';
import { useStopOnBackground } from './useStopOnBackground';

/**
 * The pacer, as a component rather than a block of one screen.
 *
 * Three layers move together — a glow, a ring and a core — because three things scaling
 * at once reads as breath where a single circle reads as a loading spinner.
 *
 * It walks a phase sequence rather than an inhale/hold/exhale triple, which is what lets
 * one component pace box breathing (a hold after the exhale), a physiological sigh (two
 * inhales, the first only part of the way up) and alternate nostril (a cue per phase).
 * The phase index lives in state because the cue has to be rendered; a phase lasts
 * seconds, so that is one re-render every few seconds rather than one per frame.
 *
 * It counts what was actually done rather than what was chosen. Someone who starts five
 * minutes and stops after ninety seconds did ninety seconds, and recording the five would
 * be the same lie as averaging in a meal nobody ate.
 *
 * Under reduced motion the circle stops scaling and breathes in opacity instead. That is
 * the distinction the preference asks for — vestibular motion goes, the information
 * stays — and dropping the cue altogether would leave the pacer with nothing to pace to.
 */

const PHASE_FALLBACK: Record<string, string> = {
  inhale: 'In',
  hold: 'Hold',
  exhale: 'Out',
  hold_empty: 'Hold, empty'
};

export function PacedBreath({
  technique,
  palette = DEFAULT_BREATH_PALETTE,
  onSession,
  idleLabel = 'Breathe'
}: {
  technique: BreathTechnique;
  palette?: BreathPalette;
  /** Called with whole seconds when a run ends, however it ended. */
  onSession?: (seconds: number) => void;
  idleLabel?: string;
}) {
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [phaseIndex, setPhaseIndex] = useState(0);
  const reduced = useReducedMotion();
  const wave = useRef(new Animated.Value(0)).current;
  const startedAt = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!running) {
      if (timer.current) clearTimeout(timer.current);
      wave.stopAnimation();
      wave.setValue(0);
      setPhaseIndex(0);
      return;
    }

    let cancelled = false;
    let at = 0;
    let position = 0;

    /*
     * A recursive walk rather than an Animated.sequence, because the cue for each phase
     * has to reach React. A sequence would run on the UI thread with nothing to render.
     */
    const step = () => {
      if (cancelled) return;
      const phase = technique.phases[at];
      setPhaseIndex(at);
      const target = phaseTarget(phase, position);

      Animated.timing(wave, {
        toValue: target,
        duration: phase.ms,
        useNativeDriver: true
      }).start();

      position = target;
      timer.current = setTimeout(() => {
        at = (at + 1) % technique.phases.length;
        step();
      }, phase.ms);
    };

    step();
    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
      wave.stopAnimation();
    };
  }, [running, technique, wave]);

  // A visible clock, because "how long have I been doing this" is the only thing a
  // person wants to know mid-session and counting cycles in your head defeats the point.
  useEffect(() => {
    if (!running) return;
    const tick = setInterval(() => {
      if (startedAt.current !== null) setElapsed(Math.floor((Date.now() - startedAt.current) / 1000));
    }, 1000);
    return () => clearInterval(tick);
  }, [running]);

  const stop = useCallback(() => {
      const seconds = startedAt.current === null ? 0 : Math.round((Date.now() - startedAt.current) / 1000);
      startedAt.current = null;
      if (timer.current) clearTimeout(timer.current);
      wave.stopAnimation();
      setRunning(false);
      setElapsed(0);
      if (seconds > 0) onSession?.(seconds);
  }, [onSession, wave]);
  useStopOnBackground(running, stop);

  function toggle() {
    if (running) { stop(); return; }
    startedAt.current = Date.now();
    setElapsed(0);
    setRunning(true);
  }

  const clock = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}`;
  const phase = technique.phases[phaseIndex] ?? technique.phases[0];
  const cue = phase.cue ?? PHASE_FALLBACK[phase.kind] ?? '';

  return (
    <View style={styles.wrap}>
      <Pressable
        accessibilityLabel={running ? 'Stop the breathing pacer' : `Start ${technique.name}`}
        accessibilityRole="button"
        onPress={toggle}
        style={styles.button}
      >
        <BreathCircle label={running ? clock : idleLabel} palette={palette} reduced={reduced} wave={wave} />
      </Pressable>

      {/*
        The cue is a live region so a screen reader announces each phase change. Without
        it the pacer is a circle that silently grows, which is no use to anyone who cannot
        see it — and breathing guidance is exactly the kind of thing that should not need
        eyes.
      */}
      {running ? (
        <Text accessibilityLiveRegion="polite" style={[styles.cue, { color: palette.text }]}>
          {cue}
        </Text>
      ) : null}

      <Text style={[styles.hint, { color: palette.faint }]}>
        {running
          ? `Tap to stop · ${Math.round(cycleMs(technique) / 1000)}s a cycle · Stops when you leave the app`
          : reduced
            ? 'Tap to start, and follow the glow'
            : 'Tap to start, and follow the circle'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 10 },
  button: { alignItems: 'center', justifyContent: 'center' },
  cue: { ...type.body, fontWeight: '600', minHeight: 23, textAlign: 'center' },
  hint: { ...type.caption }
});
