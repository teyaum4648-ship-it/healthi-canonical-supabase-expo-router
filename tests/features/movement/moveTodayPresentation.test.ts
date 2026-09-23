import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Move Today presentation wiring', () => {
  it('keeps the full recommendation visible without the unwanted label or duplicate explanation', () => {
    const screen = readFileSync('app/(app)/(tabs)/movement.tsx', 'utf8');
    const start = screen.indexOf('<View style={styles.verdictBlock}>');
    const end = screen.indexOf('<View style={styles.feelingPanel}>');
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const verdict = screen.slice(start, end);
    for (const value of ['adaptivePlan.verdict', 'adaptivePlan.explanation', 'styles.capacityRail', 'adaptivePlan.effort_range.min', 'adaptivePlan.reason_codes']) {
      expect(verdict).toContain(value);
    }
    expect(screen.toLowerCase()).not.toContain('why this fits today');
    expect(screen.match(/\{adaptivePlan\.explanation\}/g)).toHaveLength(1);
  });
});
