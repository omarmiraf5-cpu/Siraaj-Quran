import type { QuranicAssignment } from "@/hooks/useQuranicAssignments";

// Stars for the student portal. A child sees one number — stars — and it is
// earned in ways they can see: finishing a lesson, and learning ayahs. A
// teacher can add more (see awards.ts), and the two are shown as one total.

/** Stars for each assignment carried all the way to completed. */
const STARS_PER_FINISHED = 1;
/** One star for every this-many percent learnt, across the assignments still open. */
const PERCENT_PER_STAR = 50;

/** Stars earned by the work itself, apart from those a teacher gives. */
export function autoStars(assignments: QuranicAssignment[]): number {
  const finished = assignments.filter((a) => a.status === "completed").length;
  const learnt = assignments.filter((a) => a.status !== "completed").reduce((sum, a) => sum + a.memorization_level, 0);
  return finished * STARS_PER_FINISHED + Math.floor(learnt / PERCENT_PER_STAR);
}
