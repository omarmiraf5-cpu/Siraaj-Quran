/**
 * Progress and pace for an individualized yearly Qur'an plan.
 *
 * Pure functions with no Supabase, no crypto and no React, for two
 * reasons: the same numbers have to come out on the server (where alerts
 * are persisted) and in the browser (where the parent's dial is drawn), and
 * a discrepancy between the two would be invisible and maddening. Keeping
 * the maths in one dependency-free place also means it can be tested
 * directly against a table of dates rather than through a running app.
 *
 * ── How "behind" is decided ──────────────────────────────────────────
 * Not by comparing today's total against the year's end target — that only
 * ever says whether the finish line is reachable, which stays true until
 * it suddenly isn't, usually in May. It is decided against the milestone
 * schedule: each milestone contributes its target linearly across its own
 * window, so at any date there is a figure for where the child was
 * supposed to be. A child behind in November shows as behind in November.
 */

/**
 * What a field reads as when the database held something but this
 * deployment could not open it — a row written under a key that has since
 * been rotated away, or a tampered envelope.
 *
 * Declared here, in the module with no Node dependencies, rather than in
 * planCrypto: the UI has to recognise it to render "unreadable" instead of
 * the marker itself, and importing planCrypto from a client component
 * would pull node:crypto — and the key's own env var — toward the browser
 * bundle. planCrypto re-exports it.
 *
 * U+FFFD rather than NUL: the value is serialised into JSON responses, and
 * NUL bytes make that payload binary to every proxy and log along the way.
 */
export const UNREADABLE = "�unreadable�";

/** Display form for any decrypted field. */
export function readable(value: string | null | undefined, fallback = "—"): string {
  if (value == null || value === "") return fallback;
  if (value === UNREADABLE) return "⚠ unreadable";
  return value;
}

export type PlanUnit = "ayah" | "page" | "line" | "surah" | "juz" | "lesson";
export type PlanStatus = "draft" | "active" | "completed" | "archived";
export type MilestoneStatus = "pending" | "in_progress" | "completed" | "missed";
export type PaceStatus = "not_started" | "ahead" | "on_track" | "at_risk" | "behind" | "complete";
export type AlertCode =
  | "behind_schedule"
  | "milestone_overdue"
  | "no_recent_progress"
  | "ending_incomplete";
export type AlertLevel = "info" | "warning" | "critical";

/** A milestone as the app holds it: content already decrypted. */
export interface Milestone {
  id: string;
  sequence: number;
  starts_on: string; // YYYY-MM-DD
  due_on: string; // YYYY-MM-DD
  target_units: number;
  completed_units: number;
  status: MilestoneStatus;
  completed_on: string | null;
  title: string | null;
  description: string | null;
  /** The stretch of the mushaf this segment covers, when the plan was
   *  anchored to the text rather than set as a plain count. */
  from_surah: number | null;
  from_ayah: number | null;
  to_surah: number | null;
  to_ayah: number | null;
}

export interface Plan {
  id: string;
  student_id: string;
  academic_year: string;
  starts_on: string;
  ends_on: string;
  unit: PlanUnit;
  status: PlanStatus;
  title: string | null;
  notes: string | null;
  /** Where the plan was anchored and which way through the mushaf it
   *  runs. Null on an unanchored, count-only plan. */
  start_surah: number | null;
  start_ayah: number | null;
  direction: "forward" | "hifz" | null;
  /** A steady per-instructional-day pace, in `unit` — "1 page a day" rather
   *  than a year's total split evenly. Null on a plan made the other way. */
  daily_new_amount: number | null;
  /** A daily review amount. Carries no position of its own — see
   *  dailySchedule's own note on why review isn't walked. */
  daily_review_amount: number | null;
  /** The unit `daily_review_amount` is counted in — independent of the
   *  plan's own `unit`, since reviewing a whole juz a day is ordinary
   *  while memorising one is not. Null falls back to the plan's `unit`,
   *  for a plan saved before this column existed. */
  daily_review_unit: PlanUnit | null;
}

export interface ProgressEntry {
  id: string;
  milestone_id: string;
  recorded_on: string;
  units_after: number;
  note: string | null;
}

export interface PlanAlert {
  code: AlertCode;
  level: AlertLevel;
  title: string;
  detail: string;
}

