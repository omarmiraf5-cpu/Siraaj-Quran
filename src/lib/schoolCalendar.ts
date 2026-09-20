import { addDays, daysBetween, parseDay } from "@/lib/planDates";

/**
 * Which days a school actually holds Qur'an instruction on.
 *
 * Two independent facts, matching the schema: a standing set of weekdays
 * (Friday given to PE, weekends off) and a growing list of specific closed
 * dates (Eid, winter break, a PD day). Everything here is pure and
 * dependency-free, for the same reason yearlyPlan.ts is — the same
 * calendar has to produce the same answer on the server, where alerts are
 * persisted, and in the browser, where a parent's dial is drawn.
 */

export interface SchoolCalendar {
  /** ISO weekday numbers that carry instruction: 1=Monday .. 7=Sunday. */
  weekdays: number[];
  /** Closed dates, as a Set of "YYYY-MM-DD" for O(1) lookup — a school
   *  year holds a few dozen of these at most, so building the set once
   *  per calendar and reusing it is what keeps a month of daily lookups
   *  cheap. */
  closedDates: Set<string>;
}

/** The plain five-day week, used wherever no calendar has been set up
 *  yet. Every function below takes a calendar explicitly rather than
 *  defaulting internally, so a caller can never forget to pass one; this
 *  is what they pass when a school genuinely has none. */
export const DEFAULT_CALENDAR: SchoolCalendar = {
  weekdays: [1, 2, 3, 4, 5],
  closedDates: new Set(),
};

export function buildCalendar(weekdays: number[], closedDates: Iterable<string>): SchoolCalendar {
  return { weekdays: [...weekdays].sort(), closedDates: new Set(closedDates) };
}

/** ISO weekday for a plan-shaped date string: 1=Monday .. 7=Sunday. Not
 *  JS's own getDay() (0=Sunday), which would put Sunday at the start of
 *  the array instead of the end and make "weekdays" read back to front. */
export function isoWeekday(iso: string): number {
  const jsDay = parseDay(iso).getUTCDay();
  return jsDay === 0 ? 7 : jsDay;
}

/** Whether Qur'an instruction happens on this date at all. */
export function isInstructionalDay(date: string, cal: SchoolCalendar): boolean {
  return cal.weekdays.includes(isoWeekday(date)) && !cal.closedDates.has(date);
}

/**
 * How many instructional days fall in (from, to], matching the convention
 * daysBetween already uses elsewhere in this module — same-day is 0, and
 * the count accrues on completed days rather than the one still in
 * progress. Kept as a single well-tested loop rather than a closed-form
 * formula: closed dates don't follow any pattern a formula could shortcut,
 * so a formula here would only be a second, easier-to-get-wrong version
 * of the same loop.
 */
export function countInstructionalDays(from: string, to: string, cal: SchoolCalendar): number {
  if (daysBetween(from, to) <= 0) return 0;
  let count = 0;
  let d = addDays(from, 1);
  while (daysBetween(d, to) >= 0) {
    if (isInstructionalDay(d, cal)) count++;
    d = addDays(d, 1);
  }
  return count;
}

/**
 * The nth instructional day after `from` (n=1 is the next one). Used to
 * turn "the plan started here and this many school days have passed" into
 * an actual calendar date — the inverse of countInstructionalDays.
 *
 * Bounded at 3660 calendar days (ten years) so a calendar with an
 * impossible combination — every weekday excluded, or a closed-dates set
 * covering the rest of time — fails by returning null rather than by
 * hanging the caller.
 */
export function nthInstructionalDayAfter(from: string, n: number, cal: SchoolCalendar): string | null {
  if (n <= 0) return from;
  let d = from;
  let found = 0;
  for (let guard = 0; guard < 3660; guard++) {
    d = addDays(d, 1);
    if (isInstructionalDay(d, cal)) {
      found++;
      if (found === n) return d;
    }
  }
  return null;
}

/** The most recent instructional day on or before `date` — "today" for a
 *  plan when today itself happens to be a weekend or a holiday, which is
 *  what "what should they be doing" has to fall back to rather than
 *  reporting nothing. */
export function lastInstructionalDayOnOrBefore(date: string, cal: SchoolCalendar): string | null {
  let d = date;
  for (let guard = 0; guard < 3660; guard++) {
    if (isInstructionalDay(d, cal)) return d;
    d = addDays(d, -1);
  }
  return null;
}

/** The next instructional day on or after `date` — the counterpart above,
 *  for "when does work next resume" once today is found to be off. */
export function nextInstructionalDayOnOrAfter(date: string, cal: SchoolCalendar): string | null {
  let d = date;
  for (let guard = 0; guard < 3660; guard++) {
    if (isInstructionalDay(d, cal)) return d;
    d = addDays(d, 1);
  }
  return null;
}
