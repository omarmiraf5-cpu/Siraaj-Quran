import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { parseCsv, parseXlsx, matchColumn } from "@/lib/parseDelimited";

/**
 * The school's own calendar: which weekdays carry Qur'an instruction, and
 * which specific dates are closed. Every yearly plan's pace figures read
 * this, through the calendar the API routes build and pass into
 * computePlanProgress/evaluateAlerts — this route is only where the
 * calendar itself is set, not where it gets used.
 *
 * Admin-only to write, for the same reason updating the school's own row
 * is admin-only elsewhere: this is standing timetable policy, not a
 * per-lesson decision. Every signed-in member of the school can read it,
 * since a teacher's "today's work" panel needs to know it too.
 */

const MAX_FILE_BYTES = 2 * 1024 * 1024; // A school year's closures are a few dozen rows at most.
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const VALID_WEEKDAYS = [1, 2, 3, 4, 5, 6, 7];

async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const { data: caller, error } = await supabase
    .from("profiles")
    .select("role, school_id")
    .eq("id", user.id)
    .single();
  if (error || !caller) {
    return { error: NextResponse.json({ error: "No profile is visible for this session" }, { status: 403 }) };
  }
  if (!caller.school_id) {
    return { error: NextResponse.json({ error: "This account is not attached to a school" }, { status: 403 }) };
  }
  if (caller.role !== "admin") {
    return {
      error: NextResponse.json(
        { error: "Only an admin can change the school calendar" },
        { status: 403 }
      ),
    };
  }
  return { caller };
}

/** Any signed-in member of the school, admin or not — teachers read this
 *  to build their own "today's work" panel. */
async function requireMember(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const { data: caller, error } = await supabase
    .from("profiles")
    .select("role, school_id")
    .eq("id", user.id)
    .single();
  if (error || !caller || !caller.school_id) {
    return { error: NextResponse.json({ error: "No profile is visible for this session" }, { status: 403 }) };
  }
  return { caller };
}

// GET — the weekday pattern plus every closed date on file.
export async function GET() {
  const supabase = await createClient();
  const auth = await requireMember(supabase);
  if (auth.error) return auth.error;

  try {
    const { data: school, error: schoolError } = await supabase
      .from("schools")
      .select("instructional_weekdays")
      .eq("id", auth.caller.school_id)
      .single();
    if (schoolError) throw schoolError;

    const { data: days, error: daysError } = await supabase
      .from("school_calendar_days")
      .select("id, date, label")
      .order("date");
    if (daysError) throw daysError;

    return NextResponse.json({
      weekdays: school.instructional_weekdays as number[],
      closedDates: (days ?? []).map((d) => ({ id: d.id, date: d.date, label: d.label })),
    });
  } catch (error) {
    console.error("School calendar: could not load", error);
    return NextResponse.json({ error: "Could not load the school calendar" }, { status: 500 });
  }
}

// PATCH — set the weekly pattern (which weekdays carry instruction at all).
export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const auth = await requireAdmin(supabase);
  if (auth.error) return auth.error;

  try {
    const { weekdays } = (await req.json()) ?? {};
    if (
      !Array.isArray(weekdays) ||
      weekdays.length === 0 ||
      !weekdays.every((d) => VALID_WEEKDAYS.includes(d))
    ) {
      return NextResponse.json(
        { error: "weekdays must be a non-empty list of numbers 1 (Monday) through 7 (Sunday)" },
        { status: 400 }
      );
    }
    const deduped = [...new Set(weekdays)].sort((a, b) => a - b);

    const { error } = await supabase
      .from("schools")
      .update({ instructional_weekdays: deduped })
      .eq("id", auth.caller.school_id);
    if (error) throw error;

    return NextResponse.json({ weekdays: deduped });
  } catch (error) {
    console.error("School calendar: could not set weekdays", error);
    return NextResponse.json({ error: "Could not update the weekly pattern" }, { status: 500 });
  }
}

