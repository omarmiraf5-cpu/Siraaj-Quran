import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { studentLoginEmail, studentLoginPassword, isValidPin } from "@/lib/studentAuth";
import { NextRequest, NextResponse } from "next/server";

// Setting a child's PIN is really three things at once: create their auth
// account the first time, move its password to match the new PIN, and record
// the PIN so the office can read it back to whoever forgets it. All three
// need the service-role key, so all three happen here rather than client-side.
export async function POST(req: NextRequest) {
  const supabase = await createClient();

  try {
    const { student_id, pin } = await req.json();

    if (!student_id || !isValidPin(String(pin ?? ""))) {
      return NextResponse.json({ error: "A student and a 4-digit PIN are required" }, { status: 400 });
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: caller } = await supabase
      .from("profiles")
      .select("role, school_id")
      .eq("id", user.id)
      .single();
    if (!caller || caller.role !== "admin") {
      return NextResponse.json({ error: "Only an admin can set a student's PIN" }, { status: 403 });
    }

    // Read through the caller's own session, so RLS confirms this student
    // really is one of theirs before the service role touches anything.
    const { data: student } = await supabase
      .from("students")
      .select("id, full_name, profile_id, school_id")
      .eq("id", student_id)
      .single();
    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    const admin = createAdminClient();
    const email = studentLoginEmail(student.id);
    const password = studentLoginPassword(student.id, String(pin));

    let profileId = student.profile_id as string | null;

    if (profileId) {
      const { error } = await admin.auth.admin.updateUserById(profileId, { password });
      if (error) throw error;
    } else {
      const { data: created, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          role: "student",
          full_name: student.full_name,
          school_id: student.school_id,
        },
      });
      if (error) throw error;
      profileId = created.user.id;
    }

    const { error: updateError } = await supabase
      .from("students")
      .update({ pin: String(pin), profile_id: profileId })
      .eq("id", student.id);
    if (updateError) throw updateError;

    return NextResponse.json({ student_id: student.id, pin: String(pin) }, { status: 200 });
  } catch (error) {
    console.error("Error setting student PIN:", error);
    const message = error instanceof Error ? error.message : "Failed to set PIN";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
