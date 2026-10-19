// Qa'idah work set by pages of the book: "pages 12 to 15 of the Nuraniyah",
// as a new lesson, a recent revision or an old revision, with a due date —
// the way a Qur'an assignment is set (qaidah_page_assignments in schema.sql).

import type { QaidahBookId } from "@/data/qaidah";
import type { QaidahStatus } from "@/lib/qaidahLessons";

export type QaidahPortion = "new" | "recent" | "old";
export const QAIDAH_PORTIONS: QaidahPortion[] = ["new", "recent", "old"];

export interface QaidahPageAssignment {
  id: string;
  student_id: string;
  book: QaidahBookId;
  page_start: number;
  page_end: number;
  portion: QaidahPortion;
  due_date: string | null;
  note: string | null;
  status: QaidahStatus;
  teacher_id: string | null;
  assigned_at: string;
  passed_at: string | null;
}

export const QAIDAH_PAGE_COLUMNS =
  "id, student_id, book, page_start, page_end, portion, due_date, note, status, teacher_id, assigned_at, passed_at";

/** The most pages a book can have, as far as the table allows. */
export const MAX_QAIDAH_PAGE = 999;

/** Newest first. */
export function pagesNewestFirst(rows: QaidahPageAssignment[]): QaidahPageAssignment[] {
  return [...rows].sort((a, b) => b.assigned_at.localeCompare(a.assigned_at));
}

/** "Page 12" or "Pages 12–15". */
export function pagesText(row: { page_start: number; page_end: number }, label: { one: string; many: string }): string {
  return row.page_start === row.page_end
    ? label.one.replace("{page}", String(row.page_start))
    : label.many.replace("{from}", String(row.page_start)).replace("{to}", String(row.page_end));
}

export const isQaidahPortion = (v: unknown): v is QaidahPortion => v === "new" || v === "recent" || v === "old";
