"use client";

import { useEffect, useState } from "react";
import {
  STAR_REASON_EMOJI,
  STAR_REASON_LABELS,
  BADGES,
  BADGE_EMOJI,
  BADGE_LABELS,
  DEMO_CREATED_STARS_KEY,
  DEMO_CREATED_BADGES_KEY,
  allStars,
  allBadges,
  tierFor,
  nextTier,
  tierPercent,
  type DemoStar,
  type DemoBadge,
  type StarReason,
  type BadgeKind,
} from "@/data/awards";
import { SectionCard, EmptyNote, LoadingNote } from "@/components/portal-ui";
import { readDemoStore } from "@/lib/demoStore";
import { createClient } from "@/lib/supabase/client";

/** Stars, badges and milestone tier for one student. Shown to the student
 *  themselves and to their parent — same record, second person either way,
 *  since a parent reads it aloud as often as a child reads it alone. */
export function AchievementsCard({
  studentId,
  title = "Stars & badges",
  possessive = "You have",
}: {
  studentId: string;
  title?: string;
  possessive?: string;
}) {
  const [stars, setStars] = useState<DemoStar[]>([]);
  const [badges, setBadges] = useState<DemoBadge[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setStars(allStars(readDemoStore(DEMO_CREATED_STARS_KEY, [])).filter((s) => s.studentId === studentId));
        setBadges(allBadges(readDemoStore(DEMO_CREATED_BADGES_KEY, [])).filter((b) => b.studentId === studentId));
        return;
      }

      const [{ data: starRows }, { data: badgeRows }] = await Promise.all([
        supabase
          .from("student_stars")
          .select("id, student_id, reason, note, created_at")
          .eq("student_id", studentId)
          .order("created_at", { ascending: false }),
        supabase
          .from("student_badges")
          .select("id, student_id, badge, created_at")
          .eq("student_id", studentId)
          .order("created_at", { ascending: false }),
      ]);

      setStars(
        (starRows ?? []).map((s) => ({
          id: s.id,
          studentId: s.student_id,
          reason: s.reason as StarReason,
          note: s.note,
          awardedBy: "Your teacher",
          createdAt: (s.created_at ?? "").slice(0, 10),
        }))
      );
      setBadges(
        (badgeRows ?? []).map((b) => ({
          id: b.id,
          studentId: b.student_id,
          badge: b.badge as BadgeKind,
          awardedBy: "Your teacher",
          createdAt: (b.created_at ?? "").slice(0, 10),
        }))
      );
    };

    load().finally(() => setReady(true));
  }, [studentId]);

  const count = stars.length;
  const tier = tierFor(count);
  const next = nextTier(count);
  const percent = tierPercent(count);
  const earned = new Set(badges.map((b) => b.badge));

  return (
    <SectionCard title={title} note={count ? `${count} ${count === 1 ? "star" : "stars"}` : undefined}>
      {!ready ? (
        <LoadingNote />
      ) : count === 0 && badges.length === 0 ? (
        <EmptyNote>No stars yet — they&apos;re given by your teacher for good work.</EmptyNote>
      ) : (
        <div className="space-y-4">
          {/* Tier progress */}
          <div>
            <div className="flex items-baseline justify-between">
              <p className="text-[13px] font-semibold text-ink">
                {tier ? `${tier.emoji} ${tier.label}` : "Working towards Bronze"}
              </p>
              <span className="text-[11px] text-ink-muted tabular-nums">
                {next ? `${next.toGo} to ${next.tier.label}` : "Top tier reached"}
              </span>
            </div>
            <div className="mt-2 h-2 rounded-full bg-surface-bg-warm overflow-hidden">
              <div
                className="h-full gradient-emerald rounded-full transition-all"
                style={{ width: `${percent}%` }}
              />
            </div>
            <p className="text-[11px] text-ink-muted mt-1.5">
              {possessive} {count} {count === 1 ? "star" : "stars"} so far.
            </p>
          </div>

          {/* Badges — every badge shown, earned ones lit up, so there is
              something to aim at rather than only a record of the past. */}
          <div>
            <p className="eyebrow mb-2">Badges</p>
            <div className="flex flex-wrap gap-1.5">
              {BADGES.map((b) => {
                const has = earned.has(b.key);
                return (
                  <span
                    key={b.key}
                    title={b.blurb}
                    className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-colors ${
                      has
                        ? "bg-surface-card border-brand-gold/50 text-ink"
                        : "bg-surface-bg-warm border-surface-border text-ink-muted opacity-60"
                    }`}
                  >
                    <span className={has ? "" : "grayscale"}>{BADGE_EMOJI[b.key]}</span> {BADGE_LABELS[b.key]}
                  </span>
                );
              })}
            </div>
          </div>

          {/* The most recent handful, with whatever the teacher wrote */}
          {stars.length > 0 && (
            <div>
              <p className="eyebrow mb-2">Recent stars</p>
              <ul className="divide-y divide-surface-border -my-1">
                {stars.slice(0, 4).map((s) => (
                  <li key={s.id} className="flex items-start gap-2.5 py-2">
                    <span className="text-base leading-none mt-0.5 flex-shrink-0">
                      {STAR_REASON_EMOJI[s.reason]}
                    </span>
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-ink">{STAR_REASON_LABELS[s.reason]}</p>
                      {s.note && <p className="text-[12px] text-ink mt-0.5">{s.note}</p>}
                      <p className="text-[11px] text-ink-muted mt-0.5">
                        {s.awardedBy} · {s.createdAt}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </SectionCard>
  );
}
