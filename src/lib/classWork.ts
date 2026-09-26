// Islamic Studies and Arabic assignments: the work a teacher or the office
// sets outside the Qur'an, which a child answers in their own portal, the
// teacher marks, and the child's parents can follow.
//
// The shapes and rules here are shared by the API routes, the sample portal
// (demoClassWork.ts) and the pages, so an assignment is checked and marked
// the same way wherever it is handled.

export const SUBJECTS = ["islamic_studies", "arabic"] as const;
export type Subject = (typeof SUBJECTS)[number];

export type QuestionKind = "written" | "choice";

export interface Question {
  /** Stable within its assignment: "q1", "q2"… */
  id: string;
  kind: QuestionKind;
  prompt: string;
  /** The options a child picks from, for a multiple-choice question. */
  options?: string[];
  points: number;
}

/**
 * The right option of each multiple-choice question, by question id. Only
 * staff ever see it: it is stored apart from the questions, which children
 * can read.
 */
export type AnswerKey = Record<string, number>;

/** A child's answers, by question id: text for a written question, the
 *  index of the option they picked for a multiple-choice one. */
export type Answers = Record<string, string | number>;

/** Points given for each question, by question id. */
export type Marks = Record<string, number>;

export type SubmissionStatus = "assigned" | "submitted" | "graded";

export interface ClassAssignment {
  id: string;
  subject: Subject;
  title: string;
  instructions: string;
  questions: Question[];
  max_points: number;
  due_date: string | null;
  created_by: string;
  created_at: string;
}

export interface ClassSubmission {
  id: string;
  assignment_id: string;
  student_id: string;
  status: SubmissionStatus;
  answers: Answers;
  marks: Marks;
  score: number | null;
  feedback: string | null;
  submitted_at: string | null;
  graded_at: string | null;
}

/** An assignment as a child or parent sees it: the work and one child's copy of it. */
export interface ClassWorkItem {
  assignment: ClassAssignment;
  submission: ClassSubmission;
  /** Who set it, for the parent's view. */
  set_by: string | null;
}

/** An assignment as its teacher sees it in the list, with how the class is getting on. */
export interface StaffAssignment extends ClassAssignment {
  set_by: string | null;
  counts: { assigned: number; submitted: number; graded: number };
}

export interface RosterStudent {
  id: string;
  name: string;
  /** The halaqa they're in, or "" when they're in none the caller can see. */
  halaqa: string;
}

export const LIMITS = {
  title: 120,
  instructions: 4000,
  prompt: 1000,
  option: 200,
  minOptions: 2,
  maxOptions: 6,
  questions: 40,
  points: 100,
  writtenAnswer: 5000,
  feedback: 2000,
  students: 500,
} as const;

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

const isDate = (s: unknown): s is string =>
  typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) &&
  new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;

const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");

export interface NewAssignment {
  subject: Subject;
  title: string;
  instructions: string;
  due_date: string | null;
  questions: Question[];
  key: AnswerKey;
  max_points: number;
  student_ids: string[];
}

/**
 * What a teacher sent to create an assignment, checked and put in order: the
 * questions numbered, the right answers lifted out into the key, and the
 * total the work is marked out of.
 */
export function parseNewAssignment(body: unknown): Result<NewAssignment> {
  const b = (body ?? {}) as Record<string, unknown>;
  if (!SUBJECTS.includes(b.subject as Subject)) {
    return { ok: false, error: "Choose Islamic Studies or Arabic." };
  }
  const title = text(b.title);
  if (!title) return { ok: false, error: "Give the assignment a title." };
  if (title.length > LIMITS.title) return { ok: false, error: `Keep the title under ${LIMITS.title} characters.` };
  const instructions = text(b.instructions);
  if (instructions.length > LIMITS.instructions) {
    return { ok: false, error: `Keep the instructions under ${LIMITS.instructions} characters.` };
  }
  const due = b.due_date === null || b.due_date === undefined || b.due_date === "" ? null : b.due_date;
  if (due !== null && !isDate(due)) return { ok: false, error: "That due date isn't a real date." };

  const raw = Array.isArray(b.questions) ? b.questions : [];
  if (raw.length === 0) return { ok: false, error: "Add at least one question." };
  if (raw.length > LIMITS.questions) return { ok: false, error: `An assignment can have up to ${LIMITS.questions} questions.` };

  const questions: Question[] = [];
  const key: AnswerKey = {};
  for (const [i, q] of raw.entries()) {
    const n = i + 1;
    const r = (q ?? {}) as Record<string, unknown>;
    const kind = r.kind === "choice" ? "choice" : r.kind === "written" ? "written" : null;
    if (!kind) return { ok: false, error: `Question ${n}: choose a written answer or multiple choice.` };
    const prompt = text(r.prompt);
    if (!prompt) return { ok: false, error: `Question ${n} is empty.` };
    if (prompt.length > LIMITS.prompt) return { ok: false, error: `Question ${n} is too long.` };
    const points = Number(r.points);
    if (!Number.isInteger(points) || points < 1 || points > LIMITS.points) {
      return { ok: false, error: `Question ${n}: points must be a whole number from 1 to ${LIMITS.points}.` };
    }
    const id = `q${n}`;
    if (kind === "choice") {
      const options = (Array.isArray(r.options) ? r.options : []).map(text);
      if (options.length < LIMITS.minOptions || options.length > LIMITS.maxOptions) {
        return { ok: false, error: `Question ${n}: give ${LIMITS.minOptions} to ${LIMITS.maxOptions} choices.` };
      }
      if (options.some((o) => !o)) return { ok: false, error: `Question ${n}: one of the choices is empty.` };
      if (options.some((o) => o.length > LIMITS.option)) return { ok: false, error: `Question ${n}: a choice is too long.` };
      if (new Set(options).size !== options.length) return { ok: false, error: `Question ${n}: two choices are the same.` };
      const correct = Number(r.correct);
      if (!Number.isInteger(correct) || correct < 0 || correct >= options.length) {
        return { ok: false, error: `Question ${n}: mark which choice is right.` };
      }
      questions.push({ id, kind, prompt, options, points });
      key[id] = correct;
    } else {
      questions.push({ id, kind, prompt, points });
    }
  }

  const ids = Array.isArray(b.student_ids) ? b.student_ids.filter((s): s is string => typeof s === "string" && s.length > 0) : [];
  const student_ids = [...new Set(ids)];
  if (student_ids.length === 0) return { ok: false, error: "Choose who the assignment is for." };
  if (student_ids.length > LIMITS.students) return { ok: false, error: "That's too many students for one assignment." };

  return {
    ok: true,
    value: {
      subject: b.subject as Subject,
      title,
      instructions,
      due_date: due,
      questions,
      key,
      max_points: questions.reduce((sum, q) => sum + q.points, 0),
      student_ids,
    },
  };
}

