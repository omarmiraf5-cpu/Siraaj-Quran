"use client";

import { useState } from "react";
import { isValidPin } from "@/lib/studentAuth";

const box =
  "w-full bg-surface-card border border-surface-border rounded-xl px-3.5 py-2.5 text-[18px] tracking-[0.5em] text-center text-ink focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/30 transition";
const digits = (v: string) => v.replace(/\D/g, "").slice(0, 4);

/** A student changes their own PIN: the one they have, then the new one twice. */
export function StudentPinForm({ demo = false }: { demo?: boolean }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const mismatch = again.length === 4 && next !== again;
  const ready = isValidPin(current) && isValidPin(next) && next === again && !busy;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready) return;
    setBusy(true);
    setError(null);
    try {
      if (demo) throw new Error("This is the sample portal, so the PIN stays the same.");
      const res = await fetch("/api/student/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current, next }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Couldn't change your PIN. Please try again.");
      setDone(true);
      setCurrent("");
      setNext("");
      setAgain("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't change your PIN. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section id="pin" className="card-quiet p-5 space-y-3 scroll-mt-4">
      <p className="eyebrow">Change my PIN</p>
      {done ? (
        <>
          <p className="text-[13px] text-green-800 dark:text-green-300 leading-relaxed">
            Done! Use your new PIN next time you sign in. Keep it secret.
          </p>
          <button type="button" onClick={() => setDone(false)} className="text-[12px] font-semibold text-ink-muted hover:text-ink">
            Change it again
          </button>
        </>
      ) : (
        <form onSubmit={save} className="space-y-3">
          <label className="block">
            <span className="text-[12px] text-ink-muted">My PIN now</span>
            <input aria-label="My PIN now" type="password" inputMode="numeric" autoComplete="current-password" value={current} onChange={(e) => setCurrent(digits(e.target.value))} className={`${box} mt-1`} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[12px] text-ink-muted">New PIN</span>
              <input aria-label="New PIN" type="password" inputMode="numeric" autoComplete="new-password" value={next} onChange={(e) => setNext(digits(e.target.value))} className={`${box} mt-1`} />
            </label>
            <label className="block">
              <span className="text-[12px] text-ink-muted">New PIN again</span>
              <input aria-label="New PIN again" type="password" inputMode="numeric" autoComplete="new-password" value={again} onChange={(e) => setAgain(digits(e.target.value))} className={`${box} mt-1`} />
            </label>
          </div>
          {mismatch && <p className="text-[12px] text-red-700 dark:text-red-300">The two new PINs aren&apos;t the same.</p>}
          {error && <p role="alert" className="text-[12px] text-red-700 dark:text-red-300">{error}</p>}
          <button type="submit" disabled={!ready} className="w-full gradient-emerald text-white text-[14px] font-semibold py-2.5 rounded-xl disabled:opacity-40">
            {busy ? "Saving…" : "Change my PIN"}
          </button>
          <p className="text-[11.5px] text-ink-muted">Forgotten your PIN? Your teacher or the school office can give you a new one.</p>
        </form>
      )}
    </section>
  );
}
