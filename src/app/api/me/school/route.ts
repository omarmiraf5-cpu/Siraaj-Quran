import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { membershipsOf, moveTo } from "@/lib/schoolMemberships";

// A teacher at more than one school moves between them: GET lists the
// schools they can switch into (none for a teacher at one school), and
// POST { school_id } moves their login into that one. Everything they see
// afterwards is that school's (lib/schoolMemberships).

async function signedIn() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("id, role, school_id, active").eq("id", user.id).maybeSingle();
  if (!profile) return null;
  return { admin, profile };
}

export async function GET() {
  const me = await signedIn();
  if (!me) return NextResponse.json({ error: "Please sign in again" }, { status: 401 });
  const memberships = me.profile.role === "teacher" ? await membershipsOf(me.admin, me.profile.id) : [];
  const open = memberships.filter((m) => m.active || m.school_id === me.profile.school_id);
  if (open.length < 2) return NextResponse.json({ schools: [] });
  const { data: schools } = await me.admin
    .from("schools")
    .select("id, name")
    .in(
      "id",
      open.map((m) => m.school_id)
    );
  return NextResponse.json({
    schools: ((schools ?? []) as Array<{ id: string; name: string }>)
      .map((s) => ({ id: s.id, name: s.name, current: s.id === me.profile.school_id }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  });
}

export async function POST(req: NextRequest) {
  const me = await signedIn();
  if (!me) return NextResponse.json({ error: "Please sign in again" }, { status: 401 });
  const { school_id } = await req.json().catch(() => ({}));
  if (typeof school_id !== "string" || !school_id) {
    return NextResponse.json({ error: "Which school?" }, { status: 400 });
  }
  if (me.profile.role !== "teacher") {
    return NextResponse.json({ error: "Only a teacher at more than one school can switch" }, { status: 403 });
  }
  const memberships = await membershipsOf(me.admin, me.profile.id);
  const there = memberships.find((m) => m.school_id === school_id);
  if (!there) return NextResponse.json({ error: "That isn't one of your schools" }, { status: 403 });
  if (!there.active) {
    return NextResponse.json({ error: "That school has switched your account off. Please contact its office." }, { status: 403 });
  }
  if (school_id !== me.profile.school_id) await moveTo(me.admin, me.profile.id, school_id, true);
  const { data: school } = await me.admin.from("schools").select("name").eq("id", school_id).maybeSingle();
  return NextResponse.json({ ok: true, school: { id: school_id, name: school?.name ?? "" } });
}
