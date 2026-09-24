import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, hairlineWidth, type } from '../../styles/mobileTheme';
import {
  bpmFromCount,
  COUNT_WINDOW_SECONDS,
  isPlausibleBpm,
  PULSE_CONTEXTS,
  type PulseContext,
  type PulseMethod
} from './pulseModel';

/**
 * Taking a pulse, with no hardware.
 *
 * Tap along with the beat for fifteen seconds and multiply by four. That is how a pulse
 * has been taken for a century, it needs nothing but fingers, and it is honest about what
 * it is — which a phone camera reading is not.
 *
 * The context question is not optional politeness. A count is uninterpretable without
 * knowing whether the person had just stood up, and the answer decides whether the
 * reading is allowed to inform their baseline at all. So it is asked first, before the
 * number exists, rather than as an afterthought once someone wants to be done.
 *
 * Taps are counted in a ref rather than state: at a resting heart rate this fires around
 * fifteen times in fifteen seconds, and re-rendering the whole panel on each one would
 * make the counter lag behind the thumb doing the tapping.
 */

export function PulseCheck({
  onReading,
  busy = false
}: {
  onReading: (bpm: number, context: PulseContext, method: PulseMethod) => void;
  busy?: boolean;
}) {
  const [context, setContext] = useState<PulseContext | null>(null);
  const [phase, setPhase] = useState<'idle' | 'counting' | 'done'>('idle');
  const [remaining, setRemaining] = useState(COUNT_WINDOW_SECONDS);
  const [taps, setTaps] = useState(0);
  const tapCount = useRef(0);

  useEffect(() => {
    if (phase !== 'counting') return;
    const started = Date.now();
    const tick = setInterval(() => {
      const left = COUNT_WINDOW_SECONDS - Math.floor((Date.now() - started) / 1000);
      if (left <= 0) {
        setRemaining(0);
        setTaps(tapCount.current);
        setPhase('done');
        return;
      }
      setRemaining(left);
    }, 200);
    return () => clearInterval(tick);
  }, [phase]);

  function begin() {
    tapCount.current = 0;
    setTaps(0);
    setRemaining(COUNT_WINDOW_SECONDS);
    setPhase('counting');
  }

  function reset() {
    tapCount.current = 0;
    setTaps(0);
    setRemaining(COUNT_WINDOW_SECONDS);
    setPhase('idle');
  }

  const bpm = bpmFromCount(taps);
  const usable = phase === 'done' && isPlausibleBpm(bpm);

  if (!context) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.eyebrow}>Heart rate</Text>
        <Text style={styles.title}>What were you just doing?</Text>
        <Text style={styles.body}>
          A pulse means nothing on its own. The answer here decides whether this reading
          counts toward your usual range or is just noted alongside it.
        </Text>
        <View style={styles.contextList}>
          {PULSE_CONTEXTS.map((entry, index) => (
            <View key={entry.id}>
              {index > 0 ? <View style={styles.divider} /> : null}
              <Pressable
                accessibilityHint={entry.note}
                accessibilityLabel={entry.label}
                accessibilityRole="button"
                onPress={() => setContext(entry.id)}
                style={({ pressed }) => [styles.contextRow, pressed && styles.pressed]}
              >
                <View style={styles.contextCopy}>
                  <Text style={styles.contextLabel}>{entry.label}</Text>
                  <Text style={styles.contextNote}>{entry.note}</Text>
                </View>
                {entry.resting ? <Text style={styles.baselineTag}>counts</Text> : null}
              </Pressable>
            </View>
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.eyebrow}>Heart rate</Text>

      <Pressable
        accessibilityHint={
          phase === 'counting'
            ? 'Tap once for every beat you feel'
            : 'Starts a fifteen second counting window'
        }
        accessibilityLabel={
          phase === 'counting' ? `Counting, ${remaining} seconds left` : 'Start counting your pulse'
        }
        accessibilityRole="button"
        disabled={phase === 'done' || busy}
        onPress={() => {
          if (phase === 'idle') return begin();
          if (phase === 'counting') {
            tapCount.current += 1;
            setTaps(tapCount.current);
          }
        }}
        style={({ pressed }) => [
          styles.pad,
          phase === 'counting' && styles.padLive,
          pressed && phase !== 'done' && styles.padPressed
        ]}
      >
        {phase === 'idle' ? (
          <>
            <Text style={styles.padLead}>Start</Text>
            <Text style={styles.padHint}>
              Find your pulse at the wrist or the side of the neck first
            </Text>
          </>
        ) : phase === 'counting' ? (
          <>
            <Text style={styles.padCount}>{taps}</Text>
            <Text style={styles.padHint}>Tap every beat · {remaining}s left</Text>
          </>
        ) : (
          <>
            <Text style={styles.padCount}>{usable ? bpm : '—'}</Text>
            <Text style={styles.padHint}>
              {usable ? `bpm · ${taps} beats in ${COUNT_WINDOW_SECONDS}s` : 'That count does not look like a pulse'}
            </Text>
          </>
        )}
      </Pressable>

      {phase === 'idle' ? (
        <Text style={styles.body}>
          Tap the panel once for every beat, for {COUNT_WINDOW_SECONDS} seconds. The app
          multiplies by four — the same arithmetic a nurse does.
        </Text>
      ) : null}

      {phase === 'done' ? (
        <View style={styles.actions}>
          {usable ? (
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={() => {
                onReading(bpm, context, 'counted');
                reset();
                setContext(null);
              }}
              style={({ pressed }) => [styles.save, (pressed || busy) && styles.pressed]}
            >
              <Text style={styles.saveText}>Save {bpm} bpm</Text>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            onPress={reset}
            style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
          >
            <Text style={styles.secondaryText}>{usable ? 'Count again' : 'Try again'}</Text>
          </Pressable>
        </View>
      ) : null}

      <Pressable
        accessibilityRole="button"
        onPress={() => { reset(); setContext(null); }}
        style={({ pressed }) => [styles.textButton, pressed && styles.pressed]}
      >
        <Text style={styles.textButtonLabel}>
          {pulseContextLabel(context)} · change
        </Text>
      </Pressable>
    </View>
  );
}

function pulseContextLabel(id: PulseContext): string {
  return PULSE_CONTEXTS.find((entry) => entry.id === id)?.label ?? 'Sitting quietly';
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  eyebrow: { ...type.label, color: colors.textMuted, fontSize: 13, letterSpacing: 0 },
  title: { ...type.heading, color: colors.text },
  body: { ...type.caption, color: colors.textMuted, lineHeight: 19 },

  contextList: { gap: 0 },
  contextRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
    minHeight: 56,
    paddingVertical: 8
  },
  contextCopy: { flex: 1, gap: 2 },
  contextLabel: { ...type.body, color: colors.text, fontWeight: '600' },
  contextNote: { ...type.caption, color: colors.textMuted, lineHeight: 18 },
  baselineTag: {
    ...type.caption,
    backgroundColor: colors.accentWash,
    borderRadius: 6,
    color: colors.accent,
    fontWeight: '600',
    overflow: 'hidden',
    paddingHorizontal: 7,
    paddingVertical: 3
  },
  divider: { backgroundColor: colors.border, height: hairlineWidth },

  pad: {
    alignItems: 'center',
    backgroundColor: colors.surfaceInset,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: hairlineWidth,
    gap: 4,
    justifyContent: 'center',
    minHeight: 148,
    padding: 18
  },
  padLive: { backgroundColor: colors.accentWash, borderColor: colors.accent },
  padPressed: { opacity: 0.85 },
  padLead: { ...type.heading, color: colors.text },
  padCount: { ...type.hero, color: colors.text, fontSize: 52, lineHeight: 56 },
  padHint: { ...type.caption, color: colors.textMuted, textAlign: 'center' },

  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  save: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 14,
    flexGrow: 1,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 16
  },
  saveText: { ...type.label, color: colors.primaryText, fontSize: 16 },
  secondary: {
    alignItems: 'center',
    backgroundColor: colors.surfaceInset,
    borderRadius: 14,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 16
  },
  secondaryText: { ...type.label, color: colors.text },

  textButton: { alignSelf: 'flex-start', justifyContent: 'center', minHeight: 44 },
  textButtonLabel: { ...type.caption, color: colors.textFaint },
  pressed: { opacity: 0.7 }
});
