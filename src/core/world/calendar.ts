/**
 * In-game calendar. Dates are integer day numbers counted from 1 January of
 * season 1 (day 0). Real month lengths, no leap years, no host clock.
 */
const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;
export const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'] as const;
export const YEAR_DAYS = 365;

export type Day = number;

export interface DateParts {
  /** 1-based season (year). */
  readonly season: number;
  /** 0-based month. */
  readonly month: number;
  /** 1-based day of month. */
  readonly dayOfMonth: number;
}

export function toParts(day: Day): DateParts {
  const season = Math.floor(day / YEAR_DAYS) + 1;
  let d = day - (season - 1) * YEAR_DAYS;
  let month = 0;
  while (d >= MONTH_DAYS[month]!) {
    d -= MONTH_DAYS[month]!;
    month++;
  }
  return { season, month, dayOfMonth: d + 1 };
}

export function dayOf(season: number, month: number, dayOfMonth = 1): Day {
  let d = (season - 1) * YEAR_DAYS;
  for (let m = 0; m < month; m++) d += MONTH_DAYS[m]!;
  return d + dayOfMonth - 1;
}

export const isMonthStart = (day: Day): boolean => toParts(day).dayOfMonth === 1;

export function formatDate(day: Day): string {
  const p = toParts(day);
  return `${p.dayOfMonth} ${MONTH_NAMES[p.month]!.slice(0, 3)}, Season ${p.season}`;
}

/** Label for the snapshot published on a month's 1st, e.g. "April S3". */
export function snapshotLabel(day: Day): string {
  const p = toParts(day);
  return `${MONTH_NAMES[p.month]} S${p.season}`;
}
