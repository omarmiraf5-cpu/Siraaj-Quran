import { DEMO_STUDENTS, DEMO_TEACHER_NAME, DEMO_TODAY } from "@/data/demo";
import { readDemoStore, writeDemoStore } from "@/lib/demoStore";
import { addDays } from "@/lib/planDates";
import { DEFAULT_CALENDAR, isInstructionalDay } from "@/lib/schoolCalendar";
import {
  DEFAULT_DAILY_TESTS,
  bookableDays,
  extraSlot,
  isTestDay,
  isWeekend,
  nextSlot,
  testDaysAfter,
  testSummary,
  type JuzMistake,
  type JuzTest,
  type TestDayOverrides,
} from "@/lib/juzTests";

/**
 * Juz tests for the sample portal: the same routes as the live site
 * (/api/juz-tests and below), answered in the browser from a sample school
 * kept in localStorage, by the same rules in juzTests.ts. The pages run
 * their ordinary code and only swap which fetch they call.
 */

export type DemoJuzRole = "teacher" | "admin" | "parent";

const KEY = "demo_juz_tests_v1";
const TODAY = DEMO_TODAY;
const CAL = DEFAULT_CALENDAR;
/** The sample parent is Amina's and Omar's. */
const PARENT_CHILDREN = new Set(["s1", "s2"]);
const OFFICE_NAME = "Khalid Nur";
const BILAL = "Ustadh Bilal";

/** Children in the other teacher's halaqa, who share the day's numbers. */
const OTHERS: Array<{ id: string; name: string }> = [
  { id: "x1", name: "Bashir Ali" },
  { id: "x2", name: "Ayan Farah" },
  { id: "x3", name: "Ilyas Hersi" },
  { id: "x4", name: "Nimco Said" },
  { id: "x5", name: "Zubeyr Aden" },
  { id: "x6", name: "Hodan Isse" },
  { id: "x7", name: "Sakariye Nur" },
  { id: "x8", name: "Ladan Jama" },
  { id: "x9", name: "Mahad Yusuf" },
];

interface Row {
  id: string;
  student_id: string;
  juz: number;
  test_date: string;
  slot: number;
  result: "pass" | "fail" | null;
  comment: string | null;
  examiner: string | null;
  tested_at: string | null;
  cancelled_at: string | null;
  created_at: string;
}

interface Store {
  enabled: boolean;
  slots: number;
  examiners: string[];
  overrides: TestDayOverrides;
  tests: Row[];
  mistakes: Array<JuzMistake & { test_id: string }>;
}

const d = (offset: number) => addDays(TODAY, offset);
const at = (date: string, time: string) => `${date}T${time}:00-06:00`;

