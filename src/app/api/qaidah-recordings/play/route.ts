import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isError, requireMember } from "@/lib/attendanceServer";
import { FILE_BUCKET } from "@/lib/classWork";
import { isQaidahBookId, qaidahLesson } from "@/data/qaidah";
import { isMissingTable } from "@/lib/qaidahLessons";

// A lesson's recording, to play: GET ?book=&lesson= sends the player on to
// the file, through a link good for an hour. The portals' players point here
// rather than at the file (recordingPlayLink), so each time one loads the
// recording it gets a fresh link, and a page left open for hours still plays.
// Anyone at the school may listen, as with the list in ../route.ts.

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const me = await requireMember(supabase);
  if (isError(me)) return me.error;
  const book = req.nextUrl.searchParams.get("book");
  const lesson = Number(req.nextUrl.searchParams.get("lesson"));
  if (!isQaidahBookId(book) || !Number.isInteger(lesson) || !qaidahLesson(book, lesson)) {
    return NextResponse.json({ error: "That book has no such lesson." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("qaidah_recordings")
    .select("path")
    .eq("school_id", me.school_id)
    .eq("book", book)
    .eq("lesson", lesson)
    .maybeSingle();
  if (error) {
    if (isMissingTable(error)) {
      return NextResponse.json({ error: "Lesson recordings need the latest database update." }, { status: 503 });
    }
    console.error("Qa'idah recordings: could not look one up", error);
    return NextResponse.json({ error: "Couldn't open that recording." }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: "That lesson has no recording." }, { status: 404 });

  const { data: signed, error: signError } = await createAdminClient()
    .storage.from(FILE_BUCKET)
    .createSignedUrl(data.path, 60 * 60);
  if (signError || !signed?.signedUrl) {
    console.error("Qa'idah recordings: could not open the file", signError);
    return NextResponse.json({ error: "Couldn't open that recording." }, { status: 404 });
  }
  const res = NextResponse.redirect(signed.signedUrl, 302);
  // Each load gets its own link: nothing may keep this answer.
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}
