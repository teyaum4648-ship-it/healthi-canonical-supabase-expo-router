import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const home = readFileSync('app/(app)/(tabs)/index.tsx', 'utf8');
const card = readFileSync('src/features/dashboard/TodayDirectionCard.tsx', 'utf8');
const hub = readFileSync('src/features/dashboard/premium/ReadinessHub.tsx', 'utf8');
const presentation = readFileSync('src/features/dashboard/homeDashboardPresentation.ts', 'utf8');

describe('Today (Daywoven 1c) information hierarchy', () => {
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
    for (const control of ['<ReadinessNowCard', '<ReadinessHub', '<BiomarkerTimeline', '<BiomarkerEntrySheet', '<MetricGrid', '{biomarkerBreakdown}', '<WeeklyRecapRow', '<WeeklyRecapSheet', '<WeekFlipCard']) {
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
    expect(home).toContain("'/food' as const");
    expect(home).toContain("router.navigate('/movement')");
  });

  it('keeps the account explanation inline in the band: baseline, every driver and the full protocol', () => {
    expect(home).toContain('whyPanel={accountWhy}');
    expect(home).toContain('readinessLedgerSummary(');
    expect(home).toContain('morningBriefing.driver_cards.map((driver, index) => (');
    expect(home).toContain('value={contributionLabel(driver)}');
    expect(home).toContain('label="See the full daily protocol"');
    expect(hub).toContain('accessibilityState={whyPanel ? { expanded: whyOpen } : undefined}');
  });

  it('keeps the account logging prompts reachable after they left the Why panel', () => {
    const toggle = home.indexOf('accessibilityLabel={showExtendedHome');
    expect(home.indexOf('<LoggingPrompts tone="canvas"')).toBeGreaterThan(toggle);
  });

  it('places the energy strand after Quick log and before the analysis, and the biomarkers under Explore', () => {
    const quickLog = home.indexOf('<QuickLog actions={quickLogActions}');
    const thread = home.indexOf('<DayThread sources={threadSources}');
    const toggle = home.indexOf('accessibilityLabel={showExtendedHome');
    expect(thread).toBeGreaterThan(quickLog);
    expect(toggle).toBeGreaterThan(thread);
    expect(home.indexOf('{biomarkerBreakdown}')).toBeGreaterThan(toggle);
  });

  it('draws the plan for the strand separately, leaving the briefing and protocol inputs unchanged', () => {
    expect(home).toContain('rhythm: briefingToDayPlanRhythm(circadianBriefing)');
    expect(home).toContain('day_plan: preliminaryDayPlan');
    expect(home).toContain('dayPlan: preliminaryDayPlan');
  });

  it('drops only the greeting and the insight shortcuts from Today, keeping the greeting helpers', () => {
    expect(home).not.toContain('<InsightShortcuts');
    expect(home).not.toContain('homeGreeting(');
    expect(presentation).toContain('export function homeGreeting');
    expect(home).toContain('onPress={sideMenu.open}');
    expect(home).toContain('accessibilityLabel="You · profile and settings"');
    expect(home).toContain("router.navigate('/plan')");
  });

  it('no longer hides the biomarkers behind a tap on the readiness ring', () => {
    expect(hub).not.toContain('Hide biomarkers');
    expect(hub).toContain('readinessRingLabel(');
  });

  it('draws the original readiness ring, large and centred, with the score and zone in it', () => {
    expect(hub).toContain('const RING_MAX = 248;');
    expect(hub).toContain('<PillarRing');
    expect(hub).toContain('size={ringSize}');
    expect(hub.indexOf('<PillarRing')).toBeLessThan(hub.indexOf('styles.pillarRow'));
    expect(hub.indexOf('styles.pillarRow')).toBeLessThan(hub.indexOf('copy.headline'));
  });
});
