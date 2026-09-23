import "server-only";

import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSurahById } from "@/data/mushaf-index";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  decryptField,
  encryptField,
  fieldContext,
  isEncryptionConfigured,
} from "@/lib/planCrypto";
import {
  evaluateAlerts,
  todayISO,
  type Milestone,
  type Plan,
  type PlanAlert,
  type ProgressEntry,
} from "@/lib/yearlyPlan";
import { nextPosition, weeklyMilestonesFromDailyRate } from "@/lib/mushafPlan";
import { buildCalendar, DEFAULT_CALENDAR, type SchoolCalendar } from "@/lib/schoolCalendar";

/**
 * The server half of the yearly-plan module: session and role checks, the
 * encrypt-on-write / decrypt-on-read boundary, and alert reconciliation.
 *
 * `server-only` at the top is load-bearing. Everything here can reach
 * PLAN_ENCRYPTION_KEY, so an accidental import from a client component
 * must fail the build rather than ship the key to a browser.
 *
 * Every query below runs through the *caller's* session client, not the
 * service role, so row-level security is what actually decides which rows
 * come back. The role checks in this file are a second, earlier gate: they
 * turn "RLS returned zero rows" into a clean 403 that a form can show,
 * instead of a mystery empty state. They do not replace the policies.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
type Db = SupabaseClient<any, "public", any>;

export interface Caller {
  id: string;
  role: string;
  school_id: string | null;
}

export interface CallerFailure {
  error: NextResponse;
}

export function isFailure(x: unknown): x is CallerFailure {
  return typeof x === "object" && x !== null && "error" in (x as CallerFailure);
}

/** Proves there is a session and returns who it belongs to. */
export async function requireCaller(supabase: Db): Promise<Caller | CallerFailure> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, role, school_id")
    .eq("id", user.id)
    .single();

  if (error || !profile) {
    console.error("Yearly plan: no readable profile for session", {
      userId: user.id,
      code: error?.code,
      message: error?.message,
    });
    return {
      error: NextResponse.json(
        { error: "No profile is visible for this session" },
        { status: 403 }
      ),
    };
  }

  return { id: profile.id, role: profile.role, school_id: profile.school_id };
}

/** Writes are teacher/admin only. Parents read and acknowledge; students read. */
export async function requireTeacher(supabase: Db): Promise<Caller | CallerFailure> {
  const caller = await requireCaller(supabase);
  if (isFailure(caller)) return caller;
  if (caller.role !== "teacher" && caller.role !== "admin") {
    return {
      error: NextResponse.json(
        { error: "Only a teacher or admin can change a yearly plan" },
        { status: 403 }
      ),
    };
  }
  if (!caller.school_id) {
    return {
      error: NextResponse.json(
        { error: "This account is not attached to a school" },
        { status: 403 }
      ),
    };
  }
  return caller;
}

/**
 * Refuses every request when the key is missing, rather than letting the
 * module half-work. Without it, reads would return rows whose content is
 * all null and writes would throw deep inside encryptField with a stack
 * trace instead of an explanation.
 */
export function requireEncryption(): NextResponse | null {
  if (isEncryptionConfigured()) return null;
  return NextResponse.json(
    {
      error:
        "Yearly plans are unavailable: PLAN_ENCRYPTION_KEY is not configured on the server. " +
        "Plan content is encrypted before storage, so the module stays off until a key is set.",
      code: "encryption_not_configured",
    },
    { status: 503 }
  );
}

/* ── Row ↔ domain mapping ──────────────────────────────────────────────
   The _enc columns are opened here and nowhere else, so there is exactly
   one place to look when asking what is encrypted and what is not. */

export const PLANS = "yearly_plans";
export const MILESTONES = "yearly_plan_milestones";
export const PROGRESS = "yearly_plan_progress";
export const ALERTS = "yearly_plan_alerts";

export function newId(): string {
  // Generated here rather than defaulted by Postgres because every
  // encrypted field is sealed against its own row id — the id has to exist
  // before the ciphertext can be made.
  return randomUUID();
}

/** Nullable integer out of a row, without turning a real 0 into null or a
 *  missing column into NaN. */
