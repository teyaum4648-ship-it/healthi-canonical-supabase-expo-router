import { useState, type ReactNode } from 'react';
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle
} from 'react-native';

import { motion } from '../../styles/tokens';
import { webTransition } from '../../styles/mobileTheme';
import { useReducedMotion } from './useReducedMotion';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const curve = Easing.bezier(...motion.bezier);

type FluidPressableProps = Omit<PressableProps, 'style' | 'children'> & {
  style?: StyleProp<ViewStyle>;
  /** Laid over `style` while a pointer rests on it (web) — a background shift, never a jump. */
  hoverStyle?: StyleProp<ViewStyle>;
  /** How far it sinks while held. 1 turns the press motion off. */
  pressedScale?: number;
  children: ReactNode;
};

/**
 * Every tappable surface on the dashboard moves the same way: it sinks slightly while
 * held and settles back on one curve, cubic-bezier(0.25, 1, 0.5, 1) over 250 ms. On the
 * web the hover and focus changes ease on that curve too. Reduce Motion turns the scale
 * off and leaves the colour change, which carries the feedback on its own.
 */
export function FluidPressable({ style, hoverStyle, pressedScale = 0.98, children, onPressIn, onPressOut, onHoverIn, onHoverOut, ...props }: FluidPressableProps) {
  const reducedMotion = useReducedMotion();
  const [scale] = useState(() => new Animated.Value(1));
  const [hovered, setHovered] = useState(false);

  function settle(toValue: number) {
    Animated.timing(scale, {
      toValue,
      duration: motion.duration,
      easing: curve,
      useNativeDriver: Platform.OS !== 'web'
    }).start();
  }

  return (
    <AnimatedPressable
      {...props}
      onPressIn={(event) => {
        if (!reducedMotion && pressedScale !== 1) settle(pressedScale);
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        if (!reducedMotion && pressedScale !== 1) settle(1);
        onPressOut?.(event);
      }}
      onHoverIn={(event) => {
        setHovered(true);
        onHoverIn?.(event);
      }}
      onHoverOut={(event) => {
        setHovered(false);
        onHoverOut?.(event);
      }}
      style={[webTransition, style, hovered ? hoverStyle : null, { transform: [{ scale }] }]}
    >
      {children}
    </AnimatedPressable>
  );
}
