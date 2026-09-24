import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import {
  computePlanProgress,
  todayISO,
  type Milestone,
} from "@/lib/yearlyPlan";
import {
  MILESTONES,
  PLANS,
  PLAN_STATUSES,
  UNITS,
  MAX_TEXT,
  MAX_TITLE,
  DIRECTIONS,
  badDate,
  badPosition,
  badQuantity,
  badText,
  decodeMilestone,
  decodePlan,
  isFailure,
  loadMilestonesAndEntries,
  loadPlan,
  milestoneTextColumns,
  newId,
  planTextColumns,
  refreshAlerts,
  requireCaller,
  requireEncryption,
  requireTeacher,
  resyncDailyRateMilestones,
  routeError,
  type LoadedPlan,
} from "@/lib/yearlyPlanServer";

/**
 * Yearly plans: read one in full, list the school's, create, or update.
 *
 * Plan content is encrypted at rest, so unlike the rest of the portal this
 * cannot be read straight from Supabase in the browser — the browser would
 * get ciphertext. Every read and write goes through here, where the key
 * lives. Row-level security still does the access control: these handlers
 * use the caller's own session, so a parent's GET is narrowed to their own
 * children by the policy, not by a filter written here.
 */

// GET /api/yearly-plans?student_id=…   → that student's plan, in full
// GET /api/yearly-plans?scope=school   → an index for the teacher's picker
export async function GET(req: NextRequest) {
  const blocked = requireEncryption();
  if (blocked) return blocked;

  const supabase = await createClient();
  const caller = await requireCaller(supabase);
  if (isFailure(caller)) return caller.error;

  const { searchParams } = new URL(req.url);
  const studentId = searchParams.get("student_id");
  const scope = searchParams.get("scope");
  // Picks out one specific plan among the student's years, for switching
  // away from whichever one GET would otherwise prefer. Omitted or not
  // found among this student's own rows, this falls back to that same
  // preferred choice — a stale id from a plan that was since deleted
  // degrades to the ordinary view instead of a dead end.
  const planId = searchParams.get("plan_id");
  const today = todayISO();

  try {
    if (scope === "school") {
      if (caller.role !== "teacher" && caller.role !== "admin") {
        return NextResponse.json(
          { error: "Only a teacher or admin can list the school's plans" },
          { status: 403 }
        );
      }
      const { data: rows, error } = await supabase
        .from(PLANS)
        .select("*")
        .order("academic_year", { ascending: false });
      if (error) throw error;

      // Milestones for every plan in one read rather than per plan: a
      // school with 200 plans would otherwise be 200 round trips to draw
      // one list.
      const planIds = (rows ?? []).map((r) => r.id as string);
      const byPlan = new Map<string, Milestone[]>();
      if (planIds.length > 0) {
        const { data: msRows, error: msError } = await supabase
          .from(MILESTONES)
          .select("*")
          .in("plan_id", planIds)
          .order("sequence");
        if (msError) throw msError;
        for (const row of msRows ?? []) {
          const list = byPlan.get(row.plan_id as string) ?? [];
          list.push(decodeMilestone(row));
          byPlan.set(row.plan_id as string, list);
        }
      }

      const plans = (rows ?? []).map((row) => {
        const plan = decodePlan(row);
        const milestones = byPlan.get(plan.id) ?? [];
        // The index deliberately carries no progress *entries*: the pace
        // headline only needs the milestones' own totals, and pulling every
        // plan's full history to draw a list would be the expensive part.
        const p = computePlanProgress(plan, milestones, [], today);
        return {
          id: plan.id,
          student_id: plan.student_id,
          academic_year: plan.academic_year,
          status: plan.status,
          title: plan.title,
          unit: plan.unit,
          starts_on: plan.starts_on,
          ends_on: plan.ends_on,
          milestone_count: milestones.length,
          percent_complete: Math.round(p.percentComplete),
          percent_expected: Math.round(p.percentExpected),
          pace: p.pace,
          overdue_count: p.overdueMilestones.length,
        };
      });

      return NextResponse.json({ plans });
    }

    if (!studentId) {
      return NextResponse.json(
        { error: "student_id is required (or scope=school)" },
        { status: 400 }
      );
    }

    // Newest year first, so a student carrying last year's archived plan
    // still opens on the current one.
    const { data: rows, error } = await supabase
      .from(PLANS)
      .select("*")
      .eq("student_id", studentId)
      .order("academic_year", { ascending: false });
    if (error) throw error;
    if (!rows || rows.length === 0) {
      // Also the answer when the plan exists but belongs to someone else's
      // child: RLS returned nothing, and saying "not yours" rather than
      // "none" would confirm the other family's plan exists.
      return NextResponse.json({ plan: null, milestones: [], entries: [], alerts: [] });
    }

    const preferred =
      (planId && rows.find((r) => r.id === planId)) ??
      rows.find((r) => r.status === "active") ??
      rows.find((r) => r.status === "draft") ??
      rows[0];

    // decodePlan straight off `preferred` rather than loadPlan(id), which
    // would re-select the exact row already in hand above — one fewer
    // sequential round trip on the single most common path through here.
    const loaded: LoadedPlan = {
      plan: decodePlan(preferred),
      ...(await loadMilestonesAndEntries(supabase, preferred.id as string)),
    };
    // Self-heals a plan whose dates were edited before its milestones were
    // rebuilt to match — see resyncDailyRateMilestones. A no-op on every
    // plan that is already in sync, which is almost all of them almost all
    // of the time.
    loaded.milestones = await resyncDailyRateMilestones(
      supabase,
      loaded.plan,
      preferred.school_id as string,
      loaded.milestones,
      loaded.entries
    );

    const alerts = await refreshAlerts(
      supabase,
      loaded,
      preferred.school_id as string,
      today
    );
    const progress = computePlanProgress(loaded.plan, loaded.milestones, loaded.entries, today);

    return NextResponse.json({
      ...loaded,
      alerts,
      progress,
      today,
      // So a teacher can switch between a student's years without a second
      // request; content stays encrypted until one is actually opened.
      other_years: rows
        .filter((r) => r.id !== preferred.id)
        .map((r) => ({
          id: r.id as string,
          academic_year: r.academic_year as string,
          status: r.status as string,
        })),
    });
  } catch (error) {
    return routeError("load the yearly plan", error);
  }
}

