import type { createClient } from "@/lib/supabase/client";

// The school's students as the office can see them, for a spreadsheet:
// each one's halaqa(s) and the parents linked to them. Read a thousand rows
// at a time, however big the school.

type Db = ReturnType<typeof createClient>;

export interface RosterStudent {
  id: string;
  name: string;
  grade: number | null;
  active: boolean;
  pin: string | null;
  halaqas: Array<{ name: string; grade: number | null; campusId: string | null }>;
  parents: Array<{ name: string; email: string }>;
}

export async function allRows<T>(page: (from: number, to: number) => PromiseLike<{ data: unknown }>): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; ; i += 1000) {
    const { data } = await page(i, i + 999);
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < 1000) return out;
  }
}

export async function loadRoster(supabase: Db): Promise<RosterStudent[]> {
  const [students, classes, enrolments, links, parents] = await Promise.all([
    allRows<{ id: string; full_name: string; grade: number | null; active: boolean; pin: string | null }>((a, b) =>
      supabase.from("students").select("id, full_name, grade, active, pin").order("full_name").range(a, b)
    ),
    allRows<{ id: string; name: string; grade: number | null; campus_id?: string | null }>((a, b) =>
      supabase.from("classes").select("*").order("name").range(a, b)
    ),
    allRows<{ student_id: string; class_id: string }>((a, b) => supabase.from("class_enrollments").select("student_id, class_id").range(a, b)),
    allRows<{ parent_id: string; student_id: string }>((a, b) => supabase.from("parent_students").select("parent_id, student_id").range(a, b)),
    allRows<{ id: string; full_name: string; email: string | null }>((a, b) =>
      supabase.from("profiles").select("id, full_name, email").eq("role", "parent").range(a, b)
    ),
  ]);
  const classById = new Map(classes.map((c) => [c.id, c]));
  const parentById = new Map(parents.map((p) => [p.id, p]));
  return students.map((s) => ({
    id: s.id,
    name: s.full_name,
    grade: s.grade,
    active: s.active !== false,
    pin: s.pin,
    halaqas: enrolments
      .filter((e) => e.student_id === s.id)
      .map((e) => classById.get(e.class_id))
      .filter((c): c is NonNullable<typeof c> => !!c)
      .map((c) => ({ name: c.name, grade: c.grade ?? null, campusId: c.campus_id ?? null })),
    parents: links
      .filter((l) => l.student_id === s.id)
      .map((l) => parentById.get(l.parent_id))
      .filter((p): p is NonNullable<typeof p> => !!p)
      .map((p) => ({ name: p.full_name, email: p.email ?? "" })),
  }));
}
