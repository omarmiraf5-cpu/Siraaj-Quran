import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isError, requireMember, type Db, type Member } from "@/lib/attendanceServer";
import { FILE_BUCKET } from "@/lib/classWork";
import { namesOf } from "@/lib/classWorkServer";
import { isQaidahBookId, lessonTiles, qaidahLesson, type QaidahBookId } from "@/data/qaidah";
import {
  RECORDING_MAX_BYTES,
  RECORDING_MAX_SECONDS,
  needsRecordingsUpdate,
  recordingExtension,
  recordingPlayLink,
  recordingType,
  recordingsFolder,
  type QaidahRecording,
} from "@/lib/qaidahRecordings";

/* eslint-disable @typescript-eslint/no-explicit-any */

// A teacher's recordings of Qa'idah lessons, for the school's children to
// play at home: a lesson read through, or its tiles (letters, syllables,
// words) one by one. `item` is the tile, as the book prints it; without one,
// the request is about the whole lesson.
//
//   GET    ?book=                             everyone at the school: the
//                                             recordings, with links to play
//                                             (play/route.ts)
//   POST   { book, lesson, item?, type,       a teacher or the office: a
//            size }                           one-time link to upload one
//   PUT    { book, lesson, item?, path,       ...then save it as the lesson's
//            type, duration_s }               (or tile's) recording,
//                                             replacing any before
//   DELETE { book, lesson, item? }            ...or take it away

const COLUMNS = "book, lesson, item, path, mime_type, duration_s, teacher_id, created_at";
const MISSING =
  "Lesson recordings need the latest database update. The school's administrator can run it in Supabase.";
/** How many rows Supabase hands back at a time. */
const PAGE = 1000;

interface Which {
  book: QaidahBookId;
  lesson: number;
  /** The tile; "" for the whole lesson. */
  item: string;
}

/** Which lesson, and which of its tiles if any, from a request; or an error to answer with. */
function readWhich(book: unknown, lesson: unknown, item: unknown): Which | { error: NextResponse } {
  if (!isQaidahBookId(book)) {
    return { error: NextResponse.json({ error: "Choose a Qa'idah book." }, { status: 400 }) };
  }
  const n = Number(lesson);
  const found = Number.isInteger(n) ? qaidahLesson(book, n) : undefined;
  if (!found) {
    return { error: NextResponse.json({ error: "That book has no such lesson." }, { status: 400 }) };
  }
  const tile = item ?? "";
  if (typeof tile !== "string" || (tile !== "" && !lessonTiles(found).includes(tile))) {
    return { error: NextResponse.json({ error: "That lesson has nothing like that to record." }, { status: 400 }) };
  }
  return { book, lesson: n, item: tile };
}

async function readBody(req: NextRequest): Promise<Record<string, unknown> | null> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

/** When a recording was made, to the millisecond, however the database client hands it over. */
function recordedAt(value: unknown): string {
  const at = new Date(value as string);
  return Number.isNaN(at.getTime()) ? String(value) : at.toISOString();
}

/** The rows as the portals see them: where to play each, and who recorded it. */
async function forPortals(admin: Db, rows: any[]): Promise<QaidahRecording[]> {
  if (rows.length === 0) return [];
  const names = await namesOf(admin, rows.map((r) => r.teacher_id));
  return rows.map((r) => ({
    book: r.book,
    lesson: r.lesson,
    item: r.item ?? "",
    url: recordingPlayLink(r.book, r.lesson, r.item ?? "", recordedAt(r.created_at)),
    mime_type: r.mime_type,
    duration_s: r.duration_s ?? null,
    teacher_name: names.get(r.teacher_id) ?? null,
    created_at: r.created_at,
  }));
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const me = await requireMember(supabase);
  if (isError(me)) return me.error;
  const book = req.nextUrl.searchParams.get("book");
  if (book !== null && !isQaidahBookId(book)) {
    return NextResponse.json({ error: "Choose a Qa'idah book." }, { status: 400 });
  }

  try {
    // A school that records its lessons letter by letter soon has more than
    // one page of them.
    const rows: any[] = [];
    for (let from = 0; ; from += PAGE) {
      let query = supabase
        .from("qaidah_recordings")
        .select(COLUMNS)
        .eq("school_id", me.school_id)
        .order("book")
        .order("lesson")
        .order("item")
        .range(from, from + PAGE - 1);
      if (book) query = query.eq("book", book);
      const { data, error } = await query;
      if (error) {
        if (needsRecordingsUpdate(error)) return NextResponse.json({ recordings: [], missing_table: true });
        throw error;
      }
      rows.push(...(data ?? []));
      if (!data || data.length < PAGE) break;
    }
    return NextResponse.json({ recordings: await forPortals(createAdminClient(), rows) });
  } catch (error) {
    console.error("Qa'idah recordings: could not list", error);
    return NextResponse.json({ error: "Couldn't load the recordings." }, { status: 500 });
  }
}

