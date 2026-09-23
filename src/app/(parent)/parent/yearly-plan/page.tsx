"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PortalHero } from "@/components/PortalHero";
import { LoadingNote, SectionCard, SegmentedSwitch } from "@/components/portal-ui";
import {
  DailyWorkPanel,
  FullYearScheduleModal,
  MilestoneMushafModal,
  MilestoneRow,
  PaceBar,
  PaceChip,
  PaceDial,
  PlanAlertBanner,
  PlanEmptyState,
  PlanFigure,
  paceColor,
} from "@/components/yearly-plan-ui";
import { buildCalendar, DEFAULT_CALENDAR, type SchoolCalendar } from "@/lib/schoolCalendar";
import { usePortalRoster } from "@/hooks/usePortalRoster";
import {
  formatApprox,
  formatQuantity,
  formatUnits,
  readable,
  slicePlan,
  unitLabel,
  todayISO,
  type Milestone,
  type PeriodGrain,
  type Plan,
  type PlanProgress,
  type ProgressEntry,
} from "@/lib/yearlyPlan";

/**
 * Parent side of the yearly plan: one child's year, filterable down to a
 * month or a week, with the behind-schedule banner on top.
 *
 * Scoping is not done here. The request carries the parent's own session
 * and the "Parents can read own children plans" policy narrows it to their
 * children — asking for another family's student_id returns the same empty
 * payload as asking for one that does not exist. The child picker below is
 * built from the roster RLS already handed back, so it can only ever list
 * children this parent is linked to.
 */

interface AlertDto {
  id: string;
  code: string;
  level: "info" | "warning" | "critical";
  title: string;
  detail: string;
  acknowledged_at: string | null;
}
interface PlanPayload {
  plan: Plan | null;
  milestones: Milestone[];
  entries: ProgressEntry[];
  alerts: AlertDto[];
  progress?: PlanProgress;
}

