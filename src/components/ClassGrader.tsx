"use client";

import { useMemo, useState } from "react";
import { getSurahById, TOTAL_PAGES } from "@/data/mushaf-index";
import { SurahPicker } from "@/components/SurahPicker";
import { pagesToRange } from "@/lib/pageRange";
import { DAILY_RATING_LABELS, DAILY_RATING_ORDER, PORTION_LABELS, studentName, formatDay, type DemoStudent } from "@/data/demo";
import type { QuranicAssignment, DailyRating, HifzPortion } from "@/hooks/useQuranicAssignments";
import { useLanguage } from "@/components/LanguageProvider";

// What a teacher most often writes. Picked from a menu instead of typed.
export const COMMON_COMMENTS = [
  "Beautiful tajweed, mashaAllah",
  "Recited with confidence",
  "Great effort, keep it up",
  "Needs more practice at home",
  "Review the madd",
  "Review the ghunnah",
  "Review the makharij (letter sounds)",
  "Stumbled in places, please repeat",
  "Memorised well, needs a little polish",
  "Not ready yet, we will repeat this next class",
];

const RATING_COLOUR: Record<DailyRating, string> = {
  excellent: "#15803d",
  very_good: "#0d9488",
  good: "#2563eb",
  weak: "#d97706",
  not_recited: "#6b7385",
};

export interface GraderGroup {
  name: string;
  label: string;
  schedule?: string | null;
  items: QuranicAssignment[];
  /** Everyone in the halaqa, so a child with no work set can still be recorded. */
  members?: Array<{ id: string; name: string }>;
}

export interface RecordedPiece {
  portion: HifzPortion;
  surah: number;
  ayah_start: number;
  surah_end: number;
  ayah_end: number;
}

const inputCls = "w-full bg-surface-card border border-surface-border rounded-xl px-3 py-2.5 text-[14px] text-ink tabular-nums focus:outline-none focus:border-emerald-600";