// POST /api/yearly-plans — create a plan, optionally with its milestones.
export async function POST(req: NextRequest) {
  const blocked = requireEncryption();
  if (blocked) return blocked;

  const supabase = await createClient();
  const caller = await requireTeacher(supabase);
  if (isFailure(caller)) return caller.error;

  try {
    const body = await req.json();
    const {
      student_id,
      academic_year,
      starts_on,
      ends_on,
      unit = "ayah",
      status = "active",
      title,
      notes,
      start_surah = null,
      start_ayah = null,
      direction = null,
      daily_new_amount = null,
      daily_review_amount = null,
      daily_review_unit = null,
      milestones = [],
    } = body ?? {};

    if (!student_id) {
      return NextResponse.json({ error: "student_id is required" }, { status: 400 });
    }
    if (typeof academic_year !== "string" || !academic_year.trim()) {
      return NextResponse.json({ error: "academic_year is required" }, { status: 400 });
    }
    if (!UNITS.includes(unit)) {
      return NextResponse.json(
        { error: `unit must be one of: ${UNITS.join(", ")}` },
        { status: 400 }
      );
    }
    if (!PLAN_STATUSES.includes(status)) {
      return NextResponse.json(
        { error: `status must be one of: ${PLAN_STATUSES.join(", ")}` },
        { status: 400 }
      );
    }
    const dateProblem = badDate(starts_on, "starts_on") ?? badDate(ends_on, "ends_on");
    if (dateProblem) return NextResponse.json({ error: dateProblem }, { status: 400 });
    if (starts_on >= ends_on) {
      return NextResponse.json(
        { error: "The plan's end date must come after its start date" },
        { status: 400 }
      );
    }
    const textProblem =
      badText(title, "title", MAX_TITLE) ?? badText(notes, "notes", MAX_TEXT);
    if (textProblem) return NextResponse.json({ error: textProblem }, { status: 400 });

    const anchorProblem = badPosition(start_surah, start_ayah, "The plan's starting");
    if (anchorProblem) return NextResponse.json({ error: anchorProblem }, { status: 400 });
    if (direction != null && !DIRECTIONS.includes(direction)) {
      return NextResponse.json(
        { error: `direction must be one of: ${DIRECTIONS.join(", ")}` },
        { status: 400 }
      );
    }
    // A daily rate needs a mushaf position to walk from — without one
    // there is nowhere for "1 page a day" to start counting.
    const dailyProblem =
      badQuantity(daily_new_amount, "daily_new_amount", 0.01, 1000) ??
      badQuantity(daily_review_amount, "daily_review_amount", 0.01, 1000) ??
      (daily_review_unit != null && !UNITS.includes(daily_review_unit)
        ? `daily_review_unit must be one of: ${UNITS.join(", ")}`
        : null) ??
      (daily_new_amount != null && (start_surah == null || direction == null)
        ? "A daily new-material rate needs a starting position and direction"
        : null);
    if (dailyProblem) return NextResponse.json({ error: dailyProblem }, { status: 400 });

    if (!Array.isArray(milestones)) {
      return NextResponse.json({ error: "milestones must be a list" }, { status: 400 });
    }
    if (milestones.length > 52) {
      return NextResponse.json(
        { error: "A plan can hold at most 52 milestones" },
        { status: 400 }
      );
    }

    // The student must be in the caller's own school. RLS on yearly_plans
    // would refuse the insert anyway, but it would refuse it as a policy
    // violation after the row had been built — this names the actual
    // problem, and refuses before anything is written.
    const { data: student, error: studentError } = await supabase
      .from("students")
      .select("id, school_id")
      .eq("id", student_id)
      .maybeSingle();
    if (studentError) throw studentError;
    if (!student) {
      return NextResponse.json({ error: "No such student in your school" }, { status: 404 });
    }
    if (student.school_id !== caller.school_id) {
      return NextResponse.json(
        { error: "That student belongs to a different school" },
        { status: 403 }
      );
    }

    const planId = newId();
    const { error: insertError } = await supabase.from(PLANS).insert({
      id: planId,
      student_id,
      teacher_id: caller.id,
      school_id: caller.school_id,
      academic_year: academic_year.trim(),
      starts_on,
      ends_on,
      unit,
      status,
      start_surah,
      start_ayah,
      direction,
      daily_new_amount,
      daily_review_amount,
      daily_review_unit,
      ...planTextColumns(planId, title ?? null, notes ?? null),
    });
    if (insertError) throw insertError;

    if (milestones.length > 0) {
      const rows = [];
      for (let i = 0; i < milestones.length; i++) {
        const m = milestones[i];
        const problem =
          badDate(m.starts_on, `milestone ${i + 1} starts_on`) ??
          badDate(m.due_on, `milestone ${i + 1} due_on`) ??
          badQuantity(m.target_units ?? 0, `milestone ${i + 1} target_units`) ??
          badPosition(m.from_surah ?? null, m.from_ayah ?? null, `Milestone ${i + 1} start`) ??
          badPosition(m.to_surah ?? null, m.to_ayah ?? null, `Milestone ${i + 1} end`) ??
          badText(m.title, `milestone ${i + 1} title`, MAX_TITLE) ??
          badText(m.description, `milestone ${i + 1} description`, MAX_TEXT);
        if (problem) {
          // Unwind the plan so the teacher can fix the one bad row and
          // resubmit, instead of hitting "already has a plan for that year"
          // on their second attempt.
          await supabase.from(PLANS).delete().eq("id", planId);
          return NextResponse.json({ error: problem }, { status: 400 });
        }
        if (m.due_on < m.starts_on) {
          await supabase.from(PLANS).delete().eq("id", planId);
          return NextResponse.json(
            { error: `Milestone ${i + 1} is due before it starts` },
            { status: 400 }
          );
        }
        const id = newId();
        rows.push({
          id,
          plan_id: planId,
          sequence: i + 1,
          starts_on: m.starts_on,
          due_on: m.due_on,
          target_units: m.target_units ?? 0,
          from_surah: m.from_surah ?? null,
          from_ayah: m.from_ayah ?? null,
          to_surah: m.to_surah ?? null,
          to_ayah: m.to_ayah ?? null,
          ...milestoneTextColumns(id, m.title ?? null, m.description ?? null),
        });
      }
      const { error: msError } = await supabase.from(MILESTONES).insert(rows);
      if (msError) {
        await supabase.from(PLANS).delete().eq("id", planId);
        throw msError;
      }
    }

    const loaded = await loadPlan(supabase, planId);
    return NextResponse.json({ ...loaded }, { status: 201 });
  } catch (error) {
    return routeError("create the yearly plan", error);
  }
}

