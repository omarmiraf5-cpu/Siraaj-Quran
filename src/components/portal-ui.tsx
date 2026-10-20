"use client";

// The pieces every portal repeats: a section card, a stat tile, a progress
// bar, the attendance strip and a segmented switch. These existed three times
// over in slightly different forms — a 3xl bold sans heading on one page, a
// serif one on another, bars in four different heights — which is what made
// the product read as three products.

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { pillSpring } from "@/lib/motion-config";
import {
  ATTENDANCE_DOT,
  DAILY_RATING_DOT,
  DAILY_RATING_ORDER,
  DAILY_RATING_STYLES,
  MONTHS,
  WEEKDAY_SHORT,
  formatDay,
  tallyRatings,
  type AttendanceDay,
  type AttendanceSummary,
  type RecitationLogEntry,
} from "@/data/demo";
import { getSurahById } from "@/data/mushaf-index";
import { IconArrow } from "@/components/icons";
import type { DailyRating } from "@/hooks/useQuranicAssignments";
import { useLanguage } from "@/components/LanguageProvider";
import { SkeletonRows, SkeletonStats } from "@/components/Skeleton";
import { IconBadge, type IconTone } from "@/components/IconBadge";
import { ColorTile, type ArtName } from "@/components/gem-icons";
import type { LucideIcon } from "lucide-react";
import { countLabel } from "@/lib/i18n/phrases";

// DAILY_RATING_LABELS keys are snake_case (very_good); translation keys are
// camelCase (rating.veryGood) to match the rest of the dictionary.
const RATING_KEY: Record<DailyRating, string> = {
  excellent: "rating.excellent",
  very_good: "rating.veryGood",
  good: "rating.good",
  weak: "rating.weak",
  not_recited: "rating.notRecited",
};

/* ── Modal ─────────────────────────────────────────────────────────────
   Escape and a backdrop click both close. The navy header matches the
   heroes, so a panel reads as part of the page it opened from. */
