import type { createClient } from "@/lib/supabase/client";
import { gradeLabel } from "@/lib/grades";
import { loadCampuses } from "@/lib/schoolStructure";

type Db = ReturnType<typeof createClient>;

/**
 * The children a teacher's pages show in an academic school: those in the
 * halaqas they teach, each with where that is — "Grade 3 · North · Halaqa
 * A". A school of hundreds can't put every child on every teacher's
 * register. Null anywhere else: a Qur'an school's teachers see the school's
 * children, as they always have.
 */
export async function myHalaqaStudents(supabase: Db): Promise<Map<string, string> | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: me } = await supabase.from("profiles").select("school_id").eq("id", user.id).maybeSingle();
  if (!me?.school_id) return null;
  // Before the grades update, there's nothing to ask: every school is a Qur'an school.
  const { data: school, error } = await supabase.from("schools").select("organised_by_grade").eq("id", me.school_id).maybeSingle();
  if (error || school?.organised_by_grade !== true) return null;

  const [{ data: leads }, { data: shares }] = await Promise.all([
    supabase.from("classes").select("id").eq("teacher_id", user.id),
    supabase.from("class_teachers").select("class_id").eq("teacher_id", user.id),
  ]);
  const ids = [...new Set([...(leads ?? []).map((c) => c.id as string), ...(shares ?? []).map((c) => c.class_id as string)])];
  const mine = new Map<string, string>();
  if (ids.length === 0) return mine;

  const [{ data: halaqas }, { data: enrolments }, campuses] = await Promise.all([
    supabase.from("classes").select("id, name, grade, campus_id").in("id", ids),
    supabase.from("class_enrollments").select("class_id, student_id").in("class_id", ids),
    loadCampuses(supabase),
  ]);
  const where = new Map(
    (halaqas ?? []).map((h) => [
      h.id as string,
      [gradeLabel(h.grade as number), campuses.find((c) => c.id === h.campus_id)?.name, h.name as string].filter(Boolean).join(" · "),
    ])
  );
  for (const e of enrolments ?? []) {
    const label = where.get(e.class_id as string);
    if (label && !mine.has(e.student_id as string)) mine.set(e.student_id as string, label);
  }
  return mine;
}

/** Just the children in `mine`, labelled with their halaqa; all of them, as they were, when it's null. */
export function narrowToMine<T extends { id: string; halaqa: string }>(students: T[], mine: Map<string, string> | null): T[] {
  if (!mine) return students;
  return students.filter((s) => mine.has(s.id)).map((s) => ({ ...s, halaqa: mine.get(s.id)! }));
}
