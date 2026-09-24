import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { isError, requireMember, type Db } from "@/lib/attendanceServer";

/** The caller's own notices, newest first, and marking them read. RLS
 *  limits both to the caller's own rows. */

export async function GET() {
  const supabase = (await createClient()) as unknown as Db;
  const me = await requireMember(supabase);
  if (isError(me)) return me.error;

  const { data, error } = await supabase
    .from("notifications")
    .select("id, kind, title, body, student_id, created_at, read_at")
    .eq("recipient_id", me.id)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) {
    console.error("Notifications: could not load", error);
    return NextResponse.json({ error: "Could not load notices" }, { status: 500 });
  }
  return NextResponse.json({ notifications: data ?? [] });
}

// PATCH { id } — mark one read; { all: true } — mark them all read.
export async function PATCH(req: NextRequest) {
  const supabase = (await createClient()) as unknown as Db;
  const me = await requireMember(supabase);
  if (isError(me)) return me.error;

  const body = (await req.json().catch(() => null)) ?? {};
  let query = supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("recipient_id", me.id)
    .is("read_at", null);
  if (!body.all) {
    if (!body.id) return NextResponse.json({ error: "Which notice?" }, { status: 400 });
    query = query.eq("id", body.id);
  }
  const { error } = await query;
  if (error) {
    console.error("Notifications: could not mark read", error);
    return NextResponse.json({ error: "Could not update the notice" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
