import { SURAHS } from "@/data/mushaf-index";
import { JUZ_STARTS } from "@/data/juz-index";
import type { QuranicAssignment } from "@/hooks/useQuranicAssignments";
import { memorisation, milestones as milestonesOf, type Milestone } from "@/lib/milestoneCore";

export type { Milestone };

const MAP = { ayahsInSurah: SURAHS.map((s) => s.ayahs), juzStarts: JUZ_STARTS };

/** What counts as memorised: a new lesson the teacher has marked completed. */
export function memorisedLessons<T extends Pick<QuranicAssignment, "portion" | "status">>(assignments: T[]): T[] {
  return assignments.filter((a) => a.portion === "new" && a.status === "completed");
}

/** The surahs and juz' a child has finished, and juz' nearly halfway, newest first. */
export function milestonesFor(assignments: QuranicAssignment[]): Milestone[] {
  return milestonesOf(memorisation(memorisedLessons(assignments), MAP));
}
