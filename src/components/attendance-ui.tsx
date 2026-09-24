"use client";

import { useCallback, useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Geolocation } from "@capacitor/geolocation";
import { createClient } from "@/lib/supabase/client";
import { demoAttendanceFetch, type DemoRole } from "@/lib/demoAttendance";
import { formatClock, type StaffDay } from "@/lib/attendanceRules";
import { PlanAlertBanner } from "@/components/yearly-plan-ui";

/* ── Which portal is this ──────────────────────────────────────────── */

export type Api = (input: string, init?: RequestInit) => Promise<Response>;

/**
 * Whether this is a signed-in school or the sample portal, and the fetch
 * that goes with it: the live routes, or demoAttendance.ts answering the
 * same routes in the browser.
 */
export function useAttendanceApi(role: DemoRole): { mode: "loading" | "demo" | "real"; api: Api } {
  const [mode, setMode] = useState<"loading" | "demo" | "real">("loading");
  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data: { user } }) => setMode(user ? "real" : "demo"))
      .catch(() => setMode("demo"));
  }, []);
  const api = useCallback<Api>(
    (input, init) => (mode === "demo" ? demoAttendanceFetch(role)(input, init) : fetch(input, init)),
    [mode, role]
  );
  return { mode, api };
}

/* ── Where the phone is ────────────────────────────────────────────── */

export interface Fix {
  latitude: number;
  longitude: number;
  accuracy: number;
}

/** The phone's current position, asked for fresh and as precisely as it
 *  can manage — a cached or network-only fix is what gets someone refused
 *  while standing in the staff room. In the MyDiiwaan app this goes through
 *  the phone's own location service, so the permission prompt names the app
 *  rather than the web address inside it. */
export async function currentPosition(): Promise<Fix> {
  if (Capacitor.isNativePlatform()) return nativePosition();
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      reject(new Error("This device can't share its location, so it can't be used to sign in. Try your phone."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude, accuracy: p.coords.accuracy }),
      (e) =>
        reject(
          new Error(
            e.code === 1
              ? "Location access is blocked for this site. Allow it in your browser settings (tap the icon next to the web address), then try again."
              : e.code === 3
                ? "Finding your location took too long. Try again — near a window helps."
                : "Your location couldn't be found. Check that location services are turned on, then try again."
          )
        ),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );
  });
}

async function nativePosition(): Promise<Fix> {
  const denied = new Error(
    "Location is turned off for MyDiiwaan. Allow it in your phone's Settings (Settings → MyDiiwaan → Location), then try again."
  );
  try {
    let perm = await Geolocation.checkPermissions();
    if (perm.location !== "granted") perm = await Geolocation.requestPermissions({ permissions: ["location"] });
    if (perm.location === "denied") throw denied;
    const p = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
    return { latitude: p.coords.latitude, longitude: p.coords.longitude, accuracy: p.coords.accuracy };
  } catch (e) {
    if (e === denied) throw e;
    const message = e instanceof Error ? e.message.toLowerCase() : "";
    if (message.includes("denied") || message.includes("permission")) throw denied;
    if (message.includes("disabled") || message.includes("services")) {
      throw new Error("Location services are off on this phone. Turn them on in Settings, then try again.");
    }
    if (message.includes("timeout") || message.includes("timed out")) {
      throw new Error("Finding your location took too long. Try again — near a window helps.");
    }
    throw new Error("Your location couldn't be found. Check that location services are turned on, then try again.");
  }
}

/* ── A day's status ────────────────────────────────────────────────── */

const STATUS_STYLE: Record<StaffDay["status"], string> = {
  present: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  late: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  absent: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  reported: "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300",
  excused: "bg-slate-100 text-slate-700 dark:bg-slate-800/40 dark:text-slate-300",
  pending: "bg-slate-100 text-slate-600 dark:bg-slate-800/40 dark:text-slate-300",
  off: "bg-transparent text-ink-muted",
};

export function statusLabel(day: StaffDay, isToday = false): string {
  switch (day.status) {
    case "present": return "On time";
    case "late": return day.minutesLate > 0 ? `Late · ${day.minutesLate} min` : "Late";
    case "absent": return isToday ? "Not signed in" : "Absent";
    case "reported": return "Reported absence";
    case "excused": return "Excused";
    case "pending": return "Not in yet";
    case "off": return "No school";
  }
}

export function StatusPill({ day, isToday = false }: { day: StaffDay; isToday?: boolean }) {
  return (
    <span className={`text-[10.5px] font-semibold px-2 py-1 rounded-full whitespace-nowrap ${STATUS_STYLE[day.status]}`}>
      {statusLabel(day, isToday)}
    </span>
  );
}

/** "In 8:52 am · out 3:05 pm" */
export function timesLine(day: StaffDay): string {
  const parts = [];
  if (day.signedIn) parts.push(`In ${formatClock(day.signedIn)}`);
  if (day.signedOut) parts.push(`out ${formatClock(day.signedOut)}`);
  return parts.join(" · ");
}

/* ── Signing in and out ────────────────────────────────────────────── */

interface MyDay {
  today: string;
  settings: { configured: boolean; start_time: string; grace_minutes: number; radius_m: number; demo?: boolean };
  day: StaffDay;
  signed_in: boolean;
  signed_out: boolean;
}

/**
 * The teacher's sign-in button for today, with the result in plain words.
 * The location is read from the phone only when they tap, and sent to the
 * server, which makes the actual on-the-premises decision.
 */
