import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isError, requireMember } from "@/lib/attendanceServer";
import { isQaidahBookId } from "@/data/qaidah";
import { MISSING_TABLE_MESSAGE, isMissingTable, readNote } from "@/lib/qaidahLessons";
import { MAX_QAIDAH_PAGE, QAIDAH_PAGE_COLUMNS, isQaidahPortion } from "@/lib/qaidahPages";

// Setting Qa'idah work by pages, for one child or several, from the Qa'idah
// tab of the Islamic & Arabic page. Reading needs no route: the portals ask
// the table, whose policies decide whose rows come back.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_STUDENTS = 200;

/** POST { student_ids, book, page_start, page_end, portion, due_date?, note? } */
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
  if (ids.length === 0 || ids.length > MAX_STUDENTS || !ids.every((id): id is string => typeof id === "string" && UUID.test(id))) {
    return NextResponse.json({ error: "Choose at least one student." }, { status: 400 });
  }
  if (!isQaidahBookId(body.book)) return NextResponse.json({ error: "Choose a Qa'idah book." }, { status: 400 });
  const start = Number(body.page_start);
  const end = Number(body.page_end ?? body.page_start);
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < start || end > MAX_QAIDAH_PAGE) {
    return NextResponse.json({ error: "Give the first page, and a last page that isn't before it." }, { status: 400 });
  }
  const portion = body.portion ?? "new";
  if (!isQaidahPortion(portion)) return NextResponse.json({ error: "Choose new lesson, recent revision or old revision." }, { status: 400 });
  const due = body.due_date ? String(body.due_date) : null;
  if (due !== null && !DATE.test(due)) return NextResponse.json({ error: "That due date isn't a date." }, { status: 400 });
  const parsed = readNote(body.note);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  try {
    const { data: found, error: studentError } = await supabase.from("students").select("id").eq("school_id", member.school_id).in("id", ids);
    if (studentError) throw studentError;
    if ((found ?? []).length !== ids.length) {
      return NextResponse.json({ error: "One of those students isn't in your school." }, { status: 404 });
    }
    const { data, error } = await supabase
      .from("qaidah_page_assignments")
      .insert(
        ids.map((studentId) => ({
          student_id: studentId,
          school_id: member.school_id,
          teacher_id: member.id,
          book: body.book,
          page_start: start,
          page_end: end,
          portion,
          due_date: due,
          note: parsed.note,
          status: "assigned",
        }))
      )
      .select(QAIDAH_PAGE_COLUMNS);
    if (error) {
      if (isMissingTable(error)) return NextResponse.json({ error: PAGES_MISSING, missing_table: true }, { status: 503 });
      throw error;
    }
    return NextResponse.json({ pages: data ?? [] }, { status: 201 });
  } catch (error) {
    console.error("Qa'idah pages: could not set", error);
    return NextResponse.json({ error: "That didn't save. Please try again." }, { status: 500 });
  }
}

const PAGES_MISSING = `${MISSING_TABLE_MESSAGE.replace("Qa'idah lessons need", "Qa'idah pages need")}`;
