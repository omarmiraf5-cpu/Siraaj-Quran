import type { QuranicAssignment } from "@/hooks/useQuranicAssignments";
import type { AttendanceDay } from "@/data/demo";

// Points and levels for the student portal.
//
// The model is deliberately transparent rather than a black box: a child earns
// from the three things they can actually influence — how much of a surah they
// have memorised, finishing one, and turning up — and the portal shows that
// breakdown rather than only a total. A number nobody can explain is not a
// reward, it is a slot machine.

export const XP_PER_LEVEL = 250;

/** Points per percent memorised, across all of a student's surahs. */
const XP_PER_PERCENT = 3;
/** Bonus for carrying a surah all the way to completed. */
const XP_PER_COMPLETED = 100;
/** Points for each day present or late — late still counts as showing up. */
const XP_PER_DAY_IN = 25;

export interface XpBreakdown {
  memorising: number;
  finishing: number;
  attending: number;
  total: number;
}

export function computeXp(
  assignments: QuranicAssignment[],
  attendance: AttendanceDay[]
): XpBreakdown {
  const memorising =
    assignments.reduce((sum, a) => sum + a.memorization_level, 0) * XP_PER_PERCENT;
  const finishing =
    assignments.filter((a) => a.status === "completed").length * XP_PER_COMPLETED;
  const attending =
    attendance.filter((d) => d.status === "present" || d.status === "late").length *
    XP_PER_DAY_IN;

  return {
    memorising,
    finishing,
    attending,
    total: memorising + finishing + attending,
  };
}

export interface LevelState {
  level: number;
  /** Points earned inside the current level. */
  into: number;
  /** Points needed to finish the current level. */
  span: number;
  /** Points still to go. */
  toNext: number;
  /** Percent of the way through the current level. */
  percent: number;
}

export function levelFor(totalXp: number): LevelState {
  const level = Math.floor(totalXp / XP_PER_LEVEL) + 1;
  const into = totalXp % XP_PER_LEVEL;
  const toNext = XP_PER_LEVEL - into;
  return {
    level,
    into,
    span: XP_PER_LEVEL,
    toNext,
    percent: Math.round((into / XP_PER_LEVEL) * 100),
  };
}

/** The line under the level bar. Encouraging, and honest about the distance. */
export function levelMessage(state: LevelState): string {
  if (state.percent >= 80) {
    return `${state.toNext} XP to Level ${state.level + 1} — nearly there!`;
  }
  if (state.percent >= 40) {
    return `${state.toNext} XP to Level ${state.level + 1} — keep going.`;
  }
  return `${state.toNext} XP to Level ${state.level + 1}.`;
}
