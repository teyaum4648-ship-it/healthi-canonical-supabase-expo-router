import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const experience = readFileSync('src/features/sleepRhythm/SleepExperience.tsx', 'utf8');
const hero = readFileSync('src/features/sleepRhythm/SleepTodayHero.tsx', 'utf8');
const graph = readFileSync('src/features/sleepRhythm/SleepEnergyChart.tsx', 'utf8');
const route = readFileSync('app/(app)/(tabs)/rhythm.tsx', 'utf8');

describe('Sleep V2 progressive disclosure and feature preservation', () => {
  it('prioritizes the daily direction, interactive energy forecast and next useful time', () => {
    const start = experience.indexOf('function TodayTab(');
    const heroAt = experience.indexOf('<SleepTodayHero', start);
    const energyAt = experience.indexOf('<EnergyField', start);
    const nextAt = experience.indexOf('{next ? (', start);
    const tonightAt = experience.indexOf('>Tonight</SectionLabel>', start);
    const detailsAt = experience.indexOf('<SleepSectionToggle', start);
    expect(heroAt).toBeGreaterThan(start);
    expect(energyAt).toBeGreaterThan(heroAt);
    expect(nextAt).toBeGreaterThan(energyAt);
    expect(tonightAt).toBeGreaterThan(nextAt);
    expect(detailsAt).toBeGreaterThan(tonightAt);
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
    expect(experience).toContain('session.date.slice(0, 10) === briefing.date.slice(0, 10)');
    expect(experience).toContain('briefing.confidence');
    expect(hero).toContain('Estimated energy');
    expect(hero).toContain('onLogSleep');
    expect(route).toContain('generateCircadianBriefing');
    expect(route).toContain('saveSleepForSource');
  });

  it('keeps the existing interactive chart and underlying circadian model unchanged', () => {
    expect(graph).toContain('<SleepChartSurface');
    expect(graph).toContain('getRecommendedActivityAt(briefing, time)');
    expect(graph).toContain('briefing.typical_band');
    expect(graph).toContain('briefing.energy_extrema');
    expect(graph).toContain('setRatio(null)');
    expect(graph).toContain("['#161A2B', '#171923', '#1B1B2D', '#121720', '#0E111A']");
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
