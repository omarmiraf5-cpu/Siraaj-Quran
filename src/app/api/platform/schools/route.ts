import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

// Cross-tenant by design: every other query in this app is scoped to the
// caller's own school_id, but this one lists every school there is. That
// only belongs to the platform operator, never a school's own admin — so
// the gate checks is_platform_admin specifically, not role = 'admin'.
export async function GET() {
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

  const { data: schools, error } = await admin
    .from("schools")
    .select("id, name, slug, city, province, plan, active, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const enriched = await Promise.all(
    (schools ?? []).map(async (school) => {
      const [{ count: studentCount }, { count: teacherCount }, { data: admins }] = await Promise.all([
        admin.from("students").select("id", { count: "exact", head: true }).eq("school_id", school.id),
        admin
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("school_id", school.id)
          .eq("role", "teacher"),
        admin
          .from("profiles")
          .select("full_name, email")
          .eq("school_id", school.id)
          .eq("role", "admin")
          .limit(1),
      ]);

      return {
        ...school,
        studentCount: studentCount ?? 0,
        teacherCount: teacherCount ?? 0,
        adminContact: admins?.[0] ?? null,
      };
    })
  );

  return NextResponse.json({ schools: enriched });
}