export default function ParentYearlyPlanPage() {
  const { mode, students: children } = usePortalRoster();
  const [childId, setChildId] = useState<string | null>(null);
  const [payload, setPayload] = useState<PlanPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Held separately from the message so the page can recognise the
  // not-configured case without matching on prose.
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [grain, setGrain] = useState<PeriodGrain>("year");
  const [periodIndex, setPeriodIndex] = useState<number | null>(null);
  const [acknowledging, setAcknowledging] = useState<string | null>(null);
  const [mushafMilestone, setMushafMilestone] = useState<Milestone | null>(null);
  const [showFullYear, setShowFullYear] = useState(false);
  const today = todayISO();

  useEffect(() => {
    if (!childId && children.length > 0) setChildId(children[0].id);
  }, [children, childId]);

  const child = children.find((c) => c.id === childId) ?? null;

  const load = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    setErrorCode(null);
    try {
      const res = await fetch(`/api/yearly-plans?student_id=${encodeURIComponent(id)}`);
      const body = await res.json();
      if (!res.ok) {
        // Server error text is for staff, not for a family. It names
        // tables, environment variables and policies — a parent reading
        // "PLAN_ENCRYPTION_KEY is not configured on the server" learns
        // nothing they can act on and quite a lot they shouldn't see. The
        // real message goes to the console for whoever is supporting the
        // school; the parent gets a sentence.
        console.error("Yearly plan load failed:", body?.error ?? res.status);
        setErrorCode(body?.code ?? null);
        setError(
          body?.code === "encryption_not_configured"
            ? null
            : "We couldn't load the plan just now. Please try again in a moment."
        );
        setPayload(null);
        return;
      }
      setPayload(body);
    } catch (err) {
      console.error("Yearly plan load failed:", err);
      setError("We couldn't load the plan just now. Please try again in a moment.");
      setPayload(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (mode !== "real" || !childId) return;
    load(childId);
  }, [mode, childId, load]);

  // The school's own calendar, for the same "this week's work" panel the
  // teacher page reads it for. Fetched once, not per child — a family with
  // two children at the same school sees the same instructional days for
  // both.
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

  const plan = payload?.plan ?? null;
  const milestones = useMemo(() => payload?.milestones ?? [], [payload]);
  const entries = useMemo(() => payload?.entries ?? [], [payload]);
  const progress = payload?.progress;

  const slices = useMemo(() => {
    if (!plan) return [];
    return slicePlan(plan, milestones, entries, grain, today);
  }, [plan, milestones, entries, grain, today]);

  // Opening on the window containing today, rather than on the first one.
  // A parent in March wants March, and scrolling back seven months to find
  // it is the kind of small friction that stops a page being opened again.
  useEffect(() => {
    if (slices.length === 0) {
      setPeriodIndex(null);
      return;
    }
    const current = slices.findIndex((s) => s.isCurrent);
    setPeriodIndex(current >= 0 ? current : slices.length - 1);
  }, [slices]);

  const slice = periodIndex != null ? slices[periodIndex] : undefined;

  const acknowledge = async (id: string) => {
    setAcknowledging(id);
    try {
      const res = await fetch("/api/yearly-plans/alerts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Could not dismiss that notice");
      setPayload((prev) =>
        prev
          ? {
              ...prev,
              alerts: prev.alerts.map((a) =>
                a.id === id ? { ...a, acknowledged_at: body.acknowledged_at } : a
              ),
            }
          : prev
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not dismiss that notice");
    } finally {
      setAcknowledging(null);
    }
  };

  if (mode === "loading") {
    return (
      <div className="space-y-6 max-w-6xl">
        <LoadingNote>Loading…</LoadingNote>
      </div>
    );
  }

  if (mode === "demo") {
    return (
      <div className="space-y-6 max-w-6xl">
        <PortalHero eyebrow="Parent" title="Yearly plan" />
        <SectionCard title="Sign in to see your child's plan">
          <PlanEmptyState
            title="This is the sample portal"
            body="Yearly plans are held encrypted against a real school's records, so there is nothing to show here. Sign in with the details your school gave you."
          />
        </SectionCard>
      </div>
    );
  }

  // Unacknowledged first: a parent who has already dismissed February's
  // notice should not have it sitting above the one raised this morning.
  const alerts = [...(payload?.alerts ?? [])].sort(
    (a, b) => Number(Boolean(a.acknowledged_at)) - Number(Boolean(b.acknowledged_at))
  );

  return (
    <div className="space-y-6 max-w-6xl">
      <PortalHero
        eyebrow="Parent"
        title="Yearly plan"
        meta={[child ? child.name : "—", plan ? plan.academic_year : "No plan yet"]}
      />

      {children.length > 1 && (
        <SectionCard title="Child">
          <div className="flex flex-wrap gap-2">
            {children.map((c) => (
              <button
                key={c.id}
                onClick={() => setChildId(c.id)}
                className={`px-4 py-2 rounded-full text-[13px] font-semibold border transition ${
                  c.id === childId
                    ? "bg-brand-navy text-white border-brand-navy"
                    : "border-surface-border text-ink-muted hover:text-ink hover:border-ink-muted"
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        </SectionCard>
      )}

      {errorCode === "encryption_not_configured" && (
        <SectionCard title="Yearly plan">
          <PlanEmptyState
            title="Not switched on yet"
            body="Your school hasn't finished setting up yearly plans. Nothing is wrong with your account — this page will fill in once they have."
          />
        </SectionCard>
      )}

      {error && (
        <p className="text-[13px] text-status-error-text bg-status-error-bg rounded-xl px-4 py-3">
          {error}
        </p>
      )}

      {loading && <LoadingNote>Loading the plan…</LoadingNote>}

      {!loading && payload && !plan && (
        <SectionCard title="Yearly plan">
          <PlanEmptyState
            title="No plan has been set yet"
            body={`${
              child?.name ?? "Your child"
            } does not have a yearly plan on file. Their teacher sets one out at the start of the year — it will appear here as soon as it does.`}
          />
        </SectionCard>
      )}

      {plan && progress && (
        <>
          {alerts.length > 0 && (
            <div className="space-y-2.5">
              {alerts.map((a) => (
                <PlanAlertBanner
                  key={a.id}
                  level={a.level}
                  title={a.title}
                  detail={a.detail}
                  acknowledged={Boolean(a.acknowledged_at)}
                  busy={acknowledging === a.id}
                  onAcknowledge={() => acknowledge(a.id)}
                />
              ))}
            </div>
          )}

          <SectionCard
            title={readable(plan.title, "This year")}
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
                  <PlanFigure
                    value={formatApprox(progress.expectedUnits)}
                    label="expected by today"
                  />
                  <PlanFigure value={formatQuantity(progress.totalUnits)} label="the whole year" />
                  <PlanFigure value={progress.daysRemaining} label="days left" />
                </div>
                <div className="mt-5">
                  <PaceBar
                    percentComplete={progress.percentComplete}
                    percentExpected={progress.percentExpected}
                    pace={progress.pace}
                  />
                  {/* Written as a sentence rather than left as two
                      percentages: "62% vs 71%" needs decoding, and the
                      thing a parent actually wants to know is the gap. */}
                  <p className="text-[12.5px] text-ink-body mt-2.5 leading-relaxed">
                    {progress.varianceUnits >= 0
                      ? `${child?.name ?? "Your child"} is ${`${formatApprox(progress.varianceUnits)} ${unitLabel(progress.varianceUnits, plan.unit)}`} ahead of where the plan expects them today.`
                      : `${child?.name ?? "Your child"} is ${`${formatApprox(Math.abs(progress.varianceUnits))} ${unitLabel(progress.varianceUnits, plan.unit)}`} short of where the plan expects them today.`}{" "}
                    At the current pace the year finishes at about{" "}
                    {formatApprox(progress.projectedUnits)} of {formatQuantity(progress.totalUnits)}.
                  </p>
                </div>
              </div>
            </div>

            {plan.notes && (
              <>
                <div className="gold-rule my-5" />
                <p className="eyebrow mb-2">From the teacher</p>
                <p className="text-[13px] text-ink-body leading-relaxed whitespace-pre-line">
                  {readable(plan.notes)}
                </p>
              </>
            )}
          </SectionCard>

          <DailyWorkPanel
            plan={plan}
            cal={schoolCal}
            totalUnits={progress.totalUnits}
            onViewFullYear={() => setShowFullYear(true)}
          />

          <SectionCard
            title="Break it down"
            note={
              <SegmentedSwitch<PeriodGrain>
                label="Choose a period"
                value={grain}
                onChange={setGrain}
                options={[
                  { value: "year", label: "Year" },
                  { value: "month", label: "Month" },
                  { value: "week", label: "Week" },
                ]}
              />
            }
          >
            {grain !== "year" && slices.length > 0 && periodIndex != null && (
              <div className="flex items-center justify-between gap-3 mb-5">
                <button
                  onClick={() => setPeriodIndex(Math.max(0, periodIndex - 1))}
                  disabled={periodIndex === 0}
                  className="px-3 py-2 rounded-lg border border-surface-border text-ink-muted hover:text-ink disabled:opacity-30 transition"
                  aria-label="Previous period"
                >
                  {/* A chevron: two line segments, nothing representational. */}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="rtl:rotate-180">
                    <path d="M15 18 9 12l6-6" />
                  </svg>
                </button>
                <div className="text-center min-w-0">
                  <p className="page-title text-[15px] truncate">{slice?.label}</p>
                  {slice?.isCurrent && (
                    <p className="eyebrow mt-1 text-brand-gold-dark">Current</p>
                  )}
                </div>
                <button
                  onClick={() => setPeriodIndex(Math.min(slices.length - 1, periodIndex + 1))}
                  disabled={periodIndex >= slices.length - 1}
                  className="px-3 py-2 rounded-lg border border-surface-border text-ink-muted hover:text-ink disabled:opacity-30 transition"
                  aria-label="Next period"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="rtl:rotate-180">
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                </button>
              </div>
            )}

            {slice && grain !== "year" && (
              <div className="rounded-xl border border-surface-border bg-surface-bg-warm px-4 py-3.5 mb-5">
                <div className="flex items-baseline justify-between gap-3 flex-wrap">
                  <p className="text-[13px] text-ink-body">
                    <span className="font-semibold text-ink tabular-nums">
                      {formatApprox(slice.actualUnits)}
                    </span>{" "}
                    of{" "}
                    <span className="font-semibold text-ink tabular-nums">
                      {formatApprox(slice.expectedUnits)}
                    </span>{" "}
                    {unitLabel(2, plan.unit)} expected in this {grain}
                  </p>
                  <span className="eyebrow">
                    {slice.from} — {slice.to}
                  </span>
                </div>
                <div className="mt-3">
                  <PaceBar
                    percentComplete={
                      slice.expectedUnits > 0
                        ? (slice.actualUnits / slice.expectedUnits) * 100
                        : slice.actualUnits > 0
                          ? 100
                          : 0
                    }
                    pace={
                      slice.expectedUnits <= 0
                        ? "not_started"
                        : slice.actualUnits >= slice.expectedUnits * 0.95
                          ? "on_track"
                          : slice.actualUnits >= slice.expectedUnits * 0.85
                            ? "at_risk"
                            : "behind"
                    }
                    height={6}
                    showNotch={false}
                  />
                </div>
              </div>
            )}

            {(() => {
              const shown =
                grain === "year"
                  ? milestones
                  : (slice?.dueMilestones.length ?? 0) > 0
                    ? slice!.dueMilestones
                    : (slice?.activeMilestones ?? []);

              if (shown.length === 0) {
                return (
                  <PlanEmptyState
                    title={
                      grain === "year" ? "No milestones set yet" : `Nothing falls due in this ${grain}`
                    }
                    body={
                      grain === "year"
                        ? "The teacher has created the plan but not yet broken it into segments."
                        : "Work still counts towards the next milestone — use the arrows above to look ahead or back."
                    }
                  />
                );
              }

              return (
                <ul className="divide-y divide-surface-border">
                  {shown.map((m) => {
                    const notes = entries
                      .filter((e) => e.milestone_id === m.id && e.note)
                      .slice(-2);
                    return (
                      <MilestoneRow
                        key={m.id}
                        milestone={m}
                        unit={plan.unit}
                        today={today}
                        onViewMushaf={setMushafMilestone}
                      >
                        {notes.length > 0 && (
                          <div className="mt-3 space-y-1.5">
                            {notes.map((n) => (
                              <p
                                key={n.id}
                                className="text-[12.5px] text-ink-muted leading-relaxed ps-3 border-s-2 border-brand-gold/40"
                              >
                                <span className="tabular-nums">{n.recorded_on}</span> — {n.note}
                              </p>
                            ))}
                          </div>
                        )}
                      </MilestoneRow>
                    );
                  })}
                </ul>
              );
            })()}
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
