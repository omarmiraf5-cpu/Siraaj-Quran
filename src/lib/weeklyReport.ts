import "server-only";

import type { Db } from "@/lib/attendanceServer";
import { addDays } from "@/lib/planDates";
import { localClock } from "@/lib/attendanceRules";
import { formatRange } from "@/lib/mushafPlan";
import { gradeLabel } from "@/lib/grades";
import { isQaidahBookId, qaidahBook, qaidahLesson } from "@/data/qaidah";
import { DAILY_RATING_LABELS } from "@/data/demo";
import type { DailyRating } from "@/hooks/useQuranicAssignments";
import { BADGE_LABELS, STAR_REASON_LABELS, type BadgeKind, type StarReason } from "@/data/awards";

// A school's week, as its weekly progress report tells it: for each child,
// what their teachers recorded — recitations heard, Qa'idah lessons, class
// work, stars — beside their attendance. A child is reported on only when
// there's learning to report: one kept for attendance alone has none, and
// is left out without anyone having to say so.

/** A week of the school's own dates, first and last day included. */
export interface WeekRange {
  from: string;
  to: string;
}

/** The week a report sent now covers: the seven days before today, where the school is. */
export function reportWeek(timeZone: string, now: Date = new Date()): WeekRange {
  const today = localClock(now, timeZone).date;
  return { from: addDays(today, -7), to: addDays(today, -1) };
}

/** The week the coming Friday's report will cover — for the office's preview. */
export function upcomingWeek(timeZone: string, now: Date = new Date()): WeekRange {
  const today = localClock(now, timeZone).date;
  const weekday = new Date(`${today}T12:00:00Z`).getUTCDay();
  const friday = addDays(today, (5 - weekday + 7) % 7);
  return { from: addDays(friday, -7), to: addDays(friday, -1) };
}

/** "2–8 October 2026", or "28 September – 4 October 2026". */
export function weekLabel(range: WeekRange): string {
  const parts = (d: string) => {
    const date = new Date(`${d}T12:00:00Z`);
    return {
      day: date.getUTCDate(),
      month: date.toLocaleString("en-GB", { month: "long", timeZone: "UTC" }),
      year: date.getUTCFullYear(),
    };
  };
  const a = parts(range.from);
  const b = parts(range.to);
  if (a.year !== b.year) return `${a.day} ${a.month} ${a.year} – ${b.day} ${b.month} ${b.year}`;
  if (a.month !== b.month) return `${a.day} ${a.month} – ${b.day} ${b.month} ${b.year}`;
  return `${a.day}–${b.day} ${b.month} ${b.year}`;
}

const PORTION: Record<string, string> = { new: "New lesson", recent: "Recent revision", old: "Old revision" };
const ALERT: Record<string, string> = {
  behind_schedule: "Behind the pace of their yearly plan",
  milestone_overdue: "Past a date in their yearly plan",
  no_recent_progress: "No new progress on their yearly plan lately",
  ending_incomplete: "Unlikely to finish their yearly plan by its end date",
};

export interface StudentWeek {
  id: string;
  name: string;
  /** "North · Grade 3 · Halaqa A", or just "Halaqa A". */
  place: string | null;
  attendance: { present: number; late: number; absent: number; excused: number };
  /** Each recitation heard this week, in order. */
  recitations: Array<{ date: string; portion: string; range: string; rating: string }>;
  /** The latest of their teacher's notes this week. */
  note: string | null;
  qaidah: { book: string; passed: number[]; now: { lesson: number; title: string } | null } | null;
  classWork: Array<{ title: string; subject: string; status: "submitted" | "graded"; score: number | null; max: number }>;
  stars: string[];
  badges: string[];
  /** What their yearly plan's open alerts say. */
  alerts: string[];
  /** Why they aren't reported on, when they aren't: switched off, or nothing recorded. */
  skipped: null | "switched_off" | "nothing_recorded";
}

export interface ParentReport {
  id: string;
  name: string;
  email: string;
  children: StudentWeek[];
}

