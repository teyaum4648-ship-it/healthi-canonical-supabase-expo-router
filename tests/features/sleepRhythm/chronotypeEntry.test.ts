import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Where the clock questions can be reached from.
 *
 * For a while the only way in was the last card of the Sleep tab's second view, under a
 * heading about drift, and a person using the app could not find it. The questions are
 * what personalises timing before there is sleep data, so they belong on the view a new
 * person lands on.
 */
describe('the clock questions are reachable from where people land', () => {
  const source = readFileSync('src/features/sleepRhythm/SleepExperience.tsx', 'utf8');
  const thread = readFileSync('src/features/sleepRhythm/SleepThread.tsx', 'utf8');
  const today = source.slice(source.indexOf('function TodayTab'), source.indexOf('function TrendsTab') > source.indexOf('function TodayTab') ? source.indexOf('function TrendsTab') : undefined);

  it('offers them on the Today view', () => {
    expect(source).toMatch(/<TodayTab[\s\S]*?onOpenChronotype=\{props\.onOpenChronotype\}/);
    // The 1c chronotype row sits in the default Today view, not behind Explore.
    expect(today).toContain('<ChronotypeRow label={chronotypeLabel} onOpen={onOpenChronotype} />');
    expect(today.indexOf('<ChronotypeRow')).toBeLessThan(today.indexOf('<ExploreButton'));
    expect(thread).toContain('onPress={onOpen}');
    expect(thread).toContain('Six questions about your clock');
  });

  it('shows the saved answer instead of asking again', () => {
    expect(thread).toContain('` · ${label} (estimate)`');
  });

  it('keeps the way in on Trends as well', () => {
    expect(source).toMatch(/<TrendsTab[^>]*onOpenChronotype=\{props\.onOpenChronotype\}/);
  });
});
