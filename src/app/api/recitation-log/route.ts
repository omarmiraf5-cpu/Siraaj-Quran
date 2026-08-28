import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(req.url);
  const studentId = searchParams.get("student_id");

  if (!studentId) {
    return NextResponse.json(
      { error: "student_id is required" },
      { status: 400 }
    );
  }

  try {
    const { data, error } = await supabase
      .from("recitation_log")
      .select("*")
      .eq("student_id", studentId)
      .order("session_date", { ascending: true });

    if (error) throw error;

    return NextResponse.json({ entries: data });
  } catch (error) {
    console.error("Error fetching recitation log:", error);
    return NextResponse.json(
      { error: "Failed to fetch recitation log" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();

  try {
    const body = await req.json();
    const { student_id, portion, surah, ayah_start, surah_end, ayah_end, rating, notes, session_date } = body;

    if (!student_id || !portion || !surah || !ayah_start || !ayah_end || !rating) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const PORTIONS = ["new", "recent", "old"];
    if (!PORTIONS.includes(portion)) {
      return NextResponse.json(
        { error: `portion must be one of: ${PORTIONS.join(", ")}` },
        { status: 400 }
      );
    }

    const RATINGS = ["excellent", "very_good", "good", "weak"];
    if (!RATINGS.includes(rating)) {
      return NextResponse.json(
        { error: `rating must be one of: ${RATINGS.join(", ")}` },
        { status: 400 }
      );
    }

    // Get current user (teacher)
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get teacher profile to get school_id
    const { data: teacher } = await supabase
      .from("profiles")
      .select("school_id")
      .eq("id", user.id)
      .single();

    if (!teacher) {
      return NextResponse.json(
        { error: "Teacher profile not found" },
        { status: 404 }
      );
    }

    const { data, error } = await supabase
      .from("recitation_log")
      .insert({
        student_id,
        teacher_id: user.id,
        school_id: teacher.school_id,
        portion,
        surah,
        ayah_start,
        surah_end: surah_end ?? surah,
        ayah_end,
        rating,
        notes: notes || null,
        session_date: session_date || new Date().toISOString().slice(0, 10),
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error("Error creating recitation log entry:", error);
    return NextResponse.json(
      { error: "Failed to create recitation log entry" },
      { status: 500 }
    );
  }
}
