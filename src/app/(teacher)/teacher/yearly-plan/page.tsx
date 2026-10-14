"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PortalHero } from "@/components/PortalHero";
import { SectionCard, LoadingNote } from "@/components/portal-ui";
import {
  DailyWorkPanel,
  FullYearScheduleModal,
  MilestoneMushafModal,
  MilestoneNavigator,
  MilestoneRow,
  PaceBar,
  PaceChip,
  PaceDial,
  PlanAlertBanner,
  PlanEmptyState,
  PlanFigure,
  paceColor,
} from "@/components/yearly-plan-ui";
import { useSchoolRoster } from "@/hooks/usePortalRoster";
import { DEMO_PLAN_TODAY, demoPlanFetch } from "@/lib/demoPlans";
import { SURAHS, getSurahById } from "@/data/mushaf-index";
import {
  DIRECTION_LABEL,
  firstPosition,
  isValidPosition,
  nextPosition,
  segmentMushaf,
  targetInAyahs,
  ayahsRemaining,
  formatPosition,
  pageLabel,
  impliedDailyRate,
  weeklyMilestonesFromDailyRate,
  type Direction,
} from "@/lib/mushafPlan";
import { buildCalendar, DEFAULT_CALENDAR, type SchoolCalendar } from "@/lib/schoolCalendar";
import {
  addDays,
  formatApprox,
  formatQuantity,
  formatUnits,
  generateMilestoneSkeleton,
  readable,
  unitLabel,
  todayISO,
  type Milestone,
  type PlanUnit,
  type PlanProgress,
 translateAlert } from "@/lib/yearlyPlan";
import { useLanguage } from "@/components/LanguageProvider";
import { phrase } from "@/lib/i18n/phrases";

const PLAN_STATUS_LABEL = { draft: "Draft", active: "Active", completed: "Completed", archived: "Archived" } as const;

/**
 * Teacher side of the yearly plan: build one for a student, break it into
 * milestones, and record progress against them.
 *
 * Everything goes through /api/yearly-plans rather than Supabase directly,
 * which is the one place this page departs from the rest of the teacher
 * portal. Plan content is encrypted at rest, so the browser could fetch
 * the rows but would only ever hold ciphertext — the key is server-side
 * and stays there.
 */

interface PlanDto {
  id: string;
  student_id: string;
  academic_year: string;
  starts_on: string;
  ends_on: string;
  unit: PlanUnit;
  status: "draft" | "active" | "completed" | "archived";
  title: string | null;
  notes: string | null;
  start_surah: number | null;
  start_ayah: number | null;
  direction: Direction | null;
  daily_new_amount: number | null;
  daily_review_amount: number | null;
  daily_review_unit: PlanUnit | null;
}
interface AlertDto {
  id: string;
  code: string;
  level: "info" | "warning" | "critical";
  title: string;
  detail: string;
  acknowledged_at: string | null;
}
interface PlanPayload {
  plan: PlanDto | null;
  milestones: Milestone[];
  entries: Array<{ id: string; milestone_id: string; recorded_on: string; units_after: number; note: string | null }>;
  alerts: AlertDto[];
  progress?: PlanProgress;
  other_years?: Array<{ id: string; academic_year: string; status: PlanDto["status"] }>;
}

const UNITS: PlanUnit[] = ["ayah", "page", "line", "surah", "juz", "lesson"];

/** Quick-pick daily amounts, in whichever unit is chosen — a teacher taps
 *  one instead of typing a number. Only for the units an everyday amount
 *  actually makes sense in; juz/surah/lesson fall back to typing a
 *  number, since "a third of a juz a day" isn't a button anyone taps. */
const QUICK_DAILY_AMOUNTS: Partial<Record<PlanUnit, Array<{ value: number; label: string }>>> = {
  page: [
    { value: 0.25, label: "¼ page" },
    { value: 0.5, label: "½ page" },
    { value: 0.75, label: "¾ page" },
    { value: 1, label: "1 page" },
    { value: 1.5, label: "1½ pages" },
    { value: 2, label: "2 pages" },
  ],
  line: [
    { value: 5, label: "5 lines" },
    { value: 10, label: "10 lines" },
    { value: 15, label: "15 lines" },
  ],
  ayah: [
    { value: 1, label: "1 ayah" },
    { value: 2, label: "2 ayahs" },
    { value: 3, label: "3 ayahs" },
    { value: 5, label: "5 ayahs" },
    { value: 10, label: "10 ayahs" },
  ],
};

/** Review's own quick picks, fixed rather than keyed by the plan's unit:
 *  reviewing old ground moves in much bigger steps than memorising new
 *  ground does, so "1 juz" a day of review is ordinary while "1 juz" of
 *  new memorization never would be. Each button carries its own unit, not
 *  just its own amount, since these mix pages and juz. */
const REVIEW_PRESETS: Array<{ value: number; unit: PlanUnit; label: string }> = [
  { value: 5, unit: "page", label: "5 pages" },
  { value: 10, unit: "page", label: "10 pages" },
  { value: 1, unit: "juz", label: "1 juz" },
  { value: 2, unit: "juz", label: "2 juz" },
  { value: 3, unit: "juz", label: "3 juz" },
];

/** What the create form builds and posts. The mushaf fields are null on a
 *  plain count-only plan, which is why they are declared rather than left
 *  to be narrowed out of a union at each use. */
interface DraftMilestone {
  sequence: number;
  starts_on: string;
  due_on: string;
  target_units: number;
  from_surah: number | null;
  from_ayah: number | null;
  to_surah: number | null;
  to_ayah: number | null;
  label: string | null;
}

const input =
  "w-full bg-surface-card border border-surface-border rounded-xl px-3.5 py-2.5 text-[14px] text-ink focus:outline-none focus:border-brand-navy focus:ring-1 focus:ring-brand-navy/30 transition";
const label = "eyebrow block mb-1.5";
const primary =
  "bg-brand-navy text-white text-[13px] font-semibold py-2.5 px-5 rounded-xl hover:bg-brand-navy-mid disabled:opacity-40 active:scale-[.98] transition-all";
const ghost =
  "text-[13px] font-semibold py-2.5 px-5 rounded-xl border border-surface-border text-ink hover:bg-surface-bg-warm disabled:opacity-40 transition";

/** September to June, the shape almost every madrasah year takes. Offered
 *  as a default so the common case is two clicks rather than two date
 *  pickers, and overridable because some schools run to Ramadan instead. */
function defaultYear(): { academic_year: string; starts_on: string; ends_on: string } {
  const now = new Date();
  const y = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
  return {
    academic_year: `${y}-${y + 1}`,
    starts_on: `${y}-09-01`,
    ends_on: `${y + 1}-06-30`,
  };
}

/** A row of tap-to-pick amounts for whichever unit is selected, plus a
 *  plain number box underneath for anything not on the list — buttons
 *  for the common case, typing still there for everything else. */
