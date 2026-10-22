import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { studentLoginEmail, isValidPin } from "@/lib/studentAuth";
import { randomStudentPassword } from "@/lib/studentAuthServer";
import { createProvisionedUser } from "@/lib/accountProvisioning";
import { NextRequest, NextResponse } from "next/server";

// A parent sets their own child's sign-in PIN — for a child who has forgotten
// it, or to swap the one the school gave out. Only the parent_students link
// to this exact child lets it through; everything after that needs the
// service role, as when the office does the same (api/admin/student-pin).
export async function POST(req: NextRequest) {
  const { student_id, pin } = (await req.json().catch(() => ({}))) as { student_id?: unknown; pin?: unknown };
  const studentId = String(student_id ?? "");
  if (!studentId || !isValidPin(String(pin ?? ""))) {
    return NextResponse.json({ error: "A child and a 4-digit PIN are required" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  // Read with the service role, filtered to this parent's own link — not
  // through RLS, which would also show a teacher or admin their school's.
  const { data: link } = await admin
    .from("parent_students")
    .select("student_id")
    .eq("parent_id", user.id)
    .eq("student_id", studentId)
    .maybeSingle();
  if (!link) return NextResponse.json({ error: "That isn't your child" }, { status: 403 });

  const { data: student } = await admin
    .from("students")
    .select("id, full_name, profile_id, school_id, active")
    .eq("id", studentId)
    .maybeSingle();
  if (!student || student.active === false) return NextResponse.json({ error: "Student not found" }, { status: 404 });

  try {
    let profileId = student.profile_id as string | null;
    if (profileId) {
      const { error } = await admin.auth.admin.updateUserById(profileId, { password: randomStudentPassword() });
      if (error) throw error;
    } else {
      const { data: created, error } = await createProvisionedUser(admin, {
        email: studentLoginEmail(student.id),
        password: randomStudentPassword(),
        user_metadata: { role: "student", full_name: student.full_name, school_id: student.school_id },
      });
      if (error) throw error;
      profileId = created.user.id;
    }
    const { error: updateError } = await admin.from("students").update({ pin: String(pin), profile_id: profileId }).eq("id", student.id);
    if (updateError) throw updateError;
    // A new PIN starts with a clean slate of tries.
    await admin.from("student_signin_guard").delete().eq("student_id", student.id);
    return NextResponse.json({ student_id: student.id }, { status: 200 });
  } catch (error) {
    console.error("Parent setting a student PIN:", error);
    return NextResponse.json({ error: "Couldn't change the PIN. Please try again." }, { status: 500 });
  }
}
