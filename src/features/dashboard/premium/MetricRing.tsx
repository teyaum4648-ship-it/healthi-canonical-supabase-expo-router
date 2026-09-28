import { useEffect, useState, type ReactNode } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { useReducedMotion } from '../../../components/mobile/useReducedMotion';
import { motion } from '../../../styles/tokens';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const curve = Easing.bezier(...motion.bezier);

/**
 * A flat progress ring: one track, one arc, round caps, no ticks or gradient. The arc
 * fills on the shared curve when the value changes; with Reduce Motion it is drawn in
 * place. Whatever sits in the middle is the caller's, so the number is always text.
 */
export function MetricRing({ value, size, stroke, color, track = 'rgba(235, 240, 255, 0.08)', children }: {
  /** 0–100, or null for an empty track. */
  value: number | null;
  size: number;
  stroke: number;
  color: string;
  track?: string;
  children?: ReactNode;
}) {
  const reducedMotion = useReducedMotion();
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const target = value === null ? 0 : Math.max(0, Math.min(100, value));
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.timing(progress, {
      toValue: target,
      duration: reducedMotion ? 0 : 700,
      easing: curve,
      useNativeDriver: false
    }).start();
  }, [progress, reducedMotion, target]);

  const dashOffset = progress.interpolate({ inputRange: [0, 100], outputRange: [circumference, 0] });

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={track} strokeWidth={stroke} />
        {value !== null ? (
          <AnimatedCircle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        ) : null}
      </Svg>
      <View pointerEvents="box-none" style={styles.center}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' }
});
