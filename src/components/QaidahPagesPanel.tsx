"use client";

import { useMemo, useState } from "react";
import { QAIDAH_BOOKS, qaidahBook, type QaidahBookId } from "@/data/qaidah";
import { PORTION_LABELS, PORTION_ARABIC, formatDay } from "@/data/demo";
import { useQaidahPages } from "@/hooks/useQaidahPages";
import type { QaidahClassroom } from "@/components/QaidahAssignPanel";
import { QAIDAH_NOTE_MAX } from "@/lib/qaidahLessons";
import { MAX_QAIDAH_PAGE, QAIDAH_PORTIONS, pagesNewestFirst, pagesText, type QaidahPageAssignment, type QaidahPortion } from "@/lib/qaidahPages";
import { SectionCard, EmptyNote } from "@/components/portal-ui";
import { useLanguage } from "@/components/LanguageProvider";
import { countLabel } from "@/lib/i18n/phrases";

const field =
  "w-full bg-surface-card border border-surface-border rounded-2xl px-4 py-3 text-ink focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/40 transition";

const STATUS_STYLE: Record<QaidahPageAssignment["status"], string> = {
  assigned: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  passed: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200",
  repeat: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
};

/**
 * Setting Qa'idah work by pages of the book, the way a Qur'an assignment is
 * set: which book, from which page to which, as a new lesson or a revision,
 * with a due date. For one child or a whole halaqa.
 */
