import { describe, expect, it } from 'vitest';

import { rhythmStepsToShow } from '../../../src/features/sleepRhythm/sleepPresentation';

describe('rhythmStepsToShow', () => {
  const steps = ['light', 'walk', 'focus', 'exercise', 'breath', 'caffeine', 'dim', 'wind'];
  const status: Record<string, string> = { light: 'Done', walk: 'Earlier', focus: 'Now', exercise: 'Upcoming', breath: 'Upcoming', caffeine: 'Upcoming', dim: 'Upcoming', wind: 'Later' };

  it('opens on the step happening now and the next ones, three at most', () => {
    expect(rhythmStepsToShow(steps, (step) => status[step]!)).toEqual({ shown: ['focus', 'exercise', 'breath'], hidden: 5 });
  });

  it('shows nothing ahead once the day has passed, with everything behind Show all', () => {
    expect(rhythmStepsToShow(steps, () => 'Earlier')).toEqual({ shown: [], hidden: 8 });
  });
});
