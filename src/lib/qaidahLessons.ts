// Each child's Qa'idah lesson, as a teacher sets it: which book and which
// lesson in it, and whether they've passed it. One row per lesson set
// (qaidah_assignments in schema.sql), so a child's newest row is the lesson
// they're on and the rest is their history.

import type { QaidahBookId } from "@/data/qaidah";

export type QaidahStatus = "assigned" | "passed" | "repeat";

export interface QaidahAssignment {
  id: string;
  student_id: string;
  book: QaidahBookId;
  lesson: number;
  status: QaidahStatus;
  note: string | null;
  teacher_id: string | null;
  assigned_at: string;
  passed_at: string | null;
}

export const QAIDAH_COLUMNS =
  "id, student_id, book, lesson, status, note, teacher_id, assigned_at, passed_at";

export const QAIDAH_STATUSES: QaidahStatus[] = ["assigned", "passed", "repeat"];

/** How long a teacher's note to a child can be. */
export const QAIDAH_NOTE_MAX = 500;

/** Newest first, so a child's first row is the lesson they're on. */
export function newestFirst(rows: QaidahAssignment[]): QaidahAssignment[] {
  return [...rows].sort((a, b) => b.assigned_at.localeCompare(a.assigned_at));
}

/** Each child's current lesson: their newest row. */
export function currentLessons(rows: QaidahAssignment[]): Map<string, QaidahAssignment> {
  const current = new Map<string, QaidahAssignment>();
  for (const row of newestFirst(rows)) {
    if (!current.has(row.student_id)) current.set(row.student_id, row);
  }
  return current;
}

/** The lessons a child has passed in a book. */
export function passedLessons(rows: QaidahAssignment[], studentId: string, book: QaidahBookId): number[] {
  return rows
    .filter((r) => r.student_id === studentId && r.book === book && r.status === "passed")
    .map((r) => r.lesson);
}

/**
 * The table doesn't exist yet: the school's database hasn't had the update
 * that adds it. Postgres says 42P01; Supabase's API, PGRST205.
 */
export function isMissingTable(error: { code?: string } | null | undefined): boolean {
  return error?.code === "42P01" || error?.code === "PGRST205";
}

export const MISSING_TABLE_MESSAGE =
  "Qa'idah lessons need the latest database update. The school's administrator can run it in Supabase.";

/** A teacher's note: trimmed, null when empty, or an error when too long. */
export function readNote(value: unknown): { note: string | null } | { error: string } {
  if (value === undefined || value === null) return { note: null };
  if (typeof value !== "string") return { error: "The note must be text." };
  const note = value.trim();
  if (note.length > QAIDAH_NOTE_MAX) {
    return { error: `Keep the note under ${QAIDAH_NOTE_MAX} characters.` };
  }
  return { note: note || null };
}
