import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";
import { REASON_LABEL } from "@/lib/attendanceRules";
import {
  isError,
  loadSchoolSettings,
  notify,
  requireMember,
  schoolAdmins,
  schoolToday,
  shortDate,
  type Db,
} from "@/lib/attendanceServer";

/**
 * A teacher telling the office they won't be in. A school day covered by
 * a report reads as a reported absence on the register rather than a
 * no-show, and the office is notified straight away.
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const REASONS = Object.keys(REASON_LABEL);

// POST { from_date, to_date?, reason, note? }
export async function POST(req: NextRequest) {
  const supabase = (await createClient()) as unknown as Db;
  const me = await requireMember(supabase, ["teacher"]);
  if (isError(me)) return me.error;

  try {
    const body = (await req.json().catch(() => null)) ?? {};
    const from = String(body.from_date ?? "");
    const to = String(body.to_date || from);
    const reason = String(body.reason ?? "");
    const note = body.note == null ? null : String(body.note).trim().slice(0, 500) || null;
    if (!ISO_DATE.test(from) || !ISO_DATE.test(to)) {
      return NextResponse.json({ error: "Pick the day or days you'll be away" }, { status: 400 });
    }
    if (to < from) return NextResponse.json({ error: "The last day is before the first" }, { status: 400 });
    if (!REASONS.includes(reason)) return NextResponse.json({ error: "Pick a reason" }, { status: 400 });

    const settings = await loadSchoolSettings(supabase, me.school_id);
    const today = schoolToday(settings);
    // Today is fine — "I'm sick this morning" is the commonest report there
    // is. Earlier than that is a correction for the office to make.
    if (from < today) {
      return NextResponse.json(
        { error: "An absence can be reported from today onwards. For an earlier day, ask the office to correct it." },
        { status: 400 }
      );
    }
    const span = (Date.parse(to) - Date.parse(from)) / 86_400_000;
    if (span > 60) return NextResponse.json({ error: "Report at most two months at a time" }, { status: 400 });

    const admin = createAdminClient() as unknown as Db;
    const { data: row, error } = await admin
      .from("staff_absence_reports")
      .insert({ school_id: me.school_id, teacher_id: me.id, from_date: from, to_date: to, reason, note })
      .select("id")
      .single();
    if (error) throw error;

    const when = from === to ? shortDate(from) : `${shortDate(from)} – ${shortDate(to)}`;
    const admins = await schoolAdmins(admin, me.school_id);
    await notify(
      admin,
      admins.map((a) => ({
        school_id: me.school_id,
        recipient_id: a.id,
        kind: "staff_absence_report" as const,
        title: `${me.full_name} reported an absence`,
        body: `${when} · ${REASON_LABEL[reason as keyof typeof REASON_LABEL]}${note ? ` — "${note}"` : ""}`,
        dedupe_key: `staff-absence:${row.id}`,
      }))
    );
    return NextResponse.json({ ok: true, id: row.id }, { status: 201 });
  } catch (error) {
    console.error("Staff absence: could not report", error);
    return NextResponse.json({ error: "Could not send the report — please try again" }, { status: 500 });
  }
}

// DELETE ?id= — withdraw a report that hasn't started yet.
export async function DELETE(req: NextRequest) {
  const supabase = (await createClient()) as unknown as Db;
  const me = await requireMember(supabase, ["teacher"]);
  if (isError(me)) return me.error;

  try {
    const id = new URL(req.url).searchParams.get("id") ?? "";
    // Read through the teacher's own session: RLS only shows them their own.
    const { data: report } = await supabase
      .from("staff_absence_reports")
      .select("id, teacher_id, from_date, cancelled_at")
      .eq("id", id)
      .maybeSingle();
    if (!report || report.teacher_id !== me.id) {
      return NextResponse.json({ error: "No such report" }, { status: 404 });
    }
    const settings = await loadSchoolSettings(supabase, me.school_id);
    if (report.from_date < schoolToday(settings)) {
      return NextResponse.json({ error: "That absence has already started — ask the office to change it" }, { status: 409 });
    }
    const admin = createAdminClient() as unknown as Db;
    const { error } = await admin
      .from("staff_absence_reports")
      .update({ cancelled_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Staff absence: could not withdraw", error);
    return NextResponse.json({ error: "Could not withdraw the report" }, { status: 500 });
  }
}
