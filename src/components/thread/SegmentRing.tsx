import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';

import { bone, ring } from '../../styles/daywoven1c';
import { segmentDash, segmentRingGeometry } from './segmentRingModel';

export type RingSegment = {
  key: string;
  color: string;
  /** 0..1, or null when there is no signal (drawn as an empty track). */
  fill: number | null;
};

/**
 * The 1c ring (P11): segmented arcs with 6pt gaps, clockwise from 12 o'clock, each a track
 * plus a fill. Only ever one per screen, for the score that screen is about. The children
 * sit in the middle; the caller gives the whole ring one accessibility label.
 */
export function SegmentRing({
  segments,
  size = ring.size,
  radius = ring.radius,
  stroke = ring.stroke,
  gap = ring.gap,
  trackColor = bone.ringTrack,
  accessibilityLabel,
  children
}: {
  segments: readonly RingSegment[];
  size?: number;
  radius?: number;
  stroke?: number;
  gap?: number;
  trackColor?: string;
  accessibilityLabel?: string;
  children?: ReactNode;
}) {
  const geometry = segmentRingGeometry(radius, segments.length, gap);
  const center = size / 2;
  return (
    <View
      accessible={Boolean(accessibilityLabel)}
      accessibilityRole={accessibilityLabel ? 'image' : undefined}
      accessibilityLabel={accessibilityLabel}
      style={{ width: size, height: size }}
    >
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={StyleSheet.absoluteFill}>
        <G rotation={-90} origin={`${center}, ${center}`}>
          {segments.map((segment, index) => (
            <Circle
              key={`track-${segment.key}`}
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke={trackColor}
              strokeWidth={stroke}
              strokeDasharray={[geometry.segmentLength, geometry.circumference]}
              strokeDashoffset={geometry.offsets[index]}
            />
          ))}
          {segments.map((segment, index) => {
            const dash = segmentDash(geometry, segment.fill);
            if (!dash) return null;
            return (
              <Circle
                key={`fill-${segment.key}`}
                cx={center}
                cy={center}
                r={radius}
                fill="none"
                stroke={segment.color}
                strokeWidth={stroke}
                strokeDasharray={dash}
                strokeDashoffset={geometry.offsets[index]}
              />
            );
          })}
        </G>
      </Svg>
      <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={[StyleSheet.absoluteFill, styles.center]}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' }
});
