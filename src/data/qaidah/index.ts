// The Qa'idah books a school can teach from. Each is in its own file here;
// a child's lesson is stored as one of these ids and a lesson number in it
// (qaidah_assignments in schema.sql).

import { AHSANUL_QAWAID } from "./ahsanulQawaid";
import { BAGHDADIYAH } from "./baghdadiyah";
import { NURANIYAH } from "./nuraniyah";
import type { QaidahBook, QaidahBookId, QaidahLesson } from "./types";

export type { Ayah, QaidahBook, QaidahBookId, QaidahLesson, Readings } from "./types";

/** The books, in the order they are offered. */
export const QAIDAH_BOOKS: QaidahBook[] = [AHSANUL_QAWAID, NURANIYAH, BAGHDADIYAH];

export const DEFAULT_QAIDAH_BOOK: QaidahBookId = "ahsanul_qawaid";

export function isQaidahBookId(value: unknown): value is QaidahBookId {
  return QAIDAH_BOOKS.some((b) => b.id === value);
}

export function qaidahBook(id: QaidahBookId): QaidahBook {
  return QAIDAH_BOOKS.find((b) => b.id === id) ?? AHSANUL_QAWAID;
}

export function qaidahLesson(bookId: QaidahBookId, lesson: number): QaidahLesson | undefined {
  return qaidahBook(bookId).lessons.find((l) => l.id === lesson);
}

/**
 * The tiles of a lesson's rows in the order they're read, each once: what a
 * teacher records one by one. A tile printed twice is read the same way
 * both times, so it has one recording.
 */
export function lessonTiles(lesson: QaidahLesson): string[] {
  return [...new Set(lesson.rows.flat())];
}

/** The lesson after this one, or null at the end of the book. */
export function nextQaidahLesson(bookId: QaidahBookId, lesson: number): number | null {
  return qaidahLesson(bookId, lesson + 1) ? lesson + 1 : null;
}