/* ── Tunables ──────────────────────────────────────────────────────────
   Collected here rather than inlined, because a school that runs an
   intensive summer programme will want them different from one running a
   weekend madrasah, and hunting thresholds through three files is how they
   end up inconsistent. */
export const PACE = {
  /** At or above this share of expected, the child is ahead. */
  aheadRatio: 1.05,
  /** At or above this, on track. */
  onTrackRatio: 0.95,
  /** At or above this, at risk. Below it, behind. */
  atRiskRatio: 0.85,
  /** Days without any recorded progress before that becomes an alert. */
  staleAfterDays: 21,
  /** How close to the end date "ending soon" starts meaning something. */
  endingSoonDays: 60,
  /** Projected finish below this share of the total is worth flagging. */
  endingShortfallRatio: 0.9,
} as const;

/* ── Dates ─────────────────────────────────────────────────────────────
   Moved to planDates.ts so schoolCalendar.ts can use the same arithmetic
   without the two modules importing each other; re-exported here so every
   existing `from "@/lib/yearlyPlan"` import keeps working unchanged. */
export { parseDay, toISODate, daysBetween, addDays, todayISO } from "@/lib/planDates";
import { parseDay, toISODate, daysBetween, addDays, todayISO } from "@/lib/planDates";
import { countInstructionalDays, type SchoolCalendar } from "@/lib/schoolCalendar";

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/* ── Expected progress ─────────────────────────────────────────────── */

/**
 * Where a milestone expects the child to be on a given day. Before it
 * opens, nothing; after it closes, all of it; in between, straight-line.
 *
 * Straight-line rather than anything cleverer on purpose: a teacher who
 * wants the pace to step rather than slope says so by writing two
 * milestones, and a curve nobody asked for would make "why does it say
 * I'm behind?" unanswerable.
 */
/**
 * `cal` is optional and changes nothing about the shape of the answer —
 * only what a "day" counts as. Omitted, this apportions by raw calendar
 * days exactly as before. Supplied, it apportions by instructional days
 * instead: a milestone whose six-week window includes a two-week break
 * expects nothing across that break, the same way a teacher who wrote the
 * due date around it intended, rather than treating Eid as an ordinary
 * Tuesday of steady progress.
 */
export function expectedUnitsForMilestone(m: Milestone, onDate: string, cal?: SchoolCalendar): number {
  const span = daysBetween(m.starts_on, m.due_on);
  const elapsed = daysBetween(m.starts_on, onDate);
  // Checked before the elapsed<=0 branch, not after: a milestone that opens
  // and closes on the same day has a zero-day span AND zero elapsed on its
  // own due date, so testing elapsed first would report nothing expected on
  // the very day the whole thing falls due. It is all-or-nothing, and
  // dividing by the zero span below would be a NaN through every total.
  if (span <= 0) return elapsed >= 0 ? m.target_units : 0;
  if (elapsed <= 0) return 0;
  if (elapsed >= span) return m.target_units;
  if (!cal) return (m.target_units * elapsed) / span;

  const spanDays = countInstructionalDays(m.starts_on, m.due_on, cal);
  const elapsedDays = countInstructionalDays(m.starts_on, onDate, cal);
  // A window with no instructional days inside it at all — rare, but a
  // milestone entirely swallowed by a single long break is possible —
  // has nothing to apportion by day count; fall back to the calendar-day
  // fraction already computed above rather than dividing by zero.
  if (spanDays <= 0) return (m.target_units * elapsed) / span;
  return (m.target_units * Math.min(elapsedDays, spanDays)) / spanDays;
}

/** Where the whole plan expects the child to be on a given day. */
export function expectedUnitsOn(milestones: Milestone[], onDate: string, cal?: SchoolCalendar): number {
  return milestones.reduce((sum, m) => sum + expectedUnitsForMilestone(m, onDate, cal), 0);
}

/* ── Actual progress ───────────────────────────────────────────────── */

/**
 * What a milestone stood at on a given day, reconstructed from the log.
 *
 * `units_after` is an absolute figure rather than a delta, so the answer is
 * simply the newest entry on or before that day — which also means a
 * teacher correcting a number downwards is handled with no special case.
 * With no entry at or before the date, the milestone had not been touched
 * yet, which is 0 rather than its current figure.
 */
