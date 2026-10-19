"use client";

import { useState } from "react";
import { isValidPin } from "@/lib/studentAuth";
import { useLanguage } from "@/components/LanguageProvider";

const box =
  "w-full bg-surface-card border border-surface-border rounded-xl px-3.5 py-2.5 text-[18px] tracking-[0.5em] text-center text-ink focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/30 transition";
const digits = (v: string) => v.replace(/\D/g, "").slice(0, 4);

/** On a parent's home: set a new sign-in PIN for the child on screen. */
export function ChildPinCard({ studentId, firstName, demo = false }: { studentId: string; firstName: string; demo?: boolean }) {
  const { tr } = useLanguage();
  const [open, setOpen] = useState(false);
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const mismatch = again.length === 4 && next !== again;
  const ready = isValidPin(next) && next === again && !busy;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready) return;
    setBusy(true);
    setError(null);
    try {
      if (demo) throw new Error(tr("This is the sample portal, so the PIN stays the same."));
      const res = await fetch("/api/parent/student-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_id: studentId, pin: next }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? tr("Couldn't change the PIN. Please try again."));
      setDone(true);
      setNext("");
      setAgain("");
    } catch (err) {
      setError(err instanceof Error ? tr(err.message) : tr("Couldn't change the PIN. Please try again."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card-quiet p-5 space-y-3" data-section="child-pin">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center justify-between gap-3 text-start">
        <span>
          <span className="block eyebrow">{tr("{name}'s sign-in PIN", { name: firstName })}</span>
          <span className="block text-[12.5px] text-ink-muted mt-0.5">{tr("Forgotten, or want a new one? Set it here.")}</span>
        </span>
        <span className="text-[13px] font-semibold text-ink flex-shrink-0">{open ? tr("Close") : tr("Change PIN")}</span>
      </button>
      {open &&
        (done ? (
          <p className="text-[13px] text-green-800 dark:text-green-300 leading-relaxed">
            {tr("Done. {name} can sign in with the new PIN now.", { name: firstName })}{" "}
            <button type="button" onClick={() => setDone(false)} className="font-semibold underline">
              {tr("Change it again")}
            </button>
          </p>
        ) : (
          <form onSubmit={save} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-[12px] text-ink-muted">{tr("New PIN")}</span>
                <input aria-label={tr("New PIN")} type="password" inputMode="numeric" autoComplete="new-password" value={next} onChange={(e) => setNext(digits(e.target.value))} className={`${box} mt-1`} />
              </label>
              <label className="block">
                <span className="text-[12px] text-ink-muted">{tr("New PIN again")}</span>
                <input aria-label={tr("New PIN again")} type="password" inputMode="numeric" autoComplete="new-password" value={again} onChange={(e) => setAgain(digits(e.target.value))} className={`${box} mt-1`} />
              </label>
            </div>
            {mismatch && <p className="text-[12px] text-red-700 dark:text-red-300">{tr("The two new PINs aren't the same.")}</p>}
            {error && <p role="alert" className="text-[12px] text-red-700 dark:text-red-300">{error}</p>}
            <button type="submit" disabled={!ready} className="w-full gradient-emerald text-white text-[14px] font-semibold py-2.5 rounded-xl disabled:opacity-40">
              {busy ? tr("Saving…") : tr("Save new PIN")}
            </button>
          </form>
        ))}
    </section>
  );
}
