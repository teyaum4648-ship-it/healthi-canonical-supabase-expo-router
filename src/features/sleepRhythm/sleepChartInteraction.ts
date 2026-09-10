export type ChartPointer = { id: number | string; x: number; y: number };
export type ChartDirection = 'pending' | 'horizontal' | 'vertical';

export function chartDragDirection(start: ChartPointer, current: ChartPointer, direction: ChartDirection): ChartDirection {
  if (direction !== 'pending') return direction;
  const dx = Math.abs(current.x - start.x);
  const dy = Math.abs(current.y - start.y);
  if (Math.max(dx, dy) < 8) return 'pending';
  return dx > dy * 1.2 ? 'horizontal' : 'vertical';
}

export function chartRatioAtX(x: number, left: number, width: number): number | null {
  if (![x, left, width].every(Number.isFinite) || width <= 0) return null;
  return Math.max(0, Math.min(1, (x - left) / width));
}

/** Pointer ownership, direction lock, and cancellation are independent of rendering. */
export function createSleepChartInteraction(options: {
  getBounds: () => { left: number; width: number };
  getSelection: () => number | null;
  onSelect: (ratio: number | null) => void;
}) {
  let gesture: { start: ChartPointer; direction: ChartDirection; previous: number | null } | null = null;
  function select(point: ChartPointer) {
    const bounds = options.getBounds();
    const ratio = chartRatioAtX(point.x, bounds.left, bounds.width);
    if (ratio !== null) options.onSelect(ratio);
  }
  return {
    begin(point: ChartPointer): boolean {
      if (gesture) return false;
      gesture = { start: point, direction: 'pending', previous: options.getSelection() };
      select(point);
      return true;
    },
    move(point: ChartPointer): ChartDirection | null {
      if (!gesture || gesture.start.id !== point.id) return null;
      const previousDirection = gesture.direction;
      gesture.direction = chartDragDirection(gesture.start, point, gesture.direction);
      if (gesture.direction === 'horizontal') select(point);
      else if (gesture.direction === 'vertical' && previousDirection !== 'vertical') options.onSelect(gesture.previous);
      return gesture.direction;
    },
    end(point: ChartPointer) {
      if (!gesture || gesture.start.id !== point.id) return;
      gesture.direction = chartDragDirection(gesture.start, point, gesture.direction);
      if (gesture.direction !== 'vertical') select(point);
      else options.onSelect(gesture.previous);
      // Keep the selected time readable after lifting the finger.
      gesture = null;
    },
    cancel(id: ChartPointer['id']) {
      if (!gesture || gesture.start.id !== id) return;
      const previous = gesture.previous;
      gesture = null;
      options.onSelect(previous);
    }
  };
}
