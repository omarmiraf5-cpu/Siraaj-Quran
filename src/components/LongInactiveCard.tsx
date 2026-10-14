"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";

interface Row {
  id: string;
  name: string;
  inactive_since: string;
}

/**
 * On the Students page when some students have been switched off for more
 * than two years: their records can be removed in one go, so the school
 * doesn't keep children's information for ever.
 */
export function LongInactiveCard({ onRemoved }: { onRemoved: () => void }) {
  const { tr } = useLanguage();
  const [rows, setRows] = useState<Row[]>([]);
  const [years, setYears] = useState(2);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const load = () =>
    fetch("/api/admin/students/long-inactive")
      .then((r) => (r.ok ? r.json() : null))
      .then((b) => {
        if (!b?.available) return;
        setRows(b.students);
        setYears(b.years);
      })
      .catch(() => {});
  useEffect(() => {
    load();
  }, []);

  if (rows.length === 0 && !note) return null;
  const remove = async () => {
    if (!window.confirm(tr("Permanently delete {count} student and everything recorded about them? This can't be undone.|Permanently delete {count} students and everything recorded about them? This can't be undone.", { count: rows.length }))) return;
    setBusy(true);
    const res = await fetch("/api/admin/students/long-inactive", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: rows.map((r) => r.id) }),
    }).catch(() => null);
    const body = res ? await res.json().catch(() => ({})) : {};
    setBusy(false);
    if (!res?.ok) {
      setNote(tr(body.error ?? "That didn't go through. Please try again."));
      return;
    }
    setNote(
      tr("Removed {count} student.|Removed {count} students.", { count: body.removed }) +
        (body.failed?.length ? " " + tr("Couldn't remove: {names}.", { names: body.failed.join(", ") }) : "")
    );
    await load();
    onRemoved();
  };
  return (
    <section className="card-quiet p-5 space-y-3" data-section="long-inactive">
      {rows.length > 0 && (
        <>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[14px] font-semibold text-ink">
                {tr("{count} student has been inactive for over {years} years|{count} students have been inactive for over {years} years", { count: rows.length, years })}
              </p>
              <p className="text-[12.5px] text-ink-muted">
                {tr("Keeping children's records only as long as needed is part of looking after them. You can delete these for good — their attendance, lessons and messages go too.")}
              </p>
            </div>
            <button type="button" onClick={() => setOpen((v) => !v)} className="text-[12px] font-semibold text-ink-muted hover:text-ink flex-shrink-0">
              {open ? tr("Hide") : tr("See who")}
            </button>
          </div>
          {open && (
            <ul className="flex flex-wrap gap-1.5">
              {rows.map((r) => (
                <li key={r.id} className="text-[12px] rounded-full border border-surface-border bg-surface-bg-warm px-2.5 py-1 text-ink">
                  {r.name} <span className="text-ink-muted">{tr("· since {slice}", { slice: r.inactive_since.slice(0, 10) })}</span>
                </li>
              ))}
            </ul>
          )}
          <button type="button" onClick={remove} disabled={busy} className="bg-red-700 text-white text-[13px] font-semibold py-2 px-4 rounded-xl disabled:opacity-50">
            {busy ? tr("Deleting…") : tr("Delete their records")}
          </button>
        </>
      )}
      {note && <p className="text-[12.5px] text-ink-muted">{note}</p>}
    </section>
  );
}
