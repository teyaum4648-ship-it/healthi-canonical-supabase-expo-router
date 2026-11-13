import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const home = readFileSync('app/(app)/(tabs)/index.tsx', 'utf8');
const card = readFileSync('src/features/dashboard/TodayDirectionCard.tsx', 'utf8');

describe('Daywoven V2 Home information hierarchy', () => {
  it('places live readiness first, followed by the daily direction and quick logging', () => {
    const readiness = home.indexOf('<ReadinessNowCard');
    const accountReadiness = home.indexOf('<ReadinessHub');
    const direction = home.indexOf('<TodayDirectionCard');
    const quickLog = home.indexOf('<QuickLog actions={quickLogActions}');
    const analysisToggle = home.indexOf('accessibilityLabel={showExtendedHome');
    expect(readiness).toBeGreaterThan(0);
    expect(accountReadiness).toBeGreaterThan(readiness);
    expect(direction).toBeGreaterThan(accountReadiness);
    expect(quickLog).toBeGreaterThan(direction);
    expect(analysisToggle).toBeGreaterThan(quickLog);
  });

  it('keeps safety guidance above optional expansion and does not fake a first-day number', () => {
    expect(home.indexOf('{shouldSurfaceSafety(protocol.safety.status) ? (')).toBeLessThan(home.indexOf('<QuickLog actions={quickLogActions}'));
    expect(home).toContain("const visibleReadinessScore = dashboardHero.source_label === 'calibrating' ? null : dashboardHero.score;");
    expect(card).toContain('Missing information limits confidence');
  });

  it('keeps every existing log action and its current route or persistence operation', () => {
    for (const label of ["label: 'Food'", "label: 'Water'", "label: 'Workout'", "label: 'Sleep'", "label: 'Check-in'"]) {
      expect(home).toContain(label);
    }
    expect(home).toContain('await addGlassOfWater(');
    expect(home).toContain('await removeWater(');
    expect(home).toContain("quickEntryHref('food')");
    expect(home).toContain("quickEntryHref('workout')");
    expect(home).toContain("quickEntryHref('sleep')");
  });

  it('preserves existing detailed analysis controls including biomarker editing and weekly cards', () => {
    for (const control of ['<ReadinessNowCard', '<ReadinessHub', '<BiomarkerTimeline', '<BiomarkerEntrySheet', '<MetricGrid', '<WeeklyRecapRow', '<WeekFlipCard', '<Disclosure title="Why this estimate?"']) {
      expect(home).toContain(control);
    }
    expect(home).toContain("onPress={() => router.navigate('/load-check')}");
    expect(home).toContain("onPress={() => router.navigate('/protocol')}");
  });

  it('keeps the real demo readiness card mounted so its check-in opens immediately', () => {
    const open = home.indexOf("const openCheckin = () => {");
    const request = home.indexOf('setReadinessCheckinRequest(n => n + 1);', open);
    const readiness = home.indexOf('<ReadinessNowCard');
    const toggle = home.indexOf('accessibilityLabel={showExtendedHome');
    expect(open).toBeGreaterThan(0);
    expect(request).toBeGreaterThan(open);
    expect(readiness).toBeLessThan(toggle);
    expect(home).not.toContain('setShowExtendedHome(true);');
  });

  it('offers full explanations and existing feature destinations instead of replacing engines', () => {
    expect(card).toContain('accessibilityState={{ expanded }}');
    expect(home).toContain('drivers={morningBriefing.driver_cards}');
    expect(home).toContain("router.navigate('/rhythm')");
    expect(home).toContain("router.navigate('/food')");
    expect(home).toContain("router.navigate('/movement')");
  });
});
