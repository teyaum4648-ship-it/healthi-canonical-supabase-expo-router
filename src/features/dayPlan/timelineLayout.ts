export type TimelineSpan = { startMs: number; endMs: number };
export type TimelinePlacement = { column: number; columns: number };

/**
 * Side-by-side columns for spans that overlap, the way a calendar lays out a busy day.
 *
 * Spans that overlap — directly or through a chain of others — form a group, and every
 * span in the group shares its width with the rest. Within a group each span takes the
 * leftmost column that is free when it starts. Spans that touch end to start do not
 * overlap. Placements come back in the order the spans went in.
 */
export function layoutOverlaps(spans: readonly TimelineSpan[]): TimelinePlacement[] {
  const order = spans
    .map((span, index) => ({ ...span, index }))
    .sort((left, right) => left.startMs - right.startMs || right.endMs - left.endMs);
  const placements: TimelinePlacement[] = spans.map(() => ({ column: 0, columns: 1 }));

  let group: number[] = [];
  let columnEnds: number[] = [];
  let groupEnd = -Infinity;
  const close = () => {
    for (const index of group) placements[index]!.columns = columnEnds.length;
    group = [];
    columnEnds = [];
    groupEnd = -Infinity;
  };

  for (const span of order) {
    if (span.startMs >= groupEnd) close();
    let column = columnEnds.findIndex((end) => end <= span.startMs);
    if (column === -1) {
      column = columnEnds.length;
      columnEnds.push(span.endMs);
    } else {
      columnEnds[column] = span.endMs;
    }
    placements[span.index]!.column = column;
    group.push(span.index);
    groupEnd = Math.max(groupEnd, span.endMs);
  }
  close();
  return placements;
}
