import { phrase } from "@/lib/i18n/phrases";

/**
 * The grades an academic school's students are in: Pre-K (-1),
 * Kindergarten (0), then Grades 1 to 12. A Qur'an school's students carry a
 * grade too, from their age, but it means nothing there and isn't shown.
 */
export const PRE_K = -1;
export const GRADES: readonly number[] = Array.from({ length: 14 }, (_, i) => i - 1);

export function isGrade(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= PRE_K && (value as number) <= 12;
}

/** "Pre-K", "Kindergarten", "Grade 3". */
export function gradeLabel(grade: number): string {
  return grade === PRE_K ? phrase("Pre-K") : grade === 0 ? phrase("Kindergarten") : phrase("Grade {grade}", { grade });
}

/**
 * A grade as a school's spreadsheet writes it — "Pre-K", "PK", "JK", "K",
 * "KG", "Kindergarten", "Grade 3", "Gr. 3", "GR3", "3", "3rd" — or null when
 * it isn't one.
 */
export function parseGrade(text: unknown): number | null {
  const s = String(text ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  if (!s) return null;
  if (/^(pre[ -]?k|pk|pre[ -]?kindergarten|pre[ -]?school|preschool|jk|junior kindergarten|nursery)$/.test(s)) return PRE_K;
  if (/^(k|kg|kinder|kindergarten|kindergarden|sk|senior kindergarten)$/.test(s)) return 0;
  const m = s.match(/^(?:grade|gr\.?|g)?\s*(\d{1,2})(?:st|nd|rd|th)?(?: grade)?$/);
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 1 && n <= 12 ? n : null;
}

/**
 * A grade written at the end of a student's name — "Ayyub Abasha GR6",
 * "Mariam Abdi KG", "Ali Noor Pre-K" — some schools' exports carry it
 * there. The name without it, and the grade; null when there's none.
 */
export function gradeInName(name: string): { name: string; grade: number } | null {
  const m = name.trim().match(/^(.*\S)\s+(gr\.?\s*\d{1,2}|grade\s*\d{1,2}|kg|pre[ -]?k|pk)$/i);
  if (!m) return null;
  const grade = parseGrade(m[2]);
  return grade === null ? null : { name: m[1].trim(), grade };
}

/**
 * The grades a halaqa is for: its own grade first, plus any others it takes
 * (a halaqa for Grades 8 and 9 together), lowest first.
 */
export function gradesOf(grade: number | null | undefined, also?: readonly number[] | null): number[] {
  const all = [...(typeof grade === "number" ? [grade] : []), ...(also ?? [])];
  return [...new Set(all)].sort((a, b) => a - b);
}

/** Whether a halaqa for these grades takes a child of this grade. */
export function coversGrade(grade: number | null | undefined, also: readonly number[] | null | undefined, studentGrade: number): boolean {
  return gradesOf(grade, also).includes(studentGrade);
}

/**
 * "Grade 8", "Grades 8 and 9", "Grades 3 to 5", "Grades 1, 3 and 6" — how a
 * halaqa for several grades is named. Pre-K and Kindergarten keep their names.
 */
export function gradesLabel(grade: number | null | undefined, also?: readonly number[] | null): string {
  const list = gradesOf(grade, also);
  if (list.length === 0) return "";
  if (list.length === 1) return gradeLabel(list[0]);
  const names = list.map((g) => (g >= 1 ? String(g) : gradeLabel(g)));
  const numbersOnly = list.every((g) => g >= 1);
  if (numbersOnly) {
    const run = list.every((g, i) => i === 0 || g === list[i - 1] + 1);
    if (run && list.length > 2) return phrase("Grades {from} to {to}", { from: list[0], to: list[list.length - 1] });
    const head = names.slice(0, -1).join(", ");
    return phrase("Grades {list} and {last}", { list: head, last: names[names.length - 1] });
  }
  return list.map(gradeLabel).join(" · ");
}
