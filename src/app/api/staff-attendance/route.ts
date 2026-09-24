import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";
import { addDays } from "@/lib/planDates";
import {
  checkPremises,
  daysBetweenInclusive,
  formatDistance,
  localClock,
  staffDay,
  tallyStaffDays,
  MAX_ACCURACY_M,
  type AbsenceReport,
  type StaffSignIn,
} from "@/lib/attendanceRules";
import {
  isError,
  loadSchoolSettings,
  policyOf,
  requireMember,
  schoolToday,
  type Db,
} from "@/lib/attendanceServer";

/**
 * Teachers signing in and out, and the office's view of it.
 *
 * A sign-in is only written after the teacher's phone location is checked
 * against the school's own, and only ever by the server: the table has no
 * insert or update policy, so a teacher cannot write a row for themselves
 * from the browser and skip the check. The time on the row is the server's
 * clock, not the phone's.
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const STAFF_COLUMNS = "teacher_id, work_date, signed_in_at, signed_out_at, override_status, override_note, sign_in_distance_m, sign_out_distance_m";
const REPORT_COLUMNS = "id, teacher_id, from_date, to_date, reason, note, cancelled_at, created_at";

function settingsPayload(s: Awaited<ReturnType<typeof loadSchoolSettings>>, isAdmin: boolean) {
  return {
    configured: s.location != null,
    radius_m: s.radius_m,
    start_time: s.startTime,
    grace_minutes: s.graceMinutes,
    time_zone: s.timeZone,
    weekdays: s.cal.weekdays,
    // Only the office needs the school's coordinates, to show and adjust them.
    ...(isAdmin ? { latitude: s.location?.latitude ?? null, longitude: s.location?.longitude ?? null } : {}),
  };
}

// GET                → the caller's own day and the last four weeks
// GET ?scope=school  → every teacher, for the office (&from=&to=)
export async function GET(req: NextRequest) {
  const supabase = (await createClient()) as unknown as Db;
  const me = await requireMember(supabase, ["teacher", "admin"]);
  if (isError(me)) return me.error;

  const params = new URL(req.url).searchParams;
  try {
    const settings = await loadSchoolSettings(supabase, me.school_id);
    const policy = policyOf(settings);
    const today = schoolToday(settings);

    if (params.get("scope") === "school") {
      if (me.role !== "admin") {
        return NextResponse.json({ error: "Only the office can see every teacher's attendance" }, { status: 403 });
      }
      const to = ISO_DATE.test(params.get("to") ?? "") ? params.get("to")! : today;
      const from = ISO_DATE.test(params.get("from") ?? "") ? params.get("from")! : addDays(to, -27);
      if (from > to) return NextResponse.json({ error: "The start date is after the end date" }, { status: 400 });

      const [{ data: teachers, error: tError }, { data: rows, error: rError }, { data: reports, error: pError }] =
        await Promise.all([
          supabase.from("profiles").select("id, full_name, active").eq("school_id", me.school_id).eq("role", "teacher").order("full_name"),
          supabase.from("staff_attendance").select(STAFF_COLUMNS).eq("school_id", me.school_id).gte("work_date", from).lte("work_date", to),
          supabase.from("staff_absence_reports").select(REPORT_COLUMNS).eq("school_id", me.school_id).gte("to_date", from).order("from_date"),
        ]);
      if (tError) throw tError;
      if (rError) throw rError;
      if (pError) throw pError;

      const days = daysBetweenInclusive(from, to);
      const list = (teachers ?? []).filter((t) => t.active !== false).map((t) => {
        const mine = ((rows ?? []) as Array<StaffSignIn & { teacher_id: string }>).filter((r) => r.teacher_id === t.id);
        const theirReports = ((reports ?? []) as Array<AbsenceReport & { teacher_id: string }>).filter((r) => r.teacher_id === t.id);
        const byDate = new Map(mine.map((r) => [r.work_date, r]));
        const history = days.map((d) => staffDay(d, byDate.get(d), theirReports, policy));
        return {
          id: t.id,
          name: t.full_name,
          today: staffDay(today, byDate.get(today) ?? undefined, theirReports, policy),
          days: history,
          tally: tallyStaffDays(history),
        };
      });

      const names = new Map((teachers ?? []).map((t) => [t.id, t.full_name]));
      return NextResponse.json({
        today,
        from,
        to,
        settings: settingsPayload(settings, true),
        teachers: list,
        reports: ((reports ?? []) as Array<AbsenceReport & { teacher_id: string; created_at: string }>)
          .filter((r) => !r.cancelled_at)
          .map((r) => ({ ...r, teacher_name: names.get(r.teacher_id) ?? "A teacher" })),
      });
    }

    const from = addDays(today, -27);
    const [{ data: rows, error: rError }, { data: reports, error: pError }] = await Promise.all([
      supabase.from("staff_attendance").select(STAFF_COLUMNS).eq("teacher_id", me.id).gte("work_date", from),
      supabase.from("staff_absence_reports").select(REPORT_COLUMNS).eq("teacher_id", me.id).gte("to_date", from).order("from_date"),
    ]);
    if (rError) throw rError;
    if (pError) throw pError;
    const byDate = new Map(((rows ?? []) as StaffSignIn[]).map((r) => [r.work_date, r]));
    const mineReports = (reports ?? []) as AbsenceReport[];
    const history = daysBetweenInclusive(from, today).map((d) => staffDay(d, byDate.get(d), mineReports, policy));
    const todayRow = byDate.get(today) ?? null;

    return NextResponse.json({
      today,
      settings: settingsPayload(settings, me.role === "admin"),
      day: staffDay(today, todayRow ?? undefined, mineReports, policy),
      signed_in: !!todayRow?.signed_in_at,
      signed_out: !!todayRow?.signed_out_at,
      days: history.reverse(),
      tally: tallyStaffDays(history),
      reports: mineReports.filter((r) => !r.cancelled_at),
    });
  } catch (error) {
    console.error("Staff attendance: could not load", error);
    return NextResponse.json({ error: "Could not load attendance" }, { status: 500 });
  }
}

// POST { action: "sign_in" | "sign_out", latitude, longitude, accuracy }
export async function POST(req: NextRequest) {
  const supabase = (await createClient()) as unknown as Db;
  const me = await requireMember(supabase, ["teacher", "admin"]);
  if (isError(me)) return me.error;

  try {
    const body = (await req.json().catch(() => null)) ?? {};
    const action = body.action;
    if (action !== "sign_in" && action !== "sign_out") {
      return NextResponse.json({ error: "Say whether this is signing in or signing out" }, { status: 400 });
    }
    const latitude = Number(body.latitude);
    const longitude = Number(body.longitude);
    const accuracy = Number(body.accuracy);
    if (
      !Number.isFinite(latitude) || !Number.isFinite(longitude) || !Number.isFinite(accuracy) ||
      Math.abs(latitude) > 90 || Math.abs(longitude) > 180 || accuracy < 0
    ) {
      return NextResponse.json(
        { error: "Your location didn't come through. Allow location access for this site and try again.", code: "no_location" },
        { status: 400 }
      );
    }

    const settings = await loadSchoolSettings(supabase, me.school_id);
    if (!settings.location) {
      return NextResponse.json(
        {
          error: "The school's location hasn't been set yet, so signing in can't be checked. Ask the office to set it under Staff attendance.",
          code: "not_configured",
        },
        { status: 409 }
      );
    }

    const check = checkPremises(settings.location, { latitude, longitude, accuracy });
    if (!check.ok) {
      return NextResponse.json(
        check.reason === "imprecise"
          ? {
              error: `Your phone could only place you to within ${formatDistance(check.accuracy)}, which isn't precise enough to confirm you're at school (it needs to be within ${MAX_ACCURACY_M} m). Turn on precise location, step near a window or outside, and try again.`,
              code: "imprecise",
              distance_m: check.distance,
              accuracy_m: check.accuracy,
            }
          : {
              error: `You're about ${formatDistance(check.distance)} from the school. You can only sign ${action === "sign_in" ? "in" : "out"} on the school premises.`,
              code: "too_far",
              distance_m: check.distance,
              accuracy_m: check.accuracy,
            },
        { status: 403 }
      );
    }

    // Written by the server only — see the note at the top of this file.
    const admin = createAdminClient() as unknown as Db;
    const now = new Date();
    const workDate = localClock(now, settings.timeZone).date;
    const { data: existing, error: readError } = await admin
      .from("staff_attendance")
      .select("id, signed_in_at, signed_out_at")
      .eq("teacher_id", me.id)
      .eq("work_date", workDate)
      .maybeSingle();
    if (readError) throw readError;

    if (action === "sign_in") {
      if (existing?.signed_in_at) {
        return NextResponse.json({
          ok: true,
          already: true,
          message: `You already signed in today at ${localClock(existing.signed_in_at, settings.timeZone).time}.`,
        });
      }
      const row = {
        signed_in_at: now.toISOString(),
        sign_in_distance_m: check.distance,
        sign_in_accuracy_m: check.accuracy,
      };
      const { error } = existing
        ? await admin.from("staff_attendance").update(row).eq("id", existing.id)
        : await admin.from("staff_attendance").insert({ school_id: me.school_id, teacher_id: me.id, work_date: workDate, ...row });
      // A second tap racing the first lands on the one-per-day constraint;
      // the first already signed them in.
      if (error && error.code !== "23505") throw error;
    } else {
      if (!existing?.signed_in_at) {
        return NextResponse.json({ error: "You haven't signed in today, so there's nothing to sign out of." }, { status: 409 });
      }
      const { error } = await admin
        .from("staff_attendance")
        .update({
          signed_out_at: now.toISOString(),
          sign_out_distance_m: check.distance,
          sign_out_accuracy_m: check.accuracy,
        })
        .eq("id", existing.id);
      if (error) throw error;
    }

    return NextResponse.json({ ok: true, distance_m: check.distance, at: localClock(now, settings.timeZone).time });
  } catch (error) {
    console.error("Staff attendance: could not sign in or out", error);
    return NextResponse.json({ error: "Could not record that — please try again" }, { status: 500 });
  }
}

// PATCH { teacher_id, work_date, status: present|late|absent|excused|null, note }
// The office correcting a day — a phone that couldn't get a location, a
// forgotten sign-out. null clears the correction.
export async function PATCH(req: NextRequest) {
  const supabase = (await createClient()) as unknown as Db;
  const me = await requireMember(supabase, ["admin"]);
  if (isError(me)) return me.error;

  try {
    const body = (await req.json().catch(() => null)) ?? {};
    const { teacher_id, work_date } = body;
    const status = body.status ?? null;
    const note = body.note == null ? null : String(body.note).trim().slice(0, 500) || null;
    if (!teacher_id || !ISO_DATE.test(work_date ?? "")) {
      return NextResponse.json({ error: "Which teacher and which day?" }, { status: 400 });
    }
    if (status !== null && !["present", "late", "absent", "excused"].includes(status)) {
      return NextResponse.json({ error: "Status must be present, late, absent or excused" }, { status: 400 });
    }

    // The teacher has to be one this admin's own session can see.
    const { data: teacher } = await supabase
      .from("profiles")
      .select("id, school_id, role")
      .eq("id", teacher_id)
      .maybeSingle();
    if (!teacher || teacher.school_id !== me.school_id || teacher.role !== "teacher") {
      return NextResponse.json({ error: "No such teacher at your school" }, { status: 404 });
    }

    const admin = createAdminClient() as unknown as Db;
    const { error } = await admin.from("staff_attendance").upsert(
      {
        school_id: me.school_id,
        teacher_id,
        work_date,
        override_status: status,
        override_note: status ? note : null,
        override_by: status ? me.id : null,
      },
      { onConflict: "teacher_id,work_date" }
    );
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Staff attendance: could not correct a day", error);
    return NextResponse.json({ error: "Could not save that correction" }, { status: 500 });
  }
}
