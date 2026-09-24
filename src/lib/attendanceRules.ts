import { addDays } from "@/lib/planDates";
import { isInstructionalDay, type SchoolCalendar } from "@/lib/schoolCalendar";

/**
 * Staff sign-in and student absence rules, with no database in them — so
 * the live routes and the sample portal decide "on the premises", "late"
 * and "five days in a row" exactly the same way.
 */

/* ── Being on the premises ─────────────────────────────────────────── */

/** A phone that can only place itself to within this many metres is not
 *  precise enough to tell the school building from the street outside —
 *  that is a location read from the network, not a real fix. */
export const MAX_ACCURACY_M = 100;

export interface SchoolLocation {
  latitude: number;
  longitude: number;
  radius_m: number;
}

export interface DevicePosition {
  latitude: number;
  longitude: number;
  /** The phone's own estimate of how far off it could be, in metres. */
  accuracy: number;
}

/** Straight-line distance between two points on the earth, in metres. */
export function distanceMetres(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }): number {
  const R = 6_371_000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLng = rad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export type PremisesCheck =
  | { ok: true; distance: number; accuracy: number }
  | { ok: false; reason: "imprecise" | "too_far"; distance: number; accuracy: number };

/**
 * Whether a phone's position puts its holder on the school premises.
 *
 * The phone's own accuracy estimate is given the benefit of the doubt —
 * a fix 180 m out with ±40 m accuracy could really be 140 m out, inside a
 * 150 m radius — but only up to MAX_ACCURACY_M. Past that the fix is too
 * vague to say anything, and is refused with its own reason rather than
 * "too far", since the answer is to try again, not to walk closer.
 */
export function checkPremises(school: SchoolLocation, pos: DevicePosition): PremisesCheck {
  const distance = Math.round(distanceMetres(school, pos));
  const accuracy = Math.round(pos.accuracy);
  if (!(accuracy <= MAX_ACCURACY_M)) return { ok: false, reason: "imprecise", distance, accuracy };
  if (distance - accuracy > school.radius_m) return { ok: false, reason: "too_far", distance, accuracy };
  return { ok: true, distance, accuracy };
}

/** "40 m" or "3.2 km" — how far away a teacher was, in words they'd use. */
export function formatDistance(metres: number): string {
  return metres < 1000 ? `${Math.round(metres)} m` : `${(Math.round(metres / 100) / 10).toFixed(1)} km`;
}

/* ── The school's own clock ────────────────────────────────────────── */

/** The date and time an instant falls on in the school's own time zone —
 *  what "signed in at 9:07 on Saturday" means to the school, wherever the
 *  server happens to run. */
export function localClock(iso: string | Date, timeZone: string): { date: string; minutes: number; time: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  const hour = Number(get("hour")) % 24;
  const minute = Number(get("minute"));
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    minutes: hour * 60 + minute,
    time: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
  };
}

