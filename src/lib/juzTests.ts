import { addDays } from "@/lib/planDates";
import { isInstructionalDay, isoWeekday, type SchoolCalendar } from "@/lib/schoolCalendar";
import { JUZ_START_PAGES, PAGE_STARTS, TOTAL_PAGES } from "@/data/mushaf-index";
import { JUZ_STARTS } from "@/data/juz-index";

/**
 * Juz tests: the rules both the server and the sample portal answer by.
 *
 * A teacher books a child's test for a Juz on a test day, from today up to
 * a few test days ahead. Each day takes a set number of tests, numbered in
 * the order they were booked; an examiner hears them with the Mushaf open,
 * marks each mistake on its word, and passes or fails the Juz. Pure and
 * free of the database, like schoolCalendar.ts, so the browser and the
 * server can never disagree about which day is bookable or what number a
 * test gets.
 */

/** How many tests a day takes, unless the office changes it. */
export const DEFAULT_DAILY_TESTS = 10;
/** Test days a booking can be made ahead, after today. */
export const BOOK_AHEAD_DAYS = 5;

export type JuzResult = "pass" | "fail";
export type MistakeKind = "tajweed" | "memorization";
/** A test as people see it: waiting for its day, heard, or its day gone by unheard. */
export type JuzTestStatus = "booked" | "passed" | "failed" | "missed" | "cancelled";

export interface JuzTest {
  id: string;
  student_id: string;
  student_name: string;
  teacher_name: string | null;
  juz: number;
  test_date: string;
  slot: number;
  result: JuzResult | null;
  comment: string | null;
  examiner_name: string | null;
  tested_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  mistakes: number;
}

export interface JuzMistake {
  id: string;
  kind: MistakeKind;
  page: number;
  surah: number;
  ayah: number;
  word: number;
  note: string | null;
}

/** The days the office has opened or closed to tests, against the school's own week. */
export type TestDayOverrides = Record<string, boolean>;

/**
 * Whether a date takes tests: the office's say for that date if it has
 * one, and otherwise the school's own week. A weekend is closed unless the
 * school teaches on it or the office opens it; a school holiday is closed.
 */
export function isTestDay(date: string, cal: SchoolCalendar, overrides: TestDayOverrides): boolean {
  if (date in overrides) return overrides[date];
  return isInstructionalDay(date, cal);
}

/** Whether a date falls on a Saturday or Sunday. */
export function isWeekend(date: string): boolean {
  return isoWeekday(date) >= 6;
}

/** Today, if it takes tests, then the next `ahead` days that do. */
export function bookableDays(
  today: string,
  cal: SchoolCalendar,
  overrides: TestDayOverrides,
  ahead = BOOK_AHEAD_DAYS
): string[] {
  return [...(isTestDay(today, cal, overrides) ? [today] : []), ...testDaysAfter(today, cal, overrides, ahead)];
}

/** The test days after `from`, for suggesting the next free one. */
export function testDaysAfter(from: string, cal: SchoolCalendar, overrides: TestDayOverrides, count: number): string[] {
  const days: string[] = [];
  let d = from;
  // Bounded: a school closed for a long break still ends the search.
  for (let i = 0; i < 180 && days.length < count; i++) {
    d = addDays(d, 1);
    if (isTestDay(d, cal, overrides)) days.push(d);
  }
  return days;
}

/** The lowest free number on a day, or null when every one is taken. */
export function nextSlot(taken: Iterable<number>, capacity: number): number | null {
  const used = new Set(taken);
  for (let n = 1; n <= capacity; n++) if (!used.has(n)) return n;
  return null;
}

/** An extra test the office books past a full day takes the next number up. */
export function extraSlot(taken: Iterable<number>): number {
  let max = 0;
  for (const n of taken) max = Math.max(max, n);
  return max + 1;
}

export function testStatus(t: Pick<JuzTest, "result" | "cancelled_at" | "test_date">, today: string): JuzTestStatus {
  if (t.cancelled_at) return "cancelled";
  if (t.result === "pass") return "passed";
  if (t.result === "fail") return "failed";
  return t.test_date < today ? "missed" : "booked";
}

/** A child's record across every Juz: what the parent's card shows. */
export function testSummary(tests: Array<Pick<JuzTest, "result" | "cancelled_at" | "test_date" | "juz">>, today: string) {
  const live = tests.filter((t) => !t.cancelled_at);
  const passedJuz = new Set(live.filter((t) => t.result === "pass").map((t) => t.juz));
  const failed = live.filter((t) => t.result === "fail").length;
  const pending = live.filter((t) => testStatus(t, today) === "booked").length;
  return {
    passed: passedJuz.size,
    failed,
    pending,
    // The school's own measure: two Juz passed make a level.
    level: passedJuz.size / 2,
    passedJuz: [...passedJuz].sort((a, b) => a - b),
  };
}

/** "3.5", "4", "0": a level as the school writes it. */
export function levelLabel(level: number): string {
  return Number.isInteger(level) ? String(level) : level.toFixed(1);
}

/** The Mushaf pages a Juz covers, first to last. */
export function juzPages(juz: number): [number, number] {
  const j = Math.max(1, Math.min(30, Math.round(juz)));
  const first = JUZ_START_PAGES[j - 1];
  if (j === 30) return [first, TOTAL_PAGES];
  const nextPage = JUZ_START_PAGES[j];
  const next = JUZ_STARTS[j];
  const [s, a] = PAGE_STARTS[nextPage - 1] ?? [0, 0];
  // The next Juz opens its page, or starts partway down the last one.
  const last = s === next.surah && a === next.ayah ? nextPage - 1 : nextPage;
  return [first, Math.max(first, last)];
}

export const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
