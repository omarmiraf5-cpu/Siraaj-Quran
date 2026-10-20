import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

// Puts all of a school's campuses into one: every halaqa and student moves to
// the campus kept (the one with the most halaqas), the others are removed, and
// the one kept takes the name given. Only that school's own office may do it.
export async function POST(req: NextRequest) {
  const { name } = (await req.json().catch(() => ({}))) as { name?: unknown };
  const newName = String(name ?? "").trim().slice(0, 60);
  if (!newName) return NextResponse.json({ error: "Give the campus a name" }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: me } = await supabase.from("profiles").select("role, school_id").eq("id", user.id).maybeSingle();
  if (!me || me.role !== "admin" || !me.school_id) {
    return NextResponse.json({ error: "Only the school office can merge campuses" }, { status: 403 });
  }
  const schoolId = me.school_id as string;

  const admin = createAdminClient();
  try {
    const { data: campuses, error } = await admin.from("campuses").select("id, created_at").eq("school_id", schoolId).order("created_at");
    if (error) throw error;
    if (!campuses || campuses.length < 2) {
      return NextResponse.json({ error: "There's only one campus, so nothing to merge" }, { status: 400 });
    }

    // Keep the campus with the most halaqas (the oldest on a tie).
    const counts = await Promise.all(
      campuses.map(async (c) => {
        const { count } = await admin.from("classes").select("id", { count: "exact", head: true }).eq("school_id", schoolId).eq("campus_id", c.id);
        return { id: c.id as string, n: count ?? 0 };
      })
    );
    const keep = counts.reduce((best, c) => (c.n > best.n ? c : best), counts[0]).id;
    const others = counts.map((c) => c.id).filter((id) => id !== keep);

    const moveClasses = await admin.from("classes").update({ campus_id: keep }).eq("school_id", schoolId).in("campus_id", others);
    if (moveClasses.error) throw moveClasses.error;
    const moveStudents = await admin.from("students").update({ campus_id: keep }).eq("school_id", schoolId).in("campus_id", others);
    if (moveStudents.error) throw moveStudents.error;
    const removed = await admin.from("campuses").delete().eq("school_id", schoolId).in("id", others);
    if (removed.error) throw removed.error;
    const renamed = await admin.from("campuses").update({ name: newName }).eq("id", keep);
    if (renamed.error) throw renamed.error;

    return NextResponse.json({ campus_id: keep, merged: others.length });
  } catch (error) {
    console.error("Merging campuses:", error);
    return NextResponse.json({ error: "Couldn't merge the campuses. Nothing was lost; please try again." }, { status: 500 });
  }
}
