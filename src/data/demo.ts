import type { QuranicAssignment } from "@/hooks/useQuranicAssignments";

// Sample data used to populate the portals before a school has real records
// in the database. Every screen draws from this one file so the same students
// and the same numbers appear whichever portal you are looking at.
//
// Dates are fixed rather than derived from today's date: these pages render on
// the server as well as the client, and a value that changes between the two
// causes a hydration mismatch.

export interface DemoStudent {
  id: string;
  name: string;
  halaqa: string;
}

export const DEMO_STUDENTS: DemoStudent[] = [
  { id: "s1", name: "Amina Hassan", halaqa: "Halaqa A" },
  { id: "s2", name: "Omar Warsame", halaqa: "Halaqa A" },
  { id: "s3", name: "Safia Abdi", halaqa: "Halaqa A" },
  { id: "s4", name: "Yusuf Ahmed", halaqa: "Halaqa B" },
  { id: "s5", name: "Hawa Mohamed", halaqa: "Halaqa B" },
  { id: "s6", name: "Ibrahim Osman", halaqa: "Halaqa B" },
  { id: "s7", name: "Fatuma Ali", halaqa: "Halaqa B" },
];

// The student whose own portal is being previewed.
export const DEMO_CURRENT_STUDENT = DEMO_STUDENTS[0];

export type AttendanceStatus = "present" | "late" | "absent" | "excused";

export interface AttendanceDay {
  date: string; // ISO, most recent first
  status: AttendanceStatus;
}

// Twenty school days, most recent first.
const DAYS = [
  "2026-08-12", "2026-08-11", "2026-08-10", "2026-08-07", "2026-08-06",
  "2026-08-05", "2026-08-04", "2026-08-03", "2026-07-31", "2026-07-30",
  "2026-07-29", "2026-07-28", "2026-07-27", "2026-07-24", "2026-07-23",
  "2026-07-22", "2026-07-21", "2026-07-20", "2026-07-17", "2026-07-16",
];

// One pattern per student, so each has a believable and distinct record
// rather than everyone looking identical.
const PATTERNS: Record<string, AttendanceStatus[]> = {
  s1: ["present","present","present","present","late","present","present","present","present","present","present","present","absent","present","present","present","late","present","present","present"],
  s2: ["present","late","present","absent","present","present","late","present","present","excused","present","present","present","late","present","present","present","present","absent","present"],
  s3: ["present","present","present","present","present","present","present","present","present","present","present","present","present","present","present","late","present","present","present","present"],
  s4: ["absent","absent","late","present","present","late","present","absent","present","present","late","present","present","present","absent","present","present","late","present","present"],
  s5: ["present","present","late","present","present","present","excused","excused","present","present","present","late","present","present","present","present","present","absent","present","late"],
  s6: ["present","present","present","late","present","present","present","present","late","present","absent","present","present","present","present","present","late","present","present","present"],
  s7: ["late","present","present","present","present","absent","present","present","present","late","present","present","excused","present","present","present","present","present","late","present"],
};

export const DEMO_ATTENDANCE: Record<string, AttendanceDay[]> = Object.fromEntries(
  DEMO_STUDENTS.map((s) => [
    s.id,
    DAYS.map((date, i) => ({ date, status: PATTERNS[s.id][i] })),
  ])
);

export interface AttendanceSummary {
  present: number;
  late: number;
  absent: number;
  excused: number;
  total: number;
  rate: number; // percent of days present or late
}

export function summariseAttendance(days: AttendanceDay[]): AttendanceSummary {
  const count = (s: AttendanceStatus) => days.filter((d) => d.status === s).length;
  const present = count("present");
  const late = count("late");
  const absent = count("absent");
  const excused = count("excused");
  const total = days.length;
  // Excused days are not counted against a student, so they leave the
  // denominator rather than lowering the rate.
  const assessed = total - excused;
  return {
    present,
    late,
    absent,
    excused,
    total,
    rate: assessed > 0 ? Math.round(((present + late) / assessed) * 100) : 0,
  };
}

export const ATTENDANCE_LABELS: Record<AttendanceStatus, string> = {
  present: "Present",
  late: "Late",
  absent: "Absent",
  excused: "Excused",
};

// Solid fills for dots and the day strip, where a tinted chip would disappear.
export const ATTENDANCE_DOT: Record<AttendanceStatus, string> = {
  present: "bg-green-700",
  late: "bg-amber-600",
  absent: "bg-red-700",
  excused: "bg-slate-500",
};

// Tailwind classes per status, shared so the three portals agree on colour.
export const ATTENDANCE_STYLES: Record<AttendanceStatus, string> = {
  present: "bg-green-100 dark:bg-green-950/30 text-green-700 dark:text-green-300",
  late: "bg-amber-100 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300",
  absent: "bg-red-100 dark:bg-red-950/30 text-red-700 dark:text-red-300",
  excused: "bg-blue-100 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300",
};

