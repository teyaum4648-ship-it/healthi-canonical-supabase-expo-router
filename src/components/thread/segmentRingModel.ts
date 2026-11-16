/**
 * Geometry for the 1c segmented ring (design language P11): equal arcs clockwise from
 * 12 o'clock with a fixed gap between them, drawn as SVG circles with strokeDasharray and
 * strokeDashoffset. Pure, so it can be tested without rendering.
 */

export type SegmentRingGeometry = {
  circumference: number;
  /** Arc length each segment's track takes, after the gap. */
  segmentLength: number;
  /** strokeDashoffset for each segment, so segment i starts half a gap after its slot. */
  offsets: number[];
};

export function segmentRingGeometry(radius: number, count: number, gap: number): SegmentRingGeometry {
  const circumference = 2 * Math.PI * radius;
  const slot = circumference / count;
  const segmentLength = Math.max(0, slot - gap);
  const offsets = Array.from({ length: count }, (_, index) => -(gap / 2 + index * slot));
  return { circumference, segmentLength, offsets };
}

/**
 * The dash pattern for one segment. A fill of null (no signal) draws nothing: missing is an
 * empty track, never a short arc. Fills are clamped to 0..1.
 */
export function segmentDash(geometry: SegmentRingGeometry, fill: number | null): [number, number] | null {
  if (fill === null || !Number.isFinite(fill)) return null;
  const length = geometry.segmentLength * Math.min(1, Math.max(0, fill));
  if (length < 0.5) return null;
  return [length, geometry.circumference];
}
