import { getSurahById } from "@/data/mushaf-index";
import { addDays } from "@/lib/planDates";
import { isInstructionalDay, type SchoolCalendar } from "@/lib/schoolCalendar";
import {
  dailySchedule,
  surahOrder,
  type DailyPortion,
  type DailyRateSegment,
  type Direction,
  type Position,
} from "@/lib/mushafPlan";
import type { Milestone, MilestoneStatus, ProgressEntry } from "@/lib/yearlyPlan";

/**
 * The rules that turn a yearly plan into daily lessons and graded lessons
 * back into plan progress — with no database in them, so the live site
 * (autoAssignments.ts, yearlyPlanServer.ts) and the sample portal
 * (demoPlans.ts) run exactly the same rules and cannot drift apart.
 */

/* ── Ratings ───────────────────────────────────────────────────────── */

/** What a rating says about a lesson: heard and passed, or heard and to be
 *  repeated. No rating at all means it has not been heard yet. */
export function statusForRating(rating: string | null): "completed" | "needs_review" | "assigned" {
  if (rating == null) return "assigned";
  return rating === "weak" ? "needs_review" : "completed";
}

/* ── Calendar ──────────────────────────────────────────────────────── */

/** The first school day after `today`, by the school's own calendar.
 *  Bounded, so a calendar with no school days at all cannot loop forever;
 *  past the bound it simply looks no further ahead than today. */
export function nextInstructionalDay(today: string, cal: SchoolCalendar): string {
  let day = addDays(today, 1);
  for (let i = 0; i < 120; i++, day = addDays(day, 1)) {
    if (isInstructionalDay(day, cal)) return day;
  }
  return today;
}

/* ── Surah completion ──────────────────────────────────────────────── */

/**
 * The surahs a lesson from `from` to `to` finishes, in the order it
 * finishes them: every surah it passes out of, plus the last one if the
 * lesson ends on its final ayah. A lesson that stops partway through a
 * surah has not finished it, so that surah is not asked about yet.
 */
export function surahsCompletedIn(from: Position, to: Position, direction: Direction): number[] {
  const order = surahOrder(direction);
  const first = order.indexOf(from.surah);
  const last = order.indexOf(to.surah);
  if (first === -1 || last === -1 || last < first) return [];

  const out = order.slice(first, last);
  if (to.ayah >= (getSurahById(to.surah)?.ayahs ?? Infinity)) out.push(to.surah);
  return out;
}

/* ── Generating lessons ────────────────────────────────────────────── */

/** A lesson the generator already wrote, as far as these rules need it. */
export interface WrittenLesson {
  surah: number;
  ayah_start: number;
  surah_end: number;
  ayah_end: number;
  due_date: string;
}

/** A lesson written for a day still to come — kept only while it matches
 *  the plan, or once somebody has touched it. */
export interface AheadLesson extends WrittenLesson {
  id: string;
  status: string;
  memorization_level: number | null;
  daily_rating: string | null;
  teacher_notes: string | null;
}

export interface LessonPlanInput {
  start: Position;
  direction: Direction;
  unit: string;
  dailyAmount: number;
  startsOn: string;
  endsOn: string;
  cal: SchoolCalendar;
  today: string;
  /** The latest lesson the generator wrote dated on or before today. */
  lastWritten?: WrittenLesson;
  /** Lessons the generator wrote for days after today. */
  ahead: AheadLesson[];
  /** Surahs a teacher has confirmed the student was tested on. */
  confirmed: Set<number>;
}

export interface LessonPlanResult {
  /** New lessons to write, one per school day. */
  toWrite: DailyPortion[];
  /** True when every lesson in `ahead` should be removed before writing:
   *  the plan was edited since they were written and nobody has touched
   *  them, so they are rewritten from the plan as it stands now. */
  discardAhead: boolean;
  /** The surah waiting on a teacher's "tested" confirmation, if any. */
  pendingSurah: number | null;
}

/**
 * Which lessons to write for a student today.
 *
 * Catches up every school day since the generator last wrote one, and
 * writes the next school day's lesson ahead of time, so a teacher can see
 * on Thursday what a weekend class starts with on Saturday. Never past the
 * plan's own last day.
 *
 * The surah-test gate sits between days: any surah a lesson finished has
 * to be confirmed as tested before the *next* day's lesson is written. It
 * cannot sit inside a day — in Juz 'Amma a single page is often three
 * whole surahs (page 604 is An-Nas, Al-Falaq and Al-Ikhlas), so a gate
 * that refused any lesson crossing a surah boundary would refuse the very
 * first lesson of the plan, before the student had been given anything to
 * be tested on. It is seeded from the last lesson already written, so a
 * gate raised on an earlier visit is still standing on this one, and is
 * reported even when nothing new is due, so the teacher is asked straight
 * away rather than on the morning the next lesson falls due.
 */
