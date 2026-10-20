"use client";

import { useEffect, useMemo, useState } from "react";
import { PortalHero } from "@/components/PortalHero";
import { SectionCard, EmptyNote, LoadingNote, Avatar, OPEN_ROW, RowChevron } from "@/components/portal-ui";
import { createClient } from "@/lib/supabase/client";
import { sessionUser } from "@/lib/supabase/sessionUser";
import { myHalaqas, type MyHalaqa } from "@/lib/teacherScope";
import { gradeLabel } from "@/lib/grades";
import { useLanguage } from "@/components/LanguageProvider";

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
  const [halaqas, setHalaqas] = useState<MyHalaqa[] | null>(null);
  const [signedIn, setSignedIn] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      if (!(await sessionUser(supabase))) {
        setSignedIn(false);
        setHalaqas([]);
        return;
      }
      setHalaqas((await myHalaqas(supabase)) ?? []);
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

function HalaqaRow({ halaqa, open, onToggle, onCount }: { halaqa: MyHalaqa; open: boolean; onToggle: () => void; onCount: (n: number) => void }) {
  const { tr } = useLanguage();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

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

  const shown = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return (detail?.candidates ?? []).filter((c) => !needle || c.name.toLocaleLowerCase().includes(needle)).slice(0, 40);
  }, [detail, query]);

  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className={`w-full flex items-center gap-3 py-3 text-start rounded-xl -mx-2 px-2 transition-colors ${open ? OPEN_ROW : "hover:bg-surface-bg-warm"}`}
      >
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold [overflow-wrap:anywhere]">{halaqa.label}</p>
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
                <p className="text-xs font-semibold text-ink mb-2">{tr("In this halaqa")}</p>
                {detail.members.length === 0 ? (
                  <p className="text-[12.5px] text-ink-muted">{tr("No children yet. Add them below.")}</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {detail.members.map((m) => (
                      <span key={m.id} className="inline-flex items-center gap-1 ps-3 pe-1 py-1 rounded-full bg-surface-card border border-surface-border text-[12.5px] font-semibold text-ink">
                        {m.name}
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
                <ul className="mt-2 divide-y divide-surface-border max-h-80 overflow-y-auto rounded-xl bg-surface-card border border-surface-border">
                  {shown.length === 0 && <li className="px-3 py-3 text-[12.5px] text-ink-muted">{tr("No one found.")}</li>}
                  {shown.map((c) => (
                    <li key={c.id} className="flex items-center gap-3 px-3 py-2">
                      <Avatar name={c.name} />
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-semibold text-ink [overflow-wrap:anywhere]">{c.name}</p>
                        {(c.elsewhere || c.grade !== null) && (
                          <p className="text-[11.5px] text-ink-muted [overflow-wrap:anywhere]">
                            {c.elsewhere ? tr("In {halaqa}", { halaqa: c.elsewhere }) : typeof c.grade === "number" ? gradeLabel(c.grade) : ""}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => change("POST", c)}
                        disabled={Boolean(c.elsewhere) || busy === c.id}
                        className="flex-shrink-0 text-[12.5px] font-semibold px-3 py-1.5 rounded-xl bg-brand-navy text-white disabled:opacity-35"
                      >
                        {busy === c.id ? tr("Adding…") : tr("+ Add")}
                      </button>
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
