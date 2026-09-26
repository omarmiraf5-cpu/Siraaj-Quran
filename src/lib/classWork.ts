// Islamic Studies and Arabic assignments: the work a teacher or the office
// sets outside the Qur'an, which a child answers in their own portal, the
// teacher marks, and the child's parents can follow.
//
// The shapes and rules here are shared by the API routes, the sample portal
// (demoClassWork.ts) and the pages, so an assignment is checked and marked
// the same way wherever it is handled.

export const SUBJECTS = ["islamic_studies", "arabic"] as const;
export type Subject = (typeof SUBJECTS)[number];

/** A written answer, a multiple-choice pick, or photos and files of work
 *  done on paper (a worksheet, Arabic handwriting). */
export type QuestionKind = "written" | "choice" | "upload";

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
 *  index of the option they picked for a multiple-choice one, the files
 *  they handed in for an upload one. */
export type Answers = Record<string, string | number | FileRef[]>;

/* ── Files ─────────────────────────────────────────────────────────── */

/** A file attached to an assignment by its teacher, or handed in by a child. */
export interface FileRef {
  /** Where it's kept in the school's private storage. */
  path: string;
  /** Its name as it was uploaded. */
  name: string;
  size: number;
  type: string;
  /** A short-lived link to open it — added when the file is sent to someone
   *  allowed to see it, never stored. */
  url?: string;
}

/** The private Supabase Storage bucket the files live in. */
export const FILE_BUCKET = "class-work";

export const FILE_LIMITS = {
  maxBytes: 25 * 1024 * 1024,
  perAssignment: 10,
  perAnswer: 10,
  name: 150,
} as const;

const TYPE_BY_EXTENSION: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  heic: "image/heic",
  heif: "image/heif",
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  txt: "text/plain",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  aac: "audio/aac",
  wav: "audio/wav",
  ogg: "audio/ogg",
  webm: "audio/webm",
};
export const FILE_TYPES: readonly string[] = [...new Set(Object.values(TYPE_BY_EXTENSION))];

/** What the file picker offers. */
export const FILE_ACCEPT = "image/*,application/pdf,.doc,.docx,.ppt,.pptx,.txt,audio/*";

/**
 * The file's type as the portal knows it — from what the browser said or,
 * when it said nothing useful (it often doesn't for Word files), from the
 * name. Null for anything the portal doesn't take.
 */
export function fileType(name: string, declared: string | null | undefined): string | null {
  const t = (declared ?? "").toLowerCase();
  if (t === "audio/x-m4a" || t === "audio/m4a") return "audio/mp4";
  if (t === "audio/mp3") return "audio/mpeg";
  if (FILE_TYPES.includes(t)) return t;
  const ext = name.toLowerCase().split(".").pop() ?? "";
  return TYPE_BY_EXTENSION[ext] ?? null;
}

/** A name storage accepts: plain letters and digits only (it refuses Arabic
 *  and most punctuation in a key), keeping the extension. The name people
 *  see stays as it was uploaded. */
export function storageName(name: string): string {
  const dot = name.lastIndexOf(".");
  const ext = dot > 0 ? name.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8) : "";
  const base = (dot > 0 ? name.slice(0, dot) : name)
    .normalize("NFKD")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 60);
  return `${base || "file"}${ext ? `.${ext}` : ""}`;
}

export function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(/\.0$/, "")} MB`;
}

export const isImage = (f: Pick<FileRef, "type">) => f.type.startsWith("image/") && f.type !== "image/heic" && f.type !== "image/heif";

/**
 * Files someone says they uploaded, checked: each has to be somewhere under
 * `prefix` — the caller's own school's (and, for a child, their own) part
 * of storage — so nobody can attach a file from another school or hand in
 * another child's. Any link that came with them is dropped.
 */
export function parseFileRefs(raw: unknown, prefix: string, max: number): Result<FileRef[]> {
  if (raw === undefined || raw === null) return { ok: true, value: [] };
  if (!Array.isArray(raw)) return { ok: false, error: "Those files weren't readable." };
  if (raw.length > max) return { ok: false, error: `Up to ${max} files.` };
  const files: FileRef[] = [];
  for (const f of raw) {
    const r = (f ?? {}) as Record<string, unknown>;
    const path = typeof r.path === "string" ? r.path : "";
    if (!path.startsWith(prefix) || path.includes("..") || path.length > 400) {
      return { ok: false, error: "One of those files isn't yours to attach." };
    }
    const name = typeof r.name === "string" ? r.name.trim().slice(0, FILE_LIMITS.name) : "";
    const size = Number(r.size);
    const type = fileType(name, typeof r.type === "string" ? r.type : "");
    if (!name || !type || !Number.isFinite(size) || size <= 0 || size > FILE_LIMITS.maxBytes) {
      return { ok: false, error: "One of those files can't be attached." };
    }
    files.push({ path, name, size, type });
  }
  return { ok: true, value: files };
}

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
  /** The teacher's own files for the work: a worksheet, a page to read. */
  attachments: FileRef[];
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
    const kind = r.kind === "choice" || r.kind === "written" || r.kind === "upload" ? (r.kind as QuestionKind) : null;
    if (!kind) return { ok: false, error: `Question ${n}: choose a written answer, multiple choice or an upload.` };
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
/**
 * A child's answers, keeping only real answers to this assignment's
 * questions. Files handed in for an upload question have to be in
 * `uploadPrefix`, the child's own part of storage for this assignment.
 */
export function parseAnswers(questions: Question[], body: unknown, uploadPrefix = ""): Result<Answers> {
  const b = (body ?? {}) as Record<string, unknown>;
  const answers: Answers = {};
  for (const q of questions) {
    const v = b[q.id];
    if (v === undefined || v === null || v === "") continue;
    if (q.kind === "upload") {
      if (!uploadPrefix) return { ok: false, error: "Files can't be handed in here." };
      const files = parseFileRefs(v, uploadPrefix, FILE_LIMITS.perAnswer);
      if (!files.ok) return files;
      if (files.value.length) answers[q.id] = files.value;
    } else if (q.kind === "choice") {
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
  return questions.some((q) => q.kind !== "choice");
}

/** Whether a question has been answered at all. */
export function isAnswered(q: Question, a: Answers[string] | undefined): boolean {
  if (a === undefined || a === "") return false;
  return q.kind === "upload" ? Array.isArray(a) && a.length > 0 : true;
}

/** Every file a submission's answers hold. */
export function answerFiles(answers: Answers): FileRef[] {
  return Object.values(answers).flatMap((a) => (Array.isArray(a) ? a : []));
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