export function actualUnitsForMilestoneOn(
  milestone: Milestone,
  entries: ProgressEntry[],
  onDate: string
): number {
  let best: ProgressEntry | null = null;
  for (const e of entries) {
    if (e.milestone_id !== milestone.id) continue;
    if (daysBetween(e.recorded_on, onDate) < 0) continue; // recorded after onDate
    if (!best || daysBetween(best.recorded_on, e.recorded_on) >= 0) best = e;
  }
  return best ? best.units_after : 0;
}

/**
 * The plan's total on a given day. For today or later this trusts the
 * milestones' own completed_units rather than replaying the log: that is
 * the live figure, and a teacher who edits a milestone directly (rather
 * than through the progress form) would otherwise not show up at all.
 */
export function actualUnitsOn(
  milestones: Milestone[],
  entries: ProgressEntry[],
  onDate: string,
  today: string = todayISO()
): number {
  if (daysBetween(today, onDate) >= 0) {
    return milestones.reduce((sum, m) => sum + m.completed_units, 0);
  }
  return milestones.reduce(
    (sum, m) => sum + actualUnitsForMilestoneOn(m, entries, onDate),
    0
  );
}

/* ── The summary everything else reads ─────────────────────────────── */

export interface PlanProgress {
  /** Sum of every milestone's target. */
  totalUnits: number;
  /** Where the child actually is. */
  actualUnits: number;
  /** Where the schedule says they should be today. */
  expectedUnits: number;
  /** Positive when ahead, negative when behind. */
  varianceUnits: number;
  /** actual ÷ total, 0–100. */
  percentComplete: number;
  /** expected ÷ total, 0–100 — where the marker on the bar goes. */
  percentExpected: number;
  /** actual ÷ expected. 1 is exactly on schedule. */
  paceRatio: number;
  pace: PaceStatus;
  /** False when the plan has no targets to measure against yet. */
  measurable: boolean;
  daysTotal: number;
  daysElapsed: number;
  daysRemaining: number;
  /** Where this pace lands by the end date, if nothing changes. */
  projectedUnits: number;
  /** Units per week needed from today to finish on time. 0 when done. */
  requiredPerWeek: number;
  /** Units per week actually achieved so far. */
  currentPerWeek: number;
  /** Milestones past due and not finished. */
  overdueMilestones: Milestone[];
  /** Days since the last recorded progress, null if never. */
  daysSinceProgress: number | null;
}

