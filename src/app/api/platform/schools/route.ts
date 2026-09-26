import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

/* eslint-disable @typescript-eslint/no-explicit-any */

/** A time as an ISO string, whatever shape it arrived in. */
const iso = (v: unknown): string | null => (v === null || v === undefined || v === "" ? null : new Date(v as string).toISOString());

/** The later of two times, either of which may be missing. */
function latest(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return Date.parse(a) >= Date.parse(b) ? a : b;
}

/** Every login's last sign-in, read page by page through the auth admin API. */
async function lastSignIns(admin: ReturnType<typeof createAdminClient>): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error || !data) break;
    for (const u of data.users) {
      const at = iso(u.last_sign_in_at);
      if (at) out.set(u.id, at);
    }
    if (data.users.length < 1000) break;
  }
  return out;
}

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

  // "*" rather than a column list: schools.country is only there once
  // schema.sql has been re-run, and naming it before then would fail the
  // whole list instead of just leaving the country off.
  const { data: rows, error } = await admin
    .from("schools")
    .select("*")
    .order("created_at", { ascending: false });
  const schools = (rows ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    slug: s.slug,
    city: s.city,
    province: s.province,
    country: s.country ?? null,
    plan: s.plan,
    active: s.active,
    created_at: s.created_at,
  }));

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // When people last used MyDiiwaan: the portal's own record of each visit
  // (profiles.last_seen_at, via "*" so a database without the column yet
  // still lists its schools) and each login's last sign-in.
  const [{ data: people }, signIns] = await Promise.all([
    admin.from("profiles").select("*"),
    lastSignIns(admin),
  ]);
  const lastUse = (p: { id: string; last_seen_at?: unknown }) => latest(iso(p.last_seen_at), signIns.get(p.id) ?? null);
  const when = (x: string | null) => (x ? Date.parse(x) : 0);
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

  const enriched = await Promise.all(
    schools.map(async (school) => {
      const members = ((people ?? []) as Array<Record<string, any>>).filter((p) => p.school_id === school.id);
      const staff = members
        .filter((p) => p.role === "admin" || p.role === "teacher")
        .map((p) => ({
          name: p.full_name as string,
          role: p.role as "admin" | "teacher",
          email: (p.email as string | null) ?? null,
          active: p.active !== false,
          last_seen_at: iso(p.last_seen_at),
          last_sign_in_at: signIns.get(p.id) ?? null,
        }))
        .sort((a, b) => when(latest(b.last_seen_at, b.last_sign_in_at)) - when(latest(a.last_seen_at, a.last_sign_in_at)));
      const activity = members.map((p) => ({ role: p.role as string, at: lastUse(p as { id: string }) }));
      const lastActive = activity.reduce<string | null>((max, a) => latest(max, a.at), null);
      const thisWeek = activity.filter((a) => a.at && Date.parse(a.at) >= weekAgo);

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
        lastActive,
        activeThisWeek: {
          staff: thisWeek.filter((a) => a.role === "admin" || a.role === "teacher").length,
          parents: thisWeek.filter((a) => a.role === "parent").length,
          students: thisWeek.filter((a) => a.role === "student").length,
        },
        staff,
      };
    })
  );

  return NextResponse.json({ schools: enriched });
}
