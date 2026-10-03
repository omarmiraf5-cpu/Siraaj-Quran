import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isError, requireMember } from "@/lib/attendanceServer";
import { nextQaidahLesson } from "@/data/qaidah";
import {
  MISSING_TABLE_MESSAGE,
  QAIDAH_COLUMNS,
  QAIDAH_STATUSES,
  isMissingTable,
  readNote,
  type QaidahAssignment,
  type QaidahStatus,
} from "@/lib/qaidahLessons";

// One Qa'idah lesson a teacher has set: marking it passed (and, if asked,
// setting the lesson after it), sending the child back to it, changing the
// note, or taking it away when it was set by mistake.

/**
 * PATCH { status?, note?, next? }. With status "passed" and next true, the
 * book's next lesson is set as well — unless the child has already been
 * given a newer lesson than this one, or this was the book's last.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const member = await requireMember(supabase, ["teacher", "admin"]);
  if (isError(member)) return member.error;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "That request wasn't readable." }, { status: 400 });
  }
  const patch: { status?: QaidahStatus; passed_at?: string | null; note?: string | null } = {};
  if (body.status !== undefined) {
    if (!QAIDAH_STATUSES.includes(body.status as QaidahStatus)) {
      return NextResponse.json({ error: `status must be one of: ${QAIDAH_STATUSES.join(", ")}` }, { status: 400 });
    }
    patch.status = body.status as QaidahStatus;
  }
  if (body.note !== undefined) {
    const parsed = readNote(body.note);
    if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
    patch.note = parsed.note;
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nothing to change." }, { status: 400 });
  }

  try {
    const { data: before, error: readError } = await supabase
      .from("qaidah_assignments")
      .select(`${QAIDAH_COLUMNS}, school_id`)
      .eq("id", id)
      .maybeSingle();
    if (readError) {
      if (isMissingTable(readError)) {
        return NextResponse.json({ error: MISSING_TABLE_MESSAGE, missing_table: true }, { status: 503 });
      }
      throw readError;
    }
    if (!before) return NextResponse.json({ error: "That lesson wasn't found." }, { status: 404 });
    const row = before as QaidahAssignment & { school_id: string };

    if (patch.status) {
      patch.passed_at = patch.status === "passed" ? (row.passed_at ?? new Date().toISOString()) : null;
    }
    const { data: updated, error } = await supabase
      .from("qaidah_assignments")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select(QAIDAH_COLUMNS)
      .single();
    if (error) throw error;

    let next: QaidahAssignment | null = null;
    let finished = false;
    if (patch.status === "passed" && body.next === true) {
      const nextLesson = nextQaidahLesson(row.book, row.lesson);
      finished = nextLesson === null;
      // Only from the child's current lesson: passing an older one again
      // must not hand out a second, earlier "next".
      const { data: newest } = await supabase
        .from("qaidah_assignments")
        .select("id")
        .eq("student_id", row.student_id)
        .order("assigned_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (nextLesson !== null && newest?.id === id) {
        const { data: created, error: nextError } = await supabase
          .from("qaidah_assignments")
          .insert({
            student_id: row.student_id,
            school_id: row.school_id,
            teacher_id: member.id,
            book: row.book,
            lesson: nextLesson,
            status: "assigned",
          })
          .select(QAIDAH_COLUMNS)
          .single();
        if (nextError) throw nextError;
        next = created as QaidahAssignment;
      }
    }
    return NextResponse.json({ lesson: updated, next, finished });
  } catch (error) {
    console.error("Qa'idah lessons: could not update", error);
    return NextResponse.json({ error: "That didn't save. Please try again." }, { status: 500 });
  }
}

/** DELETE: a lesson set by mistake. The child's lesson before it is current again. */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const member = await requireMember(supabase, ["teacher", "admin"]);
  if (isError(member)) return member.error;

  try {
    const { data, error } = await supabase.from("qaidah_assignments").delete().eq("id", id).select("id");
    if (error) {
      if (isMissingTable(error)) {
        return NextResponse.json({ error: MISSING_TABLE_MESSAGE, missing_table: true }, { status: 503 });
      }
      throw error;
    }
    if (!data || data.length === 0) {
      return NextResponse.json({ error: "That lesson wasn't found." }, { status: 404 });
    }
    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error("Qa'idah lessons: could not remove", error);
    return NextResponse.json({ error: "That lesson couldn't be removed. Please try again." }, { status: 500 });
  }
}
