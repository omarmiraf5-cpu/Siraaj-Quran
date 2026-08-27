"use client";

// The student portal's own vocabulary. The rest of the product speaks to
// adults doing a job; this speaks to a child, so progress is a ring you can
// watch fill rather than a bar in a table, and every surah carries a colour
// so the page is something to look at. All of it is still built from the
// warm ground, the serif titles and the gold rules the other portals use.

import { useEffect, useMemo, useState } from "react";
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
      className={`${GRAD_CLASS[colour]} group relative overflow-hidden flex items-center gap-4 p-4 rounded-[20px] transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:-translate-y-0.5 hover:shadow-lg active:scale-[.96]`}
    >
      <span className="pattern-lattice absolute inset-0 opacity-30 pointer-events-none" />

      {/* The icon tile is translucent white rather than the card's own
          gradient — a same-colour icon on a same-colour card disappears,
          the way the play button below would if it weren't inverted too. */}
      <span className="relative w-14 h-14 rounded-2xl bg-white/20 border border-white/25 flex items-center justify-center text-white flex-shrink-0">
        <IconBookOpen size={24} />
      </span>

      <span className="relative flex-1 min-w-0">
        <span className="block text-[11px] font-bold uppercase tracking-wider text-white/75">
          {eyebrow}
        </span>
        <span className="block page-title text-white text-[17px] truncate mt-0.5">
          {title}
        </span>
        <span className="block text-[12px] text-white/70 mt-0.5">{detail}</span>
      </span>

      <span className="relative flex-shrink-0 flex flex-col items-center gap-1">
        {/* Solid white rather than another gradient circle, so the button
            still reads as the one thing to press once its backdrop is the
            same hue it used to stand out against. */}
        <span
          className="w-11 h-11 rounded-full bg-white flex items-center justify-center shadow-md group-hover:scale-105 transition-transform"
          style={{ color: RING_STROKE[colour] }}
        >
          <IconPlay size={18} />
        </span>
        <span className="text-[10px] font-bold text-white/70 tabular-nums">{level}%</span>
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
  eyebrow,
  arabic,
  delay = 0,
}: {
  colour: IllumColour;
  name: string;
  detail: string;
  level: number;
  href: string;
  /** Small label above the name — the portion this tile stands for. */
  eyebrow?: string;
  /** The portion's Arabic name, under the English. */
  arabic?: string;
  delay?: number;
}) {
  const size = 58;
  const stroke = 4;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;

  return (
    <a
      href={href}
      className={`${GRAD_CLASS[colour]} relative overflow-hidden rounded-[20px] p-4 flex flex-col items-center text-center animate-rise transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:-translate-y-1 active:scale-[.94]`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <span className="pattern-lattice absolute inset-0 opacity-30 pointer-events-none" />

      {eyebrow && (
        <span className="relative block text-[9px] font-bold uppercase tracking-wider text-white/70 mb-0.5 leading-tight">
          {eyebrow}
        </span>
      )}
      {arabic && (
        <span
          className="relative block font-arabic text-[12px] text-white/60 mb-2 leading-tight truncate w-full"
          dir="rtl"
          lang="ar"
        >
          {arabic}
        </span>
      )}

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
   The two navigation cards on the home screen. These are destinations, the
   same as the surah tiles, so they are painted the same way — they were
   the one part of the page still reading as a pale chip on white. */
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
      className={`${GRAD_CLASS[colour]} relative overflow-hidden rounded-[20px] px-5 py-5 animate-rise transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:-translate-y-1 active:scale-[.94]`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <span className="pattern-lattice absolute inset-0 opacity-30 pointer-events-none" />
      <span className="relative block w-12 h-12 rounded-2xl bg-white/20 border border-white/25 flex items-center justify-center text-white mb-3">
        {icon}
      </span>
      <span className="relative block page-title text-white text-[16px]">{title}</span>
      <span className="relative block text-[12px] text-white/70 mt-0.5 leading-snug">{sub}</span>
    </a>
  );
}

/* ── XP tile ───────────────────────────────────────────────────────────
   One source of points. Small and three across, so a solid colour block
   works where another bordered card would just be more white. */
export function XpTile({
  colour,
  icon,
  value,
  label,
  delay = 0,
}: {
  colour: IllumColour;
  icon: React.ReactNode;
  value: number;
  label: string;
  delay?: number;
}) {
  return (
    <div
      className={`${GRAD_CLASS[colour]} relative overflow-hidden rounded-[18px] px-3 py-3.5 text-center animate-rise`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <span className="pattern-lattice absolute inset-0 opacity-30 pointer-events-none" />
      <span className="relative w-8 h-8 rounded-xl bg-white/20 border border-white/25 flex items-center justify-center text-white mx-auto mb-2">
        {icon}
      </span>
      <p className="relative text-[20px] font-bold text-white tabular-nums leading-none">
        {value}
      </p>
      <p className="relative text-[10px] font-bold text-white/70 uppercase tracking-wide mt-1.5">
        {label}
      </p>
    </div>
  );
}

/* ── Confetti ──────────────────────────────────────────────────────────
   The one moment of pure delight on the page: fired when a child drags the
   memorisation slider to 100%. Nothing else here rewards the act of doing
   the work — the rings and chips all describe state, none of them react to
   an action — so this is deliberately the single place that does.

   `burstKey` is a counter the caller bumps to fire a new burst; 0 renders
   nothing. Particle positions are derived from `burstKey` with a small
   seeded generator rather than Math.random() in render, so a burst is
   reproducible for its key and two renders of the same key never disagree
   — the usual reason to avoid bare Math.random() in a component body. It
   is still fine to depend on real randomness here because a burst only
   ever fires from a client event well after hydration, never during the
   render React reconciles against the server; the seeding is about
   render-to-render stability, not hydration safety. */
function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

const CONFETTI_COLOURS = [
  "#d2941f", // saffron
  "#1f8a6d", // verdigris
  "#1f8b9b", // turquoise
  "#c4553c", // vermilion
  "#2f5ea8", // lapis
  "#834272", // aubergine
  "#c6a253", // gold
];

// The animation runs 750ms; a little slack so a slow frame doesn't cut the
// fade off visibly before the DOM node is removed.
const CONFETTI_LIFETIME_MS = 900;

export function Confetti({ burstKey }: { burstKey: number }) {
  // Without this, every spent burst's 16 spans sit invisible in the DOM
  // forever — harmless to look at (opacity 0, pointer-events-none) but
  // there is no reason to keep them once the animation that used them has
  // finished.
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!burstKey) return;
    setVisible(true);
    const t = setTimeout(() => setVisible(false), CONFETTI_LIFETIME_MS);
    return () => clearTimeout(t);
  }, [burstKey]);

  const pieces = useMemo(() => {
    if (!visible || !burstKey) return [];
    const rand = seededRandom(burstKey * 7919);
    return Array.from({ length: 16 }, (_, i) => {
      const angle = rand() * Math.PI * 2;
      const dist = 34 + rand() * 46;
      return {
        id: i,
        dx: Math.cos(angle) * dist,
        // Biased upward — a burst that only fell would read as debris, not
        // a celebration.
        dy: Math.sin(angle) * dist - 18,
        rot: Math.round(rand() * 300 - 150),
        colour: CONFETTI_COLOURS[i % CONFETTI_COLOURS.length],
        delay: Math.round(rand() * 80),
        square: i % 2 === 0,
      };
    });
  }, [burstKey, visible]);

  if (pieces.length === 0) return null;

  return (
    <span className="absolute inset-0 pointer-events-none overflow-visible" aria-hidden="true">
      {pieces.map((p) => (
        <span
          key={`${burstKey}-${p.id}`}
          className={`confetti-piece ${p.square ? "rounded-[2px]" : "rounded-full"}`}
          style={
            {
              "--dx": `${p.dx}px`,
              "--dy": `${p.dy}px`,
              "--rot": `${p.rot}deg`,
              background: p.colour,
              animationDelay: `${p.delay}ms`,
            } as React.CSSProperties
          }
        />
      ))}
    </span>
  );
}

