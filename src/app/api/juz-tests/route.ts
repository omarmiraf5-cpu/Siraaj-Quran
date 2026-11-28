import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isError, type Db } from "@/lib/attendanceServer";
import {
  juzContext,
  notOn,
  RESULTS_WINDOW_DAYS,
  sinceDays,
  studentInfo,
  taughtStudentIds,
  testsOf,
  withNames,
  type JuzContext,
} from "@/lib/juzTestsServer";
import { bookableDays, extraSlot, ISO_DATE, isTestDay, nextSlot, testDaysAfter } from "@/lib/juzTests";

/**
 * Booking Juz tests. A teacher books one of their students for a Juz on a
 * test day, today or a few test days ahead; the test takes the lowest free
 * number that day. A full day says which day next has room. The office can
 * book any student, and past a full day when it must.
 */

/** Who the caller can book: a teacher's own students, or the whole school for the office. */
async function bookableStudents(ctx: JuzContext): Promise<string[] | null> {
  if (ctx.me.role === "admin") return null;
  return [...(await taughtStudentIds(ctx.admin, ctx.me.id, ctx.me.school_id))];
}

async function takenSlots(admin: Db, schoolId: string, dates: string[]): Promise<Map<string, number[]>> {
  const out = new Map<string, number[]>(dates.map((d) => [d, []]));
  if (dates.length === 0) return out;
  const { data, error } = await admin
    .from("juz_tests")
    .select("test_date, slot")
    .eq("school_id", schoolId)
    .in("test_date", dates)
    .is("cancelled_at", null);
  if (error) throw error;
  for (const r of (data ?? []) as Array<{ test_date: string; slot: number }>) out.get(r.test_date)?.push(r.slot);
  return out;
}

