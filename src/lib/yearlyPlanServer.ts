import "server-only";

import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
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
  };
}

export function decodeMilestone(row: Record<string, unknown>): Milestone {
  const id = row.id as string;
  return {
    id,
    sequence: row.sequence as number,
    starts_on: row.starts_on as string,
    due_on: row.due_on as string,
    target_units: row.target_units as number,
    completed_units: row.completed_units as number,
    status: row.status as Milestone["status"],
    completed_on: (row.completed_on as string | null) ?? null,
    title: decryptField(row.title_enc as string | null, fieldContext(MILESTONES, id, "title_enc")),
    description: decryptField(
      row.description_enc as string | null,
      fieldContext(MILESTONES, id, "description_enc")
    ),
  };
}

export function decodeProgress(row: Record<string, unknown>): ProgressEntry {
  const id = row.id as string;
  return {
    id,
    milestone_id: row.milestone_id as string,
    recorded_on: row.recorded_on as string,
    units_after: row.units_after as number,
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
  supabase: Db,
  planId: string,
  studentId: string,
  schoolId: string,
  current: PlanAlert[],
  today: string = todayISO()
): Promise<StoredAlert[]> {
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
