import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireMember, isError } from "@/lib/attendanceServer";
import { removeStudent } from "@/lib/studentRemoval";

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

  const problem = await removeStudent(admin, { id: student.id as string, profile_id: (student.profile_id as string | null) ?? null });
  if (problem) return NextResponse.json({ error: problem }, { status: 500 });
  return NextResponse.json({ deleted: student.full_name });
}
