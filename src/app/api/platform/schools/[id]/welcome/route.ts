import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendSchoolWelcome } from "@/lib/schoolWelcome";
import { NextResponse } from "next/server";

// Sends a school's admin their welcome email again: for a school that
// signed up before emails to schools could go out, or whose welcome never
// arrived. Platform owner only, like the rest of /api/platform. What Resend
// said comes back in the response, so a refusal (an unverified domain,
// say) shows up on the page and not only in the server log.
export async function POST(
  _request: Request,
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
  const { data: school } = await admin.from("schools").select("id, name, slug").eq("id", schoolId).maybeSingle();
  if (!school) {
    return NextResponse.json({ error: "School not found" }, { status: 404 });
  }

  // The school's first admin: the one who signed it up.
  const { data: admins } = await admin
    .from("profiles")
    .select("full_name, email")
    .eq("school_id", schoolId)
    .eq("role", "admin")
    .order("created_at", { ascending: true })
    .limit(1);
  const schoolAdmin = admins?.[0];
  if (!schoolAdmin?.email) {
    return NextResponse.json({ error: "This school has no admin with an email address." }, { status: 400 });
  }

  const count = async (table: string, role?: string) => {
    let query = admin.from(table).select("id", { count: "exact", head: true }).eq("school_id", schoolId);
    if (role) query = query.eq("role", role);
    const { count } = await query;
    return count ?? 0;
  };
  const [halaqas, teachers, students, parents] = await Promise.all([
    count("classes"),
    count("profiles", "teacher"),
    count("students"),
    count("profiles", "parent"),
  ]);

  const result = await sendSchoolWelcome({
    name: school.name,
    slug: school.slug,
    adminName: schoolAdmin.full_name ?? "",
    adminEmail: schoolAdmin.email,
    halaqas,
    teachers,
    students,
    parents,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: 502 });
  }
  return NextResponse.json({ sentTo: schoolAdmin.email });
}
