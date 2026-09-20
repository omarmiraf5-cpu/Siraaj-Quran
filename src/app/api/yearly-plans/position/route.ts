import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { getSurahById } from "@/data/mushaf-index";
import { isFailure, requireTeacher, routeError } from "@/lib/yearlyPlanServer";

/**
 * Where a student has actually reached in the mushaf, so a new yearly
 * plan can start from there instead of from nothing.
 *
 * Read from quranic_assignments — the daily lessons a teacher already
 * records — rather than from anything this module stores. Asking a
 * teacher to re-enter a position the app is already tracking is how the
 * two drift apart.
 *
 * The answer is the *most recent* lesson, not the furthest-progressed
 * one. "Furthest" has no meaning without knowing the direction: a hifz
 * student working backwards from An-Nas is at a lower surah number the
 * more they have memorised, so taking the maximum would reliably point at
 * the wrong end of the mushaf. Most recent is unambiguous, and the form
 * shows it for confirmation rather than acting on it silently.
 */
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  // Teacher-only: this is a planning aid, and a parent has no use for it
  // that the plan itself does not already serve.
  const caller = await requireTeacher(supabase);
  if (isFailure(caller)) return caller.error;

  const studentId = new URL(req.url).searchParams.get("student_id");
  if (!studentId) {
    return NextResponse.json({ error: "student_id is required" }, { status: 400 });
  }

  try {
    // RLS narrows this to the caller's own school; a student elsewhere
    // simply returns nothing.
    const { data: rows, error } = await supabase
      .from("quranic_assignments")
      .select("surah, ayah_start, surah_end, ayah_end, status, portion, created_at")
      .eq("student_id", studentId)
      // New lessons only. Revision portions revisit ground already
      // covered, so the most recent muraajah would drag the suggested
      // start backwards into work the student finished months ago.
      .eq("portion", "new")
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw error;

    const lessons = rows ?? [];
    if (lessons.length === 0) {
      return NextResponse.json({ position: null, source: "none", lessons: 0 });
    }

    // Prefer the newest lesson the teacher has marked done; fall back to
    // the newest of any status, since a plan set mid-lesson should still
    // start from roughly the right place.
    const done = lessons.find((l) => l.status === "completed");
    const chosen = done ?? lessons[0];

    const surah = Number(chosen.surah_end ?? chosen.surah);
    const ayah = Number(chosen.ayah_end ?? chosen.ayah_start);
    const meta = getSurahById(surah);
    if (!meta || !Number.isFinite(ayah)) {
      return NextResponse.json({ position: null, source: "unreadable", lessons: lessons.length });
    }

    return NextResponse.json({
      // The last ayah the student has worked, not the next one to do —
      // the client turns it into a starting point with nextPosition(),
      // which needs to know the direction the teacher has chosen.
      position: { surah, ayah: Math.max(1, Math.min(ayah, meta.ayahs)) },
      surah_name: meta.englishName,
      surah_name_arabic: meta.name,
      source: done ? "completed_lesson" : "latest_lesson",
      recorded_at: chosen.created_at,
      lessons: lessons.length,
    });
  } catch (error) {
    return routeError("read the student's current position", error);
  }
}
