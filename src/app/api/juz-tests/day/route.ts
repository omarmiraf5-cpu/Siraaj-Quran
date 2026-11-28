import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isError, type Db } from "@/lib/attendanceServer";
import { juzContext, notOn, testsOnDay } from "@/lib/juzTestsServer";
import { ISO_DATE, isTestDay } from "@/lib/juzTests";

// GET ?date= → an examiner's list for the day: every test booked on it, in
// its numbered order, with the student, their teacher, the Juz, and the
// result and comment once it's been heard.
export async function GET(req: NextRequest) {
  const supabase = (await createClient()) as unknown as Db;
  const ctx = await juzContext(supabase, ["admin", "teacher"]);
  if (isError(ctx)) return ctx.error;
  if (!ctx.enabled) return notOn();
  if (!ctx.examiner) return NextResponse.json({ error: "Only examiners can see the day's tests" }, { status: 403 });

  const asked = req.nextUrl.searchParams.get("date") ?? "";
  const date = ISO_DATE.test(asked) ? asked : ctx.today;
  try {
    const tests = await testsOnDay(ctx.admin, ctx.me.school_id, date);
    return NextResponse.json({
      date,
      today: ctx.today,
      testDay: isTestDay(date, ctx.cal, ctx.overrides),
      slots: ctx.slots,
      tests,
    });
  } catch (error) {
    console.error("Juz tests: could not load the day", error);
    return NextResponse.json({ error: "Could not load the day's tests — please try again" }, { status: 500 });
  }
}