function seed(): Store {
  let n = 0;
  const t = (
    student_id: string,
    juz: number,
    test_date: string,
    slot: number,
    result: Row["result"] = null,
    comment: string | null = null,
    examiner: string | null = null,
    time = "09:30"
  ): Row => ({
    id: `jt${++n}`,
    student_id,
    juz,
    test_date,
    slot,
    result,
    comment,
    examiner: result ? examiner ?? BILAL : null,
    tested_at: result ? at(test_date, time) : null,
    cancelled_at: null,
    created_at: at(addDays(test_date, -3), "16:10"),
  });
  const tests: Row[] = [
    // Amina: Juz 30 and 29 passed, 28 failed once and booked again for today.
    t("s1", 30, d(-22), 1, "pass", "Clear and confident. MashaAllah."),
    t("s1", 29, d(-9), 2, "pass", "Good. Watch the madd in Al-Mulk."),
    t("s1", 28, d(-6), 3, "fail", "Revise Al-Hashr 18–24 and Al-Mujadila 22, then book again."),
    t("s1", 28, TODAY, 1),
    // Omar: Juz 30 passed; his Juz 29 day went by without the test.
    t("s2", 30, d(-19), 2, "pass", "Steady. Keep revising daily."),
    t("s2", 29, d(-5), 4),
    // Safia: two passed, the next booked for tomorrow.
    t("s3", 30, d(-21), 3, "pass", "Excellent."),
    t("s3", 29, d(-6), 1, "pass", "Two small slips in Al-Qalam; otherwise strong."),
    t("s3", 28, d(1), 1),
    // Yusuf: Juz 30 passed; Juz 29 heard this morning.
    t("s4", 30, d(-20), 4, "pass", "Well done."),
    t("s4", 29, TODAY, 2, "pass", "Passed. Practise the ghunnah in Al-Mulk.", DEMO_TEACHER_NAME, "09:20"),
    // Hawa: four passed, the fifth today.
    t("s5", 30, d(-28), 1, "pass", "Excellent."),
    t("s5", 29, d(-23), 2, "pass", "Excellent."),
    t("s5", 28, d(-15), 3, "pass", "Very good."),
    t("s5", 27, d(-7), 2, "pass", "Very good. Keep it up."),
    t("s5", 26, TODAY, 3),
    // Ibrahim: Juz 30 passed, Juz 29 booked on the full day.
    t("s6", 30, d(-14), 4, "pass", "Good."),
    t("s6", 29, d(2), 1),
    // Fatuma: her first, today.
    t("s7", 30, TODAY, 4),
    // Ustadh Bilal's halaqa: today, tomorrow, and the full day.
    t("x1", 30, TODAY, 5),
    t("x2", 29, TODAY, 6),
    t("x2", 28, d(1), 2),
    t("x3", 27, d(1), 3),
    ...OTHERS.slice(0, 9).map((o, i) => t(o.id, 30 - (i % 4), d(2), i + 2)),
  ];
  const id = (student: string, juz: number, date: string) =>
    tests.find((r) => r.student_id === student && r.juz === juz && r.test_date === date)!.id;
  const m = (test_id: string, kind: JuzMistake["kind"], page: number, surah: number, ayah: number, word: number, note: string | null = null) => ({
    id: `jm-${test_id}-${surah}-${ayah}-${word}`,
    test_id,
    kind,
    page,
    surah,
    ayah,
    word,
    note,
  });
  return {
    enabled: true,
    slots: DEFAULT_DAILY_TESTS,
    examiners: ["t1"],
    overrides: {},
    tests,
    mistakes: [
      m(id("s1", 29, d(-9)), "tajweed", 563, 67, 13, 4, "Madd too short"),
      m(id("s1", 28, d(-6)), "memorization", 548, 59, 20, 5, "Skipped to the next ayah"),
      m(id("s1", 28, d(-6)), "memorization", 545, 58, 22, 41),
      m(id("s1", 28, d(-6)), "tajweed", 542, 58, 1, 3, "Ikhfa’"),
      m(id("s3", 29, d(-6)), "tajweed", 565, 68, 17, 2),
      m(id("s3", 29, d(-6)), "memorization", 566, 68, 48, 4, "Needed a prompt"),
      m(id("s4", 29, TODAY), "tajweed", 562, 67, 1, 3, "Ghunnah"),
      m(id("s4", 29, TODAY), "memorization", 564, 67, 27, 2),
      m(id("s5", 29, d(-23)), "tajweed", 562, 67, 1, 6),
    ],
  };
}

function load(): Store {
  return readDemoStore<Store>(KEY, seed());
}
function save(s: Store) {
  writeDemoStore(KEY, s);
}

function studentName(id: string): string {
  return DEMO_STUDENTS.find((s) => s.id === id)?.name ?? OTHERS.find((o) => o.id === id)?.name ?? "A student";
}
function studentHalaqa(id: string): string {
  return DEMO_STUDENTS.find((s) => s.id === id)?.halaqa ?? "Halaqa C";
}
function teacherOf(id: string): string {
  return DEMO_STUDENTS.some((s) => s.id === id) ? DEMO_TEACHER_NAME : BILAL;
}

function named(s: Store, r: Row): JuzTest {
  const { examiner, ...rest } = r;
  return {
    ...rest,
    student_name: studentName(r.student_id),
    teacher_name: teacherOf(r.student_id),
    examiner_name: examiner,
    mistakes: s.mistakes.filter((m) => m.test_id === r.id).length,
  };
}

const json = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));

