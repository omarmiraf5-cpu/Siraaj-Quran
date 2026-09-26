import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isError, requireMember } from "@/lib/attendanceServer";
import { LIMITS, answerFiles, parseMarks, totalOf } from "@/lib/classWork";
import { addLinks, toAssignment, toSubmission } from "@/lib/classWorkServer";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * The teacher's marks for one child's work, with a comment if they like.
 * Marking again replaces the last marks. Work done on paper can be marked
 * without being handed in through the portal first.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
  const studentId = typeof body.student_id === "string" ? body.student_id : "";
  if (!studentId) return NextResponse.json({ error: "Whose work is this?" }, { status: 400 });

  const { data: row } = await supabase.from("subject_assignments").select("*").eq("id", id).maybeSingle();
  if (!row) return NextResponse.json({ error: "That assignment isn't there any more." }, { status: 404 });
  const assignment = toAssignment(row);

  const [{ data: sub }, { data: key }] = await Promise.all([
    supabase.from("subject_submissions").select("*").eq("assignment_id", id).eq("student_id", studentId).maybeSingle(),
    supabase.from("subject_assignment_keys").select("answers").eq("assignment_id", id).maybeSingle(),
  ]);
  if (!sub) return NextResponse.json({ error: "This assignment wasn't set for that student." }, { status: 404 });

  const marks = parseMarks(assignment.questions, (key as any)?.answers ?? {}, sub.answers ?? {}, body.marks);
  if (!marks.ok) return NextResponse.json({ error: marks.error }, { status: 400 });
  const feedback = typeof body.feedback === "string" ? body.feedback.trim() : "";
  if (feedback.length > LIMITS.feedback) {
    return NextResponse.json({ error: "Keep the comment a little shorter." }, { status: 400 });
  }

  const now = new Date().toISOString();
  const { data: updated, error } = await supabase
    .from("subject_submissions")
    .update({
      marks: marks.value,
      score: totalOf(marks.value),
      feedback: feedback || null,
      status: "graded",
      graded_by: me.id,
      graded_at: now,
      updated_at: now,
    })
    .eq("id", sub.id)
    .select();
  if (error || !updated || updated.length === 0) {
    console.error("Class work: could not mark", error);
    return NextResponse.json({ error: "Couldn't save the marks. Please try again." }, { status: 500 });
  }
  const submission = toSubmission(updated[0]);
  await addLinks(createAdminClient(), answerFiles(submission.answers));
  return NextResponse.json({ submission });
}
