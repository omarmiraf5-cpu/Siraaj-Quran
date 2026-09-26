import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isError, requireMember } from "@/lib/attendanceServer";
import { FILE_BUCKET, FILE_LIMITS, fileSize, fileType, storageName } from "@/lib/classWork";
import { childFilesPrefix, teacherFilesPrefix } from "@/lib/classWorkServer";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * A one-time link to upload one file, straight to the school's private
 * storage — past this server, whose request size limit a phone photo or a
 * PDF worksheet would break.
 *
 *   purpose "assignment" — a teacher or the office attaching a file to work
 *                          they're setting;
 *   purpose "answer"     — a child handing in a photo or file, for work
 *                          set for them that's still open.
 *
 * The file lands under the caller's own part of storage, which is the only
 * place the routes that save assignments and answers accept files from.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const me = await requireMember(supabase);
  if (isError(me)) return me.error;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "That request wasn't readable." }, { status: 400 });
  }
  const name = typeof body.name === "string" ? body.name.trim().slice(0, FILE_LIMITS.name) : "";
  const type = fileType(name, typeof body.type === "string" ? body.type : "");
  const size = Number(body.size);
  if (!name || !type) {
    return NextResponse.json(
      { error: "That kind of file can't be uploaded. Use a photo, a PDF, a Word or PowerPoint file, or a recording." },
      { status: 400 }
    );
  }
  if (!Number.isFinite(size) || size <= 0 || size > FILE_LIMITS.maxBytes) {
    return NextResponse.json({ error: `That file is too big — the most is ${fileSize(FILE_LIMITS.maxBytes)}.` }, { status: 400 });
  }

  let folder: string;
  if (body.purpose === "assignment") {
    if (me.role !== "teacher" && me.role !== "admin") {
      return NextResponse.json({ error: "This page isn't available for your account" }, { status: 403 });
    }
    folder = teacherFilesPrefix(me.school_id);
  } else if (body.purpose === "answer") {
    if (me.role !== "student") {
      return NextResponse.json({ error: "This page isn't available for your account" }, { status: 403 });
    }
    const assignmentId = typeof body.assignment_id === "string" ? body.assignment_id : "";
    const { data: mine } = await supabase.from("students").select("id").eq("profile_id", me.id);
    const myIds = (mine ?? []).map((s: any) => s.id);
    const { data: subs } = assignmentId && myIds.length
      ? await supabase.from("subject_submissions").select("student_id, status").eq("assignment_id", assignmentId).in("student_id", myIds)
      : { data: [] as any[] };
    const sub = (subs ?? [])[0];
    if (!sub) return NextResponse.json({ error: "That assignment isn't one of yours." }, { status: 404 });
    if (sub.status !== "assigned") return NextResponse.json({ error: "You've already handed this in." }, { status: 409 });
    folder = childFilesPrefix(me.school_id, assignmentId, sub.student_id);
  } else {
    return NextResponse.json({ error: "What is the file for?" }, { status: 400 });
  }

  const path = `${folder}${randomUUID()}/${storageName(name)}`;
  const { data, error } = await createAdminClient().storage.from(FILE_BUCKET).createSignedUploadUrl(path);
  if (error || !data) {
    console.error("Class work: could not open an upload", error);
    const missing = /bucket not found/i.test(error?.message ?? "");
    return NextResponse.json(
      { error: missing ? "File uploads aren't switched on for this school yet." : "Couldn't start the upload. Please try again." },
      { status: missing ? 503 : 500 }
    );
  }
  return NextResponse.json({ path: data.path ?? path, token: data.token, type, bucket: FILE_BUCKET });
}
