"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  QAIDAH_BOOKS,
  isQaidahBookId,
  qaidahBook,
  qaidahLesson,
  type QaidahBookId,
} from "@/data/qaidah";
import { formatDay } from "@/data/demo";
import { demoSchoolRoster, type PortalMode } from "@/hooks/usePortalRoster";
import { qaidahActions, useQaidahLessons } from "@/hooks/useQaidahLessons";
import {
  QAIDAH_NOTE_MAX,
  currentLessons,
  type QaidahAssignment,
  type QaidahStatus,
} from "@/lib/qaidahLessons";
import { SectionCard, EmptyNote, LoadingNote } from "@/components/portal-ui";
import { ILLUM_CLASS, type IllumColour } from "@/components/student-ui";
import { IconCheck } from "@/components/icons";
import { useLanguage } from "@/components/LanguageProvider";
import { myHalaqaStudents } from "@/lib/teacherScope";

interface Student {
  id: string;
  name: string;
  /** The halaqa they're in, where it's one the teacher teaches. */
  halaqa: string | null;
}

/**
 * The teacher's students and every child's Qa'idah lessons, real or the
 * sample school's. A teacher sees the whole school (as on the register and
 * the Qur'an assignments), with the halaqas they teach first.
 */
export function useQaidahClassroom() {
  const [mode, setMode] = useState<PortalMode>("loading");
  const [students, setStudents] = useState<Student[]>([]);
  const lessons = useQaidahLessons(mode);

  useEffect(() => {
    const supabase = createClient();
    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setStudents(
          demoSchoolRoster()
            .filter((s) => s.active !== false)
            .map((s) => ({ id: s.id, name: s.name, halaqa: s.halaqa || null }))
        );
        setMode("demo");
        return;
      }
      const [{ data: studentRows }, { data: classRows }, { data: enrolments }, mine] = await Promise.all([
        supabase.from("students").select("id, full_name").eq("active", true).order("full_name"),
        // Only the halaqas this teacher teaches come back, and only their children.
        supabase.from("classes").select("id, name"),
        supabase.from("class_enrollments").select("class_id, student_id"),
        // In an academic school, just the children of their own halaqas.
        myHalaqaStudents(supabase),
      ]);
      const className = new Map((classRows ?? []).map((c) => [c.id as string, c.name as string]));
      const halaqaOf = new Map<string, string>();
      for (const e of enrolments ?? []) {
        const name = className.get(e.class_id);
        if (name && !halaqaOf.has(e.student_id)) halaqaOf.set(e.student_id, name);
      }
      setStudents(
        (studentRows ?? [])
          .filter((s) => !mine || mine.has(s.id))
          .map((s) => ({
            id: s.id,
            name: s.full_name,
            halaqa: mine?.get(s.id) ?? halaqaOf.get(s.id) ?? null,
          }))
      );
      setMode("real");
    };
    load().catch(() => {
      setStudents([]);
      setMode("real");
    });
  }, []);

  return { mode, students, ...lessons };
}

export type QaidahClassroom = ReturnType<typeof useQaidahClassroom>;

const STATUS_COLOUR: Record<QaidahStatus, IllumColour> = {
  assigned: "saffron",
  passed: "verdigris",
  repeat: "vermilion",
};
const STATUS_KEY: Record<QaidahStatus, string> = {
  assigned: "qaidah.statusAssigned",
  passed: "qaidah.statusPassed",
  repeat: "qaidah.statusRepeat",
};

interface Editing {
  studentIds: string[];
  book: QaidahBookId;
  lesson: number;
  note: string;
  /** The child's current lesson, when changing one child's. */
  current: QaidahAssignment | null;
}

/**
 * Setting each child's lesson: the lesson they're on, and buttons to pass
 * them on to the next one, send them back to practise it, or set another —
 * for one child, or for several ticked at once.
 */
