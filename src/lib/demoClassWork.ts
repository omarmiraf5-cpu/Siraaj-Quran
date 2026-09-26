import {
  DEMO_CHILDREN,
  DEMO_CREATED_HALAQAS_KEY,
  DEMO_CREATED_STUDENTS_KEY,
  DEMO_CURRENT_STUDENT,
  DEMO_HALAQA_OVERRIDES_KEY,
  DEMO_STUDENT_OVERRIDES_KEY,
  DEMO_TEACHERS,
  DEMO_TODAY,
  allHalaqas,
  allStudents,
  type HalaqaOverride,
  type StudentOverride,
} from "@/data/demo";
import { readDemoStore, writeDemoStore } from "@/lib/demoStore";
import { addDays } from "@/lib/planDates";
import {
  FILE_LIMITS,
  LIMITS,
  autoMarks,
  needsTeacher,
  parseAnswers,
  parseFileRefs,
  parseMarks,
  parseNewAssignment,
  totalOf,
  type AnswerKey,
  type ClassAssignment,
  type ClassSubmission,
  type ClassWorkItem,
  type StaffAssignment,
} from "@/lib/classWork";

/**
 * Islamic Studies and Arabic work for the sample portal: the same routes as
 * the live site (/api/class-work…) answered in the browser, from a sample
 * school kept in localStorage and checked by the same rules in classWork.ts.
 * The sample teacher, student and parent share it, so work set in the
 * teacher's portal shows up in the child's, and the child's answers in the
 * teacher's marking and the parent's view.
 */

export type ClassWorkRole = "teacher" | "admin" | "student" | "parent";

const KEY = "demo_class_work_v2";
/** Where the sample portal's files live: in the browser, as data URLs, under
 *  paths that only need to look like the real ones. */
export const DEMO_FILES_PREFIX = "demo/";
const TEACHER = DEMO_TEACHERS[0]; // Ms. Farah — the sample teacher account.
const OFFICE = { id: "office", name: "School office" };
const STUDENT = DEMO_CURRENT_STUDENT.id;

interface StoredAssignment extends ClassAssignment {
  key: AnswerKey;
}

interface Store {
  assignments: StoredAssignment[];
  submissions: ClassSubmission[];
}

const at = (daysFromToday: number, time = "16:30") => new Date(`${addDays(DEMO_TODAY, daysFromToday)}T${time}:00-06:00`).toISOString();

function copy(
  assignment_id: string,
  student_id: string,
  status: ClassSubmission["status"],
  extra: Partial<ClassSubmission> = {}
): ClassSubmission {
  return {
    id: `${assignment_id}-${student_id}`,
    assignment_id,
    student_id,
    status,
    answers: {},
    marks: {},
    score: null,
    feedback: null,
    submitted_at: null,
    graded_at: null,
    ...extra,
  };
}

/** The sample school's work: one piece still to do for the sample child,
 *  one handed in and waiting to be marked, one marked. */