export function planLessons(input: LessonPlanInput): LessonPlanResult {
  const { start, direction, unit, dailyAmount, startsOn, endsOn, cal, today, lastWritten, confirmed } = input;

  const lookahead = nextInstructionalDay(today, cal);
  const until = lookahead < endsOn ? lookahead : endsOn;
  const generateFrom = lastWritten ? addDays(lastWritten.due_date, 1) : startsOn;
  const days =
    generateFrom > until
      ? []
      : dailySchedule(start, direction, unit, dailyAmount, startsOn, generateFrom, until, cal);

  // A lesson written ahead of its day goes stale if the plan is edited
  // before that day comes — a new start date, pace or starting ayah. Any
  // that no longer match are rewritten, as long as nobody has touched them
  // yet; one a teacher has already graded or noted is left alone.
  const expectedByDate = new Map(days.map((d) => [d.date, d]));
  const matches = (r: AheadLesson) => {
    const d = expectedByDate.get(r.due_date);
    return (
      !!d &&
      d.from.surah === r.surah && d.from.ayah === r.ayah_start &&
      d.to.surah === r.surah_end && d.to.ayah === r.ayah_end
    );
  };
  const untouched = (r: AheadLesson) =>
    r.status === "assigned" && !r.memorization_level && r.daily_rating == null && r.teacher_notes == null;
  const discardAhead = input.ahead.length > 0 && !input.ahead.every(matches) && input.ahead.every(untouched);
  const kept = new Set(discardAhead ? [] : input.ahead.map((r) => r.due_date));

  const blocking: number[] = lastWritten
    ? surahsCompletedIn(
        { surah: lastWritten.surah, ayah: lastWritten.ayah_start },
        { surah: lastWritten.surah_end, ayah: lastWritten.ayah_end },
        direction
      ).filter((s) => !confirmed.has(s))
    : [];
  const toWrite: DailyPortion[] = [];

  for (const day of days) {
    if (blocking.length > 0) break;
    if (!kept.has(day.date)) toWrite.push(day);
    for (const s of surahsCompletedIn(day.from, day.to, direction)) {
      if (!confirmed.has(s)) blocking.push(s);
    }
  }

  return { toWrite, discardAhead, pendingSurah: blocking[0] ?? null };
}

/* ── Graded lessons count toward the plan ──────────────────────────── */

export interface LessonCredit {
  milestone: Milestone;
  unitsAfter: number;
  status: MilestoneStatus;
  complete: boolean;
}

/**
 * What a lesson the plan wrote does to its week's milestone when it moves
 * into or out of "completed": one day's share added, or taken back off.
 * Null when there is nothing to change — no milestone for that date, or
 * the milestone already sits at the edge the change would push past.
 *
 * The milestone is the one whose dates hold the lesson's own due date, or
 * for a lesson dated in a gap between two, the one before it.
 */
export function creditForLesson(
  milestones: Milestone[],
  dueDate: string,
  share: number,
  nowCompleted: boolean
): LessonCredit | null {
  if (share <= 0) return null;
  const milestone =
    milestones.find((m) => m.starts_on <= dueDate && dueDate <= m.due_on) ??
    [...milestones].reverse().find((m) => m.starts_on <= dueDate);
  if (!milestone) return null;

  const target = milestone.target_units;
  const raw = milestone.completed_units + (nowCompleted ? share : -share);
  const unitsAfter = Math.round(Math.max(0, target > 0 ? Math.min(target, raw) : raw) * 100) / 100;
  if (unitsAfter === milestone.completed_units) return null;

  const complete = target > 0 && unitsAfter >= target;
  return {
    milestone,
    unitsAfter,
    complete,
    status: complete ? "completed" : unitsAfter > 0 ? "in_progress" : "pending",
  };
}

/* ── Keeping a daily-rate plan's milestones in step ───────────────── */

/**
 * Whether a daily-rate plan's milestones may be rebuilt from its own fields.
 * Never once anything is recorded against it — rebuilding would erase that
 * history — nor once a teacher has written a milestone of their own (a
 * title, a description, or no mushaf range at all), which the generator
 * never produces and a rebuild would throw away.
 */
export function canRebuildMilestones(milestones: Milestone[], entries: ProgressEntry[]): boolean {
  if (entries.length > 0 || milestones.some((m) => m.completed_units > 0)) return false;
  return !milestones.some((m) => m.title != null || m.description != null || m.from_surah == null);
}

/**
 * True when the stored milestones are exactly the schedule the plan's own
 * fields produce today: same weeks, same dates, same ayahs, same targets.
 */
export function sameSchedule(stored: Milestone[], expected: DailyRateSegment[]): boolean {
  if (stored.length !== expected.length) return false;
  return stored.every((m, i) => {
    const e = expected[i];
    return (
      m.starts_on === e.starts_on &&
      m.due_on === e.due_on &&
      m.from_surah === e.from_surah &&
      m.from_ayah === e.from_ayah &&
      m.to_surah === e.to_surah &&
      m.to_ayah === e.to_ayah &&
      Math.abs(m.target_units - e.target_units) < 0.005
    );
  });
}
