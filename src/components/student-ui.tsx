"use client";

// The student portal's own vocabulary. The rest of the product speaks to
// adults doing a job; this speaks to a child, so progress is a ring you can
// watch fill rather than a bar in a table, and every surah carries a colour
// so the page is something to look at. All of it is still built from the
// warm ground, the serif titles and the gold rules the other portals use.

import {
  IconFlame,
  IconCheck,
  IconStar,
  IconPlay,
  IconBookOpen,
} from "@/components/icons";

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

// A plain `surahId % 6` put An-Naba (78) and Ya-Sin (36) in the same blue and
// sat them next to each other in the grid — and no linear function can fix
// that, since any a·x+b maps two ids that are congruent mod 6 to the same
// slot. This mixes the bits instead, which spreads the 114 surahs evenly.
// Math.imul because a plain multiply by these constants overflows past the
// safe-integer range and loses the low bits that carry the entropy.
export function surahColour(surahId: number): IllumColour {
  let h = Math.imul(surahId, 2654435761) >>> 0;
  h ^= h >>> 15;
  h = Math.imul(h, 2246822519) >>> 0;
  h ^= h >>> 13;
  return ILLUM[(h >>> 0) % ILLUM.length];
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

// Full-strength gradients, for the tiles meant to be the brightest thing on
// the page. Literal strings, for the same tree-shaking reason as ILLUM_CLASS.
export const GRAD_CLASS: Record<IllumColour, string> = {
  lapis: "grad-lapis",
  turquoise: "grad-turquoise",
  verdigris: "grad-verdigris",
  saffron: "grad-saffron",
  vermilion: "grad-vermilion",
  aubergine: "grad-aubergine",
};

// Text in a palette colour, for a label on the cream ground. Dark-mode
// variants come up to the light end of each hue so they stay readable.
export const TEXT_CLASS: Record<IllumColour, string> = {
  lapis: "text-[#24487f] dark:text-[#8fb4e8]",
  turquoise: "text-[#176a76] dark:text-[#79cbd8]",
  verdigris: "text-[#176954] dark:text-[#74ccae]",
  saffron: "text-[#8a6014] dark:text-[#e6bc6b]",
  vermilion: "text-[#93402d] dark:text-[#e5967f]",
  aubergine: "text-[#663355] dark:text-[#cf95bd]",
};

/* ── Avatar ────────────────────────────────────────────────────────────── */
export function Avatar({ name, size = 44 }: { name: string; size?: number }) {
  const letter = name.trim().charAt(0).toUpperCase() || "?";
  return (
    <span
      className="rounded-full bg-white/15 border border-white/25 flex items-center justify-center font-bold text-white flex-shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.42 }}
      aria-hidden="true"
    >
      {letter}
    </span>
  );
}

/* ── Streak pill ───────────────────────────────────────────────────────
   The compact form, for the corner of a hero. */
export function StreakPill({ days }: { days: number }) {
  if (days < 1) return null;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-2xl bg-white/12 border border-white/20 px-3 py-2 text-white flex-shrink-0"
      title={`${days} days in a row`}
    >
      <span className="text-brand-gold-light">
        <IconFlame size={16} />
      </span>
      <span className="font-bold text-[15px] tabular-nums">{days}</span>
    </span>
  );
}

/* ── Level bar ─────────────────────────────────────────────────────────
   Sits inside the hero, on its own translucent panel. */