// POST — add closed dates, either one at a time (JSON) or in bulk from an
// uploaded file (multipart form, the same Date/Label shape a school would
// export from any calendar tool).
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const auth = await requireAdmin(supabase);
  if (auth.error) return auth.error;
  const schoolId = auth.caller.school_id;

  const contentType = req.headers.get("content-type") ?? "";

  try {
    let candidates: Array<{ date: string; label: string | null }>;

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file");
      if (!(file instanceof File)) {
        return NextResponse.json({ error: "No file received." }, { status: 400 });
      }
      if (file.size > MAX_FILE_BYTES) {
        return NextResponse.json({ error: "That file is too large (2MB max)." }, { status: 400 });
      }
      const lowerName = file.name.toLowerCase();
      let rows: string[][];
      if (lowerName.endsWith(".csv")) {
        rows = parseCsv(await file.text());
      } else if (lowerName.endsWith(".xlsx")) {
        rows = await parseXlsx(await file.arrayBuffer());
      } else {
        return NextResponse.json(
          { error: "Upload a .xlsx or .csv file with Date and Label columns." },
          { status: 400 }
        );
      }
      candidates = rowsToClosedDates(rows);
      if (candidates.length === 0) {
        return NextResponse.json(
          { error: "Couldn't find any dates in that file — check it has a Date column." },
          { status: 400 }
        );
      }
    } else {
      const body = await req.json();
      const list = Array.isArray(body?.dates) ? body.dates : [body];
      candidates = list.map((d: { date?: unknown; label?: unknown }) => ({
        date: String(d?.date ?? ""),
        label: d?.label != null ? String(d.label) : null,
      }));
    }

    const bad = candidates.find((c) => !ISO_DATE.test(c.date));
    if (bad) {
      return NextResponse.json(
        { error: `"${bad.date}" is not a date in YYYY-MM-DD form` },
        { status: 400 }
      );
    }
    if (candidates.length > 500) {
      return NextResponse.json(
        { error: "That's more dates than a single school year needs — check the file is the right one." },
        { status: 400 }
      );
    }

    const rows = candidates.map((c) => ({
      school_id: schoolId,
      date: c.date,
      label: c.label?.trim() || null,
    }));

    // Upsert on the (school_id, date) pair already enforced by the schema,
    // so re-uploading the same calendar (or one that overlaps a date
    // already added by hand) updates the label instead of failing on the
    // second copy of a date.
    const { data, error } = await supabase
      .from("school_calendar_days")
      .upsert(rows, { onConflict: "school_id,date" })
      .select("id, date, label");
    if (error) throw error;

    return NextResponse.json(
      { added: (data ?? []).map((d) => ({ id: d.id, date: d.date, label: d.label })) },
      { status: 201 }
    );
  } catch (error) {
    console.error("School calendar: could not add closed dates", error);
    const message = error instanceof Error ? error.message : "Could not add those dates";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/school-calendar?id=… — remove one closed date, for undoing a
// mistaken upload row or reopening a date the school changed its mind on.
export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const auth = await requireAdmin(supabase);
  if (auth.error) return auth.error;

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  try {
    const { error } = await supabase.from("school_calendar_days").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("School calendar: could not remove a closed date", error);
    return NextResponse.json({ error: "Could not remove that date" }, { status: 500 });
  }
}

const DATE_PATTERNS = [/^date$/i, /^(closed|holiday)[ _-]?date$/i];
const LABEL_PATTERNS = [/^(label|name|reason|description|holiday)$/i];

/** A closed-dates upload is either one row per single date, or one row
 *  per range (Start/End) — a "Winter break, Dec 22 – Jan 2" line is how a
 *  school actually keeps this list, and expanding it here is what saves
 *  them typing eleven separate rows into a spreadsheet by hand. */
function rowsToClosedDates(rows: string[][]): Array<{ date: string; label: string | null }> {
  if (rows.length === 0) return [];
  const headers = rows[0].map((c) => String(c ?? ""));
  const dateCol = matchColumn(headers, DATE_PATTERNS);
  const startCol = matchColumn(headers, [/^start( date)?$/i, /^from$/i]);
  const endCol = matchColumn(headers, [/^end( date)?$/i, /^to$/i]);
  const labelCol = matchColumn(headers, LABEL_PATTERNS);

  const out: Array<{ date: string; label: string | null }> = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const label = labelCol !== -1 ? String(row[labelCol] ?? "").trim() || null : null;

    if (dateCol !== -1) {
      const raw = normaliseDate(String(row[dateCol] ?? ""));
      if (raw) out.push({ date: raw, label });
      continue;
    }
    if (startCol !== -1 && endCol !== -1) {
      const start = normaliseDate(String(row[startCol] ?? ""));
      const end = normaliseDate(String(row[endCol] ?? ""));
      if (!start || !end || end < start) continue;
      // Bounded the same way the mushaf-walk helpers are: a malformed
      // range (a typo'd year, ten years out) fails by stopping rather
      // than by generating tens of thousands of rows.
      for (let d = start, guard = 0; d <= end && guard < 400; guard++) {
        out.push({ date: d, label });
        d = addOneDay(d);
      }
    }
  }
  return out;
}

/** Accepts YYYY-MM-DD as-is, plus the two other shapes a spreadsheet's own
 *  date formatting commonly produces (M/D/YYYY, D-M-YYYY) — returns null
 *  for anything else rather than guessing at an ambiguous format. */
function normaliseDate(raw: string): string | null {
  const s = raw.trim();
  if (ISO_DATE.test(s)) return s;
  const slash = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slash) {
    const [, m, d, y] = slash;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return null;
}

function addOneDay(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + 1));
  return date.toISOString().slice(0, 10);
}
