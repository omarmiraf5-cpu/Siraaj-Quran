import "server-only";

import type { Db } from "@/lib/attendanceServer";
import {
  FILE_BUCKET,
  type AnswerKey,
  type ClassAssignment,
  type ClassSubmission,
  type FileRef,
  type Question,
  type RosterStudent,
  type Subject,
  type SubmissionStatus,
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
    attachments: (Array.isArray(row.attachments) ? row.attachments : []) as FileRef[],
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

/* ── Files ─────────────────────────────────────────────────────────── */

/** Where a school's teachers' files go, and where one child's files for one
 *  assignment go. The routes only accept files from under these. */
export const teacherFilesPrefix = (schoolId: string) => `${schoolId}/assignments/`;
export const childFilesPrefix = (schoolId: string, assignmentId: string, studentId: string) =>
  `${schoolId}/answers/${assignmentId}/${studentId}/`;

/**
 * Adds a link to open each of these files, good for an hour — for someone
 * the route has already checked may see them. One call signs the lot; the
 * links are written onto the same objects that go out in the response.
 */
export async function addLinks(admin: Db, files: FileRef[]): Promise<void> {
  const paths = [...new Set(files.map((f) => f.path))];
  if (paths.length === 0) return;
  const { data, error } = await admin.storage.from(FILE_BUCKET).createSignedUrls(paths, 60 * 60);
  if (error || !data) {
    console.error("Class work: could not sign file links", error);
    return;
  }
  const links = new Map<string, string>();
  for (const d of data as Array<{ path: string | null; signedUrl: string | null }>) {
    if (d.path && d.signedUrl) links.set(d.path, d.signedUrl);
  }
  for (const f of files) {
    const url = links.get(f.path);
    if (url) f.url = url;
  }
}

/** Deletes files from storage. Best effort: a file left behind costs a
 *  little space, while failing the delete it belongs to would cost more. */
export async function removeFiles(admin: Db, paths: string[]): Promise<void> {
  const unique = [...new Set(paths)];
  if (unique.length === 0) return;
  const { error } = await admin.storage.from(FILE_BUCKET).remove(unique);
  if (error) console.error("Class work: could not remove files", error);
}
