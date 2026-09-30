import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { pillarColors } from '../../../styles/pillarColors';
import { PILLAR_ORDER, pillarFill, type PillarReading } from './pillarRingModel';

export { PILLAR_ORDER, pillarFill, type PillarReading } from './pillarRingModel';

/** Degrees left clear either side of each quarter, so the four read as separate. */
const GAP = 4;
const SPAN = 90 - GAP * 2;

function arc(center: number, radius: number, from: number, to: number): string {
  const point = (degrees: number) => {
    const radians = (degrees * Math.PI) / 180;
    return `${(center + radius * Math.sin(radians)).toFixed(2)} ${(center - radius * Math.cos(radians)).toFixed(2)}`;
  };
  return `M ${point(from)} A ${radius} ${radius} 0 0 1 ${point(to)}`;
}

/**
 * The readiness ring split into its four foundations: recovery at the top right, then
 * nourishment, movement and mind clockwise. Each quarter fills by where that foundation
 * sits in its own range today, so the ring shows which ones are carrying the day and
 * which have room, around the one number in the middle.
 */
export function PillarRing({ pillars, size = 264, children }: { pillars: readonly PillarReading[]; size?: number; children?: ReactNode }) {
  const center = size / 2;
  const stroke = Math.round((size * 12) / 280);
  const radius = (size * 116) / 280;
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={StyleSheet.absoluteFill}>
        <Circle cx={center} cy={center} r={(size * 96) / 280} stroke="rgba(255, 255, 255, 0.04)" strokeWidth={1} fill="none" />
        {PILLAR_ORDER.map((domain, index) => {
          const start = index * 90 + GAP;
          return (
            <Path key={`track-${domain}`} d={arc(center, radius, start, start + SPAN)} stroke="rgba(255, 255, 255, 0.07)" strokeWidth={stroke} strokeLinecap="round" fill="none" />
          );
        })}
        {PILLAR_ORDER.map((domain, index) => {
          const start = index * 90 + GAP;
          const fill = pillarFill(pillars.find(p => p.domain === domain));
          if (fill === null || fill < 0.02) return null;
          return (
            <Path key={`fill-${domain}`} d={arc(center, radius, start, start + SPAN * fill)} stroke={pillarColors[domain]} strokeWidth={stroke} strokeLinecap="round" fill="none" />
          );
        })}
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.center]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' }
});
