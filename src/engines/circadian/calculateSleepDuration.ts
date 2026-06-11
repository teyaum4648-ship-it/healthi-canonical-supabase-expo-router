const MAX_SLEEP_MINUTES = 24 * 60;

type ParsedMoment = {
  value: Date;
  isTimeOnly: boolean;
};

function parseMoment(input: string): ParsedMoment | null {
  const trimmed = input.trim();

  if (!trimmed) {
    return null;
  }

  const timeOnlyMatch = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(trimmed);

  if (timeOnlyMatch) {
    const hours = Number(timeOnlyMatch[1]);
    const minutes = Number(timeOnlyMatch[2]);
    const seconds = Number(timeOnlyMatch[3] ?? '0');

    if (hours > 23 || minutes > 59 || seconds > 59) {
      return null;
    }

    return {
      value: new Date(Date.UTC(2000, 0, 1, hours, minutes, seconds)),
      isTimeOnly: true
    };
  }

  const parsed = new Date(trimmed);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return {
    value: parsed,
    isTimeOnly: false
  };
}

export function calculateSleepDuration(
  sleepStartAt: string | null,
  sleepEndAt: string | null
): number | null {
  if (!sleepStartAt || !sleepEndAt) {
    return null;
  }

  const start = parseMoment(sleepStartAt);
  const end = parseMoment(sleepEndAt);

  if (!start || !end) {
    return null;
  }

  let endTime = end.value.getTime();
  const startTime = start.value.getTime();

  if (endTime <= startTime && (start.isTimeOnly || end.isTimeOnly)) {
    endTime += 24 * 60 * 60 * 1000;
  }

  const minutes = Math.round((endTime - startTime) / 60000);

  if (minutes <= 0 || minutes > MAX_SLEEP_MINUTES) {
    return null;
  }

  return minutes;
}

