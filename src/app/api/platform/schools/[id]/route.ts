import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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

  const admin = createAdminClient();

  const { data: school } = await admin
    .from("schools")
    .select("id, name")
    .eq("id", schoolId)
    .single();
  if (!school) {
    return NextResponse.json({ error: "School not found" }, { status: 404 });
  }

  // Every login this school's people have — admins, teachers, parents, and
  // any student with a real PIN account — captured before the school row
  // (and its cascade) removes the profiles pointing to them. auth.users
  // isn't reachable from a cascade off `schools`, so those accounts would
  // otherwise survive as orphans with the email permanently "taken".
  const { data: peopleProfiles, error: profilesError } = await admin
    .from("profiles")
    .select("id")
    .eq("school_id", schoolId);
  if (profilesError) {
    return NextResponse.json({ error: profilesError.message }, { status: 500 });
  }

  const { error: deleteError } = await admin.from("schools").delete().eq("id", schoolId);
  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  const accountErrors: string[] = [];
  for (const { id } of peopleProfiles ?? []) {
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) accountErrors.push(error.message);
  }

  return NextResponse.json({
    deleted: school.name,
    accountsRemoved: (peopleProfiles?.length ?? 0) - accountErrors.length,
    accountErrors,
  });
}
