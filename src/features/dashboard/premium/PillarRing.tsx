import type { ReactNode } from 'react';

import { SegmentRing } from '../../../components/thread/SegmentRing';
import { pillar, ring } from '../../../styles/daywoven1c';
import { PILLAR_ORDER, pillarFill, type PillarReading } from './pillarRingModel';

export { PILLAR_ORDER, pillarFill, type PillarReading } from './pillarRingModel';

/**
 * The readiness ring split into its four foundations, clockwise from 12 o'clock: recovery,
 * nourishment, movement, mind (PILLAR_ORDER, the same order as PILLAR_ORDER_1C). Each
 * segment fills by where that foundation sits in its own range today (pillarFill), so a
 * missing foundation is an empty track, never a short one.
 */
export function PillarRing({ pillars, size = ring.size, accessibilityLabel, children }: {
  pillars: readonly PillarReading[];
  size?: number;
  accessibilityLabel?: string;
  children?: ReactNode;
}) {
  const scale = size / ring.size;
  return (
    <SegmentRing
      size={size}
      radius={ring.radius * scale}
      stroke={ring.stroke * scale}
      accessibilityLabel={accessibilityLabel}
      segments={PILLAR_ORDER.map((domain) => ({
        key: domain,
        color: pillar[domain],
        fill: pillarFill(pillars.find((reading) => reading.domain === domain))
      }))}
    >
      {children}
    </SegmentRing>
  );
}
