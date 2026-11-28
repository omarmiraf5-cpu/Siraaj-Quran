"use client";

import { useCallback, useEffect, useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import { LoadingNote, SectionCard } from "@/components/portal-ui";
import { callJuz, useJuzApi } from "@/hooks/useJuzTests";
import { formatDay } from "@/data/demo";
import { ErrorNote } from "@/components/juz-tests/shared";

interface Settings {
  enabled: boolean;
  slots: number;
  today: string;
  ready: boolean;
  staff: Array<{ id: string; name: string; office: boolean; examiner: boolean }>;
  days: Array<{ date: string; open: boolean; usual: boolean; changed: boolean; weekend: boolean }>;
}

/**
 * The office's settings: Juz tests on or off, tests a day, who examines,
 * and which days take tests: weekdays open and weekends closed unless the
 * school's week says otherwise, each day changeable here.
 */
export function JuzSettings({ onChange }: { onChange?: () => void }) {
  const { tr, language } = useLanguage();
  const { mode, api } = useJuzApi("admin");
  const [s, setS] = useState<Settings | null>(null);
  const [error, setError] = useState("");
  const [slots, setSlots] = useState("");

  const load = useCallback(async () => {
    try {
      const r = await callJuz<Settings>(api, "/api/juz-tests/settings");
      setS(r);
      setSlots(String(r.slots));
      setError("");
    } catch (e) {
      setError(tr((e as Error).message));
    }
  }, [api, tr]);
  useEffect(() => {
    if (mode !== "loading") load();
  }, [mode, load]);

  const save = async (body: unknown) => {
    try {
      await callJuz(api, "/api/juz-tests/settings", "PATCH", body);
      await load();
      onChange?.();
    } catch (e) {
      setError(tr((e as Error).message));
    }
  };

  if (!s) return error ? <ErrorNote>{error}</ErrorNote> : <LoadingNote rows={3} />;
  if (!s.ready) {
    return <ErrorNote>{tr("Juz tests need a database update before they can be switched on. Ask whoever runs your MyDiiwaan database to run the latest schema.")}</ErrorNote>;
  }

  // Monday-first weeks, from this week's Monday.
  const weeks: Array<Array<Settings["days"][number] | null>> = [];
  const lead = (new Date(s.days[0].date + "T00:00:00Z").getUTCDay() + 6) % 7;
  const cells = [...Array(lead).fill(null), ...s.days];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  const weekdayNames = language === "ar" ? ["ن", "ث", "ر", "خ", "ج", "س", "ح"] : ["M", "T", "W", "T", "F", "S", "S"];

  return (
    <div className="space-y-4">
      {error && <ErrorNote>{error}</ErrorNote>}
      <SectionCard title={tr("Settings")}>
        <div className="space-y-4">
          <label className="flex items-center justify-between gap-3">
            <span>
              <span className="block text-[14px] font-semibold text-ink">{tr("Juz tests")}</span>
              <span className="block text-[12px] text-ink-muted">{tr("Teachers book tests, examiners hear them, parents see the results.")}</span>
            </span>
            <input type="checkbox" className="w-5 h-5" checked={s.enabled} onChange={(e) => save({ enabled: e.target.checked })} />
          </label>
          <div className="flex flex-wrap items-end gap-3">
            <label className="block">
              <span className="block text-[12px] font-semibold text-ink-muted mb-1.5">{tr("Tests a day")}</span>
              <input
                type="number"
                min={1}
                max={50}
                value={slots}
                onChange={(e) => setSlots(e.target.value)}
                className="w-24 min-h-11 bg-surface-card border border-surface-border rounded-xl px-3 py-2.5 text-sm text-ink"
              />
            </label>
            {Number(slots) !== s.slots && (
              <button type="button" onClick={() => save({ slots: Number(slots) })} className="btn btn-primary">
                {tr("Save")}
              </button>
            )}
          </div>
        </div>
      </SectionCard>

      <SectionCard title={tr("Examiners")} note={tr("{count} examining", { count: s.staff.filter((p) => p.examiner).length })}>
        <p className="text-[12px] text-ink-muted mb-3">{tr("Examiners see every day's tests and record the results. The office can always examine.")}</p>
        <ul className="divide-y divide-surface-border">
          {s.staff.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
              <span className="text-[14px] text-ink">
                {p.name}
                {p.office && <span className="text-[12px] text-ink-muted"> · {tr("Office")}</span>}
              </span>
              <input
                type="checkbox"
                className="w-5 h-5"
                checked={p.examiner}
                disabled={p.office}
                aria-label={tr("{name} examines", { name: p.name })}
                onChange={(e) => save({ examiner: { user_id: p.id, on: e.target.checked } })}
              />
            </li>
          ))}
        </ul>
      </SectionCard>

      <SectionCard title={tr("Test days")} note={tr("Next six weeks")}>
        <p className="text-[12px] text-ink-muted mb-3">
          {tr("Tap a day to open or close it for tests. School days are open and weekends closed, unless you change them.")}
        </p>
        <div className="grid grid-cols-7 gap-1.5 text-center" dir="ltr">
          {weekdayNames.map((w, i) => (
            <span key={i} className="text-[11px] font-semibold text-ink-muted">{w}</span>
          ))}
          {weeks.flat().map((d, i) =>
            d ? (
              <button
                key={d.date}
                type="button"
                onClick={() => save({ day: { date: d.date, open: !d.open } })}
                title={formatDay(d.date, language)}
                className={`h-11 rounded-lg text-[13px] font-semibold tabular-nums border transition ${
                  d.open
                    ? "bg-green-50 dark:bg-green-950/30 text-green-800 dark:text-green-200 border-green-200 dark:border-green-900"
                    : "bg-surface-bg text-ink-muted border-surface-border line-through decoration-1"
                } ${d.changed ? "ring-2 ring-brand-gold/60" : ""} ${d.date === s.today ? "outline outline-2 outline-brand-navy" : ""}`}
              >
                {Number(d.date.slice(8))}
              </button>
            ) : (
              <span key={`blank-${i}`} />
            )
          )}
        </div>
        <p className="text-[11px] text-ink-muted mt-2">{tr("Green: open for tests. Ringed: changed from the school's usual week.")}</p>
      </SectionCard>
    </div>
  );
}
