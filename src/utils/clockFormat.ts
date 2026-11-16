/**
 * Clock times as people read them in the US: 12-hour with AM/PM.
 *
 * Every user-facing clock label goes through here, so the app reads one way everywhere.
 * These only format. Stored values, time zones and scheduling maths stay as they are, and
 * durations ("7h 45m", a 24-hour window) are not clock times and never come through here.
 *
 *   formatClock(870)        → "2:30 PM"
 *   formatClock(435)        → "7:15 AM"
 *   formatClock(0)          → "12:00 AM"
 *   formatClock(720)        → "12:00 PM"
 *   formatClockCompact(540) → "9 AM"   (whole hours drop the minutes, for chart axes)
 */

/** Minutes past midnight, wrapped into one day, so 1500 reads as 1:00 AM the next morning. */
function wrap(minute: number): number {
  const whole = Math.round(minute);
  return ((whole % 1440) + 1440) % 1440;
}

function parts(minute: number): { hour12: number; minutes: number; meridiem: 'AM' | 'PM' } {
  const day = wrap(minute);
  const hour = Math.floor(day / 60);
  return { hour12: hour % 12 || 12, minutes: day % 60, meridiem: hour < 12 ? 'AM' : 'PM' };
}

/** "2:30 PM" from minutes past midnight. */
export function formatClock(minute: number): string {
  const { hour12, minutes, meridiem } = parts(minute);
  return `${hour12}:${String(minutes).padStart(2, '0')} ${meridiem}`;
}

/** "9 AM", or "9:30 AM" when the minutes matter. For axes and tight labels. */
export function formatClockCompact(minute: number): string {
  const { hour12, minutes, meridiem } = parts(minute);
  return minutes === 0 ? `${hour12} ${meridiem}` : `${hour12}:${String(minutes).padStart(2, '0')} ${meridiem}`;
}

/** "2:30–4:00 PM", dropping the first AM/PM when both ends share it. */
export function formatClockRange(startMinute: number, endMinute: number): string {
  const start = parts(startMinute);
  const end = parts(endMinute);
  const startText = `${start.hour12}:${String(start.minutes).padStart(2, '0')}`;
  return start.meridiem === end.meridiem
    ? `${startText}–${formatClock(endMinute)}`
    : `${startText} ${start.meridiem}–${formatClock(endMinute)}`;
}

/** "2:30 PM" for a real instant, read on the device's own clock. */
export function formatClockOfDate(date: Date): string {
  if (!Number.isFinite(date.getTime())) return '—';
  return formatClock(date.getHours() * 60 + date.getMinutes());
}

/**
 * "2:30 PM" for a time the engines keep as the local wall clock on the UTC axis (sleep,
 * circadian and plan times), which is read in UTC so the device zone is not applied twice.
 */
export function formatWallClockIso(iso: string | null | undefined): string {
  if (!iso) return '—';
  const time = new Date(iso);
  if (!Number.isFinite(time.getTime())) return '—';
  return formatClock(time.getUTCHours() * 60 + time.getUTCMinutes());
}

/**
 * "9:30 PM" from a stored 24-hour "21:30". Engines keep "HH:MM" strings as values (the day
 * plan parses them back), so their sentences convert at the last moment instead. Anything
 * that does not read as a time is returned as it was.
 */
export function formatClockText(value: string): string {
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(value.trim());
  if (!match) return value;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return value;
  return formatClock(hours * 60 + minutes);
}