export function LevelBar({
  level,
  into,
  span,
  percent,
  message,
}: {
  level: number;
  into: number;
  span: number;
  percent: number;
  message: string;
}) {
  return (
    <div className="rounded-2xl bg-white/10 border border-white/15 px-4 py-3.5 backdrop-blur-sm">
      <div className="flex items-baseline justify-between gap-3">
        <span className="inline-flex items-center gap-1.5 text-white font-bold text-[15px]">
          <span className="text-brand-gold-light">
            <IconStar size={15} />
          </span>
          Level {level}
        </span>
        <span className="text-[12px] text-white/60 tabular-nums flex-shrink-0">
          {into} / {span} XP
        </span>
      </div>

      <div
        className="h-2.5 rounded-full bg-white/15 overflow-hidden mt-2.5"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Level ${level} progress`}
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-brand-gold-light to-brand-gold"
          style={{
            width: `${percent}%`,
            transition: "width 900ms cubic-bezier(0.22,1,0.36,1)",
          }}
        />
      </div>

      <p className="text-[12px] text-white/60 mt-2">{message}</p>
    </div>
  );
}

/* ── Up next ───────────────────────────────────────────────────────────
   One thing to do, with the action as a button you cannot miss. */
export function UpNextCard({
  colour,
  eyebrow,
  title,
  detail,
  href,
  level,
}: {
  colour: IllumColour;
  eyebrow: string;
  title: string;
  detail: string;
  href: string;
  level: number;
}) {
  return (
    <a
      href={href}
      className="card-quiet group flex items-center gap-4 p-4 transition-all hover:-translate-y-0.5 hover:shadow-lg active:scale-[.99]"
    >
      <span
        className={`${GRAD_CLASS[colour]} w-14 h-14 rounded-2xl flex items-center justify-center text-white flex-shrink-0 shadow-sm`}
      >
        <IconBookOpen size={24} />
      </span>

      <span className="flex-1 min-w-0">
        <span className={`block text-[11px] font-bold uppercase tracking-wider ${TEXT_CLASS[colour]}`}>
          {eyebrow}
        </span>
        <span className="block page-title text-[17px] truncate mt-0.5">{title}</span>
        <span className="block text-[12px] text-ink-muted mt-0.5">{detail}</span>
      </span>

      <span className="flex-shrink-0 flex flex-col items-center gap-1">
        <span
          className={`${GRAD_CLASS[colour]} w-11 h-11 rounded-full flex items-center justify-center text-white shadow-md group-hover:scale-105 transition-transform`}
        >
          <IconPlay size={18} />
        </span>
        <span className="text-[10px] font-bold text-ink-muted tabular-nums">{level}%</span>
      </span>
    </a>
  );
}

/* ── Surah tile ────────────────────────────────────────────────────────
   The bright grid. A circular dial around the icon carries the progress,
   so the colour is doing two jobs rather than only decorating. */
export function SurahGridTile({
  colour,
  name,
  detail,
  level,
  href,
  delay = 0,
}: {
  colour: IllumColour;
  name: string;
  detail: string;
  level: number;
  href: string;
  delay?: number;
}) {
  const size = 58;
  const stroke = 4;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;

  return (
    <a
      href={href}
      className={`${GRAD_CLASS[colour]} relative overflow-hidden rounded-[20px] p-4 flex flex-col items-center text-center animate-rise transition-transform hover:-translate-y-1 active:scale-[.97]`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <span className="pattern-lattice absolute inset-0 opacity-30 pointer-events-none" />

      <span className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90 absolute inset-0" aria-hidden="true">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="rgba(255,255,255,0.28)"
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="#ffffff"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${(level / 100) * circumference} ${circumference}`}
            style={{ transition: "stroke-dasharray 900ms cubic-bezier(0.22,1,0.36,1)" }}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-white">
          <IconBookOpen size={22} />
        </span>
      </span>

      <span className="relative block text-white font-bold text-[13px] mt-2.5 leading-tight truncate w-full">
        {name}
      </span>
      <span className="relative block text-white/70 text-[11px] mt-0.5">{detail}</span>
    </a>
  );
}

/* ── Section label ─────────────────────────────────────────────────────
   A coloured mark and a small-caps label, in place of the emoji that
   usually does this job. */
export function SectionLabel({
  colour,
  icon,
  children,
}: {
  colour: IllumColour;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 px-1">
      <span className={`${ILLUM_CLASS[colour]} w-6 h-6 rounded-lg`}>{icon}</span>
      <span className="eyebrow">{children}</span>
    </div>
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
