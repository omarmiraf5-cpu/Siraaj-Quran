/**
 * A program halaqa — a Hifd (Hifz) program — sits alongside a student's
 * own halaqa rather than in place of it: a child can be in their grade's
 * halaqa and in the Hifd program too. It's known by its name ("Hifd
 * program", "Hifz", "Hifdh class"), so nothing in the database needs to
 * change for a school to have one.
 *
 * What follows from that: choosing a student's halaqa (or a teacher's
 * halaqa for a grade) never picks a program, and moving a student between
 * halaqas leaves their program alone. Who's in a program is set on the
 * Halaqas page, or by the office's SQL.
 *
 * The Reading and Writing halaqa (القراءة والكتابة) works the same way: a
 * child keeps their grade's halaqa and joins it as well.
 */
const HIFD = /\bhif(?:d|z|dh|th|zh)\b/i;
const READING_WRITING_EN = /\breading\s*(?:and|&|\+)\s*writing\b/i;
// القراءة / القرائة / القراءه, then "and writing" with or without the و.
const READING_WRITING_AR = /القر[اإ][ءئ][ةه]\s*(?:و\s*)?(?:ال)?كتاب[ةه]/;

export function isProgramHalaqa(name: string | null | undefined): boolean {
  const n = name ?? "";
  return HIFD.test(n) || READING_WRITING_EN.test(n) || READING_WRITING_AR.test(n);
}

export type ProgramKind = "" | "hifd" | "reading";

/** Which program a halaqa is, from its name; empty when it is an ordinary halaqa. */
export function programKind(name: string | null | undefined): ProgramKind {
  const n = name ?? "";
  if (HIFD.test(n)) return "hifd";
  if (READING_WRITING_EN.test(n) || READING_WRITING_AR.test(n)) return "reading";
  return "";
}
