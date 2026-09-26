import "server-only";

import type { Db } from "@/lib/attendanceServer";
import type {
  AnswerKey,
  ClassAssignment,
  ClassSubmission,
  Question,
  RosterStudent,
  Subject,
  SubmissionStatus,
} from "@/lib/classWork";

/* eslint-disable @typescript-eslint/no-explicit-any */

export function toAssignment(row: any): ClassAssignment {
  return {
    id: row.id,
    subject: row.subject as Subject,
    title: row.title,
    instructions: row.instructions ?? "",
    questions: (Array.isArray(row.questions) ? row.questions : []) as Question[],
    max_points: Number(row.max_points),
    due_date: row.due_date ?? null,
    created_by: row.created_by ?? "",
    created_at: row.created_at,
  };
}

export function toSubmission(row: any): ClassSubmission {
  return {
    id: row.id,
    assignment_id: row.assignment_id,
    student_id: row.student_id,
    status: row.status as SubmissionStatus,
    answers: row.answers ?? {},
    marks: row.marks ?? {},
    score: row.score === null || row.score === undefined ? null : Number(row.score),
    feedback: row.feedback ?? null,
    submitted_at: row.submitted_at ?? null,
    graded_at: row.graded_at ?? null,
  };
}

/**
 * Every student the caller may set work for, with the halaqa each is in —
 * as far as the caller's own session can see: a teacher, their school's
 * children and their own halaqas; the office, everyone's. Read as three
 * plain queries rather than one embedded select, and joined here.
 */
export async function staffRoster(db: Db): Promise<{ students: RosterStudent[]; halaqas: string[] }> {
  const [{ data: students, error }, { data: classes }, { data: enrollments }] = await Promise.all([
    db.from("students").select("id, full_name, active").eq("active", true).order("full_name"),
    db.from("classes").select("id, name").order("name"),
    db.from("class_enrollments").select("class_id, student_id"),
  ]);
  if (error) throw error;
  const className = new Map<string, string>(((classes ?? []) as any[]).map((c) => [c.id, c.name]));
  const halaqaOf = new Map<string, string>();
  for (const e of (enrollments ?? []) as any[]) {
    const name = className.get(e.class_id);
    if (name && !halaqaOf.has(e.student_id)) halaqaOf.set(e.student_id, name);
  }
  return {
    students: ((students ?? []) as any[]).map((s) => ({ id: s.id, name: s.full_name, halaqa: halaqaOf.get(s.id) ?? "" })),
    halaqas: [...new Set(((classes ?? []) as any[]).map((c) => c.name as string))],
  };
}

/** Full names for these profiles, read with the service role: a child or
 *  parent can't read a teacher's profile, but may see who set their work. */
export async function namesOf(admin: Db, ids: string[]): Promise<Map<string, string>> {
  const wanted = [...new Set(ids.filter(Boolean))];
  if (wanted.length === 0) return new Map();
  const { data } = await admin.from("profiles").select("id, full_name").in("id", wanted);
  return new Map(((data ?? []) as any[]).map((p) => [p.id, p.full_name]));
}

/** The right answers of one assignment, read with the service role. */
export async function keyOf(admin: Db, assignmentId: string): Promise<AnswerKey> {
  const { data } = await admin
    .from("subject_assignment_keys")
    .select("answers")
    .eq("assignment_id", assignmentId)
    .maybeSingle();
  return ((data as any)?.answers ?? {}) as AnswerKey;
}