export function computePlanProgress(
  plan: Plan,
  milestones: Milestone[],
  entries: ProgressEntry[] = [],
  today: string = todayISO(),
  cal?: SchoolCalendar
): PlanProgress {
  const totalUnits = milestones.reduce((s, m) => s + m.target_units, 0);
  const actualUnits = milestones.reduce((s, m) => s + m.completed_units, 0);
  const expectedRaw = expectedUnitsOn(milestones, today, cal);
  const expectedUnits = Math.round(expectedRaw * 100) / 100;

  // "Days" mean instructional days once a calendar is supplied. A parent
  // asking how many days are left wants school days, not a raw span that
  // counts a fortnight of Eid holiday the same as a fortnight of classes
  // — and a per-week rate divided across that raw span understates how
  // much is really needed once school resumes. Omitted, this is exactly
  // the calendar-day math it always was.
  const daysTotal = cal
    ? Math.max(1, countInstructionalDays(plan.starts_on, plan.ends_on, cal))
    : Math.max(1, daysBetween(plan.starts_on, plan.ends_on));
  const daysElapsed = cal
    ? clamp(countInstructionalDays(plan.starts_on, today, cal), 0, daysTotal)
    : clamp(daysBetween(plan.starts_on, today), 0, daysTotal);
  const daysRemaining = cal
    ? Math.max(0, countInstructionalDays(today, plan.ends_on, cal))
    : Math.max(0, daysBetween(today, plan.ends_on));
  // A "week" is however many of the calendar's own weekdays carry
  // instruction — 5 for the ordinary school week, fewer for a school
  // that also gives up, say, Friday to PE — so "per week" stays the same
  // comparable unit a calendar-less plan already reports it in.
  const daysPerWeek = cal ? Math.max(1, cal.weekdays.length) : 7;

  const measurable = totalUnits > 0;
  const percentComplete = measurable ? clamp((actualUnits / totalUnits) * 100, 0, 100) : 0;
  const percentExpected = measurable ? clamp((expectedRaw / totalUnits) * 100, 0, 100) : 0;

  // Before the schedule expects anything, a ratio is meaningless — dividing
  // by zero to decide a child is infinitely ahead on day one is worse than
  // saying the plan hasn't started.
  const paceRatio = expectedRaw > 0 ? actualUnits / expectedRaw : 1;

  const overdueMilestones = milestones.filter(
    (m) =>
      daysBetween(m.due_on, today) > 0 &&
      m.status !== "completed" &&
      m.completed_units < m.target_units
  );

  let pace: PaceStatus;
  if (!measurable || daysBetween(plan.starts_on, today) < 0) {
    pace = "not_started";
  } else if (actualUnits >= totalUnits) {
    pace = "complete";
  } else if (expectedRaw <= 0) {
    pace = "not_started";
  } else if (paceRatio >= PACE.aheadRatio) {
    pace = "ahead";
  } else if (paceRatio >= PACE.onTrackRatio) {
    pace = "on_track";
  } else if (paceRatio >= PACE.atRiskRatio) {
    pace = "at_risk";
  } else {
    pace = "behind";
  }

  // A child can sit at 98% of the expected total while having skipped a
  // whole milestone, because running ahead on one covers for the other.
  // The headline should not read "on track" in that case.
  if (overdueMilestones.length > 0 && (pace === "on_track" || pace === "ahead")) {
    pace = "at_risk";
  }

  const currentPerWeek = daysElapsed > 0 ? (actualUnits / daysElapsed) * daysPerWeek : 0;
  const projectedUnits =
    daysElapsed > 0 ? Math.round((actualUnits / daysElapsed) * daysTotal) : actualUnits;
  const remainingUnits = Math.max(0, totalUnits - actualUnits);
  const requiredPerWeek =
    remainingUnits === 0
      ? 0
      : daysRemaining > 0
        ? (remainingUnits / daysRemaining) * daysPerWeek
        : remainingUnits;

  // Future-dated entries are ignored rather than counted as recent work.
  // A session recorded for next March has not happened, and treating it as
  // the newest entry would silence the stale-plan alert for months — which
  // is exactly the case where a mistyped year needs to be noticed. Ignored,
  // it leaves daysSinceProgress null and the alert fires.
  //
  // Measured in instructional days once a calendar exists, for the same
  // reason as above: a class that graded right up to winter break and
  // resumes the day it ends should not read as three weeks silent —
  // school itself was closed for almost all of that gap.
  let daysSinceProgress: number | null = null;
  for (const e of entries) {
    // The sign check has to run on raw calendar days regardless of cal:
    // countInstructionalDays returns 0, not negative, for a `from` that
    // is after `to` — it was never designed to report direction, only a
    // count — so checking its result directly would stop skipping a
    // future-dated entry and instead read it as "0 days since progress".
    const rawAge = daysBetween(e.recorded_on, today);
    if (rawAge < 0) continue;
    const age = cal ? countInstructionalDays(e.recorded_on, today, cal) : rawAge;
    if (daysSinceProgress === null || age < daysSinceProgress) daysSinceProgress = age;
  }

  return {
    totalUnits,
    actualUnits,
    expectedUnits,
    varianceUnits: Math.round((actualUnits - expectedRaw) * 100) / 100,
    percentComplete,
    percentExpected,
    paceRatio,
    pace,
    measurable,
    daysTotal,
    daysElapsed,
    daysRemaining,
    projectedUnits,
    requiredPerWeek: Math.round(requiredPerWeek * 10) / 10,
    currentPerWeek: Math.round(currentPerWeek * 10) / 10,
    overdueMilestones,
    daysSinceProgress,
  };
}

/* ── Period slices, for the month / week filter ────────────────────── */

export type PeriodGrain = "year" | "month" | "week";

export interface PeriodSlice {
  key: string;
  label: string;
  from: string;
  to: string;
  /** How much the schedule expects to be covered inside this window. */
  expectedUnits: number;
  /** How much was actually recorded inside it. */
  actualUnits: number;
  /** Milestones whose deadline falls in the window. */
  dueMilestones: Milestone[];
  /** Milestones live at any point during it, deadline or not. */
  activeMilestones: Milestone[];
  /** True for the window containing today. */
  isCurrent: boolean;
  /** True once the window has passed. */
  isPast: boolean;
}

/** How much the schedule expects to be covered strictly inside a window —
 *  the difference between the cumulative curve at each end. */