export function SignInCard({ api, onChange }: { api: Api; onChange?: () => void }) {
  const [data, setData] = useState<MyDay | null>(null);
  const [busy, setBusy] = useState<"" | "locating" | "saving">("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await api("/api/staff-attendance");
    const body = await res.json();
    if (res.ok) setData(body);
    else setError(body.error ?? "Could not load today's sign-in");
  }, [api]);

  useEffect(() => {
    load().catch(() => setError("Could not load today's sign-in"));
  }, [load]);

  const act = async (action: "sign_in" | "sign_out") => {
    setError(null);
    setDone(null);
    try {
      let fix: Fix = { latitude: 0, longitude: 0, accuracy: 0 };
      if (!data?.settings.demo) {
        setBusy("locating");
        fix = await currentPosition();
      }
      setBusy("saving");
      const res = await api("/api/staff-attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...fix }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "That didn't go through — please try again");
      setDone(body.message ?? (action === "sign_in" ? "Signed in — have a good day." : "Signed out — see you next time."));
      await load();
      onChange?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't go through — please try again");
    } finally {
      setBusy("");
    }
  };

  if (!data) {
    return (
      <section className="card-quiet p-5">
        <p className="text-[13px] text-ink-muted">{error ?? "Checking today's sign-in…"}</p>
      </section>
    );
  }

  const { day, settings } = data;
  const due = formatClock(settings.start_time);
  const headline = data.signed_out
    ? `Signed out at ${formatClock(day.signedOut!)}`
    : data.signed_in
      ? `Signed in at ${formatClock(day.signedIn!)}`
      : day.status === "reported"
        ? "You reported an absence for today"
        : day.status === "off"
          ? "No school today"
          : "You haven't signed in yet";
  const sub = data.signed_in
    ? day.status === "late"
      ? `${day.minutesLate} minutes after the ${due} start.`
      : `On time for the ${due} start.`
    : `Staff are due at ${due}. You can only sign in on the school premises.`;

  const canSignIn = settings.configured && !data.signed_in;
  const canSignOut = settings.configured && data.signed_in && !data.signed_out;

  return (
    <section className="card-quiet p-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <p className="eyebrow">Today · staff sign-in</p>
          <p className="page-title text-lg mt-1">{headline}</p>
          <p className="text-[12.5px] text-ink-muted mt-1 leading-relaxed">{sub}</p>
          {data.signed_in && (
            <div className="mt-2">
              <StatusPill day={day} isToday />
            </div>
          )}
        </div>
        <div className="flex gap-2 flex-shrink-0">
          {canSignIn && (
            <button
              type="button"
              onClick={() => act("sign_in")}
              disabled={busy !== ""}
              className="gradient-emerald text-white text-[13px] font-semibold py-2.5 px-5 rounded-xl disabled:opacity-50 active:scale-[.98] transition-all"
            >
              {busy === "locating" ? "Checking your location…" : busy === "saving" ? "Signing in…" : "Sign in"}
            </button>
          )}
          {canSignOut && (
            <button
              type="button"
              onClick={() => act("sign_out")}
              disabled={busy !== ""}
              className="bg-brand-navy text-white text-[13px] font-semibold py-2.5 px-5 rounded-xl disabled:opacity-50 active:scale-[.98] transition-all"
            >
              {busy === "locating" ? "Checking your location…" : busy === "saving" ? "Signing out…" : "Sign out"}
            </button>
          )}
        </div>
      </div>

      {!settings.configured && (
        <p className="text-[12.5px] text-amber-800 dark:text-amber-300 mt-3">
          Signing in isn&apos;t switched on yet — the office needs to set the school&apos;s location first.
        </p>
      )}
      {settings.demo && (
        <p className="text-[11.5px] text-ink-muted mt-3">
          Sample portal: the location check and times are simulated. On your school&apos;s portal, signing in
          and out only works on the premises.
        </p>
      )}
      {error && (
        <p role="alert" className="text-[12.5px] text-red-700 dark:text-red-300 mt-3 leading-relaxed">
          {error}
        </p>
      )}
      {done && !error && <p className="text-[12.5px] text-green-800 dark:text-green-300 mt-3">{done}</p>}
    </section>
  );
}

/* ── Notices ───────────────────────────────────────────────────────── */

interface Notice {
  id: string;
  kind: "absence_streak" | "staff_absence_report";
  title: string;
  body: string;
  created_at: string;
  read_at: string | null;
}

/**
 * The notices the portal raised for this person — a child missing five
 * school days in a row, a teacher reporting an absence — until they
 * dismiss them. Renders nothing when there is nothing unread, so it can
 * sit at the top of a dashboard without leaving a gap.
 */
export function NoticesPanel({ api }: { api: Api }) {
  const [items, setItems] = useState<Notice[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    api("/api/notifications")
      .then((r) => r.json())
      .then((b) => setItems(Array.isArray(b?.notifications) ? b.notifications : []))
      .catch(() => {});
  }, [api]);

  const dismiss = async (id: string) => {
    setBusy(id);
    try {
      await api("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      setItems((list) => list.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)));
    } finally {
      setBusy(null);
    }
  };

  const unread = items.filter((n) => !n.read_at);
  if (unread.length === 0) return null;
  return (
    <div className="space-y-2.5">
      {unread.map((n) => (
        <PlanAlertBanner
          key={n.id}
          level={n.kind === "absence_streak" ? "critical" : "info"}
          title={n.title}
          detail={n.body}
          onAcknowledge={() => dismiss(n.id)}
          busy={busy === n.id}
        />
      ))}
    </div>
  );
}
