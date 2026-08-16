"use client";

// The pieces every portal repeats: a section card, a stat tile, a progress
// bar, the attendance strip and a segmented switch. These existed three times
// over in slightly different forms — a 3xl bold sans heading on one page, a
// serif one on another, bars in four different heights — which is what made
// the product read as three products.

import { useEffect } from "react";
import {
  ATTENDANCE_DOT,
  ATTENDANCE_LABELS,
  formatDay,
  type AttendanceDay,
  type AttendanceSummary,
} from "@/data/demo";

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
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute top-4 right-4 w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition"
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