export function QaidahPagesPanel({ room, book: initialBook }: { room: QaidahClassroom; book: QaidahBookId }) {
  const { tr, language } = useLanguage();
  const { mode, students } = room;
  const { rows, setRows, ready, missingTable } = useQaidahPages(mode);

  const [who, setWho] = useState("");
  const [book, setBook] = useState<QaidahBookId>(initialBook);
  const [portion, setPortion] = useState<QaidahPortion>("new");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [due, setDue] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const halaqas = useMemo(() => {
    const by = new Map<string, string[]>();
    for (const s of students) if (s.halaqa) by.set(s.halaqa, [...(by.get(s.halaqa) ?? []), s.id]);
    return [...by.entries()].sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }));
  }, [students]);
  const nameOf = (id: string) => students.find((s) => s.id === id)?.name ?? tr("Student");

  const idsFor = (value: string): string[] =>
    value.startsWith("h:") ? halaqas.find(([name]) => `h:${name}` === value)?.[1] ?? [] : value ? [value] : [];

  const pageWords = { one: tr("Page {page}"), many: tr("Pages {from}–{to}") };
  const first = parseInt(from);
  const last = parseInt(to || from);
  const valid = idsFor(who).length > 0 && first >= 1 && last >= first && last <= MAX_QAIDAH_PAGE;

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || saving) return;
    setSaving(true);
    setMessage(null);
    try {
      const ids = idsFor(who);
      if (mode === "demo") {
        const now = new Date().toISOString();
        const made: QaidahPageAssignment[] = ids.map((student_id, i) => ({
          id: `demo-${Date.now()}-${i}`,
          student_id,
          book,
          page_start: first,
          page_end: last,
          portion,
          due_date: due || null,
          note: note.trim() || null,
          status: "assigned",
          teacher_id: null,
          assigned_at: now,
          passed_at: null,
        }));
        setRows((now0) => [...made, ...now0]);
      } else {
        const res = await fetch("/api/qaidah-pages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ student_ids: ids, book, page_start: first, page_end: last, portion, due_date: due || null, note: note.trim() || null }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "That didn't save. Please try again.");
        setRows((now0) => [...((data.pages ?? []) as QaidahPageAssignment[]), ...now0]);
      }
      setMessage({
        ok: true,
        text: tr("Set {pages} of {book} for {who}", {
          pages: pagesText({ page_start: first, page_end: last }, pageWords).toLowerCase(),
          book: qaidahBook(book).shortName,
          who: countLabel("{count} student|{count} students", ids.length, `${ids.length} ${ids.length === 1 ? "student" : "students"}`),
        }),
      });
      setFrom("");
      setTo("");
      setNote("");
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? tr(err.message) : tr("That didn't save. Please try again.") });
    } finally {
      setSaving(false);
    }
  };

  const mark = async (row: QaidahPageAssignment, status: QaidahPageAssignment["status"]) => {
    if (mode !== "demo") {
      const res = await fetch(`/api/qaidah-pages/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) return setMessage({ ok: false, text: tr("That didn't save. Please try again.") });
    }
    setRows((now) => now.map((r) => (r.id === row.id ? { ...r, status, passed_at: status === "passed" ? new Date().toISOString() : null } : r)));
  };
  const remove = async (row: QaidahPageAssignment) => {
    if (mode !== "demo") {
      const res = await fetch(`/api/qaidah-pages/${row.id}`, { method: "DELETE" });
      if (!res.ok) return setMessage({ ok: false, text: tr("That didn't go. Please try again.") });
    }
    setRows((now) => now.filter((r) => r.id !== row.id));
  };

  const shown = pagesNewestFirst(rows).slice(0, 30);

  return (
    <SectionCard title={tr("Set by pages")} note={countLabel("{count} set|{count} set", rows.length, `${rows.length}`)}>
      {missingTable ? (
        <EmptyNote>{tr("Qa'idah pages need the latest database update. The school's administrator can run it in Supabase.")}</EmptyNote>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
          <form onSubmit={create} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-ink mb-2">{tr("Student *")}</label>
              <select value={who} onChange={(e) => setWho(e.target.value)} className={field}>
                <option value="">{tr("Select a student")}</option>
                {halaqas.length > 0 && (
                  <optgroup label={tr("A whole halaqa")}>
                    {halaqas.map(([name, ids]) => (
                      <option key={name} value={`h:${name}`}>
                        {tr("Everyone in {name} ({count})", { name, count: ids.length })}
                      </option>
                    ))}
                  </optgroup>
                )}
                <optgroup label={tr("One student")}>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-ink mb-2">{tr("Book *")}</label>
              <select value={book} onChange={(e) => setBook(e.target.value as QaidahBookId)} className={field}>
                {QAIDAH_BOOKS.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <p className="text-sm font-semibold text-ink mb-2">{tr("Portion *")}</p>
              <div className="grid grid-cols-3 gap-2">
                {QAIDAH_PORTIONS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPortion(p)}
                    aria-pressed={portion === p}
                    className={`rounded-2xl border px-2 py-2.5 text-center transition ${
                      portion === p ? "bg-brand-navy text-white border-brand-navy" : "bg-surface-card text-ink border-surface-border hover:border-brand-navy/40"
                    }`}
                  >
                    <span className="block text-[12.5px] font-semibold leading-tight">{PORTION_LABELS[p]}</span>
                    <span className="block text-[12px] leading-tight mt-0.5 opacity-70 font-arabic" dir="rtl" lang="ar">
                      {PORTION_ARABIC[p]}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-ink mb-2">{tr("From page *")}</label>
                <input type="number" min="1" max={MAX_QAIDAH_PAGE} value={from} onChange={(e) => setFrom(e.target.value)} placeholder="1" className={field} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-ink mb-2">{tr("To page")}</label>
                <input type="number" min="1" max={MAX_QAIDAH_PAGE} value={to} onChange={(e) => setTo(e.target.value)} placeholder={from || "1"} className={field} />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-ink mb-2">{tr("Due Date (optional)")}</label>
              <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className={field} />
            </div>

            <div>
              <label className="block text-sm font-semibold text-ink mb-2">{tr("Notes for student (optional)")}</label>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={QAIDAH_NOTE_MAX} rows={3} placeholder={tr("Add any instructions or tips...")} className={`${field} resize-none`} />
            </div>

            {message && (
              <p className={`text-[13px] ${message.ok ? "text-green-700 dark:text-green-300" : "text-red-700 dark:text-red-300"}`} role="status">
                {message.text}
              </p>
            )}
            <button
              type="submit"
              disabled={!valid || saving}
              className="w-full gradient-emerald text-white font-semibold py-3 rounded-2xl disabled:opacity-40 hover:opacity-90 active:scale-[.98] transition-all"
            >
              {saving ? tr("Saving…") : tr("Set the pages")}
            </button>
            {mode === "demo" && <p className="text-[11px] text-ink-muted">{tr("Sample school: what you set here stays on this page until you leave it.")}</p>}
          </form>

          <div>
            <p className="eyebrow mb-2">{tr("Recently set")}</p>
            {!ready ? null : shown.length === 0 ? (
              <EmptyNote>{tr("No pages set yet.")}</EmptyNote>
            ) : (
              <ul className="divide-y divide-surface-border">
                {shown.map((r) => (
                  <li key={r.id} className="py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold text-ink [overflow-wrap:anywhere]">{nameOf(r.student_id)}</p>
                        <p className="text-[12px] text-ink-muted mt-0.5">
                          {qaidahBook(r.book).shortName} · <span className="font-semibold text-ink">{pagesText(r, pageWords)}</span> · {PORTION_LABELS[r.portion]}
                          {r.due_date ? ` · ${tr("due {day}", { day: formatDay(r.due_date, language) })}` : ""}
                        </p>
                        {r.note && <p className="text-[12px] text-ink-muted mt-1 italic [overflow-wrap:anywhere]">{r.note}</p>}
                      </div>
                      <span className={`text-[10px] font-semibold px-2 py-1 rounded-full flex-shrink-0 ${STATUS_STYLE[r.status]}`}>
                        {r.status === "assigned" ? tr("To do") : r.status === "passed" ? tr("Passed") : tr("Repeat")}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {r.status !== "passed" && (
                        <button type="button" onClick={() => mark(r, "passed")} className="rounded-full border border-green-600/40 text-green-800 dark:text-green-300 text-[11.5px] font-semibold px-3 py-1 hover:bg-green-50 dark:hover:bg-green-950/30">
                          {tr("Passed")}
                        </button>
                      )}
                      {r.status !== "repeat" && (
                        <button type="button" onClick={() => mark(r, "repeat")} className="rounded-full border border-red-600/40 text-red-800 dark:text-red-300 text-[11.5px] font-semibold px-3 py-1 hover:bg-red-50 dark:hover:bg-red-950/30">
                          {tr("Repeat")}
                        </button>
                      )}
                      <button type="button" onClick={() => remove(r)} className="rounded-full border border-surface-border text-ink-muted text-[11.5px] font-semibold px-3 py-1 hover:text-ink hover:border-ink/30">
                        {tr("Remove")}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </SectionCard>
  );
}
