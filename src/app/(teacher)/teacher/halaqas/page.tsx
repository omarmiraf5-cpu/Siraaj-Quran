"use client";

import { IconBookOpen } from "@/components/icons";
import { useEffect, useMemo, useState } from "react";
import { PortalHero } from "@/components/PortalHero";
import { SectionCard, EmptyNote, LoadingNote, Avatar, OPEN_ROW, RowChevron } from "@/components/portal-ui";
import { createClient } from "@/lib/supabase/client";
import { sessionUser } from "@/lib/supabase/sessionUser";
import { readCache, writeCache } from "@/lib/pageCache";
import { myHalaqas, shortHalaqaLabel, type MyHalaqa } from "@/lib/teacherScope";
import { useMyName } from "@/hooks/useMyName";
import { gradeLabel, gradesLabel, gradesOf } from "@/lib/grades";
import { useLanguage } from "@/components/LanguageProvider";
import Link from "next/link";

interface Member {
  id: string;
  name: string;
}
interface Candidate extends Member {
  grade: number | null;
  /** The halaqa a child is in already, which a teacher can't take them from. */
  elsewhere: string | null;
}
interface Detail {
  halaqa: { id: string; name: string; program: boolean };
  members: Member[];
  candidates: Candidate[];
}

/**
 * A teacher's own halaqas, and putting children in them: search the school's
 * children and add one with a tap. A child already in another teacher's
 * halaqa is shown as such and left alone — moving them is the office's job.
 */