export function Modal({
  title,
  subtitle,
  badge,
  wide,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  /** Usually initials, shown in a circle beside the title. */
  badge?: string;
  /** The one exception to the fixed dialog width — for content with its
   *  own real layout (a two-page mushaf spread, its reciter controls)
   *  rather than a form or a message. Every existing call site omits this
   *  and keeps the narrower default. */
  wide?: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const { t } = useLanguage();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    // The page behind must not scroll while a panel is over it.
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in-down"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`relative w-full ${wide ? "max-w-4xl" : "max-w-md"} max-h-[85vh] overflow-y-auto bg-surface-card border border-surface-border rounded-[18px] shadow-2xl animate-slide-up`}
      >
        <div className="gradient-navy rounded-t-[18px] px-6 py-5 relative overflow-hidden sticky top-0 z-10">
          <div className="pattern-lattice absolute inset-0 opacity-40 pointer-events-none" />
          {/* z-20 is load-bearing. The title row below is `relative` and comes
              later in the DOM; two positioned siblings with no z-index paint
              in DOM order, so the row was painting over this button and
              swallowing every click on it. Its `pe-8` only insets the
              content — the row's own box still runs the full width, straight
              across the X. */}
          <button
            type="button"
            onClick={onClose}
            aria-label={t("common.close")}
            className="absolute top-4 end-4 z-20 w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
          <div className="relative flex items-center gap-3.5 pe-8">
            {badge && (
              <span className="w-12 h-12 rounded-full bg-white/15 border border-white/25 flex items-center justify-center text-[15px] font-bold text-white flex-shrink-0">
                {badge}
              </span>
            )}
            <div className="min-w-0">
              <h2 className="page-title text-white text-lg [overflow-wrap:anywhere]">{title}</h2>
              {subtitle && <p className="text-[12px] text-white/55">{subtitle}</p>}
            </div>
          </div>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

/* ── Section card ──────────────────────────────────────────────────────
   Title, optional right-hand note, gold rule, then the content. */
export function SectionCard({
  title,
  note,
  children,
  className = "",
}: {
  title: string;
  note?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`card-quiet sec-card p-5 ${className}`}>
      {/* Wraps on a phone: a long note drops under the title instead of
          running off the edge of the card. Each section on a page has its own
          colour (see .sec-card in globals.css): a bar by the title, the
          title itself and the note. */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <h2 className="page-title text-lg sec-title flex items-center gap-2.5">
          <span aria-hidden className="sec-bar inline-block w-1.5 h-5 rounded-full flex-shrink-0" />
          {title}
        </h2>
        {note && <span className="eyebrow sec-note rounded-full px-2.5 py-1">{note}</span>}
      </div>
      <div className="gold-rule my-4" />
      {children}
    </section>
  );
}

const STATUS_VALUE = {
  present: "text-green-700 dark:text-green-300",
  late: "text-amber-600 dark:text-amber-300",
  absent: "text-red-700 dark:text-red-300",
  excused: "text-slate-500 dark:text-slate-300",
};
const STATUS_DOT = {
  present: "bg-green-600",
  late: "bg-amber-500",
  absent: "bg-red-600",
  excused: "bg-slate-400",
};

/* ── Stat tile ─────────────────────────────────────────────────────────
   A number that carries the context making it mean something. Renders as a
   button when given an onClick, so a stat can lead somewhere. */
export function StatTile({
  value,
  label,
  sub,
  onClick,
  icon,
  art,
  tone = "navy",
  status,
}: {
  value: string | number;
  label: string;
  sub?: string;
  onClick?: () => void;
  /** An attendance figure's colour, the same as its marks elsewhere: green present, amber late, red absent, grey excused. */
  status?: "present" | "late" | "absent" | "excused";
  /** A badge above the figure, for the headline tiles at the top of a home page. */
  icon?: LucideIcon;
  /** The tile's picture, drawn as a gem; the plain `icon` stands in without one. */
  art?: ArtName;
  tone?: IconTone;
}) {
  const body = (
    <>
      {icon && (
        <span className="block mb-3">
          {art ? <ColorTile name={art} size={40} /> : <IconBadge icon={icon} tone={tone} size={34} />}
        </span>
      )}
      <p
        className={`text-[26px] font-bold tabular-nums leading-none ${
          status ? (Number(value) === 0 ? "text-slate-400 dark:text-slate-500" : STATUS_VALUE[status]) : "text-ink"
        }`}
      >
        <bdi dir="ltr">{value}</bdi>
      </p>
      <p className="eyebrow mt-2 flex items-center gap-1.5">
        {status && <span aria-hidden className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${STATUS_DOT[status]}`} />}
        {label}
      </p>
      {sub && <p className="text-[11px] text-ink-muted mt-1.5 leading-snug">{sub}</p>}
    </>
  );

  // min-w-0 matters here: these tiles sit in a CSS grid, where a grid
  // item's default min-width is auto, not 0. A translated label longer
  // than its English original (e.g. Arabic "بحاجة إلى مراجعة") would
  // otherwise force its whole track wider than its fair share, blowing
  // out the grid — and with it the page's horizontal scroll — instead
  // of just wrapping to a second line.
  if (!onClick) {
    return <div className="card-quiet card-lift px-4 py-4 min-w-0">{body}</div>;
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className="card-quiet card-lift px-4 py-4 min-w-0 text-start cursor-pointer hover:bg-surface-bg-warm active:scale-[.98]"
    >
      {body}
    </button>
  );
}

/* ── Progress bar ──────────────────────────────────────────────────────
   Colour follows the value rather than the caller, so the same number reads
   the same everywhere. */
export function ProgressBar({
  value,
  tone = "auto",
}: {
  value: number;
  tone?: "auto" | "gold" | "emerald";
}) {
  const fill =
    tone === "gold"
      ? "bg-brand-gold"
      : tone === "emerald"
        ? "bg-brand-emerald"
        : value >= 95
          ? "bg-green-600"
          : value >= 70
            ? "bg-brand-emerald"
            : value >= 40
              ? "bg-amber-500"
              : "bg-red-600";

  return (
    <div className="h-1.5 bg-surface-bg rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-[width] duration-700 ease-out ${fill}`}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

/* ── Attendance strip ──────────────────────────────────────────────────
   One bar per school day, oldest to newest so it reads like a calendar. */
export function AttendanceStrip({
  days,
  limit = 14,
  size = "sm",
}: {
  days: AttendanceDay[];
  limit?: number;
  /** "lg" is for the student portal, where the strip is a feature rather
      than a footnote and wants to be seen across a room. */
  size?: "sm" | "lg";
}) {
  const { t, language } = useLanguage();
  const recent = days.slice(0, limit).slice().reverse();
  const bar = size === "lg" ? "h-7 rounded-lg" : "h-1.5 rounded-full";
  return (
    <div
      className={`flex ${size === "lg" ? "gap-1.5" : "gap-1"}`}
      role="img"
      aria-label={countLabel(
        "Attendance for the last {count} day|Attendance for the last {count} days",
        recent.length,
        `${t("common.attendanceForLastDays")} ${recent.length} ${t("common.days")}`,
      )}
    >
      {recent.map((d) => (
        <span
          key={d.date}
          title={`${formatDay(d.date, language)} · ${t(`common.${d.status}`)}`}
          className={`flex-1 ${bar} ${ATTENDANCE_DOT[d.status]}`}
        />
      ))}
    </div>
  );
}

/* ── Attendance legend ─────────────────────────────────────────────────
   Counts with their dot, hiding any status that did not occur. */
export function AttendanceLegend({ counts }: { counts: AttendanceSummary }) {
  const { t } = useLanguage();
  const order = ["present", "late", "absent", "excused"] as const;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {order
        .filter((s) => counts[s] > 0)
        .map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5 text-[12px]">
            <span className={`w-1.5 h-1.5 rounded-full ${ATTENDANCE_DOT[s]}`} />
            <span className="tabular-nums font-semibold text-ink">{counts[s]}</span>
            <span className="text-ink-muted">{t(`common.${s}`)}</span>
          </span>
        ))}
    </div>
  );
}

/* ── Segmented switch ──────────────────────────────────────────────────
   Used for picking a child. A row of full-width buttons was reading as two
   competing primary actions; this reads as one control with a selection. */
export function SegmentedSwitch<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  const reduce = useReducedMotion();
  const group = useId();
  const strip = useRef<HTMLDivElement>(null);
  // Four or five children don't fit a phone's width: the row scrolls
  // sideways, and the chosen one is brought into view.
  useEffect(() => {
    // Only the strip scrolls — never the page under it.
    const box = strip.current;
    const el = box?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!box || !el || box.scrollWidth <= box.clientWidth) return;
    const a = el.getBoundingClientRect();
    const b = box.getBoundingClientRect();
    const by = a.left < b.left ? a.left - b.left - 8 : a.right > b.right ? a.right - b.right + 8 : 0;
    if (by) box.scrollBy({ left: by, behavior: reduce ? "auto" : "smooth" });
  }, [value, reduce]);
  if (options.length < 2) return null;
  return (
    <div
      ref={strip}
      role="tablist"
      aria-label={label}
      className="inline-flex max-w-full overflow-x-auto no-scrollbar p-1 gap-1 rounded-full bg-surface-bg-warm border border-surface-border"
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={`relative flex-shrink-0 whitespace-nowrap px-4 py-1.5 rounded-full text-[13px] font-semibold transition-colors ${
              active ? "text-white" : "text-ink-muted hover:text-ink"
            }`}
          >
            {/* The navy pill slides to the chosen child. */}
            {active && (
              <motion.span
                layoutId={`switch-${group}`}
                className="absolute inset-0 rounded-full bg-brand-navy shadow-sm"
                transition={reduce ? { duration: 0 } : pillSpring}
              />
            )}
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/** A row that opens, while it's open: navy like a chosen card, so it's
 *  clear which one the panel under it belongs to. */
export const OPEN_ROW = "row-open bg-brand-navy text-white hover:bg-brand-navy";

/* ── Row chevron ───────────────────────────────────────────────────────
   The arrow at the end of a row that opens: in a soft round frame that
   darkens with the row's hover (the row carries `group`), turning to point
   down when open — in either reading direction. An open row is navy (see
   OPEN_ROW), so the open chevron is white. */
export function RowChevron({ open }: { open: boolean }) {
  return (
    <span
      aria-hidden
      className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
        open
          ? "rotate-90 rtl:-rotate-90 bg-white/15 text-white"
          : "bg-surface-bg-warm text-ink-muted group-hover:bg-brand-navy/10 group-hover:text-ink dark:group-hover:bg-white/10"
      }`}
    >
      <IconArrow size={13} />
    </span>
  );
}

/* ── Avatar ────────────────────────────────────────────────────────────
   A person's initials on a soft colour of their own, the same colour every
   time (worked out from the name), so a long list can be scanned by eye.
   Tinted backgrounds with dark text of the same hue: white text on a light
   pastel is too faint to read. */
const AVATAR_TONES = [
  "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-200",
  "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200",
  "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200",
  "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200",
  "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200",
  "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200",
  "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  "bg-orange-100 text-orange-900 dark:bg-orange-900/40 dark:text-orange-200",
];
function toneFor(name: string): string {
  let h = 0;
  for (const ch of name.trim().toLowerCase()) h = (h * 31 + ch.codePointAt(0)!) >>> 0;
  return AVATAR_TONES[h % AVATAR_TONES.length];
}
function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return words.map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "?";
}
export function Avatar({ name, muted, onDark }: { name: string; muted?: boolean; onDark?: boolean }) {
  const tone = onDark ? "bg-white/15 text-white" : muted ? "bg-slate-100 dark:bg-slate-800/40 text-slate-500" : toneFor(name);
  return (
    <span aria-hidden className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-[11px] flex-shrink-0 ${tone}`}>
      {initialsOf(name)}
    </span>
  );
}