// Assignments shaped exactly like the ones the API returns, so a screen can
// fall back to these without any special casing beyond choosing the source.
function assignment(
  id: string,
  studentId: string,
  surah: number,
  from: number,
  to: number,
  status: QuranicAssignment["status"],
  level: number,
  due: string | null,
  assigned: string,
  notes: string | null
): QuranicAssignment {
  return {
    id,
    student_id: studentId,
    teacher_id: "t1",
    surah,
    ayah_start: from,
    ayah_end: to,
    assigned_at: assigned,
    due_date: due,
    status,
    memorization_level: level,
    teacher_notes: notes,
    student_notes: null,
    created_at: assigned,
    updated_at: assigned,
  };
}

export const DEMO_ASSIGNMENTS: QuranicAssignment[] = [
  assignment("a1", "s1", 78, 1, 20, "in_progress", 60, "2026-08-20", "2026-08-06",
    "Careful with the madd in ayah 13 — hold it the full six counts."),
  assignment("a2", "s1", 1, 1, 7, "completed", 100, "2026-08-08", "2026-07-30",
    "Beautifully done. Ready to move on."),
  assignment("a3", "s1", 36, 1, 12, "needs_review", 45, "2026-08-14", "2026-08-04",
    "Revise ayahs 8 to 12, the endings are running together."),
  assignment("a4", "s2", 67, 1, 15, "in_progress", 35, "2026-08-22", "2026-08-07", null),
  assignment("a5", "s2", 112, 1, 4, "completed", 100, "2026-08-05", "2026-07-28",
    "Excellent tajweed."),
  assignment("a6", "s3", 55, 1, 25, "assigned", 0, "2026-08-25", "2026-08-11",
    "Listen to the recitation twice before starting."),
  assignment("a7", "s4", 2, 255, 257, "in_progress", 70, "2026-08-18", "2026-08-05",
    "Ayat al-Kursi — focus on the stops."),
  assignment("a8", "s5", 18, 1, 10, "assigned", 0, "2026-08-28", "2026-08-12", null),
  assignment("a9", "s6", 49, 1, 13, "completed", 95, "2026-08-09", "2026-07-29",
    "Very strong. A little more fluency on ayah 11."),
  assignment("a10", "s7", 93, 1, 11, "needs_review", 55, "2026-08-16", "2026-08-06",
    "Good effort — practise the last three ayahs again."),
];

export function demoAssignmentsFor(studentId: string): QuranicAssignment[] {
  return DEMO_ASSIGNMENTS.filter((a) => a.student_id === studentId);
}

// The date every portal treats as "today": the most recent day in the register.
// Fixed rather than read from the clock, for the same hydration reason as the
// dates above — and shared, because the portals used to disagree by a day, so
// the same assignment read "due tomorrow" to a student and "due today" to a
// parent.
export const DEMO_TODAY = DAYS[0];

const DAY_MS = 86_400_000;

/** Days from today to an ISO date; negative is in the past. */
export function daysFromToday(iso: string): number {
  return Math.round(
    (Date.parse(`${iso}T00:00:00Z`) - Date.parse(`${DEMO_TODAY}T00:00:00Z`)) / DAY_MS
  );
}

export interface DueLabel {
  text: string;
  /** Due within three days, or already past. */
  urgent: boolean;
  overdue: boolean;
}

export function dueLabel(due: string | null): DueLabel | null {
  if (!due) return null;
  const days = daysFromToday(due);
  if (days < 0) {
    const n = Math.abs(days);
    return { text: `${n} day${n === 1 ? "" : "s"} overdue`, urgent: true, overdue: true };
  }
  if (days === 0) return { text: "Due today", urgent: true, overdue: false };
  if (days === 1) return { text: "Due tomorrow", urgent: true, overdue: false };
  return { text: `Due in ${days} days`, urgent: days <= 3, overdue: false };
}

export const ASSIGNMENT_LABELS: Record<QuranicAssignment["status"], string> = {
  assigned: "To start",
  in_progress: "In progress",
  completed: "Completed",
  needs_review: "Needs review",
};

// Status chips, shared so an assignment looks the same in every portal.
export const ASSIGNMENT_STYLES: Record<QuranicAssignment["status"], string> = {
  assigned: "bg-blue-100 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300",
  in_progress: "bg-amber-100 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300",
  completed: "bg-green-100 dark:bg-green-950/30 text-green-700 dark:text-green-300",
  needs_review: "bg-red-100 dark:bg-red-950/30 text-red-700 dark:text-red-300",
};

/** The children a signed-in parent can see. Two, so the switcher is visible. */
export const DEMO_CHILDREN = DEMO_STUDENTS.slice(0, 2);

export function studentName(id: string): string {
  return DEMO_STUDENTS.find((s) => s.id === id)?.name ?? "Student";
}

export function initials(name: string): string {
  return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Built by hand rather than with toLocaleDateString: Node and the browser ship
// different ICU builds, and the same call returned "Thu, 13 Aug" on the server
// against "Thu 13 Aug" in the browser, which React reports as a hydration
// mismatch. Reading the parts in UTC keeps it stable everywhere.
export function formatDay(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}
