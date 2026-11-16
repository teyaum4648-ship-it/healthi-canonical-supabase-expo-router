import { LOAD_BANDS, type LoadSummary } from '../../engines/load';

/**
 * The Move band's hero (handoff Phase 6): the last seven days of training load as bars, in
 * the 1c chart grammar (P8). Each bar is a day's load from the load engine (effort ×
 * minutes); the engine's own moderate band is drawn as a wash behind them. A day with no
 * session is a short dash labelled "rest", never a bar. Presentation only.
 */

export type LoadBar = { date: string; day: string; load: number; height: number | null; isToday: boolean; reading: string };

export type LoadChart = { bars: LoadBar[]; zone: { top: number; bottom: number }; max: number };

const weekday = (date: string) => new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));

export function loadChart(summary: Pick<LoadSummary, 'series'>, today: string): LoadChart {
  /* Scale to the larger of the heaviest day and a little above the moderate band, so a light week is not drawn as tall. */
  const max = Math.max(LOAD_BANDS.moderate * 1.25, ...summary.series.map((day) => day.load));
  return {
    max,
    zone: { top: 1 - LOAD_BANDS.moderate / max, bottom: 1 - LOAD_BANDS.light / max },
    bars: summary.series.map((day) => ({
      date: day.date,
      day: weekday(day.date),
      load: day.load,
      height: day.load > 0 ? day.load / max : null,
      isToday: day.date === today,
      reading: day.load > 0 ? `${weekday(day.date)} · ${Math.round(day.load)} load · logged` : `${weekday(day.date)} · no session logged`
    }))
  };
}
