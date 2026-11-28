import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isError, type Db } from "@/lib/attendanceServer";
import { juzContext } from "@/lib/juzTestsServer";
import { addDays } from "@/lib/planDates";
import { isInstructionalDay } from "@/lib/schoolCalendar";
import { ISO_DATE, isWeekend } from "@/lib/juzTests";

/**
 * The office's settings for Juz tests: whether the school runs them, how
 * many a day, who examines, and which days take tests where they differ
 * from the school's own week.
 */

/** How far ahead the office's calendar of test days reaches. */
const CALENDAR_DAYS = 42;

// GET → the settings, the school's teachers with whether each examines,
// and the next six weeks of test days.
export async function GET() {
  const supabase = (await createClient()) as unknown as Db;
  const ctx = await juzContext(supabase, ["admin"]);
  if (isError(ctx)) return ctx.error;

  try {
    const [{ data: staff }, { data: examiners, error: examinerError }] = await Promise.all([
      ctx.admin
        .from("profiles")
        .select("id, full_name, role, active")
        .eq("school_id", ctx.me.school_id)
        .in("role", ["teacher", "admin"])
        .order("full_name"),
      ctx.admin.from("juz_test_examiners").select("user_id").eq("school_id", ctx.me.school_id),
    ]);
    const picked = new Set(((examinerError ? [] : examiners ?? []) as Array<{ user_id: string }>).map((e) => e.user_id));
    const days = Array.from({ length: CALENDAR_DAYS }, (_, i) => addDays(ctx.today, i)).map((date) => {
      const usual = isInstructionalDay(date, ctx.cal);
      const set = date in ctx.overrides ? ctx.overrides[date] : null;
      return { date, open: set ?? usual, usual, changed: set !== null && set !== usual, weekend: isWeekend(date) };
    });
    return NextResponse.json({
      enabled: ctx.enabled,
      slots: ctx.slots,
      today: ctx.today,
      // Before the update that adds Juz tests: say so, rather than a switch that can't work.
      ready: !examinerError,
      staff: ((staff ?? []) as Array<{ id: string; full_name: string; role: string; active: boolean | null }>)
        .filter((p) => p.active !== false)
        .map((p) => ({ id: p.id, name: p.full_name, office: p.role === "admin", examiner: p.role === "admin" || picked.has(p.id) })),
      days,
    });
  } catch (error) {
    console.error("Juz tests: could not load the settings", error);
    return NextResponse.json({ error: "Could not load the settings — please try again" }, { status: 500 });
  }
}

// PATCH { enabled? } | { slots? } | { examiner: { user_id, on } } | { day: { date, open } }
export async function PATCH(req: NextRequest) {
  const supabase = (await createClient()) as unknown as Db;
  const ctx = await juzContext(supabase, ["admin"]);
  if (isError(ctx)) return ctx.error;

  try {
    const body = (await req.json().catch(() => null)) ?? {};
    const school: Record<string, unknown> = {};
    if (typeof body.enabled === "boolean") school.juz_tests_enabled = body.enabled;
    if (body.slots !== undefined) {
      const slots = Number(body.slots);
      if (!Number.isInteger(slots) || slots < 1 || slots > 50) {
        return NextResponse.json({ error: "Tests a day is a number from 1 to 50" }, { status: 400 });
      }
      school.juz_test_slots = slots;
    }
    if (Object.keys(school).length > 0) {
      const { error } = await ctx.admin.from("schools").update(school).eq("id", ctx.me.school_id);
      if (error) throw error;
    }

    if (body.examiner) {
      const userId = String(body.examiner.user_id ?? "");
      const { data: person } = await ctx.admin.from("profiles").select("id, school_id, role").eq("id", userId).maybeSingle();
      if (!person || person.school_id !== ctx.me.school_id || person.role !== "teacher") {
        return NextResponse.json({ error: "Pick one of this school's teachers" }, { status: 400 });
      }
      const { error } = body.examiner.on
        ? await ctx.admin
            .from("juz_test_examiners")
            .upsert({ school_id: ctx.me.school_id, user_id: userId }, { onConflict: "school_id,user_id", ignoreDuplicates: true })
        : await ctx.admin.from("juz_test_examiners").delete().eq("school_id", ctx.me.school_id).eq("user_id", userId);
      if (error) throw error;
    }

    if (body.day) {
      const date = String(body.day.date ?? "");
      if (!ISO_DATE.test(date) || date < ctx.today) return NextResponse.json({ error: "Pick a day from today on" }, { status: 400 });
      const open = Boolean(body.day.open);
      // Back to the school's own week: no need to remember a choice that matches it.
      const { error } =
        open === isInstructionalDay(date, ctx.cal)
          ? await ctx.admin.from("juz_test_days").delete().eq("school_id", ctx.me.school_id).eq("date", date)
          : await ctx.admin
              .from("juz_test_days")
              .upsert({ school_id: ctx.me.school_id, date, open }, { onConflict: "school_id,date" });
      if (error) throw error;
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Juz tests: could not save the settings", error);
    return NextResponse.json({ error: "Could not save — please try again" }, { status: 500 });
  }
}