export function expectedUnitsBetween(
  milestones: Milestone[],
  from: string,
  to: string,
  cal?: SchoolCalendar
): number {
  return Math.max(0, expectedUnitsOn(milestones, to, cal) - expectedUnitsOn(milestones, from, cal));
}

/** How much was actually recorded inside a window, per milestone, from the
 *  log — the same difference-of-two-points trick, which keeps downward
 *  corrections behaving sensibly. */
export function actualUnitsBetween(
  milestones: Milestone[],
  entries: ProgressEntry[],
  from: string,
  to: string,
  today: string = todayISO()
): number {
  return Math.max(
    0,
    actualUnitsOn(milestones, entries, to, today) -
      actualUnitsOn(milestones, entries, from, today)
  );
}

function monthLabel(iso: string, locale: string): string {
  return parseDay(iso).toLocaleDateString(locale, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function dayLabel(iso: string, locale: string): string {
  return parseDay(iso).toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function startOfMonth(iso: string): string {
  return iso.slice(0, 7) + "-01";
}

function endOfMonth(iso: string): string {
  const d = parseDay(iso);
  return toISODate(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0, 12)));
}

/** Monday of the week containing the date. Weeks start on Monday because
 *  that is how a school timetable reads; Sunday-start would split every
 *  weekend madrasah across two buckets. */
export function startOfWeek(iso: string): string {
  const d = parseDay(iso);
  const dow = (d.getUTCDay() + 6) % 7; // Monday = 0
  return addDays(iso, -dow);
}

/**
 * Cuts the plan into windows at the requested grain.
 *
 * A milestone lands in the window its deadline falls in — "September's
 * goal" is the one due in September, which is how a teacher describes it
 * and how a parent asks about it. Expected and actual are pro-rated across
 * the window instead, so a milestone spanning three months still shows a
 * third of its work in each; bucketing those by deadline as well would
 * make two months look empty and the third impossible.
 */
export function slicePlan(
  plan: Plan,
  milestones: Milestone[],
  entries: ProgressEntry[],
  grain: PeriodGrain,
  today: string = todayISO(),
  locale = "en-CA",
  cal?: SchoolCalendar
): PeriodSlice[] {
  if (grain === "year") {
    return [
      {
        key: plan.academic_year,
        label: plan.academic_year,
        from: plan.starts_on,
        to: plan.ends_on,
        expectedUnits: expectedUnitsOn(milestones, today, cal),
        actualUnits: actualUnitsOn(milestones, entries, today, today),
        dueMilestones: [...milestones].sort((a, b) => a.sequence - b.sequence),
        activeMilestones: [...milestones].sort((a, b) => a.sequence - b.sequence),
        isCurrent: daysBetween(plan.starts_on, today) >= 0 && daysBetween(today, plan.ends_on) >= 0,
        isPast: daysBetween(plan.ends_on, today) > 0,
      },
    ];
  }

  const slices: PeriodSlice[] = [];
  const step = grain === "month" ? 0 : 7;
  let cursor = grain === "month" ? startOfMonth(plan.starts_on) : startOfWeek(plan.starts_on);
  // Bounded rather than while(true): a malformed plan with a thousand-year
  // span should render nothing useful, not hang the browser.
  const maxSlices = grain === "month" ? 36 : 160;

  for (let i = 0; i < maxSlices; i++) {
    const from = cursor;
    const to = grain === "month" ? endOfMonth(cursor) : addDays(cursor, 6);
    if (daysBetween(plan.ends_on, from) > 0) break;

    const dueMilestones = milestones
      .filter((m) => daysBetween(from, m.due_on) >= 0 && daysBetween(m.due_on, to) >= 0)
      .sort((a, b) => a.sequence - b.sequence);
    const activeMilestones = milestones
      .filter((m) => daysBetween(m.starts_on, to) >= 0 && daysBetween(from, m.due_on) >= 0)
      .sort((a, b) => a.sequence - b.sequence);

    slices.push({
      key: from,
      label:
        grain === "month"
          ? monthLabel(from, locale)
          : `${dayLabel(from, locale)} – ${dayLabel(to, locale)}`,
      from,
      to,
      // Measured from the day before the window opens, so work done on its
      // first day counts inside it rather than being attributed to the
      // window that just closed.
      expectedUnits: expectedUnitsBetween(milestones, addDays(from, -1), to, cal),
      actualUnits: actualUnitsBetween(milestones, entries, addDays(from, -1), to, today),
      dueMilestones,
      activeMilestones,
      isCurrent: daysBetween(from, today) >= 0 && daysBetween(today, to) >= 0,
      isPast: daysBetween(to, today) > 0,
    });

    cursor = grain === "month" ? addDays(endOfMonth(cursor), 1) : addDays(cursor, step);
  }

  return slices;
}

/* ── Alerts ────────────────────────────────────────────────────────── */

// Alert text rounds to whole units on purpose: "a shortfall of 0.37 juz"
// is a worse sentence than "a shortfall of 0.4 juz", and neither helps a
// parent more than the milestone list underneath already does.
const unitWord = (n: number, unit: PlanUnit) =>
  `${formatApprox(n)} ${unitLabel(n, unit)}`;

/**
 * Decides which alerts a plan is currently raising. Pure — it reports what
 * is true today and says nothing about what is already stored; reconciling
 * this list against the rows in yearly_plan_alerts (raising the new ones,
 * resolving the ones that have cleared) is the API route's job, in
 * syncPlanAlerts.
 */
export function evaluateAlerts(
  plan: Plan,
  milestones: Milestone[],
  entries: ProgressEntry[] = [],
  today: string = todayISO(),
  cal?: SchoolCalendar
): PlanAlert[] {
  const alerts: PlanAlert[] = [];

  // A draft nobody has activated, or an archived year, is not behind on
  // anything. Raising alerts on those would train everyone to ignore them.
  if (plan.status !== "active") return alerts;
  if (daysBetween(plan.starts_on, today) < 0) return alerts;

  const p = computePlanProgress(plan, milestones, entries, today, cal);
  if (!p.measurable) return alerts;

  if (p.pace === "behind" || p.pace === "at_risk") {
    const short = Math.max(0, p.expectedUnits - p.actualUnits);
    alerts.push({
      code: "behind_schedule",
      level: p.pace === "behind" ? "critical" : "warning",
      title: p.pace === "behind" ? "Behind schedule" : "Slipping behind",
      detail:
        `Expected ${unitWord(p.expectedUnits, plan.unit)} by today, recorded ` +
        `${unitWord(p.actualUnits, plan.unit)} — a shortfall of ${unitWord(short, plan.unit)}. ` +
        `Finishing on time now needs about ${formatApprox(p.requiredPerWeek)} ` +
        `${unitLabel(p.requiredPerWeek, plan.unit)} a week, against ` +
        `${formatApprox(p.currentPerWeek)} so far.`,
    });
  }

  if (p.overdueMilestones.length > 0) {
    const first = p.overdueMilestones[0];
    const late = daysBetween(first.due_on, today);
    alerts.push({
      code: "milestone_overdue",
      level: p.overdueMilestones.length >= 2 ? "critical" : "warning",
      title:
        p.overdueMilestones.length === 1
          ? "A milestone has passed its date"
          : `${p.overdueMilestones.length} milestones have passed their dates`,
      detail:
        `"${first.title ?? `Milestone ${first.sequence}`}" was due ${first.due_on} ` +
        `(${late} day${late === 1 ? "" : "s"} ago) at ` +
        `${formatQuantity(first.completed_units)} of ${formatUnits(first.target_units, plan.unit)}.`,
    });
  }

  if (p.daysSinceProgress === null || p.daysSinceProgress >= PACE.staleAfterDays) {
    alerts.push({
      code: "no_recent_progress",
      level: "warning",
      title: "No progress recorded recently",
      detail:
        p.daysSinceProgress === null
          ? "Nothing has been recorded against this plan since it was created."
          : `The last entry was ${p.daysSinceProgress} days ago. The pace figures above are ` +
            `only as current as the last time a teacher recorded a session.`,
    });
  }

  if (
    p.daysRemaining <= PACE.endingSoonDays &&
    p.daysRemaining > 0 &&
    p.projectedUnits < p.totalUnits * PACE.endingShortfallRatio
  ) {
    alerts.push({
      code: "ending_incomplete",
      level: "warning",
      title: "On course to finish short",
      detail:
        `${p.daysRemaining} days left. At the current pace this plan lands at about ` +
        `${unitWord(p.projectedUnits, plan.unit)} of ${unitWord(p.totalUnits, plan.unit)}.`,
    });
  }

  return alerts;
}

/* ── Presentation helpers ──────────────────────────────────────────── */

/**
 * A quantity as a reader expects it: 2 rather than 2.00, 0.5 rather than
 * 0.50. Targets are stored to two decimals so that half a juz a month is
 * expressible, but almost every figure on screen is a whole number and
 * printing trailing zeros on all of them would be noise.
 */
export function formatQuantity(n: number): string {
  const rounded = Math.round(n * 100) / 100;
  return String(rounded);
}

/**
 * For figures that are *derived* rather than stored — today's expected
 * total, a projected finish, a per-week rate, a month's slice. These come
 * out of interpolation, so their decimals are an artefact of the maths
 * rather than something a teacher typed.
 *
 * Ten is the line: below it a tenth still carries meaning (half a juz a
 * month is the whole point of allowing fractions), above it "38.9 ayahs
 * expected" is worse than "39" for every reader.
 */
export function formatApprox(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 10) return String(Math.round(n));
  return String(Math.round(n * 10) / 10);
}