export interface SchoolWeek {
  school: { id: string; name: string; timeZone: string; on: boolean };
  range: WeekRange;
  /** Every active student: reported on, or with why not. */
  students: StudentWeek[];
  parents: ParentReport[];
  office: Array<{ id: string; name: string; email: string }>;
}

type Row = Record<string, unknown>;
const str = (v: unknown) => (v == null ? "" : String(v));

/** Every row a query has, a thousand at a time: PostgREST hands out no more at once. */
async function every(page: (from: number, to: number) => PromiseLike<{ data: unknown; error: unknown }>): Promise<Row[]> {
  const out: Row[] = [];
  for (let i = 0; ; i += 1000) {
    const { data, error } = await page(i, i + 999);
    if (error) throw error;
    const rows = (data ?? []) as Row[];
    out.push(...rows);
    if (rows.length < 1000) return out;
  }
}

/** A list too long for one request's address, asked for a hundred at a time. */
async function inChunks(ids: string[], ask: (chunk: string[]) => PromiseLike<{ data: unknown; error: unknown }>): Promise<Row[]> {
  const out: Row[] = [];
  for (let i = 0; i < ids.length; i += 100) {
    const { data, error } = await ask(ids.slice(i, i + 100));
    if (error) throw error;
    out.push(...((data ?? []) as Row[]));
  }
  return out;
}

/**
 * Everything a school's week needs, read with the service role — the
 * weekly job has no one signed in — and kept to this school alone.
 */
