"use client";

import { useEffect, useMemo, useState } from "react";
import { getSurahById } from "@/data/mushaf-index";
import type { QuranicAssignment } from "@/hooks/useQuranicAssignments";
import { milestonesFor, type Milestone } from "@/lib/milestones";
import { useLanguage } from "@/components/LanguageProvider";

const RECENT_DAYS = 14;
const keyOf = (studentId: string, m: Milestone) =>
  `milestone-seen:${studentId}:${m.kind}:${m.kind === "surah" ? m.surah : m.juz}`;

/**
 * Cheers on a child's home page: a congratulation for the surah or juz' they
 * most recently finished (for two weeks), and an encouraging nudge while a
 * juz' sits between 40% and 50% — nearly halfway. Each can be closed, and
 * stays closed on that device. `firstName` is given when a parent is looking
 * in on a child; omit it for the student's own view.
 */
export function MilestoneBanner({
  studentId,
  assignments,
  firstName,
}: {
  studentId: string;
  assignments: QuranicAssignment[];
  firstName?: string;
}) {
  const { tr } = useLanguage();
  const [closed, setClosed] = useState<Set<string>>(new Set());

  useEffect(() => {
    const seen = new Set<string>();
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k?.startsWith(`milestone-seen:${studentId}:`)) seen.add(k);
      }
    } catch {
      /* Private window: they just come back next time. */
    }
    setClosed(seen);
  }, [studentId]);

  const shown = useMemo(() => {
    const all = milestonesFor(assignments);
    const cutoff = new Date(Date.now() - RECENT_DAYS * 864e5).toISOString();
    const cheer = all.find((m) => m.kind !== "almost_half" && m.at >= cutoff);
    const nudge = all.find((m) => m.kind === "almost_half");
    return [cheer, nudge].filter((m): m is Milestone => Boolean(m) && !closed.has(keyOf(studentId, m as Milestone)));
  }, [assignments, closed, studentId]);

  if (shown.length === 0) return null;

  const close = (m: Milestone) => {
    const k = keyOf(studentId, m);
    try {
      localStorage.setItem(k, "1");
    } catch {
      /* As above. */
    }
    setClosed((c) => new Set(c).add(k));
  };

  const text = (m: Milestone): { icon: string; title: string; body: string; tone: string } => {
    const you = !firstName;
    if (m.kind === "surah") {
      const name = getSurahById(m.surah)?.englishName ?? String(m.surah);
      return {
        icon: "🎉",
        title: you ? tr("Mashaa Allah! You finished Surah {name}.", { name }) : tr("Mashaa Allah! {child} finished Surah {name}.", { child: firstName!, name }),
        body: you ? tr("A whole surah, learnt by heart. Well done!") : tr("A kind word from you will mean a lot today."),
        tone: "bg-emerald-50 border-emerald-200 text-emerald-900 dark:bg-emerald-950/30 dark:border-emerald-800/40 dark:text-emerald-100",
      };
    }
    if (m.kind === "juz") {
      return {
        icon: "🌟",
        title: you ? tr("Congratulations! Juz' {juz} is complete.", { juz: m.juz }) : tr("Congratulations! {child} completed Juz' {juz}.", { child: firstName!, juz: m.juz }),
        body: you ? tr("A whole juz' learnt by heart. Mashaa Allah!") : tr("Please make du'a for them and tell them how proud you are."),
        tone: "bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-950/30 dark:border-amber-800/40 dark:text-amber-100",
      };
    }
    return {
      icon: "💪",
      title: you ? tr("You're almost halfway through Juz' {juz}!", { juz: m.juz }) : tr("{child} is almost halfway through Juz' {juz}!", { child: firstName!, juz: m.juz }),
      body: you ? tr("{percent}% done. Keep going — you can do it.", { percent: Math.floor(m.percent) }) : tr("{percent}% done. A little encouragement now helps them keep going.", { percent: Math.floor(m.percent) }),
      tone: "bg-sky-50 border-sky-200 text-sky-900 dark:bg-sky-950/30 dark:border-sky-800/40 dark:text-sky-100",
    };
  };

  return (
    <div className="space-y-2.5" data-section="milestones">
      {shown.map((m) => {
        const t = text(m);
        return (
          <div key={keyOf(studentId, m)} role="status" className={`flex items-start gap-3 rounded-3xl border px-4 py-4 ${t.tone}`}>
            <span className="text-3xl leading-none" aria-hidden>
              {t.icon}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-[15px] leading-snug [overflow-wrap:anywhere]">{t.title}</p>
              <p className="text-[13px] opacity-80 mt-0.5">{t.body}</p>
            </div>
            <button type="button" onClick={() => close(m)} aria-label={tr("Close")} className="flex-shrink-0 text-[18px] leading-none opacity-60 hover:opacity-100 px-1">
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}
