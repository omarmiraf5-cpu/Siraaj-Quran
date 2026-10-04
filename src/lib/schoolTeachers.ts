import type { createClient } from "@/lib/supabase/client";
import type { DemoHalaqa, DemoTeacher } from "@/data/demo";

type Db = ReturnType<typeof createClient>;

/**
 * The school's teachers as the office sees them: everyone with a teacher's
 * login, and an admin who teaches too — with their admin login, since a
 * person has the one. Only an admin who already teaches a halaqa is listed,
 * unless `everyAdmin`: choosing a halaqa's teachers offers them all.
 */
export async function loadSchoolTeachers(supabase: Db, { everyAdmin = false } = {}): Promise<DemoTeacher[]> {
  const [{ data: people }, { data: leads }, { data: others }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, email, active, role").in("role", ["teacher", "admin"]).order("full_name"),
    supabase.from("classes").select("teacher_id"),
    // A database without class_teachers yet answers with an error here.
    supabase.from("class_teachers").select("teacher_id"),
  ]);
  const teaching = new Set([...(leads ?? []), ...(others ?? [])].map((r) => r.teacher_id as string | null));
  return (people ?? [])
    .filter((p) => p.role === "teacher" || everyAdmin || teaching.has(p.id))
    .map((p) => ({
      id: p.id,
      name: p.full_name,
      email: p.email ?? "",
      active: p.active,
      ...(p.role === "admin" ? { admin: true } : {}),
    }));
}

/** Its first teacher (kept if still ticked) and the others, from the teachers ticked. */
export function splitTeachers(ids: string[], current: string | null): { lead: string | null; others: string[] } {
  const lead = current && ids.includes(current) ? current : ids[0] ?? null;
  return { lead, others: ids.filter((id) => id !== lead) };
}

/**
 * A halaqa's other teachers, exactly these. Through the office's server
 * route: one of them can be an admin who teaches, and the office's own
 * session may add only teachers' logins.
 */
export async function saveOtherTeachers(classId: string, teacherIds: string[]): Promise<void> {
  const res = await fetch("/api/admin/halaqa-teachers", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ class_id: classId, teacher_ids: teacherIds }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "Couldn't save the halaqa's teachers");
  }
}

/** Everyone in `ids` teaches the halaqa: the first on the halaqa itself, the rest alongside. */
export async function saveHalaqaTeachers(
  supabase: Db,
  h: Pick<DemoHalaqa, "id" | "teacherId" | "coTeacherIds">,
  ids: string[]
): Promise<void> {
  const { lead, others } = splitTeachers(ids, h.teacherId);
  if (lead !== h.teacherId) {
    const { error } = await supabase.from("classes").update({ teacher_id: lead }).eq("id", h.id);
    if (error) throw error;
  }
  if (others.slice().sort().join() !== (h.coTeacherIds ?? []).slice().sort().join()) {
    await saveOtherTeachers(h.id, others);
  }
}

/** Has the office's menu look again at whether the signed-in admin teaches. */
export function staffRolesChanged() {
  window.dispatchEvent(new Event(STAFF_ROLES_CHANGED));
}
export const STAFF_ROLES_CHANGED = "mydiiwaan:staff-roles";
