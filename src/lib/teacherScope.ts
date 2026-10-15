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
}

/**
 * The halaqas a teacher teaches at the school they're in, each with its
 * label and its children — so a register can be taken one halaqa at a
 * time. Empty for a teacher with no halaqa yet; null when nobody is signed in.
 */
export async function myHalaqas(supabase: Db): Promise<MyHalaqa[] | null> {
  const user = await sessionUser(supabase);
  if (!user) return null;
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
  const where = new Map(
    ((halaqas ?? []) as Array<{ id: string; name: string; grade?: number; campus_id?: string | null; school_id: string }>)
      .filter((h) => h.school_id === me.school_id)
      .map((h) => [
        h.id,
        graded
          ? [gradeLabel(h.grade as number), campuses.find((c) => c.id === h.campus_id)?.name, h.name].filter(Boolean).join(" · ")
          : h.name,
      ])
  );
  const groups = new Map<string, MyHalaqa>();
  for (const [id, label] of where) groups.set(id, { id, label, studentIds: [] });
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
