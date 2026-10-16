import type { createClient } from "@/lib/supabase/client";
import { sessionUser } from "@/lib/supabase/sessionUser";
import { gradeLabel } from "@/lib/grades";
import { loadCampuses } from "@/lib/schoolStructure";

type Db = ReturnType<typeof createClient>;

/**
 * The children a teacher's pages show: those in the halaqas they teach,
 * each with where that is — "Halaqa A", or "Grade 3 · North · Halaqa A" in
 * an academic school. The register, lessons and messages are for a
 * teacher's own children, never the whole school's: an admin who teaches
 * could otherwise see every child, since the office's own rules let them.
 * Empty for a teacher with no halaqa yet; null only when nobody is signed in.
 */
export async function myHalaqaStudents(supabase: Db): Promise<Map<string, string> | null> {
  const halaqas = await myHalaqas(supabase);
  if (!halaqas) return null;
  const mine = new Map<string, string>();
  for (const h of halaqas) for (const id of h.studentIds) if (!mine.has(id)) mine.set(id, h.label);
  return mine;
}

export interface MyHalaqa {
  id: string;
  label: string;
  studentIds: string[];
  /** In a school kept in grades: the grade it's for, and its campus's name. */
  grade?: number | null;
  campus?: string | null;
}

/**
 * The halaqas a teacher teaches at the school they're in, each with its
 * label and its children — so a register can be taken one halaqa at a
 * time. Empty for a teacher with no halaqa yet; null when nobody is signed in.
 */
export async function myHalaqas(supabase: Db): Promise<MyHalaqa[] | null> {
  const user = await sessionUser(supabase);
  if (!user) return null;
  // Everything in one round of requests side by side: their school (and
  // whether it keeps grades), the halaqas they lead and share, each with its
  // children. Asked step by step instead, as below, that was four round
  // trips one after another before a teacher's dashboard could show.
  const COLS = "id, name, grade, campus_id, school_id, class_enrollments(student_id)";
  type Row = { id: string; name: string; grade?: number; campus_id?: string | null; school_id: string; class_enrollments?: { student_id: string }[] };
  const [meRes, leadRes, shareRes, campuses] = await Promise.all([
    supabase.from("profiles").select("school_id, schools!profiles_school_id_fkey(organised_by_grade)").eq("id", user.id).maybeSingle(),
    supabase.from("classes").select(COLS).eq("teacher_id", user.id),
    supabase.from("class_teachers").select(`class_id, classes(${COLS})`).eq("teacher_id", user.id),
    loadCampuses(supabase),
  ]);
  // A database from before the grades update can't answer this in one go.
  if (meRes.error || leadRes.error || shareRes.error) return myHalaqasStepByStep(supabase, user.id);
  const me = meRes.data as { school_id: string | null; schools: { organised_by_grade?: boolean } | { organised_by_grade?: boolean }[] | null } | null;
  if (!me?.school_id) return null;
  const schoolRow = Array.isArray(me.schools) ? me.schools[0] : me.schools;
  const graded = schoolRow?.organised_by_grade === true;
  const rows: Row[] = [
    ...((leadRes.data ?? []) as unknown as Row[]),
    ...((shareRes.data ?? []) as unknown as Array<{ classes: Row | Row[] | null }>).flatMap((x) => (Array.isArray(x.classes) ? x.classes : x.classes ? [x.classes] : [])),
  ];
  const groups = new Map<string, MyHalaqa>();
  for (const h of rows) {
    // Their halaqas at the school they're in now.
    if (h.school_id !== me.school_id || groups.has(h.id)) continue;
    const label = graded
      ? [gradeLabel(h.grade as number), campuses.find((c) => c.id === h.campus_id)?.name, h.name].filter(Boolean).join(" · ")
      : h.name;
    groups.set(h.id, {
      id: h.id,
      label,
      studentIds: [...new Set((h.class_enrollments ?? []).map((e) => e.student_id))],
      grade: graded ? h.grade ?? null : null,
      campus: graded ? campuses.find((c) => c.id === h.campus_id)?.name ?? null : null,
    });
  }
  return [...groups.values()].sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
}

/** The same, a step at a time — for a database that can't do it in one. */
async function myHalaqasStepByStep(supabase: Db, userId: string): Promise<MyHalaqa[] | null> {
  const user = { id: userId };
  const { data: me } = await supabase.from("profiles").select("school_id").eq("id", user.id).maybeSingle();
  if (!me?.school_id) return null;
  // Before the grades update there's no such column: a Qur'an school.
  const { data: school, error } = await supabase.from("schools").select("organised_by_grade").eq("id", me.school_id).maybeSingle();
  const graded = !error && school?.organised_by_grade === true;

  // Their halaqas at the school they're in now.
  const [{ data: leads }, { data: shares }] = await Promise.all([
    supabase.from("classes").select("id").eq("teacher_id", user.id).eq("school_id", me.school_id),
    supabase.from("class_teachers").select("class_id").eq("teacher_id", user.id),
  ]);
  const ids = [...new Set([...(leads ?? []).map((c) => c.id as string), ...(shares ?? []).map((c) => c.class_id as string)])];
  if (ids.length === 0) return [];

  const [{ data: halaqas }, { data: enrolments }, campuses] = await Promise.all([
    graded
      ? supabase.from("classes").select("id, name, grade, campus_id, school_id").in("id", ids)
      : supabase.from("classes").select("id, name, school_id").in("id", ids),
    supabase.from("class_enrollments").select("class_id, student_id").in("class_id", ids),
    graded ? loadCampuses(supabase) : Promise.resolve([]),
  ]);
  const groups = new Map<string, MyHalaqa>();
  for (const h of (halaqas ?? []) as Array<{ id: string; name: string; grade?: number; campus_id?: string | null; school_id: string }>) {
    if (h.school_id !== me.school_id) continue;
    const campus = graded ? campuses.find((c) => c.id === h.campus_id)?.name ?? null : null;
    groups.set(h.id, {
      id: h.id,
      label: graded ? [gradeLabel(h.grade as number), campus, h.name].filter(Boolean).join(" · ") : h.name,
      studentIds: [],
      grade: graded ? h.grade ?? null : null,
      campus,
    });
  }
  for (const e of enrolments ?? []) {
    const g = groups.get(e.class_id as string);
    if (g && !g.studentIds.includes(e.student_id as string)) g.studentIds.push(e.student_id as string);
  }
  return [...groups.values()].sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
}

/** Just the children in `mine`, labelled with their halaqa; all of them, as they were, when it's null. */
export function narrowToMine<T extends { id: string; halaqa: string }>(students: T[], mine: Map<string, string> | null): T[] {
  if (!mine) return students;
  return students.filter((s) => mine.has(s.id)).map((s) => ({ ...s, halaqa: mine.get(s.id)! }));
}