/* ── Status pill ─────────────────────────────────────────────────────── */
export function StatusPill({ on, onLabel, offLabel }: { on: boolean; onLabel: string; offLabel: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[10.5px] font-semibold px-2 py-1 rounded-full flex-shrink-0 whitespace-nowrap ${
        on
          ? "bg-green-50 text-green-800 dark:bg-green-950/30 dark:text-green-300"
          : "bg-slate-100 text-slate-600 dark:bg-slate-800/40 dark:text-slate-300"
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${on ? "bg-green-600" : "bg-slate-400"}`} />
      {on ? onLabel : offLabel}
    </span>
  );
}

/* ── Empty state ───────────────────────────────────────────────────────
   Quiet rather than an alert box; nothing here is a problem. */
export function EmptyNote({ children }: { children: React.ReactNode }) {
  return <p className="text-[13px] text-ink-muted py-2">{children}</p>;
}

/* ── Loading state ─────────────────────────────────────────────────────
   Every page that can run against either a real school or the demo has to
   ask Supabase who is signed in before it knows which to draw. This holds
   the space while that answer is in flight — the alternative, rendering the
   demo roster first and swapping it out a moment later, briefly shows one
   school somebody else's names. */
/** While a list or section loads: placeholder rows in its shape, with the
 *  words for screen readers. */
export function LoadingNote({ children, rows = 3, stats = false }: { children?: React.ReactNode; rows?: number; stats?: boolean }) {
  const { tr } = useLanguage();
  return (
    <div className="py-1 space-y-4" aria-live="polite" aria-busy="true">
      <span className="sr-only">{children ?? tr("Loading…")}</span>
      {stats && <SkeletonStats />}
      <div className="card-quiet p-5">
        <SkeletonRows count={rows} />
      </div>
    </div>
  );
}

/* ── Daily rating pill ─────────────────────────────────────────────────
   Excellent / Very good / Good / Weak — what a teacher grades today's
   recitation as, coloured so a parent reads it at a glance before any
   percentage. */
export function RatingPill({ rating }: { rating: DailyRating }) {
  const { t } = useLanguage();
  return (
    <span
      className={`text-[11px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${DAILY_RATING_STYLES[rating]}`}
    >
      {t(RATING_KEY[rating])}
    </span>
  );
}

/* ── One recitation, in full ──────────────────────────────────────────
   What was read, and how it went. Shared between the timeline and the
   selected-day detail below, since both show the same thing. */
function LogEntryRow({ entry, showDate }: { entry: RecitationLogEntry; showDate?: boolean }) {
  const { t, language, tr } = useLanguage();
  const surah = getSurahById(entry.surah);
  return (
    <div className="flex items-start justify-between gap-3 py-2.5">
      <div className="min-w-0">
        <p className="text-[12px] font-semibold text-ink">
          {showDate && `${formatDay(entry.date, language)} · `}
          <span className="underline decoration-2 underline-offset-2">
            {t(`portion.${entry.portion}`)}
          </span>
        </p>
        <p className="text-[11px] text-ink-muted [overflow-wrap:anywhere]">
          {surah ? surah.englishName : tr("Surah {surah}", { surah: entry.surah })}{" "}{tr("· ayahs {ayah_start}–{ayah_end}", { ayah_start: entry.ayah_start, ayah_end: entry.ayah_end })}
        </p>
        {entry.notes && (
          <p className="text-[12px] text-ink-body font-serif italic leading-snug mt-1">
            {entry.notes}
          </p>
        )}
      </div>
      <RatingPill rating={entry.rating} />
    </div>
  );
}

/* ── Recitation history ────────────────────────────────────────────────
   A month calendar coloured by that day's rating, a tally for the month,
   and a day-by-day list of exactly what was read. Shared by the parent
   and teacher portals so a family and a teacher are reading the same
   record rather than two different views of it. Tapping a day on the
   calendar opens that day's complete record — every portion heard that
   day, not just whichever one happens to colour the dot. */
export function RecitationHistory({ entries }: { entries: RecitationLogEntry[] }) {
  const { t, language } = useLanguage();
  // The most recent session's month drives the calendar, so opening the
  // page lands on whichever month actually has sessions logged in it.
  const latest = entries[entries.length - 1];
  const [cursor, setCursor] = useState(() => {
    const d = latest ? new Date(latest.date + "T00:00:00Z") : new Date();
    return { year: d.getUTCFullYear(), month: d.getUTCMonth() };
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Grouped rather than one-entry-per-day: a day a teacher graded more than
  // one portion on should show all of them, not just whichever was written
  // to the map last.
  const byDate = useMemo(() => {
    const map = new Map<string, RecitationLogEntry[]>();
    for (const e of entries) {
      const list = map.get(e.date);
      if (list) list.push(e);
      else map.set(e.date, [e]);
    }
    return map;
  }, [entries]);

  const pad = (n: number) => String(n).padStart(2, "0");
  const first = new Date(Date.UTC(cursor.year, cursor.month, 1));
  const startWeekday = first.getUTCDay();
  const daysInMonth = new Date(Date.UTC(cursor.year, cursor.month + 1, 0)).getUTCDate();
  const cells: (number | null)[] = [
    ...Array(startWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const monthEntries = entries.filter((e) => e.date.startsWith(`${cursor.year}-${pad(cursor.month + 1)}`));
  const tally = tallyRatings(monthEntries);
  const hasAny = entries.length > 0;
  const selectedEntries = selectedDate ? (byDate.get(selectedDate) ?? []) : [];

  const shiftMonth = (delta: number) => {
    setSelectedDate(null);
    setCursor(({ year, month }) => {
      const d = new Date(Date.UTC(year, month + delta, 1));
      return { year: d.getUTCFullYear(), month: d.getUTCMonth() };
    });
  };

  if (!hasAny) {
    return <EmptyNote>{t("common.noSessionsGraded")}</EmptyNote>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={() => shiftMonth(-1)}
          aria-label={t("common.previousMonth")}
          className="w-7 h-7 rounded-full flex items-center justify-center text-ink-muted hover:bg-surface-bg-warm hover:text-ink transition"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="rtl:-scale-x-100"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
        <p className="text-[13px] font-semibold text-ink tabular-nums">
          {MONTHS[cursor.month]} {cursor.year}
        </p>
        <button
          type="button"
          onClick={() => shiftMonth(1)}
          aria-label={t("common.nextMonth")}
          className="w-7 h-7 rounded-full flex items-center justify-center text-ink-muted hover:bg-surface-bg-warm hover:text-ink transition"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="rtl:-scale-x-100"><path d="M9 18l6-6-6-6" /></svg>
        </button>
      </div>

      <div className="grid grid-cols-7 gap-y-1 text-center mb-1">
        {WEEKDAY_SHORT.map((w) => (
          <span key={w} className="text-[9px] font-semibold text-ink-muted uppercase">{w}</span>
        ))}
        {cells.map((day, i) => {
          if (day === null) return <span key={i} />;
          const iso = `${cursor.year}-${pad(cursor.month + 1)}-${pad(day)}`;
          const dayEntries = byDate.get(iso) ?? [];
          const selected = selectedDate === iso;
          return (
            <button
              key={i}
              type="button"
              onClick={() => setSelectedDate(selected ? null : iso)}
              aria-pressed={selected}
              aria-label={
                dayEntries.length > 0
                  ? `${formatDay(iso, language)} — ${countLabel(
                      "{count} session graded|{count} sessions graded",
                      dayEntries.length,
                      `${dayEntries.length} ${dayEntries.length > 1 ? t("common.sessionsGraded") : t("common.sessionGraded")}`,
                    )}`
                  : formatDay(iso, language)
              }
              className={`flex flex-col items-center justify-center h-8 gap-0.5 rounded-lg transition-colors ${
                selected ? "bg-brand-navy/10 dark:bg-brand-gold/15" : "hover:bg-surface-bg-warm"
              }`}
            >
              <span
                className={`text-[10px] tabular-nums ${selected ? "font-bold text-ink" : "text-ink-muted"}`}
              >
                {day}
              </span>
              <span className="flex items-center gap-0.5 h-1.5">
                {dayEntries.length === 0 ? (
                  <span className="w-1.5 h-1.5" />
                ) : (
                  dayEntries.map((e) => (
                    <span key={e.id} className={`w-1.5 h-1.5 rounded-full ${DAILY_RATING_DOT[e.rating]}`} />
                  ))
                )}
              </span>
            </button>
          );
        })}
      </div>

      {selectedDate && (
        <div className="mt-3 rounded-2xl border border-surface-border bg-surface-bg-warm p-3.5">
          <div className="flex items-baseline justify-between mb-1">
            <p className="eyebrow">{formatDay(selectedDate, language)}</p>
            <button
              type="button"
              onClick={() => setSelectedDate(null)}
              className="text-[11px] font-semibold text-ink-muted hover:text-ink transition-colors"
            >
              {t("common.close")}
            </button>
          </div>
          {selectedEntries.length === 0 ? (
            <EmptyNote>{t("common.noSessionThisDay")}</EmptyNote>
          ) : (
            <ul className="divide-y divide-surface-border -my-1">
              {selectedEntries.map((e) => (
                <li key={e.id}>
                  <LogEntryRow entry={e} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="gold-rule my-4" />

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mb-4">
        {monthEntries.length === 0 ? (
          <EmptyNote>{t("common.noSessionsThisMonth")}</EmptyNote>
        ) : (
          DAILY_RATING_ORDER.filter((r) => tally[r] > 0).map((r) => (
            <span key={r} className="inline-flex items-center gap-1.5 text-[12px]">
              <span className={`w-1.5 h-1.5 rounded-full ${DAILY_RATING_DOT[r]}`} />
              <span className="tabular-nums font-semibold text-ink">{tally[r]}</span>
              <span className="text-ink-muted">{t(RATING_KEY[r])}</span>
            </span>
          ))
        )}
      </div>

      {/* Newest first — what was read each day, and how it went. */}
      <ul className="divide-y divide-surface-border -my-1 max-h-72 overflow-y-auto">
        {entries
          .slice()
          .reverse()
          .map((e) => (
            <li key={e.id}>
              <LogEntryRow entry={e} showDate />
            </li>
          ))}
      </ul>
    </div>
  );
}

/* ── Teacher's note ────────────────────────────────────────────────────
   Was a blue Bootstrap alert on three pages. A gold-edged quote reads as
   someone speaking, which is what it is. */
export function TeacherNote({ children }: { children: React.ReactNode }) {
  const { t } = useLanguage();
  return (
    <div className="mt-3 ps-3 border-l-2 border-brand-gold/50">
      <p className="eyebrow mb-1">{t("common.teachersNote")}</p>
      <p className="text-[13px] text-ink-body font-serif italic leading-snug">{children}</p>
    </div>
  );
}

/* ── Halaqa title ──────────────────────────────────────────────────────
   "Grade 5 · North Campus · Hifd program - Shaykh Ismail" as it's read: the
   grade, the campus and the halaqa each their own colour instead of one
   grey-black run, with a Hifd program marked. On a navy (open) row the
   colours give way to white. */
export function HalaqaTitle({ label, onDark = false, className = "" }: { label: string; onDark?: boolean; className?: string }) {
  const parts = label.split(" · ");
  const name = parts[parts.length - 1];
  const gradeFirst = parts.length > 1 && /\d|Pre-K|Kindergarten|الصف|تمهيدي|روضة/i.test(parts[0]);
  const grade = gradeFirst ? parts[0] : null;
  const campus = parts.length >= (gradeFirst ? 3 : 2) ? parts[gradeFirst ? 1 : 0] : null;
  const pill = "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold leading-tight whitespace-nowrap";
  const program = /\bhif(?:d|z|dh)\b/i.test(name);
  return (
    <span className={`inline-flex flex-wrap items-center gap-x-1.5 gap-y-1 ${className}`}>
      {grade && (
        <span className={`${pill} ${onDark ? "bg-white/20 text-white" : "bg-brand-navy/10 text-brand-navy dark:bg-brand-gold/15 dark:text-brand-gold"}`}>{grade}</span>
      )}
      {campus && (
        <span className={`${pill} ${onDark ? "bg-white/15 text-white" : "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-200"}`}>{campus}</span>
      )}
      {program && (
        <span className={`${pill} ${onDark ? "bg-amber-300/30 text-amber-100" : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"}`}>Hifd</span>
      )}
      <span className={`font-semibold [overflow-wrap:anywhere] ${onDark ? "text-white" : "text-ink"}`}>{name}</span>
    </span>
  );
}
