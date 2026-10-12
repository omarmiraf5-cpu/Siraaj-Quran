"use client";

import { useEffect, useState } from "react";

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
    if (!window.confirm(`Permanently delete ${rows.length} student${rows.length === 1 ? "" : "s"} and everything recorded about them? This can't be undone.`)) return;
    setBusy(true);
    const res = await fetch("/api/admin/students/long-inactive", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: rows.map((r) => r.id) }),
    }).catch(() => null);
    const body = res ? await res.json().catch(() => ({})) : {};
    setBusy(false);
    if (!res?.ok) {
      setNote(body.error ?? "That didn't go through. Please try again.");
      return;
    }
    setNote(
      `Removed ${body.removed} student${body.removed === 1 ? "" : "s"}.` +
        (body.failed?.length ? ` Couldn't remove: ${body.failed.join(", ")}.` : "")
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
                {rows.length} student{rows.length === 1 ? " has" : "s have"} been inactive for over {years} years
              </p>
              <p className="text-[12.5px] text-ink-muted">
                Keeping children&apos;s records only as long as needed is part of looking after them. You can delete these
                for good — their attendance, lessons and messages go too.
              </p>
            </div>
            <button type="button" onClick={() => setOpen((v) => !v)} className="text-[12px] font-semibold text-ink-muted hover:text-ink flex-shrink-0">
              {open ? "Hide" : "See who"}
            </button>
          </div>
          {open && (
            <ul className="flex flex-wrap gap-1.5">
              {rows.map((r) => (
                <li key={r.id} className="text-[12px] rounded-full border border-surface-border bg-surface-bg-warm px-2.5 py-1 text-ink">
                  {r.name} <span className="text-ink-muted">· since {r.inactive_since.slice(0, 10)}</span>
                </li>
              ))}
            </ul>
          )}
          <button type="button" onClick={remove} disabled={busy} className="bg-red-700 text-white text-[13px] font-semibold py-2 px-4 rounded-xl disabled:opacity-50">
            {busy ? "Deleting…" : `Delete their records`}
          </button>
        </>
      )}
      {note && <p className="text-[12.5px] text-ink-muted">{note}</p>}
    </section>
  );
}
