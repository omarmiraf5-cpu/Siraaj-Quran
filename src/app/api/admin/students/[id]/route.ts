import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireMember, isError } from "@/lib/attendanceServer";

/**
 * Permanently deletes a student: their record, everything recorded about
 * them (attendance, lessons, plans, messages, stars — every table keyed to a
 * student cascades), and their PIN login. For when a family leaves and asks
 * for the child's data to be removed, or a child asks from the app's
 * Account page. Deactivating, on the same screen, is the reversible option.
 */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const member = await requireMember(supabase, ["admin"]);
  if (isError(member)) return member.error;

  const admin = createAdminClient();
  const { data: student } = await admin
    .from("students")
    .select("id, school_id, profile_id, full_name")
    .eq("id", id)
    .maybeSingle();
  if (!student || student.school_id !== member.school_id) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  // The login first: if the record went first, nothing would point at the
  // login any more and it would be left behind.
  if (student.profile_id) {
    const { error } = await admin.auth.admin.deleteUser(student.profile_id as string);
    if (error && !/not found/i.test(error.message)) {
      return NextResponse.json({ error: "The student's sign-in couldn't be removed. Try again." }, { status: 500 });
    }
  }
  const { error } = await admin.from("students").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deleted: student.full_name });
}
