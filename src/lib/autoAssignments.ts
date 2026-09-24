import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { encryptField, fieldContext, isEncryptionConfigured } from "@/lib/planCrypto";
import { dailyPaceOf, formatRange, surahName } from "@/lib/mushafPlan";
import {
  creditForLesson,
  planLessons,
  type AheadLesson,
  type WrittenLesson,
} from "@/lib/planLessons";

export { statusForRating } from "@/lib/planLessons";
import {
  computePlanProgress,
  evaluateAlerts,
  todayISO,
  type PaceStatus,
  type PlanAlert,
} from "@/lib/yearlyPlan";
import {
  MILESTONES,
  PLANS,
  PROGRESS,
  decodePlan,
  isFailure,
  loadCalendarForSchool,
  loadMilestonesAndEntries,
  newId,
  requireCaller,
  resyncDailyRateMilestones,
  type LoadedPlan,
} from "@/lib/yearlyPlanServer";

/**
 * Auto-generating a student's daily "new" lesson straight from their
 * yearly plan, instead of a teacher re-typing today's surah and ayahs by
 * hand every morning — and, alongside it, gating the move into a fresh
 * surah on a teacher actually confirming the old one was heard in full.
 *
 * `quranic_assignments` predates the yearly-plan module and has no idea
 * either exists; this file is the bridge, read on every visit to the
 * assignments list rather than run on a schedule, for the same reason
 * refreshAlerts is: a few hundred students checked when someone actually
 * looks is cheaper and always current, where a nightly sweep would just
 * be a window in which the list is wrong.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
type Db = SupabaseClient<any, "public", any>;

const ASSIGNMENTS = "quranic_assignments";
const CONFIRMATIONS = "surah_test_confirmations";

export interface PendingSurahConfirmation {
  surah: number;
  surah_name: string;
}

export interface AutoAssignSummary {
  plan_id: string;
  pace: PaceStatus;
  alerts: PlanAlert[];
  /** How many new rows this call actually wrote. Almost always 0 — a
   *  teacher visiting the same day twice generates nothing the second
   *  time — and only ever more than a handful when a plan is catching up
   *  after being unopened for a while. */
  inserted: number;
  /** Set when the walk reached the end of a surah whose test has not been
   *  confirmed yet: generation stops there rather than continuing into
   *  the next surah on its own. Null the rest of the time, including
   *  whenever there is simply nothing new to generate. */
  pending_confirmation: PendingSurahConfirmation | null;
}

/**
 * Keeps a student's "new" lessons caught up with their yearly plan, and
 * reports the plan's current pace alongside so a caller can show the same
 * behind-schedule signal the Yearly Plan page does, without a second
 * fetch.
 *
 * Visibility is proven once, up front, by reading the plan through the
 * CALLER'S OWN session — RLS narrows this exactly the way /api/yearly-plans
 * already does for every role, teacher, parent or student. Only after
 * that succeeds does the rest of the work move to the admin client:
 * writing a lesson here is a system action taken on the plan's behalf,
 * not the viewing person's own, the same reasoning syncPlanAlerts already
 * rests on. One consequence worth being explicit about: a parent or
 * student opening a child's assignments triggers catch-up generation
 * exactly the way a teacher opening it does — nothing here is gated by
 * role, only by what the caller's own session can already see.
 *
 * Returns null when there is nothing to report (no active anchored plan,
 * or the caller cannot see one) — callers treat that as "no plan info",
 * not as a failure. Never throws: any unexpected error is logged and
 * swallowed, since a caller's own read of quranic_assignments should
 * proceed either way — automation failing quietly is a far smaller
 * problem than a lesson list failing to load because of it.
 */
