import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { getSurahById } from "@/data/mushaf-index";
import { isFailure, requireTeacher, routeError } from "@/lib/yearlyPlanServer";

/**
 * A teacher attesting a student has actually been heard reciting an
 * entire surah — the gate autoAssignments.ts checks before it schedules
 * anything from the surah after it. See surah_test_confirmations in
 * schema.sql for why this exists as its own table rather than a flag
 * folded into an assignment row.
 *
 * Upserted rather than inserted outright: a teacher re-confirming after a
 * retest (or just tapping it twice) updates the one row for that surah
 * instead of failing on the unique constraint.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const caller = await requireTeacher(supabase);
  if (isFailure(caller)) return caller.error;

  try {
    const { student_id, surah, notes } = (await req.json()) ?? {};
    if (!student_id) {
      return NextResponse.json({ error: "student_id is required" }, { status: 400 });
    }
    if (typeof surah !== "number" || !Number.isInteger(surah) || !getSurahById(surah)) {
      return NextResponse.json(
        { error: "surah must be a whole number between 1 and 114" },
        { status: 400 }
      );
    }
    if (notes != null && (typeof notes !== "string" || notes.length > 2000)) {
      return NextResponse.json(
        { error: "notes must be text, 2000 characters or fewer" },
        { status: 400 }
      );
    }

    // Visibility proven the same way /api/quran-position does: a read of
    // the student through the caller's own session, narrowed to their
    // school by RLS — refused before anything is written rather than left
    // to surface as an opaque policy violation.
    const { data: student, error: studentError } = await supabase
      .from("students")
      .select("id")
      .eq("id", student_id)
      .maybeSingle();
    if (studentError) throw studentError;
    if (!student) {
      return NextResponse.json({ error: "No such student in your school" }, { status: 404 });
    }

    const { data, error } = await supabase
      .from("surah_test_confirmations")
      .upsert(
        {
          student_id,
          school_id: caller.school_id,
          surah,
          teacher_id: caller.id,
          confirmed_at: new Date().toISOString(),
          notes: notes ?? null,
        },
        { onConflict: "student_id,surah" }
      )
      .select("id, surah, confirmed_at")
      .single();
    if (error) throw error;

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    return routeError("confirm the surah", error);
  }
}