// GET → the booking page: the days open for booking and how full each is,
// the caller's students with the Juz each has passed or is booked for, and
// their tests from the last two months onward. ?brief=1 → only whether the
// school runs Juz tests and whether the caller examines, for the menus.
export async function GET(req: NextRequest) {
  const supabase = (await createClient()) as unknown as Db;
  const ctx = await juzContext(supabase, ["admin", "teacher"]);
  if (isError(ctx)) return ctx.error;
  const base = { enabled: ctx.enabled, examiner: ctx.examiner, office: ctx.me.role === "admin", today: ctx.today, slots: ctx.slots };
  if (!ctx.enabled || req.nextUrl.searchParams.has("brief")) return NextResponse.json(base);

  try {
    const ids = await bookableStudents(ctx);
    const info = await studentInfo(ctx.admin, ctx.me.school_id, ids ?? undefined);
    const studentIds = [...info.values()].filter((s) => s.active).map((s) => s.id);
    const days = bookableDays(ctx.today, ctx.cal, ctx.overrides);
    const [taken, tests, { data: standing, error }] = await Promise.all([
      takenSlots(ctx.admin, ctx.me.school_id, days),
      testsOf(ctx.admin, ctx.me.school_id, studentIds, sinceDays(ctx.today, RESULTS_WINDOW_DAYS)),
      // Every Juz passed, however long ago, and every booking still waiting.
      studentIds.length
        ? ctx.admin
            .from("juz_tests")
            .select("student_id, juz, result, test_date")
            .eq("school_id", ctx.me.school_id)
            .in("student_id", studentIds)
            .is("cancelled_at", null)
            .or("result.eq.pass,result.is.null")
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (error) throw error;
    const passed = new Map<string, number[]>();
    const waiting = new Map<string, Array<{ juz: number; date: string }>>();
    for (const r of (standing ?? []) as Array<{ student_id: string; juz: number; result: string | null; test_date: string }>) {
      if (r.result === "pass") (passed.get(r.student_id) ?? passed.set(r.student_id, []).get(r.student_id)!).push(r.juz);
      // A booking whose day went by unheard no longer holds its Juz.
      else if (r.test_date >= ctx.today)
        (waiting.get(r.student_id) ?? waiting.set(r.student_id, []).get(r.student_id)!).push({ juz: r.juz, date: r.test_date });
    }
    return NextResponse.json({
      ...base,
      days: days.map((d) => ({ date: d, booked: taken.get(d)?.length ?? 0 })),
      students: [...info.values()]
        .filter((s) => s.active)
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((s) => ({
          id: s.id,
          name: s.name,
          halaqa: s.halaqa,
          passed: (passed.get(s.id) ?? []).sort((a, b) => a - b),
          waiting: (waiting.get(s.id) ?? []).sort((a, b) => a.juz - b.juz),
        })),
      tests,
    });
  } catch (error) {
    console.error("Juz tests: could not load the booking page", error);
    return NextResponse.json({ error: "Could not load Juz tests — please try again" }, { status: 500 });
  }
}

// POST { student_id, juz, date, extra? } → books the test. `extra` (the
// office only) books past a full day.
export async function POST(req: NextRequest) {
  const supabase = (await createClient()) as unknown as Db;
  const ctx = await juzContext(supabase, ["admin", "teacher"]);
  if (isError(ctx)) return ctx.error;
  if (!ctx.enabled) return notOn();

  try {
    const body = (await req.json().catch(() => null)) ?? {};
    const studentId = String(body.student_id ?? "");
    const juz = Number(body.juz);
    const date = String(body.date ?? "");
    const extra = body.extra === true && ctx.me.role === "admin";
    if (!Number.isInteger(juz) || juz < 1 || juz > 30) return NextResponse.json({ error: "Pick a Juz from 1 to 30" }, { status: 400 });
    if (!ISO_DATE.test(date)) return NextResponse.json({ error: "Pick a day for the test" }, { status: 400 });

    const ids = await bookableStudents(ctx);
    const info = await studentInfo(ctx.admin, ctx.me.school_id, [studentId]);
    const student = info.get(studentId);
    if (!student || !student.active || (ids && !ids.includes(studentId))) {
      return NextResponse.json({ error: "That student isn't one of yours", code: "not_yours" }, { status: 403 });
    }

    // A teacher books from today to a few test days ahead; the office any test day to come.
    const window = bookableDays(ctx.today, ctx.cal, ctx.overrides);
    const allowed = ctx.me.role === "admin" ? date >= ctx.today && isTestDay(date, ctx.cal, ctx.overrides) : window.includes(date);
    if (!allowed) {
      return NextResponse.json({ error: "Tests can't be booked on that day. Pick one of the days shown.", code: "bad_day" }, { status: 400 });
    }

    const { data: same, error: sameError } = await ctx.admin
      .from("juz_tests")
      .select("id, result, test_date")
      .eq("student_id", studentId)
      .eq("juz", juz)
      .is("cancelled_at", null);
    if (sameError) throw sameError;
    const rows = (same ?? []) as Array<{ id: string; result: string | null; test_date: string }>;
    if (rows.some((r) => r.result === "pass")) {
      return NextResponse.json({ error: `${student.name} has already passed Juz ${juz}.`, code: "passed", name: student.name, juz }, { status: 409 });
    }
    const open = rows.find((r) => r.result === null);
    if (open && open.test_date >= ctx.today) {
      return NextResponse.json(
        { error: `${student.name} is already booked for Juz ${juz} on ${open.test_date}.`, code: "booked", name: student.name, juz, date: open.test_date },
        { status: 409 }
      );
    }
    // Its day went by without the test: that booking gives way to this one.
    if (open) {
      const { error } = await ctx.admin.from("juz_tests").update({ cancelled_at: new Date().toISOString() }).eq("id", open.id);
      if (error) throw error;
    }

    // Two people booking the last number at once: the second tries the next.
    for (let attempt = 0; attempt < 5; attempt++) {
      const taken = (await takenSlots(ctx.admin, ctx.me.school_id, [date])).get(date) ?? [];
      const slot = nextSlot(taken, ctx.slots) ?? (extra ? extraSlot(taken) : null);
      if (slot === null) {
        const later = testDaysAfter(date, ctx.cal, ctx.overrides, 30);
        const counts = await takenSlots(ctx.admin, ctx.me.school_id, later);
        const next = later.find((d) => (counts.get(d)?.length ?? 0) < ctx.slots) ?? null;
        return NextResponse.json({ error: "That day is full.", code: "full", date, next_date: next }, { status: 409 });
      }
      const { data: row, error } = await ctx.admin
        .from("juz_tests")
        .insert({ school_id: ctx.me.school_id, student_id: studentId, juz, test_date: date, slot, booked_by: ctx.me.id })
        .select("id, student_id, juz, test_date, slot, result, comment, examiner_id, tested_at, cancelled_at, created_at")
        .single();
      if (!error) {
        const [test] = await withNames(ctx.admin, ctx.me.school_id, [row as Parameters<typeof withNames>[2][number]]);
        return NextResponse.json({ ok: true, test }, { status: 201 });
      }
      const code = (error as { code?: string }).code;
      const detail = `${(error as { message?: string }).message ?? ""} ${(error as { details?: string }).details ?? ""}`;
      if (code === "23505" && detail.includes("one_per_slot")) continue;
      if (code === "23505") {
        return NextResponse.json({ error: `${student.name} is already booked for Juz ${juz}.`, code: "booked", name: student.name, juz }, { status: 409 });
      }
      throw error;
    }
    return NextResponse.json({ error: "Someone else was booking that day at the same moment — please try again" }, { status: 409 });
  } catch (error) {
    console.error("Juz tests: could not book", error);
    return NextResponse.json({ error: "Could not book the test — please try again" }, { status: 500 });
  }
}

// DELETE ?id= → cancels a booking that hasn't been heard yet.
export async function DELETE(req: NextRequest) {
  const supabase = (await createClient()) as unknown as Db;
  const ctx = await juzContext(supabase, ["admin", "teacher"]);
  if (isError(ctx)) return ctx.error;

  try {
    const id = req.nextUrl.searchParams.get("id") ?? "";
    const { data: test } = await ctx.admin
      .from("juz_tests")
      .select("id, school_id, student_id, result, cancelled_at")
      .eq("id", id)
      .maybeSingle();
    const ids = await bookableStudents(ctx);
    if (!test || test.school_id !== ctx.me.school_id || (ids && !ids.includes(test.student_id as string))) {
      return NextResponse.json({ error: "No such booking" }, { status: 404 });
    }
    if (test.result) return NextResponse.json({ error: "That test has been heard already, so it can't be cancelled" }, { status: 409 });
    if (!test.cancelled_at) {
      const { error } = await ctx.admin.from("juz_tests").update({ cancelled_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Juz tests: could not cancel", error);
    return NextResponse.json({ error: "Could not cancel the booking — please try again" }, { status: 500 });
  }
}