/** Record what a child recited that nobody had set: new or old, by surah and ayahs or by pages, and how it went. */
function QuickRecord({ name, onSave, onCancel }: { name: string; onSave: (piece: RecordedPiece, rating: DailyRating, note: string | null) => Promise<void>; onCancel: () => void }) {
  const { tr } = useLanguage();
  const [portion, setPortion] = useState<HifzPortion>("new");
  const [by, setBy] = useState<"ayah" | "pages">("ayah");
  const [surah, setSurah] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [pFrom, setPFrom] = useState("");
  const [pTo, setPTo] = useState("");
  const [rating, setRating] = useState<DailyRating | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const piece = ((): RecordedPiece | null => {
    if (by === "pages") {
      const f = parseInt(pFrom);
      if (!f || f < 1 || f > TOTAL_PAGES) return null;
      const r = pagesToRange(f, parseInt(pTo));
      return { portion, surah: r.surah, ayah_start: r.ayahStart, surah_end: r.surahEnd, ayah_end: r.ayahEnd };
    }
    const sId = parseInt(surah);
    const a = parseInt(start);
    const b = parseInt(end);
    const max = getSurahById(sId)?.ayahs ?? 0;
    if (!sId || !a || !b || a > b || b > max) return null;
    return { portion, surah: sId, ayah_start: a, surah_end: sId, ayah_end: b };
  })();
  const summary = piece
    ? `${getSurahById(piece.surah)?.englishName} ${piece.ayah_start} – ${piece.surah_end !== piece.surah ? `${getSurahById(piece.surah_end)?.englishName} ` : ""}${piece.ayah_end}`
    : "";

  const save = async () => {
    if (!piece || !rating) return;
    setBusy(true);
    setError(null);
    try {
      await onSave(piece, rating, note.trim() || null);
    } catch (e) {
      setError(e instanceof Error ? e.message : tr("Couldn't save that. Please try again."));
      setBusy(false);
    }
  };

  const tab = (on: boolean) => `rounded-full px-3 py-1.5 text-[12.5px] font-semibold transition-colors ${on ? "bg-brand-navy text-white" : "text-ink-muted hover:text-ink"}`;
  return (
    <div className="mt-3 rounded-2xl border border-surface-border bg-surface-bg-warm p-4 space-y-3">
      <p className="text-[13px] font-semibold text-ink">{tr("What did {name} recite?", { name: name.split(" ")[0] })}</p>
      <div className="flex flex-wrap gap-2">
        <div role="group" aria-label={tr("Which part")} className="inline-flex rounded-full border border-surface-border bg-surface-card p-0.5">
          {(["new", "recent", "old"] as HifzPortion[]).map((p) => (
            <button key={p} type="button" aria-pressed={portion === p} onClick={() => setPortion(p)} className={tab(portion === p)}>
              {PORTION_LABELS[p]}
            </button>
          ))}
        </div>
        <div role="group" aria-label={tr("Give it by")} className="inline-flex rounded-full border border-surface-border bg-surface-card p-0.5">
          <button type="button" aria-pressed={by === "ayah"} onClick={() => setBy("ayah")} className={tab(by === "ayah")}>{tr("Surah & ayahs")}</button>
          <button type="button" aria-pressed={by === "pages"} onClick={() => setBy("pages")} className={tab(by === "pages")}>{tr("Mushaf pages")}</button>
        </div>
      </div>
      {by === "ayah" ? (
        <div className="grid grid-cols-1 min-[520px]:grid-cols-[1.6fr_1fr_1fr] gap-3">
          <div>
            <label className="block text-xs font-semibold text-ink mb-1.5">{tr("Surah *")}</label>
            <SurahPicker value={surah} onChange={setSurah} placeholder={tr("Choose…")} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-ink mb-1.5">{tr("Ayah Start *")}</label>
            <input type="number" min={1} value={start} onChange={(e) => setStart(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-ink mb-1.5">{tr("Ayah End *")}</label>
            <input type="number" min={1} value={end} onChange={(e) => setEnd(e.target.value)} className={inputCls} />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-ink mb-1.5">{tr("From page")} *</label>
            <input type="number" min={1} max={TOTAL_PAGES} value={pFrom} onChange={(e) => setPFrom(e.target.value)} placeholder="562" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-ink mb-1.5">{tr("To page")}</label>
            <input type="number" min={1} max={TOTAL_PAGES} value={pTo} onChange={(e) => setPTo(e.target.value)} placeholder={pFrom || "566"} className={inputCls} />
          </div>
        </div>
      )}
      {summary && <p className="text-[12px] text-ink-muted">{summary}</p>}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(7.25rem,1fr))] gap-2">
        {DAILY_RATING_ORDER.map((r) => {
          const on = rating === r;
          const c = RATING_COLOUR[r];
          return (
            <button
              key={r}
              type="button"
              aria-pressed={on}
              onClick={() => setRating(on ? null : r)}
              className="min-h-[44px] rounded-[14px] border-2 px-2 py-2.5 text-[13.5px] leading-tight break-words font-bold transition-all active:scale-[.97]"
              style={{ color: on ? "#fff" : c, background: on ? c : "transparent", borderColor: on ? c : `color-mix(in srgb, ${c} 35%, transparent)` }}
            >
              {tr(DAILY_RATING_LABELS[r])}
            </button>
          );
        })}
      </div>
      <select
        aria-label={tr("Comment for the parent")}
        value={COMMON_COMMENTS.includes(note) ? note : ""}
        onChange={(e) => setNote(e.target.value)}
        className="w-full bg-surface-card border border-surface-border rounded-xl px-3 py-2.5 text-[13px] focus:outline-none focus:border-emerald-600"
      >
        <option value="">{tr("Add a comment…")}</option>
        {COMMON_COMMENTS.map((c) => (
          <option key={c} value={c}>{tr(c)}</option>
        ))}
      </select>
      {error && <p className="text-[12.5px] text-status-error-text">{error}</p>}
      <div className="flex items-center gap-2">
        <button type="button" onClick={save} disabled={!piece || !rating || busy} className="flex-1 gradient-emerald text-white text-sm font-semibold py-2.5 rounded-xl disabled:opacity-40 active:scale-[.98] transition-all">
          {busy ? tr("Saving…") : tr("Save")}
        </button>
        <button type="button" onClick={onCancel} className="text-[13px] font-semibold text-ink-muted hover:text-ink px-3">{tr("Cancel")}</button>
      </div>
    </div>
  );
}

