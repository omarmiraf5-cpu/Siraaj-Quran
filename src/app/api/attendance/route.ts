import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";
import { addDays } from "@/lib/planDates";
import {
  ABSENCE_ALERT_DAYS,
  absenceRunContaining,
  type RegisterStatus,
} from "@/lib/attendanceRules";
import {
  isError,
  loadSchoolSettings,
  notify,
  requireMember,
  schoolAdmins,
  schoolToday,
  shortDate,
  type Db,
  type NewNotification,
} from "@/lib/attendanceServer";

/**
 * Saving a day's register — and, once it is saved, telling a child's
 * parents and the office when it makes ABSENCE_ALERT_DAYS school days in a
 * row that the child was marked absent.
 *
 * The register itself is written through the teacher's own session, the
 * same rows and the same "own classes" policy the page used to write
 * directly. Working out the run needs every teacher's marks for the child,
 * not just this one's, so that read — and writing notices for other
 * people — uses the service role, only for children the teacher's own
 * session has already shown it can see.
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const STATUSES: RegisterStatus[] = ["present", "late", "absent", "excused"];

// POST { date, records: { [student_id]: "present" | "late" | "absent" | "excused" } }
export async function POST(req: NextRequest) {
  const supabase = (await createClient()) as unknown as Db;
  const me = await requireMember(supabase, ["teacher", "admin"]);
  if (isError(me)) return me.error;

  try {
    const body = (await req.json().catch(() => null)) ?? {};
    const date = String(body.date ?? "");
    const records = (body.records ?? {}) as Record<string, string>;
    if (!ISO_DATE.test(date)) return NextResponse.json({ error: "Which day is this register for?" }, { status: 400 });
    const settings = await loadSchoolSettings(supabase, me.school_id);
    if (date > addDays(schoolToday(settings), 1)) {
      return NextResponse.json({ error: "A register can't be taken for a day that hasn't come yet" }, { status: 400 });
    }
    const entries = Object.entries(records);
    if (entries.some(([, s]) => !STATUSES.includes(s as RegisterStatus))) {
      return NextResponse.json({ error: "Each mark must be present, late, absent or excused" }, { status: 400 });
    }

    const ids = entries.map(([id]) => id);
    const { data: visible, error: visError } = ids.length
      ? await supabase.from("students").select("id, full_name").in("id", ids)
      : { data: [], error: null };
    if (visError) throw visError;
    const names = new Map((visible ?? []).map((s) => [s.id as string, s.full_name as string]));
    if (names.size !== ids.length) {
      return NextResponse.json({ error: "Some of those students aren't in your school" }, { status: 400 });
    }

    // Replace this teacher's marks for the day rather than upsert: class_id
    // is null on every row here, and Postgres never treats two nulls as
    // equal, so an upsert would pile up duplicates on every re-save.
    const { error: deleteError } = await supabase
      .from("attendance")
      .delete()
      .eq("teacher_id", me.id)
      .eq("class_date", date);
    if (deleteError) throw deleteError;
    if (entries.length > 0) {
      const { error: insertError } = await supabase.from("attendance").insert(
        entries.map(([student_id, status]) => ({
          student_id,
          class_date: date,
          status,
          teacher_id: me.id,
          school_id: me.school_id,
        }))
      );
      if (insertError) throw insertError;
    }

    const absent = entries.filter(([, s]) => s === "absent").map(([id]) => id);
    const alerts = absent.length ? await alertLongAbsences(me, absent, names, date) : [];
    return NextResponse.json({ ok: true, saved: entries.length, alerts });
  } catch (error) {
    console.error("Attendance: could not save the register", error);
    return NextResponse.json({ error: "Could not save the register — please try again" }, { status: 500 });
  }
}

interface LongAbsence {
  student_id: string;
  name: string;
  count: number;
  from: string;
  to: string;
  parents_notified: number;
  /** True the save that first took the run to the threshold; false on the
   *  days after, when everyone has already been told about this run. */
  newly_notified: boolean;
}

async function alertLongAbsences(
  me: { id: string; school_id: string },
  studentIds: string[],
  names: Map<string, string>,
  date: string
): Promise<LongAbsence[]> {
  const admin = createAdminClient() as unknown as Db;
  const [{ data: rows, error }, { data: links }] = await Promise.all([
    admin
      .from("attendance")
      .select("student_id, class_date, status")
      .in("student_id", studentIds)
      .eq("school_id", me.school_id),
    admin.from("parent_students").select("parent_id, student_id").in("student_id", studentIds),
  ]);
  if (error) throw error;

  const parentIds = [...new Set((links ?? []).map((l) => l.parent_id as string))];
  const { data: parents } = parentIds.length
    ? await admin.from("profiles").select("id, active, school_id").in("id", parentIds)
    : { data: [] };
  const activeParents = new Set(
    (parents ?? []).filter((p) => p.active !== false && p.school_id === me.school_id).map((p) => p.id as string)
  );
  const admins = await schoolAdmins(admin, me.school_id);

  const out: LongAbsence[] = [];
  const notices: NewNotification[] = [];
  const keyOf = (sid: string, from: string) => `absence-run:${sid}:${from}`;
  const { data: sent } = await admin
    .from("notifications")
    .select("dedupe_key")
    .eq("school_id", me.school_id)
    .in("student_id", studentIds)
    .eq("kind", "absence_streak");
  const alreadySent = new Set((sent ?? []).map((n) => n.dedupe_key as string));
  for (const sid of studentIds) {
    const run = absenceRunContaining(
      (rows ?? [])
        .filter((r) => r.student_id === sid)
        .map((r) => ({ date: r.class_date as string, status: r.status as RegisterStatus })),
      date
    );
    if (!run || run.count < ABSENCE_ALERT_DAYS) continue;

    const name = names.get(sid) ?? "A student";
    const first = name.split(" ")[0];
    const span = `from ${shortDate(run.from)} to ${shortDate(run.to)}`;
    const key = keyOf(sid, run.from);
    const parents = (links ?? [])
      .filter((l) => l.student_id === sid && activeParents.has(l.parent_id as string))
      .map((l) => l.parent_id as string);

    for (const parent of parents) {
      notices.push({
        school_id: me.school_id,
        recipient_id: parent,
        student_id: sid,
        kind: "absence_streak",
        title: `${first} has missed ${run.count} school days in a row`,
        body: `${name} was marked absent on ${run.count} school days in a row, ${span}. Please get in touch with the school to let them know what's happening.`,
        dedupe_key: key,
      });
    }
    for (const a of admins) {
      notices.push({
        school_id: me.school_id,
        recipient_id: a.id,
        student_id: sid,
        kind: "absence_streak",
        title: `${name}: absent ${run.count} school days in a row`,
        body:
          `Marked absent ${span}. ` +
          (parents.length > 0
            ? `${parents.length === 1 ? "Their parent has" : "Their parents have"} been notified in the portal.`
            : "No parent account is linked to this student, so nobody at home has been told — call the family."),
        dedupe_key: key,
      });
    }
    out.push({
      student_id: sid,
      name,
      count: run.count,
      from: run.from,
      to: run.to,
      parents_notified: parents.length,
      newly_notified: !alreadySent.has(key),
    });
  }
  await notify(admin, notices);
  return out;
}