export async function syncAutoAssignments(
  supabase: Db,
  studentId: string,
  today: string = todayISO()
): Promise<AutoAssignSummary | null> {
  const caller = await requireCaller(supabase);
  if (isFailure(caller)) return null;

  try {
    const { data: rows, error } = await supabase
      .from(PLANS)
      .select("*")
      .eq("student_id", studentId)
      .eq("status", "active")
      .order("academic_year", { ascending: false })
      .limit(1);
    if (error) throw error;
    const row = rows?.[0] as ({ id: string; school_id: string; teacher_id: string } & Record<string, unknown>) | undefined;
    if (!row) return null;

    const [rest, cal] = await Promise.all([
      loadMilestonesAndEntries(supabase, row.id),
      loadCalendarForSchool(supabase, row.school_id),
    ]);
    const loaded: LoadedPlan = { plan: decodePlan(row), ...rest };

    loaded.milestones = await resyncDailyRateMilestones(
      supabase,
      loaded.plan,
      row.school_id,
      loaded.milestones,
      loaded.entries,
      cal
    );

    const alerts = evaluateAlerts(loaded.plan, loaded.milestones, loaded.entries, today);
    const progress = computePlanProgress(loaded.plan, loaded.milestones, loaded.entries, today);
    const summary: AutoAssignSummary = {
      plan_id: loaded.plan.id,
      pace: progress.pace,
      alerts,
      inserted: 0,
      pending_confirmation: null,
    };

    const { plan } = loaded;
    if (plan.start_surah == null || plan.start_ayah == null || plan.direction == null) {
      return summary; // An unanchored plan has no position to generate from.
    }

    const dailyAmount = dailyPaceOf(plan, cal, progress.totalUnits);
    if (dailyAmount == null) return summary;

    const admin = createAdminClient() as unknown as Db;

    // Where the generator itself last left off up to today — never the most
    // recent row of any kind, which a manual correction could move out of
    // sequence. Lessons already written for later days are read separately:
    // they are still only a preview, and planLessons checks them against
    // the plan as it stands now.
    const [
      { data: lastAutoRows, error: lastAutoError },
      { data: aheadRows, error: aheadError },
      { data: confirmedRows, error: confirmedError },
    ] = await Promise.all([
      admin
        .from(ASSIGNMENTS)
        .select("surah, ayah_start, surah_end, ayah_end, due_date")
        .eq("student_id", studentId)
        .eq("portion", "new")
        .eq("source", "auto")
        .lte("due_date", today)
        .order("due_date", { ascending: false })
        .limit(1),
      admin
        .from(ASSIGNMENTS)
        .select("id, surah, ayah_start, surah_end, ayah_end, due_date, status, memorization_level, daily_rating, teacher_notes")
        .eq("student_id", studentId)
        .eq("portion", "new")
        .eq("source", "auto")
        .gt("due_date", today),
      admin.from(CONFIRMATIONS).select("surah").eq("student_id", studentId),
    ]);
    if (lastAutoError) throw lastAutoError;
    if (aheadError) throw aheadError;
    if (confirmedError) throw confirmedError;
    const ahead = (aheadRows ?? []) as AheadLesson[];

    const result = planLessons({
      start: { surah: plan.start_surah, ayah: plan.start_ayah },
      direction: plan.direction,
      unit: plan.unit,
      dailyAmount,
      startsOn: plan.starts_on,
      endsOn: plan.ends_on,
      cal,
      today,
      lastWritten: lastAutoRows?.[0] as WrittenLesson | undefined,
      ahead,
      confirmed: new Set((confirmedRows ?? []).map((r) => r.surah as number)),
    });

    if (result.discardAhead) {
      const { error: delError } = await admin
        .from(ASSIGNMENTS)
        .delete()
        .in("id", ahead.map((r) => r.id));
      if (delError) throw delError;
    }
    if (result.pendingSurah != null) {
      summary.pending_confirmation = {
        surah: result.pendingSurah,
        surah_name: surahName(result.pendingSurah),
      };
    }

    const toInsert = result.toWrite.map((day) => ({
      student_id: studentId,
      teacher_id: row.teacher_id,
      school_id: row.school_id,
      surah: day.from.surah,
      ayah_start: day.from.ayah,
      surah_end: day.to.surah,
      ayah_end: day.to.ayah,
      portion: "new",
      due_date: day.date,
      status: "assigned",
      source: "auto",
    }));

    if (toInsert.length > 0) {
      const { error: insError } = await admin.from(ASSIGNMENTS).insert(toInsert);
      if (insError) {
        // A unique-index hit means a concurrent request already generated
        // these same days — not a real failure, so it is swallowed rather
        // than surfaced, the same way syncPlanAlerts treats its own race.
        if (insError.code !== "23505") throw insError;
      } else {
        summary.inserted = toInsert.length;
      }
    }

    return summary;
  } catch (error) {
    console.error("Quranic assignments: could not auto-sync from the yearly plan", error);
    return null;
  }
}

