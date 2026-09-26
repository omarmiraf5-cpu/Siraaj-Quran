import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isError, requireMember } from "@/lib/attendanceServer";
import { autoMarks, needsTeacher, parseAnswers, totalOf } from "@/lib/classWork";
import { keyOf, toAssignment, toSubmission } from "@/lib/classWorkServer";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * A child hands in their answers. Checked here, with their own session,
 * that the work is theirs and still open; then written with the service
 * role, which is the only way a child's answers reach the database — a
 * write policy of their own would let them set their own marks too.
 *
 * Multiple-choice questions mark themselves on the spot. Work that is
 * nothing but multiple choice is marked in full straight away, so a child
 * sees how they did the moment they hand it in; anything with a written
 * answer waits for the teacher.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const me = await requireMember(supabase, ["student"]);
  if (isError(me)) return me.error;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "That request wasn't readable." }, { status: 400 });
  }

  const { data: mine } = await supabase.from("students").select("id").eq("profile_id", me.id);
  const myIds = (mine ?? []).map((s: any) => s.id);
  if (myIds.length === 0) {
    return NextResponse.json({ error: "This account isn't linked to a student." }, { status: 403 });
  }

  const { data: subs } = await supabase
    .from("subject_submissions")
    .select("*")
    .eq("assignment_id", id)
    .in("student_id", myIds);
  const sub = (subs ?? [])[0];
  if (!sub) return NextResponse.json({ error: "That assignment isn't one of yours." }, { status: 404 });
  if (sub.status !== "assigned") {
    return NextResponse.json({ error: "You've already handed this in." }, { status: 409 });
  }

  const { data: row } = await supabase.from("subject_assignments").select("*").eq("id", id).maybeSingle();
  if (!row) return NextResponse.json({ error: "That assignment isn't one of yours." }, { status: 404 });
  const assignment = toAssignment(row);

  const parsed = parseAnswers(assignment.questions, body.answers);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  if (Object.keys(parsed.value).length === 0) {
    return NextResponse.json({ error: "Answer at least one question before you hand it in." }, { status: 400 });
  }

  const admin = createAdminClient();
  const marks = autoMarks(assignment.questions, await keyOf(admin, id), parsed.value);
  const markedNow = !needsTeacher(assignment.questions);
  const now = new Date().toISOString();
  // Only while it is still open: the same check again, in the write itself,
  // so two taps on the button can't both land.
  const { data: updated, error } = await admin
    .from("subject_submissions")
    .update({
      answers: parsed.value,
      marks,
      status: markedNow ? "graded" : "submitted",
      submitted_at: now,
      updated_at: now,
      // A note from sending it back was about the answers just replaced.
      feedback: null,
      ...(markedNow ? { score: totalOf(marks), graded_at: now, graded_by: null } : { score: null, graded_at: null }),
    })
    .eq("id", sub.id)
    .eq("status", "assigned")
    .select();
  if (error) {
    console.error("Class work: could not hand in", error);
    return NextResponse.json({ error: "That didn't go through. Please try again." }, { status: 500 });
  }
  if (!updated || updated.length === 0) {
    return NextResponse.json({ error: "You've already handed this in." }, { status: 409 });
  }
  return NextResponse.json({ submission: toSubmission(updated[0]) });
}