/* ── Mascot ────────────────────────────────────────────────────────────
   A crescent moon with a face, for the moments the page has nothing to
   show — an empty "up next" or an empty work list. Those used to be a flat
   line of grey text; a blank state is exactly where a little personality
   costs nothing and reads as warmth rather than clutter. The crescent
   itself is the standard two-arc construction (a large circle with a
   smaller one cut from it) used across icon sets for a moon glyph — a
   generic geometric shape, not an illustration, which keeps it cheap to
   render correctly at any size rather than something that could come out
   lopsided. */
export function MascotMoon({
  size = 56,
  mood = "happy",
}: {
  size?: number;
  mood?: "happy" | "calm";
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z"
        fill="#d9bd74"
      />
      <circle cx="10.6" cy="9.7" r="0.85" fill="#4a3712" />
      <circle cx="14.1" cy="9.1" r="0.85" fill="#4a3712" />
      {mood === "happy" ? (
        <path
          d="M10.3 12.3c.9 1.1 2.9 1.5 4.3.6"
          stroke="#4a3712"
          strokeWidth="1.3"
          fill="none"
          strokeLinecap="round"
        />
      ) : (
        <path
          d="M10.6 12.7h3.6"
          stroke="#4a3712"
          strokeWidth="1.3"
          fill="none"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}

/* ── Friendly empty state ──────────────────────────────────────────────
   The mascot plus a short, warm line — the replacement for a plain
   EmptyNote wherever the empty state is on a student-facing screen rather
   than a teacher or parent one. */
export function FriendlyEmpty({
  title,
  sub,
  mood = "calm",
}: {
  title: string;
  sub: string;
  mood?: "happy" | "calm";
}) {
  return (
    <div className="flex flex-col items-center text-center py-3">
      <MascotMoon size={52} mood={mood} />
      <p className="page-title text-[15px] mt-2.5">{title}</p>
      <p className="text-[12px] text-ink-muted mt-1">{sub}</p>
    </div>
  );
}
