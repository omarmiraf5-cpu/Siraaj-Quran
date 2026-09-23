"use client";

import { useEffect, useState } from "react";
import { PortalHero } from "@/components/PortalHero";
import { SectionCard, EmptyNote, LoadingNote } from "@/components/portal-ui";

// Which weekdays carry Qur'an instruction, and which specific dates are
// closed. Every yearly plan's pace figures and behind-schedule alerts read
// this (through /api/school-calendar), so a school unchecking a PE-only
// Friday or uploading its winter break makes every plan realistic at once —
// nothing plan-specific to configure per student.

const WEEKDAYS = [
  { iso: 1, label: "Mon" },
  { iso: 2, label: "Tue" },
  { iso: 3, label: "Wed" },
  { iso: 4, label: "Thu" },
  { iso: 5, label: "Fri" },
  { iso: 6, label: "Sat" },
  { iso: 7, label: "Sun" },
];

interface ClosedDate {
  id: string;
  date: string;
  label: string | null;
}

const ghostBtn =
  "px-4 py-2 rounded-full border border-surface-border text-ink-muted text-sm font-semibold hover:text-ink hover:border-ink/30 transition-all active:scale-95";
const inputClass =
  "w-full bg-surface-card border border-surface-border rounded-2xl px-4 py-3 text-ink focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/40 transition";

