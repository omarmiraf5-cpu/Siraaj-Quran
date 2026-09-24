"use client";

import { useCallback, useEffect, useState } from "react";
import { PortalHero } from "@/components/PortalHero";
import { SectionCard, StatTile, EmptyNote, LoadingNote } from "@/components/portal-ui";
import { StatusPill, currentPosition, timesLine, useAttendanceApi, statusLabel } from "@/components/attendance-ui";
import {
  REASON_LABEL,
  formatClock,
  formatDistance,
  type AbsenceReport,
  type StaffDay,
  type StaffTally,
} from "@/lib/attendanceRules";
import { formatDay } from "@/data/demo";
import { useLanguage } from "@/components/LanguageProvider";

/**
 * The office's view of staff attendance: who is in today and when they
 * arrived, four weeks of lateness and absences per teacher, what teachers
 * reported ahead of time — and the settings every sign-in is checked
 * against: where the school is, how far counts as on the premises, and
 * when staff are due.
 */

interface TeacherRow {
  id: string;
  name: string;
  today: StaffDay;
  days: StaffDay[];
  tally: StaffTally;
}
interface Payload {
  today: string;
  from: string;
  to: string;
  settings: {
    configured: boolean;
    latitude: number | null;
    longitude: number | null;
    radius_m: number;
    start_time: string;
    grace_minutes: number;
    demo?: boolean;
  };
  teachers: TeacherRow[];
  reports: Array<AbsenceReport & { teacher_name: string }>;
}

const RADII = [100, 150, 250, 500];
const input =
  "w-full bg-surface-card border border-surface-border rounded-xl px-3.5 py-2.5 text-[14px] text-ink focus:outline-none focus:border-brand-navy focus:ring-1 focus:ring-brand-navy/30 transition";
const primary =
  "bg-brand-navy text-white text-[13px] font-semibold py-2.5 px-5 rounded-xl hover:bg-brand-navy-mid disabled:opacity-40 active:scale-[.98] transition-all";
const ghost =
  "text-[13px] font-semibold py-2.5 px-5 rounded-xl border border-surface-border text-ink hover:bg-surface-bg-warm disabled:opacity-40 transition";

