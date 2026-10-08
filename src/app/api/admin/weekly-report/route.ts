import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import type { Db } from "@/lib/attendanceServer";
import { requireAdmin } from "@/lib/adminAccounts";
import { loadSchoolWeek, upcomingWeek, weekLabel } from "@/lib/weeklyReport";
import { childLines } from "@/lib/weeklyReportEmail";

// The office's look at this coming Friday's report, before it goes: who'll
// be reported on and what their parents will read, who won't and why, and
// what went out last time. Read with the service role, as Friday's job
// reads it, for the caller's own school alone.

export async function GET() {
  const supabase = await createClient();
  const auth = await requireAdmin(supabase);
  if (auth.error) return auth.error;
  const schoolId = auth.caller.school_id as string | null;
  if (!schoolId) return NextResponse.json({ error: "Your account isn't linked to a school" }, { status: 403 });

  try {
    const admin = createAdminClient() as unknown as Db;
    const week = await loadSchoolWeek(admin, schoolId, (tz) => upcomingWeek(tz));
    const { data: sends, error: sendsError } = await admin
      .from("weekly_report_sends")
      .select("week_ending, kind")
      .eq("school_id", schoolId)
      .order("week_ending", { ascending: false })
      .limit(1000);
    const last = sendsError ? null : ((sends ?? []) as Array<{ week_ending: string; kind: string }>);
    const lastWeek = last?.[0]?.week_ending ?? null;
    return NextResponse.json({
      // Before the weekly reports update, nothing can be sent yet.
      ready: !sendsError,
      on: week.school.on,
      week: weekLabel(week.range),
      students: week.students.map((s) => ({ id: s.id, name: s.name, place: s.place, skipped: s.skipped, lines: s.skipped ? [] : childLines(s) })),
      parents: week.parents.length,
      lastSent: lastWeek
        ? {
            weekEnding: lastWeek,
            parents: last!.filter((x) => x.week_ending === lastWeek && x.kind === "parent").length,
          }
        : null,
    });
  } catch (error) {
    console.error("Weekly report preview failed", error);
    return NextResponse.json({ error: "Couldn't put this week's report together" }, { status: 500 });
  }
}
