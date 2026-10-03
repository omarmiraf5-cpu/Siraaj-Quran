// What every Qa'idah book's data looks like. The books themselves are in
// this folder, one file each, and listed together in index.ts.

/** The books a school can teach from, as stored against a child's lesson. */
export type QaidahBookId = "ahsanul_qawaid" | "nuraniyah" | "baghdadiyah";

export interface Readings {
  /** What the group shows, where a lesson has more than one. */
  label?: string;
  /** Each word as [printed, as read]. */
  words: [string, string][];
}

export interface QaidahLesson {
  /** The lesson's number in the printed book. */
  id: number;
  /** English name of the lesson, with the book's own word for it where teachers use that. */
  title: string;
  /** Arabic name of the lesson. */
  arabicTitle: string;
  /** What the child is learning to do. */
  teaches: string;
  /**
   * Words whose reading differs from their printing — letters that are
   * skipped, a stop at the end — shown as printed and as read.
   */
  readings?: Readings[];
  /** Rows of Arabic to read aloud, right to left. */
  rows: string[][];
  /** A heading over the row at that index, where a lesson's rows fall into parts. */
  rowLabels?: Record<number, string>;
  /**
   * The rows that are ayahs of the Qur'an, by index, so a reciter can be
   * played for each: the surahs the books end on.
   */
  ayahs?: Record<number, Ayah>;
  /** A point for the teacher or parent sitting with them. */
  note?: string;
}

/** An ayah of the Qur'an, as [surah, ayah]. */
export type Ayah = [surah: number, ayah: number];

/** A surah's ayahs, from its first, as the rows from `firstRow` on: for a lesson's `ayahs`. */
export function surahRows(firstRow: number, surah: number, ayahCount: number): Record<number, Ayah> {
  const rows: Record<number, Ayah> = {};
  for (let ayah = 1; ayah <= ayahCount; ayah++) rows[firstRow + ayah - 1] = [surah, ayah];
  return rows;
}

export interface QaidahBook {
  id: QaidahBookId;
  /** Its name as English-speaking teachers say it. */
  name: string;
  /** The same, where space is short: a chip beside a child's name. */
  shortName: string;
  /** Its name in Arabic. */
  arabicName: string;
  /** What working through it involves, shown above its lessons. */
  summary: string;
  lessons: QaidahLesson[];
}

const EM_SPACE = String.fromCharCode(0x2003);

// The marks, by name, for the books that build their drills letter by
// letter rather than spelling every row out.
const mark = (codePoint: number) => String.fromCharCode(codePoint);
export const FATHA = mark(0x064e);
export const KASRA = mark(0x0650);
export const DAMMA = mark(0x064f);
export const FATHATAN = mark(0x064b);
export const KASRATAN = mark(0x064d);
export const DAMMATAN = mark(0x064c);
export const SUKUN = mark(0x0652);
export const SHADDA = mark(0x0651);
/** Standing fatha (khari zabar). */
export const KHARI_ZABAR = mark(0x0670);
/** Standing kasra (khari zer). */
export const KHARI_ZER = mark(0x0656);
/** Inverted damma (ulta pesh). */
export const ULTA_PESH = mark(0x0657);

/** Several forms in one tile, an em space apart so they read as separate ones. */
export const together = (...forms: string[]) => forms.join(EM_SPACE);

/** A list cut into rows of the given length. */
export function rowsOf<T>(items: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) rows.push(items.slice(i, i + size));
  return rows;
}
