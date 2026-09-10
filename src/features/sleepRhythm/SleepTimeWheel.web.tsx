import { useId, useLayoutEffect, useRef } from 'react';

import { fonts } from '../../styles/mobileTheme';
import { sleepWheelIndex, type SleepTimeWheelProps } from './sleepTimePickerModel';

/** Browser-native scrolling and snapping, including iPhone Safari. No touch-drag emulation. */
export function SleepTimeWheel(props: SleepTimeWheelProps) {
  const id = useId();
  const element = useRef<HTMLDivElement>(null);
  const selected = useRef<number | null>(null);
  const height = useRef(props.rowHeight);

  useLayoutEffect(() => {
    if (selected.current === props.index && height.current === props.rowHeight) return;
    selected.current = props.index;
    height.current = props.rowHeight;
    if (element.current) element.current.scrollTop = props.index * props.rowHeight;
  }, [props.index, props.rowHeight]);

  function select(index: number) {
    const next = Math.max(0, Math.min(props.options.length - 1, index));
    selected.current = next;
    if (element.current) element.current.scrollTop = next * props.rowHeight;
    props.onChange(next);
  }

  return (
    <div
      ref={element}
      role="listbox"
      tabIndex={0}
      aria-label={props.label}
      aria-activedescendant={`${id}-${props.index}`}
      onKeyDown={(event) => {
        const next = event.key === 'ArrowDown' ? props.index + 1
          : event.key === 'ArrowUp' ? props.index - 1
            : event.key === 'Home' ? 0
              : event.key === 'End' ? props.options.length - 1 : null;
        if (next !== null) { event.preventDefault(); select(next); }
      }}
      onScroll={(event) => {
        const next = sleepWheelIndex(event.currentTarget.scrollTop, props.rowHeight, props.options.length);
        if (next !== selected.current) { selected.current = next; props.onChange(next); }
      }}
      onContextMenu={(event) => event.preventDefault()}
      style={{
        flex: 1, minWidth: 0, height: props.rowHeight * props.visibleRows, boxSizing: 'border-box',
        paddingBlock: props.rowHeight * Math.floor(props.visibleRows / 2), overflowY: 'auto', overscrollBehaviorY: 'contain',
        scrollSnapType: 'y mandatory', scrollbarWidth: 'none', touchAction: 'pan-y',
        userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none',
        fontFamily: fonts.body, fontVariantNumeric: 'tabular-nums'
      }}
    >
      {props.options.map((option, index) => (
        <div
          id={`${id}-${index}`}
          key={option}
          role="option"
          aria-selected={props.index === index}
          onClick={() => select(index)}
          style={{ height: props.rowHeight, display: 'flex', alignItems: 'center', justifyContent: 'center', scrollSnapAlign: 'center', cursor: 'pointer', fontSize: 24, fontWeight: props.index === index ? 600 : 400, color: props.index === index ? props.textColor : props.mutedColor }}
        >{option}</div>
      ))}
    </div>
  );
}