/**
 * The unit with its count. "juz" is invariant — a plan for five ajzāʾ
 * reads as "5 juz" in every school that would use this, and "5 juzs" is
 * simply wrong. The rest take a plain -s.
 */
export function formatUnits(n: number, unit: PlanUnit): string {
  return `${formatQuantity(n)} ${unitLabel(n, unit)}`;
}

export function unitLabel(n: number, unit: PlanUnit): string {
  if (unit === "juz") return "juz";
  return Math.round(n * 100) / 100 === 1 ? unit : `${unit}s`;
}

export const PACE_LABEL: Record<PaceStatus, string> = {
  not_started: "Not started",
  ahead: "Ahead of schedule",
  on_track: "On track",
  at_risk: "Slipping",
  behind: "Behind schedule",
  complete: "Complete",
};

/** Milestone titles are optional — a teacher generating twelve monthly
 *  milestones in one click shouldn't have to name all twelve. */
export function milestoneTitle(m: Milestone): string {
  if (m.title === UNREADABLE) return "⚠ unreadable";
  return m.title?.trim() || `Milestone ${m.sequence}`;
}

export function milestonePercent(m: Milestone): number {
  if (m.target_units <= 0) return m.status === "completed" ? 100 : 0;
  return clamp((m.completed_units / m.target_units) * 100, 0, 100);
}

