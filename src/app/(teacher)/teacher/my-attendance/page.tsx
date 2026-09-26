"use client";

import { useCallback, useEffect, useState } from "react";
import { PortalHero } from "@/components/PortalHero";
import { SectionCard, StatTile, EmptyNote, LoadingNote } from "@/components/portal-ui";
import { SignInCard, StatusPill, timesLine, useAttendanceApi } from "@/components/attendance-ui";
import { REASON_LABEL, type AbsenceReport, type StaffDay, type StaffTally } from "@/lib/attendanceRules";
import { formatDay } from "@/data/demo";
import { useLanguage } from "@/components/LanguageProvider";

/**
 * A teacher's own attendance, under "Sign in" in the menu: signing in and
 * out, the last four weeks as the office sees them, and telling the office
 * about an absence ahead of time — which then shows as reported rather than
 * a no-show.
 */

interface Payload {
  today: string;
  days: StaffDay[];
  tally: StaffTally;
  reports: AbsenceReport[];
}

const input =
  "w-full bg-surface-card border border-surface-border rounded-xl px-3.5 py-2.5 text-[14px] text-ink focus:outline-none focus:border-brand-navy focus:ring-1 focus:ring-brand-navy/30 transition";

export default function MyAttendancePage() {
  const { t, language } = useLanguage();
  const { mode, api } = useAttendanceApi("teacher");
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ from: "", to: "", reason: "sick" as AbsenceReport["reason"], note: "" });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await api("/api/staff-attendance");
    const body = await res.json();
    if (!res.ok) throw new Error(body.error ?? "Could not load your attendance");
    setData(body);
    setForm((f) => (f.from ? f : { ...f, from: body.today, to: body.today }));
  }, [api]);

  useEffect(() => {
    if (mode === "loading") return;
    load().catch((e) => setError(e.message));
  }, [mode, load]);

  const report = async () => {
    setSending(true);
    setError(null);
    setSent(null);
    try {
      const res = await api("/api/staff-absence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from_date: form.from, to_date: form.to || form.from, reason: form.reason, note: form.note || null }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not send the report");
      setSent("Sent — the office has been told.");
      setForm((f) => ({ ...f, note: "" }));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send the report");
    } finally {
      setSending(false);
    }
  };

  const withdraw = async (id: string) => {
    setError(null);
    const res = await api(`/api/staff-absence?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    const body = await res.json();
    if (!res.ok) setError(body.error ?? "Could not withdraw it");
    else await load();
  };

  if (mode === "loading" || (!data && !error)) {
    return (
      <div className="max-w-4xl mx-auto pt-10">
        <LoadingNote>Loading your attendance…</LoadingNote>
      </div>
    );
  }

  const schoolDays = (data?.days ?? []).filter((d) => d.status !== "off");
  const upcoming = (data?.reports ?? []).filter((r) => r.to_date >= (data?.today ?? ""));
  const when = (r: AbsenceReport) =>
    r.from_date === r.to_date ? formatDay(r.from_date, language) : `${formatDay(r.from_date, language)} – ${formatDay(r.to_date, language)}`;

  return (
    <div className="max-w-4xl mx-auto pb-20 space-y-4 pt-2">
      <PortalHero
        eyebrow="Staff"
        title={t("nav.signIn")}
        meta={data ? [formatDay(data.today, language), "Last 4 weeks"] : []}
      />

      <SignInCard api={api} onChange={() => load().catch(() => {})} />

      {data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatTile value={data.tally.present} label="On time" sub={`of ${data.tally.schoolDays} school days`} />
          <StatTile value={data.tally.late} label="Late" sub={data.tally.late ? `${data.tally.minutesLate} min in all` : "None"} />
          <StatTile value={data.tally.absent} label="Absent" sub="Not reported" />
          <StatTile value={data.tally.reported + data.tally.excused} label="Reported" sub="Or excused by the office" />
        </div>
      )}

      <SectionCard title="Report an absence" note="The office is told straight away">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="eyebrow block mb-1.5">First day away</span>
            <input
              type="date"
              value={form.from}
              min={data?.today}
              onChange={(e) => setForm((f) => ({ ...f, from: e.target.value, to: f.to < e.target.value ? e.target.value : f.to }))}
              className={input}
            />
          </label>
          <label className="block">
            <span className="eyebrow block mb-1.5">Last day away</span>
            <input
              type="date"
              value={form.to}
              min={form.from || data?.today}
              onChange={(e) => setForm((f) => ({ ...f, to: e.target.value }))}
              className={input}
            />
          </label>
        </div>
        <p className="eyebrow mt-4 mb-2">Reason</p>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(REASON_LABEL) as AbsenceReport["reason"][]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setForm((f) => ({ ...f, reason: r }))}
              className={`px-3.5 py-2 rounded-full text-[13px] font-semibold transition-all ${
                form.reason === r
                  ? "bg-brand-navy text-white"
                  : "bg-surface-card border border-surface-border text-ink-muted hover:text-ink"
              }`}
            >
              {REASON_LABEL[r]}
            </button>
          ))}
        </div>
        <label className="block mt-4">
          <span className="eyebrow block mb-1.5">Note for the office (optional)</span>
          <textarea
            value={form.note}
            onChange={(e) => setForm((f) => ({ ...f, note: e.target.value.slice(0, 500) }))}
            rows={2}
            placeholder="e.g. Doctor's appointment in the morning"
            className={`${input} resize-none`}
          />
        </label>
        <div className="mt-3.5 flex items-center justify-end gap-3">
          {sent && <p className="text-[12.5px] text-green-800 dark:text-green-300">{sent}</p>}
          <button
            type="button"
            onClick={report}
            disabled={sending || !form.from}
            className="bg-brand-navy text-white text-[13px] font-semibold py-2.5 px-5 rounded-xl disabled:opacity-40 active:scale-[.98] transition-all"
          >
            {sending ? "Sending…" : "Send to the office"}
          </button>
        </div>

        {upcoming.length > 0 && (
          <>
            <div className="gold-rule my-4" />
            <p className="eyebrow mb-2">Already reported</p>
            <ul className="divide-y divide-surface-border -my-1">
              {upcoming.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-ink">{when(r)}</p>
                    <p className="text-[11.5px] text-ink-muted truncate">
                      {REASON_LABEL[r.reason]}
                      {r.note ? ` — ${r.note}` : ""}
                    </p>
                  </div>
                  {r.from_date > (data?.today ?? "") && (
                    <button
                      type="button"
                      onClick={() => withdraw(r.id)}
                      className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-muted hover:text-ink flex-shrink-0"
                    >
                      Withdraw
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </SectionCard>

      {error && (
        <div className="bg-red-50 dark:bg-red-950/25 border border-red-200 dark:border-red-800/40 rounded-2xl p-4">
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      <SectionCard title="The last four weeks" note={`${schoolDays.length} school days`}>
        {schoolDays.length === 0 ? (
          <EmptyNote>No school days in the last four weeks.</EmptyNote>
        ) : (
          <ul className="divide-y divide-surface-border -my-1">
            {schoolDays.map((d) => (
              <li key={d.date} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-ink">{formatDay(d.date, language)}</p>
                  <p className="text-[11.5px] text-ink-muted truncate">
                    {timesLine(d) ||
                      (d.report ? `${REASON_LABEL[d.report.reason]}${d.report.note ? ` — ${d.report.note}` : ""}` : d.note ?? "No sign-in")}
                  </p>
                </div>
                <StatusPill day={d} isToday={d.date === data?.today} />
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