// PATCH /api/yearly-plans — edit the plan itself (not its milestones).
export async function PATCH(req: NextRequest) {
  const blocked = requireEncryption();
  if (blocked) return blocked;

  const supabase = await createClient();
  const caller = await requireTeacher(supabase);
  if (isFailure(caller)) return caller.error;

  try {
    const body = await req.json();
    const {
      id,
      title,
      notes,
      status,
      starts_on,
      ends_on,
      unit,
      academic_year,
      daily_new_amount,
      daily_review_amount,
      daily_review_unit,
    } = body ?? {};
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

    const { data: existing, error: readError } = await supabase
      .from(PLANS)
      .select("id, school_id, starts_on, ends_on, start_surah, direction")
      .eq("id", id)
      .maybeSingle();
    if (readError) throw readError;
    if (!existing) return NextResponse.json({ error: "No such plan" }, { status: 404 });

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (status !== undefined) {
      if (!PLAN_STATUSES.includes(status)) {
        return NextResponse.json(
          { error: `status must be one of: ${PLAN_STATUSES.join(", ")}` },
          { status: 400 }
        );
      }
      patch.status = status;
    }
    if (unit !== undefined) {
      if (!UNITS.includes(unit)) {
        return NextResponse.json(
          { error: `unit must be one of: ${UNITS.join(", ")}` },
          { status: 400 }
        );
      }
      patch.unit = unit;
    }
    if (daily_new_amount !== undefined || daily_review_amount !== undefined || daily_review_unit !== undefined) {
      const dailyProblem =
        (daily_new_amount !== undefined
          ? badQuantity(daily_new_amount, "daily_new_amount", 0.01, 1000)
          : null) ??
        (daily_review_amount !== undefined
          ? badQuantity(daily_review_amount, "daily_review_amount", 0.01, 1000)
          : null) ??
        (daily_review_unit !== undefined && daily_review_unit != null && !UNITS.includes(daily_review_unit)
          ? `daily_review_unit must be one of: ${UNITS.join(", ")}`
          : null);
      if (dailyProblem) return NextResponse.json({ error: dailyProblem }, { status: 400 });
      if (daily_new_amount != null && existing.start_surah == null) {
        return NextResponse.json(
          { error: "A daily new-material rate needs a starting position — this plan has none" },
          { status: 400 }
        );
      }
      if (daily_new_amount !== undefined) patch.daily_new_amount = daily_new_amount;
      if (daily_review_amount !== undefined) patch.daily_review_amount = daily_review_amount;
      if (daily_review_unit !== undefined) patch.daily_review_unit = daily_review_unit;
    }
    if (academic_year !== undefined) {
      if (typeof academic_year !== "string" || !academic_year.trim()) {
        return NextResponse.json({ error: "academic_year cannot be empty" }, { status: 400 });
      }
      patch.academic_year = academic_year.trim();
    }
    if (starts_on !== undefined) {
      const problem = badDate(starts_on, "starts_on");
      if (problem) return NextResponse.json({ error: problem }, { status: 400 });
      patch.starts_on = starts_on;
    }
    if (ends_on !== undefined) {
      const problem = badDate(ends_on, "ends_on");
      if (problem) return NextResponse.json({ error: problem }, { status: 400 });
      patch.ends_on = ends_on;
    }
    // Checked against whichever side is not being changed, so moving only
    // the start date past the existing end is caught here rather than by
    // the column constraint.
    const nextStart = (patch.starts_on as string) ?? existing.starts_on;
    const nextEnd = (patch.ends_on as string) ?? existing.ends_on;
    if (nextStart >= nextEnd) {
      return NextResponse.json(
        { error: "The plan's end date must come after its start date" },
        { status: 400 }
      );
    }

    const textProblem =
      badText(title, "title", MAX_TITLE) ?? badText(notes, "notes", MAX_TEXT);
    if (textProblem) return NextResponse.json({ error: textProblem }, { status: 400 });
    Object.assign(patch, planTextColumns(id, title, notes));

    const { error: updateError } = await supabase.from(PLANS).update(patch).eq("id", id);
    if (updateError) throw updateError;

    const loaded = await loadPlan(supabase, id);
    if (!loaded) return NextResponse.json({ error: "No such plan" }, { status: 404 });
    // Catches the exact case that prompted this: starts_on/ends_on/
    // daily_new_amount just changed above, and the stored milestones are
    // whatever they were before that — stale until this rebuilds them.
    loaded.milestones = await resyncDailyRateMilestones(
      supabase,
      loaded.plan,
      existing.school_id as string,
      loaded.milestones,
      loaded.entries
    );
    const alerts = await refreshAlerts(supabase, loaded, existing.school_id as string);
    return NextResponse.json({
      ...loaded,
      alerts,
      progress: computePlanProgress(loaded.plan, loaded.milestones, loaded.entries),
    });
  } catch (error) {
    return routeError("update the yearly plan", error);
  }
}

// DELETE /api/yearly-plans?id=… — remove a plan outright: every milestone,
// progress entry and alert under it cascades with it (on delete cascade,
// in the schema). Meant for the plan that was set up wrong or for the
// wrong year, not for closing out a finished one — that is what the
// "archived" status is for, and it keeps the year's history.
export async function DELETE(req: NextRequest) {
  const blocked = requireEncryption();
  if (blocked) return blocked;

  const supabase = await createClient();
  const caller = await requireTeacher(supabase);
  if (isFailure(caller)) return caller.error;

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  try {
    // RLS already scopes this to the caller's own school, so a missing row
    // here means either it never existed or it belongs to someone else's
    // school — the same "not found" either way, for the same reason a
    // parent's GET does not distinguish the two.
    const { data: existing, error: readError } = await supabase
      .from(PLANS)
      .select("id")
      .eq("id", id)
      .maybeSingle();
    if (readError) throw readError;
    if (!existing) return NextResponse.json({ error: "No such plan" }, { status: 404 });

    const { error } = await supabase.from(PLANS).delete().eq("id", id);
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (error) {
    return routeError("delete the yearly plan", error);
  }
}