/**
 * Grade a whole halaqa from one screen: every child's piece of work on a row,
 * one tap to rate it (saved at once), a menu of common comments, and bulk
 * buttons for the usual cases.
 */
export function ClassGrader({
  groups,
  roster,
  onGrade,
  onRecord,
  initialGroup,
  today,
}: {
  groups: GraderGroup[];
  roster: DemoStudent[];
  onGrade: (a: QuranicAssignment, rating: DailyRating | null, note: string | null) => Promise<void>;
  onRecord?: (studentId: string, piece: RecordedPiece, rating: DailyRating, note: string | null) => Promise<void>;
  /** The halaqa to open on, e.g. from the dashboard's "Record Qur'an" button. */
  initialGroup?: string;
  /** Today's date (YYYY-MM-DD) where the school is: homework due after it waits, and is heard in class on its day. */
  today: string;
}) {
  const { tr } = useLanguage();
  // Opens on the halaqa asked for, else the one used last on this device, else the first.
  const [pick, setPickState] = useState(() => {
    const names = groups.map((g) => g.name);
    let last = "";
    try {
      last = localStorage.getItem("grader_group") ?? "";
    } catch {
      /* private mode */
    }
    const wanted = initialGroup && names.includes(initialGroup) ? initialGroup : names.includes(last) ? last : names[0] ?? "";
    return wanted;
  });
  const setPick = (name: string) => {
    setPickState(name);
    try {
      localStorage.setItem("grader_group", name);
    } catch {
      /* private mode */
    }
  };
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [own, setOwn] = useState<string | null>(null);
  const [ownText, setOwnText] = useState("");
  // Homework due later that the teacher chose to hear today anyway.
  const [early, setEarly] = useState<Set<string>>(new Set());
  // The child whose "what did they recite?" panel is open, and what has been recorded this visit.
  const [recFor, setRecFor] = useState<string | null>(null);
  const [recorded, setRecorded] = useState<Array<{ id: string; name: string; text: string; rating: DailyRating }>>([]);
  const group = groups.find((g) => g.name === pick) ?? groups[0];

  // Today's homework is tomorrow's class work: a piece is heard in class on its due day
  // (or after, if it was missed). Until then it is homework, and waits below.
  const isLater = (a: QuranicAssignment) => Boolean(a.due_date) && (a.due_date as string).slice(0, 10) > today;
  const open = useMemo(
    () => (group?.items ?? []).filter((a) => a.status !== "completed" || touched.has(a.id)),
    [group, touched]
  );
  const rows = useMemo(() => {
    const list = open.filter((a) => !isLater(a) || early.has(a.id) || touched.has(a.id) || Boolean(a.daily_rating));
    return list.sort(
      (a, b) =>
        Number(Boolean(a.daily_rating)) - Number(Boolean(b.daily_rating)) ||
        studentName(a.student_id, roster).localeCompare(studentName(b.student_id, roster))
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, early, touched, roster, today]);
  const homework = useMemo(
    () =>
      open
        .filter((a) => isLater(a) && !early.has(a.id) && !touched.has(a.id) && !a.daily_rating)
        .sort((a, b) => String(a.due_date).localeCompare(String(b.due_date)) || studentName(a.student_id, roster).localeCompare(studentName(b.student_id, roster))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [open, early, touched, roster, today]
  );

  if (!group) return null;
  const withWork = new Set(rows.map((a) => a.student_id));
  const others = (group.members ?? []).filter((m) => !withWork.has(m.id)).sort((a, b) => a.name.localeCompare(b.name));
  const saveRecord = async (id: string, name: string, piece: RecordedPiece, rating: DailyRating, note: string | null) => {
    if (!onRecord) return;
    await onRecord(id, piece, rating, note);
    const label = `${getSurahById(piece.surah)?.englishName} ${piece.ayah_start} – ${piece.surah_end !== piece.surah ? `${getSurahById(piece.surah_end)?.englishName} ` : ""}${piece.ayah_end}`;
    setRecorded((r) => [{ id, name, text: `${label} · ${PORTION_LABELS[piece.portion]}`, rating }, ...r]);
    setRecFor(null);
  };
  const graded = rows.filter((a) => a.daily_rating).length;
  const next = rows.find((a) => !a.daily_rating);

  const save = async (a: QuranicAssignment, rating: DailyRating | null, note: string | null) => {
    setBusy((s) => new Set(s).add(a.id));
    setTouched((s) => new Set(s).add(a.id));
    try {
      await onGrade(a, rating, note);
    } finally {
      setBusy((s) => {
        const n = new Set(s);
        n.delete(a.id);
        return n;
      });
    }
  };

  const bulk = async (rating: DailyRating) => {
    const todo = rows.filter((a) => !a.daily_rating);
    if (todo.length === 0) return;
    const text = tr("Mark {count} children as {rating}?", { count: todo.length, rating: tr(DAILY_RATING_LABELS[rating]) });
    if (typeof window !== "undefined" && !window.confirm(text)) return;
    for (const a of todo) await save(a, rating, a.teacher_notes ?? null);
  };

  const range = (a: QuranicAssignment) => {
    const s = getSurahById(a.surah);
    const e = a.surah_end !== a.surah ? getSurahById(a.surah_end) : null;
    const name = s?.englishName ?? `Surah ${a.surah}`;
    return e ? `${name} ${a.ayah_start} – ${e.englishName} ${a.ayah_end}` : `${name} ${a.ayah_start}–${a.ayah_end}`;
  };

  return (
    <div>
      {groups.length > 1 && (
        <div role="group" aria-label={tr("Halaqa")} className="flex flex-wrap gap-2 mb-3">
          {groups.map((g) => (
            <button
              key={g.name}
              type="button"
              onClick={() => setPick(g.name)}
              aria-pressed={g.name === group.name}
              className={`rounded-full border px-3.5 py-2 text-[13px] font-semibold transition-colors ${
                g.name === group.name ? "bg-brand-navy text-white border-brand-navy" : "bg-surface-card text-ink border-surface-border hover:border-brand-navy/40"
              }`}
            >
              {g.label}
              {g.schedule && (
                <span className={`ms-2 rounded-full px-2 py-0.5 text-[11px] font-semibold ${g.name === group.name ? "bg-white/20 text-white" : "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200"}`}>
                  {g.schedule}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {rows.length === 0 ? (
        <p className="text-sm text-ink-muted py-3">
          {homework.length > 0 ? tr("Nothing is due in class today.") : tr("Nothing to grade in this halaqa right now.")}
        </p>
      ) : (
        <>
          <div className="flex items-center gap-3 mb-2">
            <span className="text-sm font-bold tabular-nums">{tr("{done} of {total} graded", { done: graded, total: rows.length })}</span>
            <div className="flex-1 h-2.5 rounded-full bg-surface-border overflow-hidden">
              <div className="h-full rounded-full bg-emerald-600 transition-all" style={{ width: `${(graded / rows.length) * 100}%` }} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mb-1">
            <button type="button" onClick={() => bulk("excellent")} className="rounded-xl border border-dashed border-surface-border bg-surface-bg-warm px-3.5 py-2.5 text-[13px] font-semibold active:scale-95">
              ✓ {tr("Everyone recited well")}
            </button>
            <button type="button" onClick={() => bulk("not_recited")} className="rounded-xl border border-dashed border-surface-border bg-surface-bg-warm px-3.5 py-2.5 text-[13px] font-semibold active:scale-95">
              {tr("Mark the rest “Did not recite”")}
            </button>
          </div>

          <ul className="divide-y divide-surface-border">
            {rows.map((a) => {
              const done = Boolean(a.daily_rating);
              const isBusy = busy.has(a.id);
              const known = COMMON_COMMENTS.includes(a.teacher_notes ?? "");
              return (
                <li key={a.id} className={`py-3.5 ${done ? "opacity-80" : ""}`}>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <p className="text-[15px] font-bold">
                      {studentName(a.student_id, roster)}
                      {done && <span className="ms-2 text-[12px] font-bold text-emerald-700">{isBusy ? tr("Saving…") : `✓ ${tr("Saved")}`}</span>}
                      {(() => {
                        const due = a.due_date ? a.due_date.slice(0, 10) : "";
                        const setOn = (a.assigned_at ?? "").slice(0, 10);
                        const tag =
                          due && due < today ? { t: tr("Overdue"), c: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200" }
                          : isLater(a) ? { t: tr("Homework, heard early"), c: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200" }
                          : due && setOn && setOn < today ? { t: tr("Homework from {day}", { day: formatDay(setOn) }), c: "bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200" }
                          : null;
                        return tag ? <span className={`ms-2 align-middle rounded-full px-2 py-0.5 text-[11px] font-semibold ${tag.c}`}>{tag.t}</span> : null;
                      })()}
                    </p>
                    <p className="text-[12.5px] text-ink-muted">
                      <b className="font-semibold text-ink">{range(a)}</b> · {PORTION_LABELS[a.portion]}
                    </p>
                  </div>

                  <div className="mt-2.5 grid grid-cols-[repeat(auto-fit,minmax(7.25rem,1fr))] gap-2">
                    {DAILY_RATING_ORDER.map((r) => {
                      const on = a.daily_rating === r;
                      const c = RATING_COLOUR[r];
                      return (
                        <button
                          key={r}
                          type="button"
                          disabled={isBusy}
                          aria-pressed={on}
                          onClick={() => save(a, on ? null : r, a.teacher_notes ?? null)}
                          className="min-h-[48px] rounded-[14px] border-2 px-2 py-3 text-[14px] leading-tight break-words font-bold transition-all active:scale-[.97] disabled:opacity-60"
                          style={{
                            color: on ? "#fff" : c,
                            background: on ? c : "transparent",
                            borderColor: on ? c : `color-mix(in srgb, ${c} 35%, transparent)`,
                          }}
                        >
                          {tr(DAILY_RATING_LABELS[r])}
                        </button>
                      );
                    })}
                  </div>

                  {onRecord && (
                    <button type="button" onClick={() => setRecFor(recFor === `r:${a.id}` ? null : `r:${a.id}`)} className="mt-2 text-[12.5px] font-semibold text-brand-navy dark:text-brand-gold hover:underline">
                      {tr("+ Record something else they recited")}
                    </button>
                  )}
                  {recFor === `r:${a.id}` && (
                    <QuickRecord name={studentName(a.student_id, roster)} onCancel={() => setRecFor(null)} onSave={(piece, rating, note) => saveRecord(a.student_id, studentName(a.student_id, roster), piece, rating, note)} />
                  )}
                  {done && a.daily_rating !== "not_recited" && (
                    <div className="mt-2.5">
                      {own === a.id ? (
                        <div className="flex gap-2">
                          <input
                            value={ownText}
                            onChange={(e) => setOwnText(e.target.value)}
                            placeholder={tr("Write your own comment")}
                            autoFocus
                            className="flex-1 min-w-0 bg-surface-card border border-surface-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-600"
                          />
                          <button
                            type="button"
                            onClick={async () => {
                              await save(a, a.daily_rating!, ownText.trim() || null);
                              setOwn(null);
                            }}
                            className="rounded-xl gradient-emerald text-white px-4 text-sm font-semibold"
                          >
                            {tr("Save")}
                          </button>
                          <button type="button" onClick={() => setOwn(null)} className="text-[13px] text-ink-muted px-2">
                            {tr("Cancel")}
                          </button>
                        </div>
                      ) : (
                        <select
                          aria-label={tr("Comment for the parent")}
                          value={known ? (a.teacher_notes ?? "") : a.teacher_notes ? "__own" : ""}
                          onChange={(e) => {
                            const v = e.target.value;
                            if (v === "__own") {
                              setOwn(a.id);
                              setOwnText(known ? "" : a.teacher_notes ?? "");
                            } else save(a, a.daily_rating!, v || null);
                          }}
                          className="w-full min-[520px]:w-auto min-[520px]:min-w-[22rem] bg-surface-card border border-surface-border rounded-xl px-3 py-2.5 text-[13px] focus:outline-none focus:border-emerald-600"
                        >
                          <option value="">{tr("Add a comment…")}</option>
                          {COMMON_COMMENTS.map((c) => (
                            <option key={c} value={c}>
                              {tr(c)}
                            </option>
                          ))}
                          {a.teacher_notes && !known && <option value="__own">{a.teacher_notes}</option>}
                          <option value="__own">{tr("Write my own…")}</option>
                        </select>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          <div className="sticky bottom-3 mt-3 rounded-2xl bg-brand-navy text-white px-4 py-3 text-sm font-bold shadow-lg">
            {next ? tr("Up next: {name}", { name: studentName(next.student_id, roster) }) : tr("All graded — well done")}
          </div>
        </>
      )}

      {homework.length > 0 && (
        <details className="mt-5 rounded-2xl border border-surface-border bg-surface-bg-warm">
          <summary className="cursor-pointer px-4 py-3 text-[13.5px] font-bold text-ink">
            {tr("Homework for later ({count})", { count: homework.length })}
            <span className="ms-2 text-[12px] font-normal text-ink-muted">{tr("Heard in class on its due day.")}</span>
          </summary>
          <ul className="divide-y divide-surface-border px-4 pb-2">
            {homework.map((a) => (
              <li key={a.id} className="py-2.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold">{studentName(a.student_id, roster)}</p>
                  <p className="text-[12px] text-ink-muted">
                    {range(a)} · {PORTION_LABELS[a.portion]} · {tr("due {day}", { day: formatDay((a.due_date as string).slice(0, 10)) })}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEarly((e) => new Set(e).add(a.id))}
                  className="rounded-xl border border-surface-border bg-surface-card px-3 py-1.5 text-[12.5px] font-semibold active:scale-95"
                >
                  {tr("Hear it now")}
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}

      {onRecord && (recorded.length > 0 || others.length > 0) && (
        <div className="mt-5">
          {recorded.length > 0 && (
            <div className="mb-3 space-y-1.5">
              {recorded.map((r, i) => (
                <p key={i} className="text-[13px]">
                  <span className="font-bold text-emerald-700">✓ {r.name}</span>{" "}
                  <span className="text-ink-muted">{r.text} · {tr(DAILY_RATING_LABELS[r.rating])}</span>
                </p>
              ))}
            </div>
          )}
          {others.length > 0 && (
            <>
              <p className="text-[12px] font-bold tracking-wide text-ink-muted mb-1">{tr("NO WORK SET — RECORD WHAT THEY RECITED")}</p>
              <ul className="divide-y divide-surface-border">
                {others.map((m) => (
                  <li key={m.id} className="py-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[14.5px] font-semibold">{m.name}</span>
                      <button
                        type="button"
                        onClick={() => setRecFor(recFor === m.id ? null : m.id)}
                        className="rounded-xl border border-surface-border bg-surface-card px-3 py-2 text-[13px] font-semibold active:scale-95"
                      >
                        {tr("Record")}
                      </button>
                    </div>
                    {recFor === m.id && <QuickRecord name={m.name} onCancel={() => setRecFor(null)} onSave={(piece, rating, note) => saveRecord(m.id, m.name, piece, rating, note)} />}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