export async function loadSchoolWeek(admin: Db, schoolId: string, rangeFor: (timeZone: string) => WeekRange): Promise<SchoolWeek> {
  const { data: school, error: schoolError } = await admin.from("schools").select("id, name, timezone").eq("id", schoolId).single();
  if (schoolError) throw schoolError;
  const timeZone = str(school.timezone) || "America/Edmonton";
  const range = rangeFor(timeZone);
  // A day either side, then each row placed on its own date where the school is.
  const since = `${addDays(range.from, -1)}T00:00:00Z`;
  const inWeek = (when: unknown) => {
    if (!when) return false;
    const day = localClock(String(when), timeZone).date;
    return day >= range.from && day <= range.to;
  };

  // The switches, once the weekly reports update has been run; on until then.
  const { data: switches } = await admin.from("schools").select("weekly_reports").eq("id", schoolId).maybeSingle();
  const on = (switches as Row | null)?.weekly_reports !== false;

  const studentsFirst = await admin.from("students").select("id, full_name, grade, active, weekly_report").eq("school_id", schoolId).order("full_name");
  const studentRows = (
    studentsFirst.error
      ? ((await admin.from("students").select("id, full_name, grade, active").eq("school_id", schoolId).order("full_name")).data ?? [])
      : studentsFirst.data ?? []
  ) as Row[];
  const students = studentRows.filter((s) => s.active !== false);
  const ids = students.map((s) => String(s.id));

  const [halaqaRows, campusRows, graded, attendance, recitations, qaidah, submissions, stars, badges, alerts, admins] = await Promise.all([
    admin.from("classes").select("id, name, grade, campus_id").eq("school_id", schoolId).then((r) => (r.error ? admin.from("classes").select("id, name, grade").eq("school_id", schoolId) : r)),
    admin.from("campuses").select("id, name").eq("school_id", schoolId),
    admin.from("schools").select("organised_by_grade").eq("id", schoolId).maybeSingle(),
    every((a, b) => admin.from("attendance").select("id, student_id, class_date, status").eq("school_id", schoolId).gte("class_date", range.from).lte("class_date", range.to).order("id").range(a, b)),
    every((a, b) =>
      admin
        .from("recitation_log")
        .select("id, student_id, portion, surah, ayah_start, surah_end, ayah_end, rating, notes, session_date, created_at")
        .eq("school_id", schoolId)
        .gte("session_date", range.from)
        .lte("session_date", range.to)
        .order("id")
        .range(a, b)
    ),
    // Every Qa'idah lesson, not just this week's: the one they're on now may be older.
    every((a, b) => admin.from("qaidah_assignments").select("id, student_id, book, lesson, status, assigned_at, passed_at, updated_at").eq("school_id", schoolId).order("id").range(a, b)),
    every((a, b) =>
      admin
        .from("subject_submissions")
        .select("id, assignment_id, student_id, status, score, submitted_at, graded_at, updated_at")
        .eq("school_id", schoolId)
        .gte("updated_at", since)
        .order("id")
        .range(a, b)
    ),
    every((a, b) => admin.from("student_stars").select("id, student_id, reason, created_at").eq("school_id", schoolId).gte("created_at", since).order("id").range(a, b)),
    every((a, b) => admin.from("student_badges").select("id, student_id, badge, created_at").eq("school_id", schoolId).gte("created_at", since).order("id").range(a, b)),
    every((a, b) => admin.from("yearly_plan_alerts").select("id, student_id, code, resolved_on").eq("school_id", schoolId).is("resolved_on", null).order("id").range(a, b)),
    admin.from("profiles").select("id, full_name, email, active").eq("school_id", schoolId).eq("role", "admin"),
  ]);

  // Where each child is: their halaqa, in its grade and campus where the school has them.
  const byGrade = (graded.data as Row | null)?.organised_by_grade === true;
  const halaqas = (halaqaRows.data ?? []) as Row[];
  const campuses = new Map(((campusRows.error ? [] : campusRows.data) ?? []).map((c: Row) => [String(c.id), String(c.name)]));
  const enrolments = halaqas.length
    ? await inChunks(halaqas.map((h) => String(h.id)), (chunk) => admin.from("class_enrollments").select("class_id, student_id").in("class_id", chunk))
    : [];
  const placeOf = new Map<string, string>();
  for (const e of enrolments) {
    const h = halaqas.find((x) => x.id === e.class_id);
    if (!h || placeOf.has(String(e.student_id))) continue;
    placeOf.set(
      String(e.student_id),
      [campuses.get(str(h.campus_id)), byGrade ? gradeLabel(Number(h.grade)) : null, str(h.name)].filter(Boolean).join(" · ")
    );
  }

  const assignmentIds = [...new Set(submissions.map((s) => String(s.assignment_id)))];
  const assignments = new Map(
    (assignmentIds.length
      ? await inChunks(assignmentIds, (chunk) => admin.from("subject_assignments").select("id, title, subject, max_points").in("id", chunk))
      : []
    ).map((a) => [String(a.id), a])
  );

  const group = (rows: Row[]) => {
    const m = new Map<string, Row[]>();
    for (const r of rows) m.set(String(r.student_id), [...(m.get(String(r.student_id)) ?? []), r]);
    return m;
  };
  const [att, rec, qai, sub, sta, bad, ale] = [attendance, recitations, qaidah, submissions, stars, badges, alerts].map(group);

  const weeks: StudentWeek[] = students.map((s) => {
    const id = String(s.id);
    const tally = { present: 0, late: 0, absent: 0, excused: 0 };
    for (const a of att.get(id) ?? []) if (str(a.status) in tally) tally[str(a.status) as keyof typeof tally]++;

    const heard = [...(rec.get(id) ?? [])].sort((a, b) => str(a.session_date).localeCompare(str(b.session_date)) || str(a.created_at).localeCompare(str(b.created_at)));
    const note = [...heard].reverse().find((r) => str(r.notes).trim())?.notes;

    const lessons = qai.get(id) ?? [];
    const qaidahWeek = lessons.filter((l) => inWeek(l.assigned_at) || inWeek(l.passed_at) || inWeek(l.updated_at));
    const current = [...lessons]
      .filter((l) => l.status !== "passed")
      .sort((a, b) => str(b.assigned_at).localeCompare(str(a.assigned_at)))[0];
    const bookId = str(current?.book ?? qaidahWeek[0]?.book);
    const qaidahSummary =
      qaidahWeek.length && isQaidahBookId(bookId)
        ? {
            book: qaidahBook(bookId).name,
            passed: qaidahWeek
              .filter((l) => l.status === "passed" && inWeek(l.passed_at) && l.book === bookId)
              .map((l) => Number(l.lesson))
              .sort((a, b) => a - b),
            now: current
              ? { lesson: Number(current.lesson), title: qaidahLesson(bookId, Number(current.lesson))?.title ?? "" }
              : null,
          }
        : null;

    // Marked work first, then work waiting to be marked, each in the order it happened.
    const work = (sub.get(id) ?? [])
      .filter((w) => (w.status === "graded" && inWeek(w.graded_at)) || (w.status !== "assigned" && inWeek(w.submitted_at)))
      .sort(
        (a, b) =>
          Number(b.status === "graded") - Number(a.status === "graded") ||
          str(a.graded_at ?? a.submitted_at).localeCompare(str(b.graded_at ?? b.submitted_at))
      )
      .map((w) => {
        const a = assignments.get(String(w.assignment_id));
        return {
          title: str(a?.title) || "Class work",
          subject: a?.subject === "arabic" ? "Arabic" : "Islamic Studies",
          status: (w.status === "graded" ? "graded" : "submitted") as "graded" | "submitted",
          score: w.status === "graded" && w.score != null ? Number(w.score) : null,
          max: Number(a?.max_points ?? 0),
        };
      });

    const starsWeek = (sta.get(id) ?? []).filter((x) => inWeek(x.created_at)).map((x) => STAR_REASON_LABELS[str(x.reason) as StarReason] ?? "A star");
    const badgesWeek = (bad.get(id) ?? []).filter((x) => inWeek(x.created_at)).map((x) => BADGE_LABELS[str(x.badge) as BadgeKind] ?? "A badge");
    const learned = heard.length > 0 || qaidahWeek.length > 0 || work.length > 0 || starsWeek.length > 0 || badgesWeek.length > 0;

    return {
      id,
      name: str(s.full_name),
      place: placeOf.get(id) ?? null,
      attendance: tally,
      recitations: heard.map((r) => ({
        date: str(r.session_date),
        portion: PORTION[str(r.portion)] ?? "Recitation",
        range: formatRange({ surah: Number(r.surah), ayah: Number(r.ayah_start) }, { surah: Number(r.surah_end), ayah: Number(r.ayah_end) }),
        rating: DAILY_RATING_LABELS[str(r.rating) as DailyRating] ?? "",
      })),
      note: note ? str(note).trim().slice(0, 300) : null,
      qaidah: qaidahSummary,
      classWork: work,
      stars: starsWeek,
      badges: badgesWeek,
      alerts: [...new Set((ale.get(id) ?? []).map((a) => ALERT[str(a.code)]).filter(Boolean))],
      skipped: s.weekly_report === false ? "switched_off" : learned ? null : "nothing_recorded",
    };
  });

  // Each parent, with those of their children reported on this week.
  const reported = new Map(weeks.filter((w) => !w.skipped).map((w) => [w.id, w]));
  const links = reported.size
    ? await inChunks([...reported.keys()], (chunk) => admin.from("parent_students").select("parent_id, student_id").in("student_id", chunk))
    : [];
  const parentIds = [...new Set(links.map((l) => String(l.parent_id)))];
  const parentRows = parentIds.length
    ? await inChunks(parentIds, (chunk) => admin.from("profiles").select("id, full_name, email, active, role, school_id").in("id", chunk))
    : [];
  const parents: ParentReport[] = parentRows
    .filter((p) => p.role === "parent" && p.active !== false && p.school_id === schoolId && str(p.email).includes("@"))
    .map((p) => ({
      id: String(p.id),
      name: str(p.full_name),
      email: str(p.email),
      children: links
        .filter((l) => l.parent_id === p.id)
        .map((l) => reported.get(String(l.student_id))!)
        .filter(Boolean)
        .sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .filter((p) => p.children.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    school: { id: schoolId, name: str(school.name), timeZone, on },
    range,
    students: weeks,
    parents,
    office: ((admins.data ?? []) as Row[])
      .filter((a) => a.active !== false && str(a.email).includes("@"))
      .map((a) => ({ id: String(a.id), name: str(a.full_name), email: str(a.email) })),
  };
}
