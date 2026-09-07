"use client";

import { useEffect, useState } from "react";
import {
  DEMO_STUDENTS,
  DEMO_CREATED_STUDENTS_KEY,
  DEMO_STUDENT_OVERRIDES_KEY,
  allStudents,
  initials,
  type DemoStudent,
  type StudentOverride,
} from "@/data/demo";
import {
  STAR_REASONS,
  BADGES,
  STAR_REASON_LABELS,
  STAR_REASON_EMOJI,
  BADGE_EMOJI,
  BADGE_LABELS,
  DEMO_CREATED_STARS_KEY,
  DEMO_CREATED_BADGES_KEY,
  allStars,
  allBadges,
  tierFor,
  nextTier,
  type DemoStar,
  type DemoBadge,
  type StarReason,
  type BadgeKind,
} from "@/data/awards";
import { PortalHero } from "@/components/PortalHero";
import { SectionCard, EmptyNote, LoadingNote } from "@/components/portal-ui";
import { readDemoStore, writeDemoStore } from "@/lib/demoStore";
import { createClient } from "@/lib/supabase/client";

export default function TeacherAwardsPage() {
  const supabase = createClient();
  const [isDemo, setIsDemo] = useState(false);
  const [ready, setReady] = useState(false);
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [teacherId, setTeacherId] = useState<string | null>(null);

  const [students, setStudents] = useState<DemoStudent[]>([]);
  const [stars, setStars] = useState<DemoStar[]>([]);
  const [badges, setBadges] = useState<DemoBadge[]>([]);
  const [createdStars, setCreatedStars] = useState<DemoStar[]>([]);
  const [createdBadges, setCreatedBadges] = useState<DemoBadge[]>([]);

  const [studentId, setStudentId] = useState("");
  const [reason, setReason] = useState<StarReason>("effort");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  const loadReal = async () => {
    const [{ data: starRows }, { data: badgeRows }] = await Promise.all([
      supabase
        .from("student_stars")
        .select("id, student_id, reason, note, created_at")
        .order("created_at", { ascending: false }),
      supabase
        .from("student_badges")
        .select("id, student_id, badge, created_at")
        .order("created_at", { ascending: false }),
    ]);
    setStars(
      (starRows ?? []).map((s) => ({
        id: s.id,
        studentId: s.student_id,
        reason: s.reason as StarReason,
        note: s.note,
        awardedBy: "You",
        createdAt: (s.created_at ?? "").slice(0, 10),
      }))
    );
    setBadges(
      (badgeRows ?? []).map((b) => ({
        id: b.id,
        studentId: b.student_id,
        badge: b.badge as BadgeKind,
        awardedBy: "You",
        createdAt: (b.created_at ?? "").slice(0, 10),
      }))
    );
  };

  useEffect(() => {
    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setIsDemo(true);
        const cs = readDemoStore<DemoStar[]>(DEMO_CREATED_STARS_KEY, []);
        const cb = readDemoStore<DemoBadge[]>(DEMO_CREATED_BADGES_KEY, []);
        setCreatedStars(cs);
        setCreatedBadges(cb);
        setStars(allStars(cs));
        setBadges(allBadges(cb));
        setStudents(
          allStudents(
            readDemoStore(DEMO_CREATED_STUDENTS_KEY, []),
            readDemoStore<Record<string, StudentOverride>>(DEMO_STUDENT_OVERRIDES_KEY, {})
          )
        );
        return;
      }

      setTeacherId(user.id);
      const { data: profile } = await supabase
        .from("profiles")
        .select("school_id")
        .eq("id", user.id)
        .single();
      setSchoolId(profile?.school_id ?? null);

      const { data: studentRows } = await supabase
        .from("students")
        .select("id, full_name, active")
        .order("full_name");
      setStudents(
        (studentRows ?? []).map((s) => ({ id: s.id, name: s.full_name, halaqa: "", active: s.active }))
      );
      await loadReal();
    };
    load().finally(() => setReady(true));
  }, []);

  const say = (message: string) => {
    setFlash(message);
    setTimeout(() => setFlash(null), 3500);
  };

  const awardStar = async () => {
    if (!studentId) return;
    const student = students.find((s) => s.id === studentId);

    if (isDemo) {
      const star: DemoStar = {
        id: `local-star-${Date.now()}`,
        studentId,
        reason,
        note: note.trim() || null,
        awardedBy: "You",
        createdAt: new Date().toISOString().slice(0, 10),
      };
      const next = [...createdStars, star];
      setCreatedStars(next);
      writeDemoStore(DEMO_CREATED_STARS_KEY, next);
      setStars(allStars(next));
      setNote("");
      say(`${STAR_REASON_EMOJI[reason]} Star given to ${student?.name ?? "the student"}.`);
      return;
    }

    setSaving(true);
    const { error } = await supabase.from("student_stars").insert({
      student_id: studentId,
      teacher_id: teacherId,
      school_id: schoolId,
      reason,
      note: note.trim() || null,
    });
    setSaving(false);
    if (error) {
      say(error.message);
      return;
    }
    await loadReal();
    setNote("");
    say(`${STAR_REASON_EMOJI[reason]} Star given to ${student?.name ?? "the student"}.`);
  };

  const awardBadge = async (badge: BadgeKind) => {
    if (!studentId) return;
    const student = students.find((s) => s.id === studentId);
    const already = badges.some((b) => b.studentId === studentId && b.badge === badge);
    if (already) {
      say(`${student?.name ?? "They"} already has the ${BADGE_LABELS[badge]} badge.`);
      return;
    }

    if (isDemo) {
      const record: DemoBadge = {
        id: `local-badge-${Date.now()}`,
        studentId,
        badge,
        awardedBy: "You",
        createdAt: new Date().toISOString().slice(0, 10),
      };
      const next = [...createdBadges, record];
      setCreatedBadges(next);
      writeDemoStore(DEMO_CREATED_BADGES_KEY, next);
      setBadges(allBadges(next));
      say(`${BADGE_EMOJI[badge]} ${BADGE_LABELS[badge]} awarded to ${student?.name ?? "the student"}.`);
      return;
    }

    const { error } = await supabase.from("student_badges").insert({
      student_id: studentId,
      teacher_id: teacherId,
      school_id: schoolId,
      badge,
    });
    if (error) {
      say(error.message);
      return;
    }
    await loadReal();
    say(`${BADGE_EMOJI[badge]} ${BADGE_LABELS[badge]} awarded to ${student?.name ?? "the student"}.`);
  };

  const selected = students.find((s) => s.id === studentId);
  const theirStars = stars.filter((s) => s.studentId === studentId);
  const theirBadges = badges.filter((b) => b.studentId === studentId);
  const tier = tierFor(theirStars.length);
  const next = nextTier(theirStars.length);

  return (
    <div className="max-w-3xl mx-auto pb-20 space-y-4 pt-2">
      <PortalHero
        eyebrow="Recognition"
        title="Stars & badges"
        meta={[`${stars.length} stars given`, `${badges.length} badges awarded`]}
      />

      {flash && (
        <div className="card-quiet p-4 text-sm text-ink border border-emerald-600/30">{flash}</div>
      )}

      <SectionCard title="Give recognition">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-ink mb-2">Student</label>
            <select
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              className="w-full bg-surface-card border border-surface-border rounded-2xl px-4 py-3 text-ink focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/40 transition"
            >
              <option value="">Choose a student…</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {selected && (
            <>
              {/* Where they stand, so the teacher can see what a star is
                  worth to this student right now rather than guessing. */}
              <div className="rounded-2xl border border-surface-border bg-surface-bg-warm p-4">
                <div className="flex items-center gap-3">
                  <span className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-[12px] flex-shrink-0 bg-brand-navy/10 text-brand-navy dark:text-brand-gold">
                    {initials(selected.name)}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-ink">{selected.name}</p>
                    <p className="text-[11px] text-ink-muted">
                      {theirStars.length} {theirStars.length === 1 ? "star" : "stars"}
                      {tier ? ` · ${tier.emoji} ${tier.label}` : ""}
                      {next ? ` · ${next.toGo} to ${next.tier.label}` : " · top tier"}
                    </p>
                  </div>
                </div>
                {theirBadges.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {theirBadges.map((b) => (
                      <span
                        key={b.id}
                        className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-surface-card border border-surface-border text-ink"
                      >
                        {BADGE_EMOJI[b.badge]} {BADGE_LABELS[b.badge]}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-ink mb-2">Star for</label>
                <div className="flex flex-wrap gap-2">
                  {STAR_REASONS.map((r) => (
                    <button
                      key={r.key}
                      type="button"
                      onClick={() => setReason(r.key)}
                      className={`px-3.5 py-2 rounded-full text-sm font-semibold transition-all ${
                        reason === r.key
                          ? "gradient-emerald text-white"
                          : "bg-surface-card border border-surface-border text-ink-muted hover:text-ink"
                      }`}
                    >
                      {r.emoji} {r.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-ink mb-2">
                  Note home <span className="font-normal text-ink-muted">(optional)</span>
                </label>
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. Stayed behind to go over the hard ayahs."
                  className="w-full bg-surface-card border border-surface-border rounded-2xl px-4 py-3 text-ink focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/40 transition"
                />
              </div>

              <button
                type="button"
                onClick={awardStar}
                disabled={saving}
                className="w-full gradient-emerald text-white font-semibold py-3 rounded-2xl disabled:opacity-40 hover:opacity-90 active:scale-95 transition-all"
              >
                {saving ? "Giving…" : `Give a star for ${STAR_REASON_LABELS[reason].toLowerCase()}`}
              </button>

              <div className="border-t border-surface-border pt-4">
                <p className="text-sm font-semibold text-ink mb-2">Award a badge</p>
                <div className="grid sm:grid-cols-2 gap-2">
                  {BADGES.map((b) => {
                    const has = theirBadges.some((x) => x.badge === b.key);
                    return (
                      <button
                        key={b.key}
                        type="button"
                        onClick={() => awardBadge(b.key)}
                        disabled={has}
                        className={`flex items-start gap-2.5 text-left px-3.5 py-3 rounded-2xl border transition-all ${
                          has
                            ? "border-surface-border bg-surface-bg-warm opacity-60 cursor-default"
                            : "border-surface-border bg-surface-card hover:border-emerald-600 active:scale-[.98]"
                        }`}
                      >
                        <span className="text-lg leading-none flex-shrink-0">{b.emoji}</span>
                        <span className="min-w-0">
                          <span className="block text-[13px] font-semibold text-ink">
                            {b.label}
                            {has && <span className="font-normal text-ink-muted"> · awarded</span>}
                          </span>
                          <span className="block text-[11px] text-ink-muted">{b.blurb}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </SectionCard>

      <SectionCard title="Recently given" note={`${stars.length} stars`}>
        {!ready ? (
          <LoadingNote />
        ) : stars.length === 0 ? (
          <EmptyNote>No stars given yet.</EmptyNote>
        ) : (
          <ul className="divide-y divide-surface-border -my-1">
            {stars.slice(0, 12).map((s) => {
              const student = students.find((x) => x.id === s.studentId);
              return (
                <li key={s.id} className="flex items-start gap-3 py-2.5">
                  <span className="text-base leading-none mt-0.5 flex-shrink-0">
                    {STAR_REASON_EMOJI[s.reason]}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-ink truncate">
                      {student?.name ?? "Student"}
                      <span className="font-normal text-ink-muted"> · {STAR_REASON_LABELS[s.reason]}</span>
                    </p>
                    {s.note && <p className="text-[12px] text-ink mt-0.5">{s.note}</p>}
                    <p className="text-[11px] text-ink-muted mt-0.5">{s.createdAt}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
