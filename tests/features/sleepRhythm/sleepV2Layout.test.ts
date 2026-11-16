import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const experience = readFileSync('src/features/sleepRhythm/SleepExperience.tsx', 'utf8');
const hero = readFileSync('src/features/sleepRhythm/SleepTodayHero.tsx', 'utf8');
const graph = readFileSync('src/features/sleepRhythm/SleepEnergyChart.tsx', 'utf8');
const route = readFileSync('app/(app)/(tabs)/rhythm.tsx', 'utf8');
const thread = readFileSync('src/features/sleepRhythm/SleepThread.tsx', 'utf8');

describe('Sleep V2 progressive disclosure and feature preservation', () => {
  it('answers "what now" first, in the 1c order, and keeps every step behind Explore', () => {
    const start = experience.indexOf('function TodayTab(');
    const order = [
      '<TodaysRhythm', '<TonightSummary', '<LastSevenNights', '<ChronotypeRow', '<ExploreButton',
      '{next ? (', '>Today’s steps</SectionLabel>', '>Adjust tonight’s window</SectionLabel>', '<SleepWindowTracker'
    ].map((marker) => experience.indexOf(marker, start));
    for (const [index, at] of order.entries()) {
      expect(at, `marker ${index}`).toBeGreaterThan(start);
      if (index > 0) expect(at).toBeGreaterThan(order[index - 1]!);
    }
    expect(experience).toContain('rhythmStepsToShow(protocol,');
    expect(experience).toContain('onToggleProtocol(item.id)');
    // The band hero is the engine's curve, before the tab content.
    expect(experience.indexOf('<SleepBand')).toBeLessThan(experience.indexOf('<TodayTab'));
  });

  it('keeps detailed tools and history accessible without deleting the underlying features', () => {
    for (const feature of [
      '<SleepWindowTracker', '{morningSlot}', '<TrendsTab', '<WindDownTab', '<LearnTab',
      'sleepNightSummaries(sessions)', 'calculateRhythmConsistency(', '<SleepWindowTrack',
      'onOpenChronotype', 'WIND_DOWN_LIBRARY', 'onSaveSleepWindow', 'onOpenManual',
      'Why is confidence', '<TimeField'
    ]) {
      expect(experience).toContain(feature);
    }
    expect(experience).toContain("display: showDetailedSleep ? 'flex' : 'none'");
    expect(experience).toContain('if (logRequest) setShowDetailedSleep(true)');
  });

  it('uses actual recorded nights and retains correct source/missing-data handling', () => {
    // Last 7 nights reads the logged nights; one not logged is "none", never zero hours.
    expect(thread).toContain('sleepGlance({ sessions, today, needMinutes })');
    expect(thread).toContain("night.minutes === null ? 'none'");
    expect(thread).toContain('briefing.confidence');
    expect(thread).toContain('<SleepEnergyChart briefing={briefing} now={now}');
    expect(thread).toContain('<SleepTwoThread day={twoProcess}');
    expect(readFileSync('src/features/sleepRhythm/SleepTwoThread.tsx', 'utf8')).toContain('· est.');
    expect(thread).toContain('onLogSleep');
    expect(experience).toContain('briefing.confidence');
    expect(hero).toContain('Estimated energy');
    expect(route).toContain('generateCircadianBriefing');
    expect(route).toContain('saveSleepForSource');
  });

  it('keeps the existing interactive chart and underlying circadian model unchanged', () => {
    expect(graph).toContain('<SleepChartSurface');
    expect(graph).toContain('getRecommendedActivityAt(briefing, time)');
    expect(graph).toContain('briefing.typical_band');
    expect(graph).toContain('briefing.energy_extrema');
    expect(graph).toContain('setRatio(null)');
    // The chart still sits on its dark ground, now the 1c band rather than a navy gradient.
    expect(graph).toContain('colors={[dv.surface.band, dv.surface.band');
  });

  it('keeps manual logging, trends, chronotype, and wind-down routes intact', () => {
    expect(experience).toContain("setSheet({ type: 'manual' })");
    expect(experience).toContain("setTab('today')");
    expect(experience).toContain("switchTab('wind_down')");
    expect(experience).toContain('persisted');
    expect(route).toContain('scoreChronotype');
    expect(route).toContain('saveChronotype');
  });
});
