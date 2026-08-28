import type { QuranicAssignment, HifzPortion, DailyRating } from "@/hooks/useQuranicAssignments";

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
  portion: HifzPortion,
  surah: number,
  from: number,
  to: number,
  status: QuranicAssignment["status"],
  level: number,
  due: string | null,
  assigned: string,
  notes: string | null,
  rating: DailyRating | null = null
): QuranicAssignment {
  return {
    id,
    student_id: studentId,
    teacher_id: "t1",
    surah,
    ayah_start: from,
    ayah_end: to,
    portion,
    assigned_at: assigned,
    due_date: due,
    status,
    memorization_level: level,
    daily_rating: rating,
    teacher_notes: notes,
    student_notes: null,
    created_at: assigned,
    updated_at: assigned,
  };
}

// Every student carries all three portions, which is how a maktab actually
// runs: a new lesson to learn, the recent ground to keep warm, and the older
// ground cycled so it is not lost. The old revision is deliberately the
// largest range and the new lesson the smallest.
//
// A hifz student here works backward through the mushaf from An-Nas (114)
// toward Al-Fatihah, so surah number only ever falls as they progress: the
// old revision — settled longest ago, closest to where they started — is
// always the highest surah number of the three, the new lesson — today's
// frontier, furthest toward the front of the mushaf — is always the lowest,
// and recent revision sits in between.
export const DEMO_ASSIGNMENTS: QuranicAssignment[] = [
  // Amina Hassan — finished Juz Amma down to An-Naba, now starting Al-Mulk,
  // one of the first surahs commonly taught right after Juz Amma.
  assignment("a1", "s1", "new", 67, 1, 30, "in_progress", 60, "2026-08-20", "2026-08-12",
    "Careful with the madd in ayah 13 — hold it the full six counts.", "good"),
  assignment("a2", "s1", "recent", 78, 1, 20, "needs_review", 45, "2026-08-14", "2026-08-10",
    "Revise ayahs 8 to 12, the endings are running together.", "weak"),
  assignment("a3", "s1", "old", 79, 1, 46, "completed", 100, "2026-08-16", "2026-07-30",
    "Beautifully held. This one is settled.", "excellent"),

  // Omar Warsame — settled the end of Juz Amma, now working through Ar-Rahman.
  assignment("a4", "s2", "new", 55, 1, 25, "in_progress", 35, "2026-08-20", "2026-08-12", null, null),
  assignment("a5", "s2", "recent", 80, 1, 42, "assigned", 0, "2026-08-18", "2026-08-11",
    "Listen to the recitation twice before you start.", null),
  assignment("a6", "s2", "old", 81, 1, 29, "completed", 95, "2026-08-17", "2026-07-28",
    "Excellent tajweed throughout.", "excellent"),

  // Safia Abdi — settled Al-Waqi'ah, now working back through Ar-Rahman
  // toward Ya-Sin.
  assignment("a7", "s3", "new", 36, 1, 25, "assigned", 0, "2026-08-21", "2026-08-12", null, null),
  assignment("a8", "s3", "recent", 55, 1, 35, "in_progress", 55, "2026-08-19", "2026-08-09", null, "good"),
  assignment("a9", "s3", "old", 56, 1, 96, "completed", 100, "2026-08-16", "2026-07-27",
    "Al-Waqi'ah is solid. Keep it in the weekly cycle.", "excellent"),

  // Yusuf Ahmed
  assignment("a10", "s4", "new", 2, 255, 257, "in_progress", 70, "2026-08-18", "2026-08-12",
    "Ayat al-Kursi — focus on the stops.", "very_good"),
  assignment("a11", "s4", "recent", 18, 1, 10, "needs_review", 40, "2026-08-15", "2026-08-08",
    "The first ten of Al-Kahf need another week.", "weak"),
  assignment("a12", "s4", "old", 78, 1, 40, "completed", 90, "2026-08-17", "2026-07-29", null, "very_good"),

  // Hawa Mohamed
  assignment("a13", "s5", "new", 18, 1, 10, "assigned", 0, "2026-08-22", "2026-08-12", null, null),
  assignment("a14", "s5", "recent", 19, 1, 15, "in_progress", 45, "2026-08-19", "2026-08-10", null, "good"),
  assignment("a15", "s5", "old", 67, 1, 30, "completed", 100, "2026-08-16", "2026-07-31",
    "Held well. Recite it to your parents this week.", "excellent"),

  // Ibrahim Osman — settled An-Naba and Qaf, now on Al-Hujurat.
  assignment("a16", "s6", "new", 49, 1, 8, "in_progress", 60, "2026-08-20", "2026-08-12", null, "good"),
  assignment("a17", "s6", "recent", 50, 1, 45, "completed", 95, "2026-08-15", "2026-08-07",
    "Very strong. A little more fluency on ayah 11.", "excellent"),
  assignment("a18", "s6", "old", 78, 1, 40, "completed", 100, "2026-08-17", "2026-07-29", null, "excellent"),

  // Fatuma Ali — settled At-Tin and Ad-Duha, now on Al-A'la.
  assignment("a19", "s7", "new", 87, 1, 11, "needs_review", 55, "2026-08-16", "2026-08-12",
    "Good effort — practise the last three ayahs again.", "weak"),
  assignment("a20", "s7", "recent", 93, 1, 11, "in_progress", 70, "2026-08-19", "2026-08-10", null, "very_good"),
  assignment("a21", "s7", "old", 95, 1, 8, "completed", 100, "2026-08-17", "2026-07-30", null, "excellent"),
];

