"use client";

// The pieces every portal repeats: a section card, a stat tile, a progress
// bar, the attendance strip and a segmented switch. These existed three times
// over in slightly different forms — a 3xl bold sans heading on one page, a
// serif one on another, bars in four different heights — which is what made
// the product read as three products.

import { useEffect, useMemo, useState } from "react";
import {
  ATTENDANCE_DOT,
  ATTENDANCE_LABELS,
  DAILY_RATING_DOT,
  DAILY_RATING_LABELS,
  DAILY_RATING_ORDER,
  DAILY_RATING_STYLES,
  MONTHS,
  PORTION_LABELS,
  WEEKDAY_SHORT,
  formatDay,
  tallyRatings,
  type AttendanceDay,
  type AttendanceSummary,
  type RecitationLogEntry,
} from "@/data/demo";
import { getSurahById } from "@/data/mushaf-index";
import type { DailyRating } from "@/hooks/useQuranicAssignments";

/* ── Modal ─────────────────────────────────────────────────────────────
   Escape and a backdrop click both close. The navy header matches the
   heroes, so a panel reads as part of the page it opened from. */
export function Modal({
  title,
  subtitle,
  badge,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  /** Usually initials, shown in a circle beside the title. */
  badge?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
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
        className="relative w-full max-w-md max-h-[85vh] overflow-y-auto bg-surface-card border border-surface-border rounded-[18px] shadow-2xl animate-slide-up"
      >
        <div className="gradient-navy rounded-t-[18px] px-6 py-5 relative overflow-hidden sticky top-0 z-10">
          <div className="pattern-lattice absolute inset-0 opacity-40 pointer-events-none" />
          {/* z-20 is load-bearing. The title row below is `relative` and comes
              later in the DOM; two positioned siblings with no z-index paint
              in DOM order, so the row was painting over this button and
              swallowing every click on it. Its `pr-8` only insets the
              content — the row's own box still runs the full width, straight
              across the X. */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute top-4 right-4 z-20 w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
          <div className="relative flex items-center gap-3.5 pr-8">
            {badge && (
              <span className="w-12 h-12 rounded-full bg-white/15 border border-white/25 flex items-center justify-center text-[15px] font-bold text-white flex-shrink-0">
                {badge}
              </span>
            )}
            <div className="min-w-0">
              <h2 className="page-title text-white text-lg truncate">{title}</h2>
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
    <section className={`card-quiet p-5 ${className}`}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="page-title text-lg">{title}</h2>
        {note && <span className="eyebrow flex-shrink-0">{note}</span>}
      </div>
      <div className="gold-rule my-4" />
      {children}
    </section>
  );
}

/* ── Stat tile ─────────────────────────────────────────────────────────
   A number that carries the context making it mean something. Renders as a
   button when given an onClick, so a stat can lead somewhere. */
export function StatTile({
  value,
  label,
  sub,
  onClick,
}: {
  value: string | number;
  label: string;
  sub?: string;
  onClick?: () => void;
}) {
  const body = (
    <>
      <p className="text-[26px] font-bold text-ink tabular-nums leading-none">{value}</p>
      <p className="eyebrow mt-2 whitespace-nowrap">{label}</p>
      {sub && <p className="text-[11px] text-ink-muted mt-1.5 leading-snug">{sub}</p>}
    </>
  );

  if (!onClick) {
    return <div className="card-quiet px-4 py-4">{body}</div>;
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className="card-quiet px-4 py-4 text-left cursor-pointer hover:bg-surface-bg-warm hover:-translate-y-0.5 transition-all active:scale-[.98]"
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
  const recent = days.slice(0, limit).slice().reverse();
  const bar = size === "lg" ? "h-7 rounded-lg" : "h-1.5 rounded-full";
  return (
    <div
      className={`flex ${size === "lg" ? "gap-1.5" : "gap-1"}`}
      role="img"
      aria-label={`Attendance for the last ${recent.length} days`}
    >
      {recent.map((d) => (
        <span
          key={d.date}
          title={`${formatDay(d.date)} · ${ATTENDANCE_LABELS[d.status]}`}
          className={`flex-1 ${bar} ${ATTENDANCE_DOT[d.status]}`}
        />
      ))}
    </div>
  );
}

/* ── Attendance legend ─────────────────────────────────────────────────
   Counts with their dot, hiding any status that did not occur. */
export function AttendanceLegend({ counts }: { counts: AttendanceSummary }) {
  const order = ["present", "late", "absent", "excused"] as const;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {order
        .filter((s) => counts[s] > 0)
        .map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5 text-[12px]">
            <span className={`w-1.5 h-1.5 rounded-full ${ATTENDANCE_DOT[s]}`} />
            <span className="tabular-nums font-semibold text-ink">{counts[s]}</span>
            <span className="text-ink-muted">{s}</span>
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
  if (options.length < 2) return null;
  return (
    <div
      role="tablist"
      aria-label={label}
      className="inline-flex p-1 gap-1 rounded-full bg-surface-bg-warm border border-surface-border"
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={`px-4 py-1.5 rounded-full text-[13px] font-semibold transition-all ${
              active
                ? "bg-brand-navy text-white shadow-sm"
                : "text-ink-muted hover:text-ink"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ── Empty state ───────────────────────────────────────────────────────
   Quiet rather than an alert box; nothing here is a problem. */
export function EmptyNote({ children }: { children: React.ReactNode }) {
  return <p className="text-[13px] text-ink-muted py-2">{children}</p>;
}

/* ── Daily rating pill ─────────────────────────────────────────────────
   Excellent / Very good / Good / Weak — what a teacher grades today's
   recitation as, coloured so a parent reads it at a glance before any
   percentage. */
export function RatingPill({ rating }: { rating: DailyRating }) {
  return (
    <span
      className={`text-[11px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${DAILY_RATING_STYLES[rating]}`}
    >
      {DAILY_RATING_LABELS[rating]}
    </span>
  );
}

/* ── One recitation, in full ──────────────────────────────────────────
   What was read, and how it went. Shared between the timeline and the
   selected-day detail below, since both show the same thing. */
function LogEntryRow({ entry, showDate }: { entry: RecitationLogEntry; showDate?: boolean }) {
  const surah = getSurahById(entry.surah);
  return (
    <div className="flex items-start justify-between gap-3 py-2.5">
      <div className="min-w-0">
        <p className="text-[12px] font-semibold text-ink">
          {showDate && `${formatDay(entry.date)} · `}
          {PORTION_LABELS[entry.portion]}
        </p>
        <p className="text-[11px] text-ink-muted truncate">
          {surah ? surah.englishName : `Surah ${entry.surah}`} · ayahs {entry.ayah_start}–{entry.ayah_end}
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
    return <EmptyNote>No sessions have been graded yet.</EmptyNote>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={() => shiftMonth(-1)}
          aria-label="Previous month"
          className="w-7 h-7 rounded-full flex items-center justify-center text-ink-muted hover:bg-surface-bg-warm hover:text-ink transition"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
        <p className="text-[13px] font-semibold text-ink tabular-nums">
          {MONTHS[cursor.month]} {cursor.year}
        </p>
        <button
          type="button"
          onClick={() => shiftMonth(1)}
          aria-label="Next month"
          className="w-7 h-7 rounded-full flex items-center justify-center text-ink-muted hover:bg-surface-bg-warm hover:text-ink transition"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
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
                  ? `${formatDay(iso)} — ${dayEntries.length} session${dayEntries.length > 1 ? "s" : ""} graded`
                  : formatDay(iso)
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
            <p className="eyebrow">{formatDay(selectedDate)}</p>
            <button
              type="button"
              onClick={() => setSelectedDate(null)}
              className="text-[11px] font-semibold text-ink-muted hover:text-ink transition-colors"
            >
              Close
            </button>
          </div>
          {selectedEntries.length === 0 ? (
            <EmptyNote>No session was graded this day.</EmptyNote>
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
          <EmptyNote>No sessions logged this month.</EmptyNote>
        ) : (
          DAILY_RATING_ORDER.filter((r) => tally[r] > 0).map((r) => (
            <span key={r} className="inline-flex items-center gap-1.5 text-[12px]">
              <span className={`w-1.5 h-1.5 rounded-full ${DAILY_RATING_DOT[r]}`} />
              <span className="tabular-nums font-semibold text-ink">{tally[r]}</span>
              <span className="text-ink-muted">{DAILY_RATING_LABELS[r]}</span>
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
  return (
    <div className="mt-3 pl-3 border-l-2 border-brand-gold/50">
      <p className="eyebrow mb-1">Teacher&apos;s note</p>
      <p className="text-[13px] text-ink-body font-serif italic leading-snug">{children}</p>
    </div>
  );
}