function num(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function decodePlan(row: Record<string, unknown>): Plan {
  const id = row.id as string;
  return {
    id,
    student_id: row.student_id as string,
    academic_year: row.academic_year as string,
    starts_on: row.starts_on as string,
    ends_on: row.ends_on as string,
    unit: row.unit as Plan["unit"],
    status: row.status as Plan["status"],
    title: decryptField(row.title_enc as string | null, fieldContext(PLANS, id, "title_enc")),
    notes: decryptField(row.notes_enc as string | null, fieldContext(PLANS, id, "notes_enc")),
    start_surah: num(row.start_surah),
    start_ayah: num(row.start_ayah),
    direction: (row.direction as Plan["direction"]) ?? null,
    daily_new_amount: num(row.daily_new_amount),
    daily_review_amount: num(row.daily_review_amount),
    daily_review_unit: (row.daily_review_unit as Plan["daily_review_unit"]) ?? null,
  };
}

export function decodeMilestone(row: Record<string, unknown>): Milestone {
  const id = row.id as string;
  return {
    id,
    sequence: row.sequence as number,
    starts_on: row.starts_on as string,
    due_on: row.due_on as string,
    // Coerced rather than cast: these are numeric(8,2) columns, and a
    // Postgres driver is free to hand a numeric back as a string to avoid
    // float loss. A silent string here would turn every sum in the pace
    // maths into concatenation — "40" + "12" = "4012" ahead of schedule.
    target_units: Number(row.target_units ?? 0),
    completed_units: Number(row.completed_units ?? 0),
    status: row.status as Milestone["status"],
    completed_on: (row.completed_on as string | null) ?? null,
    title: decryptField(row.title_enc as string | null, fieldContext(MILESTONES, id, "title_enc")),
    description: decryptField(
      row.description_enc as string | null,
      fieldContext(MILESTONES, id, "description_enc")
    ),
    from_surah: num(row.from_surah),
    from_ayah: num(row.from_ayah),
    to_surah: num(row.to_surah),
    to_ayah: num(row.to_ayah),
  };
}

export function decodeProgress(row: Record<string, unknown>): ProgressEntry {
  const id = row.id as string;
  return {
    id,
    milestone_id: row.milestone_id as string,
    recorded_on: row.recorded_on as string,
    units_after: Number(row.units_after ?? 0),
    note: decryptField(row.note_enc as string | null, fieldContext(PROGRESS, id, "note_enc")),
  };
}

export interface StoredAlert extends PlanAlert {
  id: string;
  triggered_on: string;
  acknowledged_at: string | null;
}

export function decodeAlert(row: Record<string, unknown>): StoredAlert {
  const id = row.id as string;
  const detail = decryptField(
    row.detail_enc as string | null,
    fieldContext(ALERTS, id, "detail_enc")
  );
  const code = row.code as PlanAlert["code"];
  return {
    id,
    code,
    level: row.level as PlanAlert["level"],
    title: ALERT_TITLES[code] ?? code,
    detail: detail ?? "",
    triggered_on: row.triggered_on as string,
    acknowledged_at: (row.acknowledged_at as string | null) ?? null,
  };
}

/** Titles are re-derived from the code rather than stored: they carry no
 *  child-specific detail, so encrypting and persisting them would be cost
 *  without benefit — and a reworded title then applies retroactively. */
const ALERT_TITLES: Record<PlanAlert["code"], string> = {
  behind_schedule: "Behind schedule",
  milestone_overdue: "A milestone has passed its date",
  no_recent_progress: "No progress recorded recently",
  ending_incomplete: "On course to finish short",
};

/* ── Validation ──────────────────────────────────────────────────────── */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const UNITS = ["ayah", "page", "line", "surah", "juz", "lesson"] as const;
export const PLAN_STATUSES = ["draft", "active", "completed", "archived"] as const;
export const MILESTONE_STATUSES = ["pending", "in_progress", "completed", "missed"] as const;

export function badDate(value: unknown, label: string): string | null {
  if (typeof value !== "string" || !ISO_DATE.test(value)) {
    return `${label} must be a date in YYYY-MM-DD form`;
  }
  // Catches 2026-02-31, which matches the pattern but is not a day.
  const [y, m, d] = value.split("-").map(Number);
  const probe = new Date(Date.UTC(y, m - 1, d, 12));
  if (
    probe.getUTCFullYear() !== y ||
    probe.getUTCMonth() !== m - 1 ||
    probe.getUTCDate() !== d
  ) {
    return `${label} is not a real date`;
  }
  return null;
}

/** Free text is length-capped before encryption: an unbounded field would
 *  otherwise let one note become a multi-megabyte ciphertext column that
 *  every read of the plan then pays for. */
export const MAX_TITLE = 200;
export const MAX_TEXT = 4000;

export function badText(value: unknown, label: string, max: number): string | null {
  if (value == null) return null;
  if (typeof value !== "string") return `${label} must be text`;
  if (value.length > max) return `${label} is too long (max ${max} characters)`;
  return null;
}

export function badInt(value: unknown, label: string, min = 0, max = 100_000): string | null {
  if (value == null) return null;
  if (typeof value !== "number" || !Number.isInteger(value)) {
    return `${label} must be a whole number`;
  }
  if (value < min || value > max) return `${label} must be between ${min} and ${max}`;
  return null;
}

/**
 * A unit quantity. Fractional on purpose — five juz across ten months is
 * half a juz a month, and a whole-number-only target cannot express that
 * without dumping the remainder into the first few segments.
 *
 * Capped at two decimals to match the numeric(8,2) columns: a value with
 * more would be silently rounded by Postgres, so the figure the teacher
 * typed and the figure stored would differ with nothing saying so.
 */
export function badQuantity(value: unknown, label: string, min = 0, max = 100_000): string | null {
  if (value == null) return null;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return `${label} must be a number`;
  }
  if (value < min || value > max) return `${label} must be between ${min} and ${max}`;
  if (Math.round(value * 100) / 100 !== value) {
    return `${label} can have at most two decimal places`;
  }
  return null;
}

