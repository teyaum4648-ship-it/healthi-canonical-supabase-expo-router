/**
 * Which movement patterns a safety decision has put out of bounds.
 *
 * The engine has always honoured a blocked pattern — movementRootCause withholds every
 * strengthening suggestion that would land in one and says so with a reason code — but the
 * list reaching it was a hardcoded empty array, so nothing was ever actually out of bounds.
 * This reads the table that was built for it.
 */

export type MovementPatternPermissionRow = {
  id: string;
  user_id: string;
  pattern: string;
  permission: string;
  reasons: string[];
  retest_after: string | null;
  updated_at: string;
};

type PermissionQuery = {
  eq(column: 'user_id', value: string): PermissionQuery;
  limit(count: number): PromiseLike<{ data: MovementPatternPermissionRow[] | null; error: unknown }>;
};

export type MovementPatternPermissionClient = {
  from(table: 'movement_pattern_permissions'): { select(columns: string): PermissionQuery };
};

/**
 * The permission values that mean "do not programme this".
 *
 * Anything that is not recognised as permitted is treated as a block. A row exists because
 * somebody decided something about this pattern, so an unfamiliar value is a reason to
 * withhold rather than a reason to carry on: the cost of withholding a suggestion is far
 * lower than the cost of programming into a pattern that was meant to be off limits.
 */
const PERMITTED = new Set(['allowed', 'permitted', 'cleared', 'unrestricted']);

export async function getMovementPatternPermissions(
  client: MovementPatternPermissionClient,
  userId: string,
  limit = 50
): Promise<MovementPatternPermissionRow[]> {
  const { data, error } = await client
    .from('movement_pattern_permissions')
    .select('*')
    .eq('user_id', userId)
    .limit(limit);
  if (error) throw new Error('Movement pattern permissions could not be read.');
  return data ?? [];
}

/**
 * The blocked pattern names, for the movement screen.
 *
 * `retest_after` is a prompt to reassess, not an expiry: a date that has passed does not
 * quietly return a pattern to play. Only a changed row does that, because letting a block
 * lapse on a timer would undo a safety decision nobody revisited.
 */
export function blockedMovementPatterns(rows: readonly MovementPatternPermissionRow[]): string[] {
  const blocked = new Set<string>();
  for (const row of rows) {
    if (!row.pattern) continue;
    if (PERMITTED.has(row.permission.trim().toLowerCase())) continue;
    blocked.add(row.pattern);
  }
  return [...blocked];
}
