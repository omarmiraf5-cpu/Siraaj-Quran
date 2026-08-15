"use client";

// The student portal's own vocabulary. The rest of the product speaks to
// adults doing a job; this speaks to a child, so progress is a ring you can
// watch fill rather than a bar in a table, and every surah carries a colour
// so the page is something to look at. All of it is still built from the
// warm ground, the serif titles and the gold rules the other portals use.

import { IconFlame, IconCheck } from "@/components/icons";

/* ── Illumination colours ──────────────────────────────────────────────
   Six, assigned to a surah by its number so the same surah is always the
   same colour — a child learns "Ya-Sin is the purple one" and that holds
   across every screen. */
export const ILLUM = [
  "lapis",
  "verdigris",
  "saffron",
  "turquoise",
  "vermilion",
  "aubergine",
] as const;

export type IllumColour = (typeof ILLUM)[number];

export function surahColour(surahId: number): IllumColour {
  return ILLUM[surahId % ILLUM.length];
}

// A surah's colour is its identity and says nothing about how it is going,
// so the status chip cannot borrow it — "needs review" was coming out in a
// calm lapis blue. The ring stays the surah's colour; the chip means what it
// says.
export const STATUS_COLOUR: Record<
  "assigned" | "in_progress" | "completed" | "needs_review",
  IllumColour
> = {
  assigned: "lapis",
  in_progress: "saffron",
  completed: "verdigris",
  needs_review: "vermilion",
};

const RING_STROKE: Record<IllumColour, string> = {
  lapis: "#2f5ea8",
  turquoise: "#1f8b9b",
  verdigris: "#1f8a6d",
  saffron: "#d2941f",
  vermilion: "#c4553c",
  aubergine: "#834272",
};

// Written out rather than built as `illum-${colour}`: Tailwind tree-shakes
// the components layer against literal strings it finds in the source, so an
// interpolated name would be purged from the stylesheet and the tile would
// come out unstyled.
export const ILLUM_CLASS: Record<IllumColour, string> = {
  lapis: "illum illum-lapis",
  turquoise: "illum illum-turquoise",
  verdigris: "illum illum-verdigris",
  saffron: "illum illum-saffron",
  vermilion: "illum illum-vermilion",
  aubergine: "illum illum-aubergine",
};

/* ── Progress ring ─────────────────────────────────────────────────────
   A bar tells you a number; a ring closing tells you how near you are to
   finishing, which is the thing a child actually wants to know. */
export function ProgressRing({
  value,
  colour = "verdigris",
  size = 68,
  label,
}: {
  value: number;
  colour?: IllumColour;
  size?: number;
  /** Shown under the number, e.g. "learnt". */
  label?: string;
}) {
  const pct = Math.max(0, Math.min(100, value));
  const stroke = 6;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const dash = (pct / 100) * circumference;

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          className="text-surface-bg"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={RING_STROKE[colour]}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          style={{ transition: "stroke-dasharray 900ms cubic-bezier(0.22,1,0.36,1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="font-bold text-ink tabular-nums leading-none"
          style={{ fontSize: size * 0.26 }}
        >
          {pct}
          <span style={{ fontSize: size * 0.16 }}>%</span>
        </span>
        {label && (
          <span className="text-ink-muted leading-none mt-0.5" style={{ fontSize: size * 0.13 }}>
            {label}
          </span>
        )}
      </div>
      <span className="sr-only">{pct}% complete</span>
    </div>
  );
}

/* ── Streak badge ──────────────────────────────────────────────────────
   The one purely celebratory thing on the page, so the one thing that
   catches the light. */
export function StreakBadge({ days }: { days: number }) {
  if (days < 2) return null;
  return (
    <span className="shine inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-brand-gold-light to-brand-gold px-3 py-1.5 text-[12px] font-bold text-[#20180a]">
      <IconFlame size={13} />
      {days} days in a row
    </span>
  );
}

/* ── Surah tile ────────────────────────────────────────────────────────
   A coloured card for one piece of work. The colour is the surah's, the
   ring is the child's progress on it. */
export function SurahTile({
  surahId,
  title,
  detail,
  level,
  status,
  footer,
  delay = 0,
}: {
  surahId: number;
  title: string;
  detail: string;
  level: number;
  status: { label: string; done: boolean };
  footer?: React.ReactNode;
  delay?: number;
}) {
  const colour = surahColour(surahId);

  return (
    <article
      className="card-quiet p-4 animate-rise"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center gap-4">
        <ProgressRing value={level} colour={colour} size={62} />

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="page-title text-[17px] truncate">{title}</h3>
            {status.done && (
              <span className={`${ILLUM_CLASS.verdigris} w-6 h-6 rounded-full flex-shrink-0`}>
                <IconCheck size={13} />
              </span>
            )}
          </div>
          <p className="text-[12px] text-ink-muted mt-0.5">{detail}</p>
          <span
            className={`${ILLUM_CLASS[colour]} inline-flex mt-2 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide`}
          >
            {status.label}
          </span>
        </div>
      </div>

      {footer && <div className="mt-3">{footer}</div>}
    </article>
  );
}

/* ── Big friendly tile ─────────────────────────────────────────────────
   The two navigation cards on the home screen. Bigger tap target and a
   colour of its own, because a child is aiming with a thumb. */
export function BigTile({
  href,
  colour,
  icon,
  title,
  sub,
  delay = 0,
}: {
  href: string;
  colour: IllumColour;
  icon: React.ReactNode;
  title: string;
  sub: string;
  delay?: number;
}) {
  return (
    <a
      href={href}
      className="card-quiet card-feature group px-5 py-5 animate-rise transition-all hover:-translate-y-1 hover:shadow-lg active:scale-[.97]"
      style={{ animationDelay: `${delay}ms` }}
    >
      <span className={`${ILLUM_CLASS[colour]} w-12 h-12 mb-3`}>{icon}</span>
      <span className="block page-title text-[16px]">{title}</span>
      <span className="block text-[12px] text-ink-muted mt-0.5 leading-snug">{sub}</span>
    </a>
  );
}