/** A child's answers, keeping only real answers to this assignment's questions. */
export function parseAnswers(questions: Question[], body: unknown): Result<Answers> {
  const b = (body ?? {}) as Record<string, unknown>;
  const answers: Answers = {};
  for (const q of questions) {
    const v = b[q.id];
    if (v === undefined || v === null || v === "") continue;
    if (q.kind === "choice") {
      const pick = Number(v);
      if (!Number.isInteger(pick) || pick < 0 || pick >= (q.options?.length ?? 0)) {
        return { ok: false, error: "One of the answers isn't one of the choices." };
      }
      answers[q.id] = pick;
    } else {
      if (typeof v !== "string") return { ok: false, error: "A written answer has to be text." };
      const t = v.trim();
      if (t.length > LIMITS.writtenAnswer) return { ok: false, error: "One of the answers is too long." };
      if (t) answers[q.id] = t;
    }
  }
  return { ok: true, value: answers };
}

/** Points for the questions that mark themselves: full marks for the right choice, none otherwise. */
export function autoMarks(questions: Question[], key: AnswerKey, answers: Answers): Marks {
  const marks: Marks = {};
  for (const q of questions) {
    if (q.kind !== "choice") continue;
    marks[q.id] = answers[q.id] !== undefined && answers[q.id] === key[q.id] ? q.points : 0;
  }
  return marks;
}

/** Whether the work has anything a teacher has to read and mark by hand. */
export function needsTeacher(questions: Question[]): boolean {
  return questions.some((q) => q.kind === "written");
}

/**
 * The marks a teacher gave, checked against each question's points. A
 * multiple-choice question they left alone keeps the mark it earned itself.
 */
export function parseMarks(questions: Question[], key: AnswerKey, answers: Answers, body: unknown): Result<Marks> {
  const b = (body ?? {}) as Record<string, unknown>;
  const auto = autoMarks(questions, key, answers);
  const marks: Marks = {};
  for (const q of questions) {
    const v = b[q.id];
    if (v === undefined || v === null || v === "") {
      if (q.kind === "choice") {
        marks[q.id] = auto[q.id] ?? 0;
        continue;
      }
      return { ok: false, error: `Give a mark for question ${q.id.slice(1)}.` };
    }
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0 || n > q.points) {
      return { ok: false, error: `Question ${q.id.slice(1)} is out of ${q.points}.` };
    }
    // Halves are as fine as a teacher wants to go.
    marks[q.id] = Math.round(n * 2) / 2;
  }
  return { ok: true, value: marks };
}

export function totalOf(marks: Marks): number {
  return Math.round(Object.values(marks).reduce((sum, m) => sum + m, 0) * 100) / 100;
}

export function percentOf(score: number, max: number): number {
  return max > 0 ? Math.round((score / max) * 100) : 0;
}

/** "8 / 10" — or "8.5 / 10". */
export function scoreLine(score: number, max: number): string {
  const s = Number.isInteger(score) ? String(score) : score.toFixed(1).replace(/\.0$/, "");
  return `${s} / ${max}`;
}

/** Whether a piece of work is past its due date and still hasn't been handed in. */
export function isOverdue(status: SubmissionStatus, due: string | null, today: string): boolean {
  return status === "assigned" && due !== null && due < today;
}
