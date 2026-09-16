/**
 * The day a practice belongs to, in the person's own timezone.
 *
 * `toISOString()` is wrong for this: someone breathing at 11pm Pacific would have the
 * session filed under tomorrow, and a day's work would land on the wrong side of
 * midnight. The local calendar date is the one a person means by "today".
 */
export function localDateKey(at: Date = new Date()): string {
  return `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}-${String(at.getDate()).padStart(2, '0')}`;
}
