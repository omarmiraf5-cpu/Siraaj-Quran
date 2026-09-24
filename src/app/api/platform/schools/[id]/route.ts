import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { deleteSchoolAndAccounts } from "@/lib/accountDeletion";
import { NextResponse } from "next/server";

// Deleting a school this way, rather than leaving it to whoever runs the
// database: `schools` itself has no RLS delete policy for anyone (even a
// real school's own admin can't drop their own school), so this is the one
// path that can do it, and only for the platform operator.
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: schoolId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: caller } = await supabase
    .from("profiles")
    .select("is_platform_admin")
    .eq("id", user.id)
    .single();
  if (!caller?.is_platform_admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = await deleteSchoolAndAccounts(createAdminClient(), schoolId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({
    deleted: result.deleted,
    accountsRemoved: result.accountsRemoved,
    accountErrors: result.accountErrors,
  });
}
