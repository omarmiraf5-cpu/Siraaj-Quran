"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// The office's say over the Friday reports: on or off for the school, and a
// look at what this coming Friday's will hold before it goes.

interface Preview {
  ready: boolean;
  on: boolean;
  week: string;
  students: Array<{
    id: string;
    name: string;
    place: string | null;
    skipped: null | "switched_off" | "nothing_recorded";
    lines: Array<{ label: string; lines: string[] }>;
  }>;
  parents: number;
  lastSent: { weekEnding: string; parents: number } | null;
}

const ghost =
  "text-[12.5px] font-semibold px-3.5 py-2 rounded-xl border border-surface-border text-ink hover:bg-surface-bg-warm transition disabled:opacity-40";
const names = (list: string[], max = 12) =>
  list.length <= max ? list.join(", ") : `${list.slice(0, max).join(", ")} and ${list.length - max} more`;

export default function WeeklyReportsCard({ schoolId, graded }: { schoolId: string; graded: boolean }) {
  const [on, setOn] = useState<boolean | null>(null);
  const [ready, setReady] = useState(true);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    createClient()
      .from("schools")
      .select("weekly_reports")
      .eq("id", schoolId)
      .maybeSingle()
      .then(({ data, error }) => {
        // Before the weekly reports update there's no switch to read.
        if (error) setReady(false);
        else setOn(data?.weekly_reports !== false);
      });
  }, [schoolId]);

  const toggle = async () => {
    if (on === null) return;
    setBusy(true);
    setError(null);
    const { data, error } = await createClient().from("schools").update({ weekly_reports: !on }).eq("id", schoolId).select("id");
    if (error || !data?.length) setError(error?.message ?? "That didn't save. Please try again.");
    else {
      setOn(!on);
      setPreview(null);
    }
    setBusy(false);
  };

  const look = async () => {
    if (preview) {
      setPreview(null);
      return;
    }
    setLoadingPreview(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/weekly-report");
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Couldn't put this week's report together");
      setPreview(body);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't put this week's report together");
    } finally {
      setLoadingPreview(false);
    }
  };

  const reported = preview?.students.filter((s) => !s.skipped) ?? [];
  const nothing = preview?.students.filter((s) => s.skipped === "nothing_recorded") ?? [];
  const off = preview?.students.filter((s) => s.skipped === "switched_off") ?? [];

  return (
    <section aria-label="Weekly progress reports" className="card-quiet p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 max-w-2xl">
          <p className="eyebrow">Weekly progress reports</p>
          <p className="text-[13px] text-ink mt-1 leading-relaxed">
            {!ready
              ? "Every Friday afternoon, parents can get a report on their child's week. To start, run the weekly reports update in Supabase."
              : on === false
                ? "Off: no weekly reports go out for this school."
                : "On: every Friday afternoon, each parent whose child had lessons recorded that week gets a report on it, and you get a summary. A child with only attendance doesn't get one."}
          </p>
          {ready && on !== false && (
            <p className="text-[11.5px] text-ink-muted mt-0.5">
              To leave a child out, open them below and untick their weekly report
              {graded ? " — or switch a whole grade off from its heading" : ""}.
            </p>
          )}
        </div>
        {ready && on !== null && (
          <div className="flex flex-wrap gap-2 flex-shrink-0">
            {on && (
              <button type="button" onClick={look} disabled={loadingPreview} aria-expanded={!!preview} className={ghost}>
                {loadingPreview ? "Putting it together…" : preview ? "Hide the preview" : "See this Friday's"}
              </button>
            )}
            <button type="button" onClick={toggle} disabled={busy} className={ghost}>
              {busy ? "Saving…" : on ? "Turn off for the school" : "Turn on"}
            </button>
          </div>
        )}
      </div>
      {error && <p role="alert" className="text-[12.5px] text-red-700 dark:text-red-300">{error}</p>}

      {preview && (
        <div className="rounded-2xl border border-surface-border bg-surface-bg-warm p-4 space-y-3">
          <p className="text-[13px] text-ink">
            <strong>Friday&apos;s report, {preview.week}</strong> — so far, {reported.length} student
            {reported.length === 1 ? "" : "s"} to report on, to {preview.parents} parent{preview.parents === 1 ? "" : "s"}.
            {preview.lastSent && (
              <span className="text-ink-muted">
                {" "}
                Last sent for the week ending {preview.lastSent.weekEnding}, to {preview.lastSent.parents} parent
                {preview.lastSent.parents === 1 ? "" : "s"}.
              </span>
            )}
          </p>
          {reported.length > 0 && (
            <ul className="space-y-1.5">
              {reported.map((s) => (
                <li key={s.id}>
                  <details className="rounded-xl bg-surface-card border border-surface-border px-3 py-2">
                    <summary className="cursor-pointer text-[13px] font-semibold text-ink">
                      {s.name}
                      {s.place && <span className="font-normal text-ink-muted"> · {s.place}</span>}
                    </summary>
                    <div className="mt-2 space-y-1.5">
                      {s.lines.map((section) => (
                        <div key={section.label}>
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">{section.label}</p>
                          {section.lines.map((l, i) => (
                            <p key={i} className="text-[12.5px] text-ink">
                              {l}
                            </p>
                          ))}
                        </div>
                      ))}
                    </div>
                  </details>
                </li>
              ))}
            </ul>
          )}
          {nothing.length > 0 && (
            <p className="text-[12px] text-ink-muted">
              <strong className="text-ink">No report, nothing recorded beyond attendance ({nothing.length}):</strong>{" "}
              {names(nothing.map((s) => s.name))}
            </p>
          )}
          {off.length > 0 && (
            <p className="text-[12px] text-ink-muted">
              <strong className="text-ink">Switched off ({off.length}):</strong> {names(off.map((s) => s.name))}
            </p>
          )}
          <p className="text-[11.5px] text-ink-muted">
            Lessons recorded between now and Friday afternoon go in too.
          </p>
        </div>
      )}
    </section>
  );
}
