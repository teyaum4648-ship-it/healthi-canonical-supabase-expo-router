import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Animated, Easing, Platform } from 'react-native';

import { useReducedMotion } from '../mobile/useReducedMotion';

/** The chevron on every 1c disclosure: points down when closed and turns over when open. */
export function RotatingChevron({ open, color, size = 15 }: { open: boolean; color: string; size?: number }) {
  const reducedMotion = useReducedMotion();
  const [turn] = useState(() => new Animated.Value(open ? 1 : 0));
  useEffect(() => {
    Animated.timing(turn, {
      toValue: open ? 1 : 0,
      duration: reducedMotion ? 0 : 200,
      easing: Easing.out(Easing.quad),
      useNativeDriver: Platform.OS !== 'web'
    }).start();
  }, [open, reducedMotion, turn]);
  return (
    <Animated.View style={{ transform: [{ rotate: turn.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] }) }] }}>
      <Ionicons accessible={false} color={color} name="chevron-down" size={size} />
    </Animated.View>
  );
}
