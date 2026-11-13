import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Move Today presentation wiring', () => {
  it('keeps effort guidance and reasons without the redundant opening recommendation', () => {
    const screen = readFileSync('app/(app)/(tabs)/movement.tsx', 'utf8');
    const start = screen.indexOf('<View style={styles.verdictBlock}>');
    const end = screen.indexOf('<View style={styles.feelingPanel}>');
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const guidance = screen.slice(start, end);
    for (const value of [
      'styles.capacityRail',
      'styles.capacityLabels',
      'adaptivePlan.effort_range.min',
      'adaptivePlan.reason_codes'
    ]) {
      expect(guidance).toContain(value);
    }
    expect(guidance).not.toContain('adaptivePlan.verdict');
    expect(guidance).not.toContain('adaptivePlan.explanation');
    expect(screen.toLowerCase()).not.toContain('why this fits today');
  });
});