/** The fetch the Juz test pages call in the sample portal. */
export function demoJuzFetch(role: DemoJuzRole) {
  return async (input: string, init?: RequestInit): Promise<Response> => {
    const url = new URL(input, "https://demo.local");
    const path = url.pathname;
    const method = (init?.method ?? "GET").toUpperCase();
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    const s = load();
    const live = s.tests.filter((r) => !r.cancelled_at);
    const myName = role === "admin" ? OFFICE_NAME : DEMO_TEACHER_NAME;
    const mine = (id: string) => role === "admin" || DEMO_STUDENTS.some((st) => st.id === id);
    const examiner = role === "admin" || s.examiners.includes("t1");

    // ── The booking page ──
    if (path === "/api/juz-tests" && method === "GET") {
      const base = { enabled: s.enabled, examiner, office: role === "admin", today: TODAY, slots: s.slots };
      if (!s.enabled) return json(base);
      const days = bookableDays(TODAY, CAL, s.overrides);
      const ids = role === "admin" ? [...DEMO_STUDENTS.map((st) => st.id), ...OTHERS.map((o) => o.id)] : DEMO_STUDENTS.map((st) => st.id);
      return json({
        ...base,
        days: days.map((day) => ({ date: day, booked: live.filter((r) => r.test_date === day).length })),
        students: ids
          .map((id) => ({
            id,
            name: studentName(id),
            halaqa: studentHalaqa(id),
            passed: live.filter((r) => r.student_id === id && r.result === "pass").map((r) => r.juz).sort((a, b) => a - b),
            waiting: live
              .filter((r) => r.student_id === id && !r.result && r.test_date >= TODAY)
              .map((r) => ({ juz: r.juz, date: r.test_date }))
              .sort((a, b) => a.juz - b.juz),
          }))
          .sort((a, b) => a.name.localeCompare(b.name)),
        tests: live
          .filter((r) => ids.includes(r.student_id) && r.test_date >= addDays(TODAY, -60))
          .sort((a, b) => b.test_date.localeCompare(a.test_date) || a.slot - b.slot)
          .map((r) => named(s, r)),
      });
    }

    if (path === "/api/juz-tests" && method === "POST") {
      const studentId = String(body.student_id ?? "");
      const juz = Number(body.juz);
      const date = String(body.date ?? "");
      const extra = body.extra === true && role === "admin";
      if (!mine(studentId)) return json({ error: "That student isn't one of yours", code: "not_yours" }, 403);
      const allowed = role === "admin" ? date >= TODAY && isTestDay(date, CAL, s.overrides) : bookableDays(TODAY, CAL, s.overrides).includes(date);
      if (!allowed) return json({ error: "Tests can't be booked on that day. Pick one of the days shown.", code: "bad_day" }, 400);
      const name = studentName(studentId);
      if (live.some((r) => r.student_id === studentId && r.juz === juz && r.result === "pass")) {
        return json({ error: `${name} has already passed Juz ${juz}.`, code: "passed", name, juz }, 409);
      }
      const open = live.find((r) => r.student_id === studentId && r.juz === juz && !r.result);
      if (open && open.test_date >= TODAY) return json({ error: "Already booked", code: "booked", name, juz, date: open.test_date }, 409);
      if (open) open.cancelled_at = new Date().toISOString();
      const taken = live.filter((r) => r.test_date === date && !r.cancelled_at).map((r) => r.slot);
      const slot = nextSlot(taken, s.slots) ?? (extra ? extraSlot(taken) : null);
      if (slot === null) {
        const next = testDaysAfter(date, CAL, s.overrides, 30).find((day) => live.filter((r) => r.test_date === day).length < s.slots) ?? null;
        return json({ error: "That day is full.", code: "full", date, next_date: next }, 409);
      }
      const row: Row = {
        id: `jt-${Date.now()}`,
        student_id: studentId,
        juz,
        test_date: date,
        slot,
        result: null,
        comment: null,
        examiner: null,
        tested_at: null,
        cancelled_at: null,
        created_at: new Date().toISOString(),
      };
      s.tests.push(row);
      save(s);
      return json({ ok: true, test: named(s, row) }, 201);
    }

    if (path === "/api/juz-tests" && method === "DELETE") {
      const row = s.tests.find((r) => r.id === url.searchParams.get("id"));
      if (!row || !mine(row.student_id)) return json({ error: "No such booking" }, 404);
      if (row.result) return json({ error: "That test has been heard already, so it can't be cancelled" }, 409);
      row.cancelled_at = new Date().toISOString();
      save(s);
      return json({ ok: true });
    }

    // ── The examiner's day ──
    if (path === "/api/juz-tests/day") {
      if (!examiner) return json({ error: "Only examiners can see the day's tests" }, 403);
      const date = url.searchParams.get("date") || TODAY;
      return json({
        date,
        today: TODAY,
        testDay: isTestDay(date, CAL, s.overrides),
        slots: s.slots,
        tests: live.filter((r) => r.test_date === date).sort((a, b) => a.slot - b.slot).map((r) => named(s, r)),
      });
    }

    // ── One child's record ──
    if (path === "/api/juz-tests/student") {
      const studentId = url.searchParams.get("student_id") ?? "";
      if (role === "parent" && !PARENT_CHILDREN.has(studentId)) return json({ error: "No such student" }, 404);
      if (!s.enabled) return json({ enabled: false });
      const tests = live
        .filter((r) => r.student_id === studentId)
        .sort((a, b) => b.test_date.localeCompare(a.test_date))
        .map((r) => named(s, r));
      const mistakes: Record<string, JuzMistake[]> = {};
      for (const { test_id, ...m } of s.mistakes) {
        if (!tests.some((t) => t.id === test_id)) continue;
        (mistakes[test_id] ??= []).push(m);
      }
      return json({ enabled: true, today: TODAY, summary: testSummary(tests, TODAY), tests, mistakes });
    }

    // ── The office's settings ──
    if (path === "/api/juz-tests/settings" && method === "GET") {
      return json({
        enabled: s.enabled,
        slots: s.slots,
        today: TODAY,
        ready: true,
        staff: [
          { id: "a1", name: OFFICE_NAME, office: true, examiner: true },
          { id: "t1", name: DEMO_TEACHER_NAME, office: false, examiner: s.examiners.includes("t1") },
          { id: "t2", name: BILAL, office: false, examiner: s.examiners.includes("t2") },
        ],
        days: Array.from({ length: 42 }, (_, i) => d(i)).map((date) => {
          const usual = isInstructionalDay(date, CAL);
          const set = date in s.overrides ? s.overrides[date] : null;
          return { date, open: set ?? usual, usual, changed: set !== null && set !== usual, weekend: isWeekend(date) };
        }),
      });
    }
    if (path === "/api/juz-tests/settings" && method === "PATCH") {
      if (typeof body.enabled === "boolean") s.enabled = body.enabled;
      if (body.slots !== undefined) {
        const slots = Number(body.slots);
        if (!Number.isInteger(slots) || slots < 1 || slots > 50) return json({ error: "Tests a day is a number from 1 to 50" }, 400);
        s.slots = slots;
      }
      if (body.examiner) {
        const id = String(body.examiner.user_id);
        s.examiners = s.examiners.filter((e) => e !== id);
        if (body.examiner.on) s.examiners.push(id);
      }
      if (body.day) {
        const date = String(body.day.date);
        if (Boolean(body.day.open) === isInstructionalDay(date, CAL)) delete s.overrides[date];
        else s.overrides[date] = Boolean(body.day.open);
      }
      save(s);
      return json({ ok: true });
    }

    // ── One test, its result and its mistakes ──
    const one = path.match(/^\/api\/juz-tests\/([^/]+)(\/mistakes)?$/);
    if (one) {
      const row = live.find((r) => r.id === one[1]);
      if (!row) return json({ error: "No such test" }, 404);
      const list = () => s.mistakes.filter((m) => m.test_id === row.id).map(({ test_id: _t, ...m }) => m);
      if (!one[2] && method === "GET") return json({ test: named(s, row), mistakes: list(), examiner, today: TODAY });
      if (!examiner) return json({ error: "Only examiners can record a result" }, 403);
      if (!one[2] && method === "PATCH") {
        if (row.test_date > TODAY) return json({ error: "This test is booked for a later day" }, 409);
        if ("comment" in body) row.comment = body.comment ? String(body.comment).trim().slice(0, 1000) || null : null;
        if ("result" in body) {
          row.result = body.result === "pass" ? "pass" : "fail";
          row.examiner = myName;
          row.tested_at = new Date().toISOString();
        }
        save(s);
        return json({ ok: true, test: named(s, row) });
      }
      if (one[2] && method === "POST") {
        const key = (m: { surah: number; ayah: number; word: number }) => `${m.surah}:${m.ayah}:${m.word}`;
        const mark = {
          id: `jm-${Date.now()}`,
          test_id: row.id,
          kind: body.kind === "tajweed" ? ("tajweed" as const) : ("memorization" as const),
          page: Number(body.page),
          surah: Number(body.surah),
          ayah: Number(body.ayah),
          word: Number(body.word),
          note: body.note ? String(body.note).trim().slice(0, 300) || null : null,
        };
        const at = s.mistakes.findIndex((m) => m.test_id === row.id && key(m) === key(mark));
        if (at >= 0) s.mistakes[at] = { ...mark, id: s.mistakes[at].id };
        else s.mistakes.push(mark);
        save(s);
        return json({ ok: true, mistakes: list() });
      }
      if (one[2] && method === "DELETE") {
        s.mistakes = s.mistakes.filter((m) => m.id !== url.searchParams.get("mistake_id"));
        save(s);
        return json({ ok: true, mistakes: list() });
      }
    }
    return json({ error: "Not found" }, 404);
  };
}
