import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireMember, isError } from "@/lib/attendanceServer";
import { INACTIVE_YEARS, removeStudent } from "@/lib/studentRemoval";

// Records of children who left long ago: students switched off for more
// than INACTIVE_YEARS, which the office can remove in one go rather than
// keeping them for ever.

export const maxDuration = 60;

async function longInactive(schoolId: string) {
  const before = new Date();
  before.setFullYear(before.getFullYear() - INACTIVE_YEARS);
  return createAdminClient()
    .from("students")
    .select("id, full_name, profile_id, inactive_since")
    .eq("school_id", schoolId)
    .eq("active", false)
    .lt("inactive_since", before.toISOString())
    .order("full_name")
    .limit(500);
}

/** GET → { available, years, students: [{ id, name, inactive_since }] } */
export async function GET() {
  const member = await requireMember(await createClient(), ["admin"]);
  if (isError(member)) return member.error;
  const { data, error } = await longInactive(member.school_id);
  // Before update 12 there's no record of when a student left.
  if (error) return NextResponse.json({ available: false, years: INACTIVE_YEARS, students: [] });
  return NextResponse.json({
    available: true,
    years: INACTIVE_YEARS,
    students: (data ?? []).map((s) => ({ id: s.id, name: s.full_name, inactive_since: s.inactive_since })),
  });
}

/** POST { ids } → { removed, failed } — only students still in the list are removed. */
export async function POST(req: NextRequest) {
  const member = await requireMember(await createClient(), ["admin"]);
  if (isError(member)) return member.error;
  const { ids } = (await req.json().catch(() => ({}))) as { ids?: unknown };
  const wanted = new Set(Array.isArray(ids) ? ids.filter((x): x is string => typeof x === "string") : []);
  const { data, error } = await longInactive(member.school_id);
  if (error) return NextResponse.json({ error: "This needs the latest database update (mydiiwaan-update-12.sql)." }, { status: 409 });
  const admin = createAdminClient();
  let removed = 0;
  const failed: string[] = [];
  for (const s of (data ?? []).filter((x) => wanted.has(x.id as string))) {
    const problem = await removeStudent(admin, { id: s.id as string, profile_id: (s.profile_id as string | null) ?? null });
    if (problem) failed.push(s.full_name as string);
    else removed++;
  }
  return NextResponse.json({ removed, failed });
}
