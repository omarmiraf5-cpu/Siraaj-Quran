"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { demoClassWorkFetch, type ClassWorkRole } from "@/lib/demoClassWork";
import { DEMO_TODAY, formatDay } from "@/data/demo";
import { useLanguage } from "@/components/LanguageProvider";
import { Modal, SegmentedSwitch, EmptyNote, LoadingNote, StatTile } from "@/components/portal-ui";
import { PortalHero } from "@/components/PortalHero";
import { ILLUM_CLASS, ProgressRing, FriendlyEmpty, type IllumColour } from "@/components/student-ui";
import { IconCheck, IconX, IconPen } from "@/components/icons";
import {
  FILE_ACCEPT,
  FILE_BUCKET,
  FILE_LIMITS,
  LIMITS,
  SUBJECTS,
  fileSize,
  fileType,
  isAnswered,
  isImage,
  isOverdue,
  percentOf,
  scoreLine,
  type AnswerKey,
  type Answers,
  type ClassAssignment,
  type ClassSubmission,
  type ClassWorkItem,
  type FileRef,
  type Question,
  type RosterStudent,
  type StaffAssignment,
  type Subject,
  type SubmissionStatus,
} from "@/lib/classWork";

/* ── Which portal is this ──────────────────────────────────────────── */

type Api = (input: string, init?: RequestInit) => Promise<Response>;
type Mode = "loading" | "demo" | "real";

/** The live routes for a signed-in school; demoClassWork.ts answering the
 *  same routes in the browser for the sample portal. */
export function useClassWorkApi(role: ClassWorkRole): { mode: Mode; api: Api } {
  const [mode, setMode] = useState<Mode>("loading");
  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data: { user } }) => setMode(user ? "real" : "demo"))
      .catch(() => setMode("demo"));
  }, []);
  const api = useCallback<Api>(
    (input, init) => (mode === "demo" ? demoClassWorkFetch(role)(input, init) : fetch(input, init)),
    [mode, role]
  );
  return { mode, api };
}

async function call<T>(api: Api, url: string, method = "GET", body?: unknown): Promise<T> {
  const res = await api(url, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "That didn't go through. Please try again.");
  return data as T;
}

/** Today where the reader is — or the sample portal's own fixed day. */
function todayFor(mode: Mode): string {
  if (mode === "demo") return DEMO_TODAY;
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/* ── Files ─────────────────────────────────────────────────────────── */

/** Files the sample portal can take: they're kept in this browser. */
const DEMO_MAX_BYTES = 1024 * 1024;

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error(`“${file.name}” couldn't be read.`));
    r.readAsDataURL(file);
  });
}

/**
 * Uploads one file for the work: straight to the school's private storage,
 * with a one-time link the server hands out once it has checked who is
 * asking — or, in the sample portal, into the page itself as a data URL.
 */
async function uploadFile(
  api: Api,
  mode: Mode,
  file: File,
  purpose: "assignment" | "answer",
  assignmentId?: string
): Promise<FileRef> {
  const type = fileType(file.name, file.type);
  if (!type) throw new Error(`“${file.name}” can't be uploaded. Use a photo, a PDF, a Word or PowerPoint file, or a recording.`);
  if (file.size > FILE_LIMITS.maxBytes) throw new Error(`“${file.name}” is too big — the most is ${fileSize(FILE_LIMITS.maxBytes)}.`);
  const link = await call<{ path?: string; token?: string; demo?: boolean; prefix?: string }>(api, "/api/class-work/files", "POST", {
    purpose,
    assignment_id: assignmentId,
    name: file.name,
    type,
    size: file.size,
  });
  if (link.demo || mode === "demo") {
    if (file.size > DEMO_MAX_BYTES) {
      throw new Error(`The sample portal keeps files in this browser, so they can be up to ${fileSize(DEMO_MAX_BYTES)} here.`);
    }
    return {
      path: `${link.prefix ?? "demo/"}${Date.now().toString(36)}-${file.name}`,
      name: file.name,
      size: file.size,
      type,
      url: await readAsDataUrl(file),
    };
  }
  const { error } = await createClient()
    .storage.from(FILE_BUCKET)
    .uploadToSignedUrl(link.path!, link.token!, file, { contentType: type });
  if (error) throw new Error(`“${file.name}” didn't finish uploading. Please try again.`);
  // A local preview until the server sends back a link of its own.
  return { path: link.path!, name: file.name, size: file.size, type, url: URL.createObjectURL(file) };
}

