import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { addDays } from "@/lib/planDates";
import { getSurahById } from "@/data/mushaf-index";
import {
  dailyPaceOf,
  dailySchedule,
  surahName,
  surahOrder,
  type Direction,
  type Position,
} from "@/lib/mushafPlan";
import {
  computePlanProgress,
  evaluateAlerts,
  todayISO,
  type PaceStatus,
  type PlanAlert,
} from "@/lib/yearlyPlan";
import {
  PLANS,
  decodePlan,
  isFailure,
  loadCalendarForSchool,
  loadMilestonesAndEntries,
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

    // Where the generator itself last left off — never the most recent row
    // of any kind, which a manual correction could move out of sequence.
    const [
      { data: lastAutoRows, error: lastAutoError },
      { data: confirmedRows, error: confirmedError },
    ] = await Promise.all([
      admin
        .from(ASSIGNMENTS)
        .select("surah, ayah_start, surah_end, ayah_end, due_date")
        .eq("student_id", studentId)
        .eq("portion", "new")
        .eq("source", "auto")
        .order("due_date", { ascending: false })
        .limit(1),
      admin.from(CONFIRMATIONS).select("surah").eq("student_id", studentId),
    ]);
    if (lastAutoError) throw lastAutoError;
    if (confirmedError) throw confirmedError;
    const lastAuto = lastAutoRows?.[0] as
      | { surah: number; ayah_start: number; surah_end: number; ayah_end: number; due_date: string }
      | undefined;
    const confirmed = new Set((confirmedRows ?? []).map((r) => r.surah as number));

    // Nothing new is due while the generator is already caught up, but a
    // surah the last lesson finished is still reported, so the teacher
    // is asked to confirm it straight away rather than on the morning the
    // next lesson falls due.
    // Never past the plan's own last day: a plan that has ended has nothing
    // left to assign, however long after that someone opens the list.
    const generateFrom = lastAuto ? addDays(lastAuto.due_date, 1) : plan.starts_on;
    const until = today < plan.ends_on ? today : plan.ends_on;
    const dayRows =
      generateFrom > until
        ? []
        : dailySchedule(
            { surah: plan.start_surah, ayah: plan.start_ayah },
            plan.direction,
            plan.unit,
            dailyAmount,
            plan.starts_on,
            generateFrom,
            until,
            cal
          );

    // The gate sits between days: any surah a generated lesson finished
    // has to be confirmed as tested before the *next* day's lesson is
    // written. It cannot sit inside a day — in Juz 'Amma a single page is
    // often three whole surahs (page 604 is An-Nas, Al-Falaq and
    // Al-Ikhlas), so a gate that refused any lesson crossing a surah
    // boundary would refuse the very first lesson of the plan, before the
    // student had been given anything to be tested on. Seeded from the
    // last lesson already written, so a gate raised on an earlier visit is
    // still standing on this one.
    const blocking: number[] = lastAuto
      ? surahsCompletedIn(
          { surah: lastAuto.surah, ayah: lastAuto.ayah_start },
          { surah: lastAuto.surah_end, ayah: lastAuto.ayah_end },
          plan.direction
        ).filter((s) => !confirmed.has(s))
      : [];
    const toInsert: Record<string, unknown>[] = [];

    for (const day of dayRows) {
      if (blocking.length > 0) break;
      toInsert.push({
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
      });
      for (const s of surahsCompletedIn(day.from, day.to, plan.direction)) {
        if (!confirmed.has(s)) blocking.push(s);
      }
    }
    if (blocking.length > 0) {
      summary.pending_confirmation = { surah: blocking[0], surah_name: surahName(blocking[0]) };
    }

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

/**
 * The surahs a lesson from `from` to `to` finishes, in the order it
 * finishes them: every surah it passes out of, plus the last one if the
 * lesson ends on its final ayah. A lesson that stops partway through a
 * surah has not finished it, so that surah is not asked about yet.
 */
function surahsCompletedIn(from: Position, to: Position, direction: Direction): number[] {
  const order = surahOrder(direction);
  const first = order.indexOf(from.surah);
  const last = order.indexOf(to.surah);
  if (first === -1 || last === -1 || last < first) return [];

  const out = order.slice(first, last);
  if (to.ayah >= (getSurahById(to.surah)?.ayahs ?? Infinity)) out.push(to.surah);
  return out;
}
