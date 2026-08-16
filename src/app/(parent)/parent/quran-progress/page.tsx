"use client";

import { useState } from "react";
import { getSurahById } from "@/data/mushaf-index";
import { Mushaf } from "@/components/Mushaf";
import {
  DEMO_CHILDREN,
  demoAssignmentsFor,
  formatDay,
  dueLabel,
  ASSIGNMENT_LABELS,
  ASSIGNMENT_STYLES,
  PORTION_LABELS,
  PORTION_ARABIC,
} from "@/data/demo";
import { PortalHero } from "@/components/PortalHero";
import {
  SectionCard,
  StatTile,
  ProgressBar,
  SegmentedSwitch,
  EmptyNote,
  TeacherNote,
} from "@/components/portal-ui";
import { IconArrow } from "@/components/icons";

export default function ParentQuranProgressPage() {
  const [childId, setChildId] = useState(DEMO_CHILDREN[0].id);
  const child = DEMO_CHILDREN.find((c) => c.id === childId) ?? DEMO_CHILDREN[0];
  const [expanded, setExpanded] = useState<string | null>(null);

  // The same records the teacher set and the student sees. This page used to
  // invent its own children and assignments, so a parent switching between
  // portals in a demo saw two different families.
  const assignments = demoAssignmentsFor(child.id);

  const completed = assignments.filter((a) => a.status === "completed").length;
  const avg = assignments.length
    ? Math.round(
        assignments.reduce((sum, a) => sum + a.memorization_level, 0) / assignments.length
      )
    : 0;

  const firstName = child.name.split(" ")[0];

  return (
    <div className="max-w-4xl mx-auto space-y-4 pt-2">
      <PortalHero
        eyebrow="Quranic progress"
        title={firstName}
        meta={[
          child.halaqa,
          `${completed} of ${assignments.length} finished`,
          `${avg}% memorised`,
        ]}
      />

      {DEMO_CHILDREN.length > 1 && (
        <div className="flex items-center gap-3">
          <span className="eyebrow">Viewing</span>
          <SegmentedSwitch
            label="Select child"
            value={childId}
            onChange={(v) => {
              setChildId(v);
              setExpanded(null);
            }}
            options={DEMO_CHILDREN.map((c) => ({ value: c.id, label: c.name.split(" ")[0] }))}
          />
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        <StatTile value={assignments.length} label="Set" sub="this term" />
        <StatTile value={completed} label="Finished" sub={`${assignments.length - completed} still open`} />
        <StatTile value={`${avg}%`} label="Memorised" sub="across all surahs" />
      </div>

      <SectionCard
        title="Assignments"
        note="tap to read the ayahs"
      >
        {assignments.length === 0 ? (
          <EmptyNote>Nothing has been set for {firstName} yet.</EmptyNote>
        ) : (
          <ul className="space-y-1">
            {assignments.map((a) => {
              const surah = getSurahById(a.surah);
              const due = a.status === "completed" ? null : dueLabel(a.due_date);
              const isOpen = expanded === a.id;

              return (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => setExpanded(isOpen ? null : a.id)}
                    aria-expanded={isOpen}
                    className="w-full text-left rounded-xl px-2 py-3 -mx-2 hover:bg-surface-bg-warm transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="eyebrow">
                          {PORTION_LABELS[a.portion]}
                          <span
                            className="font-arabic text-[13px] normal-case tracking-normal ms-2"
                            dir="rtl"
                            lang="ar"
                          >
                            {PORTION_ARABIC[a.portion]}
                          </span>
                        </p>
                        <p className="text-[14px] font-semibold text-ink truncate mt-0.5">
                          {surah ? surah.englishName : `Surah ${a.surah}`}
                          <span className="font-normal text-ink-muted">
                            {" "}
                            · ayahs {a.ayah_start}–{a.ayah_end}
                          </span>
                        </p>
                        <p className="text-[11px] text-ink-muted mt-0.5">
                          Set {formatDay(a.assigned_at)}
                          {due && (
                            <>
                              <span className="mx-1.5">·</span>
                              <span
                                className={
                                  due.urgent ? "text-red-700 dark:text-red-300 font-semibold" : ""
                                }
                              >
                                {due.text}
                              </span>
                            </>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span
                          className={`text-[10px] font-semibold px-2 py-1 rounded-full whitespace-nowrap ${ASSIGNMENT_STYLES[a.status]}`}
                        >
                          {ASSIGNMENT_LABELS[a.status]}
                        </span>
                        <span
                          className={`text-ink-muted transition-transform ${isOpen ? "rotate-90" : ""}`}
                        >
                          <IconArrow size={14} />
                        </span>
                      </div>
                    </div>

                    {/* Capped, because a bar spanning the full width of a
                        desktop card reads as a page loader rather than a
                        measure of one surah. */}
                    <div className="flex items-center gap-2.5 mt-2.5 max-w-xs">
                      <div className="flex-1">
                        <ProgressBar value={a.memorization_level} />
                      </div>
                      <span className="text-[11px] font-semibold text-ink-muted tabular-nums w-8 text-right">
                        {a.memorization_level}%
                      </span>
                    </div>

                    {a.teacher_notes && <TeacherNote>{a.teacher_notes}</TeacherNote>}
                  </button>

                  {isOpen && (
                    <div className="mt-2 mb-3 rounded-2xl border border-surface-border bg-surface-bg-warm p-4">
                      <div className="flex items-baseline justify-between mb-3">
                        <p className="eyebrow">
                          {surah ? surah.englishName : `Surah ${a.surah}`} · ayahs{" "}
                          {a.ayah_start}–{a.ayah_end}
                        </p>
                        <button
                          type="button"
                          onClick={() => setExpanded(null)}
                          className="text-[11px] font-semibold text-ink-muted hover:text-ink transition-colors"
                        >
                          Close
                        </button>
                      </div>
                      <Mushaf
                        initialPage={surah?.startPage ?? 1}
                        highlightedRange={{
                          surah: a.surah,
                          start: a.ayah_start,
                          end: a.ayah_end,
                        }}
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>

      <section className="card-quiet px-6 py-7 text-center">
        <p className="eyebrow">A word of encouragement</p>
        <p className="font-serif text-[15px] text-ink-body italic mt-3 max-w-md mx-auto leading-relaxed">
          Reciting a little with {firstName} each evening does more than a long
          session once a week. Ask them to teach you what they learned today.
        </p>
      </section>
    </div>
  );
}