/**
 * Builds an evenly spaced set of milestones across a plan's span — the
 * "generate monthly milestones" button. A teacher can then rename, retarget
 * or delete any of them; this only saves the typing of twelve near-identical
 * date pairs, which is the part nobody does carefully by hand.
 *
 * The remainder is spread one unit at a time across the earliest segments
 * rather than dumped on the last, so the final month isn't quietly harder
 * than the rest.
 */
export function generateMilestoneSkeleton(
  startsOn: string,
  endsOn: string,
  segments: number,
  totalUnits: number
): Array<Pick<Milestone, "sequence" | "starts_on" | "due_on" | "target_units">> {
  const count = Math.max(1, Math.min(52, Math.floor(segments)));
  const span = Math.max(1, daysBetween(startsOn, endsOn));
  const total = Math.max(0, totalUnits);

  // Split to two decimals rather than to whole units. Five juz across ten
  // months is half a juz a month; rounded to integers the remainder used
  // to pile into the earliest segments, giving one juz a month from
  // September to January and zero afterwards — a plan that reads
  // "complete" in February when the school meant June.
  //
  // Cumulative rather than per-segment, so the two-decimal rounding cannot
  // drift: each target is the difference between two rounded running
  // totals, which makes the segments sum to exactly `total` however
  // awkwardly it divides.
  const at = (i: number) => Math.round(((total * i) / count) * 100) / 100;

  const out: Array<Pick<Milestone, "sequence" | "starts_on" | "due_on" | "target_units">> = [];
  for (let i = 0; i < count; i++) {
    const from = i === 0 ? startsOn : addDays(startsOn, Math.round((span * i) / count) + 1);
    const to = i === count - 1 ? endsOn : addDays(startsOn, Math.round((span * (i + 1)) / count));
    out.push({
      sequence: i + 1,
      starts_on: from,
      due_on: to,
      target_units: Math.round((at(i + 1) - at(i)) * 100) / 100,
    });
  }
  return out;
}
