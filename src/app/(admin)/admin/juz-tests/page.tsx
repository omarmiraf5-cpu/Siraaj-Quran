"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import { ExamineDay } from "@/components/juz-tests/ExamineDay";
import { JuzBooking } from "@/components/juz-tests/JuzBooking";
import { JuzSettings } from "@/components/juz-tests/JuzSettings";

type Tab = "day" | "book" | "settings";
const KEY = "admin_juz_tab";

/**
 * Juz tests for the office: each day's tests and their results (the office
 * can examine too), booking for any student, and the settings: on or off,
 * tests a day, examiners and test days.
 */
export default function OfficeJuzTestsPage() {
  const { tr } = useLanguage();
  const [tab, setTab] = useState<Tab>("day");
  // The tab they were on, and a fresh look after the settings change.
  const [version, setVersion] = useState(0);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY) as Tab | null;
      if (saved === "day" || saved === "book" || saved === "settings") setTab(saved);
    } catch {}
  }, []);
  const choose = (t: Tab) => {
    setTab(t);
    try {
      localStorage.setItem(KEY, t);
    } catch {}
  };
  const tabs: Array<[Tab, string]> = [
    ["day", tr("Day's tests")],
    ["book", tr("Book")],
    ["settings", tr("Settings")],
  ];

  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <p className="eyebrow">{tr("Hifz")}</p>
        <h1 className="page-title text-2xl md:text-3xl">{tr("Juz tests")}</h1>
      </div>
      <div role="tablist" className="inline-flex rounded-xl bg-surface-card border border-surface-border p-1 gap-1">
        {tabs.map(([t, label]) => (
          <button
            key={t}
            role="tab"
            type="button"
            aria-selected={tab === t}
            onClick={() => choose(t)}
            className={`px-3.5 py-2 rounded-lg text-[13px] font-semibold transition ${tab === t ? "bg-brand-navy text-white" : "text-ink-muted hover:text-ink"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "day" && <ExamineDay key={version} role="admin" heading={false} testHref={(id) => `/admin/juz-tests/${id}`} />}
      {tab === "book" && <JuzBooking key={version} role="admin" heading={false} examineHref="/admin/juz-tests" />}
      {tab === "settings" && <JuzSettings onChange={() => setVersion((v) => v + 1)} />}
    </div>
  );
}