function seed(): Store {
  const pillars: StoredAssignment = {
    id: "cw-pillars",
    subject: "islamic_studies",
    title: "The Five Pillars of Islam",
    instructions: "Read pages 12–15 of your Islamic Studies book, then answer the questions.",
    questions: [
      { id: "q1", kind: "choice", prompt: "How many times a day do Muslims pray?", options: ["Three", "Five", "Seven"], points: 2 },
      { id: "q2", kind: "choice", prompt: "Which pillar is fasting in Ramadan?", options: ["Zakah", "Sawm", "Hajj"], points: 2 },
      { id: "q3", kind: "written", prompt: "Name the five pillars of Islam, in order.", points: 5 },
    ],
    key: { q1: 1, q2: 1 },
    max_points: 9,
    due_date: addDays(DEMO_TODAY, 3),
    created_by: TEACHER.id,
    created_at: at(-1),
    attachments: [],
  };
  const days: StoredAssignment = {
    id: "cw-days",
    subject: "arabic",
    title: "Days of the week — أيام الأسبوع",
    instructions: "Learn the days of the week in Arabic.",
    questions: [
      { id: "q1", kind: "choice", prompt: "What is Friday in Arabic?", options: ["الجمعة", "الخميس", "السبت"], points: 1 },
      { id: "q2", kind: "choice", prompt: "What is Sunday in Arabic?", options: ["الاثنين", "الأحد"], points: 1 },
      { id: "q3", kind: "written", prompt: "Write all seven days of the week in Arabic.", points: 4 },
    ],
    key: { q1: 0, q2: 1 },
    max_points: 6,
    due_date: addDays(DEMO_TODAY, -2),
    created_by: TEACHER.id,
    created_at: at(-6),
    attachments: [],
  };
  const wudu: StoredAssignment = {
    id: "cw-wudu",
    subject: "islamic_studies",
    title: "Wudu, step by step",
    instructions: "Use the worksheet to help you.",
    questions: [{ id: "q1", kind: "written", prompt: "Write the steps of wudu in the right order.", points: 6 }],
    key: {},
    max_points: 6,
    due_date: addDays(DEMO_TODAY, -1),
    created_by: TEACHER.id,
    created_at: at(-4),
    attachments: [
      { path: "demo/wudu-worksheet.png", name: "Wudu worksheet.png", size: 12_555, type: "image/png", url: "/demo/wudu-worksheet.png" },
    ],
  };
  const sevenDays = "السبت، الأحد، الاثنين، الثلاثاء، الأربعاء، الخميس، الجمعة";
  return {
    assignments: [pillars, wudu, days],
    submissions: [
      copy(pillars.id, "s1", "assigned"),
      copy(pillars.id, "s2", "submitted", {
        answers: { q1: 1, q2: 1, q3: "Shahada, Salah, Zakah, Sawm and Hajj." },
        marks: { q1: 2, q2: 2 },
        submitted_at: at(0, "08:10"),
      }),
      copy(pillars.id, "s3", "assigned"),
      copy(wudu.id, "s1", "submitted", {
        answers: { q1: "Say bismillah, wash the hands, rinse the mouth, rinse the nose, wash the face, wash the arms to the elbows, wipe the head and ears, wash the feet." },
        submitted_at: at(-1, "18:40"),
      }),
      copy(wudu.id, "s2", "assigned"),
      copy(days.id, "s1", "graded", {
        answers: { q1: 0, q2: 1, q3: sevenDays.replace("الثلاثاء", "الثلاثا") },
        marks: { q1: 1, q2: 1, q3: 3.5 },
        score: 5.5,
        feedback: "Masha'Allah, very good! Check how you spell الثلاثاء.",
        submitted_at: at(-3, "17:20"),
        graded_at: at(-2, "09:15"),
      }),
      copy(days.id, "s2", "graded", {
        answers: { q1: 0, q2: 0, q3: sevenDays },
        marks: { q1: 1, q2: 0, q3: 4 },
        score: 5,
        feedback: "Good work. Sunday is الأحد.",
        submitted_at: at(-3, "19:05"),
        graded_at: at(-2, "09:20"),
      }),
      copy(days.id, "s3", "submitted", {
        answers: { q1: 0, q2: 1, q3: sevenDays },
        marks: { q1: 1, q2: 1 },
        submitted_at: at(-2, "07:55"),
      }),
    ],
  };
}

function load(): Store {
  const s = readDemoStore<Store | null>(KEY, null);
  return s && Array.isArray(s.assignments) && Array.isArray(s.submissions) ? s : seed();
}
const save = (s: Store) => writeDemoStore(KEY, s);

const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function roster() {
  const students = allStudents(
    readDemoStore(DEMO_CREATED_STUDENTS_KEY, []),
    readDemoStore<Record<string, StudentOverride>>(DEMO_STUDENT_OVERRIDES_KEY, {})
  ).filter((s) => s.active !== false);
  const halaqas = allHalaqas(
    readDemoStore(DEMO_CREATED_HALAQAS_KEY, []),
    readDemoStore<Record<string, HalaqaOverride>>(DEMO_HALAQA_OVERRIDES_KEY, {})
  ).map((h) => h.name);
  return { students: students.map((s) => ({ id: s.id, name: s.name, halaqa: s.halaqa })), halaqas };
}

const setBy = (a: ClassAssignment) =>
  a.created_by === OFFICE.id ? OFFICE.name : DEMO_TEACHERS.find((t) => t.id === a.created_by)?.name ?? null;

/** What a child or parent is shown: the work without its key. */
function publicAssignment(a: StoredAssignment): ClassAssignment {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { key, ...rest } = a;
  return rest;
}

