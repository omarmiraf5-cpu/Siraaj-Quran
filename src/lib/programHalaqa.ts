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
 */
export function isProgramHalaqa(name: string | null | undefined): boolean {
  return /\bhif(?:d|z|dh|th|zh)\b/i.test(name ?? "");
}
