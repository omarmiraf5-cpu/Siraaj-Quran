import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isError, type Db } from "@/lib/attendanceServer";
import { juzContext, maySee, mistakesOf, notOn, oneTest, withNames } from "@/lib/juzTestsServer";

/**
 * One Juz test. Its teacher, its parent, the office and the examiners can
 * read it with every mistake; an examiner records the result.
 */

// GET → the test and its mistakes.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = (await createClient()) as unknown as Db;
  const ctx = await juzContext(supabase);
  if (isError(ctx)) return ctx.error;
  if (!ctx.enabled) return notOn();

  try {
    const row = await oneTest(ctx.admin, id);
    if (!row || row.school_id !== ctx.me.school_id || row.cancelled_at || !(await maySee(ctx, row.student_id))) {
      return NextResponse.json({ error: "No such test" }, { status: 404 });
    }
    const { school_id: _school, ...test } = row;
    const [[named], mistakes] = await Promise.all([
      withNames(ctx.admin, ctx.me.school_id, [test]),
      mistakesOf(ctx.admin, [id]),
    ]);
    return NextResponse.json({ test: named, mistakes: mistakes.get(id) ?? [], examiner: ctx.examiner, today: ctx.today });
  } catch (error) {
    console.error("Juz tests: could not load a test", error);
    return NextResponse.json({ error: "Could not load the test — please try again" }, { status: 500 });
  }
}

// PATCH { result?: "pass" | "fail", comment? } → the examiner's verdict,
// saved with when it was given and who gave it.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = (await createClient()) as unknown as Db;
  const ctx = await juzContext(supabase, ["admin", "teacher"]);
  if (isError(ctx)) return ctx.error;
  if (!ctx.enabled) return notOn();
  if (!ctx.examiner) return NextResponse.json({ error: "Only examiners can record a result" }, { status: 403 });

  try {
    const body = (await req.json().catch(() => null)) ?? {};
    const row = await oneTest(ctx.admin, id);
    if (!row || row.school_id !== ctx.me.school_id || row.cancelled_at) {
      return NextResponse.json({ error: "No such test" }, { status: 404 });
    }
    if (row.test_date > ctx.today) {
      return NextResponse.json({ error: "This test is booked for a later day" }, { status: 409 });
    }
    const patch: Record<string, unknown> = {};
    if ("comment" in body) patch.comment = body.comment == null ? null : String(body.comment).trim().slice(0, 1000) || null;
    if ("result" in body) {
      if (body.result !== "pass" && body.result !== "fail") {
        return NextResponse.json({ error: "The result is Pass or Fail" }, { status: 400 });
      }
      // Passing a Juz they had passed already would be a second pass of it.
      if (body.result === "pass" && row.result !== "pass") {
        const { data: other } = await ctx.admin
          .from("juz_tests")
          .select("id")
          .eq("student_id", row.student_id)
          .eq("juz", row.juz)
          .eq("result", "pass")
          .is("cancelled_at", null)
          .neq("id", id)
          .limit(1);
        if ((other ?? []).length > 0) {
          return NextResponse.json({ error: "This student has already passed this Juz in another test" }, { status: 409 });
        }
      }
      patch.result = body.result;
      patch.examiner_id = ctx.me.id;
      patch.tested_at = new Date().toISOString();
    }
    if (Object.keys(patch).length === 0) return NextResponse.json({ error: "Nothing to save" }, { status: 400 });
    const { error } = await ctx.admin.from("juz_tests").update(patch).eq("id", id);
    if (error) throw error;
    const fresh = await oneTest(ctx.admin, id);
    const { school_id: _school, ...test } = fresh!;
    const [named] = await withNames(ctx.admin, ctx.me.school_id, [test]);
    return NextResponse.json({ ok: true, test: named });
  } catch (error) {
    console.error("Juz tests: could not save a result", error);
    return NextResponse.json({ error: "Could not save the result — please try again" }, { status: 500 });
  }
}
