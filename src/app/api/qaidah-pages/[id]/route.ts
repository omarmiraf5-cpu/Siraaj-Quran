import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isError, requireMember } from "@/lib/attendanceServer";
import { QAIDAH_STATUSES, isMissingTable, type QaidahStatus } from "@/lib/qaidahLessons";
import { QAIDAH_PAGE_COLUMNS } from "@/lib/qaidahPages";

// One page assignment: marked passed, sent back to practise, or taken away
// when it was set by mistake.

/** PATCH { status } */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const member = await requireMember(supabase, ["teacher", "admin"]);
  if (isError(member)) return member.error;
  const body = (await req.json().catch(() => ({}))) as { status?: unknown };
  if (!QAIDAH_STATUSES.includes(body.status as QaidahStatus)) {
    return NextResponse.json({ error: `status must be one of: ${QAIDAH_STATUSES.join(", ")}` }, { status: 400 });
  }
  const status = body.status as QaidahStatus;
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("qaidah_page_assignments")
    .update({ status, passed_at: status === "passed" ? now : null, updated_at: now })
    .eq("id", id)
    .select(QAIDAH_PAGE_COLUMNS)
    .maybeSingle();
  if (error) {
    if (isMissingTable(error)) return NextResponse.json({ error: "Qa'idah pages need the latest database update." }, { status: 503 });
    console.error("Qa'idah pages: could not update", error);
    return NextResponse.json({ error: "That didn't save. Please try again." }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: "That wasn't found." }, { status: 404 });
  return NextResponse.json({ page: data });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const member = await requireMember(supabase, ["teacher", "admin"]);
  if (isError(member)) return member.error;
  const { error } = await supabase.from("qaidah_page_assignments").delete().eq("id", id);
  if (error) {
    console.error("Qa'idah pages: could not remove", error);
    return NextResponse.json({ error: "That didn't go. Please try again." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
