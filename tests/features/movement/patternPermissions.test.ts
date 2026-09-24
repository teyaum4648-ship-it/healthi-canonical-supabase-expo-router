import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import {
  blockedMovementPatterns,
  getMovementPatternPermissions,
  type MovementPatternPermissionClient,
  type MovementPatternPermissionRow
} from '../../../src/features/movement/patternPermissionPersistence';
import { findMovementLinks } from '../../../src/engines/movement/movementRootCause';

function row(pattern: string, permission: string, retestAfter: string | null = null): MovementPatternPermissionRow {
  return { id: `p-${pattern}`, user_id: 'u1', pattern, permission, reasons: [], retest_after: retestAfter, updated_at: '2026-09-01T00:00:00.000Z' };
}

describe('patterns a safety decision has put out of bounds', () => {
  it('blocks what is not permitted and leaves what is', () => {
    expect(blockedMovementPatterns([row('squat', 'blocked'), row('hinge', 'allowed'), row('push', 'limited')]).sort()).toEqual(['push', 'squat']);
  });
  it('reads a permission however it was capitalised or padded', () => {
    expect(blockedMovementPatterns([row('squat', ' Allowed ')])).toEqual([]);
  });
  it('treats an unfamiliar permission as a block, not as clearance', () => {
    expect(blockedMovementPatterns([row('squat', 'pending_review')])).toEqual(['squat']);
  });
  it('does not let a block lapse because its retest date passed', () => {
    expect(blockedMovementPatterns([row('squat', 'blocked', '2020-01-01')])).toEqual(['squat']);
  });
  it('says nothing when there is nothing to say', () => {
    expect(blockedMovementPatterns([])).toEqual([]);
  });
  it('asks only for the signed-in user and surfaces a failed read', async () => {
    const limit = vi.fn(async () => ({ data: [row('squat', 'blocked')], error: null }));
    const eq = vi.fn(() => ({ limit, eq }));
    const client = { from: vi.fn(() => ({ select: vi.fn(() => ({ eq, limit })) })) } as unknown as MovementPatternPermissionClient;
    expect(await getMovementPatternPermissions(client, 'u1')).toHaveLength(1);
    expect(eq).toHaveBeenCalledWith('user_id', 'u1');

    const failing = { from: () => ({ select: () => ({ eq: () => ({ limit: async () => ({ data: null, error: { message: 'no' } }) }) }) }) } as unknown as MovementPatternPermissionClient;
    await expect(getMovementPatternPermissions(failing, 'u1')).rejects.toThrow('could not be read');
  });
});

describe('a blocked pattern actually withholds programming', () => {
  /* Tight hip flexors and inner thighs with an unsteady single-leg stand: the rule that
     suggests giving the side of the hip something to do, across single_leg, squat and lunge. */
  const screen = {
    date: '2026-09-24',
    findings: {
      half_kneeling_hip: 'limited' as const,
      seated_straddle: 'limited' as const,
      single_leg_stand: 'limited' as const
    },
    postureFlags: [] as never[]
  };

  it('suggests strengthening when nothing is blocked, and stops when a pattern is', () => {
    const open = findMovementLinks({ ...screen, blockedPatterns: [] });
    const withBlocks = findMovementLinks({ ...screen, blockedPatterns: open.flatMap((cause) => cause.patterns) });
    expect(open.some((cause) => cause.strengthen.length > 0)).toBe(true);
    expect(withBlocks.every((cause) => cause.strengthen.length === 0)).toBe(true);
    expect(withBlocks.some((cause) => cause.reason_codes.includes('programming_withheld_pattern_blocked'))).toBe(true);
  });
  it('is fed from the table rather than a hardcoded empty list', () => {
    const movement = readFileSync('app/(app)/(tabs)/movement.tsx', 'utf8');
    expect(movement).toContain('getMovementPatternPermissions(');
    expect(movement).toContain('setBlockedPatterns(blockedMovementPatterns(rows))');
    expect(movement).not.toContain('useMemo<string[]>(() => [], [])');
  });
});
