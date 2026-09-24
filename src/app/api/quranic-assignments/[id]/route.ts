import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { creditPlanForLesson, statusForRating, type GradedLesson } from "@/lib/autoAssignments";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  try {
    const body = await req.json();
    const {
      memorization_level,
      daily_rating,
      student_notes,
      teacher_notes,
    } = body;
    // Grading a lesson is how a teacher says it was heard, so a rating
    // settles its status too unless the caller set one explicitly: Excellent
    // to Good is completed, Weak needs another go, and clearing the rating
    // puts it back to not yet heard. Without this every graded lesson sat
    // on "To start" for good, since nothing else ever moved it.
    const status =
      body.status !== undefined
        ? body.status
        : daily_rating !== undefined
          ? statusForRating(daily_rating)
          : undefined;

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Read first, so a lesson moving into or out of "completed" can be
    // carried through to the yearly plan below.
    const { data: before, error: readError } = await supabase
      .from("quranic_assignments")
      .select("student_id, source, portion, due_date, status, surah, ayah_start, surah_end, ayah_end")
      .eq("id", id)
      .maybeSingle();
    if (readError) throw readError;
    if (!before) {
      return NextResponse.json(
        { error: "Assignment not found" },
        { status: 404 }
      );
    }

    // Update assignment
    const { data, error } = await supabase
      .from("quranic_assignments")
      .update({
        status,
        memorization_level,
        daily_rating,
        student_notes,
        teacher_notes,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    if (!data) {
      return NextResponse.json(
        { error: "Assignment not found" },
        { status: 404 }
      );
    }

    await creditPlanForLesson(supabase, user.id, before as GradedLesson, data as GradedLesson);

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error updating assignment:", error);
    return NextResponse.json(
      { error: "Failed to update assignment" },
      { status: 500 }
    );
  }
}
