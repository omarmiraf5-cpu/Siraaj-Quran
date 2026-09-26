import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isError, requireMember } from "@/lib/attendanceServer";
import { LIMITS } from "@/lib/classWork";
import { toSubmission } from "@/lib/classWorkServer";

/**
 * Sends a child's work back for another try: it opens again with their
 * answers still in it, and the teacher's note saying what to fix. The marks
 * are cleared, since they were for the answers being replaced.
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
  const feedback = typeof body.feedback === "string" ? body.feedback.trim() : "";
  if (feedback.length > LIMITS.feedback) {
    return NextResponse.json({ error: "Keep the note a little shorter." }, { status: 400 });
  }

  const { data: updated, error } = await supabase
    .from("subject_submissions")
    .update({
      status: "assigned",
      marks: {},
      score: null,
      graded_by: null,
      graded_at: null,
      submitted_at: null,
      feedback: feedback || null,
      updated_at: new Date().toISOString(),
    })
    .eq("assignment_id", id)
    .eq("student_id", studentId)
    .select();
  if (error) {
    console.error("Class work: could not send back", error);
    return NextResponse.json({ error: "Couldn't send it back. Please try again." }, { status: 500 });
  }
  if (!updated || updated.length === 0) {
    return NextResponse.json({ error: "This assignment wasn't set for that student." }, { status: 404 });
  }
  return NextResponse.json({ submission: toSubmission(updated[0]) });
}