async function readBody(init?: RequestInit): Promise<Record<string, unknown>> {
  try {
    return JSON.parse(String(init?.body ?? "{}"));
  } catch {
    return {};
  }
}

export function demoClassWorkFetch(role: ClassWorkRole) {
  return async (input: string, init?: RequestInit): Promise<Response> => {
    const url = new URL(input, "http://demo.local");
    const method = (init?.method ?? "GET").toUpperCase();
    const staff = role === "teacher" || role === "admin";
    const store = load();
    const [, , , id, action] = url.pathname.split("/"); // /api/class-work/:id/:action
    const findA = (aid: string) =>
      store.assignments.find((a) => a.id === aid && (role !== "teacher" || a.created_by === TEACHER.id));

    if (url.pathname === "/api/class-work" && method === "GET") {
      if (staff) {
        const assignments: StaffAssignment[] = store.assignments
          .filter((a) => role === "admin" || a.created_by === TEACHER.id)
          .map((a) => {
            const subs = store.submissions.filter((s) => s.assignment_id === a.id);
            return {
              ...publicAssignment(a),
              set_by: setBy(a),
              counts: {
                assigned: subs.filter((s) => s.status === "assigned").length,
                submitted: subs.filter((s) => s.status === "submitted").length,
                graded: subs.filter((s) => s.status === "graded").length,
              },
            };
          });
        return reply({ role, assignments, roster: roster() });
      }
      const mine = role === "student" ? [STUDENT] : DEMO_CHILDREN.map((c) => c.id);
      const items: ClassWorkItem[] = store.submissions
        .filter((s) => mine.includes(s.student_id))
        .flatMap((s) => {
          const a = store.assignments.find((x) => x.id === s.assignment_id);
          return a ? [{ assignment: publicAssignment(a), submission: s, set_by: setBy(a) }] : [];
        });
      return reply(
        role === "parent"
          ? { role, children: DEMO_CHILDREN.map((c) => ({ id: c.id, name: c.name })), items }
          : { role, items }
      );
    }

    // The sample portal keeps its files in the browser: the page reads each
    // one as a data URL itself, so there is no upload link to hand out.
    if (url.pathname === "/api/class-work/files" && method === "POST") {
      return reply({ demo: true, prefix: DEMO_FILES_PREFIX });
    }

    if (url.pathname === "/api/class-work" && method === "POST") {
      if (!staff) return reply({ error: "This page isn't available for your account" }, 403);
      const body = await readBody(init);
      const parsed = parseNewAssignment(body);
      if (!parsed.ok) return reply({ error: parsed.error }, 400);
      const files = parseFileRefs(body.attachments, DEMO_FILES_PREFIX, FILE_LIMITS.perAssignment);
      if (!files.ok) return reply({ error: files.error }, 400);
      // parseFileRefs drops the link; here the data URL is the file itself.
      const withData = files.value.map((f, i) => ({ ...f, url: (body.attachments as Array<{ url?: string }>)[i]?.url }));
      const known = new Set(roster().students.map((s) => s.id));
      if (parsed.value.student_ids.some((sid) => !known.has(sid))) {
        return reply({ error: "Some of those students aren't in your school." }, 400);
      }
      const v = parsed.value;
      const a: StoredAssignment = {
        id: `cw-${Date.now().toString(36)}`,
        subject: v.subject,
        title: v.title,
        instructions: v.instructions,
        questions: v.questions,
        key: v.key,
        max_points: v.max_points,
        due_date: v.due_date,
        created_by: role === "admin" ? OFFICE.id : TEACHER.id,
        created_at: new Date().toISOString(),
        attachments: withData,
      };
      store.assignments.unshift(a);
      store.submissions.push(...v.student_ids.map((sid) => copy(a.id, sid, "assigned")));
      save(store);
      return reply({ assignment: publicAssignment(a), students: v.student_ids.length }, 201);
    }

    if (!id) return reply({ error: `The sample portal has no ${method} ${url.pathname}` }, 404);

    if (!action && method === "GET") {
      if (!staff) return reply({ error: "This page isn't available for your account" }, 403);
      const a = findA(id);
      if (!a) return reply({ error: "That assignment isn't there any more." }, 404);
      const names = new Map(roster().students.map((s) => [s.id, s.name]));
      return reply({
        assignment: publicAssignment(a),
        key: a.key,
        submissions: store.submissions
          .filter((s) => s.assignment_id === id)
          .map((s) => ({ ...s, student_name: names.get(s.student_id) ?? "Student" }))
          .sort((x, y) => x.student_name.localeCompare(y.student_name)),
      });
    }

    if (!action && method === "PATCH") {
      if (!staff) return reply({ error: "This page isn't available for your account" }, 403);
      const a = findA(id);
      if (!a) return reply({ error: "That assignment isn't there any more." }, 404);
      const b = await readBody(init);
      if (typeof b.title === "string") {
        if (!b.title.trim() || b.title.trim().length > LIMITS.title) return reply({ error: "Give the assignment a title." }, 400);
        a.title = b.title.trim();
      }
      if (typeof b.instructions === "string") a.instructions = b.instructions.trim().slice(0, LIMITS.instructions);
      if (b.due_date !== undefined) a.due_date = typeof b.due_date === "string" && b.due_date ? b.due_date : null;
      save(store);
      return reply({ assignment: publicAssignment(a) });
    }

    if (!action && method === "DELETE") {
      if (!staff) return reply({ error: "This page isn't available for your account" }, 403);
      if (!findA(id)) return reply({ error: "That assignment isn't there any more." }, 404);
      store.assignments = store.assignments.filter((a) => a.id !== id);
      store.submissions = store.submissions.filter((s) => s.assignment_id !== id);
      save(store);
      return reply({ deleted: id });
    }

    if (action === "submit" && method === "POST") {
      if (role !== "student") return reply({ error: "This page isn't available for your account" }, 403);
      const a = store.assignments.find((x) => x.id === id);
      const s = store.submissions.find((x) => x.assignment_id === id && x.student_id === STUDENT);
      if (!a || !s) return reply({ error: "That assignment isn't one of yours." }, 404);
      if (s.status !== "assigned") return reply({ error: "You've already handed this in." }, 409);
      const sent = (await readBody(init)).answers as Record<string, unknown> | undefined;
      const parsed = parseAnswers(a.questions, sent, DEMO_FILES_PREFIX);
      if (!parsed.ok) return reply({ error: parsed.error }, 400);
      if (Object.keys(parsed.value).length === 0) {
        return reply({ error: "Answer at least one question before you hand it in." }, 400);
      }
      const now = new Date().toISOString();
      const markedNow = !needsTeacher(a.questions);
      // Put each handed-in file's data URL back with it (see above).
      for (const q of a.questions) {
        const got = parsed.value[q.id];
        const orig = sent?.[q.id];
        if (Array.isArray(got) && Array.isArray(orig)) {
          parsed.value[q.id] = got.map((f, i) => ({ ...f, url: (orig[i] as { url?: string })?.url }));
        }
      }
      s.answers = parsed.value;
      s.marks = autoMarks(a.questions, a.key, parsed.value);
      s.status = markedNow ? "graded" : "submitted";
      s.submitted_at = now;
      s.feedback = null;
      s.score = markedNow ? totalOf(s.marks) : null;
      s.graded_at = markedNow ? now : null;
      save(store);
      return reply({ submission: s });
    }

    if ((action === "grade" || action === "reopen") && method === "POST") {
      if (!staff) return reply({ error: "This page isn't available for your account" }, 403);
      const a = findA(id);
      if (!a) return reply({ error: "That assignment isn't there any more." }, 404);
      const b = await readBody(init);
      const s = store.submissions.find((x) => x.assignment_id === id && x.student_id === b.student_id);
      if (!s) return reply({ error: "This assignment wasn't set for that student." }, 404);
      const feedback = typeof b.feedback === "string" ? b.feedback.trim() : "";
      if (feedback.length > LIMITS.feedback) return reply({ error: "Keep the comment a little shorter." }, 400);
      const now = new Date().toISOString();
      if (action === "grade") {
        const marks = parseMarks(a.questions, a.key, s.answers, b.marks);
        if (!marks.ok) return reply({ error: marks.error }, 400);
        Object.assign(s, { marks: marks.value, score: totalOf(marks.value), feedback: feedback || null, status: "graded", graded_at: now });
      } else {
        Object.assign(s, { status: "assigned", marks: {}, score: null, graded_at: null, submitted_at: null, feedback: feedback || null });
      }
      save(store);
      return reply({ submission: s });
    }

    return reply({ error: `The sample portal has no ${method} ${url.pathname}` }, 404);
  };
}