/** "09:00" or "09:00:00" → minutes after midnight. */
export function minutesOf(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** "9:07 am" — a 24-hour "09:07" the way a school office says it. */
export function formatClock(time: string): string {
  const mins = minutesOf(time);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
}

/* ── A teacher's day ───────────────────────────────────────────────── */

export type StaffDayStatus =
  | "present"
  | "late"
  | "absent"     // a school day with no sign-in and nothing reported
  | "reported"   // the teacher told the office beforehand
  | "excused"    // the office excused it after the fact
  | "pending"    // today, before anyone could call it late
  | "off";       // not a school day

export interface StaffSignIn {
  work_date: string;
  signed_in_at: string | null;
  signed_out_at: string | null;
  override_status: "present" | "late" | "absent" | "excused" | null;
  override_note?: string | null;
}

export interface AbsenceReport {
  id: string;
  from_date: string;
  to_date: string;
  reason: "sick" | "family" | "travel" | "other";
  note: string | null;
  cancelled_at: string | null;
}

export const REASON_LABEL: Record<AbsenceReport["reason"], string> = {
  sick: "Sick",
  family: "Family matter",
  travel: "Travelling",
  other: "Other",
};

export interface StaffPolicy {
  timeZone: string;
  /** "09:00" */
  startTime: string;
  graceMinutes: number;
  cal: SchoolCalendar;
}

export interface StaffDay {
  date: string;
  status: StaffDayStatus;
  /** Local "HH:MM", when they signed in or out. */
  signedIn: string | null;
  signedOut: string | null;
  minutesLate: number;
  report: AbsenceReport | null;
  note: string | null;
}

/**
 * What one day looks like for one teacher.
 *
 * The office's correction wins over everything. Otherwise a sign-in is
 * present or late by the school's start time plus its grace minutes; a
 * school day covered by a report is a reported absence; and a school day
 * with neither is an absence — except today, which is only "not signed in
 * yet" until the grace period has run out.
 */
export function staffDay(
  date: string,
  row: StaffSignIn | undefined,
  reports: AbsenceReport[],
  policy: StaffPolicy,
  now: string | Date = new Date()
): StaffDay {
  const clockNow = localClock(now, policy.timeZone);
  const report =
    reports.find((r) => !r.cancelled_at && r.from_date <= date && date <= r.to_date) ?? null;
  const signedIn = row?.signed_in_at ? localClock(row.signed_in_at, policy.timeZone).time : null;
  const signedOut = row?.signed_out_at ? localClock(row.signed_out_at, policy.timeZone).time : null;
  const dueBy = minutesOf(policy.startTime) + policy.graceMinutes;
  const minutesLate = signedIn ? Math.max(0, minutesOf(signedIn) - minutesOf(policy.startTime)) : 0;
  const base = { date, signedIn, signedOut, report, note: row?.override_note ?? null };

  if (row?.override_status) {
    return { ...base, status: row.override_status, minutesLate: row.override_status === "late" ? minutesLate : 0 };
  }
  if (signedIn) {
    const late = minutesOf(signedIn) > dueBy;
    return { ...base, status: late ? "late" : "present", minutesLate: late ? minutesLate : 0 };
  }
  if (!isInstructionalDay(date, policy.cal)) return { ...base, status: "off", minutesLate: 0 };
  if (report) return { ...base, status: "reported", minutesLate: 0 };
  if (date > clockNow.date) return { ...base, status: "pending", minutesLate: 0 };
  if (date === clockNow.date && clockNow.minutes <= dueBy) return { ...base, status: "pending", minutesLate: 0 };
  return { ...base, status: "absent", minutesLate: 0 };
}

/** Every day from `from` to `to` inclusive, oldest first. */
export function daysBetweenInclusive(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from, guard = 0; d <= to && guard < 400; d = addDays(d, 1), guard++) out.push(d);
  return out;
}

export interface StaffTally {
  schoolDays: number;
  present: number;
  late: number;
  absent: number;
  reported: number;
  excused: number;
  minutesLate: number;
}

export function tallyStaffDays(days: StaffDay[]): StaffTally {
  const t: StaffTally = { schoolDays: 0, present: 0, late: 0, absent: 0, reported: 0, excused: 0, minutesLate: 0 };
  for (const d of days) {
    if (d.status === "off" || d.status === "pending") continue;
    t.schoolDays++;
    if (d.status === "present") t.present++;
    else if (d.status === "late") { t.late++; t.minutesLate += d.minutesLate; }
    else if (d.status === "absent") t.absent++;
    else if (d.status === "reported") t.reported++;
    else if (d.status === "excused") t.excused++;
  }
  return t;
}

/* ── A student's run of absences ───────────────────────────────────── */

/** How many school days in a row before parents and the office are told. */
export const ABSENCE_ALERT_DAYS = 5;

export type RegisterStatus = "present" | "late" | "absent" | "excused";

export interface AbsenceRun {
  /** School days marked absent in the run. */
  count: number;
  from: string;
  to: string;
}

/**
 * The run of absences that includes `date`, if the student was absent that
 * day.
 *
 * Built from the days the register was actually taken, so a day nobody
 * marked is simply not in the record rather than breaking the run. A day
 * marked present or late ends it. An excused day neither counts toward it
 * nor ends it: the child still wasn't there, but the school already knows
 * why, so it is not the day that should set off a notice.
 *
 * More than one teacher can mark the same child on the same day; the day
 * counts as attended if any of them saw the child.
 */
export function absenceRunContaining(
  records: Array<{ date: string; status: RegisterStatus }>,
  date: string
): AbsenceRun | null {
  const byDate = new Map<string, RegisterStatus>();
  const rank: Record<RegisterStatus, number> = { present: 3, late: 3, excused: 2, absent: 1 };
  for (const r of records) {
    const prev = byDate.get(r.date);
    if (!prev || rank[r.status] > rank[prev]) byDate.set(r.date, r.status);
  }
  if (byDate.get(date) !== "absent") return null;

  const dates = [...byDate.keys()].sort();
  const at = dates.indexOf(date);
  let from = date;
  let to = date;
  let count = 1;
  for (let i = at - 1; i >= 0; i--) {
    const s = byDate.get(dates[i])!;
    if (s === "present" || s === "late") break;
    if (s === "absent") { count++; from = dates[i]; }
  }
  for (let i = at + 1; i < dates.length; i++) {
    const s = byDate.get(dates[i])!;
    if (s === "present" || s === "late") break;
    if (s === "absent") { count++; to = dates[i]; }
  }
  return { count, from, to };
}
