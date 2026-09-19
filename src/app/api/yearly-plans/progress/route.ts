import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { encryptField, fieldContext } from "@/lib/planCrypto";
import { computePlanProgress, todayISO } from "@/lib/yearlyPlan";
import {
  MILESTONES,
  MAX_TEXT,
  PLANS,
  PROGRESS,
  badDate,
  badInt,
  badText,
  isFailure,
  loadPlan,
  newId,
  refreshAlerts,
  requireEncryption,
  requireTeacher,
  routeError,
} from "@/lib/yearlyPlanServer";

/**
 * Recording progress against a milestone — the teacher's day-to-day action
 * in this module, and the one that drives every number the parent sees.
 *
 * A single POST does three things: writes an immutable log entry, moves
 * the milestone's live figure, and re-runs the alert sweep. They are
 * ordered so a failure part-way leaves the least confusing state (see the
 * comment on the milestone update below).
 */

export async function POST(req: NextRequest) {
  const blocked = requireEncryption();
  if (blocked) return blocked;

  const supabase = await createClient();
  const caller = await requireTeacher(supabase);
  if (isFailure(caller)) return caller.error;

  try {
    const body = await req.json();
    const { milestone_id, units_after, note, recorded_on, complete } = body ?? {};

    if (!milestone_id) {
      return NextResponse.json({ error: "milestone_id is required" }, { status: 400 });
    }
    const unitProblem = badInt(units_after, "units_after");
    if (unitProblem) return NextResponse.json({ error: unitProblem }, { status: 400 });
    if (units_after == null) {
      return NextResponse.json({ error: "units_after is required" }, { status: 400 });
    }
    const noteProblem = badText(note, "note", MAX_TEXT);
    if (noteProblem) return NextResponse.json({ error: noteProblem }, { status: 400 });

    const when = recorded_on ?? todayISO();
    const dateProblem = badDate(when, "recorded_on");
    if (dateProblem) return NextResponse.json({ error: dateProblem }, { status: 400 });

    const { data: milestone, error: msError } = await supabase
      .from(MILESTONES)
      .select("id, plan_id, target_units, status")
      .eq("id", milestone_id)
      .maybeSingle();
    if (msError) throw msError;
    if (!milestone) {
      return NextResponse.json({ error: "No such milestone" }, { status: 404 });
    }

    const planId = milestone.plan_id as string;
    const { data: plan, error: planError } = await supabase
      .from(PLANS)
      .select("id, school_id, status")
      .eq("id", planId)
      .maybeSingle();
    if (planError) throw planError;
    if (!plan) return NextResponse.json({ error: "No such plan" }, { status: 404 });
    if (plan.status === "archived") {
      return NextResponse.json(
        { error: "This plan is archived — reopen it before recording progress" },
        { status: 400 }
      );
    }

    // The log entry goes in first. If the milestone update below fails, a
    // recorded session that didn't move the counter is recoverable and
    // visible; the reverse — a counter that moved with nothing explaining
    // it — is the version nobody can reconstruct.
    const entryId = newId();
    const { error: logError } = await supabase.from(PROGRESS).insert({
      id: entryId,
      milestone_id,
      plan_id: planId,
      teacher_id: caller.id,
      recorded_on: when,
      units_after,
      note_enc: encryptField(note ?? null, fieldContext(PROGRESS, entryId, "note_enc")),
    });
    if (logError) throw logError;

    const target = (milestone.target_units as number) ?? 0;
    // Completion is inferred from the numbers unless the teacher says
    // otherwise: hitting the target is the ordinary way a milestone
    // finishes, and making them tick a box as well would leave plans full
    // of milestones at 40/40 still reading "pending" — which the overdue
    // alert would then keep firing on.
    const reachedTarget = target > 0 && units_after >= target;
    const isComplete = complete === undefined ? reachedTarget : Boolean(complete);
    const nextStatus = isComplete ? "completed" : units_after > 0 ? "in_progress" : "pending";

    const { error: updateError } = await supabase
      .from(MILESTONES)
      .update({
        completed_units: units_after,
        status: nextStatus,
        completed_on: isComplete ? when : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", milestone_id);
    if (updateError) throw updateError;

    const loaded = await loadPlan(supabase, planId);
    if (!loaded) return NextResponse.json({ error: "No such plan" }, { status: 404 });
    const alerts = await refreshAlerts(supabase, loaded, plan.school_id as string);

    return NextResponse.json(
      {
        ...loaded,
        alerts,
        progress: computePlanProgress(loaded.plan, loaded.milestones, loaded.entries),
      },
      { status: 201 }
    );
  } catch (error) {
    return routeError("record the progress", error);
  }
}