/* ── Graded lessons count toward the plan ──────────────────────────────── */

export interface GradedLesson {
  student_id: string;
  source: string | null;
  portion: string;
  due_date: string | null;
  status: string;
  surah: number;
  ayah_start: number;
  surah_end: number | null;
  ayah_end: number;
}

/**
 * Carries a graded lesson through to the yearly plan it came from, so a
 * teacher records the work once — by rating the lesson — instead of again
 * under "Record progress". A lesson the plan wrote that becomes completed
 * adds one day's share to the milestone for its week; one that stops being
 * completed (re-rated Weak, or its rating cleared) takes that share back
 * off. Re-rating Good as Excellent changes nothing, so saving the same
 * lesson twice never counts it twice.
 *
 * Only for lessons the plan itself generated: a lesson typed in by hand
 * has no place in the plan's schedule to be counted against. Written as an
 * ordinary progress entry through the caller's own session, so it appears
 * in the plan's history and is subject to the same access rules as
 * recording progress by hand. Never throws — the rating is already saved,
 * and failing to update the plan should not undo it.
 */
export async function creditPlanForLesson(
  supabase: Db,
  teacherId: string,
  before: GradedLesson,
  after: GradedLesson,
  today: string = todayISO()
): Promise<void> {
  try {
    if (after.source !== "auto" || after.portion !== "new" || !after.due_date) return;
    const wasDone = before.status === "completed";
    const isDone = after.status === "completed";
    if (wasDone === isDone) return;
    if (!isEncryptionConfigured()) return;

    const { data: rows, error } = await supabase
      .from(PLANS)
      .select("*")
      .eq("student_id", after.student_id)
      .eq("status", "active")
      .order("academic_year", { ascending: false })
      .limit(1);
    if (error) throw error;
    const row = rows?.[0] as ({ id: string; school_id: string } & Record<string, unknown>) | undefined;
    if (!row) return;
    const plan = decodePlan(row);
    if (after.due_date < plan.starts_on || after.due_date > plan.ends_on) return;

    const [{ milestones }, cal] = await Promise.all([
      loadMilestonesAndEntries(supabase, plan.id),
      loadCalendarForSchool(supabase, row.school_id),
    ]);
    const totalUnits = milestones.reduce((s, m) => s + m.target_units, 0);
    const share = dailyPaceOf(plan, cal, totalUnits);
    if (share == null || share <= 0) return;

    const credit = creditForLesson(milestones, after.due_date, share, isDone);
    if (!credit) return;
    const { milestone, unitsAfter } = credit;

    const range = formatRange(
      { surah: after.surah, ayah: after.ayah_start },
      { surah: after.surah_end ?? after.surah, ayah: after.ayah_end }
    );
    const note = isDone
      ? `Lesson completed on the Assignments page: ${range}`
      : `Lesson no longer marked completed: ${range}`;

    const entryId = newId();
    const { error: logError } = await supabase.from(PROGRESS).insert({
      id: entryId,
      milestone_id: milestone.id,
      plan_id: plan.id,
      teacher_id: teacherId,
      recorded_on: today,
      units_after: unitsAfter,
      note_enc: encryptField(note, fieldContext(PROGRESS, entryId, "note_enc")),
    });
    if (logError) throw logError;

    const { error: updateError } = await supabase
      .from(MILESTONES)
      .update({
        completed_units: unitsAfter,
        status: credit.status,
        completed_on: credit.complete ? today : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", milestone.id);
    if (updateError) throw updateError;
  } catch (error) {
    console.error("Quranic assignments: could not count a graded lesson toward the yearly plan", error);
  }
}