/** A teacher or the office, or an answer to send back. */
async function staff(supabase: Db): Promise<Member | { error: NextResponse }> {
  return requireMember(supabase, ["teacher", "admin"]);
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const me = await staff(supabase);
  if (isError(me)) return me.error;
  const body = await readBody(req);
  if (!body) return NextResponse.json({ error: "That request wasn't readable." }, { status: 400 });
  const which = readWhich(body.book, body.lesson, body.item);
  if ("error" in which) return which.error;
  const type = recordingType(typeof body.type === "string" ? body.type : "");
  if (!type) {
    return NextResponse.json({ error: "That isn't a recording this can play. Use MP3, M4A, WAV, OGG or WebM." }, { status: 400 });
  }
  const size = Number(body.size);
  if (!Number.isFinite(size) || size <= 0 || size > RECORDING_MAX_BYTES) {
    return NextResponse.json({ error: "That recording is too big — the most is 25 MB." }, { status: 400 });
  }

  const path = `${recordingsFolder(me.school_id, which.book, which.lesson)}${randomUUID()}.${recordingExtension(type)}`;
  const { data, error } = await createAdminClient().storage.from(FILE_BUCKET).createSignedUploadUrl(path);
  if (error || !data) {
    console.error("Qa'idah recordings: could not open an upload", error);
    const missing = /bucket not found/i.test(error?.message ?? "");
    return NextResponse.json(
      { error: missing ? "File uploads aren't switched on for this school yet." : "Couldn't start the upload. Please try again." },
      { status: missing ? 503 : 500 }
    );
  }
  return NextResponse.json({ path: data.path ?? path, token: data.token, type, bucket: FILE_BUCKET });
}

export async function PUT(req: NextRequest) {
  const supabase = await createClient();
  const me = await staff(supabase);
  if (isError(me)) return me.error;
  const body = await readBody(req);
  if (!body) return NextResponse.json({ error: "That request wasn't readable." }, { status: 400 });
  const which = readWhich(body.book, body.lesson, body.item);
  if ("error" in which) return which.error;
  const path = typeof body.path === "string" ? body.path : "";
  // Only a file uploaded for this very lesson, through POST above.
  if (!path.startsWith(recordingsFolder(me.school_id, which.book, which.lesson)) || path.includes("..")) {
    return NextResponse.json({ error: "That recording wasn't uploaded for this lesson." }, { status: 400 });
  }
  const type = recordingType(typeof body.type === "string" ? body.type : "");
  if (!type) return NextResponse.json({ error: "That isn't a recording this can play." }, { status: 400 });
  const duration = Number(body.duration_s);
  const durationS = Number.isFinite(duration) && duration >= 0 ? Math.min(Math.round(duration), RECORDING_MAX_SECONDS) : null;

  const admin = createAdminClient();
  // The file just uploaded, when it isn't going to be the recording after all.
  const discard = async () => {
    const { error } = await admin.storage.from(FILE_BUCKET).remove([path]);
    if (error) console.error("Qa'idah recordings: could not remove an unused upload", error);
  };
  try {
    const { data: before, error: readError } = await supabase
      .from("qaidah_recordings")
      .select("path")
      .eq("school_id", me.school_id)
      .eq("book", which.book)
      .eq("lesson", which.lesson)
      .eq("item", which.item)
      .maybeSingle();
    if (readError) {
      if (needsRecordingsUpdate(readError)) {
        await discard();
        return NextResponse.json({ error: MISSING, missing_table: true }, { status: 503 });
      }
      throw readError;
    }
    const { data: saved, error } = await supabase
      .from("qaidah_recordings")
      .upsert(
        {
          school_id: me.school_id,
          book: which.book,
          lesson: which.lesson,
          item: which.item,
          path,
          mime_type: type,
          duration_s: durationS,
          teacher_id: me.id,
          created_at: new Date().toISOString(),
        },
        { onConflict: "school_id,book,lesson,item" }
      )
      .select(COLUMNS)
      .single();
    if (error) {
      await discard();
      if (needsRecordingsUpdate(error)) return NextResponse.json({ error: MISSING, missing_table: true }, { status: 503 });
      throw error;
    }
    // The recording it replaces. Best effort: a file left behind costs a
    // little space, not a wrong recording.
    if (before?.path && before.path !== path) {
      const { error: removeError } = await admin.storage.from(FILE_BUCKET).remove([before.path]);
      if (removeError) console.error("Qa'idah recordings: could not remove the old file", removeError);
    }
    const [recording] = await forPortals(admin, [saved]);
    return NextResponse.json({ recording: recording ?? null });
  } catch (error) {
    console.error("Qa'idah recordings: could not save", error);
    return NextResponse.json({ error: "That recording didn't save. Please try again." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const me = await staff(supabase);
  if (isError(me)) return me.error;
  const body = await readBody(req);
  if (!body) return NextResponse.json({ error: "That request wasn't readable." }, { status: 400 });
  const which = readWhich(body.book, body.lesson, body.item);
  if ("error" in which) return which.error;

  try {
    const { data, error } = await supabase
      .from("qaidah_recordings")
      .delete()
      .eq("school_id", me.school_id)
      .eq("book", which.book)
      .eq("lesson", which.lesson)
      .eq("item", which.item)
      .select("path");
    if (error) {
      if (needsRecordingsUpdate(error)) return NextResponse.json({ error: MISSING, missing_table: true }, { status: 503 });
      throw error;
    }
    if (!data || data.length === 0) {
      return NextResponse.json({ error: "There's no recording of that." }, { status: 404 });
    }
    const { error: removeError } = await createAdminClient()
      .storage.from(FILE_BUCKET)
      .remove(data.map((r: any) => r.path));
    if (removeError) console.error("Qa'idah recordings: could not remove the file", removeError);
    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error("Qa'idah recordings: could not remove", error);
    return NextResponse.json({ error: "That recording couldn't be removed. Please try again." }, { status: 500 });
  }
}