export function demoAssignmentsFor(studentId: string): QuranicAssignment[] {
  return DEMO_ASSIGNMENTS.filter((a) => a.student_id === studentId);
}

// ── Daily rating ─────────────────────────────────────────────────────────
// What a teacher grades today's recitation as, read before any percentage.
export const DAILY_RATING_ORDER: DailyRating[] = ["excellent", "very_good", "good", "weak"];

export const DAILY_RATING_LABELS: Record<DailyRating, string> = {
  excellent: "Excellent",
  very_good: "Very good",
  good: "Good",
  weak: "Weak",
};

export const DAILY_RATING_STYLES: Record<DailyRating, string> = {
  excellent: "bg-green-100 dark:bg-green-950/30 text-green-700 dark:text-green-300",
  very_good: "bg-emerald-100 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300",
  good: "bg-amber-100 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300",
  weak: "bg-red-100 dark:bg-red-950/30 text-red-700 dark:text-red-300",
};

// Solid fills for the calendar dots, where a tinted pill would disappear.
export const DAILY_RATING_DOT: Record<DailyRating, string> = {
  excellent: "bg-green-600",
  very_good: "bg-emerald-500",
  good: "bg-amber-500",
  weak: "bg-red-600",
};

/**
 * Merges a teacher's demo-mode edit (set via localStorage, since the sample
 * assignments themselves are static data) on top of an assignment. Applied
 * the same way in every portal so an edited rating shows everywhere.
 */
export type AssignmentOverride = Partial<
  Pick<QuranicAssignment, "daily_rating" | "teacher_notes" | "status" | "memorization_level">
>;

