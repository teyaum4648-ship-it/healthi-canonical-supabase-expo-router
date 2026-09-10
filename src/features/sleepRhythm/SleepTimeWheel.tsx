import { useEffect, useRef } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { fonts } from '../../styles/mobileTheme';
import { sleepWheelIndex, type SleepTimeWheelProps } from './sleepTimePickerModel';

export function SleepTimeWheel(props: SleepTimeWheelProps) {
  const scroll = useRef<ScrollView>(null);
  const selected = useRef(props.index);

  useEffect(() => {
    if (selected.current === props.index) return;
    selected.current = props.index;
    scroll.current?.scrollTo({ y: props.index * props.rowHeight, animated: false });
  }, [props.index, props.rowHeight]);

  function select(index: number) {
    const next = Math.max(0, Math.min(props.options.length - 1, index));
    selected.current = next;
    scroll.current?.scrollTo({ y: next * props.rowHeight, animated: false });
    props.onChange(next);
  }

  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={props.label}
      accessibilityValue={{ min: 0, max: props.options.length - 1, now: props.index, text: props.options[props.index] }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(event) => select(props.index + (event.nativeEvent.actionName === 'increment' ? 1 : -1))}
      style={{ flex: 1, height: props.rowHeight * props.visibleRows }}
    >
      <ScrollView
        ref={scroll}
        accessible={false}
        bounces={false}
        nestedScrollEnabled
        decelerationRate="fast"
        snapToInterval={props.rowHeight}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingVertical: props.rowHeight * Math.floor(props.visibleRows / 2) }}
        onLayout={() => scroll.current?.scrollTo({ y: selected.current * props.rowHeight, animated: false })}
        onScroll={(event) => {
          const next = sleepWheelIndex(event.nativeEvent.contentOffset.y, props.rowHeight, props.options.length);
          if (next !== selected.current) { selected.current = next; props.onChange(next); }
        }}
        scrollEventThrottle={16}
      >
        {props.options.map((option, index) => (
          <Pressable key={option} accessible={false} onPress={() => select(index)} style={{ height: props.rowHeight, justifyContent: 'center', alignItems: 'center' }}>
            <Text selectable={false} style={{ fontFamily: fonts.body, fontSize: 24, fontVariant: ['tabular-nums'], color: index === props.index ? props.textColor : props.mutedColor, fontWeight: index === props.index ? '600' : '400' }}>{option}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
