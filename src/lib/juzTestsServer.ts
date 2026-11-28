import "server-only";

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isProgramHalaqa } from "@/lib/programHalaqa";
import { addDays } from "@/lib/planDates";
import type { SchoolCalendar } from "@/lib/schoolCalendar";
import {
  isError,
  loadSchoolSettings,
  requireMember,
  schoolToday,
  type Db,
  type Member,
} from "@/lib/attendanceServer";
import { DEFAULT_DAILY_TESTS, type JuzMistake, type JuzTest, type TestDayOverrides } from "@/lib/juzTests";

/**
 * Who is asking about Juz tests, and how their school runs them. Every
 * route reads and writes through the service role once this has said who
 * the caller is: the office and examiners see the whole school's tests, a
 * teacher their own students', a parent their own children's.
 */
export interface JuzContext {
  me: Member;
  admin: Db;
  /** The office, or a teacher the office made an examiner. */
  examiner: boolean;
  enabled: boolean;
  /** Tests a day. */
  slots: number;
  today: string;
  cal: SchoolCalendar;
  overrides: TestDayOverrides;
}

export async function juzContext(
  supabase: Db,
  roles?: Member["role"][]
): Promise<JuzContext | { error: NextResponse }> {
  const me = await requireMember(supabase, roles);
  if (isError(me)) return me;
  const admin = createAdminClient() as unknown as Db;
  const [school, settings, examinerRow, days] = await Promise.all([
    admin.from("schools").select("juz_tests_enabled, juz_test_slots").eq("id", me.school_id).maybeSingle(),
    loadSchoolSettings(supabase, me.school_id),
    me.role === "teacher"
      ? admin.from("juz_test_examiners").select("user_id").eq("school_id", me.school_id).eq("user_id", me.id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    admin.from("juz_test_days").select("date, open").eq("school_id", me.school_id),
  ]);
  const today = schoolToday(settings);
  // Before the update that adds Juz tests, the columns aren't there: off.
  const enabled = !school.error && school.data?.juz_tests_enabled === true;
  const overrides: TestDayOverrides = {};
  for (const d of (days.error ? [] : days.data ?? []) as Array<{ date: string; open: boolean }>) overrides[d.date] = d.open;
  return {
    me,
    admin,
    examiner: me.role === "admin" || (!examinerRow.error && Boolean(examinerRow.data)),
    enabled,
    slots: Number(school.data?.juz_test_slots ?? DEFAULT_DAILY_TESTS) || DEFAULT_DAILY_TESTS,
    today,
    cal: settings.cal,
    overrides,
  };
}

export const notOn = () =>
  NextResponse.json({ error: "Juz tests aren't switched on for this school. The office can turn them on." }, { status: 409 });

export interface StudentInfo {
  id: string;
  name: string;
  halaqa: string | null;
  teacher: string | null;
  active: boolean;
}

/**
 * Each student's name, their own halaqa and its teacher, at a school.
 * Limited to `ids` when given. A child in a Hifd program as well as their
 * own halaqa is shown with their own one.
 */
export async function studentInfo(admin: Db, schoolId: string, ids?: string[]): Promise<Map<string, StudentInfo>> {
  const out = new Map<string, StudentInfo>();
  if (ids && ids.length === 0) return out;
  let q = admin.from("students").select("id, full_name, active").eq("school_id", schoolId);
  if (ids) q = q.in("id", ids);
  const [{ data: students }, { data: classes }] = await Promise.all([
    q,
    admin.from("classes").select("id, name, teacher_id").eq("school_id", schoolId),
  ]);
  const classRows = (classes ?? []) as Array<{ id: string; name: string; teacher_id: string | null }>;
  const studentRows = (students ?? []) as Array<{ id: string; full_name: string; active: boolean | null }>;
  if (studentRows.length === 0) return out;
  const classIds = classRows.map((c) => c.id);
  const [{ data: enrolments }, { data: teachers }] = await Promise.all([
    classIds.length
      ? admin.from("class_enrollments").select("student_id, class_id").in("class_id", classIds).in("student_id", studentRows.map((s) => s.id))
      : Promise.resolve({ data: [] }),
    admin.from("profiles").select("id, full_name").in("id", [...new Set(classRows.map((c) => c.teacher_id).filter(Boolean))] as string[]),
  ]);
  const teacherName = new Map(((teachers ?? []) as Array<{ id: string; full_name: string }>).map((t) => [t.id, t.full_name]));
  const classById = new Map(classRows.map((c) => [c.id, c]));
  const own = new Map<string, { name: string; teacher_id: string | null }>();
  for (const e of (enrolments ?? []) as Array<{ student_id: string; class_id: string }>) {
    const c = classById.get(e.class_id);
    if (!c) continue;
    const have = own.get(e.student_id);
    // Their own halaqa over a program they're in as well.
    if (!have || (isProgramHalaqa(have.name) && !isProgramHalaqa(c.name))) own.set(e.student_id, c);
  }
  for (const s of studentRows) {
    const h = own.get(s.id);
    out.set(s.id, {
      id: s.id,
      name: s.full_name,
      halaqa: h?.name ?? null,
      teacher: h?.teacher_id ? teacherName.get(h.teacher_id) ?? null : null,
      active: s.active !== false,
    });
  }
  return out;
}

/** The students in the halaqas someone teaches at their school, as their lead or alongside. */
export async function taughtStudentIds(admin: Db, userId: string, schoolId: string): Promise<Set<string>> {
  const [{ data: leads }, { data: shares }] = await Promise.all([
    admin.from("classes").select("id").eq("school_id", schoolId).eq("teacher_id", userId),
    admin.from("class_teachers").select("class_id").eq("teacher_id", userId),
  ]);
  const classIds = new Set<string>([
    ...((leads ?? []) as Array<{ id: string }>).map((c) => c.id),
    ...((shares ?? []) as Array<{ class_id: string }>).map((c) => c.class_id),
  ]);
  if (classIds.size === 0) return new Set();
  // A shared halaqa's class can be at another school the teacher also teaches at.
  const { data: here } = await admin.from("classes").select("id").eq("school_id", schoolId).in("id", [...classIds]);
  const ids = ((here ?? []) as Array<{ id: string }>).map((c) => c.id);
  if (ids.length === 0) return new Set();
  const { data: rows } = await admin.from("class_enrollments").select("student_id").in("class_id", ids);
  return new Set(((rows ?? []) as Array<{ student_id: string }>).map((r) => r.student_id));
}

/** The children linked to a parent. */
export async function childIds(admin: Db, parentId: string): Promise<Set<string>> {
  const { data } = await admin.from("parent_students").select("student_id").eq("parent_id", parentId);
  return new Set(((data ?? []) as Array<{ student_id: string }>).map((r) => r.student_id));
}

/** Whether the caller may see this student's tests. */
export async function maySee(ctx: JuzContext, studentId: string): Promise<boolean> {
  if (ctx.examiner) return true;
  if (ctx.me.role === "teacher" && (await taughtStudentIds(ctx.admin, ctx.me.id, ctx.me.school_id)).has(studentId)) return true;
  // A teacher or admin can be a parent here too.
  return (await childIds(ctx.admin, ctx.me.id)).has(studentId);
}

const TEST_COLUMNS =
  "id, student_id, juz, test_date, slot, result, comment, examiner_id, tested_at, cancelled_at, created_at";

type TestRow = Omit<JuzTest, "student_name" | "teacher_name" | "examiner_name" | "mistakes"> & {
  examiner_id: string | null;
};

/** Tests with the names people read them by, and how many mistakes each has. */
export async function withNames(admin: Db, schoolId: string, rows: TestRow[]): Promise<JuzTest[]> {
  if (rows.length === 0) return [];
  const [students, { data: examiners }, { data: mistakes }] = await Promise.all([
    studentInfo(admin, schoolId, [...new Set(rows.map((r) => r.student_id))]),
    admin.from("profiles").select("id, full_name").in("id", [...new Set(rows.map((r) => r.examiner_id).filter(Boolean))] as string[]),
    admin.from("juz_test_mistakes").select("test_id").in("test_id", rows.map((r) => r.id)),
  ]);
  const examinerName = new Map(((examiners ?? []) as Array<{ id: string; full_name: string }>).map((p) => [p.id, p.full_name]));
  const count = new Map<string, number>();
  for (const m of (mistakes ?? []) as Array<{ test_id: string }>) count.set(m.test_id, (count.get(m.test_id) ?? 0) + 1);
  return rows.map(({ examiner_id, ...r }) => ({
    ...r,
    student_name: students.get(r.student_id)?.name ?? "A student",
    teacher_name: students.get(r.student_id)?.teacher ?? null,
    examiner_name: examiner_id ? examinerName.get(examiner_id) ?? null : null,
    mistakes: count.get(r.id) ?? 0,
  }));
}

/** A school's tests on one day, in their numbered order. */
export async function testsOnDay(admin: Db, schoolId: string, date: string): Promise<JuzTest[]> {
  const { data, error } = await admin
    .from("juz_tests")
    .select(TEST_COLUMNS)
    .eq("school_id", schoolId)
    .eq("test_date", date)
    .is("cancelled_at", null)
    .order("slot");
  if (error) throw error;
  return withNames(admin, schoolId, (data ?? []) as TestRow[]);
}

/** Every test of these students since `since` (and all to come), newest day first. */
export async function testsOf(admin: Db, schoolId: string, studentIds: string[], since?: string): Promise<JuzTest[]> {
  if (studentIds.length === 0) return [];
  let q = admin
    .from("juz_tests")
    .select(TEST_COLUMNS)
    .eq("school_id", schoolId)
    .in("student_id", studentIds)
    .is("cancelled_at", null);
  if (since) q = q.gte("test_date", since);
  const { data, error } = await q.order("test_date", { ascending: false }).order("slot");
  if (error) throw error;
  return withNames(admin, schoolId, (data ?? []) as TestRow[]);
}

export async function oneTest(admin: Db, id: string): Promise<(TestRow & { school_id: string }) | null> {
  const { data } = await admin.from("juz_tests").select(`${TEST_COLUMNS}, school_id`).eq("id", id).maybeSingle();
  return (data as (TestRow & { school_id: string }) | null) ?? null;
}

export async function mistakesOf(admin: Db, testIds: string[]): Promise<Map<string, JuzMistake[]>> {
  const out = new Map<string, JuzMistake[]>();
  if (testIds.length === 0) return out;
  const { data, error } = await admin
    .from("juz_test_mistakes")
    .select("id, test_id, kind, page, surah, ayah, word, note")
    .in("test_id", testIds)
    .order("surah")
    .order("ayah")
    .order("word");
  if (error) throw error;
  for (const { test_id, ...m } of (data ?? []) as Array<JuzMistake & { test_id: string }>) {
    if (!out.has(test_id)) out.set(test_id, []);
    out.get(test_id)!.push(m);
  }
  return out;
}

/** How far back a teacher's page lists results. */
export const RESULTS_WINDOW_DAYS = 60;
export const sinceDays = (today: string, days: number) => addDays(today, -days);
