import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { colors, type } from '../../styles/mobileTheme';
import { hasScore, scoreRingColor } from './scoreRing';

/**
 * A product's score, small enough to sit in a list row.
 *
 * The scanner's full verdict answers "what is this and why". This answers the question
 * a person has while scrolling a search result: is it worth looking at. So it is a
 * number and an arc, nothing else — no grade letter, no copy, no tap target of its own.
 *
 * The colours live in `scoreRing.ts` next to this file, so the band cuts can be tested
 * without rendering anything.
 */

export function ScoreRing({ score, size = 38, label }: {
  score: number | null | undefined;
  size?: number;
  /**
   * What a screen reader says. Defaults to the number and nothing more, because in a
   * list the row already names the food.
   */
  label?: string;
}) {
  const known = hasScore(score);
  const value = known ? Math.max(0, Math.min(100, Math.round(score))) : 0;
  const tint = scoreRingColor(score, colors.textFaint);

  const stroke = Math.max(2.5, size * 0.085);
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <View
      accessibilityLabel={label ?? (known ? `Quality score ${value} of 100` : 'Quality score unavailable')}
      accessibilityRole="image"
      style={[styles.wrap, { height: size, width: size }]}
    >
      <Svg height={size} style={StyleSheet.absoluteFill} width={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          fill="none"
          r={radius}
          stroke={colors.surfaceMuted}
          strokeWidth={stroke}
        />
        {known ? (
          <Circle
            cx={size / 2}
            cy={size / 2}
            fill="none"
            r={radius}
            stroke={tint}
            strokeDasharray={`${circumference}`}
            /* The arc grows clockwise from twelve o'clock, so the dash offset runs down
               from a full circumference rather than up from zero. */
            strokeDashoffset={circumference * (1 - value / 100)}
            strokeLinecap="round"
            strokeWidth={stroke}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        ) : null}
      </Svg>
      <Text style={[styles.value, { color: known ? tint : colors.textFaint, fontSize: Math.round(size * 0.37) }]}>
        {known ? value : '—'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  value: { ...type.label, fontVariant: ['tabular-nums'], lineHeight: undefined }
});
