import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { CheckBox } from '../../components/CheckBox';
import { useReducedMotion } from '../../components/mobile/useReducedMotion';
import { colors, type } from '../../styles/mobileTheme';
import { tabAccent } from '../../styles/pillarColors';
import { BreathCircle } from './BreathCircle';
import type { BreathTechnique } from './breathTechniques';
import { useStopOnBackground } from './useStopOnBackground';

/**
 * The rounds runner, for cyclic hyperventilation.
 *
 * Its own component because the shape is nothing like the pacer: fast paced breaths, then
 * a retention with no fixed length that only the person can end, then a short recovery
 * hold, then round two. A loop with a dial cannot express that.
 *
 * **The gate is not paperwork.** This technique can make someone faint without warning,
 * and people have drowned doing it in water. So the first run is blocked behind an
 * explicit statement about where they are, the acknowledgement is stored per person so it
 * is asked once rather than nagged, and the water line stays on screen every single run
 * regardless. A caution that scrolls away is a caution nobody reads.
 *
 * The retention timer counts up rather than down, because counting down implies a target
 * and a target is exactly the wrong incentive here.
 */

type Stage = 'gate' | 'idle' | 'breathing' | 'retention' | 'recovery' | 'done';

export function CyclicBreathRounds({
  technique,
  acknowledged,
  onAcknowledge,
  onSession
}: {
  technique: BreathTechnique;
  acknowledged: boolean;
  onAcknowledge: () => void;
  /** Total seconds actually spent, plus each retention, once the whole thing ends. */
  onSession: (seconds: number, retentionSeconds: number[]) => void;
}) {
  const plan = technique.rounds ?? { count: 3, breaths: 30, breathMs: 3200, recoveryHoldMs: 15000 };

  const [stage, setStage] = useState<Stage>(acknowledged ? 'idle' : 'gate');
  const [confirmed, setConfirmed] = useState(false);
  const [round, setRound] = useState(1);
  const [breath, setBreath] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [retentions, setRetentions] = useState<number[]>([]);

  const reduced = useReducedMotion();
  const wave = useRef(new Animated.Value(0)).current;
  const startedAt = useRef<number | null>(null);
  const stageStartedAt = useRef<number>(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = () => { if (timer.current) clearTimeout(timer.current); };

  /* The paced breaths. Half the phase up, half down, advancing a counter each time. */
  useEffect(() => {
    if (stage !== 'breathing') return;
    let cancelled = false;
    let n = 0;

    const one = () => {
      if (cancelled) return;
      if (n >= plan.breaths) {
        stageStartedAt.current = Date.now();
        setStage('retention');
        return;
      }
      n += 1;
      setBreath(n);
      Animated.sequence([
        Animated.timing(wave, { toValue: 1, duration: plan.breathMs / 2, useNativeDriver: true }),
        Animated.timing(wave, { toValue: 0, duration: plan.breathMs / 2, useNativeDriver: true })
      ]).start();
      timer.current = setTimeout(one, plan.breathMs);
    };

    one();
    return () => { cancelled = true; clear(); wave.stopAnimation(); };
  }, [stage, plan.breaths, plan.breathMs, wave]);

  /* The recovery hold is the one fixed-length stage, so it runs itself. */
  useEffect(() => {
    if (stage !== 'recovery') return;
    wave.setValue(1);
    timer.current = setTimeout(() => {
      wave.setValue(0);
      if (round >= plan.count) {
        const total = startedAt.current ? Math.round((Date.now() - startedAt.current) / 1000) : 0;
        setStage('done');
        onSession(total, retentions);
        return;
      }
      setRound((current) => current + 1);
      setBreath(0);
      setStage('breathing');
    }, plan.recoveryHoldMs);
    return clear;
    // `retentions` is read only at the end of the last round, where it is already current.
  }, [stage, round, plan.count, plan.recoveryHoldMs, wave, retentions, onSession]);

  /* One clock for whichever stage is timing itself. */
  useEffect(() => {
    if (stage !== 'retention' && stage !== 'recovery') { setSeconds(0); return; }
    const tick = setInterval(() => {
      setSeconds(Math.floor((Date.now() - stageStartedAt.current) / 1000));
    }, 250);
    return () => clearInterval(tick);
  }, [stage]);

  function begin() {
    startedAt.current = Date.now();
    setRetentions([]);
    setRound(1);
    setBreath(0);
    setStage('breathing');
  }

  function endRetention() {
    setRetentions((current) => [...current, Math.max(0, Math.round((Date.now() - stageStartedAt.current) / 1000))]);
    stageStartedAt.current = Date.now();
    setStage('recovery');
  }

  const abandon = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    wave.stopAnimation();
    wave.setValue(0);
    const total = startedAt.current ? Math.round((Date.now() - startedAt.current) / 1000) : 0;
    startedAt.current = null;
    setStage('idle');
    setRound(1);
    setBreath(0);
    if (total > 0) onSession(total, retentions);
  }, [onSession, retentions, wave]);
  useStopOnBackground(stage === 'breathing' || stage === 'retention' || stage === 'recovery', abandon);

  const clock = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

  if (stage === 'gate') {
    return (
      <View style={styles.wrap}>
        <Text style={styles.eyebrow}>Before you start</Text>
        <Text style={styles.title}>{technique.name}</Text>
        <View style={styles.danger}>
          <Text style={styles.dangerText}>{technique.caution}</Text>
        </View>
        <CheckBox
          checked={confirmed}
          label="I am on land, sitting or lying down, not in or near water, and not driving"
          onChange={setConfirmed}
        />
        <Pressable
          accessibilityRole="button"
          disabled={!confirmed}
          onPress={() => { onAcknowledge(); setStage('idle'); }}
          style={({ pressed }) => [styles.primary, !confirmed && styles.dim, pressed && styles.pressed]}
        >
          <Text style={styles.primaryText}>I understand</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.eyebrow}>
        {stage === 'idle' || stage === 'done'
          ? technique.name.toUpperCase()
          : `ROUND ${round} OF ${plan.count}`}
      </Text>

      {/* Never scrolls away, whatever stage this is. */}
      <View style={styles.waterline}>
        <Text style={styles.waterlineText}>
          Never in or near water. Stop and breathe normally if you feel faint.
        </Text>
      </View>

      {stage === 'idle' ? (
        <>
          <Text style={styles.body}>
            {plan.count} rounds. Each one is {plan.breaths} full breaths, then you hold with
            your lungs empty for as long as is comfortable, then a {Math.round(plan.recoveryHoldMs / 1000)}-second
            hold with them full. About {technique.suggestedMinutes} minutes altogether.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={begin}
            style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
          >
            <Text style={styles.primaryText}>Start round 1</Text>
          </Pressable>
        </>
      ) : null}

      {stage === 'breathing' || stage === 'retention' || stage === 'recovery' ? (
        <View style={styles.stage}>
          <BreathCircle
            label={stage === 'breathing' ? `${breath}/${plan.breaths}` : clock}
            reduced={reduced}
            wave={wave}
          />
          <Text accessibilityLiveRegion="polite" style={styles.cue}>
            {stage === 'breathing'
              ? 'Full breath in, let it fall out. Do not force the exhale.'
              : stage === 'retention'
                ? 'Hold, lungs empty. Tap below when you need to breathe.'
                : 'Big breath in — hold it.'}
          </Text>

          {stage === 'retention' ? (
            <Pressable
              accessibilityRole="button"
              onPress={endRetention}
              style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
            >
              <Text style={styles.primaryText}>I need to breathe</Text>
            </Pressable>
          ) : null}

          <Pressable
            accessibilityRole="button"
            onPress={abandon}
            style={({ pressed }) => [styles.textButton, pressed && styles.pressed]}
          >
            <Text style={styles.textButtonLabel}>Stop</Text>
          </Pressable>
        </View>
      ) : null}

      {stage === 'done' ? (
        <>
          <Text style={styles.title}>Done</Text>
          <Text style={styles.body}>
            {retentions.length > 0
              ? `Holds: ${retentions.map((value) => `${value}s`).join(' · ')}. These usually lengthen across rounds, which is the carbon dioxide dropping rather than your lungs improving.`
              : 'No holds recorded.'}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => setStage('idle')}
            style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
          >
            <Text style={styles.primaryText}>Again</Text>
          </Pressable>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  eyebrow: { ...type.label, color: colors.textMuted, fontSize: 13, letterSpacing: 0 },
  title: { ...type.heading, color: colors.text },
  body: { ...type.caption, color: colors.textMuted, lineHeight: 20 },

  danger: {
    backgroundColor: colors.surfaceInset,
    borderColor: colors.danger,
    borderRadius: 12,
    borderWidth: 1,
    padding: 14
  },
  dangerText: { ...type.caption, color: colors.text, lineHeight: 20 },

  waterline: {
    backgroundColor: colors.surfaceInset,
    borderLeftColor: colors.danger,
    borderLeftWidth: 3,
    borderRadius: 8,
    paddingHorizontal: 11,
    paddingVertical: 8
  },
  waterlineText: { ...type.caption, color: colors.textMuted, lineHeight: 18 },

  stage: { alignItems: 'center', gap: 12 },
  cue: { ...type.body, color: colors.text, fontWeight: '600', textAlign: 'center' },

  primary: {
    alignItems: 'center',
    backgroundColor: tabAccent.mood,
    borderRadius: 14,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 18
  },
  primaryText: { ...type.label, color: colors.primaryText, fontSize: 16 },
  dim: { opacity: 0.45 },
  textButton: { alignSelf: 'center', justifyContent: 'center', minHeight: 44 },
  textButtonLabel: { ...type.label, color: colors.textFaint },
  pressed: { opacity: 0.7 }
});
