import { useRef, type ReactNode } from 'react';
import { PanResponder, View } from 'react-native';

import { chartDragDirection, createSleepChartInteraction, type ChartPointer } from './sleepChartInteraction';

export type SleepChartSurfaceProps = {
  children: ReactNode;
  height: number;
  ratio: number | null;
  valueLabel: string;
  onSelect: (ratio: number | null) => void;
  onWidth: (width: number) => void;
};

export function SleepChartSurface(props: SleepChartSurfaceProps) {
  const latest = useRef(props);
  latest.current = props;
  const width = useRef(0);
  const start = useRef<ChartPointer | null>(null);
  const horizontal = useRef(false);
  const interaction = useRef(createSleepChartInteraction({
    getBounds: () => ({ left: 0, width: width.current }),
    getSelection: () => latest.current.ratio,
    onSelect: (ratio) => latest.current.onSelect(ratio)
  })).current;
  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, state) => {
      if (!start.current || state.numberActiveTouches !== 1) return false;
      return chartDragDirection(start.current, { ...start.current, x: start.current.x + state.dx, y: start.current.y + state.dy }, 'pending') === 'horizontal';
    },
    onPanResponderGrant: () => { horizontal.current = true; },
    onPanResponderMove: (_, state) => {
      if (!start.current) return;
      interaction.move({ ...start.current, x: start.current.x + state.dx, y: start.current.y + state.dy });
    },
    onPanResponderRelease: (_, state) => {
      if (start.current) interaction.end({ ...start.current, x: start.current.x + state.dx, y: start.current.y + state.dy });
      start.current = null; horizontal.current = false;
    },
    onPanResponderTerminationRequest: (_, state) => !horizontal.current || state.numberActiveTouches !== 1,
    onPanResponderTerminate: () => {
      if (start.current) interaction.cancel(start.current.id);
      start.current = null; horizontal.current = false;
    }
  })).current;
  return (
    <View
      {...pan.panHandlers}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel="Predicted energy through your day"
      accessibilityValue={{ min: 0, max: 100, now: Math.round((props.ratio ?? 0) * 100), text: props.valueLabel }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(event) => props.onSelect(Math.max(0, Math.min(1, (props.ratio ?? 0) + (event.nativeEvent.actionName === 'increment' ? 0.02 : -0.02))))}
      onLayout={(event) => { width.current = event.nativeEvent.layout.width; props.onWidth(width.current); }}
      onTouchStart={(event) => {
        if (event.nativeEvent.touches.length !== 1) { if (start.current) interaction.cancel(start.current.id); start.current = null; return; }
        const point = { id: event.nativeEvent.identifier, x: event.nativeEvent.locationX, y: event.nativeEvent.pageY };
        if (interaction.begin(point)) start.current = point;
      }}
      onTouchMove={(event) => {
        if (start.current && !horizontal.current) interaction.move({ ...start.current, x: event.nativeEvent.locationX, y: event.nativeEvent.pageY });
      }}
      onTouchEnd={(event) => {
        if (start.current && !horizontal.current) { interaction.end({ ...start.current, x: event.nativeEvent.locationX, y: event.nativeEvent.pageY }); start.current = null; }
      }}
      onTouchCancel={() => { if (start.current) interaction.cancel(start.current.id); start.current = null; horizontal.current = false; }}
      style={{ height: props.height, position: 'relative' }}
    >
      <View pointerEvents="none" style={{ height: props.height }}>{props.children}</View>
    </View>
  );
}
