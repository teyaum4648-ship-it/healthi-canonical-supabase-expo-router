/** Calendar keys are local dates; timestamps remain absolute instants in storage. */
export function localDay(value: Date | string = new Date()): string {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = typeof value === 'string' ? new Date(value) : value;
  if (!Number.isFinite(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function localDayBounds(day: string) {
  const start = new Date(`${day}T00:00:00`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || localDay(start) !== day) throw new Error('Invalid diary day.');
  const end = new Date(start);
  end.setDate(end.getDate() + 1); // A local day can be 23 or 25 hours across DST.
  return { start: start.toISOString(), end: end.toISOString() };
}

export function timestampForLocalDay(day: string, now: string): string {
  localDayBounds(day);
  const date = new Date(now);
  if (!Number.isFinite(date.getTime())) throw new Error('Invalid entry time.');
  const [year, month, dateOfMonth] = day.split('-').map(Number);
  date.setFullYear(year, month - 1, dateOfMonth);
  return date.toISOString();
}

export function rolloverDiaryDay(selected: string, previousToday: string, today: string, editing = false) {
  return !editing && selected === previousToday ? today : selected;
}

/**
 * The local wall clock on the UTC axis the sleep engines use, where a 7:05 wake is
 * T07:05Z of its day. 8:24 PM on the 30th becomes 2026-09-30T20:24Z, not the instant
 * 2026-10-01T03:24Z, which put the evening on tomorrow's date and stretched the day's
 * curve across 38 hours.
 */
export function wallClockIso(date: Date = new Date()): string {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString();
}
