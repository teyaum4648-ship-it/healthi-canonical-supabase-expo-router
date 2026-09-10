import { useEffect, useRef, type PointerEvent } from 'react';

import type { SleepChartSurfaceProps } from './SleepChartSurface';
import { createSleepChartInteraction } from './sleepChartInteraction';

export function SleepChartSurface(props: SleepChartSurfaceProps) {
  const element = useRef<HTMLDivElement>(null);
  const latest = useRef(props);
  latest.current = props;
  const interaction = useRef(createSleepChartInteraction({
    getBounds: () => element.current?.getBoundingClientRect() ?? { left: 0, width: 0 },
    getSelection: () => latest.current.ratio,
    onSelect: (ratio) => latest.current.onSelect(ratio)
  })).current;
  useEffect(() => {
    const node = element.current;
    if (!node) return;
    const measure = () => latest.current.onWidth(node.getBoundingClientRect().width);
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(node);
    window.addEventListener('resize', measure);
    return () => { observer?.disconnect(); window.removeEventListener('resize', measure); };
  }, []);
  function point(event: PointerEvent<HTMLDivElement>) { return { id: event.pointerId, x: event.clientX, y: event.clientY }; }
  return (
    <div
      ref={element}
      role="slider"
      tabIndex={0}
      aria-label="Predicted energy through your day"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round((props.ratio ?? 0) * 100)}
      aria-valuetext={props.valueLabel}
      onPointerDown={(event) => {
        if (!event.isPrimary || event.button !== 0) return;
        if (interaction.begin(point(event))) event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (interaction.move(point(event)) === 'horizontal' && event.cancelable) event.preventDefault();
      }}
      onPointerUp={(event) => {
        interaction.end(point(event));
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      onPointerCancel={(event) => interaction.cancel(event.pointerId)}
      onLostPointerCapture={(event) => interaction.cancel(event.pointerId)}
      onContextMenu={(event) => event.preventDefault()}
      onDragStart={(event) => event.preventDefault()}
      onKeyDown={(event) => {
        const next = event.key === 'ArrowRight' ? (props.ratio ?? 0) + 0.02
          : event.key === 'ArrowLeft' ? (props.ratio ?? 0) - 0.02
            : event.key === 'Home' ? 0 : event.key === 'End' ? 1 : null;
        if (next !== null) { event.preventDefault(); props.onSelect(Math.max(0, Math.min(1, next))); }
        else if (event.key === 'Escape') { event.preventDefault(); props.onSelect(null); }
      }}
      style={{
        height: props.height, width: '100%', position: 'relative',
        touchAction: 'pan-y pinch-zoom', userSelect: 'none', WebkitUserSelect: 'none',
        WebkitTouchCallout: 'none', cursor: 'crosshair'
      }}
    >
      <div style={{ height: '100%', pointerEvents: 'none' }}>{props.children}</div>
    </div>
  );
}
