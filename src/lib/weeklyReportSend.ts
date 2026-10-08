import "server-only";

import type { Db } from "@/lib/attendanceServer";
import { sendEmailBatch, type OutgoingEmail } from "@/lib/email";
import { EMAIL_FROM, SUPPORT_EMAIL } from "@/lib/site";
import { loadSchoolWeek, reportWeek } from "@/lib/weeklyReport";
import { officeWeeklyEmail, parentWeeklyEmail } from "@/lib/weeklyReportEmail";

export interface SchoolSendResult {
  school: string;
  week?: string;
  reported?: number;
  parents?: number;
  office?: number;
  skipped?: string;
  error?: string;
}

/**
 * Friday's reports, every school that has them on: each parent with a child
 * reported on gets theirs, and the office its summary. Each recipient's week
 * is claimed in weekly_report_sends before their email goes — the job can
 * run more than once (a retry, more than one deployment) and the first run
 * to claim a week is the only one that sends it. A batch that fails gives
 * its claims back, for the next run to try again.
 */
export async function sendWeeklyReports(admin: Db, now: Date = new Date()): Promise<SchoolSendResult[]> {
  const { error: ledgerError } = await admin.from("weekly_report_sends").select("school_id").limit(1);
  if (ledgerError) throw new Error("Weekly reports need the weekly reports update run in Supabase first.");

  const { data: schools, error } = await admin.from("schools").select("id, name, active, weekly_reports");
  if (error) throw error;
  const results: SchoolSendResult[] = [];
  for (const school of (schools ?? []) as Array<{ id: string; name: string; active: boolean | null; weekly_reports: boolean | null }>) {
    if (school.active === false) continue;
    if (school.weekly_reports === false) {
      results.push({ school: school.name, skipped: "switched off" });
      continue;
    }
    try {
      results.push(await sendSchoolWeek(admin, school.id, now));
    } catch (e) {
      console.error(`Weekly reports: ${school.name} failed`, e);
      results.push({ school: school.name, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return results;
}

const KEY = "school_id,week_ending,recipient_id,kind";

async function sendSchoolWeek(admin: Db, schoolId: string, now: Date): Promise<SchoolSendResult> {
  const week = await loadSchoolWeek(admin, schoolId, (tz) => reportWeek(tz, now));
  const reported = week.students.filter((s) => !s.skipped).length;
  const result: SchoolSendResult = { school: week.school.name, week: week.range.to, reported, parents: 0, office: 0 };
  // Nothing learned anywhere this week (a holiday, say): nothing to send.
  if (reported === 0) return { ...result, skipped: "nothing recorded this week" };

  // Claims first; only the recipients this run claimed are sent to.
  const claim = async (kind: "parent" | "office", people: Array<{ id: string; students: number }>) => {
    if (people.length === 0) return new Set<string>();
    const { data, error } = await admin
      .from("weekly_report_sends")
      .upsert(
        people.map((p) => ({ school_id: schoolId, week_ending: week.range.to, recipient_id: p.id, kind, students: p.students })),
        { onConflict: KEY, ignoreDuplicates: true }
      )
      .select("recipient_id");
    if (error) throw error;
    return new Set(((data ?? []) as Array<{ recipient_id: string }>).map((r) => r.recipient_id));
  };
  const giveBack = async (kind: "parent" | "office", ids: string[]) => {
    if (ids.length === 0) return;
    await admin.from("weekly_report_sends").delete().eq("school_id", schoolId).eq("week_ending", week.range.to).eq("kind", kind).in("recipient_id", ids);
  };
  // Replies to a parent's report go to the school's office, when it has an address.
  const replyTo = week.office[0]?.email ?? SUPPORT_EMAIL;

  const parentsClaimed = await claim("parent", week.parents.map((p) => ({ id: p.id, students: p.children.length })));
  const toParents = week.parents.filter((p) => parentsClaimed.has(p.id));
  if (toParents.length > 0) {
    const sent = await sendEmailBatch(`Weekly reports for ${week.school.name}`, () =>
      toParents.map((p): OutgoingEmail => ({
        from: EMAIL_FROM,
        to: p.email,
        replyTo,
        ...parentWeeklyEmail({ parentName: p.name, children: p.children, schoolName: week.school.name, range: week.range }),
      }))
    );
    if (!sent.ok) {
      await giveBack("parent", toParents.map((p) => p.id));
      throw new Error(`Parents' reports didn't send: ${sent.reason}`);
    }
    result.parents = toParents.length;
  }

  const officeClaimed = await claim("office", week.office.map((a) => ({ id: a.id, students: reported })));
  const toOffice = week.office.filter((a) => officeClaimed.has(a.id));
  if (toOffice.length > 0) {
    const sent = await sendEmailBatch(`Weekly office report for ${week.school.name}`, () =>
      toOffice.map((a): OutgoingEmail => ({
        from: EMAIL_FROM,
        to: a.email,
        replyTo: SUPPORT_EMAIL,
        ...officeWeeklyEmail({ adminName: a.name, schoolName: week.school.name, range: week.range, students: week.students, parentsEmailed: week.parents.length }),
      }))
    );
    if (!sent.ok) {
      await giveBack("office", toOffice.map((a) => a.id));
      throw new Error(`The office's report didn't send: ${sent.reason}`);
    }
    result.office = toOffice.length;
  }
  return result;
}
