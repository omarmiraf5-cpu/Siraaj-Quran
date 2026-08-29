"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useDemoUser } from "@/hooks/useDemoUser";
import {
  DEMO_CHILDREN,
  DEMO_ATTENDANCE,
  DEMO_TODAY,
  DEMO_CREATED_ASSIGNMENTS_KEY,
  demoAssignmentsFor,
  summariseAttendance,
  formatDay,
  dueLabel,
  initials,
  ASSIGNMENT_LABELS,
  ASSIGNMENT_STYLES,
  PORTION_LABELS,
} from "@/data/demo";
import { getSurahById } from "@/data/mushaf-index";
import { readDemoStore } from "@/lib/demoStore";
import type { QuranicAssignment } from "@/hooks/useQuranicAssignments";
import { PortalHero, HeroButtonPrimary, HeroButtonGhost } from "@/components/PortalHero";
import {
  SectionCard,
  StatTile,
  ProgressBar,
  AttendanceStrip,
  AttendanceLegend,
  SegmentedSwitch,
  EmptyNote,
  TeacherNote,
} from "@/components/portal-ui";
import { IconBook, IconChart, IconCalendar, IconArrow } from "@/components/icons";

export default function ParentDashboard() {
  const demoUser = useDemoUser();
  const [childId, setChildId] = useState(DEMO_CHILDREN[0].id);
  const child = DEMO_CHILDREN.find((c) => c.id === childId) ?? DEMO_CHILDREN[0];
  const [createdAssignments, setCreatedAssignments] = useState<QuranicAssignment[]>([]);

  // Assignments a teacher created in the demo since this page's sample data
  // was written; shared via the same browser storage.
  useEffect(() => {
    setCreatedAssignments(readDemoStore(DEMO_CREATED_ASSIGNMENTS_KEY, []));
  }, []);

  const attendance = DEMO_ATTENDANCE[child.id] ?? [];
  const summary = summariseAttendance(attendance);
  const assignments = demoAssignmentsFor(child.id, createdAssignments);

  const active = assignments.filter((a) => a.status !== "completed");
  const done = assignments.filter((a) => a.status === "completed");
  const needsReview = assignments.filter((a) => a.status === "needs_review");
  const memorisation = assignments.length
    ? Math.round(
        assignments.reduce((sum, a) => sum + a.memorization_level, 0) / assignments.length
      )
    : 0;

  // The soonest thing the parent might need to act on.
  const nextDue = active
    .map((a) => a.due_date)
    .filter((d): d is string => Boolean(d))
    .sort()[0];

  const todayStatus = attendance[0]?.status;

  return (
    <div className="max-w-4xl mx-auto space-y-4 pt-2">
      <PortalHero
        eyebrow="Asalaamu alaykum"
        title={demoUser?.name ?? "Parent"}
        meta={[
          formatDay(DEMO_TODAY),
          `${child.name.split(" ")[0]} was ${todayStatus ?? "not marked"} today`,
          active.length === 1 ? "1 piece of work open" : `${active.length} pieces of work open`,
        ]}
        actions={
          <>
            <HeroButtonPrimary href="/parent/quran-progress" icon={<IconChart />}>
              Progress
            </HeroButtonPrimary>
            <HeroButtonGhost href="/parent/attendance" icon={<IconCalendar />}>
              Attendance
            </HeroButtonGhost>
          </>
        }
      />

      {/* Which child. A parent with one child never sees this. */}
      {DEMO_CHILDREN.length > 1 && (
        <div className="flex items-center gap-3">
          <span className="eyebrow">Viewing</span>
          <SegmentedSwitch
            label="Select child"
            value={childId}
            onChange={setChildId}
            options={DEMO_CHILDREN.map((c) => ({ value: c.id, label: c.name.split(" ")[0] }))}
          />
        </div>
      )}

      {/* At a glance, in the parent's terms rather than the school's. */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile
          value={`${summary.rate}%`}
          label="Attendance"
          sub={`${summary.present + summary.late} of ${summary.total - summary.excused} days`}
        />
        <StatTile
          value={`${memorisation}%`}
          label="Memorised"
          sub={`across ${assignments.length} surahs`}
        />
        <StatTile
          value={active.length}
          label="Open work"
          sub={nextDue ? `next due ${formatDay(nextDue)}` : "nothing due"}
        />
        <StatTile
          value={done.length}
          label="Completed"
          sub={done.length ? "well done" : "none yet"}
        />
      </div>

      <div className="grid md:grid-cols-2 gap-3 items-start">
        {/* The work itself, not a link to it. */}
        <SectionCard
          title="Current work"
          note={`${assignments.length} total`}
        >
          {assignments.length === 0 ? (
            <EmptyNote>Nothing has been set yet.</EmptyNote>
          ) : (
            <ul className="space-y-4">
              {assignments.map((a) => {
                const surah = getSurahById(a.surah);
                const surahEnd = a.surah_end !== a.surah ? getSurahById(a.surah_end) : null;
                const due = a.status === "completed" ? null : dueLabel(a.due_date);
                return (
                  <li key={a.id}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="eyebrow underline decoration-2 underline-offset-2 text-ink">
                          {PORTION_LABELS[a.portion]}
                        </p>
                        <p className="text-[13px] font-semibold text-ink truncate mt-0.5">
                          {surahEnd ? (
                            `${surah?.englishName ?? `Surah ${a.surah}`} ${a.ayah_start} – ${surahEnd.englishName} ${a.ayah_end}`
                          ) : (
                            <>
                              {surah ? surah.englishName : `Surah ${a.surah}`}
                              <span className="font-normal text-ink-muted">
                                {" "}
                                · ayahs {a.ayah_start}–{a.ayah_end}
                              </span>
                            </>
                          )}
                        </p>
                        {due && (
                          <p
                            className={`text-[11px] mt-0.5 ${
                              due.urgent
                                ? "text-red-700 dark:text-red-300 font-semibold"
                                : "text-ink-muted"
                            }`}
                          >
                            {due.text}
                          </p>
                        )}
                      </div>
                      <span
                        className={`text-[10px] font-semibold px-2 py-1 rounded-full flex-shrink-0 whitespace-nowrap ${ASSIGNMENT_STYLES[a.status]}`}
                      >
                        {ASSIGNMENT_LABELS[a.status]}
                      </span>
                    </div>

                    <div className="flex items-center gap-2.5 mt-2">
                      <div className="flex-1">
                        <ProgressBar value={a.memorization_level} />
                      </div>
                      <span className="text-[11px] font-semibold text-ink-muted tabular-nums w-8 text-right">
                        {a.memorization_level}%
                      </span>
                    </div>

                    {a.teacher_notes && <TeacherNote>{a.teacher_notes}</TeacherNote>}
                  </li>
                );
              })}
            </ul>
          )}

          <Link
            href="/parent/quran-progress"
            className="group mt-4 inline-flex items-center gap-1.5 text-[12px] font-semibold text-ink-muted hover:text-ink transition-colors"
          >
            Open progress
            <span className="group-hover:translate-x-0.5 transition-transform">
              <IconArrow size={14} />
            </span>
          </Link>
        </SectionCard>

        {/* Attendance, summarised the way a parent reads it. */}
        <SectionCard title="Attendance" note={`last ${summary.total} days`}>
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-[34px] font-bold text-ink tabular-nums leading-none">
                {summary.rate}%
              </p>
              <p className="text-[12px] text-ink-muted mt-1.5">
                {summary.rate >= 95
                  ? "Excellent — thank you for your support."
                  : summary.rate >= 85
                    ? "Good, with a little room to improve."
                    : "Below the school's 85% target."}
              </p>
            </div>
            <span
              className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 ${
                summary.rate >= 95
                  ? "bg-green-100 dark:bg-green-950/30 text-green-700 dark:text-green-300"
                  : summary.rate >= 85
                    ? "bg-amber-100 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300"
                    : "bg-red-100 dark:bg-red-950/30 text-red-700 dark:text-red-300"
              }`}
            >
              {initials(child.name)}
            </span>
          </div>

          <div className="mt-4">
            <AttendanceStrip days={attendance} />
          </div>

          <div className="mt-4">
            <AttendanceLegend counts={summary} />
          </div>

          {needsReview.length > 0 && (
            <p className="text-[12px] text-ink-body mt-4 pt-4 border-t border-surface-border">
              {needsReview.length === 1
                ? "One piece of work is waiting on the teacher's review."
                : `${needsReview.length} pieces of work are waiting on the teacher's review.`}
            </p>
          )}

          <Link
            href="/parent/attendance"
            className="group mt-4 inline-flex items-center gap-1.5 text-[12px] font-semibold text-ink-muted hover:text-ink transition-colors"
          >
            Open attendance
            <span className="group-hover:translate-x-0.5 transition-transform">
              <IconArrow size={14} />
            </span>
          </Link>
        </SectionCard>
      </div>

      {/* The Mushaf has no state to summarise, so it stays a link. */}
      <Link
        href="/parent/mushaf"
        className="card-quiet card-feature group flex items-center gap-3.5 px-5 py-4 transition-all hover:-translate-y-0.5 hover:shadow-lg"
      >
        <span className="icon-tile flex-shrink-0">
          <IconBook size={19} />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block page-title text-[15px]">Mushaf</span>
          <span className="block text-[12px] text-ink-muted">
            Read along with {child.name.split(" ")[0]}, and play any ayah aloud.
          </span>
        </span>
        <span className="text-ink-muted group-hover:translate-x-0.5 group-hover:text-ink transition-all flex-shrink-0">
          <IconArrow size={14} />
        </span>
      </Link>

      <section className="card-quiet px-6 py-8 text-center">
        <p className="eyebrow">Daily reflection</p>
        <p
          className="font-calligraphy text-[28px] md:text-[34px] text-ink mt-4 leading-[2.1]"
          dir="rtl"
          lang="ar"
        >
          وَقُل رَّبِّ زِدْنِي عِلْمًا
        </p>
        <div className="gold-rule w-20 mx-auto my-5" />
        <p className="font-serif text-[15px] text-ink-body italic">
          &ldquo;And say: My Lord, increase me in knowledge.&rdquo;
        </p>
        <p className="text-[11px] text-ink-muted mt-2">Surah Ta-Ha, 114</p>
      </section>
    </div>
  );
}
