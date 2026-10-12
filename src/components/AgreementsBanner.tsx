"use client";

import Link from "next/link";
import { useState } from "react";
import { useAgreements } from "@/hooks/useAgreements";

/**
 * On the office dashboard until the school has accepted the current terms
 * and confirmed it has parents' agreement: each a tick and a button, saved
 * with the admin's name and the date.
 */
export function AgreementsBanner({ enabled }: { enabled: boolean }) {
  const { agreements: a, accept, error } = useAgreements(enabled);
  const [termsTick, setTermsTick] = useState(false);
  const [consentTick, setConsentTick] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!a || !a.available || (a.termsAccepted && a.consentConfirmed)) return null;

  const run = async (what: "terms" | "consent") => {
    setBusy(true);
    await accept(what);
    setBusy(false);
  };
  const tick = "mt-0.5 w-4 h-4 accent-emerald-700 flex-shrink-0";
  const btn =
    "self-start text-[13px] font-semibold px-4 py-2 rounded-xl bg-brand-navy text-white disabled:opacity-40 hover:opacity-90 transition";
  return (
    <section className="rounded-2xl border border-amber-300 bg-amber-50 dark:bg-amber-950/25 dark:border-amber-800/40 p-5 space-y-4" data-section="agreements">
      <div>
        <p className="font-semibold text-[14px] text-amber-900 dark:text-amber-200">Before you carry on: two things for your school</p>
        <p className="text-[12.5px] text-amber-800/80 dark:text-amber-300/80 mt-0.5">Asked once. They&apos;re saved with your name and today&apos;s date.</p>
      </div>
      {!a.termsAccepted && (
        <div className="flex flex-col gap-2">
          <label className="flex items-start gap-2.5 text-[13px] text-ink">
            <input type="checkbox" checked={termsTick} onChange={(e) => setTermsTick(e.target.checked)} className={tick} />
            <span>
              {a.termsAcceptedAt ? "The terms have changed. " : ""}I accept MyDiiwaan&apos;s{" "}
              <Link href="/terms" target="_blank" className="underline font-semibold">Terms of Service and School Data Agreement</Link> on behalf of the school.
            </span>
          </label>
          <button type="button" disabled={!termsTick || busy} onClick={() => run("terms")} className={btn}>
            Accept the terms
          </button>
        </div>
      )}
      {!a.consentConfirmed && (
        <div className="flex flex-col gap-2">
          <label className="flex items-start gap-2.5 text-[13px] text-ink">
            <input type="checkbox" checked={consentTick} onChange={(e) => setConsentTick(e.target.checked)} className={tick} />
            <span>
              I confirm the school has parents&apos; agreement (for example on its enrolment form) to their children&apos;s
              records being kept in MyDiiwaan, as described in the{" "}
              <Link href="/privacy" target="_blank" className="underline font-semibold">privacy policy</Link>.
            </span>
          </label>
          <button type="button" disabled={!consentTick || busy} onClick={() => run("consent")} className={btn}>
            Confirm
          </button>
        </div>
      )}
      {error && <p className="text-[12.5px] text-red-700 dark:text-red-300">{error}</p>}
    </section>
  );
}
