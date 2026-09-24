import "server-only";

import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildCalendar, DEFAULT_CALENDAR, type SchoolCalendar } from "@/lib/schoolCalendar";
import { localClock, type StaffPolicy } from "@/lib/attendanceRules";

/* eslint-disable @typescript-eslint/no-explicit-any */
export type Db = SupabaseClient<any, "public", any>;

export interface Member {
  id: string;
  role: "admin" | "teacher" | "parent" | "student";
  school_id: string;
  full_name: string;
}

/** Any signed-in member of a school, optionally limited to some roles. */
export async function requireMember(
  supabase: Db,
  roles?: Member["role"][]
): Promise<Member | { error: NextResponse }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Please sign in again" }, { status: 401 }) };

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, school_id, full_name")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.school_id) {
    return { error: NextResponse.json({ error: "This account is not attached to a school" }, { status: 403 }) };
  }
  if (roles && !roles.includes(profile.role)) {
    return { error: NextResponse.json({ error: "This page isn't available for your account" }, { status: 403 }) };
  }
  return profile as Member;
}

export function isError(x: unknown): x is { error: NextResponse } {
  return typeof x === "object" && x !== null && "error" in x;
}

export interface SchoolSettings {
  timeZone: string;
  location: { latitude: number; longitude: number; radius_m: number } | null;
  radius_m: number;
  startTime: string;
  graceMinutes: number;
  cal: SchoolCalendar;
}

/** Where the school is, when staff are due, and which days are school days. */
export async function loadSchoolSettings(supabase: Db, schoolId: string): Promise<SchoolSettings> {
  const [{ data: school, error }, { data: closed }] = await Promise.all([
    supabase
      .from("schools")
      .select("timezone, latitude, longitude, geofence_radius_m, staff_start_time, staff_late_grace_minutes, instructional_weekdays")
      .eq("id", schoolId)
      .maybeSingle(),
    supabase.from("school_calendar_days").select("date").eq("school_id", schoolId),
  ]);
  if (error) throw error;
  const radius = Number(school?.geofence_radius_m ?? 150);
  const hasLocation = school?.latitude != null && school?.longitude != null;
  return {
    timeZone: (school?.timezone as string) || "America/Edmonton",
    location: hasLocation
      ? { latitude: Number(school!.latitude), longitude: Number(school!.longitude), radius_m: radius }
      : null,
    radius_m: radius,
    startTime: String(school?.staff_start_time ?? "09:00").slice(0, 5),
    graceMinutes: Number(school?.staff_late_grace_minutes ?? 5),
    cal: buildCalendar(
      (school?.instructional_weekdays as number[] | null) ?? DEFAULT_CALENDAR.weekdays,
      (closed ?? []).map((d) => d.date as string)
    ),
  };
}

export function policyOf(s: SchoolSettings): StaffPolicy {
  return { timeZone: s.timeZone, startTime: s.startTime, graceMinutes: s.graceMinutes, cal: s.cal };
}

/** Today's date where the school is. */
export function schoolToday(s: SchoolSettings, now: Date = new Date()): string {
  return localClock(now, s.timeZone).date;
}

export interface NewNotification {
  school_id: string;
  recipient_id: string;
  student_id?: string | null;
  kind: "absence_streak" | "staff_absence_report";
  title: string;
  body: string;
  dedupe_key: string;
}

/**
 * Raises notices for people other than the caller — a parent, the office —
 * which no caller's own session may write, so it goes through the service
 * role. Only ever called after the route has checked the caller may act on
 * what the notice is about. A notice already sent under the same key is
 * left as it was, read or not. Never throws: the thing the notice is about
 * has already happened, and failing to announce it should not undo it.
 */
export async function notify(admin: Db, rows: NewNotification[]): Promise<number> {
  if (rows.length === 0) return 0;
  try {
    const { error } = await admin
      .from("notifications")
      .upsert(rows, { onConflict: "recipient_id,dedupe_key", ignoreDuplicates: true });
    if (error) throw error;
    return rows.length;
  } catch (error) {
    console.error("Notifications: could not raise", error);
    return 0;
  }
}

/** The school's admins, who are "the office" for every notice. */
export async function schoolAdmins(admin: Db, schoolId: string): Promise<Array<{ id: string; full_name: string }>> {
  const { data } = await admin
    .from("profiles")
    .select("id, full_name, active")
    .eq("school_id", schoolId)
    .eq("role", "admin");
  return ((data ?? []) as Array<{ id: string; full_name: string; active: boolean | null }>)
    .filter((p) => p.active !== false)
    .map(({ id, full_name }) => ({ id, full_name }));
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Sat 26 Sep" — a date the way a notice reads it. Spelled out by hand
 *  rather than through toLocaleDateString, whose short month names differ
 *  between runtimes ("Sep" in one, "Sept" in another). */
export function shortDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}
