"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PortalHero } from "@/components/PortalHero";
import { SectionCard, LoadingNote } from "@/components/portal-ui";
import {
  DailyWorkPanel,
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
} from "@/lib/yearlyPlan";

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

export default function TeacherYearlyPlanPage() {
  const { mode, students } = useSchoolRoster();
  const [studentId, setStudentId] = useState<string | null>(null);
  const [payload, setPayload] = useState<PlanPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const today = todayISO();

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
      const res = await fetch(`/api/yearly-plans?${qs.toString()}`);
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
        throw new Error(body.error || "Could not load the plan");
      }
      setPayload(body);
    } catch (err) {
      // Surfaced rather than swallowed: an empty plan and a failed request
      // look identical on screen otherwise, and the teacher would go on
      // building a plan that was never going to save.
      setError(err instanceof Error ? err.message : "Could not load the plan");
      setPayload(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (mode !== "real" || !studentId) return;
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
    unit: "juz" as PlanUnit,
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
    // A steady pace instead of a year's total split into a chosen number
    // of segments — "1 page a day" rather than "5 juz across 10 pieces".
    // Off by default: most plans still read more naturally as a target
    // and a deadline than as a rate.
    dailyMode: false,
    dailyNewAmount: 1,
    dailyReviewAmount: 0,
  }));

  /* ── The school's own calendar ───────────────────────────────────────
     Which weekdays carry instruction and which specific dates are closed
     — fetched once, school-wide, not per student. A daily-rate plan's
     milestones and its "this week" panel both need it; every other part
     of this page works fine on the plain five-day default while it loads
     or if a school never set one up. */
  const [schoolCal, setSchoolCal] = useState<SchoolCalendar>(DEFAULT_CALENDAR);
  useEffect(() => {
    if (mode !== "real") return;
    fetch("/api/school-calendar")
      .then((r) => r.json())
      .then((b) => {
        if (!Array.isArray(b?.weekdays)) return;
        setSchoolCal(
          buildCalendar(b.weekdays, (b.closedDates ?? []).map((d: { date: string }) => d.date))
        );
      })
      .catch(() => {});
  }, [mode]);

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
      const res = await fetch("/api/yearly-plans", {
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
          milestones: skeleton,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Could not create the plan");
      // Remember the order on the student, so the assignment form offers
      // the same one tomorrow. Best-effort: the plan is already created,
      // and failing to save a preference should not report as a failure
      // to create it.
      if (canAnchor) {
        fetch("/api/quran-position", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ student_id: studentId, direction: draft.direction }),
        }).catch(() => {});
      }
      setCreatingNew(false);
      setSelectedPlanId(null);
      await load(studentId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the plan");
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
      const res = await fetch("/api/yearly-plans/milestones", {
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
      if (!res.ok) throw new Error(body.error || "Could not add the milestone");
      setPayload(body);
      setNewMilestone({ title: "", description: "", starts_on: "", due_on: "", target_units: 0 });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add the milestone");
    } finally {
      setSaving(false);
    }
  };

  const deleteMilestone = async (id: string) => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/yearly-plans/milestones?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Could not remove the milestone");
      setPayload(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove the milestone");
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
  const [mushafMilestone, setMushafMilestone] = useState<Milestone | null>(null);

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
      const res = await fetch("/api/yearly-plans/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          milestone_id: recording,
          units_after: Number(entry.units_after) || 0,
          note: entry.note || null,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Could not record the progress");
      setPayload(body);
      setRecording(null);
      setEntry({ units_after: 0, note: "" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not record the progress");
    } finally {
      setSaving(false);
    }
  };

  const setPlanStatus = async (status: PlanDto["status"]) => {
    if (!plan) return;
    setSaving(true);
    try {
      const res = await fetch("/api/yearly-plans", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: plan.id, status }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Could not update the plan");
      setPayload(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the plan");
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
      const res = await fetch("/api/yearly-plans", {
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
              }
            : {}),
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Could not update the plan");
      setPayload(body);
      setEditingPlan(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the plan");
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
      const res = await fetch(`/api/yearly-plans?id=${encodeURIComponent(plan.id)}`, {
        method: "DELETE",
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Could not delete the plan");
      setConfirmingDelete(false);
      setSelectedPlanId(null);
      if (studentId) await load(studentId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete the plan");
    } finally {
      setSaving(false);
    }
  };

  /* ── Render ──────────────────────────────────────────────────────── */

  if (mode === "loading") {
    return (
      <div className="space-y-6 max-w-4xl">
        <LoadingNote>Loading your roster…</LoadingNote>
      </div>
    );
  }

  if (mode === "demo") {
    return (
      <div className="space-y-6 max-w-4xl">
        <PortalHero eyebrow="Teacher" title="Yearly plan" />
        <SectionCard title="Sign in to build a plan">
          <PlanEmptyState
            title="Yearly plans need a real school"
            body="This is the sample portal, so there is no roster to attach a plan to and no encryption key to store one under. Sign in with your school's teacher account to set out a student's year."
          />
        </SectionCard>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <PortalHero
        eyebrow="Teacher"
        title="Yearly plan"
        meta={[
          student ? student.name : "No student selected",
          plan ? plan.academic_year : "No plan yet",
        ]}
      />

      <SectionCard title="Student" note={`${students.length} in your school`}>
        {students.length === 0 ? (
          <PlanEmptyState
            title="No students on your roster"
            body="Add students from the admin portal first — a yearly plan is written for one child at a time."
          />
        ) : (
          <select
            value={studentId ?? ""}
            onChange={(e) => setStudentId(e.target.value)}
            className={input}
            aria-label="Choose a student"
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
        <SectionCard title="One setup step left">
          <PlanEmptyState
            title="Yearly plans aren't switched on yet"
            body="Plans are encrypted before they're stored, and this site hasn't been given its encryption key. Ask whoever set the site up to add the plan encryption key to the server settings and redeploy — everything else on this page is ready."
          />
        </SectionCard>
      )}

      {error && (
        <p className="text-[13px] text-status-error-text bg-status-error-bg rounded-xl px-4 py-3">
          {error}
        </p>
      )}

      {loading && <LoadingNote>Loading the plan…</LoadingNote>}

      {!loading && payload && (!plan || creatingNew) && (
        <SectionCard
          title={plan ? "New yearly plan" : "Create a yearly plan"}
          note={
            plan ? (
              <button
                type="button"
                onClick={cancelNewPlan}
                className="text-[12px] font-semibold text-ink-muted hover:text-ink transition-colors"
              >
                ← Back to {plan.academic_year}
              </button>
            ) : undefined
          }
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className={label}>Plan title</label>
              <input
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                placeholder="e.g. Hifz of Juz' 30 with weekly revision"
                className={input}
              />
            </div>
            <div>
              <label className={label}>Academic year</label>
              <input
                value={draft.academic_year}
                onChange={(e) => setDraft({ ...draft, academic_year: e.target.value })}
                className={input}
              />
            </div>
            <div>
              <label className={label}>Counted in</label>
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
              <label className={label}>Starts</label>
              <input
                type="date"
                value={draft.starts_on}
                onChange={(e) => setDraft({ ...draft, starts_on: e.target.value })}
                className={input}
              />
            </div>
            <div>
              <label className={label}>Ends</label>
              <input
                type="date"
                value={draft.ends_on}
                onChange={(e) => setDraft({ ...draft, ends_on: e.target.value })}
                className={input}
              />
            </div>

            <div className="sm:col-span-2">
              <label className={label}>Pace</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setDraft({ ...draft, dailyMode: false })}
                  className={`flex-1 text-[13px] font-semibold py-2.5 rounded-xl border transition ${
                    !draft.dailyMode
                      ? "bg-brand-navy text-white border-brand-navy"
                      : "border-surface-border text-ink-muted hover:text-ink"
                  }`}
                >
                  A target for the year
                </button>
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
                  A steady daily rate
                </button>
              </div>
            </div>

            {draft.dailyMode ? (
              <>
                <div>
                  <label className={label}>New material per instructional day</label>
                  <input
                    type="number"
                    min={0.01}
                    step="0.25"
                    value={draft.dailyNewAmount}
                    onChange={(e) => setDraft({ ...draft, dailyNewAmount: Number(e.target.value) })}
                    className={input}
                  />
                </div>
                <div>
                  <label className={label}>Review per instructional day (optional)</label>
                  <input
                    type="number"
                    min={0}
                    step="0.5"
                    value={draft.dailyReviewAmount}
                    onChange={(e) => setDraft({ ...draft, dailyReviewAmount: Number(e.target.value) })}
                    className={input}
                  />
                  <p className="text-[11.5px] text-ink-muted mt-1">
                    A flat daily amount — this doesn&apos;t track which pages, only how much.
                  </p>
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className={label}>Total for the year</label>
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
                  <label className={label}>Split into</label>
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
                </div>
              </>
            )}

            <div className="sm:col-span-2">
              <label className={label}>Notes for the year</label>
              <textarea
                value={draft.notes}
                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                rows={3}
                placeholder="Anything the parent should know about how this year is set out."
                className={input}
              />
            </div>
          </div>

          {/* ── Where in the mushaf to start ─────────────────────── */}
          {draft.unit !== "lesson" && (
            <div className="mt-1 rounded-xl border border-surface-border p-4">
              {draft.dailyMode ? (
                <p className="text-[14px] font-semibold text-ink">
                  A daily rate always starts from a position in the mushaf
                </p>
              ) : (
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={draft.anchor}
                    onChange={(e) => setDraft({ ...draft, anchor: e.target.checked })}
                    className="w-4 h-4 accent-emerald-600 flex-shrink-0"
                  />
                  <span className="text-[14px] font-semibold text-ink">
                    Build the plan from where the student is in the mushaf
                  </span>
                </label>
              )}

              {(draft.anchor || draft.dailyMode) && (
                <div className="mt-4 space-y-4">
                  {detecting && (
                    <p className="text-[12.5px] text-ink-muted">
                      Checking their recorded lessons…
                    </p>
                  )}
                  {!detecting && detected && (
                    <p className="text-[12.5px] text-status-info-text bg-status-info-bg rounded-lg px-3 py-2">
                      Their last recorded lesson ends at{" "}
                      <span className="font-semibold">
                        {detected.surah_name} {detected.ayah}
                      </span>{" "}
                      — read from {detected.lessons} lesson
                      {detected.lessons === 1 ? "" : "s"} on file, so the plan starts at the ayah
                      after it. Change it below if that is not where they actually are.
                    </p>
                  )}
                  {!detecting && !detected && (
                    <p className="text-[12.5px] text-ink-muted">
                      No Qur&apos;an lessons recorded for this student yet, so the plan starts at
                      the beginning of this direction. Set it by hand if they are further on.
                    </p>
                  )}

                  <div>
                    <label className={label}>Working through the mushaf</label>
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
                      <label className={label}>Plan starts at surah</label>
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
                            {sr.id}. {sr.englishName} ({sr.ayahs} ayahs)
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={label}>…from ayah</label>
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
                      The plan will begin at{" "}
                      <span className="font-semibold text-ink">{formatPosition(startFrom)}</span>.
                    </p>
                  ) : (
                    <p className="text-[12.5px] text-status-error-text">
                      That position is past the end of the mushaf in this direction — there is
                      nothing after it to plan.
                    </p>
                  )}

                  {overshoots && (
                    <p className="text-[12.5px] text-status-error-text bg-status-error-bg rounded-lg px-3 py-2">
                      {formatUnits(draft.totalUnits, draft.unit)} is more than remains from here in
                      this direction. The plan will stop at the end of the mushaf and the last
                      milestones will be short.
                    </p>
                  )}

                  {draft.dailyMode &&
                    (skeleton.length > 0 ? (
                      <p className="text-[12.5px] text-status-info-text bg-status-info-bg rounded-lg px-3 py-2">
                        This creates {skeleton.length} weekly milestone{skeleton.length === 1 ? "" : "s"},
                        totaling about{" "}
                        {formatUnits(
                          skeleton.reduce((s, m) => s + m.target_units, 0),
                          draft.unit
                        )}{" "}
                        by {draft.ends_on}
                        {draft.dailyReviewAmount > 0 &&
                          ` — plus ${formatUnits(draft.dailyReviewAmount, draft.unit)} of review every instructional day, not tracked by position`}
                        .
                      </p>
                    ) : (
                      <p className="text-[12.5px] text-status-error-text">
                        No instructional days fall in this span yet — check the start and end
                        dates, or the school calendar under Admin.
                      </p>
                    ))}
                </div>
              )}
            </div>
          )}

          {skeleton.length > 0 && (
            <div className="mt-5 rounded-xl border border-surface-border bg-surface-bg-warm px-4 py-3">
              <p className="eyebrow">Milestones this will create</p>
              <p className="text-[13px] text-ink-body mt-1.5 leading-relaxed">
                {skeleton.length} evenly spaced segments of{" "}
                <span className="font-semibold">
                  {formatUnits(skeleton[0].target_units, draft.unit)}
                </span>{" "}
                each, from {skeleton[0].starts_on} to {skeleton[skeleton.length - 1].due_on}. Rename,
                retarget or delete any of them afterwards.
              </p>
              {canAnchor && skeleton.some((m) => m.label) && (
                <ol className="mt-3 divide-y divide-surface-border border-t border-surface-border">
                  {skeleton.map((m, i) => (
                    <li key={i} className="flex items-baseline justify-between gap-3 py-1.5">
                      <span className="text-[12.5px] text-ink min-w-0">
                        <span className="text-ink-muted tabular-nums me-2">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        {m.label ?? "—"}
                      </span>
                      <span className="eyebrow flex-shrink-0">{m.due_on}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}

          {draft.starts_on >= draft.ends_on && (
            <p className="text-[13px] text-status-error-text mt-4">
              The end date has to come after the start date.
            </p>
          )}

          <div className="mt-5 flex justify-end">
            <button
              onClick={createPlan}
              disabled={saving || !studentId || draft.starts_on >= draft.ends_on}
              className={primary}
            >
              {saving ? "Creating…" : "Create plan"}
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
                  title={a.title}
                  detail={a.detail}
                  acknowledged={Boolean(a.acknowledged_at)}
                />
              ))}
            </div>
          )}

          <SectionCard
            title={readable(plan.title, "Yearly plan")}
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
                    label={`${unitLabel(2, plan.unit)} done`}
                    tone={paceColor(progress.pace)}
                  />
                  <PlanFigure value={formatApprox(progress.expectedUnits)} label="expected by today" />
                  <PlanFigure value={formatQuantity(progress.totalUnits)} label="total for the year" />
                  <PlanFigure value={progress.daysRemaining} label="days left" />
                </div>
                <div className="mt-5">
                  <PaceBar
                    percentComplete={progress.percentComplete}
                    percentExpected={progress.percentExpected}
                    pace={progress.pace}
                  />
                  <p className="text-[12px] text-ink-muted mt-2.5 leading-relaxed">
                    {progress.varianceUnits >= 0
                      ? `${formatApprox(progress.varianceUnits)} ${unitLabel(progress.varianceUnits, plan.unit)} ahead of the schedule.`
                      : `${formatApprox(Math.abs(progress.varianceUnits))} ${unitLabel(progress.varianceUnits, plan.unit)} short of the schedule.`}{" "}
                    Running at {formatApprox(progress.currentPerWeek)}{" "}
                    {unitLabel(progress.currentPerWeek, plan.unit)} a week; finishing on time
                    needs {formatApprox(progress.requiredPerWeek)}.
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
              <span className="eyebrow">Status</span>
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
                  {s}
                </button>
              ))}
            </div>

            {payload?.other_years && payload.other_years.length > 0 && (
              <div className="flex items-center gap-2.5 flex-wrap mt-3.5">
                <span className="eyebrow">Other years</span>
                {payload.other_years.map((y) => (
                  <button
                    key={y.id}
                    type="button"
                    onClick={() => switchPlan(y.id)}
                    disabled={saving}
                    className="text-[12px] font-semibold px-3 py-1.5 rounded-full border border-surface-border text-ink-muted hover:text-ink hover:border-ink-muted transition disabled:opacity-40"
                  >
                    {y.academic_year} · {y.status}
                  </button>
                ))}
              </div>
            )}

            <div className="gold-rule my-5" />
            {editingPlan ? (
              <div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className={label}>Plan title</label>
                    <input
                      value={editDraft.title}
                      onChange={(e) => setEditDraft({ ...editDraft, title: e.target.value })}
                      className={input}
                    />
                  </div>
                  <div>
                    <label className={label}>Academic year</label>
                    <input
                      value={editDraft.academic_year}
                      onChange={(e) => setEditDraft({ ...editDraft, academic_year: e.target.value })}
                      className={input}
                    />
                  </div>
                  <div>
                    <label className={label}>Counted in</label>
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
                    <label className={label}>Starts</label>
                    <input
                      type="date"
                      value={editDraft.starts_on}
                      onChange={(e) => setEditDraft({ ...editDraft, starts_on: e.target.value })}
                      className={input}
                    />
                  </div>
                  <div>
                    <label className={label}>Ends</label>
                    <input
                      type="date"
                      value={editDraft.ends_on}
                      onChange={(e) => setEditDraft({ ...editDraft, ends_on: e.target.value })}
                      className={input}
                    />
                  </div>
                  {plan.start_surah != null && (
                    <>
                      <div>
                        <label className={label}>New material per instructional day</label>
                        <input
                          type="number"
                          min={0}
                          step="0.25"
                          value={editDraft.dailyNewAmount}
                          onChange={(e) =>
                            setEditDraft({ ...editDraft, dailyNewAmount: Number(e.target.value) })
                          }
                          className={input}
                        />
                        <p className="text-[11.5px] text-ink-muted mt-1">0 turns the daily rate off.</p>
                      </div>
                      <div>
                        <label className={label}>Review per instructional day</label>
                        <input
                          type="number"
                          min={0}
                          step="0.5"
                          value={editDraft.dailyReviewAmount}
                          onChange={(e) =>
                            setEditDraft({ ...editDraft, dailyReviewAmount: Number(e.target.value) })
                          }
                          className={input}
                        />
                      </div>
                    </>
                  )}
                  <div className="sm:col-span-2">
                    <label className={label}>Notes for the year</label>
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
                    {saving ? "Saving…" : "Save changes"}
                  </button>
                  <button onClick={cancelEdit} disabled={saving} className={ghost}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2.5 flex-wrap">
                <button onClick={startEdit} className={ghost}>
                  Edit plan
                </button>
                <button onClick={startNewPlan} className={ghost}>
                  + New plan
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
                    ? "Deleting…"
                    : confirmingDelete
                      ? "Yes, delete this plan"
                      : "Delete plan"}
                </button>
                {confirmingDelete && (
                  <button
                    onClick={() => setConfirmingDelete(false)}
                    disabled={saving}
                    className="text-[12px] font-semibold text-ink-muted hover:text-ink transition-colors"
                  >
                    Cancel
                  </button>
                )}
              </div>
            )}
          </SectionCard>

          <DailyWorkPanel plan={plan} cal={schoolCal} />

          <SectionCard title="Milestones" note={`${milestones.length} segments`}>
            {milestones.length === 0 ? (
              <PlanEmptyState
                title="No milestones yet"
                body="A plan without milestones has no schedule to measure against, so nothing can be marked ahead or behind. Add the first segment below."
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
                              {unitLabel(2, plan.unit)} done in total
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
                            <label className={label}>Note for the parent (optional)</label>
                            <input
                              value={entry.note}
                              onChange={(e) => setEntry({ ...entry, note: e.target.value })}
                              placeholder="e.g. Recited to ayah 18 without prompting"
                              className={input}
                            />
                          </div>
                        </div>
                        <p className="text-[11.5px] text-ink-muted mt-2.5">
                          This is the running total for this milestone, not today&apos;s addition —
                          correcting a figure downwards is fine.
                        </p>
                        <div className="mt-3.5 flex gap-2.5 justify-end">
                          <button onClick={() => setRecording(null)} className={ghost} disabled={saving}>
                            Cancel
                          </button>
                          <button onClick={submitProgress} className={primary} disabled={saving}>
                            {saving ? "Saving…" : "Save progress"}
                          </button>
                        </div>
                      </div>
                    )}
                    <button
                      onClick={() => deleteMilestone(m.id)}
                      disabled={saving}
                      className="text-[11px] font-bold uppercase tracking-[0.1em] text-status-error-text hover:underline disabled:opacity-40 mt-2.5"
                    >
                      Remove
                    </button>
                  </MilestoneRow>
                ))}
                </ul>
              </>
            )}

            <div className="gold-rule my-5" />
            <p className="eyebrow mb-3">Add a milestone</p>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <input
                value={newMilestone.title}
                onChange={(e) => setNewMilestone({ ...newMilestone, title: e.target.value })}
                placeholder="Title"
                className={`${input} sm:col-span-2`}
              />
              <input
                type="date"
                value={newMilestone.starts_on || plan.starts_on}
                onChange={(e) => setNewMilestone({ ...newMilestone, starts_on: e.target.value })}
                className={input}
                aria-label="Milestone start date"
              />
              <input
                type="date"
                value={newMilestone.due_on || addDays(plan.starts_on, 30)}
                onChange={(e) => setNewMilestone({ ...newMilestone, due_on: e.target.value })}
                className={input}
                aria-label="Milestone due date"
              />
              <input
                value={newMilestone.description}
                onChange={(e) => setNewMilestone({ ...newMilestone, description: e.target.value })}
                placeholder="What this segment covers"
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
                placeholder="Target"
                className={input}
                aria-label="Target units"
              />
            </div>
            <div className="mt-3.5 flex justify-end">
              <button onClick={addMilestone} disabled={saving} className={primary}>
                {saving ? "Adding…" : "Add milestone"}
              </button>
            </div>
          </SectionCard>
        </>
      )}

      <MilestoneMushafModal milestone={mushafMilestone} onClose={() => setMushafMilestone(null)} />
    </div>
  );
}
