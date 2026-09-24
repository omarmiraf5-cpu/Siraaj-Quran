import { DEMO_TODAY } from "@/data/demo";
import { readDemoStore, writeDemoStore } from "@/lib/demoStore";
import {
  computePlanProgress,
  evaluateAlerts,
  type Milestone,
  type PaceStatus,
  type Plan,
  type PlanAlert,
  type PlanUnit,
  type ProgressEntry,
} from "@/lib/yearlyPlan";
import {
  dailyPaceOf,
  formatRange,
  surahName,
  weeklyMilestonesFromDailyRate,
  type Direction,
} from "@/lib/mushafPlan";
import { DEFAULT_CALENDAR } from "@/lib/schoolCalendar";
import {
  canRebuildMilestones,
  creditForLesson,
  planLessons,
  sameSchedule,
  statusForRating,
  type AheadLesson,
} from "@/lib/planLessons";
import type { DailyRating, QuranicAssignment } from "@/hooks/useQuranicAssignments";

/**
 * Yearly plans for the sample portal.
 *
 * The live site keeps plans encrypted in Supabase behind /api/yearly-plans,
 * which the sample portal has no database or key for — so until now its
 * Yearly Plan pages just said "sign in". This stands in for those routes
 * inside the browser: the same request and response shapes, answered from
 * localStorage, so the pages run their ordinary code unchanged and only
 * swap which `fetch` they call. The rules — schedules, the surah-test gate,
 * graded lessons counting toward the plan, pace and alerts — are the shared
 * ones in planLessons.ts, mushafPlan.ts and yearlyPlan.ts, so the sample
 * behaves exactly like the real thing.
 *
 * Everything is dated on the sample portal's own fixed "today", the same
 * one every other sample screen uses, so the plans agree with the rest of
 * the demo about what day it is.
 */

const KEY = "demo_yearly_plans_v1";
const CAL = DEFAULT_CALENDAR;
export const DEMO_PLAN_TODAY = DEMO_TODAY;

type DemoLesson = QuranicAssignment & { source: "auto" };

interface Store {
  plans: Plan[];
  milestones: Record<string, Milestone[]>;
  entries: Record<string, ProgressEntry[]>;
  /** Acknowledged alerts, by alert id, with when. */
  acknowledged: Record<string, string>;
  /** Surahs confirmed as tested, by student. */
  confirmations: Record<string, number[]>;
  /** Lessons the plans wrote, as they appear on the Assignments page. */
  lessons: DemoLesson[];
}

