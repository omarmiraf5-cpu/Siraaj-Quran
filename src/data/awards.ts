// Stars and badges — the teacher's own recognition, separate from the XP in
// lib/progress.ts. XP is computed from what a student has measurably done
// (memorised, finished, turned up); a star is a teacher deciding that
// something deserved noticing. Keeping the two apart means neither can be
// farmed: XP can't be handed out, and a star can't be earned by grinding.

export type StarReason = "attendance" | "assignment" | "quiz" | "quran" | "effort";

export const STAR_REASONS: { key: StarReason; label: string; emoji: string }[] = [
  { key: "attendance", label: "Excellent attendance", emoji: "⭐" },
  { key: "assignment", label: "Completed assignment", emoji: "📘" },
  { key: "quiz", label: "Improved quiz score", emoji: "📈" },
  { key: "quran", label: "Qur'an goal achieved", emoji: "📖" },
  { key: "effort", label: "Excellent effort", emoji: "🏆" },
];

export const STAR_REASON_LABELS: Record<StarReason, string> = Object.fromEntries(
  STAR_REASONS.map((r) => [r.key, r.label])
) as Record<StarReason, string>;

export const STAR_REASON_EMOJI: Record<StarReason, string> = Object.fromEntries(
  STAR_REASONS.map((r) => [r.key, r.emoji])
) as Record<StarReason, string>;

export type BadgeKind =
  | "perfect_attendance"
  | "homework_champion"
  | "quran_achiever"
  | "tajweed_star"
  | "most_improved"
  | "consistent_learner";

export const BADGES: { key: BadgeKind; label: string; blurb: string; emoji: string }[] = [
  { key: "perfect_attendance", label: "Perfect Attendance", blurb: "Not a single session missed", emoji: "🎖️" },
  { key: "homework_champion", label: "Homework Champion", blurb: "Every assignment in, on time", emoji: "🌟" },
  { key: "quran_achiever", label: "Qur'an Achiever", blurb: "A memorisation goal reached", emoji: "🏅" },
  { key: "tajweed_star", label: "Tajweed Star", blurb: "Recitation rules applied beautifully", emoji: "🎗️" },
  { key: "most_improved", label: "Most Improved", blurb: "The biggest step forward this term", emoji: "🚀" },
  { key: "consistent_learner", label: "Consistent Learner", blurb: "Steady week after week", emoji: "🔵" },
];

export const BADGE_LABELS: Record<BadgeKind, string> = Object.fromEntries(
  BADGES.map((b) => [b.key, b.label])
) as Record<BadgeKind, string>;

export const BADGE_EMOJI: Record<BadgeKind, string> = Object.fromEntries(
  BADGES.map((b) => [b.key, b.emoji])
) as Record<BadgeKind, string>;

// ── Milestone tiers ──────────────────────────────────────────────────────
export type Tier = "bronze" | "silver" | "gold";

export const TIERS: { key: Tier; label: string; stars: number; emoji: string }[] = [
  { key: "bronze", label: "Bronze", stars: 10, emoji: "🥉" },
  { key: "silver", label: "Silver", stars: 25, emoji: "🥈" },
  { key: "gold", label: "Gold", stars: 50, emoji: "🥇" },
];

/** The highest tier reached, or null before the first one. */
export function tierFor(stars: number): (typeof TIERS)[number] | null {
  let reached: (typeof TIERS)[number] | null = null;
  for (const t of TIERS) if (stars >= t.stars) reached = t;
  return reached;
}

/** The tier being worked towards, with how many stars are left. Null once
 *  gold is reached — there is nothing above it to chase. */
export function nextTier(stars: number): { tier: (typeof TIERS)[number]; toGo: number } | null {
  const upcoming = TIERS.find((t) => stars < t.stars);
  return upcoming ? { tier: upcoming, toGo: upcoming.stars - stars } : null;
}

/** How far through the current tier's span the student is, as a percent.
 *  Full once gold is reached. */
export function tierPercent(stars: number): number {
  const next = nextTier(stars);
  if (!next) return 100;
  const previous = tierFor(stars)?.stars ?? 0;
  const span = next.tier.stars - previous;
  return Math.round(((stars - previous) / span) * 100);
}

// ── Demo records ─────────────────────────────────────────────────────────
export interface DemoStar {
  id: string;
  studentId: string;
  reason: StarReason;
  note: string | null;
  awardedBy: string;
  createdAt: string;
}

export interface DemoBadge {
  id: string;
  studentId: string;
  badge: BadgeKind;
  awardedBy: string;
  createdAt: string;
}

export const DEMO_STARS: DemoStar[] = [
  { id: "st1", studentId: "s1", reason: "quran", note: "Finished Al-Mulk with barely a slip.", awardedBy: "Ms. Farah", createdAt: "2026-09-05" },
  { id: "st2", studentId: "s1", reason: "attendance", note: null, awardedBy: "Ms. Farah", createdAt: "2026-09-04" },
  { id: "st3", studentId: "s1", reason: "effort", note: "Stayed behind to go over the hard ayahs.", awardedBy: "Ms. Farah", createdAt: "2026-09-01" },
  { id: "st4", studentId: "s2", reason: "assignment", note: null, awardedBy: "Ms. Farah", createdAt: "2026-09-05" },
  { id: "st5", studentId: "s2", reason: "effort", note: null, awardedBy: "Ms. Farah", createdAt: "2026-08-29" },
  { id: "st6", studentId: "s4", reason: "quiz", note: "Up from 60% to 85%.", awardedBy: "Ms. Farah", createdAt: "2026-09-03" },
];

export const DEMO_BADGES: DemoBadge[] = [
  { id: "bd1", studentId: "s1", badge: "quran_achiever", awardedBy: "Ms. Farah", createdAt: "2026-09-05" },
  { id: "bd2", studentId: "s1", badge: "consistent_learner", awardedBy: "Ms. Farah", createdAt: "2026-08-28" },
  { id: "bd3", studentId: "s4", badge: "most_improved", awardedBy: "Ms. Farah", createdAt: "2026-09-03" },
];

export const DEMO_CREATED_STARS_KEY = "demo_created_stars";
export const DEMO_CREATED_BADGES_KEY = "demo_created_badges";

export function allStars(created: DemoStar[]): DemoStar[] {
  return [...DEMO_STARS, ...created].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function allBadges(created: DemoBadge[]): DemoBadge[] {
  return [...DEMO_BADGES, ...created].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