/**
 * A surah/ayah pair, checked against the real mushaf rather than against
 * a range: "Al-Mulk 45" passes a `between 1 and 300` test and is still
 * four ayahs past the end of the surah.
 */
export function badPosition(
  surah: unknown,
  ayah: unknown,
  label: string
): string | null {
  if (surah == null && ayah == null) return null;
  if (typeof surah !== "number" || !Number.isInteger(surah)) {
    return `${label} surah must be a whole number`;
  }
  const meta = getSurahById(surah);
  if (!meta) return `${label} surah must be between 1 and 114`;
  if (typeof ayah !== "number" || !Number.isInteger(ayah) || ayah < 1) {
    return `${label} ayah must be a whole number of at least 1`;
  }
  if (ayah > meta.ayahs) {
    return `${label} ayah ${ayah} is past the end of ${meta.englishName}, which has ${meta.ayahs}`;
  }
  return null;
}

export const DIRECTIONS = ["forward", "hifz"] as const;

/* ── Loading a whole plan ────────────────────────────────────────────── */

export interface LoadedPlan {
  plan: Plan;
  milestones: Milestone[];
  entries: ProgressEntry[];
}

/**
 * Reads one plan with everything hanging off it. Returns null when the
 * plan does not exist *or* the caller cannot see it — the two are
 * deliberately not distinguished here. Telling a parent "that plan exists
 * but is not yours" confirms another family's child has a plan; the route
 * turns both into the same 404.
 */
export async function loadPlan(supabase: Db, planId: string): Promise<LoadedPlan | null> {
  const { data: planRow, error: planError } = await supabase
    .from(PLANS)
    .select("*")
    .eq("id", planId)
    .maybeSingle();
  if (planError) throw planError;
  if (!planRow) return null;

  const [{ data: msRows, error: msError }, { data: prRows, error: prError }] = await Promise.all([
    supabase.from(MILESTONES).select("*").eq("plan_id", planId).order("sequence"),
    supabase.from(PROGRESS).select("*").eq("plan_id", planId).order("recorded_on"),
  ]);
  if (msError) throw msError;
  if (prError) throw prError;

  return {
    plan: decodePlan(planRow),
    milestones: (msRows ?? []).map(decodeMilestone),
    entries: (prRows ?? []).map(decodeProgress),
  };
}

/* ── Calendar loading ─────────────────────────────────────────────────── */

/**
 * The school's own calendar, for a route that has to walk a daily
 * schedule itself rather than just display one a browser already fetched
 * from /api/school-calendar. Falls back to the plain five-day week — the
 * same default every other caller uses for a school with none set up —
 * rather than failing the whole request over it.
 */
