import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isError, requireMember } from "@/lib/attendanceServer";
import { LIMITS } from "@/lib/classWork";
import { toAssignment, toSubmission } from "@/lib/classWorkServer";

/* eslint-disable @typescript-eslint/no-explicit-any */

type Params = { params: Promise<{ id: string }> };

/** One piece of work as its teacher marks it: the questions, the right
 *  answers, and every child's copy. */
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const me = await requireMember(supabase, ["teacher", "admin"]);
  if (isError(me)) return me.error;

  const { data: row } = await supabase.from("subject_assignments").select("*").eq("id", id).maybeSingle();
  if (!row) return NextResponse.json({ error: "That assignment isn't there any more." }, { status: 404 });

  const [{ data: key }, { data: subs }] = await Promise.all([
    supabase.from("subject_assignment_keys").select("answers").eq("assignment_id", id).maybeSingle(),
    supabase.from("subject_submissions").select("*").eq("assignment_id", id),
  ]);
  const studentIds = (subs ?? []).map((s: any) => s.student_id);
  const { data: students } = studentIds.length
    ? await supabase.from("students").select("id, full_name").in("id", studentIds)
    : { data: [] as any[] };
  const nameOf = new Map((students ?? []).map((s: any) => [s.id, s.full_name]));

  return NextResponse.json({
    assignment: toAssignment(row),
    key: (key as any)?.answers ?? {},
    submissions: (subs ?? [])
      .map((s: any) => ({ ...toSubmission(s), student_name: nameOf.get(s.student_id) ?? "Student" }))
      .sort((a: any, b: any) => a.student_name.localeCompare(b.student_name)),
  });
}

/** A change to the title, the instructions or the due date. The questions
 *  stay as they were set, since children may already have answered them. */
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const me = await requireMember(supabase, ["teacher", "admin"]);
  if (isError(me)) return me.error;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "That request wasn't readable." }, { status: 400 });
  }
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.title !== undefined) {
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title || title.length > LIMITS.title) {
      return NextResponse.json({ error: "Give the assignment a title." }, { status: 400 });
    }
    patch.title = title;
  }
  if (body.instructions !== undefined) {
    const instructions = typeof body.instructions === "string" ? body.instructions.trim() : "";
    if (instructions.length > LIMITS.instructions) {
      return NextResponse.json({ error: "Those instructions are too long." }, { status: 400 });
    }
    patch.instructions = instructions;
  }
  if (body.due_date !== undefined) {
    const due = body.due_date === null || body.due_date === "" ? null : body.due_date;
    if (due !== null && (typeof due !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(due) || Number.isNaN(Date.parse(due)))) {
      return NextResponse.json({ error: "That due date isn't a real date." }, { status: 400 });
    }
    patch.due_date = due;
  }

  const { data, error } = await supabase.from("subject_assignments").update(patch).eq("id", id).select();
  if (error) {
    console.error("Class work: could not update", error);
    return NextResponse.json({ error: "Couldn't save that. Please try again." }, { status: 500 });
  }
  if (!data || data.length === 0) {
    return NextResponse.json({ error: "That assignment isn't there any more." }, { status: 404 });
  }
  return NextResponse.json({ assignment: toAssignment(data[0]) });
}

/** Takes the work back from everyone it was set for, answers and marks included. */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const me = await requireMember(supabase, ["teacher", "admin"]);
  if (isError(me)) return me.error;

  const { data, error } = await supabase.from("subject_assignments").delete().eq("id", id).select("id");
  if (error) {
    console.error("Class work: could not delete", error);
    return NextResponse.json({ error: "Couldn't delete it. Please try again." }, { status: 500 });
  }
  if (!data || data.length === 0) {
    return NextResponse.json({ error: "That assignment isn't there any more." }, { status: 404 });
  }
  return NextResponse.json({ deleted: id });
}