let counter = 0;
const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(counter++).toString(36)}`;

/* ── Store ─────────────────────────────────────────────────────────── */

function load(): Store {
  const stored = readDemoStore<Store | null>(KEY, null);
  if (stored && Array.isArray(stored.plans)) return stored;
  const fresh = seed();
  save(fresh);
  return fresh;
}

function save(store: Store): void {
  writeDemoStore(KEY, store);
}

function milestonesFrom(plan: Plan): Milestone[] {
  if (plan.start_surah == null || plan.start_ayah == null || plan.direction == null) return [];
  if (!plan.daily_new_amount) return [];
  return weeklyMilestonesFromDailyRate(
    { surah: plan.start_surah, ayah: plan.start_ayah },
    plan.direction,
    plan.unit,
    plan.daily_new_amount,
    plan.starts_on,
    plan.ends_on,
    CAL
  ).map((s, i) => ({
    id: newId("ms"),
    sequence: i + 1,
    starts_on: s.starts_on,
    due_on: s.due_on,
    target_units: s.target_units,
    completed_units: 0,
    status: "pending",
    completed_on: null,
    title: null,
    description: null,
    from_surah: s.from_surah,
    from_ayah: s.from_ayah,
    to_surah: s.to_surah,
    to_ayah: s.to_ayah,
  }));
}

/* ── The sample school's plans ─────────────────────────────────────────
   Two students, chosen to show both sides of the feature: Amina ahead of
   her plan and just finished with Al-Mulk, so the "test the whole surah"
   prompt is waiting; Yusuf slipping behind on his, so the red warning is
   up. Both started recently, so the Assignments page shows a few days of
   plan lessons rather than months of them. */

function seed(): Store {
  const store: Store = { plans: [], milestones: {}, entries: {}, acknowledged: {}, confirmations: {}, lessons: [] };

  const plan = (p: Partial<Plan> & Pick<Plan, "id" | "student_id" | "starts_on" | "start_surah" | "start_ayah" | "direction">): Plan => ({
    academic_year: "2026-2027",
    ends_on: "2027-06-25",
    unit: "page",
    status: "active",
    title: null,
    notes: null,
    daily_new_amount: 1,
    daily_review_amount: null,
    daily_review_unit: null,
    ...p,
  });

  const amina = plan({
    id: "demo-plan-s1",
    student_id: "s1",
    title: "Juz Tabarak, a page a day",
    starts_on: "2026-08-10",
    start_surah: 67,
    start_ayah: 1,
    direction: "hifz",
    daily_review_amount: 5,
    daily_review_unit: "page",
  });
  const yusuf = plan({
    id: "demo-plan-s4",
    student_id: "s4",
    title: "The end of Al-Baqarah",
    starts_on: "2026-08-05",
    start_surah: 2,
    start_ayah: 253,
    direction: "forward",
    daily_review_amount: 1,
    daily_review_unit: "juz",
  });

  for (const p of [amina, yusuf]) {
    store.plans.push(p);
    store.milestones[p.id] = milestonesFrom(p);
    store.entries[p.id] = [];
    sync(store, p.student_id);
  }

  // A week of grading, as a teacher would have left it.
  const grades: Array<[string, string, DailyRating, string | null]> = [
    ["s1", "2026-08-10", "excellent", "A beautiful start to Al-Mulk."],
    ["s1", "2026-08-11", "good", null],
    ["s1", "2026-08-12", "very_good", "Finished Al-Mulk — ready to be tested on the whole surah."],
    ["s4", "2026-08-05", "good", "Ayat al-Kursi held well."],
    ["s4", "2026-08-06", "weak", "Needs another go — the endings are running together."],
    ["s4", "2026-08-10", "good", null],
    ["s4", "2026-08-11", "weak", "Revise before moving on."],
  ];
  for (const [student, date, rating, note] of grades) {
    const lesson = store.lessons.find((l) => l.student_id === student && l.due_date === date);
    if (lesson) grade(store, lesson.id, rating, note, date);
  }
  for (const p of [amina, yusuf]) sync(store, p.student_id);
  return store;
}

/* ── Plan payloads, shaped like GET /api/yearly-plans ──────────────── */

interface DemoAlert extends PlanAlert {
  id: string;
  acknowledged_at: string | null;
}

function alertsFor(store: Store, plan: Plan): DemoAlert[] {
  const current = evaluateAlerts(plan, store.milestones[plan.id] ?? [], store.entries[plan.id] ?? [], DEMO_PLAN_TODAY);
  return current.map((a) => {
    const id = `${plan.id}:${a.code}`;
    return { ...a, id, acknowledged_at: store.acknowledged[id] ?? null };
  });
}

function payloadFor(store: Store, studentId: string, planId?: string | null) {
  const rows = store.plans
    .filter((p) => p.student_id === studentId)
    .sort((a, b) => b.academic_year.localeCompare(a.academic_year));
  if (rows.length === 0) return { plan: null, milestones: [], entries: [], alerts: [] };

  const preferred =
    (planId && rows.find((r) => r.id === planId)) ||
    rows.find((r) => r.status === "active") ||
    rows.find((r) => r.status === "draft") ||
    rows[0];
  const milestones = store.milestones[preferred.id] ?? [];
  const entries = store.entries[preferred.id] ?? [];
  return {
    plan: preferred,
    milestones,
    entries,
    alerts: alertsFor(store, preferred),
    progress: computePlanProgress(preferred, milestones, entries, DEMO_PLAN_TODAY),
    today: DEMO_PLAN_TODAY,
    other_years: rows
      .filter((r) => r.id !== preferred.id)
      .map((r) => ({ id: r.id, academic_year: r.academic_year, status: r.status })),
  };
}

function planById(store: Store, id: string): Plan | undefined {
  return store.plans.find((p) => p.id === id);
}

/** Rebuilds a daily-rate plan's milestones after an edit, on the same
 *  terms the live site does. */
function resync(store: Store, plan: Plan): void {
  const current = store.milestones[plan.id] ?? [];
  if (plan.start_surah == null || plan.start_ayah == null || plan.direction == null) return;
  if (!plan.daily_new_amount) return;
  if (!canRebuildMilestones(current, store.entries[plan.id] ?? [])) return;
  const expected = weeklyMilestonesFromDailyRate(
    { surah: plan.start_surah, ayah: plan.start_ayah },
    plan.direction,
    plan.unit,
    plan.daily_new_amount,
    plan.starts_on,
    plan.ends_on,
    CAL
  );
  if (!sameSchedule(current, expected)) store.milestones[plan.id] = milestonesFrom(plan);
}

/* ── A stand-in for fetch ──────────────────────────────────────────── */

const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const fail = (error: string, status = 400) => reply({ error }, status);

/**
 * Answers the yearly-plan routes the way the live server does, from the
 * sample school's plans. Anything it does not recognise is a 404, so a
 * page calling a route this does not cover fails visibly rather than
 * reaching the real server with no session.
 */
export async function demoPlanFetch(input: string, init?: RequestInit): Promise<Response> {
  const url = new URL(input, "http://demo.local");
  const method = (init?.method ?? "GET").toUpperCase();
  const body = init?.body ? JSON.parse(String(init.body)) : {};
  const store = load();

  switch (`${method} ${url.pathname}`) {
    case "GET /api/yearly-plans": {
      const studentId = url.searchParams.get("student_id");
      if (!studentId) return fail("student_id is required");
      return reply(payloadFor(store, studentId, url.searchParams.get("plan_id")));
    }

    case "POST /api/yearly-plans": {
      if (!body.student_id || !body.academic_year || !body.starts_on || !body.ends_on) {
        return fail("Student, year and dates are required");
      }
      if (store.plans.some((p) => p.student_id === body.student_id && p.academic_year === body.academic_year)) {
        return fail("This student already has a plan for that year", 409);
      }
      const plan: Plan = {
        id: newId("demo-plan"),
        student_id: body.student_id,
        academic_year: body.academic_year,
        starts_on: body.starts_on,
        ends_on: body.ends_on,
        unit: (body.unit ?? "page") as PlanUnit,
        status: body.status ?? "active",
        title: body.title ?? null,
        notes: body.notes ?? null,
        start_surah: body.start_surah ?? null,
        start_ayah: body.start_ayah ?? null,
        direction: (body.direction ?? null) as Direction | null,
        daily_new_amount: body.daily_new_amount ?? null,
        daily_review_amount: body.daily_review_amount ?? null,
        daily_review_unit: body.daily_review_unit ?? null,
      };
      store.plans.push(plan);
      store.milestones[plan.id] = ((body.milestones ?? []) as Array<Partial<Milestone>>).map((m, i) => ({
        id: newId("ms"),
        sequence: i + 1,
        starts_on: m.starts_on ?? plan.starts_on,
        due_on: m.due_on ?? plan.ends_on,
        target_units: Number(m.target_units ?? 0),
        completed_units: 0,
        status: "pending",
        completed_on: null,
        title: m.title ?? null,
        description: m.description ?? null,
        from_surah: m.from_surah ?? null,
        from_ayah: m.from_ayah ?? null,
        to_surah: m.to_surah ?? null,
        to_ayah: m.to_ayah ?? null,
      }));
      store.entries[plan.id] = [];
      save(store);
      return reply(payloadFor(store, plan.student_id, plan.id), 201);
    }

    case "PATCH /api/yearly-plans": {
      const plan = planById(store, body.id);
      if (!plan) return fail("No such plan", 404);
      for (const k of [
        "title", "notes", "status", "starts_on", "ends_on", "unit", "academic_year",
        "daily_new_amount", "daily_review_amount", "daily_review_unit",
      ] as const) {
        if (body[k] !== undefined) (plan as unknown as Record<string, unknown>)[k] = body[k];
      }
      resync(store, plan);
      save(store);
      return reply(payloadFor(store, plan.student_id, plan.id));
    }

    case "DELETE /api/yearly-plans": {
      const id = url.searchParams.get("id") ?? "";
      if (!planById(store, id)) return fail("No such plan", 404);
      store.plans = store.plans.filter((p) => p.id !== id);
      delete store.milestones[id];
      delete store.entries[id];
      save(store);
      return reply({ ok: true });
    }

    case "POST /api/yearly-plans/milestones": {
      const plan = planById(store, body.plan_id);
      if (!plan) return fail("No such plan", 404);
      const list = store.milestones[plan.id] ?? [];
      list.push({
        id: newId("ms"),
        sequence: list.length + 1,
        starts_on: body.starts_on ?? plan.starts_on,
        due_on: body.due_on ?? plan.ends_on,
        target_units: Number(body.target_units ?? 0),
        completed_units: 0,
        status: "pending",
        completed_on: null,
        title: body.title ?? null,
        description: body.description ?? null,
        from_surah: null,
        from_ayah: null,
        to_surah: null,
        to_ayah: null,
      });
      store.milestones[plan.id] = list;
      save(store);
      return reply(payloadFor(store, plan.student_id, plan.id), 201);
    }

    case "POST /api/yearly-plans/progress": {
      const plan = store.plans.find((p) => (store.milestones[p.id] ?? []).some((m) => m.id === body.milestone_id));
      if (!plan) return fail("No such milestone", 404);
      const milestone = store.milestones[plan.id].find((m) => m.id === body.milestone_id)!;
      const unitsAfter = Number(body.units_after ?? 0);
      const complete = milestone.target_units > 0 && unitsAfter >= milestone.target_units;
      store.entries[plan.id].push({
        id: newId("pe"),
        milestone_id: milestone.id,
        recorded_on: DEMO_PLAN_TODAY,
        units_after: unitsAfter,
        note: body.note ?? null,
      });
      milestone.completed_units = unitsAfter;
      milestone.status = complete ? "completed" : unitsAfter > 0 ? "in_progress" : "pending";
      milestone.completed_on = complete ? DEMO_PLAN_TODAY : null;
      save(store);
      return reply(payloadFor(store, plan.student_id, plan.id), 201);
    }

    case "PATCH /api/yearly-plans/alerts": {
      const at = new Date().toISOString();
      store.acknowledged[String(body.id)] = at;
      save(store);
      return reply({ id: body.id, acknowledged_at: at });
    }

    case "GET /api/school-calendar":
      return reply({ weekdays: CAL.weekdays, closedDates: [] });

    case "GET /api/quran-position":
      return reply({ position: null, direction: null, source: "none", lessons: 0 });

    case "PATCH /api/quran-position":
      return reply({ ok: true });

    default:
      return fail(`The sample portal has no ${method} ${url.pathname}`, 404);
  }
}

/* ── The Assignments page ──────────────────────────────────────────── */

export interface DemoPlanSummary {
  plan_id: string;
  pace: PaceStatus;
  alerts: PlanAlert[];
  inserted: number;
  pending_confirmation: { surah: number; surah_name: string } | null;
}

/** Writes any plan lessons due for one student, the way the live site's
 *  syncAutoAssignments does, and reports the same summary it returns. */
function sync(store: Store, studentId: string): DemoPlanSummary | null {
  const plan = store.plans
    .filter((p) => p.student_id === studentId && p.status === "active")
    .sort((a, b) => b.academic_year.localeCompare(a.academic_year))[0];
  if (!plan) return null;

  const milestones = store.milestones[plan.id] ?? [];
  const entries = store.entries[plan.id] ?? [];
  const progress = computePlanProgress(plan, milestones, entries, DEMO_PLAN_TODAY);
  const summary: DemoPlanSummary = {
    plan_id: plan.id,
    pace: progress.pace,
    alerts: evaluateAlerts(plan, milestones, entries, DEMO_PLAN_TODAY),
    inserted: 0,
    pending_confirmation: null,
  };
  if (plan.start_surah == null || plan.start_ayah == null || plan.direction == null) return summary;
  const dailyAmount = dailyPaceOf(plan, CAL, progress.totalUnits);
  if (dailyAmount == null) return summary;

  const mine = store.lessons.filter((l) => l.student_id === studentId);
  const lastWritten = mine
    .filter((l) => (l.due_date ?? "") <= DEMO_PLAN_TODAY)
    .sort((a, b) => (b.due_date ?? "").localeCompare(a.due_date ?? ""))[0];
  const ahead = mine.filter((l) => (l.due_date ?? "") > DEMO_PLAN_TODAY) as unknown as AheadLesson[];

  const result = planLessons({
    start: { surah: plan.start_surah, ayah: plan.start_ayah },
    direction: plan.direction,
    unit: plan.unit,
    dailyAmount,
    startsOn: plan.starts_on,
    endsOn: plan.ends_on,
    cal: CAL,
    today: DEMO_PLAN_TODAY,
    lastWritten: lastWritten as (typeof lastWritten & { due_date: string }) | undefined,
    ahead,
    confirmed: new Set(store.confirmations[studentId] ?? []),
  });

  if (result.discardAhead) {
    const gone = new Set(ahead.map((l) => l.id));
    store.lessons = store.lessons.filter((l) => !gone.has(l.id));
  }
  if (result.pendingSurah != null) {
    summary.pending_confirmation = { surah: result.pendingSurah, surah_name: surahName(result.pendingSurah) };
  }
  for (const day of result.toWrite) {
    store.lessons.push({
      id: `plan-${studentId}-${day.date}`,
      student_id: studentId,
      teacher_id: "t1",
      surah: day.from.surah,
      ayah_start: day.from.ayah,
      surah_end: day.to.surah,
      ayah_end: day.to.ayah,
      portion: "new",
      assigned_at: DEMO_PLAN_TODAY,
      due_date: day.date,
      status: "assigned",
      memorization_level: 0,
      daily_rating: null,
      teacher_notes: null,
      student_notes: null,
      created_at: `${DEMO_PLAN_TODAY}T08:00:00Z`,
      updated_at: `${DEMO_PLAN_TODAY}T08:00:00Z`,
      source: "auto",
    });
  }
  summary.inserted = result.toWrite.length;
  return summary;
}

/** Rates a plan lesson and carries it through to the plan, the way the
 *  live site's grading route and creditPlanForLesson do together. */
function grade(
  store: Store,
  lessonId: string,
  rating: DailyRating | null,
  notes: string | null,
  on: string = DEMO_PLAN_TODAY
): void {
  const lesson = store.lessons.find((l) => l.id === lessonId);
  if (!lesson) return;
  const wasDone = lesson.status === "completed";
  lesson.daily_rating = rating;
  lesson.teacher_notes = notes;
  lesson.status = statusForRating(rating);
  const isDone = lesson.status === "completed";
  if (wasDone === isDone || !lesson.due_date) return;

  const plan = store.plans.find((p) => p.student_id === lesson.student_id && p.status === "active");
  if (!plan || lesson.due_date < plan.starts_on || lesson.due_date > plan.ends_on) return;
  const milestones = store.milestones[plan.id] ?? [];
  const share = dailyPaceOf(plan, CAL, milestones.reduce((s, m) => s + m.target_units, 0));
  if (share == null) return;
  const credit = creditForLesson(milestones, lesson.due_date, share, isDone);
  if (!credit) return;

  const range = formatRange(
    { surah: lesson.surah, ayah: lesson.ayah_start },
    { surah: lesson.surah_end, ayah: lesson.ayah_end }
  );
  store.entries[plan.id].push({
    id: newId("pe"),
    milestone_id: credit.milestone.id,
    recorded_on: on,
    units_after: credit.unitsAfter,
    note: isDone
      ? `Lesson completed on the Assignments page: ${range}`
      : `Lesson no longer marked completed: ${range}`,
  });
  credit.milestone.completed_units = credit.unitsAfter;
  credit.milestone.status = credit.status;
  credit.milestone.completed_on = credit.complete ? on : null;
}

/** Every student's plan lessons, caught up, with each plan's summary. */
export function demoSyncPlans(): { lessons: QuranicAssignment[]; summaries: Record<string, DemoPlanSummary> } {
  const store = load();
  const summaries: Record<string, DemoPlanSummary> = {};
  for (const studentId of new Set(store.plans.map((p) => p.student_id))) {
    const s = sync(store, studentId);
    if (s) summaries[studentId] = s;
  }
  save(store);
  return { lessons: [...store.lessons], summaries };
}

/** Students whose "new" lesson comes from a plan, so the sample list can
 *  leave out the hand-typed one it would otherwise show for them too. */
export function demoPlanStudents(): Set<string> {
  return new Set(load().plans.filter((p) => p.status === "active").map((p) => p.student_id));
}

export function isDemoPlanLesson(id: string): boolean {
  return id.startsWith("plan-");
}

export function demoGradePlanLesson(lessonId: string, rating: DailyRating | null, notes: string | null): void {
  const store = load();
  grade(store, lessonId, rating, notes);
  save(store);
}

export function demoConfirmSurah(studentId: string, surah: number): void {
  const store = load();
  const list = new Set(store.confirmations[studentId] ?? []);
  list.add(surah);
  store.confirmations[studentId] = [...list];
  save(store);
}
