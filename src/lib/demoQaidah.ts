// The sample school's Qa'idah lessons, and whatever a teacher changes in the
// sample portal: kept in this browser, so the student and parent portals
// opened in it show the same lessons. Mirrors /api/qaidah-assignments.

import { nextQaidahLesson, type QaidahBookId } from "@/data/qaidah";
import { readDemoStore, writeDemoStore } from "@/lib/demoStore";
import { newestFirst, type QaidahAssignment, type QaidahStatus } from "@/lib/qaidahLessons";

const KEY = "demo_qaidah_lessons_v1";

function seed(
  id: string,
  studentId: string,
  book: QaidahBookId,
  lesson: number,
  status: QaidahStatus,
  assignedOn: string,
  extra: { note?: string; passedOn?: string } = {}
): QaidahAssignment {
  return {
    id,
    student_id: studentId,
    book,
    lesson,
    status,
    note: extra.note ?? null,
    teacher_id: "t1",
    assigned_at: `${assignedOn}T16:00:00.000Z`,
    passed_at: extra.passedOn ? `${extra.passedOn}T16:30:00.000Z` : null,
  };
}

// Most of the sample children on a lesson, in each of the three books, and
// one (Hawa) with none yet, so every state shows.
const SEED: QaidahAssignment[] = [
  seed("dq-s1-6", "s1", "nuraniyah", 6, "passed", "2026-07-27", { passedOn: "2026-07-31" }),
  seed("dq-s1-7", "s1", "nuraniyah", 7, "passed", "2026-07-31", { passedOn: "2026-08-06" }),
  seed("dq-s1-8", "s1", "nuraniyah", 8, "assigned", "2026-08-06", {
    note: "Read the madd rows twice before you start the leen.",
  }),
  seed("dq-s2-12", "s2", "ahsanul_qawaid", 12, "passed", "2026-08-03", { passedOn: "2026-08-07" }),
  seed("dq-s2-13", "s2", "ahsanul_qawaid", 13, "repeat", "2026-08-07", {
    note: "The waw leen once more, slowly, with no stretch.",
  }),
  seed("dq-s3-5", "s3", "baghdadiyah", 5, "assigned", "2026-08-10"),
  seed("dq-s4-15", "s4", "nuraniyah", 15, "assigned", "2026-08-05"),
  seed("dq-s6-22", "s6", "ahsanul_qawaid", 22, "assigned", "2026-08-11"),
  seed("dq-s7-3", "s7", "nuraniyah", 3, "assigned", "2026-08-12"),
];

export function demoQaidahRows(): QaidahAssignment[] {
  return readDemoStore(KEY, SEED);
}

function save(rows: QaidahAssignment[]) {
  writeDemoStore(KEY, rows);
}

const newId = () => `local-q-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

/** Sets a lesson for each of these children; returns the new rows. */
export function demoSetLesson(
  studentIds: string[],
  book: QaidahBookId,
  lesson: number,
  note: string | null
): QaidahAssignment[] {
  const now = new Date().toISOString();
  const created = studentIds.map((studentId) => ({
    id: newId(),
    student_id: studentId,
    book,
    lesson,
    status: "assigned" as const,
    note,
    teacher_id: "t1",
    assigned_at: now,
    passed_at: null,
  }));
  save([...created, ...demoQaidahRows()]);
  return created;
}

/** As PATCH /api/qaidah-assignments/[id]. */
export function demoUpdateLesson(
  id: string,
  patch: { status?: QaidahStatus; note?: string | null },
  next: boolean
): { lesson: QaidahAssignment; next: QaidahAssignment | null; finished: boolean } | null {
  const rows = demoQaidahRows();
  const before = rows.find((r) => r.id === id);
  if (!before) return null;
  const updated: QaidahAssignment = { ...before, ...patch };
  if (patch.status) {
    updated.passed_at = patch.status === "passed" ? (before.passed_at ?? new Date().toISOString()) : null;
  }
  let nextRow: QaidahAssignment | null = null;
  let finished = false;
  if (patch.status === "passed" && next) {
    const nextLesson = nextQaidahLesson(before.book, before.lesson);
    finished = nextLesson === null;
    const newest = newestFirst(rows.filter((r) => r.student_id === before.student_id))[0];
    if (nextLesson !== null && newest?.id === id) {
      nextRow = {
        id: newId(),
        student_id: before.student_id,
        book: before.book,
        lesson: nextLesson,
        status: "assigned",
        note: null,
        teacher_id: "t1",
        assigned_at: new Date().toISOString(),
        passed_at: null,
      };
    }
  }
  const saved = rows.map((r) => (r.id === id ? updated : r));
  save(nextRow ? [nextRow, ...saved] : saved);
  return { lesson: updated, next: nextRow, finished };
}

export function demoRemoveLesson(id: string): boolean {
  const rows = demoQaidahRows();
  if (!rows.some((r) => r.id === id)) return false;
  save(rows.filter((r) => r.id !== id));
  return true;
}
