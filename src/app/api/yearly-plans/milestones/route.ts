import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { computePlanProgress } from "@/lib/yearlyPlan";
import {
  MILESTONES,
  MILESTONE_STATUSES,
  MAX_TEXT,
  MAX_TITLE,
  PLANS,
  badDate,
  badQuantity,
  badText,
  isFailure,
  loadPlan,
  milestoneTextColumns,
  newId,
  refreshAlerts,
  requireEncryption,
  requireTeacher,
  routeError,
} from "@/lib/yearlyPlanServer";

/**
 * Milestones — the segments a yearly plan is broken into. Teacher and
 * admin only; parents and students read them through GET /api/yearly-plans
 * and never write.
 *
 * Every handler returns the whole plan afterwards rather than just the row
 * it touched. Adding a milestone changes the plan's total, which changes
 * the expected curve, which can change the pace headline and raise or
 * clear an alert — returning only the new row would leave the page holding
 * four stale numbers it has no way to recompute.
 */

async function planFor(
  supabase: Awaited<ReturnType<typeof createClient>>,
  planId: string
) {
  const { data, error } = await supabase
    .from(PLANS)
    .select("id, school_id")
    .eq("id", planId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function respondWithPlan(
  supabase: Awaited<ReturnType<typeof createClient>>,
  planId: string,
  schoolId: string,
  status = 200
) {
  const loaded = await loadPlan(supabase, planId);
  if (!loaded) return NextResponse.json({ error: "No such plan" }, { status: 404 });
  const alerts = await refreshAlerts(supabase, loaded, schoolId);
  return NextResponse.json(
    {
      ...loaded,
      alerts,
      progress: computePlanProgress(loaded.plan, loaded.milestones, loaded.entries),
    },
    { status }
  );
}

// POST — append a milestone to a plan.
export async function POST(req: NextRequest) {
  const blocked = requireEncryption();
  if (blocked) return blocked;

  const supabase = await createClient();
  const caller = await requireTeacher(supabase);
  if (isFailure(caller)) return caller.error;

  try {
    const body = await req.json();
    const { plan_id, starts_on, due_on, target_units = 0, title, description } = body ?? {};
    if (!plan_id) return NextResponse.json({ error: "plan_id is required" }, { status: 400 });

    const problem =
      badDate(starts_on, "starts_on") ??
      badDate(due_on, "due_on") ??
      badQuantity(target_units, "target_units") ??
      badText(title, "title", MAX_TITLE) ??
      badText(description, "description", MAX_TEXT);
    if (problem) return NextResponse.json({ error: problem }, { status: 400 });
    if (due_on < starts_on) {
      return NextResponse.json(
        { error: "A milestone cannot be due before it starts" },
        { status: 400 }
      );
    }

    const plan = await planFor(supabase, plan_id);
    if (!plan) return NextResponse.json({ error: "No such plan" }, { status: 404 });

    // Sequence is assigned server-side from what is already stored. Letting
    // the client pick it means two teachers with the page open both send
    // "7" and the second one hits the unique constraint.
    const { data: last, error: lastError } = await supabase
      .from(MILESTONES)
      .select("sequence")
      .eq("plan_id", plan_id)
      .order("sequence", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (lastError) throw lastError;
    const sequence = ((last?.sequence as number) ?? 0) + 1;
    if (sequence > 52) {
      return NextResponse.json(
        { error: "A plan can hold at most 52 milestones" },
        { status: 400 }
      );
    }

    const id = newId();
    const { error: insertError } = await supabase.from(MILESTONES).insert({
      id,
      plan_id,
      sequence,
      starts_on,
      due_on,
      target_units,
      ...milestoneTextColumns(id, title ?? null, description ?? null),
    });
    if (insertError) throw insertError;

    return respondWithPlan(supabase, plan_id, plan.school_id as string, 201);
  } catch (error) {
    return routeError("add the milestone", error);
  }
}

// PATCH — edit one milestone's dates, target, wording or status.
export async function PATCH(req: NextRequest) {
  const blocked = requireEncryption();
  if (blocked) return blocked;

  const supabase = await createClient();
  const caller = await requireTeacher(supabase);
  if (isFailure(caller)) return caller.error;

  try {
    const body = await req.json();
    const { id, starts_on, due_on, target_units, title, description, status } = body ?? {};
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

    const { data: existing, error: readError } = await supabase
      .from(MILESTONES)
      .select("id, plan_id, starts_on, due_on, target_units, completed_units")
      .eq("id", id)
      .maybeSingle();
    if (readError) throw readError;
    if (!existing) return NextResponse.json({ error: "No such milestone" }, { status: 404 });

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (starts_on !== undefined) {
      const problem = badDate(starts_on, "starts_on");
      if (problem) return NextResponse.json({ error: problem }, { status: 400 });
      patch.starts_on = starts_on;
    }
    if (due_on !== undefined) {
      const problem = badDate(due_on, "due_on");
      if (problem) return NextResponse.json({ error: problem }, { status: 400 });
      patch.due_on = due_on;
    }
    const nextStart = (patch.starts_on as string) ?? existing.starts_on;
    const nextDue = (patch.due_on as string) ?? existing.due_on;
    if (nextDue < nextStart) {
      return NextResponse.json(
        { error: "A milestone cannot be due before it starts" },
        { status: 400 }
      );
    }

    if (target_units !== undefined) {
      const problem = badQuantity(target_units, "target_units");
      if (problem) return NextResponse.json({ error: problem }, { status: 400 });
      patch.target_units = target_units;
    }
    if (status !== undefined) {
      if (!MILESTONE_STATUSES.includes(status)) {
        return NextResponse.json(
          { error: `status must be one of: ${MILESTONE_STATUSES.join(", ")}` },
          { status: 400 }
        );
      }
      patch.status = status;
      // Kept in step with the status rather than left to the caller: a
      // milestone marked complete with no completion date reads as an open
      // one to every date-based query further down.
      patch.completed_on = status === "completed" ? new Date().toISOString().slice(0, 10) : null;
    }

    const textProblem =
      badText(title, "title", MAX_TITLE) ?? badText(description, "description", MAX_TEXT);
    if (textProblem) return NextResponse.json({ error: textProblem }, { status: 400 });
    Object.assign(patch, milestoneTextColumns(id, title, description));

    const { error: updateError } = await supabase.from(MILESTONES).update(patch).eq("id", id);
    if (updateError) throw updateError;

    const plan = await planFor(supabase, existing.plan_id as string);
    if (!plan) return NextResponse.json({ error: "No such plan" }, { status: 404 });
    return respondWithPlan(supabase, existing.plan_id as string, plan.school_id as string);
  } catch (error) {
    return routeError("update the milestone", error);
  }
}

// DELETE /api/yearly-plans/milestones?id=…
export async function DELETE(req: NextRequest) {
  const blocked = requireEncryption();
  if (blocked) return blocked;

  const supabase = await createClient();
  const caller = await requireTeacher(supabase);
  if (isFailure(caller)) return caller.error;

  try {
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

    const { data: existing, error: readError } = await supabase
      .from(MILESTONES)
      .select("id, plan_id, sequence")
      .eq("id", id)
      .maybeSingle();
    if (readError) throw readError;
    if (!existing) return NextResponse.json({ error: "No such milestone" }, { status: 404 });

    const planId = existing.plan_id as string;
    const plan = await planFor(supabase, planId);
    if (!plan) return NextResponse.json({ error: "No such plan" }, { status: 404 });

    const { error: deleteError } = await supabase.from(MILESTONES).delete().eq("id", id);
    if (deleteError) throw deleteError;

    // Close the gap the deletion left. Sequences are only an ordering, but
    // a plan that reads 1, 2, 4, 5 invites the question of what happened to
    // 3 — and the next insert would pick 6, widening the hole.
    //
    // Renumbered downwards, one row at a time, because (plan_id, sequence)
    // is unique: shifting 4 to 3 has to happen before 5 moves to 4, and a
    // single bulk update would collide partway through.
    const { data: after, error: afterError } = await supabase
      .from(MILESTONES)
      .select("id, sequence")
      .eq("plan_id", planId)
      .gt("sequence", existing.sequence as number)
      .order("sequence");
    if (afterError) throw afterError;
    for (const row of after ?? []) {
      const { error: shiftError } = await supabase
        .from(MILESTONES)
        .update({ sequence: (row.sequence as number) - 1 })
        .eq("id", row.id as string);
      if (shiftError) throw shiftError;
    }

    return respondWithPlan(supabase, planId, plan.school_id as string);
  } catch (error) {
    return routeError("delete the milestone", error);
  }
}
