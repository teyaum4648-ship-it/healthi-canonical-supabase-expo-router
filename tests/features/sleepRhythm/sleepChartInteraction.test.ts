import { describe, expect, it } from 'vitest';

import { chartDragDirection, chartRatioAtX, createSleepChartInteraction } from '../../../src/features/sleepRhythm/sleepChartInteraction';

function setup(initial: number | null = null) {
  let selection = initial;
  const bounds = { left: 20, width: 400 };
  const controller = createSleepChartInteraction({ getBounds: () => bounds, getSelection: () => selection, onSelect: (next) => { selection = next; } });
  return { controller, bounds, selected: () => selection };
}

describe('sleep chart interactions', () => {
  it('allows a small touch slop and locks once horizontal intent is established', () => {
    const start = { id: 1, x: 20, y: 20 };
    expect(chartDragDirection(start, { ...start, x: 25 }, 'pending')).toBe('pending');
    expect(chartDragDirection(start, { ...start, x: 50, y: 25 }, 'pending')).toBe('horizontal');
    expect(chartDragDirection(start, { ...start, x: 50, y: 500 }, 'horizontal')).toBe('horizontal');
    expect(chartDragDirection(start, { ...start, x: 30, y: 40 }, 'pending')).toBe('vertical');
  });

  it('uses stable container coordinates and bounds drags outside the graph', () => {
    expect(chartRatioAtX(220, 20, 400)).toBe(0.5);
    expect(chartRatioAtX(-100, 20, 400)).toBe(0);
    expect(chartRatioAtX(1000, 20, 400)).toBe(1);
    expect(chartRatioAtX(200, 20, 0)).toBeNull();
    expect(chartRatioAtX(NaN, 20, 400)).toBeNull();
  });

  it('keeps an inspected time after release and ignores the subsequent lost-capture event', () => {
    const { controller, selected } = setup();
    controller.begin({ id: 1, x: 100, y: 100 });
    controller.move({ id: 1, x: 220, y: 104 });
    controller.end({ id: 1, x: 220, y: 104 });
    controller.cancel(1);
    expect(selected()).toBe(0.5);
  });

  it('keeps taps and long stationary presses inspectable', () => {
    const { controller, selected } = setup();
    controller.begin({ id: 1, x: 120, y: 100 });
    expect(selected()).toBe(0.25);
    controller.end({ id: 1, x: 120, y: 100 });
    expect(selected()).toBe(0.25);
  });

  it('restores the prior selection for vertical page scrolling', () => {
    const { controller, selected } = setup(0.75);
    controller.begin({ id: 1, x: 100, y: 100 });
    expect(controller.move({ id: 1, x: 101, y: 180 })).toBe('vertical');
    controller.move({ id: 1, x: 400, y: 200 });
    controller.end({ id: 1, x: 400, y: 200 });
    expect(selected()).toBe(0.75);
  });

  it('restores the prior state on interruption and permits the next gesture', () => {
    const { controller, selected } = setup();
    controller.begin({ id: 1, x: 100, y: 100 });
    controller.move({ id: 1, x: 300, y: 100 });
    controller.cancel(1);
    expect(selected()).toBeNull();
    expect(controller.begin({ id: 2, x: 220, y: 100 })).toBe(true);
    controller.end({ id: 2, x: 220, y: 100 });
    expect(selected()).toBe(0.5);
  });

  it('ignores unrelated pointers rather than jumping to a second finger', () => {
    const { controller, selected } = setup();
    controller.begin({ id: 1, x: 100, y: 100 });
    expect(controller.begin({ id: 2, x: 400, y: 100 })).toBe(false);
    controller.move({ id: 2, x: 400, y: 100 });
    controller.cancel(2);
    controller.end({ id: 2, x: 400, y: 100 });
    expect(selected()).toBe(0.2);
    controller.end({ id: 1, x: 220, y: 100 });
    expect(selected()).toBe(0.5);
  });

  it('uses updated bounds after resizing and recognizes a fast vertical release', () => {
    const { controller, selected, bounds } = setup(0.4);
    controller.begin({ id: 1, x: 100, y: 100 });
    controller.end({ id: 1, x: 102, y: 200 });
    expect(selected()).toBe(0.4);
    bounds.width = 200;
    controller.begin({ id: 2, x: 120, y: 100 });
    controller.end({ id: 2, x: 120, y: 100 });
    expect(selected()).toBe(0.5);
  });
});
