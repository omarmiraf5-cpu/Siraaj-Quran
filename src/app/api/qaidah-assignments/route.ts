import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isError, requireMember } from "@/lib/attendanceServer";
import { isQaidahBookId, qaidahLesson } from "@/data/qaidah";
import {
  MISSING_TABLE_MESSAGE,
  QAIDAH_COLUMNS,
  isMissingTable,
  readNote,
} from "@/lib/qaidahLessons";

// Setting a child's Qa'idah lesson, for one child or several at once, from
// the teacher's Qa'idah page. Reading them needs no route: the portals ask
// the table directly, and its policies decide whose rows come back.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_STUDENTS = 200;

/** POST { student_ids, book, lesson, note? } */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const member = await requireMember(supabase, ["teacher", "admin"]);
  if (isError(member)) return member.error;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "That request wasn't readable." }, { status: 400 });
  }

  const ids = Array.isArray(body.student_ids) ? [...new Set(body.student_ids)] : [];
  if (
    ids.length === 0 ||
    ids.length > MAX_STUDENTS ||
    !ids.every((id): id is string => typeof id === "string" && UUID.test(id))
  ) {
    return NextResponse.json({ error: "Choose at least one student." }, { status: 400 });
  }
  const book = body.book;
  if (!isQaidahBookId(book)) {
    return NextResponse.json({ error: "Choose a Qa'idah book." }, { status: 400 });
  }
  const lesson = Number(body.lesson);
  if (!Number.isInteger(lesson) || !qaidahLesson(book, lesson)) {
    return NextResponse.json({ error: "That book has no such lesson." }, { status: 400 });
  }
  const parsed = readNote(body.note);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  try {
    // Only this school's children. The table's policy holds this too;
    // asking first turns a stray id into a clear answer, not a failed insert.
    const { data: found, error: studentError } = await supabase
      .from("students")
      .select("id")
      .eq("school_id", member.school_id)
      .in("id", ids);
    if (studentError) throw studentError;
    if ((found ?? []).length !== ids.length) {
      return NextResponse.json({ error: "One of those students isn't in your school." }, { status: 404 });
    }

    const { data, error } = await supabase
      .from("qaidah_assignments")
      .insert(
        ids.map((studentId) => ({
          student_id: studentId,
          school_id: member.school_id,
          teacher_id: member.id,
          book,
          lesson,
          note: parsed.note,
          status: "assigned",
        }))
      )
      .select(QAIDAH_COLUMNS);
    if (error) {
      if (isMissingTable(error)) {
        return NextResponse.json({ error: MISSING_TABLE_MESSAGE, missing_table: true }, { status: 503 });
      }
      throw error;
    }
    return NextResponse.json({ lessons: data ?? [] }, { status: 201 });
  } catch (error) {
    console.error("Qa'idah lessons: could not set", error);
    return NextResponse.json({ error: "That lesson didn't save. Please try again." }, { status: 500 });
  }
}
