"use client";

import { useState } from "react";
import Link from "next/link";
import { useLanguage } from "@/components/LanguageProvider";

// From the link in a Friday progress email: one button to stop them, and
// one to start them again. Nothing happens on opening the page itself.
export default function UnsubscribePage() {
  const { tr } = useLanguage();
  const [state, setState] = useState<"ask" | "off" | "on" | "busy">("ask");
  const [error, setError] = useState<string | null>(null);
  const send = async (again: boolean) => {
    setState("busy");
    setError(null);
    const res = await fetch(`/api/unsubscribe${window.location.search}${again ? "&again=1" : ""}`, { method: "POST" }).catch(() => null);
    const body = res ? await res.json().catch(() => ({})) : {};
    if (!res?.ok) {
      setError(tr(body.error ?? "That didn't save. Please try again."));
      setState("ask");
      return;
    }
    setState(again ? "on" : "off");
  };
  const btn = "bg-brand-navy text-white text-[14px] font-semibold py-2.5 px-5 rounded-xl disabled:opacity-50";
  return (
    <div className="min-h-screen bg-surface-bg">
      <header className="gradient-navy text-white">
        <div className="max-w-xl mx-auto px-5 py-6">
          <p className="font-display text-2xl font-bold">{tr("Weekly progress emails")}</p>
        </div>
      </header>
      <main className="max-w-xl mx-auto px-5 py-8">
        <section className="card-quiet p-6 space-y-4">
          {state === "off" ? (
            <>
              <p className="text-[14px] text-ink">{tr("Done — you won't get the Friday progress emails any more. You can still see everything in MyDiiwaan.")}</p>
              <button type="button" onClick={() => send(true)} className="text-[13px] font-semibold text-ink-muted hover:text-ink underline">
                {tr("Changed your mind? Get them again")}
              </button>
            </>
          ) : state === "on" ? (
            <p className="text-[14px] text-ink">{tr("You'll get the Friday progress emails again, in sha Allah.")}</p>
          ) : (
            <>
              <p className="text-[14px] text-ink">{tr("Stop getting the Friday email about your child's week? Your school will still have everything in MyDiiwaan.")}</p>
              <button type="button" onClick={() => send(false)} disabled={state === "busy"} className={btn}>
                {state === "busy" ? tr("Saving…") : tr("Unsubscribe")}
              </button>
            </>
          )}
          {error && <p className="text-[13px] text-red-700 dark:text-red-300">{error}</p>}
          <p className="text-[12px] text-ink-muted">
            <Link href="/login" className="underline">{tr("Sign in to MyDiiwaan")}</Link> · <Link href="/privacy" className="underline">{tr("Privacy")}</Link>
          </p>
        </section>
      </main>
    </div>
  );
}