export default function TeacherHalaqasPage() {
  const { tr } = useLanguage();
  // The last visit's list, shown at once while it is read again.
  const [halaqas, setHalaqas] = useState<MyHalaqa[] | null>(() => readCache<MyHalaqa[]>("teacher-halaqas") ?? null);
  const [signedIn, setSignedIn] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const myName = useMyName();

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      if (!(await sessionUser(supabase))) {
        setSignedIn(false);
        setHalaqas([]);
        return;
      }
      const mine = (await myHalaqas(supabase)) ?? [];
      setHalaqas(mine);
      writeCache("teacher-halaqas", mine);
    })().catch(() => setHalaqas([]));
  }, []);

  return (
    <div className="max-w-4xl mx-auto pb-24 space-y-5 pt-2">
      <PortalHero
        eyebrow={tr("Your classes")}
        title={tr("My halaqas")}
        meta={halaqas ? [tr("{count} halaqas", { count: halaqas.length })] : []}
      />
      <SectionCard title={tr("Add children to your halaqa")} note={tr("Open a halaqa to add or remove its children.")}>
        {halaqas === null ? (
          <LoadingNote />
        ) : !signedIn ? (
          <EmptyNote>{tr("Sign in with your own account to manage your halaqas.")}</EmptyNote>
        ) : halaqas.length === 0 ? (
          <EmptyNote>{tr("You aren't teaching a halaqa yet. The school office adds you to one.")}</EmptyNote>
        ) : (
          <ul className="divide-y divide-surface-border -my-1">
            {halaqas.map((h) => (
              <HalaqaRow
                key={h.id}
                halaqa={h}
                title={shortHalaqaLabel(h, halaqas, myName)}
                open={openId === h.id}
                onToggle={() => setOpenId(openId === h.id ? null : h.id)}
                onCount={(n) => setHalaqas((now) => (now ?? []).map((x) => (x.id === h.id ? { ...x, studentIds: new Array(n).fill("") } : x)))}
              />
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}

function HalaqaRow({ halaqa, title, open, onToggle, onCount }: { halaqa: MyHalaqa; title: string; open: boolean; onToggle: () => void; onCount: (n: number) => void }) {
  const { tr } = useLanguage();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  // A halaqa in a graded school offers its own grade's children first; "All grades" widens it.
  const [allGrades, setAllGrades] = useState(false);

  useEffect(() => {
    if (!open || detail) return;
    fetch(`/api/teacher/halaqa-students?class_id=${encodeURIComponent(halaqa.id)}`)
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error ?? "Couldn't load the students");
        setDetail(body as Detail);
        onCount((body as Detail).members.length);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Couldn't load the students"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, detail, halaqa.id]);

  const change = async (method: "POST" | "DELETE", student: Member) => {
    setBusy(student.id);
    setError(null);
    try {
      const res = await fetch("/api/teacher/halaqa-students", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ class_id: halaqa.id, student_id: student.id }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "That didn't save. Please try again.");
      setDetail((d) => {
        if (!d) return d;
        const next =
          method === "POST"
            ? { ...d, members: [...d.members, student].sort((a, b) => a.name.localeCompare(b.name)), candidates: d.candidates.filter((c) => c.id !== student.id) }
            : {
                ...d,
                members: d.members.filter((m) => m.id !== student.id),
                candidates: [...d.candidates, { ...student, grade: null, elsewhere: null }].sort((a, b) => a.name.localeCompare(b.name)),
              };
        onCount(next.members.length);
        return next;
      });
    } catch (e) {
      setError(e instanceof Error ? tr(e.message) : tr("That didn't save. Please try again."));
    } finally {
      setBusy(null);
    }
  };

  // Tick several children, then add them together.
  const [pick, setPick] = useState<Set<string>>(new Set());
  const [addingMany, setAddingMany] = useState(false);
  const addPicked = async (list: Candidate[]) => {
    setAddingMany(true);
    for (const c of list) await change("POST", c);
    setPick(new Set());
    setQuery("");
    setAddingMany(false);
  };

  const shown = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    const narrow = typeof halaqa.grade === "number" && !allGrades && !needle;
    return (detail?.candidates ?? [])
      .filter((c) => (!needle || c.name.toLocaleLowerCase().includes(needle)) && (!narrow || (typeof c.grade === "number" && gradesOf(halaqa.grade, halaqa.alsoGrades).includes(c.grade))))
      // Children with no halaqa yet come first: they are the ones who need one.
      .sort((a, b) => Number(Boolean(a.elsewhere)) - Number(Boolean(b.elsewhere)) || a.name.localeCompare(b.name))
      .slice(0, 40);
  }, [detail, query, allGrades, halaqa.grade, halaqa.alsoGrades]);
  const gradeOnly = typeof halaqa.grade === "number" && !allGrades && !query.trim();

  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className={`w-full flex items-center gap-3 py-3 text-start rounded-xl -mx-2 px-2 transition-colors ${open ? OPEN_ROW : "hover:bg-surface-bg-warm"}`}
      >
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold [overflow-wrap:anywhere]">
            {title}
            {halaqa.schedule && (
              <span className={`ms-2 inline-flex align-middle items-center rounded-full ${open ? "bg-white/20 text-white" : "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200"} px-2 py-0.5 text-[11px] font-semibold`}>
                {halaqa.schedule}
              </span>
            )}
          </p>
          <p className={`text-[12px] ${open ? "text-white/80" : "text-ink-muted"}`}>
            {tr("{count} students", { count: detail ? detail.members.length : halaqa.studentIds.length })}
          </p>
        </div>
        <RowChevron open={open} />
      </button>

      {open && (
        <div className="mb-3 rounded-2xl border border-surface-border bg-surface-bg-warm p-4 space-y-4">
          {!detail && !error && <LoadingNote rows={2} />}
          {error && <p role="alert" className="text-xs font-semibold text-red-700 dark:text-red-400">{error}</p>}
          {detail && (
            <>
              <div>
                <div className="flex items-center justify-between gap-3 mb-2">
                  <p className="text-xs font-semibold text-ink">{tr("In this halaqa")}</p>
                  {detail.members.length > 0 && (
                    // Today's work for the whole halaqa, one child after another.
                    <span className="flex flex-wrap items-center justify-end gap-x-4 gap-y-1">
                      <Link
                        href={`/teacher/quran-assignments?halaqa=${encodeURIComponent(halaqa.label)}#grade`}
                        className="inline-flex items-center gap-1.5 rounded-full bg-[#e0b84f] hover:bg-[#d4a93a] text-[#0e2347] font-bold shadow-sm ring-1 ring-[#b8932f]/40 transition-all active:scale-95 px-4 py-2 text-[13px]"
                      >
                        <IconBookOpen size={14} />
                        {tr("Record Qur'an")}
                      </Link>
                      <Link
                        href={`/teacher/quran-assignments?group=${encodeURIComponent(detail.halaqa.program || typeof halaqa.grade !== "number" ? `p:${halaqa.id}` : String(halaqa.grade))}`}
                        className="text-[12.5px] font-semibold text-brand-navy dark:text-brand-gold hover:underline"
                      >
                        {tr("Set today's work →")}
                      </Link>
                    </span>
                  )}
                </div>
                {detail.members.length === 0 ? (
                  <p className="text-[12.5px] text-ink-muted">{tr("No children yet. Add them below.")}</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {detail.members.map((m) => (
                      <span key={m.id} className="inline-flex items-center gap-1 ps-1 pe-1 py-1 rounded-full bg-surface-card border border-surface-border text-[12.5px] font-semibold text-ink">
                        {/* Tap a child to set their lesson. */}
                        <Link
                          href={`/teacher/quran-assignments?student=${encodeURIComponent(m.id)}`}
                          title={tr("Set {name}'s lesson", { name: m.name })}
                          className="ps-2 pe-0.5 rounded-full hover:text-brand-navy hover:underline dark:hover:text-brand-gold"
                        >
                          {m.name}
                        </Link>
                        <button
                          type="button"
                          onClick={() => change("DELETE", m)}
                          disabled={busy === m.id}
                          aria-label={tr("Take {name} out", { name: m.name })}
                          className="w-5 h-5 rounded-full text-ink-muted hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30 leading-none disabled:opacity-40"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <p className="text-xs font-semibold text-ink mb-2">{tr("Add a child")}</p>
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={tr("Search by name")}
                  aria-label={tr("Search by name")}
                  className="w-full bg-surface-card border border-surface-border rounded-xl px-3 py-2 text-sm text-ink focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/40"
                />
                {typeof halaqa.grade === "number" && (
                  <div role="group" aria-label={tr("Show")} className="flex gap-1.5 mt-2">
                    {[false, true].map((all) => (
                      <button
                        key={String(all)}
                        type="button"
                        onClick={() => setAllGrades(all)}
                        aria-pressed={allGrades === all}
                        className={`rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                          allGrades === all ? "bg-brand-navy text-white border-brand-navy" : "bg-surface-card text-ink border-surface-border hover:border-brand-navy/40"
                        }`}
                      >
                        {all ? tr("All grades") : tr("{grade} only", { grade: gradesLabel(halaqa.grade as number, halaqa.alsoGrades) })}
                      </button>
                    ))}
                  </div>
                )}
                {(() => {
                  const addable = shown.filter((c) => !c.elsewhere);
                  const picked = addable.filter((c) => pick.has(c.id));
                  const allTicked = addable.length > 0 && picked.length === addable.length;
                  return (
                    addable.length > 0 && (
                      <div className="mt-2 flex items-center justify-between gap-3">
                        <button
                          type="button"
                          onClick={() => setPick(allTicked ? new Set() : new Set(addable.map((c) => c.id)))}
                          className="text-[12.5px] font-semibold text-brand-navy dark:text-brand-gold underline-offset-2 hover:underline"
                        >
                          {allTicked ? tr("Untick all") : tr("Tick all shown")}
                        </button>
                        <button
                          type="button"
                          disabled={picked.length === 0 || addingMany || busy !== null}
                          onClick={() => addPicked(picked)}
                          className="rounded-xl bg-brand-navy text-white text-[12.5px] font-semibold px-4 py-2 disabled:opacity-40 active:scale-95 transition"
                        >
                          {addingMany ? tr("Adding…") : picked.length > 0 ? tr("Add {count}", { count: picked.length }) : tr("+ Add")}
                        </button>
                      </div>
                    )
                  );
                })()}
                <ul className="mt-2 divide-y divide-surface-border max-h-80 overflow-y-auto overscroll-contain rounded-xl bg-surface-card border border-surface-border">
                  {shown.length === 0 && (
                    <li className="px-3 py-3 text-[12.5px] text-ink-muted">
                      {gradeOnly ? tr("No one else in this grade. Tap \"All grades\", or search by name.") : tr("No one found.")}
                    </li>
                  )}
                  {shown.map((c) => (
                    <li key={c.id}>
                      <label className={`w-full flex items-center gap-3 px-3 py-2.5 transition-colors ${c.elsewhere ? "opacity-50" : "cursor-pointer hover:bg-surface-bg-warm"}`}>
                        <input
                          type="checkbox"
                          checked={pick.has(c.id)}
                          disabled={Boolean(c.elsewhere) || addingMany}
                          onChange={() =>
                            setPick((now) => {
                              const next = new Set(now);
                              if (next.has(c.id)) next.delete(c.id);
                              else next.add(c.id);
                              return next;
                            })
                          }
                          aria-label={tr("Add {name}", { name: c.name })}
                          className="w-5 h-5 accent-emerald-700 flex-shrink-0"
                        />
                        <Avatar name={c.name} />
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-semibold text-ink [overflow-wrap:anywhere]">{c.name}</p>
                          {(c.elsewhere || c.grade !== null) && (
                            <p className="text-[11.5px] text-ink-muted [overflow-wrap:anywhere]">
                              {c.elsewhere ? tr("In {halaqa}", { halaqa: c.elsewhere }) : typeof c.grade === "number" ? gradeLabel(c.grade) : ""}
                            </p>
                          )}
                        </div>
                      </label>
                    </li>
                  ))}
                </ul>
                {detail.candidates.length > shown.length && !query.trim() && (
                  <p className="text-[11.5px] text-ink-muted mt-1.5">{tr("Showing the first {count}. Search to find others.", { count: shown.length })}</p>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </li>
  );
}
