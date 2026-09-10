export type SleepClockParts = { hour: number; minute: number; period: 'AM' | 'PM' };

export function sleepClockParts(value: string): SleepClockParts | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return { hour: hour % 12 || 12, minute, period: hour >= 12 ? 'PM' : 'AM' };
}

/** Clock-only conversion: the existing sleep-window engine owns date/overnight rules. */
export function sleepClockValue(parts: SleepClockParts): string | null {
  if (!Number.isInteger(parts.hour) || parts.hour < 1 || parts.hour > 12
    || !Number.isInteger(parts.minute) || parts.minute < 0 || parts.minute > 59
    || !['AM', 'PM'].includes(parts.period)) return null;
  const hour = parts.hour % 12 + (parts.period === 'PM' ? 12 : 0);
  return `${String(hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}`;
}

export function sleepWheelIndex(offset: number, rowHeight: number, count: number): number {
  if (!Number.isFinite(offset) || !Number.isFinite(rowHeight) || rowHeight <= 0 || count < 1) return 0;
  return Math.max(0, Math.min(count - 1, Math.round(offset / rowHeight)));
}

export type SleepTimeWheelProps = {
  label: string;
  options: readonly string[];
  index: number;
  onChange: (index: number) => void;
  rowHeight: number;
  visibleRows: 3 | 5;
  textColor: string;
  mutedColor: string;
};
