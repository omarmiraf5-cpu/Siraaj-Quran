"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { download, fileNameFor, printPinSheet } from "@/lib/sheetTools";
import { useLanguage } from "@/components/LanguageProvider";
import { phrase } from "@/lib/i18n/phrases";

// Students who can't sign in yet — no PIN, or no sign-in behind it — given
// PINs all at once, a batch at a time (/api/admin/student-pins), and the
// list to print. With everyone done, every student's PIN can be printed.

interface Given {
  id: string;
  name: string;
  pin?: string;
  error?: string;
}

const primary =
  "gradient-emerald text-white text-sm font-semibold px-4 py-2.5 rounded-2xl hover:opacity-90 active:scale-[.98] transition-all disabled:opacity-40";
const ghost =
  "text-sm font-semibold px-4 py-2.5 rounded-2xl border border-surface-border text-ink hover:bg-surface-bg-warm transition disabled:opacity-40";

export default function StudentPins({
  schoolName,
  placeOf,
  refreshKey,
  onDone,
}: {
  schoolName: string;
  /** "Grade 3 · Halaqa A": where each student is, for the printed list. */
  placeOf: (studentId: string) => string;
  /** Changes when the roster does, so the count is read again. */
  refreshKey: number;
  onDone: () => void;
}) {
  const { tr } = useLanguage();
  const supabase = createClient();
  const [without, setWithout] = useState<number | null>(null);
  const [phase, setPhase] = useState<"idle" | "giving" | "done">("idle");
  const [given, setGiven] = useState<Given[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    supabase
      .from("students")
      .select("id", { count: "exact", head: true })
      .eq("active", true)
      .or("pin.is.null,profile_id.is.null")
      .then(({ count }) => setWithout(count ?? 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey, phase]);

  const giveAll = async () => {
    if (!window.confirm(tr("Give a new PIN to each of the {without} students who can't sign in yet? Students who already have a PIN keep it.", { without }))) return;
    setPhase("giving");
    setError(null);
    setTotal(without ?? 0);
    const out: Given[] = [];
    const skip: string[] = [];
    for (let round = 0; round < 200; round++) {
      let body: { results?: Given[]; remaining?: number; error?: string } = {};
      try {
        const res = await fetch("/api/admin/student-pins", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ skip }),
        });
        body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error ?? phrase("That didn't go through"));
      } catch (e) {
        setError(phrase("{problem}. Press the button again to carry on — students already done keep their PIN.", { problem: e instanceof Error ? phrase(e.message) : phrase("That didn't go through") }));
        break;
      }
      const results = body.results ?? [];
      out.push(...results);
      skip.push(...results.filter((r) => r.error).map((r) => r.id));
      setGiven([...out]);
      if (results.length === 0 || (body.remaining ?? 0) === 0) break;
    }
    setPhase("done");
    onDone();
  };

  const made = given.filter((g) => g.pin);
  const failed = given.filter((g) => g.error);
  const withPlace = (rows: Array<{ id: string; name: string; pin?: string }>) => rows.map((r) => ({ ...r, place: placeOf(r.id) }));

  const printEveryone = async () => {
    setPrinting(true);
    const all: Array<{ id: string; full_name: string; pin: string | null }> = [];
    for (let i = 0; ; i += 1000) {
      const { data } = await supabase.from("students").select("id, full_name, pin").eq("active", true).order("full_name").range(i, i + 999);
      all.push(...((data ?? []) as typeof all));
      if ((data ?? []).length < 1000) break;
    }
    setPrinting(false);
    printPinSheet(schoolName, withPlace(all.filter((s) => s.pin).map((s) => ({ id: s.id, name: s.full_name, pin: s.pin ?? "" }))));
  };

  if (without === null) return null;

  if (phase === "idle" && without === 0) {
    return (
      <p className="text-[12.5px] text-ink-muted px-1">
        {tr("Every student has a sign-in PIN.")}{" "}
        <button type="button" onClick={printEveryone} disabled={printing} className="font-semibold text-emerald-700 dark:text-emerald-400 hover:underline">
          {printing ? tr("Getting them…") : tr("Print everyone's PINs")}
        </button>
      </p>
    );
  }

  return (
    <section aria-label={tr("Student PINs")} className="card-quiet p-4 space-y-3">
      {phase === "idle" && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[13.5px] font-semibold text-ink">
              {tr("{count} student can't sign in yet|{count} students can't sign in yet", { count: without })}
            </p>
            <p className="text-[12px] text-ink-muted">{tr("They have no PIN. Give them all one at once, then print the list to hand out.")}</p>
          </div>
          <button type="button" onClick={giveAll} className={primary}>
            {tr("Give them PINs")}
          </button>
        </div>
      )}

      {phase === "giving" && (
        <div>
          <p className="text-[13.5px] font-semibold text-ink">
            {tr("Giving PINs… {count} of {total}", { count: given.length, total })}
          </p>
          <div className="mt-2 h-2 rounded-full bg-surface-bg-warm overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={given.length}>
            <div className="h-full bg-emerald-600 transition-all" style={{ width: `${total ? Math.min(100, (given.length / total) * 100) : 0}%` }} />
          </div>
        </div>
      )}

      {phase === "done" && (
        <div className="space-y-3">
          <p className="text-[13.5px] font-semibold text-ink">
            {tr("{count} PIN given.|{count} PINs given.", { count: made.length })}
            {without > 0 && <span className="font-normal text-ink-muted"> {tr("{without} still to do.", { without })}</span>}
          </p>
          {failed.length > 0 && (
            <p className="text-[12.5px] text-status-error-text">
              {tr("Couldn't give {count}:", { count: failed.length })}{" "}{failed.slice(0, 6).map((f) => f.name).join(", ")}
              {failed.length > 6 ? "…" : ""} — {failed[0].error}
            </p>
          )}
          {error && <p className="text-[12.5px] text-status-error-text">{error}</p>}
          <div className="flex flex-wrap gap-2">
            {made.length > 0 && (
              <>
                <button type="button" onClick={() => printPinSheet(schoolName, withPlace(made))} className={primary}>
                  {tr("Print the PIN list")}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    download(fileNameFor(schoolName, "PINs"), [
                      ["Student", "Halaqa", "PIN"],
                      ...withPlace(made).map((r) => [r.name, r.place, r.pin ?? ""]),
                    ])
                  }
                  className={ghost}
                >
                  {tr("Download as a spreadsheet")}
                </button>
              </>
            )}
            {without > 0 && (
              <button type="button" onClick={giveAll} className={ghost}>
                {tr("Carry on")}
              </button>
            )}
            <button type="button" onClick={() => { setPhase("idle"); setGiven([]); }} className={ghost}>
              {tr("Close")}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