function mergeById(prev: ClosedDate[], added: ClosedDate[]): ClosedDate[] {
  const byId = new Map(prev.map((d) => [d.id, d]));
  for (const d of added) byId.set(d.id, d);
  return [...byId.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export default function AdminCalendarPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [weekdays, setWeekdays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [savingWeekdays, setSavingWeekdays] = useState(false);
  const [closedDates, setClosedDates] = useState<ClosedDate[]>([]);

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);

  const [newDate, setNewDate] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [addingDate, setAddingDate] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/school-calendar");
        const payload = await res.json();
        if (!res.ok) throw new Error(payload.error || "Couldn't load the school calendar.");
        setWeekdays(payload.weekdays);
        setClosedDates(payload.closedDates);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't load the school calendar.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const toggleWeekday = async (iso: number) => {
    const next = weekdays.includes(iso)
      ? weekdays.filter((d) => d !== iso)
      : [...weekdays, iso].sort((a, b) => a - b);
    if (next.length === 0) {
      setError("At least one instructional day a week is required.");
      return;
    }
    const prev = weekdays;
    setWeekdays(next);
    setSavingWeekdays(true);
    setError(null);
    try {
      const res = await fetch("/api/school-calendar", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekdays: next }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || "Couldn't update the weekly pattern.");
      setWeekdays(payload.weekdays);
    } catch (e) {
      setWeekdays(prev);
      setError(e instanceof Error ? e.message : "Couldn't update the weekly pattern.");
    } finally {
      setSavingWeekdays(false);
    }
  };

  const uploadFile = async (file: File) => {
    setUploading(true);
    setUploadError(null);
    setUploadNotice(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/school-calendar", { method: "POST", body });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || "Couldn't read that file.");
      const added: ClosedDate[] = payload.added;
      setClosedDates((prev) => mergeById(prev, added));
      setUploadNotice(`Added ${added.length} closed date${added.length === 1 ? "" : "s"}.`);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Couldn't read that file.");
    } finally {
      setUploading(false);
    }
  };

  const addOne = async () => {
    if (!newDate) return;
    setAddingDate(true);
    setAddError(null);
    try {
      const res = await fetch("/api/school-calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: newDate, label: newLabel.trim() || null }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || "Couldn't add that date.");
      const added: ClosedDate[] = payload.added;
      setClosedDates((prev) => mergeById(prev, added));
      setNewDate("");
      setNewLabel("");
    } catch (e) {
      setAddError(e instanceof Error ? e.message : "Couldn't add that date.");
    } finally {
      setAddingDate(false);
    }
  };

  const removeDate = async (id: string) => {
    const prev = closedDates;
    setClosedDates(closedDates.filter((d) => d.id !== id));
    try {
      const res = await fetch(`/api/school-calendar?id=${id}`, { method: "DELETE" });
      if (!res.ok) {
        const payload = await res.json();
        throw new Error(payload.error || "Couldn't remove that date.");
      }
    } catch (e) {
      setClosedDates(prev);
      setError(e instanceof Error ? e.message : "Couldn't remove that date.");
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto pb-20 pt-2">
        <LoadingNote>Loading the school calendar…</LoadingNote>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto pb-20 space-y-4 pt-2">
      <PortalHero
        eyebrow="Scheduling"
        title="School Calendar"
        meta={[
          `${weekdays.length} instructional day${weekdays.length === 1 ? "" : "s"} a week`,
          `${closedDates.length} closed date${closedDates.length === 1 ? "" : "s"}`,
        ]}
      />

      {error && (
        <p className="text-sm text-status-error-text bg-status-error-bg rounded-xl px-3 py-2">{error}</p>
      )}

      <SectionCard title="Instructional days" note={savingWeekdays ? "Saving…" : undefined}>
        <p className="text-xs text-ink-muted -mt-2 mb-3">
          Every yearly plan&apos;s pace and behind-schedule alerts are built around these days.
          Uncheck a day your school doesn&apos;t hold Qur&apos;an class on — a PE-only Friday, say.
        </p>
        <div className="flex flex-wrap gap-2">
          {WEEKDAYS.map((w) => {
            const active = weekdays.includes(w.iso);
            return (
              <button
                key={w.iso}
                type="button"
                onClick={() => toggleWeekday(w.iso)}
                disabled={savingWeekdays}
                className={`px-3.5 py-2 rounded-full text-sm font-semibold transition-all disabled:opacity-50 ${
                  active
                    ? "gradient-emerald text-white"
                    : "bg-surface-card border border-surface-border text-ink-muted hover:text-ink"
                }`}
              >
                {w.label}
              </button>
            );
          })}
        </div>
      </SectionCard>

      <SectionCard title="Closed dates" note={`${closedDates.length} on file`}>
        <p className="text-xs text-ink-muted -mt-2 mb-3">
          Holidays, breaks, and professional-development days — any date no student is expected to
          make progress. These are skipped the same way a non-instructional weekday is.
        </p>

        <div className="rounded-2xl border border-dashed border-surface-border p-4 flex items-center justify-between gap-3 flex-wrap mb-4">
          <div>
            <p className="text-sm font-semibold text-ink">Upload a calendar</p>
            <p className="text-xs text-ink-muted mt-0.5">
              A spreadsheet with a <span className="font-semibold">Date</span> column (or{" "}
              <span className="font-semibold">Start</span>/<span className="font-semibold">End</span> for
              a range like winter break), plus an optional <span className="font-semibold">Label</span>.
            </p>
          </div>
          <label
            className={`${ghostBtn} cursor-pointer flex-shrink-0 ${uploading ? "opacity-50 pointer-events-none" : ""}`}
          >
            {uploading ? "Reading…" : "Upload file"}
            <input
              type="file"
              accept=".xlsx,.csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadFile(file);
                e.target.value = "";
              }}
            />
          </label>
        </div>
        {uploadError && (
          <p className="text-sm text-status-error-text bg-status-error-bg rounded-xl px-3 py-2 mb-3">
            {uploadError}
          </p>
        )}
        {uploadNotice && (
          <p className="text-sm text-status-info-text bg-status-info-bg rounded-xl px-3 py-2 mb-3">
            {uploadNotice}
          </p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-[1fr_1.5fr_auto] gap-3 mb-2">
          <input
            type="date"
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
            className={inputClass}
          />
          <input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="Label (optional) — e.g. Eid holiday"
            className={inputClass}
          />
          <button
            type="button"
            onClick={addOne}
            disabled={!newDate || addingDate}
            className="px-4 py-2 rounded-2xl border-2 border-dashed border-surface-border text-ink-muted hover:border-emerald-600 hover:text-emerald-600 disabled:opacity-40 transition whitespace-nowrap"
          >
            + Add date
          </button>
        </div>
        {addError && <p className="text-sm text-status-error-text mb-2">{addError}</p>}

        {closedDates.length === 0 ? (
          <EmptyNote>No closed dates yet — classes are assumed to run every instructional weekday.</EmptyNote>
        ) : (
          <ul className="divide-y divide-surface-border -my-1 mt-2">
            {closedDates.map((d) => (
              <li key={d.id} className="flex items-center justify-between py-2.5">
                <div>
                  <p className="text-sm font-semibold text-ink">{d.date}</p>
                  {d.label && <p className="text-xs text-ink-muted">{d.label}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => removeDate(d.id)}
                  className="text-status-error-text text-sm hover:underline"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