export default function StaffAttendancePage() {
  const { language } = useLanguage();
  const { mode, api } = useAttendanceApi("admin");
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [editingSettings, setEditingSettings] = useState(false);

  const load = useCallback(async () => {
    const res = await api("/api/staff-attendance?scope=school");
    const body = await res.json();
    if (!res.ok) throw new Error(body.error ?? "Could not load staff attendance");
    setData(body);
  }, [api]);

  useEffect(() => {
    if (mode === "loading") return;
    load().catch((e) => setError(e.message));
  }, [mode, load]);

  if (mode === "loading" || (!data && !error)) {
    return (
      <div className="max-w-6xl mx-auto pt-10">
        <LoadingNote>Loading staff attendance…</LoadingNote>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="max-w-6xl mx-auto pt-10">
        <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
      </div>
    );
  }

  const inToday = data.teachers.filter((t) => t.today.status === "present" || t.today.status === "late").length;
  const lateToday = data.teachers.filter((t) => t.today.status === "late").length;
  const totals = data.teachers.reduce(
    (a, t) => ({ late: a.late + t.tally.late, absent: a.absent + t.tally.absent, reported: a.reported + t.tally.reported }),
    { late: 0, absent: 0, reported: 0 }
  );
  const upcoming = data.reports.filter((r) => r.to_date >= data.today);
  const when = (r: AbsenceReport) =>
    r.from_date === r.to_date ? formatDay(r.from_date, language) : `${formatDay(r.from_date, language)} – ${formatDay(r.to_date, language)}`;

  return (
    <div className="max-w-6xl mx-auto pb-20 space-y-4 pt-2">
      <PortalHero
        eyebrow="Staff"
        title="Staff attendance"
        meta={[formatDay(data.today, language), `${inToday} of ${data.teachers.length} in today`, `Due ${formatClock(data.settings.start_time)}`]}
      />

      {(!data.settings.configured || editingSettings) && (
        <SettingsCard
          settings={data.settings}
          api={api}
          onSaved={async () => {
            setEditingSettings(false);
            await load();
          }}
          onCancel={data.settings.configured ? () => setEditingSettings(false) : undefined}
        />
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile value={`${inToday}/${data.teachers.length}`} label="In today" sub={lateToday ? `${lateToday} late` : "Nobody late"} />
        <StatTile value={totals.late} label="Late arrivals" sub="Last 4 weeks" />
        <StatTile value={totals.absent} label="Absences" sub="Not reported" />
        <StatTile value={totals.reported} label="Reported" sub="Told the office" />
      </div>

      <SectionCard title="Today" note={`Staff due ${formatClock(data.settings.start_time)} · ${data.settings.grace_minutes} min grace`}>
        {data.teachers.length === 0 ? (
          <EmptyNote>No teachers yet — add them under Teachers.</EmptyNote>
        ) : (
          <ul className="divide-y divide-surface-border -my-1">
            {data.teachers.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-ink truncate">{t.name}</p>
                  <p className="text-[11.5px] text-ink-muted truncate">
                    {timesLine(t.today) ||
                      (t.today.report
                        ? `${REASON_LABEL[t.today.report.reason]}${t.today.report.note ? ` — ${t.today.report.note}` : ""}`
                        : t.today.status === "off" ? "No school today" : "No sign-in yet")}
                  </p>
                </div>
                <StatusPill day={t.today} isToday />
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard title="Last four weeks" note="Tap a teacher to see each day">
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-[13px] min-w-[520px]">
            <thead>
              <tr className="text-start eyebrow">
                <th className="text-start font-semibold py-2 px-1">Teacher</th>
                <th className="text-end font-semibold py-2 px-1">On time</th>
                <th className="text-end font-semibold py-2 px-1">Late</th>
                <th className="text-end font-semibold py-2 px-1">Absent</th>
                <th className="text-end font-semibold py-2 px-1">Reported</th>
                <th className="text-end font-semibold py-2 px-1">Excused</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {data.teachers.map((t) => (
                <tr
                  key={t.id}
                  onClick={() => setOpen(open === t.id ? null : t.id)}
                  className={`cursor-pointer hover:bg-surface-bg-warm ${open === t.id ? "bg-surface-bg-warm" : ""}`}
                >
                  <td className="py-2.5 px-1 font-semibold text-ink">{t.name}</td>
                  <td className="py-2.5 px-1 text-end tabular-nums">{t.tally.present}</td>
                  <td className="py-2.5 px-1 text-end tabular-nums">
                    {t.tally.late}
                    {t.tally.late > 0 && <span className="text-ink-muted text-[11px]"> · {t.tally.minutesLate} min</span>}
                  </td>
                  <td className={`py-2.5 px-1 text-end tabular-nums ${t.tally.absent ? "text-red-700 dark:text-red-300 font-semibold" : ""}`}>{t.tally.absent}</td>
                  <td className="py-2.5 px-1 text-end tabular-nums">{t.tally.reported}</td>
                  <td className="py-2.5 px-1 text-end tabular-nums">{t.tally.excused}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {open && (
          <TeacherDays
            teacher={data.teachers.find((t) => t.id === open)!}
            today={data.today}
            api={api}
            onSaved={() => load().catch(() => {})}
            language={language}
          />
        )}
      </SectionCard>

      <SectionCard title="Reported absences" note={`${upcoming.length} coming up`}>
        {data.reports.length === 0 ? (
          <EmptyNote>No teacher has reported an absence in this period.</EmptyNote>
        ) : (
          <ul className="divide-y divide-surface-border -my-1">
            {[...data.reports].reverse().map((r) => (
              <li key={r.id} className="py-2.5">
                <p className="text-[13px] font-semibold text-ink">
                  {r.teacher_name} · {when(r)}
                  {r.to_date >= data.today && (
                    <span className="ms-2 text-[10.5px] font-semibold px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300">
                      Coming up
                    </span>
                  )}
                </p>
                <p className="text-[11.5px] text-ink-muted">
                  {REASON_LABEL[r.reason]}
                  {r.note ? ` — ${r.note}` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      {data.settings.configured && !editingSettings && (
        <SectionCard title="Sign-in settings" note={data.settings.demo ? "Sample school" : undefined}>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <p className="text-[13px] text-ink-body leading-relaxed">
              Teachers can sign in within <strong>{formatDistance(data.settings.radius_m)}</strong> of the school&apos;s
              pin. Staff are due at <strong>{formatClock(data.settings.start_time)}</strong>, and a sign-in more than{" "}
              <strong>{data.settings.grace_minutes} minutes</strong> after that counts as late.
            </p>
            <button type="button" onClick={() => setEditingSettings(true)} className={ghost}>
              Change
            </button>
          </div>
        </SectionCard>
      )}

      {error && <p className="text-sm text-red-700 dark:text-red-300">{error}</p>}
    </div>
  );
}

/* ── One teacher's days, with the office's corrections ─────────────── */

function TeacherDays({
  teacher,
  today,
  api,
  onSaved,
  language,
}: {
  teacher: TeacherRow;
  today: string;
  api: ReturnType<typeof useAttendanceApi>["api"];
  onSaved: () => void;
  language: "en" | "so" | "ar";
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ status: string; note: string }>({ status: "", note: "" });
  const [saving, setSaving] = useState(false);
  const days = [...teacher.days].reverse().filter((d) => d.status !== "off" || d.signedIn);

  const save = async (date: string) => {
    setSaving(true);
    try {
      await api("/api/staff-attendance", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teacher_id: teacher.id, work_date: date, status: draft.status || null, note: draft.note || null }),
      });
      setEditing(null);
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-4 rounded-2xl border border-surface-border bg-surface-bg-warm p-4">
      <p className="eyebrow mb-2">{teacher.name} · each school day</p>
      <ul className="divide-y divide-surface-border">
        {days.map((d) => (
          <li key={d.date} className="py-2">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-ink">{formatDay(d.date, language)}</p>
                <p className="text-[11.5px] text-ink-muted truncate">
                  {[timesLine(d), d.report ? `${REASON_LABEL[d.report.reason]}${d.report.note ? ` — ${d.report.note}` : ""}` : "", d.note ? `Office: ${d.note}` : ""]
                    .filter(Boolean)
                    .join(" · ") || "No sign-in"}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <StatusPill day={d} isToday={d.date === today} />
                <button
                  type="button"
                  onClick={() => {
                    setEditing(editing === d.date ? null : d.date);
                    setDraft({ status: "", note: d.note ?? "" });
                  }}
                  className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-muted hover:text-ink"
                >
                  Correct
                </button>
              </div>
            </div>
            {editing === d.date && (
              <div className="mt-2 grid grid-cols-1 sm:grid-cols-[180px_1fr_auto] gap-2 items-center">
                <select value={draft.status} onChange={(e) => setDraft((x) => ({ ...x, status: e.target.value }))} className={input}>
                  <option value="">As signed in ({statusLabel(d, d.date === today)})</option>
                  <option value="present">Present</option>
                  <option value="late">Late</option>
                  <option value="absent">Absent</option>
                  <option value="excused">Excused</option>
                </select>
                <input
                  value={draft.note}
                  onChange={(e) => setDraft((x) => ({ ...x, note: e.target.value.slice(0, 500) }))}
                  placeholder="Why — e.g. phone had no signal"
                  className={input}
                />
                <button type="button" onClick={() => save(d.date)} disabled={saving} className={primary}>
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ── Where the school is, and when staff are due ───────────────────── */

function SettingsCard({
  settings,
  api,
  onSaved,
  onCancel,
}: {
  settings: Payload["settings"];
  api: ReturnType<typeof useAttendanceApi>["api"];
  onSaved: () => void;
  onCancel?: () => void;
}) {
  const [lat, setLat] = useState(settings.latitude != null ? String(settings.latitude) : "");
  const [lng, setLng] = useState(settings.longitude != null ? String(settings.longitude) : "");
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [radius, setRadius] = useState(settings.radius_m);
  const [start, setStart] = useState(settings.start_time);
  const [grace, setGrace] = useState(settings.grace_minutes);
  const [busy, setBusy] = useState<"" | "locating" | "saving">("");
  const [error, setError] = useState<string | null>(null);

  const here = async () => {
    setError(null);
    setBusy("locating");
    try {
      const fix = await currentPosition();
      setLat(fix.latitude.toFixed(6));
      setLng(fix.longitude.toFixed(6));
      setAccuracy(Math.round(fix.accuracy));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't get your location");
    } finally {
      setBusy("");
    }
  };

  const save = async () => {
    setError(null);
    setBusy("saving");
    try {
      const res = await api("/api/staff-attendance/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(lat && lng ? { latitude: Number(lat), longitude: Number(lng) } : {}),
          ...(accuracy != null ? { accuracy } : {}),
          radius_m: radius,
          start_time: start,
          grace_minutes: grace,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not save");
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy("");
    }
  };

  return (
    <SectionCard title={settings.configured ? "Sign-in settings" : "Switch on staff sign-in"} note="Only the office can change these">
      {!settings.configured && (
        <p className="text-[13px] text-ink-body leading-relaxed mb-4">
          Teachers can only sign in on the school premises, so first the portal needs to know where the school is.
          The easiest way: stand inside the school with your phone and tap <strong>Use my current location</strong>.
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={here} disabled={busy !== ""} className={primary}>
          {busy === "locating" ? "Finding you…" : "Use my current location"}
        </button>
        {accuracy != null && (
          <span className="text-[12px] text-ink-muted">
            Found you to within {formatDistance(accuracy)}
            {accuracy > 100 ? " — not precise enough; try on a phone, outdoors" : ""}.
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3 mt-4">
        <label className="block">
          <span className="eyebrow block mb-1.5">Latitude</span>
          <input value={lat} onChange={(e) => { setLat(e.target.value); setAccuracy(null); }} placeholder="53.546100" className={input} inputMode="decimal" />
        </label>
        <label className="block">
          <span className="eyebrow block mb-1.5">Longitude</span>
          <input value={lng} onChange={(e) => { setLng(e.target.value); setAccuracy(null); }} placeholder="-113.493800" className={input} inputMode="decimal" />
        </label>
      </div>
      <p className="text-[11.5px] text-ink-muted mt-2">
        Or copy them from Google Maps: press and hold on the school&apos;s building, and the two numbers appear at the top.
      </p>

      <p className="eyebrow mt-5 mb-2">How close counts as on the premises</p>
      <div className="flex flex-wrap gap-2">
        {RADII.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRadius(r)}
            className={`px-3.5 py-2 rounded-full text-[13px] font-semibold transition-all ${
              radius === r ? "bg-brand-navy text-white" : "bg-surface-card border border-surface-border text-ink-muted hover:text-ink"
            }`}
          >
            {formatDistance(r)}
          </button>
        ))}
      </div>
      <p className="text-[11.5px] text-ink-muted mt-2">
        150 m suits most buildings. Go bigger for a large site or a car park teachers arrive through.
      </p>

      <div className="grid grid-cols-2 gap-3 mt-5">
        <label className="block">
          <span className="eyebrow block mb-1.5">Staff are due at</span>
          <input type="time" value={start} onChange={(e) => setStart(e.target.value)} className={input} />
        </label>
        <label className="block">
          <span className="eyebrow block mb-1.5">Minutes before it counts as late</span>
          <input type="number" min={0} max={120} value={grace} onChange={(e) => setGrace(Number(e.target.value))} className={input} />
        </label>
      </div>

      {error && <p role="alert" className="text-[12.5px] text-red-700 dark:text-red-300 mt-3">{error}</p>}
      <div className="mt-4 flex justify-end gap-2.5">
        {onCancel && (
          <button type="button" onClick={onCancel} className={ghost} disabled={busy !== ""}>
            Cancel
          </button>
        )}
        <button type="button" onClick={save} disabled={busy !== "" || !lat || !lng} className={primary}>
          {busy === "saving" ? "Saving…" : "Save settings"}
        </button>
      </div>
    </SectionCard>
  );
}