export async function loadCalendarForSchool(supabase: Db, schoolId: string): Promise<SchoolCalendar> {
  try {
    const [{ data: school }, { data: days }] = await Promise.all([
      supabase.from("schools").select("instructional_weekdays").eq("id", schoolId).maybeSingle(),
      supabase.from("school_calendar_days").select("date").eq("school_id", schoolId),
    ]);
    const weekdays = (school?.instructional_weekdays as number[] | null) ?? DEFAULT_CALENDAR.weekdays;
    return buildCalendar(weekdays, (days ?? []).map((d) => d.date as string));
  } catch (error) {
    console.error("Yearly plan: could not load the school calendar, using the default", error);
    return DEFAULT_CALENDAR;
  }
}

/**
 * True when one milestone doesn't pick up exactly where the one before it
 * left off — a daily-rate plan's own weekly buckets are built by grouping
 * a single continuous walk through the mushaf, so consecutive milestones
 * are never supposed to skip or repeat an ayah, whatever gap in *dates*
 * a weekend or holiday between them creates. A teacher deleting one
 * milestone by hand (there being nothing else that could do it) leaves
 * exactly this kind of hole without moving either of its neighbours'
 * own dates out of the plan's overall range, which is why this needs its
 * own check rather than folding into the start/end one below.
 */
function hasMilestoneGap(direction: Plan["direction"], milestones: Milestone[]): boolean {
  for (let i = 0; i < milestones.length - 1; i++) {
    const a = milestones[i];
    const b = milestones[i + 1];
    if (a.to_surah == null || a.to_ayah == null || b.from_surah == null || b.from_ayah == null) continue;
    const expected = nextPosition({ surah: a.to_surah, ayah: a.to_ayah }, direction!);
    if (!expected || expected.surah !== b.from_surah || expected.ayah !== b.from_ayah) return true;
  }
  return false;
}

/**
 * Rebuilds a daily-rate plan's stored milestones from its own current
 * fields when they no longer match. The weekly checklist a teacher sees is
 * a mechanical readout of starts_on/ends_on/daily_new_amount — nothing
 * else — so a plan whose dates were edited after its milestones were first
 * generated is left holding rows from a schedule that no longer exists: a
 * milestone dated before the plan's own start, permanently "past due" no
 * matter what today is. The same rebuild also catches a milestone deleted
 * by hand, which leaves a hole in the mushaf coverage without necessarily
 * moving either boundary — see hasMilestoneGap.
 *
 * Only for a plan anchored to the mushaf with a daily rate set — the one
 * kind whose milestones are fully derivable from the plan row alone. Never
 * touches a plan with anything recorded against it (a completed_units
 * above zero, or a progress entry): that means the schedule has already
 * been acted on, and silently rebuilding it would erase that history —
 * the teacher deletes and recreates the plan instead, the same as for any
 * other change too large to apply automatically.
 *
 * Called from both a read (self-healing a plan whose dates were edited
 * before this existed) and a write (keeping one edited from here on from
 * ever going stale) — the same "reconcile on read" shape as refreshAlerts,
 * and safe for the same reason: staleness is judged from rows the caller's
 * own RLS-scoped session already fetched, not from unchecked input.
 */
