/**
 * The grades an academic school's students are in: Kindergarten (0), then
 * Grades 1 to 12. A Qur'an school's students carry a grade too, from their
 * age, but it means nothing there and isn't shown.
 */
export const GRADES: readonly number[] = Array.from({ length: 13 }, (_, i) => i);

export function isGrade(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0 && (value as number) <= 12;
}

/** "Kindergarten", "Grade 3". */
export function gradeLabel(grade: number): string {
  return grade === 0 ? "Kindergarten" : `Grade ${grade}`;
}

/**
 * A grade as a school's spreadsheet writes it — "K", "KG", "Kindergarten",
 * "Grade 3", "Gr. 3", "3", "3rd" — or null when it isn't one.
 */
export function parseGrade(text: unknown): number | null {
  const s = String(text ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  if (!s) return null;
  if (/^(k|kg|kinder|kindergarten|kindergarden|sk|senior kindergarten)$/.test(s)) return 0;
  const m = s.match(/^(?:grade|gr\.?|g)?\s*(\d{1,2})(?:st|nd|rd|th)?(?: grade)?$/);
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 1 && n <= 12 ? n : null;
}
