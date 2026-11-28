import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isError, type Db } from "@/lib/attendanceServer";
import { juzContext, maySee, mistakesOf, testsOf } from "@/lib/juzTestsServer";
import { testSummary } from "@/lib/juzTests";

// GET ?student_id= → one child's Juz tests from the start: Passed, Failed,
// Pending and Level, then every test with its comment and mistakes. For the
// child's parent, their teacher, the office and the examiners.
export async function GET(req: NextRequest) {
  const supabase = (await createClient()) as unknown as Db;
  const ctx = await juzContext(supabase);
  if (isError(ctx)) return ctx.error;
  if (!ctx.enabled) return NextResponse.json({ enabled: false });

  const studentId = req.nextUrl.searchParams.get("student_id") ?? "";
  try {
    if (!(await maySee(ctx, studentId))) return NextResponse.json({ error: "No such student" }, { status: 404 });
    const tests = await testsOf(ctx.admin, ctx.me.school_id, [studentId]);
    const mistakes = await mistakesOf(ctx.admin, tests.filter((t) => t.mistakes > 0).map((t) => t.id));
    return NextResponse.json({
      enabled: true,
      today: ctx.today,
      summary: testSummary(tests, ctx.today),
      tests,
      mistakes: Object.fromEntries(mistakes),
    });
  } catch (error) {
    console.error("Juz tests: could not load a student's tests", error);
    return NextResponse.json({ error: "Could not load the Juz tests — please try again" }, { status: 500 });
  }
}