export async function resyncDailyRateMilestones(
  supabase: Db,
  plan: Plan,
  schoolId: string,
  milestones: Milestone[],
  entries: ProgressEntry[]
): Promise<Milestone[]> {
  if (plan.start_surah == null || plan.start_ayah == null || plan.direction == null) return milestones;
  if (plan.daily_new_amount == null || plan.daily_new_amount <= 0) return milestones;

  const first = milestones[0];
  const last = milestones[milestones.length - 1];
  const stale =
    !first ||
    !last ||
    first.starts_on < plan.starts_on ||
    last.due_on > plan.ends_on ||
    hasMilestoneGap(plan.direction, milestones);
  if (!stale) return milestones;

  const hasProgress = milestones.some((m) => m.completed_units > 0) || entries.length > 0;
  if (hasProgress) return milestones;

  try {
    const cal = await loadCalendarForSchool(supabase, schoolId);
    const segs = weeklyMilestonesFromDailyRate(
      { surah: plan.start_surah, ayah: plan.start_ayah },
      plan.direction,
      plan.unit,
      plan.daily_new_amount,
      plan.starts_on,
      plan.ends_on,
      cal
    );

    const { error: delError } = await supabase.from(MILESTONES).delete().eq("plan_id", plan.id);
    if (delError) throw delError;
    if (segs.length === 0) return [];

    const rows = segs.map((s, i) => ({
      id: newId(),
      plan_id: plan.id,
      sequence: i + 1,
      starts_on: s.starts_on,
      due_on: s.due_on,
      target_units: s.target_units,
      from_surah: s.from_surah,
      from_ayah: s.from_ayah,
      to_surah: s.to_surah,
      to_ayah: s.to_ayah,
    }));
    const { error: insError } = await supabase.from(MILESTONES).insert(rows);
    if (insError) throw insError;

    return rows.map((r): Milestone => ({
      id: r.id,
      sequence: r.sequence,
      starts_on: r.starts_on,
      due_on: r.due_on,
      target_units: r.target_units,
      completed_units: 0,
      status: "pending",
      completed_on: null,
      title: null,
      description: null,
      from_surah: r.from_surah,
      from_ayah: r.from_ayah,
      to_surah: r.to_surah,
      to_ayah: r.to_ayah,
    }));
  } catch (error) {
    console.error("Yearly plan: could not rebuild a stale daily-rate schedule", error);
    return milestones;
  }
}

/* ── Alert reconciliation ────────────────────────────────────────────── */

/**
 * Brings the stored alerts in line with what is true today: raises the ones
 * that have started applying, refreshes the wording on ones already open,
 * and resolves the ones that have cleared.
 *
 * Run on every read of a plan rather than from a nightly job. At this
 * scale — a few hundred plans, each read when someone opens its page — a
 * scheduled sweep would buy nothing except a window in which a parent sees
 * a banner that stopped being true yesterday. A school large enough to
 * want the sweep can call this from a cron route over active plans; the
 * function does not care who invokes it.
 *
 * Never throws into the caller's response. A plan that displays correctly
 * but failed to persist its alerts is a far better outcome than a page
 * that 500s because one alert row could not be written.
 */
export async function syncPlanAlerts(
  _caller: Db,
  planId: string,
  studentId: string,
  schoolId: string,
  current: PlanAlert[],
  today: string = todayISO()
): Promise<StoredAlert[]> {
  // The sweep writes as the service role rather than as whoever happened
  // to open the page, because raising an alert is a system action, not a
  // user action.
  //
  // Parents have no insert policy on yearly_plan_alerts and must not be
  // given one — that would let a family write alerts into their own
  // child's record. But a parent is usually the one who opens the page
  // first, and without this the very alert they came to see fails to
  // persist: the banner shows from the in-memory fallback, cannot be
  // dismissed because there is no row behind it, and never reaches the
  // teacher's side at all.
  //
  // Safe because nothing here is user input. planId, studentId and
  // schoolId are read off the plan row the caller already fetched through
  // their own RLS-scoped session — access is proven before this runs —
  // and the alert text is computed from that same row.
  const supabase = createAdminClient() as unknown as Db;
  try {
    const { data: openRows, error } = await supabase
      .from(ALERTS)
      .select("*")
      .eq("plan_id", planId)
      .is("resolved_on", null);
    if (error) throw error;

    const open = (openRows ?? []) as Record<string, unknown>[];
    const openByCode = new Map(open.map((r) => [r.code as string, r]));
    const currentByCode = new Map(current.map((a) => [a.code, a]));
    const result: StoredAlert[] = [];

    for (const alert of current) {
      const existing = openByCode.get(alert.code);
      if (existing) {
        // Same alert, re-worded: the shortfall figure in the detail moves
        // every time a teacher records a session, and a parent reading a
        // stale number would be worse than no number.
        const id = existing.id as string;
        const detail_enc = encryptField(alert.detail, fieldContext(ALERTS, id, "detail_enc"));
        const { error: upError } = await supabase
          .from(ALERTS)
          .update({ detail_enc, level: alert.level })
          .eq("id", id);
        if (upError) throw upError;
        result.push({
          ...alert,
          id,
          triggered_on: existing.triggered_on as string,
          acknowledged_at: (existing.acknowledged_at as string | null) ?? null,
        });
        continue;
      }

      const id = newId();
      const row = {
        id,
        plan_id: planId,
        student_id: studentId,
        school_id: schoolId,
        code: alert.code,
        level: alert.level,
        triggered_on: today,
        detail_enc: encryptField(alert.detail, fieldContext(ALERTS, id, "detail_enc")),
      };
      const { error: insError } = await supabase.from(ALERTS).insert(row);
      if (insError) {
        // The unique constraint firing means a row for this plan/code/day
        // already exists — two tabs opened the page at once. Not an error
        // worth surfacing; the alert is shown from the in-memory copy.
        if (insError.code !== "23505") throw insError;
      }
      result.push({ ...alert, id, triggered_on: today, acknowledged_at: null });
    }

    // Anything open that is no longer true has cleared. Resolved rather
    // than deleted so "behind from November to February" stays on record.
    const stale = open.filter((r) => !currentByCode.has(r.code as PlanAlert["code"]));
    if (stale.length > 0) {
      const { error: resolveError } = await supabase
        .from(ALERTS)
        .update({ resolved_on: today })
        .in(
          "id",
          stale.map((r) => r.id as string)
        );
      if (resolveError) throw resolveError;
    }

    return result;
  } catch (error) {
    console.error("Yearly plan: could not sync alerts", error);
    // Fall back to the computed alerts with synthetic ids so the page still
    // renders the banner. They cannot be acknowledged (no row to write to),
    // which is the right degradation: showing a warning that cannot be
    // dismissed beats hiding one that applies.
    return current.map((a) => ({
      ...a,
      id: `unsaved:${a.code}`,
      triggered_on: today,
      acknowledged_at: null,
    }));
  }
}