export function withOverride(
  a: QuranicAssignment,
  overrides: Record<string, AssignmentOverride>
): QuranicAssignment {
  const o = overrides[a.id];
  return o ? { ...a, ...o } : a;
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

// ── The three daily portions ────────────────────────────────────────────
// Ordered as they are recited in the halaqa: the new lesson first while the
// student is freshest, then the recent ground, then the old.
export const HIFZ_PORTIONS: HifzPortion[] = ["new", "recent", "old"];

export const PORTION_LABELS: Record<HifzPortion, string> = {
  new: "New lesson",
  recent: "Recent revision",
  old: "Old revision",
};

export const PORTION_ARABIC: Record<HifzPortion, string> = {
  new: "الدَّرْسُ الْجَدِيدُ",
  recent: "الْمُرَاجَعَةُ الْقَرِيبَةُ",
  old: "الْمُرَاجَعَةُ الْبَعِيدَةُ",
};

/** What each portion is for, in a line. */
export const PORTION_BLURB: Record<HifzPortion, string> = {
  new: "Today's new memorisation.",
  recent: "What was learnt lately, kept warm.",
  old: "Older ground, cycled so it is not lost.",
};

export function assignmentsByPortion(
  assignments: QuranicAssignment[]
): Record<HifzPortion, QuranicAssignment[]> {
  return {
    new: assignments.filter((a) => a.portion === "new"),
    recent: assignments.filter((a) => a.portion === "recent"),
    old: assignments.filter((a) => a.portion === "old"),
  };
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
export const WEEKDAY_SHORT = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Built by hand rather than with toLocaleDateString: Node and the browser ship
// different ICU builds, and the same call returned "Thu, 13 Aug" on the server
// against "Thu 13 Aug" in the browser, which React reports as a hydration
// mismatch. Reading the parts in UTC keeps it stable everywhere.
export function formatDay(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

// ── Parent ↔ teacher communication ──────────────────────────────────────
// One thread per student, shared by that student's parent and the teacher.
// An "absence" message carries a specific date rather than free text, so it
// shows up distinctly from a general concern.

export const DEMO_TEACHER_NAME = "Ustadh Kareem";

export type MessageAuthor = "parent" | "teacher";
export type MessageKind = "message" | "absence";

export interface ThreadMessage {
  id: string;
  student_id: string;
  author: MessageAuthor;
  author_name: string;
  kind: MessageKind;
  body: string;
  /** ISO date, only set when kind is "absence". */
  absence_date?: string;
  /** ISO datetime. */
  created_at: string;
}

export const DEMO_MESSAGES: ThreadMessage[] = [
  {
    id: "m1",
    student_id: "s1",
    author: "parent",
    author_name: "Amina's parent",
    kind: "message",
    body: "Salaam ustadh, Amina says the new lesson felt quite long this week — is that expected?",
    created_at: "2026-08-11T18:20:00Z",
  },
  {
    id: "m2",
    student_id: "s1",
    author: "teacher",
    author_name: DEMO_TEACHER_NAME,
    kind: "message",
    body: "Wa alaykum salaam. Surah An-Naba is longer than her usual portion — we can split it over two days if that helps her.",
    created_at: "2026-08-11T19:05:00Z",
  },
  {
    id: "m3",
    student_id: "s1",
    author: "parent",
    author_name: "Amina's parent",
    kind: "absence",
    body: "Amina has a dentist appointment and will miss halaqa.",
    absence_date: "2026-08-13",
    created_at: "2026-08-12T09:00:00Z",
  },
  {
    id: "m4",
    student_id: "s2",
    author: "teacher",
    author_name: DEMO_TEACHER_NAME,
    kind: "message",
    body: "Omar recited beautifully today, mashaAllah. Encourage him to keep revising Surah An-Nazi'at at home too.",
    created_at: "2026-08-10T17:40:00Z",
  },
  {
    id: "m5",
    student_id: "s2",
    author: "parent",
    author_name: "Omar's parent",
    kind: "message",
    body: "JazakAllah khair for letting us know, we'll go over it with him tonight.",
    created_at: "2026-08-10T20:15:00Z",
  },
];

export function demoMessagesFor(studentId: string, extra: ThreadMessage[] = []): ThreadMessage[] {
  return [...DEMO_MESSAGES, ...extra]
    .filter((m) => m.student_id === studentId)
    .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
}

// Built by hand rather than toLocaleTimeString, for the same server/client
// ICU mismatch reason as formatDay above — the input is a fixed ISO string
// either way, so this stays stable between the two renders.
export function formatMessageTime(iso: string): string {
  const d = new Date(iso);
  const h = d.getUTCHours();
  const m = d.getUTCMinutes();
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const ampm = h < 12 ? "am" : "pm";
  return `${formatDay(iso.slice(0, 10))} · ${h12}:${String(m).padStart(2, "0")}${ampm}`;
}

// ── Recitation history ───────────────────────────────────────────────────
// A daily_rating on an assignment is only ever today's snapshot — grading a
// session again tomorrow overwrites it. Every graded session also becomes
// its own dated entry here, so a parent or teacher can look back over the
// whole month rather than only ever seeing the latest mark.
export interface RecitationLogEntry {
  id: string;
  student_id: string;
  portion: HifzPortion;
  surah: number;
  ayah_start: number;
  ayah_end: number;
  rating: DailyRating;
  notes: string | null;
  /** ISO date — the day this session was heard and graded. */
  date: string;
}

// One pattern per student, oldest first, so the story of the month (who is
// trending up, who has a rough patch) is distinct per child rather than
// everyone looking the same. Portions are graded in rotation — new, recent,
// old — the same order a halaqa hears them in, so each gets heard roughly
// every third day rather than all three every single day.
const RATING_HISTORY_PATTERNS: Record<string, DailyRating[]> = {
  s1: ["good","very_good","weak","good","excellent","good","weak","very_good","good","excellent","weak","good","very_good","excellent","good","weak","good","excellent","very_good","good"],
  s2: ["good","good","very_good","excellent","good","weak","good","very_good","excellent","good","good","very_good","excellent","good","weak","good","very_good","excellent","good","good"],
  s3: ["weak","good","good","very_good","excellent","good","weak","good","very_good","excellent","good","good","weak","very_good","excellent","good","good","very_good","excellent","good"],
  s4: ["very_good","good","weak","very_good","good","excellent","weak","very_good","good","excellent","weak","very_good","good","excellent","weak","very_good","good","excellent","weak","very_good"],
  s5: ["good","good","very_good","excellent","good","good","weak","good","very_good","excellent","good","good","weak","good","very_good","excellent","good","good","very_good","good"],
  s6: ["very_good","excellent","good","excellent","very_good","excellent","good","excellent","very_good","excellent","good","excellent","very_good","excellent","good","excellent","very_good","excellent","good","excellent"],
  s7: ["good","weak","very_good","excellent","good","weak","very_good","excellent","weak","good","very_good","excellent","weak","good","very_good","excellent","weak","good","very_good","excellent"],
};

function buildRecitationLog(): RecitationLogEntry[] {
  const orderedDays = DAYS.slice().reverse(); // oldest first, to match the patterns above
  const entries: RecitationLogEntry[] = [];

  for (const student of DEMO_STUDENTS) {
    const pattern = RATING_HISTORY_PATTERNS[student.id];
    const portions = assignmentsByPortion(demoAssignmentsFor(student.id));

    orderedDays.forEach((date, i) => {
      const portion = HIFZ_PORTIONS[i % HIFZ_PORTIONS.length];
      const current = portions[portion][0];
      if (!current) return;
      entries.push({
        id: `log-${student.id}-${i}`,
        student_id: student.id,
        portion,
        surah: current.surah,
        ayah_start: current.ayah_start,
        ayah_end: current.ayah_end,
        rating: pattern[i],
        notes: null,
        date,
      });
    });

    // The most recent session for each portion should read exactly like
    // that portion's assignment card — same rating, same remark — rather
    // than an independent value the pattern above happened to land on.
    for (const portion of HIFZ_PORTIONS) {
      const current = portions[portion][0];
      if (!current || !current.daily_rating) continue;
      const last = [...entries]
        .reverse()
        .find((e) => e.student_id === student.id && e.portion === portion);
      if (last) {
        last.rating = current.daily_rating;
        last.notes = current.teacher_notes;
      }
    }
  }

  return entries;
}

export const DEMO_RECITATION_LOG: RecitationLogEntry[] = buildRecitationLog();

export function recitationLogFor(
  studentId: string,
  extra: RecitationLogEntry[] = []
): RecitationLogEntry[] {
  return [...DEMO_RECITATION_LOG, ...extra]
    .filter((e) => e.student_id === studentId)
    .sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
}

export function tallyRatings(entries: RecitationLogEntry[]): Record<DailyRating, number> {
  const tally: Record<DailyRating, number> = { excellent: 0, very_good: 0, good: 0, weak: 0 };
  for (const e of entries) tally[e.rating]++;
  return tally;
}