const PaperClip = ({ size = 15 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M21.4 11.05 12.2 20.2a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5" />
  </svg>
);

function fileBadge(f: FileRef): string {
  if (f.type === "application/pdf") return "PDF";
  if (f.type.includes("word") || f.type === "application/msword") return "DOC";
  if (f.type.includes("presentation") || f.type.includes("powerpoint")) return "PPT";
  if (f.type.startsWith("audio/")) return "♪";
  if (f.type.startsWith("image/")) return "IMG";
  return "TXT";
}

/** Files as a row of tiles: a picture's own thumbnail, a badge otherwise.
 *  Each opens in a new tab; with onRemove, each can be taken off. */
function FileChips({ files, onRemove }: { files: FileRef[]; onRemove?: (i: number) => void }) {
  const { t } = useLanguage();
  if (files.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-2">
      {files.map((f, i) => {
        const body = (
          <>
            {isImage(f) && f.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={f.url} alt="" className="w-12 h-12 rounded-lg object-cover border border-surface-border flex-shrink-0" />
            ) : (
              <span className="w-12 h-12 rounded-lg bg-surface-bg-warm border border-surface-border flex items-center justify-center text-[11px] font-bold text-ink-muted flex-shrink-0">
                {fileBadge(f)}
              </span>
            )}
            <span className="min-w-0 text-start">
              <span className="block text-[12.5px] font-semibold text-ink truncate max-w-[170px]" dir="auto">
                {f.name}
              </span>
              <span className="block text-[11px] text-ink-muted">{fileSize(f.size)}</span>
            </span>
          </>
        );
        return (
          <li key={`${f.path}-${i}`} className="relative">
            {f.url ? (
              <a
                href={f.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2.5 rounded-xl border border-surface-border bg-surface-card ps-1.5 pe-3 py-1.5 hover:bg-surface-bg-warm transition"
              >
                {body}
              </a>
            ) : (
              <span className="flex items-center gap-2.5 rounded-xl border border-surface-border bg-surface-card ps-1.5 pe-3 py-1.5">{body}</span>
            )}
            {onRemove && (
              <button
                type="button"
                onClick={() => onRemove(i)}
                aria-label={`${t("cw.remove")} ${f.name}`}
                className="absolute -top-2 -end-2 w-6 h-6 rounded-full bg-surface-card border border-surface-border text-ink-muted hover:text-red-700 flex items-center justify-center shadow-sm"
              >
                <IconX size={12} />
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** A button that opens the file picker; the files chosen go to onFiles. */
function FilePicker({ label, busy, onFiles }: { label: string; busy: boolean; onFiles: (files: File[]) => void }) {
  const { t } = useLanguage();
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={ref}
        type="file"
        accept={FILE_ACCEPT}
        multiple
        className="hidden"
        onChange={(e) => {
          const list = Array.from(e.target.files ?? []);
          e.target.value = "";
          if (list.length) onFiles(list);
        }}
      />
      <button type="button" disabled={busy} onClick={() => ref.current?.click()} className={`${quietButton} inline-flex items-center gap-2`}>
        <PaperClip />
        {busy ? t("cw.uploading") : label}
      </button>
    </>
  );
}

/* ── Small pieces ──────────────────────────────────────────────────── */

type T = (key: string) => string;
const pointsText = (n: number, t: T) => `${n} ${n === 1 ? t("cw.point") : t("cw.points")}`;
const questionsText = (n: number, t: T) => `${n} ${n === 1 ? t("cw.questionOne") : t("cw.questionMany")}`;

const SUBJECT_COLOUR: Record<Subject, IllumColour> = { islamic_studies: "verdigris", arabic: "lapis" };

export function SubjectChip({ subject }: { subject: Subject }) {
  const { t } = useLanguage();
  return (
    <span className={`${ILLUM_CLASS[SUBJECT_COLOUR[subject]]} inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide whitespace-nowrap`}>
      {t(`cw.${subject}`)}
    </span>
  );
}

const STATUS_STYLE: Record<SubmissionStatus | "overdue", string> = {
  assigned: "bg-slate-100 text-slate-700 dark:bg-slate-800/40 dark:text-slate-300",
  submitted: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  graded: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  overdue: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

export function StatusChip({ status, overdue = false }: { status: SubmissionStatus; overdue?: boolean }) {
  const { t } = useLanguage();
  const key = overdue ? "overdue" : status;
  return (
    <span className={`text-[10.5px] font-semibold px-2 py-1 rounded-full whitespace-nowrap ${STATUS_STYLE[key]}`}>
      {t(`cw.status.${key}`)}
    </span>
  );
}

function DueLine({ due, today, done }: { due: string | null; today: string; done: boolean }) {
  const { t, language } = useLanguage();
  if (!due) return <span className="text-[12px] text-ink-muted">{t("cw.noDue")}</span>;
  const late = !done && due < today;
  return (
    <span className={`text-[12px] ${late ? "text-red-700 dark:text-red-300 font-semibold" : "text-ink-muted"}`}>
      {t("cw.due")} {formatDay(due, language)}
    </span>
  );
}

const input =
  "w-full bg-surface-card border border-surface-border rounded-xl px-3.5 py-2.5 text-[14px] text-ink focus:outline-none focus:border-brand-navy focus:ring-1 focus:ring-brand-navy/30 transition";
const primaryButton =
  "bg-brand-navy text-white text-[13px] font-semibold py-2.5 px-5 rounded-xl disabled:opacity-40 active:scale-[.98] transition-all";
const quietButton =
  "bg-surface-card border border-surface-border text-ink text-[13px] font-semibold py-2.5 px-4 rounded-xl hover:bg-surface-bg-warm disabled:opacity-40 active:scale-[.98] transition-all";

function ErrorLine({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="text-[12.5px] text-red-700 dark:text-red-300 leading-relaxed">
      {children}
    </p>
  );
}

/* ── One question, answered ────────────────────────────────────────── */

/**
 * A question with the answer given to it, read-only: for a teacher marking
 * (with the right option shown), or for a child or parent once it's handed
 * in (without it — they see which choices earned their points, not the key).
 */
function AnsweredQuestion({
  q,
  n,
  answer,
  mark,
  rightOption,
  showMark,
}: {
  q: Question;
  n: number;
  answer: Answers[string] | undefined;
  mark: number | undefined;
  rightOption?: number;
  showMark: boolean;
}) {
  const { t } = useLanguage();
  return (
    <div className="py-3.5 first:pt-0 last:pb-0">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13.5px] font-semibold text-ink leading-snug" dir="auto">
          <span className="text-ink-muted font-bold me-1.5">{n}.</span>
          {q.prompt}
        </p>
        <span className="text-[11.5px] text-ink-muted whitespace-nowrap tabular-nums">
          {showMark && mark !== undefined ? `${mark} / ${q.points}` : pointsText(q.points, t)}
        </span>
      </div>
      {q.kind === "upload" ? (
        Array.isArray(answer) && answer.length > 0 ? (
          <div className="mt-2">
            <FileChips files={answer} />
          </div>
        ) : (
          <p className="mt-2 text-[12px] text-ink-muted italic">{t("cw.notAnswered")}</p>
        )
      ) : q.kind === "choice" ? (
        <ul className="mt-2 space-y-1.5">
          {(q.options ?? []).map((o, i) => {
            const picked = answer === i;
            const right = rightOption === i;
            const earned = showMark && picked && mark !== undefined && mark > 0;
            const missed = showMark && picked && mark === 0;
            return (
              <li
                key={i}
                className={`flex items-center gap-2.5 rounded-xl border px-3 py-2 text-[13px] ${
                  earned || (right && rightOption !== undefined)
                    ? "border-green-300 bg-green-50 text-green-900 dark:border-green-800/60 dark:bg-green-950/30 dark:text-green-200"
                    : missed
                      ? "border-red-300 bg-red-50 text-red-900 dark:border-red-800/60 dark:bg-red-950/30 dark:text-red-200"
                      : picked
                        ? "border-brand-navy/40 bg-surface-bg-warm text-ink"
                        : "border-surface-border text-ink-body"
                }`}
              >
                <span
                  className={`w-4 h-4 rounded-full border flex-shrink-0 flex items-center justify-center ${
                    picked ? "border-current bg-current" : "border-current opacity-40"
                  }`}
                >
                  {picked && <span className="w-1.5 h-1.5 rounded-full bg-surface-card" />}
                </span>
                <span className="flex-1" dir="auto">
                  {o}
                </span>
                {earned && <IconCheck size={14} />}
                {missed && <IconX size={14} />}
                {right && rightOption !== undefined && !picked && (
                  <span className="text-[10.5px] font-bold uppercase tracking-wide">{t("cw.rightAnswer")}</span>
                )}
              </li>
            );
          })}
          {answer === undefined && <li className="text-[12px] text-ink-muted italic">{t("cw.notAnswered")}</li>}
        </ul>
      ) : answer === undefined || answer === "" ? (
        <p className="mt-2 text-[12px] text-ink-muted italic">{t("cw.notAnswered")}</p>
      ) : (
        <p
          className="mt-2 whitespace-pre-wrap text-[13.5px] text-ink-body bg-surface-bg-warm border border-surface-border rounded-xl px-3.5 py-2.5 leading-relaxed"
          dir="auto"
        >
          {String(answer)}
        </p>
      )}
    </div>
  );
}

function Feedback({ text }: { text: string }) {
  const { t } = useLanguage();
  return (
    <div className="ps-3 border-s-2 border-brand-gold/60">
      <p className="eyebrow mb-1">{t("cw.teachersComment")}</p>
      <p className="text-[13.5px] text-ink-body font-serif italic leading-snug whitespace-pre-wrap" dir="auto">
        {text}
      </p>
    </div>
  );
}

/* ══ Teacher and office ════════════════════════════════════════════ */

interface StaffList {
  assignments: StaffAssignment[];
  roster: { students: RosterStudent[]; halaqas: string[] };
}

export function StaffClassWork({ role }: { role: "teacher" | "admin" }) {
  const { t } = useLanguage();
  const { mode, api } = useClassWorkApi(role);
  const [data, setData] = useState<StaffList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [subject, setSubject] = useState<Subject | "all">("all");
  const [composing, setComposing] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await call<StaffList>(api, "/api/class-work"));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load the assignments.");
    }
  }, [api]);

  useEffect(() => {
    if (mode !== "loading") load();
  }, [mode, load]);

  const today = todayFor(mode);
  const shown = (data?.assignments ?? []).filter((a) => subject === "all" || a.subject === subject);
  const waiting = (data?.assignments ?? []).reduce((n, a) => n + a.counts.submitted, 0);

  if (mode === "loading" || (!data && !error)) {
    return (
      <div className="max-w-5xl mx-auto pt-10">
        <LoadingNote />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto pb-20 space-y-4 pt-2">
      <PortalHero
        eyebrow={role === "admin" ? t("role.admin") : t("role.teacher")}
        title={t("cw.title")}
        meta={data ? [`${data.assignments.length} ${t("nav.assignments").toLowerCase()}`, `${waiting} ${t("cw.status.submitted").toLowerCase()}`] : []}
        actions={
          <button
            type="button"
            onClick={() => setComposing(true)}
            className="inline-flex items-center gap-2 rounded-full bg-brand-gold px-4 py-2.5 text-[13px] font-semibold text-[#20180a] hover:brightness-105 active:scale-[.98] transition"
          >
            <IconPen />
            {t("cw.new")}
          </button>
        }
      />

      {error && <ErrorLine>{error}</ErrorLine>}

      {data && (
        <>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <SegmentedSwitch
              label={t("cw.subject")}
              value={subject}
              onChange={setSubject}
              options={[
                { value: "all", label: t("cw.all") },
                { value: "islamic_studies", label: t("cw.islamic_studies") },
                { value: "arabic", label: t("cw.arabic") },
              ]}
            />
          </div>

          {shown.length === 0 ? (
            <section className="card-quiet p-6">
              <EmptyNote>{t("cw.nothingYet")}</EmptyNote>
            </section>
          ) : (
            <ul className="grid gap-3 md:grid-cols-2">
              {shown.map((a) => {
                const total = a.counts.assigned + a.counts.submitted + a.counts.graded;
                const handedIn = a.counts.submitted + a.counts.graded;
                return (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() => setOpenId(a.id)}
                      className="card-quiet w-full text-start p-5 hover:-translate-y-0.5 hover:shadow-lg transition-all"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <SubjectChip subject={a.subject} />
                        <DueLine due={a.due_date} today={today} done={a.counts.assigned === 0} />
                      </div>
                      <h3 className="page-title text-[17px] mt-2.5 leading-snug" dir="auto">
                        {a.title}
                      </h3>
                      <p className="text-[12px] text-ink-muted mt-1">
                        {questionsText(a.questions.length, t)} · {pointsText(a.max_points, t)}
                        {a.attachments.length > 0 && (
                          <span className="inline-flex items-center gap-1 ms-1.5 align-middle">
                            · <PaperClip size={12} /> {a.attachments.length}
                          </span>
                        )}
                        {role === "admin" && a.set_by ? ` · ${t("cw.setBy")} ${a.set_by}` : ""}
                      </p>
                      <div className="mt-3.5 h-1.5 rounded-full bg-surface-bg-warm overflow-hidden flex">
                        <span className="bg-green-600/80" style={{ width: `${total ? (a.counts.graded / total) * 100 : 0}%` }} />
                        <span className="bg-amber-500/80" style={{ width: `${total ? (a.counts.submitted / total) * 100 : 0}%` }} />
                      </div>
                      <p className="text-[12px] text-ink-body mt-2">
                        {handedIn} / {total} {t("cw.handedIn")} · {a.counts.graded} {t("cw.marked")}
                        {a.counts.submitted > 0 && (
                          <span className="ms-2 text-amber-800 dark:text-amber-300 font-semibold">
                            {a.counts.submitted} {t("cw.status.submitted").toLowerCase()} →
                          </span>
                        )}
                      </p>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}

      {composing && data && (
        <Composer
          api={api}
          mode={mode}
          roster={data.roster}
          onClose={() => setComposing(false)}
          onDone={() => {
            setComposing(false);
            load();
          }}
        />
      )}
      {openId && (
        <AssignmentDetail
          id={openId}
          api={api}
          today={today}
          onClose={() => {
            setOpenId(null);
            load();
          }}
        />
      )}
    </div>
  );
}

/* ── Setting new work ──────────────────────────────────────────────── */

interface DraftQuestion {
  kind: "written" | "choice" | "upload";
  prompt: string;
  options: string[];
  correct: number | null;
  points: number;
}

const blankWritten = (): DraftQuestion => ({ kind: "written", prompt: "", options: [], correct: null, points: 5 });
const blankChoice = (): DraftQuestion => ({ kind: "choice", prompt: "", options: ["", ""], correct: null, points: 1 });
const blankUpload = (): DraftQuestion => ({
  kind: "upload",
  prompt: "Take a photo of your finished work and upload it.",
  options: [],
  correct: null,
  points: 10,
});

function Composer({
  api,
  mode,
  roster,
  onClose,
  onDone,
}: {
  api: Api;
  mode: Mode;
  roster: StaffList["roster"];
  onClose: () => void;
  onDone: () => void;
}) {
  const { t } = useLanguage();
  const [subject, setSubject] = useState<Subject>("islamic_studies");
  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [due, setDue] = useState("");
  const [questions, setQuestions] = useState<DraftQuestion[]>([blankWritten()]);
  const [attachments, setAttachments] = useState<FileRef[]>([]);
  const [uploading, setUploading] = useState(false);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const attach = async (files: File[]) => {
    setUploading(true);
    setError(null);
    const added: FileRef[] = [];
    for (const f of files.slice(0, FILE_LIMITS.perAssignment - attachments.length)) {
      try {
        added.push(await uploadFile(api, mode, f, "assignment"));
      } catch (e) {
        setError(e instanceof Error ? e.message : "That file didn't upload.");
      }
    }
    setAttachments((a) => [...a, ...added]);
    // A worksheet usually comes back as a photo of the finished page, so an
    // assignment still on its untouched first question gets an upload
    // question in its place. It can be changed back like any other.
    if (added.length)
      setQuestions((qs) => (qs.length === 1 && qs[0].kind === "written" && !qs[0].prompt.trim() ? [blankUpload()] : qs));
    setUploading(false);
  };

  // The school's children by halaqa, in the order the halaqas are listed;
  // anyone in none of the caller's halaqas under "Other students".
  const groups = useMemo(() => {
    const byHalaqa = new Map<string, RosterStudent[]>();
    for (const h of roster.halaqas) byHalaqa.set(h, []);
    const others: RosterStudent[] = [];
    for (const s of roster.students) {
      if (s.halaqa && byHalaqa.has(s.halaqa)) byHalaqa.get(s.halaqa)!.push(s);
      else if (s.halaqa) byHalaqa.set(s.halaqa, [...(byHalaqa.get(s.halaqa) ?? []), s]);
      else others.push(s);
    }
    const list = [...byHalaqa.entries()].filter(([, s]) => s.length > 0);
    if (others.length) list.push(["Other students", others]);
    return list;
  }, [roster]);

  const edit = (i: number, patch: Partial<DraftQuestion>) =>
    setQuestions((qs) => qs.map((q, j) => (j === i ? { ...q, ...patch } : q)));
  const toggle = (ids: string[], on: boolean) =>
    setChosen((c) => {
      const next = new Set(c);
      for (const id of ids) (on ? next.add(id) : next.delete(id));
      return next;
    });

  const total = questions.reduce((n, q) => n + (Number(q.points) || 0), 0);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await call(api, "/api/class-work", "POST", {
        subject,
        title,
        instructions,
        due_date: due || null,
        attachments: attachments.map(({ url, ...f }) => (mode === "demo" ? { ...f, url } : f)),
        questions: questions.map((q) => ({
          kind: q.kind,
          prompt: q.prompt,
          points: Number(q.points),
          ...(q.kind === "choice" ? { options: q.options, correct: q.correct } : {}),
        })),
        student_ids: [...chosen],
      });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't set the assignment.");
      setSaving(false);
    }
  };

  return (
    <Modal title={t("cw.new")} subtitle={t("cw.title")} wide onClose={onClose}>
      <div className="space-y-5">
        <SegmentedSwitch
          label={t("cw.subject")}
          value={subject}
          onChange={setSubject}
          options={SUBJECTS.map((s) => ({ value: s, label: t(`cw.${s}`) }))}
        />

        <div className="grid gap-3 sm:grid-cols-[1fr_190px]">
          <label className="block">
            <span className="eyebrow block mb-1.5">{t("cw.titleLabel")}</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, LIMITS.title))}
              placeholder={subject === "arabic" ? "e.g. Days of the week" : "e.g. The Five Pillars of Islam"}
              className={input}
              dir="auto"
            />
          </label>
          <label className="block">
            <span className="eyebrow block mb-1.5">{t("cw.due")}</span>
            <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className={input} />
          </label>
        </div>

        <label className="block">
          <span className="eyebrow block mb-1.5">{t("cw.instructions")}</span>
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value.slice(0, LIMITS.instructions))}
            rows={2}
            placeholder="Optional — e.g. Read pages 12–15 first."
            className={`${input} resize-y`}
            dir="auto"
          />
        </label>

        <div className="space-y-2.5">
          <p className="eyebrow">{t("cw.files")}</p>
          <FileChips files={attachments} onRemove={(i) => setAttachments((a) => a.filter((_, j) => j !== i))} />
          {attachments.length < FILE_LIMITS.perAssignment && (
            <FilePicker label={t("cw.attach")} busy={uploading} onFiles={attach} />
          )}
        </div>

        <div className="space-y-3">
          {questions.map((q, i) => (
            <div key={i} className="rounded-2xl border border-surface-border bg-surface-bg-warm/60 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="eyebrow">
                  {t("cw.question")} {i + 1} · {q.kind === "choice" ? t("cw.choice") : q.kind === "upload" ? t("cw.upload") : t("cw.written")}
                </p>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1.5 text-[12px] text-ink-muted">
                    <input
                      type="number"
                      min={1}
                      max={LIMITS.points}
                      value={q.points}
                      onChange={(e) => edit(i, { points: Math.max(0, Math.min(LIMITS.points, Math.round(Number(e.target.value) || 0))) })}
                      className="w-16 bg-surface-card border border-surface-border rounded-lg px-2 py-1 text-[13px] text-ink tabular-nums"
                      aria-label={`${t("cw.question")} ${i + 1} ${t("cw.points")}`}
                    />
                    {t("cw.points")}
                  </label>
                  {questions.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setQuestions((qs) => qs.filter((_, j) => j !== i))}
                      className="w-7 h-7 rounded-full text-ink-muted hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center justify-center"
                      aria-label={`${t("cw.delete")} ${t("cw.question")} ${i + 1}`}
                    >
                      <IconX size={14} />
                    </button>
                  )}
                </div>
              </div>
              <textarea
                value={q.prompt}
                onChange={(e) => edit(i, { prompt: e.target.value.slice(0, LIMITS.prompt) })}
                rows={2}
                placeholder={q.kind === "choice" ? "e.g. How many times a day do Muslims pray?" : "e.g. Name the five pillars of Islam."}
                className={`${input} mt-2.5 resize-y`}
                dir="auto"
              />
              {q.kind === "upload" && <p className="mt-2 text-[11.5px] text-ink-muted">{t("cw.uploadHint")}</p>}
              {q.kind === "choice" && (
                <div className="mt-2.5 space-y-2">
                  <p className="text-[11.5px] text-ink-muted">Tick the right answer.</p>
                  {q.options.map((o, oi) => (
                    <div key={oi} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name={`right-${i}`}
                        checked={q.correct === oi}
                        onChange={() => edit(i, { correct: oi })}
                        className="w-4 h-4 accent-green-700 flex-shrink-0"
                        aria-label={`${t("cw.rightAnswer")}: ${o || oi + 1}`}
                      />
                      <input
                        value={o}
                        onChange={(e) =>
                          edit(i, { options: q.options.map((x, xi) => (xi === oi ? e.target.value.slice(0, LIMITS.option) : x)) })
                        }
                        placeholder={`Choice ${oi + 1}`}
                        className={`${input} py-2`}
                        dir="auto"
                      />
                      {q.options.length > LIMITS.minOptions && (
                        <button
                          type="button"
                          onClick={() =>
                            edit(i, {
                              options: q.options.filter((_, xi) => xi !== oi),
                              correct: q.correct === null ? null : q.correct === oi ? null : q.correct > oi ? q.correct - 1 : q.correct,
                            })
                          }
                          className="w-7 h-7 rounded-full text-ink-muted hover:text-red-700 flex items-center justify-center flex-shrink-0"
                          aria-label={`Remove choice ${oi + 1}`}
                        >
                          <IconX size={13} />
                        </button>
                      )}
                    </div>
                  ))}
                  {q.options.length < LIMITS.maxOptions && (
                    <button
                      type="button"
                      onClick={() => edit(i, { options: [...q.options, ""] })}
                      className="text-[12px] font-semibold text-ink-muted hover:text-ink"
                    >
                      + Choice
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={questions.length >= LIMITS.questions}
              onClick={() => setQuestions((qs) => [...qs, blankWritten()])}
              className={quietButton}
            >
              + {t("cw.addWritten")}
            </button>
            <button
              type="button"
              disabled={questions.length >= LIMITS.questions}
              onClick={() => setQuestions((qs) => [...qs, blankChoice()])}
              className={quietButton}
            >
              + {t("cw.addChoice")}
            </button>
            <button
              type="button"
              disabled={questions.length >= LIMITS.questions}
              onClick={() => setQuestions((qs) => [...qs, blankUpload()])}
              className={quietButton}
            >
              + {t("cw.upload")}
            </button>
            <span className="ms-auto self-center text-[12px] text-ink-muted tabular-nums">
              {questionsText(questions.length, t)} · {pointsText(total, t)}
            </span>
          </div>
        </div>

        <div>
          <p className="eyebrow mb-2">
            {t("cw.for")} · {chosen.size}
          </p>
          {groups.length === 0 ? (
            <EmptyNote>No students yet.</EmptyNote>
          ) : (
            <div className="space-y-3">
              {groups.map(([halaqa, students]) => {
                const ids = students.map((s) => s.id);
                const all = ids.every((id) => chosen.has(id));
                return (
                  <div key={halaqa}>
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <p className="text-[12.5px] font-semibold text-ink">{halaqa}</p>
                      <button
                        type="button"
                        onClick={() => toggle(ids, !all)}
                        className={`text-[11.5px] font-semibold px-2.5 py-1 rounded-full border transition ${
                          all ? "bg-brand-navy text-white border-brand-navy" : "border-surface-border text-ink-muted hover:text-ink"
                        }`}
                      >
                        {t("cw.wholeHalaqa")}
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {students.map((s) => {
                        const on = chosen.has(s.id);
                        return (
                          <button
                            key={s.id}
                            type="button"
                            aria-pressed={on}
                            onClick={() => toggle([s.id], !on)}
                            className={`px-3 py-1.5 rounded-full text-[12.5px] font-medium border transition ${
                              on
                                ? "bg-brand-navy/10 border-brand-navy/50 text-ink dark:bg-white/10"
                                : "border-surface-border text-ink-muted hover:text-ink"
                            }`}
                          >
                            {on && <span className="me-1">✓</span>}
                            {s.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {error && <ErrorLine>{error}</ErrorLine>}
        <div className="flex items-center justify-end gap-2.5 pt-1">
          <button type="button" onClick={onClose} className={quietButton}>
            {t("common.cancel")}
          </button>
          <button type="button" onClick={save} disabled={saving || uploading} className={primaryButton}>
            {saving ? t("common.saving") : t("cw.set")}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ── One piece of work, and marking it ─────────────────────────────── */

type StaffSubmission = ClassSubmission & { student_name: string };
interface Detail {
  assignment: ClassAssignment;
  key: AnswerKey;
  submissions: StaffSubmission[];
}

function AssignmentDetail({ id, api, today, onClose }: { id: string; api: Api; today: string; onClose: () => void }) {
  const { t } = useLanguage();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [marking, setMarking] = useState<string | null>(null);

  useEffect(() => {
    call<Detail>(api, `/api/class-work/${id}`)
      .then(setDetail)
      .catch((e) => setError(e.message));
  }, [api, id]);

  const remove = async () => {
    if (!detail) return;
    if (!window.confirm(`Delete “${detail.assignment.title}” for everyone it was set for? Their answers and marks go too.`)) return;
    try {
      await call(api, `/api/class-work/${id}`, "DELETE");
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't delete it.");
    }
  };

  const a = detail?.assignment;
  const current = detail?.submissions.find((s) => s.student_id === marking) ?? null;

  return (
    <Modal title={a?.title ?? t("cw.title")} subtitle={a ? t(`cw.${a.subject}`) : undefined} wide onClose={onClose}>
      {!detail ? (
        error ? <ErrorLine>{error}</ErrorLine> : <LoadingNote />
      ) : current && a ? (
        <MarkingView
          api={api}
          assignment={a}
          answerKey={detail.key}
          submission={current}
          onBack={() => setMarking(null)}
          onSaved={(s) => {
            setDetail({ ...detail, submissions: detail.submissions.map((x) => (x.id === s.id || x.student_id === s.student_id ? { ...x, ...s } : x)) });
            setMarking(null);
          }}
        />
      ) : a ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <SubjectChip subject={a.subject} />
            <DueLine due={a.due_date} today={today} done={false} />
            <span className="text-[12px] text-ink-muted">
              · {questionsText(a.questions.length, t)} · {pointsText(a.max_points, t)}
            </span>
          </div>
          {a.instructions && (
            <p className="text-[13.5px] text-ink-body whitespace-pre-wrap leading-relaxed" dir="auto">
              {a.instructions}
            </p>
          )}
          <FileChips files={a.attachments} />
          <ul className="divide-y divide-surface-border border-y border-surface-border">
            {detail.submissions.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => setMarking(s.student_id)}
                  className="w-full flex items-center gap-3 py-3 text-start hover:bg-surface-bg-warm/60 px-1 rounded-lg transition"
                >
                  <span className="flex-1 min-w-0">
                    <span className="block text-[13.5px] font-semibold text-ink truncate">{s.student_name}</span>
                    {s.status === "graded" && s.score !== null && (
                      <span className="block text-[12px] text-ink-muted tabular-nums">
                        {scoreLine(s.score, a.max_points)} · {percentOf(s.score, a.max_points)}%
                      </span>
                    )}
                  </span>
                  <StatusChip status={s.status} overdue={isOverdue(s.status, a.due_date, today)} />
                  <span className="text-[12px] font-semibold text-ink-muted w-12 text-end">{t("cw.mark")} →</span>
                </button>
              </li>
            ))}
          </ul>
          {error && <ErrorLine>{error}</ErrorLine>}
          <div className="flex justify-end">
            <button type="button" onClick={remove} className="text-[12px] font-semibold text-red-700 dark:text-red-300 hover:underline">
              {t("cw.delete")}
            </button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}

function MarkingView({
  api,
  assignment,
  answerKey,
  submission,
  onBack,
  onSaved,
}: {
  api: Api;
  assignment: ClassAssignment;
  answerKey: AnswerKey;
  submission: StaffSubmission;
  onBack: () => void;
  onSaved: (s: ClassSubmission) => void;
}) {
  const { t } = useLanguage();
  // Each question's mark as typed: what it was given before, or for a
  // multiple-choice question what it earned itself.
  const [marks, setMarks] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      assignment.questions.map((q) => {
        const given = submission.marks[q.id];
        if (given !== undefined) return [q.id, String(given)];
        if (q.kind === "choice" && submission.answers[q.id] !== undefined) {
          return [q.id, String(submission.answers[q.id] === answerKey[q.id] ? q.points : 0)];
        }
        return [q.id, ""];
      })
    )
  );
  const [feedback, setFeedback] = useState(submission.feedback ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const total = Object.values(marks).reduce((n, m) => n + (Number(m) || 0), 0);

  const act = async (path: "grade" | "reopen") => {
    setBusy(true);
    setError(null);
    try {
      const body =
        path === "grade"
          ? { student_id: submission.student_id, marks: Object.fromEntries(Object.entries(marks).filter(([, v]) => v !== "")), feedback }
          : { student_id: submission.student_id, feedback };
      const { submission: saved } = await call<{ submission: ClassSubmission }>(api, `/api/class-work/${assignment.id}/${path}`, "POST", body);
      onSaved(saved);
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't go through.");
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <button type="button" onClick={onBack} className="text-[12.5px] font-semibold text-ink-muted hover:text-ink">
        ← {t("cw.all")}
      </button>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="page-title text-[18px] truncate">{submission.student_name}</p>
          {submission.submitted_at && (
            <p className="text-[12px] text-ink-muted">
              {t("cw.status.submitted")} {new Date(submission.submitted_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
            </p>
          )}
        </div>
        <StatusChip status={submission.status} />
      </div>

      <div className="divide-y divide-surface-border">
        {assignment.questions.map((q, i) => (
          <div key={q.id} className="py-3.5 first:pt-0">
            <AnsweredQuestion
              q={q}
              n={i + 1}
              answer={submission.answers[q.id]}
              mark={undefined}
              rightOption={q.kind === "choice" ? answerKey[q.id] : undefined}
              showMark={false}
            />
            <label className="mt-2.5 flex items-center justify-end gap-2 text-[12.5px] text-ink-muted">
              {t("cw.mark")}
              <input
                type="number"
                min={0}
                max={q.points}
                step={0.5}
                value={marks[q.id]}
                onChange={(e) => setMarks((m) => ({ ...m, [q.id]: e.target.value }))}
                className="w-20 bg-surface-card border border-surface-border rounded-lg px-2 py-1.5 text-[13px] text-ink tabular-nums"
                aria-label={`${t("cw.mark")} ${t("cw.question")} ${i + 1}`}
              />
              / {q.points}
            </label>
          </div>
        ))}
      </div>

      <label className="block">
        <span className="eyebrow block mb-1.5">{t("cw.teachersComment")}</span>
        <textarea
          value={feedback}
          onChange={(e) => setFeedback(e.target.value.slice(0, LIMITS.feedback))}
          rows={2}
          placeholder="Optional — e.g. Masha'Allah, well done!"
          className={`${input} resize-y`}
          dir="auto"
        />
      </label>

      {error && <ErrorLine>{error}</ErrorLine>}
      <div className="flex flex-wrap items-center justify-end gap-2.5">
        <span className="me-auto text-[13px] font-semibold text-ink tabular-nums">
          {t("cw.score")}: {scoreLine(total, assignment.max_points)}
        </span>
        {submission.status !== "assigned" && (
          <button type="button" onClick={() => act("reopen")} disabled={busy} className={quietButton}>
            {t("cw.sendBack")}
          </button>
        )}
        <button type="button" onClick={() => act("grade")} disabled={busy} className={primaryButton}>
          {busy ? t("common.saving") : t("cw.saveMarks")}
        </button>
      </div>
    </div>
  );
}

/* ══ The child ═════════════════════════════════════════════════════ */

/** The two kinds of work behind the child's Work tab: the Qur'an, and Islamic Studies and Arabic. */
export function StudentWorkSwitch({ current }: { current: "quran" | "classWork" }) {
  const { t } = useLanguage();
  const tab = (href: string, on: boolean, label: string) => (
    <Link
      href={href}
      aria-current={on ? "page" : undefined}
      className={`flex-1 text-center px-4 py-2 rounded-full text-[13px] font-bold transition-all ${
        on ? "bg-brand-navy text-white shadow-sm" : "text-ink-muted hover:text-ink"
      }`}
    >
      {label}
    </Link>
  );
  return (
    <nav className="flex p-1 gap-1 rounded-full bg-surface-bg-warm border border-surface-border">
      {tab("/student/assignments", current === "quran", t("nav.quran"))}
      {tab("/student/class-work", current === "classWork", t("nav.classWork"))}
    </nav>
  );
}

const draftKey = (id: string) => `mydiiwaan_cw_draft_${id}`;
function readDraft(id: string): Answers | null {
  try {
    const raw = localStorage.getItem(draftKey(id));
    return raw ? (JSON.parse(raw) as Answers) : null;
  } catch {
    return null;
  }
}
/**
 * Answers as the server wants them: a file is its place in storage, and a
 * preview made on this device (a blob: link) means nothing anywhere else.
 * In the sample portal the data URL is the file, so it goes along.
 */
function forServer(answers: Answers, mode: Mode): Answers {
  return Object.fromEntries(
    Object.entries(answers).map(([k, v]) => [
      k,
      Array.isArray(v) ? v.map(({ url, ...f }) => (mode === "demo" && url?.startsWith("data:") ? { ...f, url } : f)) : v,
    ])
  );
}

function writeDraft(id: string, answers: Answers | null) {
  try {
    if (answers) {
      // A blob: preview doesn't outlive the page; the file's place does.
      const keep = Object.fromEntries(
        Object.entries(answers).map(([k, v]) => [
          k,
          Array.isArray(v) ? v.map((f) => (f.url?.startsWith("blob:") ? { ...f, url: undefined } : f)) : v,
        ])
      );
      localStorage.setItem(draftKey(id), JSON.stringify(keep));
    }
    else localStorage.removeItem(draftKey(id));
  } catch {
    // The answers are still on screen; they just won't survive a reload.
  }
}

export function StudentClassWork() {
  const { t } = useLanguage();
  const { mode, api } = useClassWorkApi("student");
  const [items, setItems] = useState<ClassWorkItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await call<{ items: ClassWorkItem[] }>(api, "/api/class-work");
      setItems(data.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load your work.");
    }
  }, [api]);
  useEffect(() => {
    if (mode !== "loading") load();
  }, [mode, load]);

  const today = todayFor(mode);
  const byDue = (x: ClassWorkItem, y: ClassWorkItem) =>
    (x.assignment.due_date ?? "9999") < (y.assignment.due_date ?? "9999") ? -1 : 1;
  const todo = (items ?? []).filter((i) => i.submission.status === "assigned").sort(byDue);
  const waiting = (items ?? []).filter((i) => i.submission.status === "submitted");
  const marked = (items ?? []).filter((i) => i.submission.status === "graded");
  const open = (items ?? []).find((i) => i.assignment.id === openId) ?? null;

  if (!items) {
    return <div className="px-4 pt-10">{error ? <ErrorLine>{error}</ErrorLine> : <LoadingNote />}</div>;
  }

  const section = (title: string, list: ClassWorkItem[], empty?: React.ReactNode) => (
    <section className="space-y-2.5">
      <h2 className="eyebrow px-1">
        {title} · {list.length}
      </h2>
      {list.length === 0 ? (
        empty ?? null
      ) : (
        list.map((i) => {
          const s = i.submission;
          const overdue = isOverdue(s.status, i.assignment.due_date, today);
          return (
            <button
              key={i.assignment.id}
              type="button"
              onClick={() => setOpenId(i.assignment.id)}
              className="card-quiet w-full text-start p-4 flex items-center gap-4 active:scale-[.99] transition"
            >
              {s.status === "graded" && s.score !== null ? (
                <ProgressRing value={percentOf(s.score, i.assignment.max_points)} colour={SUBJECT_COLOUR[i.assignment.subject]} size={56} />
              ) : (
                <span className={`${ILLUM_CLASS[SUBJECT_COLOUR[i.assignment.subject]]} w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0`}>
                  <IconPen size={20} />
                </span>
              )}
              <span className="flex-1 min-w-0">
                <span className="flex items-center gap-2 flex-wrap">
                  <SubjectChip subject={i.assignment.subject} />
                  <StatusChip status={s.status} overdue={overdue} />
                </span>
                <span className="block page-title text-[16px] mt-1.5 leading-snug" dir="auto">
                  {i.assignment.title}
                </span>
                <span className="block mt-0.5">
                  {s.status === "graded" && s.score !== null ? (
                    <span className="text-[12.5px] font-bold text-ink tabular-nums">{scoreLine(s.score, i.assignment.max_points)}</span>
                  ) : (
                    <DueLine due={i.assignment.due_date} today={today} done={s.status !== "assigned"} />
                  )}
                </span>
              </span>
            </button>
          );
        })
      )}
    </section>
  );

  return (
    <div className="space-y-5">
      {section(
        t("cw.status.assigned"),
        todo,
        <div className="card-quiet p-5">
          <FriendlyEmpty title={t("cw.nothingYet")} sub="Check back soon." mood="happy" />
        </div>
      )}
      {waiting.length > 0 && section(t("cw.status.submitted"), waiting)}
      {marked.length > 0 && section(t("cw.status.graded"), marked)}

      {open && (
        <WorkSheet
          item={open}
          api={api}
          mode={mode}
          onClose={() => setOpenId(null)}
          onHandedIn={(s) => {
            setItems((list) => (list ?? []).map((i) => (i.assignment.id === open.assignment.id ? { ...i, submission: s } : i)));
          }}
        />
      )}
    </div>
  );
}

function WorkSheet({
  item,
  api,
  mode,
  onClose,
  onHandedIn,
}: {
  item: ClassWorkItem;
  api: Api;
  mode: Mode;
  onClose: () => void;
  onHandedIn: (s: ClassSubmission) => void;
}) {
  const { t } = useLanguage();
  const { assignment: a, submission: s } = item;
  const open = s.status === "assigned";
  // Picks up where they left off: a draft on this device, or — when the
  // teacher sent it back — the answers they handed in last time.
  const [answers, setAnswers] = useState<Answers>(() => readDraft(a.id) ?? s.answers ?? {});
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const set = (qid: string, v: Answers[string]) =>
    setAnswers((prev) => {
      const next = { ...prev, [qid]: v };
      writeDraft(a.id, next);
      return next;
    });

  const filesFor = (qid: string): FileRef[] => {
    const v = answers[qid];
    return Array.isArray(v) ? v : [];
  };
  const addFiles = async (qid: string, files: File[]) => {
    setUploading(qid);
    setError(null);
    const added: FileRef[] = [];
    for (const f of files.slice(0, FILE_LIMITS.perAnswer - filesFor(qid).length)) {
      try {
        added.push(await uploadFile(api, mode, f, "answer", a.id));
      } catch (e) {
        setError(e instanceof Error ? e.message : "That file didn't upload.");
      }
    }
    setAnswers((prev) => {
      const had = Array.isArray(prev[qid]) ? (prev[qid] as FileRef[]) : [];
      const next = { ...prev, [qid]: [...had, ...added] };
      writeDraft(a.id, next);
      return next;
    });
    setUploading(null);
  };

  const unanswered = a.questions.filter((q) => !isAnswered(q, answers[q.id])).length;

  const handIn = async () => {
    if (unanswered > 0 && !window.confirm(`${unanswered} question${unanswered === 1 ? " is" : "s are"} not answered yet. Hand it in anyway?`)) return;
    setBusy(true);
    setError(null);
    try {
      const { submission } = await call<{ submission: ClassSubmission }>(api, `/api/class-work/${a.id}/submit`, "POST", { answers: forServer(answers, mode) });
      writeDraft(a.id, null);
      onHandedIn(submission);
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't go through.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={a.title} subtitle={t(`cw.${a.subject}`)} wide onClose={onClose}>
      <div className="space-y-4">
        {s.status === "graded" && s.score !== null && (
          <div className="flex items-center gap-4 rounded-2xl bg-surface-bg-warm border border-surface-border p-4">
            <ProgressRing value={percentOf(s.score, a.max_points)} colour={SUBJECT_COLOUR[a.subject]} size={64} />
            <div>
              <p className="eyebrow">{t("cw.score")}</p>
              <p className="page-title text-[24px] tabular-nums">{scoreLine(s.score, a.max_points)}</p>
            </div>
          </div>
        )}
        {s.feedback && (open ? (
          <div className="rounded-2xl border border-amber-300 bg-amber-50 dark:border-amber-800/60 dark:bg-amber-950/30 p-4">
            <p className="text-[12.5px] font-bold text-amber-900 dark:text-amber-200">{t("cw.sentBack")}</p>
            <p className="text-[13.5px] text-amber-900 dark:text-amber-100 mt-1 whitespace-pre-wrap" dir="auto">
              {s.feedback}
            </p>
          </div>
        ) : (
          <Feedback text={s.feedback} />
        ))}
        {s.status === "submitted" && (
          <p className="text-[13px] font-semibold text-amber-800 dark:text-amber-300">{t("cw.waiting")}</p>
        )}
        {a.instructions && (
          <p className="text-[13.5px] text-ink-body whitespace-pre-wrap leading-relaxed" dir="auto">
            {a.instructions}
          </p>
        )}
        {a.attachments.length > 0 && (
          <div className="space-y-2">
            <p className="eyebrow">{t("cw.fromTeacher")}</p>
            <FileChips files={a.attachments} />
          </div>
        )}

        {open ? (
          <div className="space-y-4">
            {a.questions.map((q, i) => (
              <div key={q.id} className="rounded-2xl border border-surface-border p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-[14.5px] font-semibold text-ink leading-snug" dir="auto">
                    <span className="text-ink-muted font-bold me-1.5">{i + 1}.</span>
                    {q.prompt}
                  </p>
                  <span className="text-[11.5px] text-ink-muted whitespace-nowrap">{pointsText(q.points, t)}</span>
                </div>
                {q.kind === "upload" ? (
                  <div className="mt-3 space-y-3">
                    <FileChips
                      files={filesFor(q.id)}
                      onRemove={(fi) => set(q.id, filesFor(q.id).filter((_, j) => j !== fi))}
                    />
                    {filesFor(q.id).length < FILE_LIMITS.perAnswer && (
                      <FilePicker label={t("cw.addPhoto")} busy={uploading === q.id} onFiles={(files) => addFiles(q.id, files)} />
                    )}
                  </div>
                ) : q.kind === "choice" ? (
                  <div className="mt-3 grid gap-2" role="radiogroup" aria-label={q.prompt}>
                    {(q.options ?? []).map((o, oi) => {
                      const on = answers[q.id] === oi;
                      return (
                        <button
                          key={oi}
                          type="button"
                          role="radio"
                          aria-checked={on}
                          onClick={() => set(q.id, oi)}
                          className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3 text-start text-[14.5px] transition active:scale-[.99] ${
                            on
                              ? "border-brand-navy bg-brand-navy/10 text-ink font-semibold dark:bg-white/10"
                              : "border-surface-border text-ink-body hover:border-brand-navy/40"
                          }`}
                        >
                          <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${on ? "border-brand-navy" : "border-surface-border"}`}>
                            {on && <span className="w-2.5 h-2.5 rounded-full bg-brand-navy dark:bg-white" />}
                          </span>
                          <span dir="auto">{o}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <textarea
                    value={typeof answers[q.id] === "string" ? String(answers[q.id]) : ""}
                    onChange={(e) => set(q.id, e.target.value.slice(0, LIMITS.writtenAnswer))}
                    rows={4}
                    placeholder={t("cw.yourAnswer")}
                    className={`${input} mt-3 resize-y text-[15px]`}
                    dir="auto"
                    aria-label={`${t("cw.yourAnswer")} ${i + 1}`}
                  />
                )}
              </div>
            ))}
            {error && <ErrorLine>{error}</ErrorLine>}
            <button type="button" onClick={handIn} disabled={busy || uploading !== null} className="w-full gradient-emerald text-white text-[15px] font-bold py-3.5 rounded-2xl disabled:opacity-50 active:scale-[.99] transition">
              {busy ? t("cw.handingIn") : t("cw.handIn")}
            </button>
          </div>
        ) : (
          <div className="divide-y divide-surface-border">
            {a.questions.map((q, i) => (
              <AnsweredQuestion
                key={q.id}
                q={q}
                n={i + 1}
                answer={s.answers[q.id]}
                mark={s.marks[q.id]}
                showMark={s.status === "graded"}
              />
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}

/* ══ The parent ════════════════════════════════════════════════════ */

export function ParentClassWork() {
  const { t, language } = useLanguage();
  const { mode, api } = useClassWorkApi("parent");
  const [data, setData] = useState<{ children: Array<{ id: string; name: string }>; items: ClassWorkItem[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [child, setChild] = useState<string>("");
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    if (mode === "loading") return;
    call<{ children: Array<{ id: string; name: string }>; items: ClassWorkItem[] }>(api, "/api/class-work")
      .then((d) => {
        setData(d);
        setChild((c) => c || d.children[0]?.id || "");
      })
      .catch((e) => setError(e.message));
  }, [mode, api]);

  const today = todayFor(mode);
  const mine = (data?.items ?? [])
    .filter((i) => i.submission.student_id === child)
    .sort((x, y) => (x.assignment.created_at < y.assignment.created_at ? 1 : -1));
  const marked = mine.filter((i) => i.submission.status === "graded" && i.submission.score !== null);
  const average = marked.length
    ? Math.round(marked.reduce((n, i) => n + percentOf(i.submission.score!, i.assignment.max_points), 0) / marked.length)
    : null;
  const open = mine.find((i) => i.assignment.id === openId) ?? null;
  const childName = data?.children.find((c) => c.id === child)?.name ?? "";

  if (mode === "loading" || (!data && !error)) {
    return (
      <div className="max-w-4xl mx-auto pt-10">
        <LoadingNote />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto pb-20 space-y-4 pt-2">
      <PortalHero eyebrow={childName || t("role.parent")} title={t("cw.title")} meta={[formatDay(today, language)]} />
      {error && <ErrorLine>{error}</ErrorLine>}
      {data && data.children.length > 1 && (
        <SegmentedSwitch
          label={t("cw.child")}
          value={child}
          onChange={setChild}
          options={data.children.map((c) => ({ value: c.id, label: c.name.split(" ")[0] }))}
        />
      )}

      {data && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <StatTile value={mine.filter((i) => i.submission.status === "assigned").length} label={t("cw.status.assigned")} />
            <StatTile value={mine.filter((i) => i.submission.status === "submitted").length} label={t("cw.status.submitted")} />
            <StatTile value={marked.length} label={t("cw.status.graded")} sub={average === null ? undefined : `${average}% ${t("cw.average")}`} />
          </div>

          {mine.length === 0 ? (
            <section className="card-quiet p-6">
              <EmptyNote>{t("cw.nothingYet")}</EmptyNote>
            </section>
          ) : (
            <ul className="space-y-2.5">
              {mine.map((i) => {
                const s = i.submission;
                return (
                  <li key={i.assignment.id}>
                    <button
                      type="button"
                      onClick={() => setOpenId(i.assignment.id)}
                      className="card-quiet w-full text-start px-5 py-4 flex items-center gap-4 hover:-translate-y-0.5 transition-all"
                    >
                      <span className="flex-1 min-w-0">
                        <span className="flex items-center gap-2 flex-wrap">
                          <SubjectChip subject={i.assignment.subject} />
                          <StatusChip status={s.status} overdue={isOverdue(s.status, i.assignment.due_date, today)} />
                        </span>
                        <span className="block page-title text-[16px] mt-1.5" dir="auto">
                          {i.assignment.title}
                        </span>
                        <span className="block text-[12px] text-ink-muted mt-0.5">
                          {i.set_by ? `${t("cw.setBy")} ${i.set_by} · ` : ""}
                          <DueLine due={i.assignment.due_date} today={today} done={s.status !== "assigned"} />
                        </span>
                      </span>
                      {s.status === "graded" && s.score !== null && (
                        <span className="text-end flex-shrink-0">
                          <span className="block text-[18px] font-bold text-ink tabular-nums">{scoreLine(s.score, i.assignment.max_points)}</span>
                          <span className="block text-[11.5px] text-ink-muted tabular-nums">{percentOf(s.score, i.assignment.max_points)}%</span>
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}

      {open && (
        <Modal title={open.assignment.title} subtitle={`${childName} · ${t(`cw.${open.assignment.subject}`)}`} wide onClose={() => setOpenId(null)}>
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <StatusChip status={open.submission.status} overdue={isOverdue(open.submission.status, open.assignment.due_date, today)} />
              {open.submission.status === "graded" && open.submission.score !== null && (
                <span className="text-[14px] font-bold text-ink tabular-nums">
                  {t("cw.score")}: {scoreLine(open.submission.score, open.assignment.max_points)} ·{" "}
                  {percentOf(open.submission.score, open.assignment.max_points)}%
                </span>
              )}
            </div>
            {open.submission.feedback && <Feedback text={open.submission.feedback} />}
            {open.assignment.instructions && (
              <p className="text-[13.5px] text-ink-body whitespace-pre-wrap leading-relaxed" dir="auto">
                {open.assignment.instructions}
              </p>
            )}
            <FileChips files={open.assignment.attachments} />
            <div className="divide-y divide-surface-border">
              {open.assignment.questions.map((q, i) => (
                <AnsweredQuestion
                  key={q.id}
                  q={q}
                  n={i + 1}
                  answer={open.submission.status === "assigned" ? undefined : open.submission.answers[q.id]}
                  mark={open.submission.marks[q.id]}
                  showMark={open.submission.status === "graded"}
                />
              ))}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