/** Computes and reconciles in one step — what every read path wants. */
export async function refreshAlerts(
  supabase: Db,
  loaded: LoadedPlan,
  schoolId: string,
  today: string = todayISO()
): Promise<StoredAlert[]> {
  const current = evaluateAlerts(loaded.plan, loaded.milestones, loaded.entries, today);
  return syncPlanAlerts(
    supabase,
    loaded.plan.id,
    loaded.plan.student_id,
    schoolId,
    current,
    today
  );
}

/** Encrypt-on-write for the plan's own text fields. */
export function planTextColumns(id: string, title?: unknown, notes?: unknown) {
  const out: Record<string, string | null> = {};
  if (title !== undefined) {
    out.title_enc = encryptField(title as string | null, fieldContext(PLANS, id, "title_enc"));
  }
  if (notes !== undefined) {
    out.notes_enc = encryptField(notes as string | null, fieldContext(PLANS, id, "notes_enc"));
  }
  return out;
}

/** Encrypt-on-write for a milestone's text fields. */
export function milestoneTextColumns(id: string, title?: unknown, description?: unknown) {
  const out: Record<string, string | null> = {};
  if (title !== undefined) {
    out.title_enc = encryptField(title as string | null, fieldContext(MILESTONES, id, "title_enc"));
  }
  if (description !== undefined) {
    out.description_enc = encryptField(
      description as string | null,
      fieldContext(MILESTONES, id, "description_enc")
    );
  }
  return out;
}

/** Shared error shape, so one bad column name doesn't 500 with a Postgres
 *  message a school admin then pastes into a support email. */
export function routeError(context: string, error: unknown): NextResponse {
  console.error(`Yearly plan: ${context}`, error);
  // Supabase hands back a plain PostgrestError object, not an Error
  // instance — `error instanceof Error` is false for every database
  // failure that reaches here. Reading .message off the object as well is
  // what lets the constraint mapping below actually fire; without it every
  // violation collapsed to "[object Object]" and came back as a 500.
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error !== null && typeof (error as { message?: unknown }).message === "string"
        ? (error as { message: string }).message
        : String(error);
  // Postgres constraint violations are the one class worth passing through:
  // they name a rule the user broke, and the form can act on them.
  const friendly =
    /yearly_plans_one_per_year/.test(message)
      ? "This student already has a plan for that academic year."
      : /yearly_plan_milestones_seq_unique/.test(message)
        ? "Two milestones were given the same position in the plan."
        : /yearly_plans_dates_ordered/.test(message)
          ? "The plan's end date must come after its start date."
          : /yearly_plan_milestones_dates_ordered/.test(message)
            ? "A milestone's due date must not come before the date it starts."
            : null;
  return NextResponse.json({ error: friendly ?? `Could not ${context}` }, { status: friendly ? 400 : 500 });
}
