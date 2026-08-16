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
      .from("quranic_assignments")
      .select("*")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({ assignments: data });
  } catch (error) {
    console.error("Error fetching assignments:", error);
    return NextResponse.json(
      { error: "Failed to fetch assignments" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();

  try {
    const body = await req.json();
    const {
      student_id,
      surah,
      ayah_start,
      ayah_end,
      portion,
      due_date,
      teacher_notes,
    } = body;

    // Validate required fields
    if (!student_id || !surah || !ayah_start || !ayah_end) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Which of the three daily portions this is. Checked here rather than
    // left to the column constraint, so a bad value comes back as a 400 the
    // form can show instead of a 500 from the database.
    const PORTIONS = ["new", "recent", "old"];
    const portionValue = portion ?? "new";
    if (!PORTIONS.includes(portionValue)) {
      return NextResponse.json(
        { error: `portion must be one of: ${PORTIONS.join(", ")}` },
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

    // Create assignment
    const { data, error } = await supabase
      .from("quranic_assignments")
      .insert({
        student_id,
        teacher_id: user.id,
        school_id: teacher.school_id,
        surah,
        ayah_start,
        ayah_end,
        portion: portionValue,
        due_date,
        teacher_notes,
        status: "assigned",
        memorization_level: 0,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error("Error creating assignment:", error);
    return NextResponse.json(
      { error: "Failed to create assignment" },
      { status: 500 }
    );
  }
}