export function QaidahAssignPanel({
  room,
  book,
}: {
  room: QaidahClassroom;
  /** The book on screen, offered first when setting a new lesson. */
  book: QaidahBookId;
}) {
  const { t, language } = useLanguage();
  const { mode, students, rows, setRows, ready, missingTable } = room;
  const actions = useMemo(() => qaidahActions(mode === "demo"), [mode]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<Editing | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const current = useMemo(() => currentLessons(rows), [rows]);
  const nameOf = useMemo(() => new Map(students.map((s) => [s.id, s.name])), [students]);

  // The halaqas this teacher teaches first, each in name order, then everyone else.
  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const shown = students.filter((s) => !q || s.name.toLowerCase().includes(q));
    const byHalaqa = new Map<string, Student[]>();
    for (const s of shown) {
      const key = s.halaqa ?? "";
      byHalaqa.set(key, [...(byHalaqa.get(key) ?? []), s]);
    }
    return [...byHalaqa.entries()]
      .sort(([a], [b]) => (a === "" ? 1 : b === "" ? -1 : a.localeCompare(b)))
      .map(([halaqa, list]) => ({ halaqa, students: list }));
  }, [students, query]);
  const shownIds = groups.flatMap((g) => g.students.map((s) => s.id));

  const apply = (changed: QaidahAssignment[], removedId?: string) =>
    setRows((prev) => {
      const ids = new Set(changed.map((r) => r.id));
      return [...changed, ...prev.filter((r) => !ids.has(r.id) && r.id !== removedId)];
    });

  const run = async (key: string, work: () => Promise<string | null>) => {
    setBusy(key);
    setError(null);
    setDone(null);
    try {
      setDone(await work());
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't save. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  const lessonName = (b: QaidahBookId, lesson: number) =>
    `${qaidahBook(b).shortName} · ${t("qaidah.lesson")} ${lesson}`;

  const pass = (row: QaidahAssignment) =>
    run(row.id, async () => {
      const result = await actions.update(row.id, { status: "passed" }, true);
      apply([result.lesson, ...(result.next ? [result.next] : [])]);
      const who = nameOf.get(row.student_id) ?? "";
      if (result.next) return `${who}: ${t("qaidah.statusPassed")} ${row.lesson} — ${t("qaidah.nextIsSet")} (${result.next.lesson}).`;
      if (result.finished) return `${who}: ${t("qaidah.finishedBook")} (${qaidahBook(row.book).name}).`;
      return `${who}: ${t("qaidah.statusPassed")} ${row.lesson}.`;
    });

  const repeat = (row: QaidahAssignment) =>
    run(row.id, async () => {
      const result = await actions.update(row.id, { status: "repeat" });
      apply([result.lesson]);
      return null;
    });

  const openEditor = (studentIds: string[], row: QaidahAssignment | null) => {
    setError(null);
    setDone(null);
    const startBook = row && row.status !== "passed" ? row.book : book;
    setEditing({
      studentIds,
      book: startBook,
      lesson: row && row.status !== "passed" && row.book === startBook ? row.lesson : 1,
      note: row && row.status !== "passed" ? (row.note ?? "") : "",
      current: studentIds.length === 1 ? row : null,
    });
  };

  const save = (e: Editing) =>
    run("editor", async () => {
      const note = e.note.trim() || null;
      const same = e.current && e.current.status !== "passed" && e.current.book === e.book && e.current.lesson === e.lesson;
      if (same && e.current) {
        // The same lesson: just its note.
        const result = await actions.update(e.current.id, { note });
        apply([result.lesson]);
      } else {
        apply(await actions.set(e.studentIds, e.book, e.lesson, note));
      }
      setEditing(null);
      setSelected(new Set());
      const who = e.studentIds.length === 1 ? (nameOf.get(e.studentIds[0]) ?? "") : `${e.studentIds.length} ${t("qaidah.students")}`;
      return `${who}: ${lessonName(e.book, e.lesson)}.`;
    });

  const remove = (row: QaidahAssignment) =>
    run("editor", async () => {
      await actions.remove(row.id);
      apply([], row.id);
      setEditing(null);
      return null;
    });

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const editorFor = (studentIds: string[]) =>
    editing && editing.studentIds.join() === studentIds.join() ? (
      <LessonEditor
        editing={editing}
        onChange={setEditing}
        onSave={() => save(editing)}
        onCancel={() => setEditing(null)}
        onRemove={editing.current ? () => remove(editing.current!) : undefined}
        busy={busy === "editor"}
        who={
          studentIds.length === 1
            ? (nameOf.get(studentIds[0]) ?? "")
            : `${studentIds.length} ${t("qaidah.students")}`
        }
      />
    ) : null;

  const selectedIds = shownIds.filter((id) => selected.has(id));

  return (
    <SectionCard
      title={t("qaidah.studentsLessons")}
      note={mode === "loading" ? undefined : `${students.length} ${t("qaidah.students")}`}
    >
      {mode === "loading" || !ready ? (
        <LoadingNote />
      ) : (
        <div className="space-y-3">
          {missingTable && (
            <p className="rounded-xl bg-status-warning-bg text-status-warning-text text-[12.5px] px-3 py-2">
              {t("qaidah.missingTable")}
            </p>
          )}
          {students.length === 0 ? (
            <EmptyNote>{t("qaidah.noLesson")}</EmptyNote>
          ) : (
            <>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("qaidah.search")}
                aria-label={t("qaidah.search")}
                className="w-full bg-surface-card border border-surface-border rounded-xl px-3 py-2 text-sm text-ink focus:outline-none focus:border-brand-gold"
              />

              {selectedIds.length > 0 && (
                <div className="rounded-xl bg-surface-bg-warm border border-surface-border px-3 py-2 flex flex-wrap items-center gap-2">
                  <span className="text-[12.5px] font-semibold text-ink">
                    {selectedIds.length} {t("qaidah.selected")}
                  </span>
                  <button
                    type="button"
                    onClick={() => openEditor(selectedIds, null)}
                    disabled={missingTable}
                    className="rounded-full bg-brand-navy text-white text-[12px] font-semibold px-3 py-1.5 disabled:opacity-40"
                  >
                    {t("qaidah.setForSelected")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelected(new Set())}
                    className="text-[12px] font-semibold text-ink-muted hover:text-ink px-1"
                  >
                    {t("qaidah.clearSelection")}
                  </button>
                </div>
              )}
              {selectedIds.length > 1 && editorFor(selectedIds)}

              {error && (
                <p role="alert" className="text-[12.5px] text-status-error-text">
                  {error}
                </p>
              )}
              {done && (
                <p aria-live="polite" className="text-[12.5px] text-status-success-text">
                  {done}
                </p>
              )}

              {/* On a wide screen the panel stays in view beside the book,
                  so a long roster scrolls inside it instead. */}
              <div className="lg:max-h-[calc(100vh-17rem)] lg:overflow-y-auto lg:pe-1">
              {groups.map((group) => (
                <div key={group.halaqa || "others"}>
                  {groups.length > 1 && (
                    <p className="eyebrow mt-2 mb-1">{group.halaqa || t("qaidah.otherStudents")}</p>
                  )}
                  <ul className="divide-y divide-surface-border">
                    {group.students.map((s) => {
                      const row = current.get(s.id) ?? null;
                      const lesson = row ? qaidahLesson(row.book, row.lesson) : undefined;
                      const open = row && row.status !== "passed";
                      return (
                        <li key={s.id} className="py-3 flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={selected.has(s.id)}
                            onChange={() => toggle(s.id)}
                            aria-label={s.name}
                            className="mt-1 w-4 h-4 accent-[#1e3f7a] flex-shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                              <span className="text-[14px] font-semibold text-ink">{s.name}</span>
                              {row ? (
                                <>
                                  <span className="inline-flex rounded-full bg-surface-bg-warm border border-surface-border px-2 py-0.5 text-[11.5px] font-semibold text-ink">
                                    {lessonName(row.book, row.lesson)}
                                  </span>
                                  <span
                                    className={`${ILLUM_CLASS[STATUS_COLOUR[row.status]]} !inline-flex !rounded-full px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide`}
                                  >
                                    {row.status === "passed" && !qaidahLesson(row.book, row.lesson + 1)
                                      ? t("qaidah.finishedBook")
                                      : t(STATUS_KEY[row.status])}
                                  </span>
                                </>
                              ) : (
                                <span className="text-[12px] text-ink-muted">{t("qaidah.noLesson")}</span>
                              )}
                            </div>
                            {row && (
                              <p className="text-[12px] text-ink-muted mt-1 leading-snug">
                                {lesson?.title}
                                <span className="mx-1.5 text-ink-muted/50">·</span>
                                {row.status === "passed" && row.passed_at
                                  ? `${t("qaidah.passedOn")} ${formatDay(row.passed_at.slice(0, 10), language)}`
                                  : `${t("qaidah.since")} ${formatDay(row.assigned_at.slice(0, 10), language)}`}
                                {row.note && open && (
                                  <span className="block italic text-ink-body mt-0.5">“{row.note}”</span>
                                )}
                              </p>
                            )}
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {row && open && (
                                <button
                                  type="button"
                                  onClick={() => pass(row)}
                                  disabled={busy !== null}
                                  className="inline-flex items-center gap-1 rounded-full bg-brand-emerald text-white text-[12px] font-semibold px-3 py-1.5 disabled:opacity-40"
                                >
                                  <IconCheck size={12} />
                                  {t("qaidah.markPassed")}
                                </button>
                              )}
                              {row && open && row.status !== "repeat" && (
                                <button
                                  type="button"
                                  onClick={() => repeat(row)}
                                  disabled={busy !== null}
                                  className="rounded-full border border-surface-border bg-surface-card text-[12px] font-semibold text-ink px-3 py-1.5 hover:border-brand-gold/60 disabled:opacity-40"
                                >
                                  {t("qaidah.repeat")}
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => openEditor([s.id], row)}
                                disabled={busy !== null || missingTable}
                                className="rounded-full border border-surface-border bg-surface-card text-[12px] font-semibold text-ink px-3 py-1.5 hover:border-brand-gold/60 disabled:opacity-40"
                              >
                                {open ? t("qaidah.change") : t("qaidah.setLesson")}
                              </button>
                            </div>
                            {editorFor([s.id])}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
              </div>
            </>
          )}
        </div>
      )}
    </SectionCard>
  );
}

/** Book, lesson and a note for the child, for one child or several. */
function LessonEditor({
  editing,
  onChange,
  onSave,
  onCancel,
  onRemove,
  busy,
  who,
}: {
  editing: Editing;
  onChange: (e: Editing) => void;
  onSave: () => void;
  onCancel: () => void;
  onRemove?: () => void;
  busy: boolean;
  who: string;
}) {
  const { t } = useLanguage();
  const book = qaidahBook(editing.book);
  return (
    <div className="mt-3 rounded-2xl border border-brand-gold/40 bg-surface-bg-warm p-3 space-y-2.5">
      <p className="text-[12.5px] font-semibold text-ink">
        {t("qaidah.for")} {who}
      </p>
      <div className="grid gap-2">
        <label className="block">
          <span className="eyebrow block mb-1">{t("qaidah.book")}</span>
          <select
            value={editing.book}
            onChange={(e) => {
              if (!isQaidahBookId(e.target.value)) return;
              const next = qaidahBook(e.target.value);
              onChange({ ...editing, book: next.id, lesson: Math.min(editing.lesson, next.lessons.length) });
            }}
            className="w-full bg-surface-card border border-surface-border rounded-xl px-3 py-2 text-sm text-ink focus:outline-none focus:border-brand-gold"
          >
            {QAIDAH_BOOKS.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="eyebrow block mb-1">{t("qaidah.lesson")}</span>
          <select
            value={editing.lesson}
            onChange={(e) => onChange({ ...editing, lesson: Number(e.target.value) })}
            className="w-full bg-surface-card border border-surface-border rounded-xl px-3 py-2 text-sm text-ink focus:outline-none focus:border-brand-gold"
          >
            {book.lessons.map((l) => (
              <option key={l.id} value={l.id}>
                {l.id}. {l.title}
              </option>
            ))}
          </select>
        </label>
      </div>
      <textarea
        value={editing.note}
        onChange={(e) => onChange({ ...editing, note: e.target.value })}
        placeholder={t("qaidah.notePlaceholder")}
        aria-label={t("qaidah.notePlaceholder")}
        maxLength={QAIDAH_NOTE_MAX}
        rows={2}
        className="w-full bg-surface-card border border-surface-border rounded-xl px-3 py-2 text-sm text-ink resize-y focus:outline-none focus:border-brand-gold"
      />
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onSave}
          disabled={busy}
          className="rounded-full bg-brand-navy text-white text-[12.5px] font-semibold px-4 py-2 disabled:opacity-40"
        >
          {busy ? "…" : t("qaidah.save")}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-[12.5px] font-semibold text-ink-muted hover:text-ink px-2"
        >
          {t("common.cancel")}
        </button>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            disabled={busy}
            className="ms-auto text-[12px] font-semibold text-status-error-text hover:underline disabled:opacity-40"
          >
            {t("qaidah.remove")}
          </button>
        )}
      </div>
    </div>
  );
}
