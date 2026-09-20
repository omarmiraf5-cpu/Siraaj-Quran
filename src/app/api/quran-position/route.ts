import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { getSurahById } from "@/data/mushaf-index";
import { createAdminClient } from "@/lib/supabase/admin";
import { DIRECTIONS, isFailure, requireTeacher, routeError } from "@/lib/yearlyPlanServer";

/**
 * Where a student has reached in the mushaf, and which way they work
 * through it — shared by the daily assignment form and the yearly plan.
 *
 * Both need the same two facts, and having each work them out separately
 * is how they end up disagreeing: a plan generating backwards from An-Nas
 * while the daily lessons run forwards from Al-Baqarah, with nothing on
 * screen explaining why.
 *
 * The position is read from quranic_assignments — the lessons a teacher
 * already records — rather than from anything either feature stores. The
 * direction is read from the student, because it is a fact about the
 * child rather than about one lesson or one year.
 */

/** The most recent lesson is the answer, not the furthest-progressed one.
 *  "Furthest" has no meaning without the direction: a student working
 *  An-Nas and up sits at a *lower* surah number the more they know, so
 *  taking the maximum points reliably at the wrong end of the mushaf. */
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const caller = await requireTeacher(supabase);
  if (isFailure(caller)) return caller.error;

  const studentId = new URL(req.url).searchParams.get("student_id");
  if (!studentId) {
    return NextResponse.json({ error: "student_id is required" }, { status: 400 });
  }

  try {
    // RLS narrows both of these to the caller's own school.
    const [{ data: student, error: studentError }, { data: rows, error }] = await Promise.all([
      supabase.from("students").select("id, hifz_direction").eq("id", studentId).maybeSingle(),
      supabase
        .from("quranic_assignments")
        .select("surah, ayah_start, surah_end, ayah_end, status, portion, created_at")
        .eq("student_id", studentId)
        // New lessons only. A revision portion revisits ground covered
        // months ago, so the most recent muraajah would drag the
        // suggested position backwards into finished work.
        .eq("portion", "new")
        .order("created_at", { ascending: false })
        .limit(20),
    ]);
    if (studentError) throw studentError;
    if (error) throw error;
    if (!student) {
      return NextResponse.json({ error: "No such student in your school" }, { status: 404 });
    }

    const direction = (student.hifz_direction as "forward" | "hifz" | null) ?? null;
    const lessons = rows ?? [];
    if (lessons.length === 0) {
      return NextResponse.json({ position: null, direction, source: "none", lessons: 0 });
    }

    // Prefer the newest lesson marked done; fall back to the newest of
    // any status, so a position set mid-lesson is still roughly right.
    const done = lessons.find((l) => l.status === "completed");
    const chosen = done ?? lessons[0];

    const surah = Number(chosen.surah_end ?? chosen.surah);
    const ayah = Number(chosen.ayah_end ?? chosen.ayah_start);
    const meta = getSurahById(surah);
    if (!meta || !Number.isFinite(ayah)) {
      return NextResponse.json({
        position: null,
        direction,
        source: "unreadable",
        lessons: lessons.length,
      });
    }

    return NextResponse.json({
      // The last ayah worked, not the next one to do: turning it into a
      // starting point needs the direction, and the caller may be about
      // to change that.
      position: { surah, ayah: Math.max(1, Math.min(ayah, meta.ayahs)) },
      surah_name: meta.englishName,
      surah_name_arabic: meta.name,
      direction,
      source: done ? "completed_lesson" : "latest_lesson",
      recorded_at: chosen.created_at,
      lessons: lessons.length,
    });
  } catch (error) {
    return routeError("read the student's position", error);
  }
}

/** Sets which way the student works through the mushaf. */
export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const caller = await requireTeacher(supabase);
  if (isFailure(caller)) return caller.error;

  try {
    const { student_id, direction } = (await req.json()) ?? {};
    if (!student_id) {
      return NextResponse.json({ error: "student_id is required" }, { status: 400 });
    }
    if (direction !== null && !DIRECTIONS.includes(direction)) {
      return NextResponse.json(
        { error: `direction must be null or one of: ${DIRECTIONS.join(", ")}` },
        { status: 400 }
      );
    }

    // Access is proven by reading the student through the caller's own
    // session: the "Admins and teachers can read students in their
    // school" policy is what decides whether this row is visible, so a
    // teacher at another school sees nothing and gets a 404.
    const { data: visible, error: readError } = await supabase
      .from("students")
      .select("id")
      .eq("id", student_id)
      .maybeSingle();
    if (readError) throw readError;
    if (!visible) {
      return NextResponse.json({ error: "No such student in your school" }, { status: 404 });
    }

    // The write itself goes through the service role, because only admins
    // may update the students table and this has to work for the teacher
    // who actually sets the lessons. Widening that policy to teachers is
    // not the alternative it looks like: a policy grants a whole row, so
    // it would also let a teacher rewrite a child's name, grade or
    // school. Postgres has no column-level grant inside a policy, so the
    // narrowing lives here — this route writes hifz_direction and
    // nothing else, against an id the caller has just proven they can
    // see. Same division as /api/admin/accounts.
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("students")
      .update({ hifz_direction: direction })
      .eq("id", student_id)
      .select("id, hifz_direction");
    if (error) throw error;
    if (!data || data.length === 0) {
      return NextResponse.json({ error: "No such student in your school" }, { status: 404 });
    }

    return NextResponse.json({ id: data[0].id, direction: data[0].hifz_direction });
  } catch (error) {
    return routeError("set the student's direction", error);
  }
}
