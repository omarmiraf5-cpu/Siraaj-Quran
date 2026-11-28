import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isError, type Db } from "@/lib/attendanceServer";
import { juzContext, mistakesOf, notOn, oneTest } from "@/lib/juzTestsServer";
import { juzPages } from "@/lib/juzTests";
import { SURAHS } from "@/data/mushaf-index";

/**
 * The mistakes an examiner marks on a test, each on its word. Marking a
 * word again changes what kind of mistake it is, or its note.
 */

async function examinerTest(id: string) {
  const supabase = (await createClient()) as unknown as Db;
  const ctx = await juzContext(supabase, ["admin", "teacher"]);
  if (isError(ctx)) return ctx;
  if (!ctx.enabled) return { error: notOn() };
  if (!ctx.examiner) return { error: NextResponse.json({ error: "Only examiners can mark mistakes" }, { status: 403 }) };
  const test = await oneTest(ctx.admin, id);
  if (!test || test.school_id !== ctx.me.school_id || test.cancelled_at) {
    return { error: NextResponse.json({ error: "No such test" }, { status: 404 }) };
  }
  return { ctx, test };
}

// POST { kind, page, surah, ayah, word, note? } → marks (or re-marks) a word.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const found = await examinerTest(id);
  if ("error" in found) return found.error;
  const { ctx, test } = found;

  try {
    const body = (await req.json().catch(() => null)) ?? {};
    const kind = body.kind === "tajweed" || body.kind === "memorization" ? body.kind : null;
    const page = Number(body.page);
    const surah = Number(body.surah);
    const ayah = Number(body.ayah);
    const word = Number(body.word);
    const [first, last] = juzPages(test.juz);
    if (!kind) return NextResponse.json({ error: "Pick Tajweed or Memorization" }, { status: 400 });
    if (
      ![page, surah, ayah, word].every(Number.isInteger) ||
      page < first ||
      page > last ||
      surah < 1 ||
      surah > 114 ||
      ayah < 1 ||
      ayah > (SURAHS[surah - 1]?.ayahs ?? 0) ||
      word < 1
    ) {
      return NextResponse.json({ error: "That word isn't in this Juz" }, { status: 400 });
    }
    const note = body.note == null ? null : String(body.note).trim().slice(0, 300) || null;
    const { error } = await ctx.admin
      .from("juz_test_mistakes")
      .upsert(
        { test_id: id, school_id: ctx.me.school_id, kind, page, surah, ayah, word, note, marked_by: ctx.me.id },
        { onConflict: "test_id,surah,ayah,word" }
      );
    if (error) throw error;
    const mistakes = await mistakesOf(ctx.admin, [id]);
    return NextResponse.json({ ok: true, mistakes: mistakes.get(id) ?? [] });
  } catch (error) {
    console.error("Juz tests: could not mark a mistake", error);
    return NextResponse.json({ error: "Could not save the mistake — please try again" }, { status: 500 });
  }
}

// DELETE ?mistake_id= → takes a mark off.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const found = await examinerTest(id);
  if ("error" in found) return found.error;
  const { ctx } = found;

  try {
    const mistakeId = req.nextUrl.searchParams.get("mistake_id") ?? "";
    const { error } = await ctx.admin.from("juz_test_mistakes").delete().eq("id", mistakeId).eq("test_id", id);
    if (error) throw error;
    const mistakes = await mistakesOf(ctx.admin, [id]);
    return NextResponse.json({ ok: true, mistakes: mistakes.get(id) ?? [] });
  } catch (error) {
    console.error("Juz tests: could not remove a mistake", error);
    return NextResponse.json({ error: "Could not remove the mistake — please try again" }, { status: 500 });
  }
}