function AmountButtons({
  unit,
  value,
  onChange,
}: {
  unit: PlanUnit;
  value: number;
  onChange: (v: number) => void;
}) {
  const { tr } = useLanguage();
  const presets = QUICK_DAILY_AMOUNTS[unit];
  return (
    <div>
      {presets && (
        <div className="flex flex-wrap gap-2 mb-2">
          {presets.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => onChange(p.value)}
              className={`px-3.5 py-2 rounded-full text-[13px] font-semibold transition-all ${
                value === p.value
                  ? "bg-brand-navy text-white"
                  : "bg-surface-card border border-surface-border text-ink-muted hover:text-ink"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}
      <input
        type="number"
        min={0}
        step="0.25"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        placeholder={presets ? tr("Or type your own amount") : undefined}
        className={input}
      />
    </div>
  );
}

/** Review's picker: five fixed buttons, each its own amount and unit.
 *  Tapping the one already chosen clears it back to "no review" — the
 *  fastest way to turn it off on a phone, with no separate button for it. */
function ReviewAmountButtons({
  value,
  unit,
  onChange,
}: {
  value: number;
  unit: PlanUnit | null;
  onChange: (value: number, unit: PlanUnit | null) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {REVIEW_PRESETS.map((p) => {
        const active = value === p.value && unit === p.unit;
        return (
          <button
            key={`${p.unit}-${p.value}`}
            type="button"
            onClick={() => (active ? onChange(0, null) : onChange(p.value, p.unit))}
            className={`px-3.5 py-2 rounded-full text-[13px] font-semibold transition-all ${
              active
                ? "bg-brand-navy text-white"
                : "bg-surface-card border border-surface-border text-ink-muted hover:text-ink"
            }`}
          >
            {p.label}
          </button>
        );
      })}
    </div>
  );
}

export default function TeacherYearlyPlanPage() {
  const { tr } = useLanguage();
  const { mode, students } = useSchoolRoster();
  // The sample portal has no server to hold plans, so its requests are
  // answered in the browser from the sample school's own plans instead —
  // same routes, same shapes, so nothing else on this page changes.
  const api = useCallback(
    (input: string, init?: RequestInit) =>
      mode === "demo" ? demoPlanFetch(input, init) : fetch(input, init),
    [mode]
  );
  const [studentId, setStudentId] = useState<string | null>(null);
  const [payload, setPayload] = useState<PlanPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // The sample portal lives on its own fixed date, like every other sample
  // screen, so its plans agree with the rest of it about what day it is.
  const today = mode === "demo" ? DEMO_PLAN_TODAY : todayISO();

  // Which of the student's plans is on screen, when it isn't whichever one
  // GET would prefer on its own — set only by clicking an "other year" pill.
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  // Building a further plan for this student without losing the one
  // already on screen: the create form reopens, and cancelling it returns
  // to the plan that was showing rather than to a blank roster pick.
  const [creatingNew, setCreatingNew] = useState(false);
  const [editingPlan, setEditingPlan] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [editDraft, setEditDraft] = useState({
    title: "",
    notes: "",
    academic_year: "",
    unit: "juz" as PlanUnit,
    starts_on: "",
    ends_on: "",
    dailyNewAmount: 0,
    dailyReviewAmount: 0,
    dailyReviewUnit: null as PlanUnit | null,
  });

  useEffect(() => {
    if (!studentId && students.length > 0) setStudentId(students[0].id);
  }, [students, studentId]);

  const student = students.find((s) => s.id === studentId) ?? null;

  const load = useCallback(async (id: string, planId?: string | null) => {
    setLoading(true);
    setError(null);
    setErrorCode(null);
    try {
      const qs = new URLSearchParams({ student_id: id });
      if (planId) qs.set("plan_id", planId);
      const res = await api(`/api/yearly-plans?${qs.toString()}`);
      const body = await res.json();
      if (!res.ok) {
        setErrorCode(body?.code ?? null);
        // The not-configured case is a setup step, not a fault — it gets
        // its own panel below rather than a red banner that reads like
        // something broke.
        if (body?.code === "encryption_not_configured") {
          setError(null);
          setPayload(null);
          return;
        }
        throw new Error(body.error || phrase("Could not load the plan"));
      }
      setPayload(body);
    } catch (err) {
      // Surfaced rather than swallowed: an empty plan and a failed request
      // look identical on screen otherwise, and the teacher would go on
      // building a plan that was never going to save.
      setError(err instanceof Error ? tr(err.message) : tr("Could not load the plan"));
      setPayload(null);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    if (mode === "loading" || !studentId) return;
    setSelectedPlanId(null);
    setCreatingNew(false);
    setEditingPlan(false);
    setConfirmingDelete(false);
    load(studentId);
  }, [mode, studentId, load]);

  const plan = payload?.plan ?? null;
  const milestones = payload?.milestones ?? [];
  const progress = payload?.progress;

  /* ── Create ──────────────────────────────────────────────────────── */
  const [draft, setDraft] = useState(() => ({
    ...defaultYear(),
    title: "",
    notes: "",
    unit: "page" as PlanUnit,
    totalUnits: 5,
    segments: 10,
    anchor: true,
    direction: "hifz" as Direction,
    // Where the plan begins — not where the student ended. Asking for the
    // start directly avoids a default like "last memorised An-Naba 40",
    // which was an invented position for any student the app has no
    // lessons for. With nothing on file this is simply the first surah in
    // the chosen direction.
    startSurah: 114,
    startAyah: 1,
    touchedStart: false,
    // "How much he does each day" is the default, not "a total for the
    // year": it's the one a teacher can answer without doing any maths
    // first, and everything else — the total, the schedule — is worked
    // out from it rather than the other way around.
    dailyMode: true,
    dailyNewAmount: 1,
    dailyReviewAmount: 0,
    dailyReviewUnit: null as PlanUnit | null,
  }));

  /* ── The school's own calendar ───────────────────────────────────────
     Which weekdays carry instruction and which specific dates are closed
     — fetched once, school-wide, not per student. A daily-rate plan's
     milestones and its "this week" panel both need it; every other part
     of this page works fine on the plain five-day default while it loads
     or if a school never set one up. */
  const [schoolCal, setSchoolCal] = useState<SchoolCalendar>(DEFAULT_CALENDAR);
  useEffect(() => {
    if (mode === "loading") return;
    api("/api/school-calendar")
      .then((r) => r.json())
      .then((b) => {
        if (!Array.isArray(b?.weekdays)) return;
        setSchoolCal(
          buildCalendar(b.weekdays, (b.closedDates ?? []).map((d: { date: string }) => d.date))
        );
      })
      .catch(() => {});
  }, [mode, api]);

  /* ── Where the student already is ──────────────────────────────────
     Read from the daily lessons the teacher already records, so a plan
     starts from the child's real position rather than from nothing.
     Suggested, never applied silently: the form shows it and the teacher
     confirms or overrides. */
  const [detected, setDetected] = useState<{
    surah: number; ayah: number; surah_name: string; lessons: number; source: string;
  } | null>(null);
  const [detecting, setDetecting] = useState(false);

  useEffect(() => {
    if (mode !== "real" || !studentId) return;
    let cancelled = false;
    setDetecting(true);
    setDetected(null);
    fetch(`/api/quran-position?student_id=${encodeURIComponent(studentId)}`)
      .then((r) => r.json())
      .then((b) => {
        if (cancelled || !b?.position) return;
        setDetected({ ...b.position, surah_name: b.surah_name, lessons: b.lessons, source: b.source });
        // The student's own recorded order wins over this form's default,
        // so a plan cannot quietly be built the opposite way from the
        // child's daily lessons.
        const dir: Direction = b.direction ?? "hifz";
        const from = nextPosition({ surah: b.position.surah, ayah: b.position.ayah }, dir)
          ?? firstPosition(dir);
        setDraft((d) => ({ ...d, direction: dir, startSurah: from.surah, startAyah: from.ayah }));
      })
      // A failure here costs the suggestion, not the form: the teacher
      // can still set the position by hand, so it is not worth an error
      // banner over a page they can use regardless.
      .catch(() => {})
      .finally(() => { if (!cancelled) setDetecting(false); });
    return () => { cancelled = true; };
  }, [mode, studentId]);

  // A new plan in the sample portal starts on its own "today", not the real
  // calendar's September — otherwise it would open with nothing due yet
  // and nothing to show on the Assignments page.
  useEffect(() => {
    if (mode !== "demo") return;
    const y = Number(DEMO_PLAN_TODAY.slice(0, 4));
    setDraft((d) => ({ ...d, academic_year: `${y}-${y + 1}`, starts_on: DEMO_PLAN_TODAY, ends_on: `${y + 1}-06-25` }));
  }, [mode]);

  const startFrom = useMemo(() => {
    const p = { surah: draft.startSurah, ayah: draft.startAyah };
    return isValidPosition(p) ? p : null;
  }, [draft.startSurah, draft.startAyah]);

  // Follow the direction while the teacher hasn't set a start themselves:
  // switching to "Al-Baqarah and down" with An-Nas still in the box would
  // otherwise generate a one-surah plan.
  useEffect(() => {
    if (draft.touchedStart) return;
    const from = detected
      ? nextPosition({ surah: detected.surah, ayah: detected.ayah }, draft.direction)
      : null;
    const fallback = from ?? firstPosition(draft.direction);
    setDraft((d) =>
      d.startSurah === fallback.surah && d.startAyah === fallback.ayah
        ? d
        : { ...d, startSurah: fallback.surah, startAyah: fallback.ayah }
    );
  }, [draft.direction, draft.touchedStart, detected]);

  // "lesson" counts sessions, not text, so it has no mushaf span to walk.
  // A daily rate has no meaning without a position to walk from, so it
  // forces anchoring on regardless of the checkbox — there is no
  // count-only fallback for "1 page a day" the way there is for a target.
  const canAnchor =
    (draft.anchor || draft.dailyMode) && draft.unit !== "lesson" && startFrom !== null;

  const skeleton = useMemo<DraftMilestone[]>(() => {
    if (draft.starts_on >= draft.ends_on) return [];

    if (draft.dailyMode) {
      if (!canAnchor || !startFrom) return [];
      const segs = weeklyMilestonesFromDailyRate(
        startFrom,
        draft.direction,
        draft.unit,
        draft.dailyNewAmount,
        draft.starts_on,
        draft.ends_on,
        schoolCal
      );
      return segs.map((s, i) => ({
        sequence: i + 1,
        starts_on: s.starts_on,
        due_on: s.due_on,
        target_units: s.target_units,
        from_surah: s.from_surah,
        from_ayah: s.from_ayah,
        to_surah: s.to_surah,
        to_ayah: s.to_ayah,
        label: s.label,
      }));
    }

    const dates = generateMilestoneSkeleton(
      draft.starts_on,
      draft.ends_on,
      draft.segments,
      draft.totalUnits
    );
    const blank = (d: (typeof dates)[number]): DraftMilestone => ({
      ...d, from_surah: null, from_ayah: null, to_surah: null, to_ayah: null, label: null,
    });
    if (!canAnchor || !startFrom) return dates.map(blank);

    const ayahs = targetInAyahs(startFrom, draft.direction, draft.unit, draft.totalUnits);
    const ranges = segmentMushaf(
      startFrom, draft.direction, ayahs, draft.segments, draft.unit, draft.totalUnits
    );
    // Zipped by position: the dates come from the calendar and the ranges
    // from the mushaf, and they are independent splits of the same count.
    // If the mushaf runs out first — a plan reaching past An-Nas — the
    // remaining segments keep their dates and simply carry no range,
    // which reads as an over-long plan rather than a broken one.
    return dates.map((d, i) => ({
      ...d,
      target_units: ranges[i]?.units ?? d.target_units,
      from_surah: ranges[i]?.from_surah ?? null,
      from_ayah: ranges[i]?.from_ayah ?? null,
      to_surah: ranges[i]?.to_surah ?? null,
      to_ayah: ranges[i]?.to_ayah ?? null,
      label: ranges[i]?.label ?? null,
    }));
  }, [draft.starts_on, draft.ends_on, draft.segments, draft.totalUnits, draft.unit,
      draft.direction, draft.dailyMode, draft.dailyNewAmount, canAnchor, startFrom, schoolCal]);

  /** True when the year's target reaches past the end of the mushaf. Only
   *  meaningful for a fixed target — a daily rate simply stops producing
   *  milestones once dailySchedule runs off the end of the mushaf, which
   *  reads as a short plan rather than an error. */
  const overshoots = useMemo(() => {
    if (draft.dailyMode || !canAnchor || !startFrom) return false;
    return targetInAyahs(startFrom, draft.direction, draft.unit, draft.totalUnits)
      > ayahsRemaining(startFrom, draft.direction);
  }, [canAnchor, startFrom, draft.direction, draft.unit, draft.totalUnits]);

  const createPlan = async () => {
    if (!studentId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await api("/api/yearly-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_id: studentId,
          academic_year: draft.academic_year,
          starts_on: draft.starts_on,
          ends_on: draft.ends_on,
          unit: draft.unit,
          status: "active",
          title: draft.title || null,
          notes: draft.notes || null,
          start_surah: canAnchor ? startFrom!.surah : null,
          start_ayah: canAnchor ? startFrom!.ayah : null,
          direction: canAnchor ? draft.direction : null,
          daily_new_amount: draft.dailyMode ? draft.dailyNewAmount : null,
          daily_review_amount: draft.dailyMode && draft.dailyReviewAmount > 0 ? draft.dailyReviewAmount : null,
          daily_review_unit: draft.dailyMode && draft.dailyReviewAmount > 0 ? draft.dailyReviewUnit : null,
          milestones: skeleton,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || phrase("Could not create the plan"));
      // Remember the order on the student, so the assignment form offers
      // the same one tomorrow. Best-effort: the plan is already created,
      // and failing to save a preference should not report as a failure
      // to create it.
      if (canAnchor) {
        api("/api/quran-position", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ student_id: studentId, direction: draft.direction }),
        }).catch(() => {});
      }
      setCreatingNew(false);
      setSelectedPlanId(null);
      await load(studentId);
    } catch (err) {
      setError(err instanceof Error ? tr(err.message) : tr("Could not create the plan"));
    } finally {
      setSaving(false);
    }
  };

  /* ── Milestones ──────────────────────────────────────────────────── */
  const [newMilestone, setNewMilestone] = useState({
    title: "",
    description: "",
    starts_on: "",
    due_on: "",
    target_units: 0,
  });

  const addMilestone = async () => {
    if (!plan) return;
    setSaving(true);
    setError(null);
    try {
      const res = await api("/api/yearly-plans/milestones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan_id: plan.id,
          starts_on: newMilestone.starts_on || plan.starts_on,
          due_on: newMilestone.due_on || plan.ends_on,
          target_units: Number(newMilestone.target_units) || 0,
          title: newMilestone.title || null,
          description: newMilestone.description || null,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || phrase("Could not add the milestone"));
      setPayload(body);
      setNewMilestone({ title: "", description: "", starts_on: "", due_on: "", target_units: 0 });
    } catch (err) {
      setError(err instanceof Error ? tr(err.message) : tr("Could not add the milestone"));
    } finally {
      setSaving(false);
    }
  };

  /* ── Progress ────────────────────────────────────────────────────── */
  const [recording, setRecording] = useState<string | null>(null);
  const [entry, setEntry] = useState({ units_after: 0, note: "" });

  const openRecord = (m: Milestone) => {
    setRecording(m.id);
    setEntry({ units_after: m.completed_units, note: "" });
  };

  /* ── Stepping through the plan ───────────────────────────────────────
     Which milestone the navigator is on, and which one (if any) has the
     real mushaf open over it. Kept apart from `recording` above: opening
     the mushaf to check a range shouldn't close an in-progress entry, and
     the two panels can be open at once without conflict. */
  const [focusedMilestoneId, setFocusedMilestoneId] = useState<string | null>(null);
  // A saved milestone (from the row buttons below) or an unsaved draft row
  // (from the create form's own preview) — MilestoneMushafModal only needs
  // the range fields either shares, so one modal instance serves both.
  const [mushafMilestone, setMushafMilestone] = useState<Milestone | DraftMilestone | null>(null);
  const [showFullYear, setShowFullYear] = useState(false);

  useEffect(() => {
    if (milestones.length === 0) {
      setFocusedMilestoneId(null);
      return;
    }
    // Defaults to the first milestone — literally the beginning of the
    // plan — and otherwise holds still: a milestone added or removed
    // elsewhere shouldn't silently walk the teacher's place in the list
    // forward or back to a different one.
    setFocusedMilestoneId((prev) =>
      prev && milestones.some((m) => m.id === prev) ? prev : milestones[0].id
    );
  }, [milestones]);

  const submitProgress = async () => {
    if (!recording) return;
    setSaving(true);
    setError(null);
    try {
      const res = await api("/api/yearly-plans/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          milestone_id: recording,
          units_after: Number(entry.units_after) || 0,
          note: entry.note || null,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || phrase("Could not record the progress"));
      setPayload(body);
      setRecording(null);
      setEntry({ units_after: 0, note: "" });
    } catch (err) {
      setError(err instanceof Error ? tr(err.message) : tr("Could not record the progress"));
    } finally {
      setSaving(false);
    }
  };

  const setPlanStatus = async (status: PlanDto["status"]) => {
    if (!plan) return;
    setSaving(true);
    try {
      const res = await api("/api/yearly-plans", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: plan.id, status }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || phrase("Could not update the plan"));
      setPayload(body);
    } catch (err) {
      setError(err instanceof Error ? tr(err.message) : tr("Could not update the plan"));
    } finally {
      setSaving(false);
    }
  };

  /* ── Another plan, switching years, editing, deleting ──────────────
     All four read the same "other_years" list GET already returns, and
     none of them touch a plan's milestones — that stays the Milestones
     card's job. */

  const switchPlan = (id: string) => {
    if (!studentId) return;
    setEditingPlan(false);
    setConfirmingDelete(false);
    setSelectedPlanId(id);
    load(studentId, id);
  };

  const startNewPlan = () => {
    setEditingPlan(false);
    setConfirmingDelete(false);
    // A fresh default year, bumped forward until it clears every year this
    // student already has a plan for — otherwise the single most likely
    // first click ("+ New plan" right after finishing this year's) lands
    // on the one combination the server is guaranteed to refuse.
    const taken = new Set([
      ...(plan ? [plan.academic_year] : []),
      ...(payload?.other_years?.map((y) => y.academic_year) ?? []),
    ]);
    let y = defaultYear();
    for (let guard = 0; guard < 20 && taken.has(y.academic_year); guard++) {
      const [a] = y.academic_year.split("-").map(Number);
      y = { academic_year: `${a + 1}-${a + 2}`, starts_on: `${a + 1}-09-01`, ends_on: `${a + 2}-06-30` };
    }
    setDraft((d) => ({ ...d, ...y, title: "", notes: "", touchedStart: false }));
    setCreatingNew(true);
  };

  const cancelNewPlan = () => setCreatingNew(false);

  const startEdit = () => {
    if (!plan) return;
    setEditDraft({
      title: plan.title ?? "",
      notes: plan.notes ?? "",
      academic_year: plan.academic_year,
      unit: plan.unit,
      starts_on: plan.starts_on,
      ends_on: plan.ends_on,
      dailyNewAmount: plan.daily_new_amount ?? 0,
      dailyReviewAmount: plan.daily_review_amount ?? 0,
      dailyReviewUnit: plan.daily_review_unit ?? null,
    });
    setConfirmingDelete(false);
    setEditingPlan(true);
  };

  const cancelEdit = () => setEditingPlan(false);

  const saveEdit = async () => {
    if (!plan) return;
    setSaving(true);
    setError(null);
    try {
      const res = await api("/api/yearly-plans", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: plan.id,
          title: editDraft.title || null,
          notes: editDraft.notes || null,
          academic_year: editDraft.academic_year,
          unit: editDraft.unit,
          starts_on: editDraft.starts_on,
          ends_on: editDraft.ends_on,
          // Only a plan with a mushaf position can carry a daily rate at
          // all — omitted for one that doesn't, rather than sent as null,
          // so there is nothing here for the server to reject.
          ...(plan.start_surah != null
            ? {
                daily_new_amount: editDraft.dailyNewAmount > 0 ? editDraft.dailyNewAmount : null,
                daily_review_amount: editDraft.dailyReviewAmount > 0 ? editDraft.dailyReviewAmount : null,
                daily_review_unit: editDraft.dailyReviewAmount > 0 ? editDraft.dailyReviewUnit : null,
              }
            : {}),
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || phrase("Could not update the plan"));
      setPayload(body);
      setEditingPlan(false);
    } catch (err) {
      setError(err instanceof Error ? tr(err.message) : tr("Could not update the plan"));
    } finally {
      setSaving(false);
    }
  };

  /** Two clicks, not a browser confirm() popup: the first turns this
   *  button into "Yes, delete it", so undoing a slip is just clicking
   *  anywhere else, and the destructive click always reads as delete
   *  rather than as a native dialog's generic OK. */
  const deletePlan = async () => {
    if (!plan) return;
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await api(`/api/yearly-plans?id=${encodeURIComponent(plan.id)}`, {
        method: "DELETE",
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || phrase("Could not delete the plan"));
      setConfirmingDelete(false);
      setSelectedPlanId(null);
      if (studentId) await load(studentId);
    } catch (err) {
      setError(err instanceof Error ? tr(err.message) : tr("Could not delete the plan"));
    } finally {
      setSaving(false);
    }
  };

  /* ── Render ──────────────────────────────────────────────────────── */

  if (mode === "loading") {
    return (
      <div className="space-y-6 max-w-6xl">
        <LoadingNote>{tr("Loading your roster…")}</LoadingNote>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <PortalHero
        eyebrow={tr("Teacher")}
        title={tr("Yearly plan")}
        meta={[
          student ? student.name : phrase("No student selected"),
          plan ? plan.academic_year : phrase("No plan yet"),
        ]}
      />

      <SectionCard title={tr("Student")} note={tr("{count} in your school", { count: students.length })}>
        {students.length === 0 ? (
          <PlanEmptyState
            title={tr("No students on your roster")}
            body={tr("Add students from the admin portal first — a yearly plan is written for one child at a time.")}
          />
        ) : (
          <select
            value={studentId ?? ""}
            onChange={(e) => setStudentId(e.target.value)}
            className={input}
            aria-label={tr("Choose a student")}
          >
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        )}
      </SectionCard>

      {errorCode === "encryption_not_configured" && (
        <SectionCard title={tr("One setup step left")}>
          <PlanEmptyState
            title={tr("Yearly plans aren't switched on yet")}
            body={tr("Plans are encrypted before they're stored, and this site hasn't been given its encryption key. Ask whoever set the site up to add the plan encryption key to the server settings and redeploy — everything else on this page is ready.")}
          />
        </SectionCard>
      )}

      {error && (
        <p className="text-[13px] text-status-error-text bg-status-error-bg rounded-xl px-4 py-3">
          {error}
        </p>
      )}

      {loading && <LoadingNote>{tr("Loading the plan…")}</LoadingNote>}

      {!loading && payload && (!plan || creatingNew) && (
        <SectionCard
          title={plan ? tr("New yearly plan") : tr("Create a yearly plan")}
          note={
            plan ? (
              <button
                type="button"
                onClick={cancelNewPlan}
                className="text-[12px] font-semibold text-ink-muted hover:text-ink transition-colors"
              >
                {tr("← Back to {academic_year}", { academic_year: plan.academic_year })}
              </button>
            ) : undefined
          }
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className={label}>{tr("Plan title")}</label>
              <input
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                placeholder={tr("e.g. Hifz of Juz' 30 with weekly revision")}
                className={input}
              />
            </div>
            <div>
              <label className={label}>{tr("Academic year")}</label>
              <input
                value={draft.academic_year}
                onChange={(e) => setDraft({ ...draft, academic_year: e.target.value })}
                className={input}
              />
            </div>
            <div>
              <label className={label}>{tr("Counted in")}</label>
              <select
                value={draft.unit}
                onChange={(e) => {
                  const unit = e.target.value as PlanUnit;
                  // "lesson" counts sessions, not text, so a daily rate —
                  // which has to walk a mushaf position — has nothing to
                  // work from and drops back to a plain target.
                  setDraft({ ...draft, unit, dailyMode: unit === "lesson" ? false : draft.dailyMode });
                }}
                className={input}
              >
                {UNITS.map((u) => (
                  <option key={u} value={u}>
                    {unitLabel(2, u)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={label}>{tr("Starts")}</label>
              <input
                type="date"
                value={draft.starts_on}
                onChange={(e) => setDraft({ ...draft, starts_on: e.target.value })}
                className={input}
              />
            </div>
            <div>
              <label className={label}>{tr("Ends")}</label>
              <input
                type="date"
                value={draft.ends_on}
                onChange={(e) => setDraft({ ...draft, ends_on: e.target.value })}
                className={input}
              />
            </div>

            <div className="sm:col-span-2">
              <label className={label}>{tr("How much he does")}</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setDraft({ ...draft, dailyMode: true, anchor: true })}
                  disabled={draft.unit === "lesson"}
                  className={`flex-1 text-[13px] font-semibold py-2.5 rounded-xl border transition disabled:opacity-40 ${
                    draft.dailyMode
                      ? "bg-brand-navy text-white border-brand-navy"
                      : "border-surface-border text-ink-muted hover:text-ink"
                  }`}
                >
                  {tr("How much each day")}
                </button>
                <button
                  type="button"
                  onClick={() => setDraft({ ...draft, dailyMode: false })}
                  className={`flex-1 text-[13px] font-semibold py-2.5 rounded-xl border transition ${
                    !draft.dailyMode
                      ? "bg-brand-navy text-white border-brand-navy"
                      : "border-surface-border text-ink-muted hover:text-ink"
                  }`}
                >
                  {tr("A total for the year")}
                </button>
              </div>
            </div>

            {draft.dailyMode ? (
              <>
                <div className="sm:col-span-2">
                  <label className={label}>{tr("New memorization, each day at school")}</label>
                  <AmountButtons
                    unit={draft.unit}
                    value={draft.dailyNewAmount}
                    onChange={(v) => setDraft({ ...draft, dailyNewAmount: v })}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className={label}>{tr("Review, each day (optional)")}</label>
                  <ReviewAmountButtons
                    value={draft.dailyReviewAmount}
                    unit={draft.dailyReviewUnit}
                    onChange={(v, u) => setDraft({ ...draft, dailyReviewAmount: v, dailyReviewUnit: u })}
                  />
                  <p className="text-[11.5px] text-ink-muted mt-1">
                    {tr("Old ground he goes back over each day he's at school. Tap again to turn it off.")}
                  </p>
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className={label}>{tr("Total for the year")}</label>
                  <input
                    type="number"
                    min={0}
                    step="0.25"
                    value={draft.totalUnits}
                    onChange={(e) => setDraft({ ...draft, totalUnits: Number(e.target.value) })}
                    className={input}
                  />
                </div>
                <div>
                  <label className={label}>{tr("How many check-ins across the year")}</label>
                  <input
                    type="number"
                    min={1}
                    max={52}
                    value={draft.segments}
                    onChange={(e) =>
                      setDraft({ ...draft, segments: Math.max(1, Math.min(52, Number(e.target.value))) })
                    }
                    className={input}
                  />
                  <p className="text-[11.5px] text-ink-muted mt-1">
                    {tr("e.g. 10 means a new goal roughly every month.")}
                  </p>
                </div>
              </>
            )}

            <div className="sm:col-span-2">
              <label className={label}>{tr("Notes for the year")}</label>
              <textarea
                value={draft.notes}
                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                rows={3}
                placeholder={tr("Anything the parent should know about how this year is set out.")}
                className={input}
              />
            </div>
          </div>

          {/* ── Where in the mushaf to start ─────────────────────── */}
          {draft.unit !== "lesson" && (
            <div className="mt-1 rounded-xl border border-surface-border p-4">
              {draft.dailyMode ? (
                <p className="text-[14px] font-semibold text-ink">{tr("Start from where he already is")}</p>
              ) : (
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={draft.anchor}
                    onChange={(e) => setDraft({ ...draft, anchor: e.target.checked })}
                    className="w-4 h-4 accent-emerald-600 flex-shrink-0"
                  />
                  <span className="text-[14px] font-semibold text-ink">
                    {tr("Start from where he already is")}
                  </span>
                </label>
              )}

              {(draft.anchor || draft.dailyMode) && (
                <div className="mt-4 space-y-4">
                  {detecting && (
                    <p className="text-[12.5px] text-ink-muted">
                      {tr("Checking their recorded lessons…")}
                    </p>
                  )}
                  {!detecting && detected && (
                    <p className="text-[12.5px] text-status-info-text bg-status-info-bg rounded-lg px-3 py-2">
                      {tr("Their last recorded lesson ends at")}{" "}
                      <span className="font-semibold">
                        {getSurahById(detected.surah)?.englishName ?? detected.surah_name} {detected.ayah}
                      </span>{" "}{tr("— read from {count} lesson on file, so the plan starts at the ayah after it. Change it below if that is not where they actually are.|— read from {count} lessons on file, so the plan starts at the ayah after it. Change it below if that is not where they actually are.", { count: detected.lessons })}
                    </p>
                  )}
                  {!detecting && !detected && (
                    <p className="text-[12.5px] text-ink-muted">
                      {tr("No Qur'an lessons recorded for this student yet, so the plan starts at the beginning of this direction. Set it by hand if they are further on.")}
                    </p>
                  )}

                  <div>
                    <label className={label}>{tr("Which way")}</label>
                    <select
                      value={draft.direction}
                      onChange={(e) =>
                        setDraft({ ...draft, direction: e.target.value as Direction })
                      }
                      className={input}
                    >
                      {(["hifz", "forward"] as const).map((d) => (
                        <option key={d} value={d}>
                          {DIRECTION_LABEL[d]}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={label}>{tr("Starting surah")}</label>
                      <select
                        value={draft.startSurah}
                        onChange={(e) => {
                          const surah = Number(e.target.value);
                          const max = getSurahById(surah)?.ayahs ?? 1;
                          // Clamped, because moving from Al-Baqarah (286)
                          // to Al-Kawthar (3) would otherwise leave an
                          // ayah number that does not exist.
                          setDraft({
                            ...draft, touchedStart: true, startSurah: surah,
                            startAyah: Math.min(draft.startAyah, max),
                          });
                        }}
                        className={input}
                      >
                        {SURAHS.map((sr) => (
                          <option key={sr.id} value={sr.id}>
                            {tr("{id}. {englishName} ({ayahs} ayahs)", { id: sr.id, englishName: sr.englishName, ayahs: sr.ayahs })}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={label}>{tr("…from ayah")}</label>
                      <input
                        type="number"
                        min={1}
                        max={getSurahById(draft.startSurah)?.ayahs ?? 1}
                        value={draft.startAyah}
                        onChange={(e) =>
                          setDraft({ ...draft, touchedStart: true, startAyah: Number(e.target.value) })
                        }
                        className={input}
                      />
                    </div>
                  </div>

                  {startFrom ? (
                    <p className="text-[12.5px] text-ink-muted">
                      {tr("The plan will begin at")}{" "}
                      <span className="font-semibold text-ink">{formatPosition(startFrom)}</span>.
                    </p>
                  ) : (
                    <p className="text-[12.5px] text-status-error-text">
                      {tr("That position is past the end of the mushaf in this direction — there is nothing after it to plan.")}
                    </p>
                  )}

                  {overshoots && (
                    <p className="text-[12.5px] text-status-error-text bg-status-error-bg rounded-lg px-3 py-2">
                      {tr("{formatUnits} is more than he has left in this direction — he'll finish everything before the year is up.", { formatUnits: formatUnits(draft.totalUnits, draft.unit) })}
                    </p>
                  )}

                  {/* What "5 juz across the year" actually is a day —
                      worked out from the school calendar, not asked for.
                      A teacher who thinks in totals shouldn't have to
                      switch to the daily-rate pace just to see this. */}
                  {!draft.dailyMode && !overshoots && canAnchor && startFrom && draft.totalUnits > 0 && (
                    <p className="text-[12.5px] text-status-info-text bg-status-info-bg rounded-lg px-3 py-2">
                      {tr("That's about {formatUnits} a day, on the days he's at school, from {starts_on} to {ends_on}. Once saved, the plan page shows exactly what to do each day.", { formatUnits: formatUnits(
                        impliedDailyRate(draft.totalUnits, draft.starts_on, draft.ends_on, schoolCal),
                        draft.unit
                      ), starts_on: draft.starts_on, ends_on: draft.ends_on })}
                    </p>
                  )}

                  {draft.dailyMode &&
                    (skeleton.length > 0 ? (
                      <p className="text-[12.5px] text-status-info-text bg-status-info-bg rounded-lg px-3 py-2">
                        {tr("By {ends_on} that's about", { ends_on: draft.ends_on })}{" "}
                        {formatUnits(
                          skeleton.reduce((s, m) => s + m.target_units, 0),
                          draft.unit
                        )}{" "}{tr("in total")}
                        {draft.dailyReviewAmount > 0 &&
                          tr(", plus {formatUnits} of review every day he's at school", { formatUnits: formatUnits(draft.dailyReviewAmount, draft.dailyReviewUnit ?? draft.unit) })}
                        {tr(". The plan page will show exactly what to do each day.")}
                      </p>
                    ) : (
                      <p className="text-[12.5px] text-status-error-text">
                        {tr("He isn't at school on any day in these dates — check the start and end dates, or the school's calendar under Admin.")}
                      </p>
                    ))}
                </div>
              )}
            </div>
          )}

          {skeleton.length > 0 && (
            <div className="mt-5 rounded-xl border border-surface-border bg-surface-bg-warm px-4 py-3">
              <p className="eyebrow">{tr("What this creates")}</p>
              <p className="text-[13px] text-ink-body mt-1.5 leading-relaxed">
                {draft.dailyMode ? (
                  <>
                    {tr("{count} weekly goals, from {starts_on} to {due_on} — each one sized to how many days he's actually at school that week.", { count: skeleton.length, starts_on: skeleton[0].starts_on, due_on: skeleton[skeleton.length - 1].due_on })}
                  </>
                ) : (
                  <>
                    {tr("{count} evenly spaced check-ins of", { count: skeleton.length })}{" "}
                    <span className="font-semibold">
                      {formatUnits(skeleton[0].target_units, draft.unit)}
                    </span>{" "}{tr("each, from {starts_on} to {due_on}.", { starts_on: skeleton[0].starts_on, due_on: skeleton[skeleton.length - 1].due_on })}
                  </>
                )}{" "}{tr("Rename, retarget or delete any of them afterwards.")}
              </p>
              {canAnchor && skeleton.some((m) => m.label) && (
                <>
                  {draft.dailyMode && (
                    <p className="text-[11.5px] text-ink-muted mt-3">
                      {tr("Each row below is one week, not one day — the days he's actually at school that week, added together. For a single day's page, see \"This week's work\" on the plan page once it's saved.")}
                    </p>
                  )}
                  <ol className="mt-3 divide-y divide-surface-border border-t border-surface-border">
                    {skeleton.map((m, i) => {
                      const page =
                        m.from_surah != null && m.from_ayah != null && m.to_surah != null && m.to_ayah != null
                          ? pageLabel(
                              { surah: m.from_surah, ayah: m.from_ayah },
                              { surah: m.to_surah, ayah: m.to_ayah }
                            )
                          : null;
                      return (
                        <li key={i} className="flex items-baseline justify-between gap-3 py-1.5">
                          <span className="text-[12.5px] text-ink min-w-0">
                            <span className="text-ink-muted tabular-nums me-2">
                              {String(i + 1).padStart(2, "0")}
                            </span>
                            {page ? (
                              <button
                                type="button"
                                onClick={() => setMushafMilestone(m)}
                                className="font-semibold text-brand-navy dark:text-brand-gold hover:underline"
                              >
                                {page}
                              </button>
                            ) : null}{" "}
                            <span className={page ? "text-ink-muted" : ""}>
                              {page ? `(${m.label})` : (m.label ?? "—")}
                            </span>
                          </span>
                          <span className="eyebrow flex-shrink-0">
                            {draft.dailyMode ? `${m.starts_on} – ${m.due_on}` : m.due_on}
                          </span>
                        </li>
                      );
                    })}
                  </ol>
                </>
              )}
            </div>
          )}

          {draft.starts_on >= draft.ends_on && (
            <p className="text-[13px] text-status-error-text mt-4">
              {tr("The end date has to come after the start date.")}
            </p>
          )}

          <div className="mt-5 flex justify-end">
            <button
              onClick={createPlan}
              disabled={saving || !studentId || draft.starts_on >= draft.ends_on}
              className={primary}
            >
              {saving ? tr("Creating…") : tr("Create plan")}
            </button>
          </div>
        </SectionCard>
      )}

      {plan && progress && (
        <>
          {payload!.alerts.length > 0 && (
            <div className="space-y-2.5">
              {payload!.alerts.map((a) => (
                <PlanAlertBanner
                  key={a.id}
                  level={a.level}
                  title={translateAlert(a).title}
                  detail={translateAlert(a).detail}
                  acknowledged={Boolean(a.acknowledged_at)}
                />
              ))}
            </div>
          )}

          <SectionCard
            title={readable(plan.title, phrase("Yearly plan"))}
            note={
              <span className="inline-flex items-center gap-2">
                {plan.academic_year}
                <PaceChip pace={progress.pace} />
              </span>
            }
          >
            <div className="flex flex-col sm:flex-row items-center gap-7">
              <PaceDial
                percentComplete={progress.percentComplete}
                percentExpected={progress.percentExpected}
                pace={progress.pace}
              />
              <div className="flex-1 min-w-0 w-full">
                <div className="flex flex-wrap gap-y-4">
                  <PlanFigure
                    value={formatQuantity(progress.actualUnits)}
                    label={tr("{unitLabel} done", { unitLabel: unitLabel(2, plan.unit) })}
                    tone={paceColor(progress.pace)}
                  />
                  <PlanFigure value={formatApprox(progress.expectedUnits)} label={tr("expected by today")} />
                  <PlanFigure value={formatQuantity(progress.totalUnits)} label={tr("total for the year")} />
                  <PlanFigure value={progress.daysRemaining} label={tr("days left")} />
                </div>
                <div className="mt-5">
                  <PaceBar
                    percentComplete={progress.percentComplete}
                    percentExpected={progress.percentExpected}
                    pace={progress.pace}
                  />
                  <p className="text-[12px] text-ink-muted mt-2.5 leading-relaxed">
                    {progress.varianceUnits >= 0
                      ? tr("{formatApprox} {unitLabel} ahead of the schedule.", { formatApprox: formatApprox(progress.varianceUnits), unitLabel: unitLabel(progress.varianceUnits, plan.unit) })
                      : tr("{formatApprox} {unitLabel} short of the schedule.", { formatApprox: formatApprox(Math.abs(progress.varianceUnits)), unitLabel: unitLabel(progress.varianceUnits, plan.unit) })}{" "}{tr("Running at {formatApprox} {unitLabel} a week; finishing on time needs {formatApprox2}.", { formatApprox: formatApprox(progress.currentPerWeek), unitLabel: unitLabel(progress.currentPerWeek, plan.unit), formatApprox2: formatApprox(progress.requiredPerWeek) })}
                  </p>
                </div>
              </div>
            </div>

            {plan.notes && (
              <>
                <div className="gold-rule my-5" />
                <p className="text-[13px] text-ink-body leading-relaxed whitespace-pre-line">
                  {readable(plan.notes)}
                </p>
              </>
            )}

            <div className="gold-rule my-5" />
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="eyebrow">{tr("Status")}</span>
              {(["draft", "active", "completed", "archived"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setPlanStatus(s)}
                  disabled={saving || plan.status === s}
                  className={`text-[11px] font-bold uppercase tracking-[0.1em] px-3 py-1.5 rounded-full border transition ${
                    plan.status === s
                      ? "bg-brand-navy text-white border-brand-navy"
                      : "border-surface-border text-ink-muted hover:text-ink hover:border-ink-muted"
                  }`}
                >
                  {tr(PLAN_STATUS_LABEL[s])}
                </button>
              ))}
            </div>

            {payload?.other_years && payload.other_years.length > 0 && (
              <div className="flex items-center gap-2.5 flex-wrap mt-3.5">
                <span className="eyebrow">{tr("Other years")}</span>
                {payload.other_years.map((y) => (
                  <button
                    key={y.id}
                    type="button"
                    onClick={() => switchPlan(y.id)}
                    disabled={saving}
                    className="text-[12px] font-semibold px-3 py-1.5 rounded-full border border-surface-border text-ink-muted hover:text-ink hover:border-ink-muted transition disabled:opacity-40"
                  >
                    {y.academic_year} · {tr(PLAN_STATUS_LABEL[y.status])}
                  </button>
                ))}
              </div>
            )}

            <div className="gold-rule my-5" />
            {editingPlan ? (
              <div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className={label}>{tr("Plan title")}</label>
                    <input
                      value={editDraft.title}
                      onChange={(e) => setEditDraft({ ...editDraft, title: e.target.value })}
                      className={input}
                    />
                  </div>
                  <div>
                    <label className={label}>{tr("Academic year")}</label>
                    <input
                      value={editDraft.academic_year}
                      onChange={(e) => setEditDraft({ ...editDraft, academic_year: e.target.value })}
                      className={input}
                    />
                  </div>
                  <div>
                    <label className={label}>{tr("Counted in")}</label>
                    <select
                      value={editDraft.unit}
                      onChange={(e) => setEditDraft({ ...editDraft, unit: e.target.value as PlanUnit })}
                      className={input}
                    >
                      {UNITS.map((u) => (
                        <option key={u} value={u}>
                          {unitLabel(2, u)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={label}>{tr("Starts")}</label>
                    <input
                      type="date"
                      value={editDraft.starts_on}
                      onChange={(e) => setEditDraft({ ...editDraft, starts_on: e.target.value })}
                      className={input}
                    />
                  </div>
                  <div>
                    <label className={label}>{tr("Ends")}</label>
                    <input
                      type="date"
                      value={editDraft.ends_on}
                      onChange={(e) => setEditDraft({ ...editDraft, ends_on: e.target.value })}
                      className={input}
                    />
                  </div>
                  {plan.start_surah != null && (
                    <>
                      <div className="sm:col-span-2">
                        <label className={label}>{tr("New memorization, each day at school")}</label>
                        <AmountButtons
                          unit={editDraft.unit}
                          value={editDraft.dailyNewAmount}
                          onChange={(v) => setEditDraft({ ...editDraft, dailyNewAmount: v })}
                        />
                        <p className="text-[11.5px] text-ink-muted mt-1">{tr("0 turns this off.")}</p>
                      </div>
                      <div className="sm:col-span-2">
                        <label className={label}>{tr("Review, each day")}</label>
                        <ReviewAmountButtons
                          value={editDraft.dailyReviewAmount}
                          unit={editDraft.dailyReviewUnit}
                          onChange={(v, u) => setEditDraft({ ...editDraft, dailyReviewAmount: v, dailyReviewUnit: u })}
                        />
                        <p className="text-[11.5px] text-ink-muted mt-1">{tr("Tap the selected one again to turn it off.")}</p>
                      </div>
                    </>
                  )}
                  <div className="sm:col-span-2">
                    <label className={label}>{tr("Notes for the year")}</label>
                    <textarea
                      value={editDraft.notes}
                      onChange={(e) => setEditDraft({ ...editDraft, notes: e.target.value })}
                      rows={3}
                      className={input}
                    />
                  </div>
                </div>
                <div className="flex gap-2.5 mt-4">
                  <button
                    onClick={saveEdit}
                    disabled={
                      saving || !editDraft.academic_year.trim() || editDraft.starts_on >= editDraft.ends_on
                    }
                    className={primary}
                  >
                    {saving ? tr("Saving…") : tr("Save changes")}
                  </button>
                  <button onClick={cancelEdit} disabled={saving} className={ghost}>
                    {tr("Cancel")}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2.5 flex-wrap">
                <button onClick={startEdit} className={ghost}>
                  {tr("Edit plan")}
                </button>
                <button onClick={startNewPlan} className={ghost}>
                  {tr("+ New plan")}
                </button>
                <button
                  onClick={deletePlan}
                  disabled={saving}
                  className={`text-[13px] font-semibold py-2.5 px-5 rounded-xl border transition-all active:scale-[.98] disabled:opacity-40 ${
                    confirmingDelete
                      ? "bg-red-600 border-red-600 text-white hover:bg-red-700"
                      : "border-surface-border text-status-error-text hover:bg-status-error-bg"
                  }`}
                >
                  {saving && confirmingDelete
                    ? tr("Deleting…")
                    : confirmingDelete
                      ? tr("Yes, delete this plan")
                      : tr("Delete plan")}
                </button>
                {confirmingDelete && (
                  <button
                    onClick={() => setConfirmingDelete(false)}
                    disabled={saving}
                    className="text-[12px] font-semibold text-ink-muted hover:text-ink transition-colors"
                  >
                    {tr("Cancel")}
                  </button>
                )}
              </div>
            )}
          </SectionCard>

          <DailyWorkPanel
            plan={plan}
            cal={schoolCal}
            totalUnits={progress.totalUnits}
            today={today}
            onViewFullYear={() => setShowFullYear(true)}
          />

          <SectionCard title={tr("Milestones")} note={tr("{count} segments", { count: milestones.length })}>
            {milestones.length === 0 ? (
              <PlanEmptyState
                title={tr("No milestones yet")}
                body={tr("A plan without milestones has no schedule to measure against, so nothing can be marked ahead or behind. Add the first segment below.")}
              />
            ) : (
              <>
                {milestones.length > 1 && (
                  <MilestoneNavigator
                    milestones={milestones}
                    today={today}
                    focusedId={focusedMilestoneId}
                    onFocus={setFocusedMilestoneId}
                    onViewMushaf={setMushafMilestone}
                  />
                )}
                <ul className="divide-y divide-surface-border">
                {milestones.map((m) => (
                  <MilestoneRow
                    key={m.id}
                    milestone={m}
                    unit={plan.unit}
                    today={today}
                    onRecord={() => openRecord(m)}
                    onViewMushaf={setMushafMilestone}
                  >
                    {recording === m.id && (
                      <div className="mt-3.5 rounded-xl border border-surface-border bg-surface-bg-warm p-4">
                        <div className="grid grid-cols-1 sm:grid-cols-[150px_1fr] gap-3">
                          <div>
                            <label className={label}>
                              {tr("{unitLabel} done in total", { unitLabel: unitLabel(2, plan.unit) })}
                            </label>
                            <input
                              type="number"
                              min={0}
                              step="0.25"
                              value={entry.units_after}
                              onChange={(e) =>
                                setEntry({ ...entry, units_after: Number(e.target.value) })
                              }
                              className={input}
                              autoFocus
                            />
                          </div>
                          <div>
                            <label className={label}>{tr("Note for the parent (optional)")}</label>
                            <input
                              value={entry.note}
                              onChange={(e) => setEntry({ ...entry, note: e.target.value })}
                              placeholder={tr("e.g. Recited to ayah 18 without prompting")}
                              className={input}
                            />
                          </div>
                        </div>
                        <p className="text-[11.5px] text-ink-muted mt-2.5">
                          {tr("This is the running total for this milestone, not today's addition — correcting a figure downwards is fine.")}
                        </p>
                        <div className="mt-3.5 flex gap-2.5 justify-end">
                          <button onClick={() => setRecording(null)} className={ghost} disabled={saving}>
                            {tr("Cancel")}
                          </button>
                          <button onClick={submitProgress} className={primary} disabled={saving}>
                            {saving ? tr("Saving…") : tr("Save progress")}
                          </button>
                        </div>
                      </div>
                    )}
                  </MilestoneRow>
                ))}
                </ul>
              </>
            )}

            <div className="gold-rule my-5" />
            <p className="eyebrow mb-3">{tr("Add a milestone")}</p>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <input
                value={newMilestone.title}
                onChange={(e) => setNewMilestone({ ...newMilestone, title: e.target.value })}
                placeholder={tr("Title")}
                className={`${input} sm:col-span-2`}
              />
              <input
                type="date"
                value={newMilestone.starts_on || plan.starts_on}
                onChange={(e) => setNewMilestone({ ...newMilestone, starts_on: e.target.value })}
                className={input}
                aria-label={tr("Milestone start date")}
              />
              <input
                type="date"
                value={newMilestone.due_on || addDays(plan.starts_on, 30)}
                onChange={(e) => setNewMilestone({ ...newMilestone, due_on: e.target.value })}
                className={input}
                aria-label={tr("Milestone due date")}
              />
              <input
                value={newMilestone.description}
                onChange={(e) => setNewMilestone({ ...newMilestone, description: e.target.value })}
                placeholder={tr("What this segment covers")}
                className={`${input} sm:col-span-3`}
              />
              <input
                type="number"
                min={0}
                step="0.25"
                value={newMilestone.target_units}
                onChange={(e) =>
                  setNewMilestone({ ...newMilestone, target_units: Number(e.target.value) })
                }
                placeholder={tr("Target")}
                className={input}
                aria-label={tr("Target units")}
              />
            </div>
            <div className="mt-3.5 flex justify-end">
              <button onClick={addMilestone} disabled={saving} className={primary}>
                {saving ? tr("Adding…") : tr("Add milestone")}
              </button>
            </div>
          </SectionCard>
        </>
      )}

      <MilestoneMushafModal milestone={mushafMilestone} onClose={() => setMushafMilestone(null)} />
      {plan && (
        <FullYearScheduleModal
          open={showFullYear}
          plan={plan}
          cal={schoolCal}
          totalUnits={progress?.totalUnits}
          onClose={() => setShowFullYear(false)}
        />
      )}
    </div>
  );
}
