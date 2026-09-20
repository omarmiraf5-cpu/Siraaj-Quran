"use client";

import {
  PACE_LABEL,
  milestonePercent,
  formatQuantity,
  formatUnits,
  milestoneTitle,
  readable,
  addDays,
  startOfWeek,
  todayISO,
  type Milestone,
  type PaceStatus,
  type PlanUnit,
} from "@/lib/yearlyPlan";
import {
  formatRange,
  dailySchedule,
  impliedDailyRate,
  type Direction,
  type Position,
} from "@/lib/mushafPlan";
import type { SchoolCalendar } from "@/lib/schoolCalendar";
import { Modal, SectionCard, EmptyNote } from "@/components/portal-ui";
import { Mushaf } from "@/components/Mushaf";
import { getSurahById } from "@/data/mushaf-index";

/**
 * The yearly-plan module's own visual language.
 *
 * Two constraints shape everything here, and both are hard:
 *
 * 1. Navy, gold and black. Colour is used for structure, not decoration —
 *    gold for what the child has actually done, navy for what the schedule
 *    asked for, black/ink for type. The one exception is the alert state,
 *    which uses the palette's existing error token: a warning that reads as
 *    the same gold as everything else is not a warning. It is deliberately
 *    the only hue in the module that is neither navy nor gold.
 *
 * 2. Nothing animate. No figures, no faces, no creatures — not in icons,
 *    not in empty states, not in illustrations. Every mark below is a
 *    circle, a polygon, a rule or a letterform, which is why the empty
 *    state is an eight-point star built from two squares rather than a
 *    picture of anything.
 */

/* ── Palette ───────────────────────────────────────────────────────────
   Held as literals rather than Tailwind classes because SVG stroke and
   the dasharray maths below need the values themselves. Kept in step with
   tailwind.config.ts by hand — there are five of them, and a build-time
   bridge for five constants would cost more than it saves. */
const NAVY = "#1e3f7a";
const NAVY_DARK = "#0e2347";
const GOLD = "#c6a253";
const GOLD_DARK = "#b8862f";
const ALERT = "#c15242";

export function paceColor(pace: PaceStatus): string {
  switch (pace) {
    case "behind":
      return ALERT;
    case "at_risk":
      return GOLD_DARK;
    case "complete":
    case "ahead":
      return GOLD;
    case "on_track":
      return NAVY;
    default:
      return NAVY_DARK;
  }
}

/** Tailwind equivalents, for text and backgrounds where a class is cleaner. */
export function paceTextClass(pace: PaceStatus): string {
  switch (pace) {
    case "behind":
      return "text-status-error-text";
    case "at_risk":
      return "text-brand-gold-dark";
    case "complete":
    case "ahead":
      return "text-brand-gold-dark dark:text-brand-gold";
    case "on_track":
      return "text-brand-navy dark:text-brand-gold";
    default:
      return "text-ink-muted";
  }
}

/* ── Pace dial ─────────────────────────────────────────────────────────
   Two concentric arcs on one axis: the outer is where the child is, the
   inner hairline is where the schedule says they should be. The gap
   between the two arc ends *is* the story — a parent reads "am I short?"
   off the shape before reading a single number, which is the whole point
   of drawing it rather than printing two percentages. */
export function PaceDial({
  percentComplete,
  percentExpected,
  pace,
  size = 176,
}: {
  percentComplete: number;
  percentExpected: number;
  pace: PaceStatus;
  size?: number;
}) {
  const stroke = 10;
  const gap = 7; // between the two rings
  const rOuter = (size - stroke) / 2 - 2;
  const rInner = rOuter - stroke - gap;
  const cOuter = 2 * Math.PI * rOuter;
  const cInner = 2 * Math.PI * rInner;

  const actual = Math.max(0, Math.min(100, percentComplete));
  const expected = Math.max(0, Math.min(100, percentExpected));
  const colour = paceColor(pace);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={`${Math.round(actual)} percent complete against ${Math.round(
        expected
      )} percent expected — ${PACE_LABEL[pace]}`}
      className="flex-shrink-0"
    >
      {/* Rotated so both arcs start at twelve o'clock rather than three. */}
      <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={rOuter}
          fill="none"
          stroke="currentColor"
          className="text-surface-border"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={rOuter}
          fill="none"
          stroke={colour}
          strokeWidth={stroke}
          strokeLinecap="butt"
          strokeDasharray={`${(cOuter * actual) / 100} ${cOuter}`}
          style={{ transition: "stroke-dasharray 700ms ease-out" }}
        />
        {/* The expected ring is a hairline, not a second heavy arc: it is a
            reference line, and drawing it with equal weight would read as
            two competing results. */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={rInner}
          fill="none"
          stroke="currentColor"
          className="text-surface-border"
          strokeWidth={2}
        />
        {/* currentColor rather than the navy literal: navy on the dark
            theme's near-black ground is almost invisible, and this ring is
            the reference the whole dial is read against. A Tailwind pair
            lets it lift to a light hairline in dark mode without becoming
            a second gold arc competing with the result. */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={rInner}
          fill="none"
          stroke="currentColor"
          className="text-brand-navy dark:text-white/70"
          strokeWidth={2}
          strokeDasharray={`${(cInner * expected) / 100} ${cInner}`}
          style={{ transition: "stroke-dasharray 700ms ease-out" }}
        />
      </g>

      <text
        x="50%"
        y="47%"
        textAnchor="middle"
        className="fill-ink"
        style={{ fontSize: 30, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}
      >
        {Math.round(actual)}%
      </text>
      <text
        x="50%"
        y="60%"
        textAnchor="middle"
        className="fill-ink-muted"
        style={{ fontSize: 10, letterSpacing: "0.14em", fontWeight: 700 }}
      >
        {`OF ${Math.round(expected)}% DUE`}
      </text>
    </svg>
  );
}

/* ── Pace bar ──────────────────────────────────────────────────────────
   The dial's flat cousin, for rows in a list. The notch is the expected
   position; the fill is the real one. */
export function PaceBar({
  percentComplete,
  percentExpected,
  pace = "on_track",
  height = 8,
  showNotch = true,
}: {
  percentComplete: number;
  percentExpected?: number;
  pace?: PaceStatus;
  height?: number;
  showNotch?: boolean;
}) {
  const actual = Math.max(0, Math.min(100, percentComplete));
  const expected =
    percentExpected == null ? null : Math.max(0, Math.min(100, percentExpected));

  return (
    <div
      className="relative w-full rounded-full bg-surface-bg overflow-hidden"
      style={{ height }}
    >
      <div
        className="h-full rounded-full"
        style={{
          width: `${actual}%`,
          background: paceColor(pace),
          transition: "width 700ms ease-out",
        }}
      />
      {showNotch && expected != null && expected > 0 && expected < 100 && (
        // Not rounded and deliberately hard-edged: it is a datum line, and
        // a soft marker would read as part of the fill.
        <span
          aria-hidden
          className="absolute top-0 bottom-0 w-[2px] bg-ink/55 dark:bg-white/60"
          style={{ left: `calc(${expected}% - 1px)` }}
        />
      )}
    </div>
  );
}

/* ── Pace chip ─────────────────────────────────────────────────────────
   Typographic, not iconographic: the word itself, in the state's colour,
   on a hairline-bordered pill. */
export function PaceChip({ pace }: { pace: PaceStatus }) {
  const colour = paceColor(pace);
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.1em] whitespace-nowrap"
      style={{ color: colour, borderColor: `${colour}55`, background: `${colour}12` }}
    >
      <span
        aria-hidden
        className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{ background: colour }}
      />
      {PACE_LABEL[pace]}
    </span>
  );
}

/* ── Alert banner ──────────────────────────────────────────────────────
   The behind-schedule notice. Its glyph is a hollow triangle with a bar
   and a dot — a caution mark drawn from three primitives, chosen because
   the obvious alternatives in most icon sets are a face or a hand. */
export function AlertGlyph({ size = 18, colour }: { size?: number; colour: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={colour}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="flex-shrink-0"
    >
      <path d="M12 3 22 20H2Z" />
      <path d="M12 10v4.5" />
      <path d="M12 17.4h.01" />
    </svg>
  );
}

export function PlanAlertBanner({
  level,
  title,
  detail,
  acknowledged,
  onAcknowledge,
  busy,
}: {
  level: "info" | "warning" | "critical";
  title: string;
  detail: string;
  acknowledged?: boolean;
  onAcknowledge?: () => void;
  busy?: boolean;
}) {
  const colour = level === "critical" ? ALERT : level === "warning" ? GOLD_DARK : NAVY;

  return (
    <div
      role={level === "critical" ? "alert" : "status"}
      className={`rounded-[18px] border px-5 py-4 flex items-start gap-3.5 ${
        acknowledged ? "opacity-60" : ""
      }`}
      style={{ borderColor: `${colour}44`, background: `${colour}0f` }}
    >
      {/* A vertical rule rather than a filled block — the same stop that a
          margin note uses, which keeps the banner quiet enough to live
          above a dashboard without dominating it. */}
      <span aria-hidden className="w-[3px] self-stretch rounded-full" style={{ background: colour }} />
      <AlertGlyph colour={colour} />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-bold tracking-tight" style={{ color: colour }}>
          {title}
        </p>
        <p className="text-[13px] text-ink-body mt-1 leading-relaxed">{detail}</p>
      </div>
      {onAcknowledge && (
        <button
          type="button"
          onClick={onAcknowledge}
          disabled={busy}
          className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-muted hover:text-ink disabled:opacity-40 flex-shrink-0 mt-0.5"
        >
          {acknowledged ? "Seen" : "Dismiss"}
        </button>
      )}
    </div>
  );
}

/* ── Empty state ───────────────────────────────────────────────────────
   The MyDiiwaan monogram — the navy shield and gold MD cut out of the
   full crest.

   The whole crest is not used here for two reasons. It carries two owls,
   and this module was built to hold no animate imagery anywhere; and at
   the 56px an empty state gives it, a crest with a banner and two lines
   of type renders as a dark smudge. The monogram is the same brand mark
   with neither problem: letterforms and a shield, legible small.

   A plain <img> rather than next/image: it is a fixed-size decorative
   mark, so the resizing and lazy-loading machinery would cost more than
   it returns, and next/image's wrapper fights the flex centring here. */
export function GeometricEmblem({ size = 56 }: { size?: number; tone?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/mark.png"
      alt=""
      aria-hidden
      width={size}
      height={size}
      // The mark has its own dark ground, so it needs no theme handling —
      // it reads the same on cream and on near-black. drop-shadow rather
      // than box-shadow so the rounded corners are respected.
      style={{ width: size, height: size, filter: "drop-shadow(0 2px 6px rgba(20,24,35,.18))" }}
      className="flex-shrink-0"
    />
  );
}

export function PlanEmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center text-center py-12 px-6">
      <GeometricEmblem />
      <p className="page-title text-[17px] mt-5">{title}</p>
      <p className="text-[13px] text-ink-muted mt-2 max-w-sm leading-relaxed">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/** The surah span a milestone covers, or "" when the plan is a plain
 *  count with no mushaf anchor. */
export function mushafRange(m: Milestone): string {
  if (m.from_surah == null || m.from_ayah == null || m.to_surah == null || m.to_ayah == null) {
    return "";
  }
  return formatRange(
    { surah: m.from_surah, ayah: m.from_ayah },
    { surah: m.to_surah, ayah: m.to_ayah }
  );
}

/** Shared by the row and the navigator, so "overdue" can't drift into two
 *  different answers depending on which one is asked. */
export function isOverdue(m: Milestone, today: string): boolean {
  return m.due_on < today && m.status !== "completed" && m.completed_units < m.target_units;
}

/* ── Milestone row ─────────────────────────────────────────────────────
   One segment of the plan: its number, its window, its bar, its figures.
   The sequence number is set in the serif display face and given its own
   ruled column, so the list reads as a numbered plan rather than as a
   stack of cards. */
export function MilestoneRow({
  milestone,
  unit,
  today,
  onRecord,
  onViewMushaf,
  children,
}: {
  milestone: Milestone;
  unit: PlanUnit;
  today: string;
  onRecord?: () => void;
  /** Opens the real mushaf, highlighted to this milestone's stored range.
   *  Omitted entirely — not just hidden — when the milestone has no range,
   *  since a plain-count plan (qaidah, lessons) has nothing to show. */
  onViewMushaf?: (m: Milestone) => void;
  children?: React.ReactNode;
}) {
  const pct = milestonePercent(milestone);
  const overdue = isOverdue(milestone, today);
  const done = milestone.status === "completed";
  const pace: PaceStatus = done ? "complete" : overdue ? "behind" : "on_track";

  return (
    <li className="flex gap-4 py-4">
      <div className="flex flex-col items-center flex-shrink-0 w-8">
        <span
          className="page-title text-[15px] leading-none tabular-nums"
          style={{ color: done ? GOLD_DARK : overdue ? ALERT : undefined }}
        >
          {String(milestone.sequence).padStart(2, "0")}
        </span>
        <span aria-hidden className="w-px flex-1 mt-2 bg-surface-border" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <p className="text-[14px] font-semibold text-ink min-w-0">
            {/* The surah range is the title when the teacher hasn't
                written one: "Al-Mulk 1–30" says more than "Milestone 3",
                and it is the thing a parent actually looks for. */}
            {milestone.title?.trim()
              ? milestoneTitle(milestone)
              : mushafRange(milestone) || milestoneTitle(milestone)}
          </p>
          <span className="eyebrow flex-shrink-0">
            {milestone.starts_on} — {milestone.due_on}
          </span>
        </div>
        {milestone.title?.trim() && mushafRange(milestone) && (
          <p className="text-[12px] text-brand-navy dark:text-brand-gold mt-1 font-medium">
            {mushafRange(milestone)}
          </p>
        )}

        {milestone.description && (
          <p className="text-[12.5px] text-ink-muted mt-1.5 leading-relaxed">
            {readable(milestone.description)}
          </p>
        )}

        <div className="mt-3 flex items-center gap-3">
          <PaceBar percentComplete={pct} pace={pace} height={6} showNotch={false} />
          <span className="text-[12px] text-ink-muted tabular-nums whitespace-nowrap flex-shrink-0">
            {formatQuantity(milestone.completed_units)} / {formatUnits(milestone.target_units, unit)}
          </span>
        </div>

        {(overdue || done || onRecord || (onViewMushaf && mushafRange(milestone))) && (
          <div className="mt-2.5 flex items-center gap-3 flex-wrap">
            {done && (
              <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-brand-gold-dark">
                Completed{milestone.completed_on ? ` · ${milestone.completed_on}` : ""}
              </span>
            )}
            {overdue && (
              <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-status-error-text">
                Past due
              </span>
            )}
            {onRecord && (
              <button
                type="button"
                onClick={onRecord}
                className="text-[11px] font-bold uppercase tracking-[0.1em] text-brand-navy dark:text-brand-gold hover:underline"
              >
                Record progress
              </button>
            )}
            {onViewMushaf && mushafRange(milestone) && (
              <button
                type="button"
                onClick={() => onViewMushaf(milestone)}
                className="text-[11px] font-bold uppercase tracking-[0.1em] text-brand-navy dark:text-brand-gold hover:underline"
              >
                View in Mushaf
              </button>
            )}
          </div>
        )}

        {children}
      </div>
    </li>
  );
}

/* ── Mushaf view ───────────────────────────────────────────────────────
   The real, illustrated mushaf reader — the same component the teacher
   already sees live while writing a daily assignment, and the parent
   sees on the Mushaf tab — opened here on demand with a milestone's
   stored range lit up. It is not embedded in the row itself: it carries
   its own reciter and audio controls, real width, and Arabic type at a
   size that would overwhelm a list of fifty rows if any of them could be
   showing one at once. One modal, opened by whichever row or navigator
   control asks for it, is the version that stays out of the way until
   asked for. */
export function MilestoneMushafModal({
  milestone,
  onClose,
}: {
  milestone: Milestone | null;
  onClose: () => void;
}) {
  if (
    !milestone ||
    milestone.from_surah == null ||
    milestone.from_ayah == null ||
    milestone.to_surah == null ||
    milestone.to_ayah == null
  ) {
    return null;
  }

  const range = mushafRange(milestone);
  return (
    <Modal
      title={range || milestoneTitle(milestone)}
      subtitle={`${milestone.starts_on} — ${milestone.due_on}`}
      wide
      onClose={onClose}
    >
      <Mushaf
        // Opens on the range's own starting surah, the same convention
        // the assignment form's live preview uses — a teacher who needs
        // the exact opening page for a surah spanning several can still
        // turn to it from here.
        initialPage={getSurahById(milestone.from_surah)?.startPage ?? 1}
        highlightedRange={{
          surah: milestone.from_surah,
          start: milestone.from_ayah,
          surahEnd: milestone.to_surah,
          end: milestone.to_ayah,
        }}
      />
    </Modal>
  );
}

/* ── Milestone navigator ──────────────────────────────────────────────
   Steps a teacher from the first milestone to the last without scrolling
   the full list: Prev/Next, a live counter, and a strip of every
   milestone's number they can jump to directly. Colour follows the same
   rule as the row it stands above — gold once done, the alert tone once
   overdue — so the strip reads as a spine of the plan's progress even
   before anything below it is opened. */
export function MilestoneNavigator({
  milestones,
  today,
  focusedId,
  onFocus,
  onViewMushaf,
}: {
  milestones: Milestone[];
  today: string;
  focusedId: string | null;
  onFocus: (id: string) => void;
  onViewMushaf?: (m: Milestone) => void;
}) {
  if (milestones.length === 0) return null;

  const index = Math.max(
    0,
    milestones.findIndex((m) => m.id === focusedId)
  );
  const focused = milestones[index] ?? milestones[0];
  const goTo = (i: number) => {
    const clamped = Math.max(0, Math.min(milestones.length - 1, i));
    onFocus(milestones[clamped].id);
  };

  return (
    <div className="mb-5">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => goTo(index - 1)}
          disabled={index === 0}
          aria-label="Previous milestone"
          className="flex-shrink-0 p-2 rounded-lg border border-surface-border text-ink-muted hover:text-ink disabled:opacity-30 disabled:pointer-events-none transition"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="rtl:rotate-180">
            <path d="M15 18 9 12l6-6" />
          </svg>
        </button>

        <div className="flex-1 min-w-0 text-center">
          <p className="eyebrow">
            Milestone {index + 1} of {milestones.length}
          </p>
          <p className="page-title text-[15px] truncate mt-0.5">
            {focused.title?.trim() ? milestoneTitle(focused) : mushafRange(focused) || milestoneTitle(focused)}
          </p>
        </div>

        <button
          type="button"
          onClick={() => goTo(index + 1)}
          disabled={index === milestones.length - 1}
          aria-label="Next milestone"
          className="flex-shrink-0 p-2 rounded-lg border border-surface-border text-ink-muted hover:text-ink disabled:opacity-30 disabled:pointer-events-none transition"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="rtl:rotate-180">
            <path d="m9 18 6-6-6-6" />
          </svg>
        </button>
      </div>

      {onViewMushaf && mushafRange(focused) && (
        <div className="flex justify-center mt-2">
          <button
            type="button"
            onClick={() => onViewMushaf(focused)}
            className="text-[11px] font-bold uppercase tracking-[0.1em] text-brand-navy dark:text-brand-gold hover:underline"
          >
            View in Mushaf
          </button>
        </div>
      )}

      {/* The jump strip. Horizontally scrollable rather than wrapping: a
          52-milestone plan wrapped onto its own rows would push the Prev/
          Next controls an unpredictable distance down the page depending
          on plan length, and a single scrollable line keeps the layout
          the same size for a 4-milestone plan and a 40-milestone one. */}
      <div
        role="tablist"
        aria-label="Jump to a milestone"
        className="mt-3 flex gap-1.5 overflow-x-auto pb-1"
      >
        {milestones.map((m, i) => {
          const done = m.status === "completed";
          const overdue = isOverdue(m, today);
          const isFocused = m.id === focused.id;
          const tone = done ? GOLD_DARK : overdue ? ALERT : undefined;
          return (
            <button
              key={m.id}
              type="button"
              role="tab"
              aria-selected={isFocused}
              aria-label={`Milestone ${i + 1}${done ? ", completed" : overdue ? ", past due" : ""}`}
              title={mushafRange(m) || milestoneTitle(m)}
              onClick={() => goTo(i)}
              className={`flex-shrink-0 w-8 h-8 rounded-full text-[12px] font-bold tabular-nums flex items-center justify-center border transition ${
                isFocused
                  ? "border-brand-navy ring-2 ring-brand-navy/25 dark:ring-brand-gold/30"
                  : "border-surface-border hover:border-ink-muted"
              }`}
              style={tone ? { color: tone, background: `${tone}14` } : undefined}
            >
              {m.sequence}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ── Figure ────────────────────────────────────────────────────────────
   A number with its label, ruled off from its neighbours. Deliberately
   flatter than the portal's StatTile: a row of bordered cards inside an
   already-bordered panel is the thing that makes a dashboard look busy. */
export function PlanFigure({
  value,
  label,
  tone,
}: {
  value: string | number;
  label: string;
  tone?: string;
}) {
  return (
    <div className="min-w-0 px-4 first:ps-0 border-s border-surface-border first:border-s-0">
      <p
        className="text-[21px] font-bold tabular-nums leading-none text-ink"
        style={tone ? { color: tone } : undefined}
      >
        {value}
      </p>
      <p className="eyebrow mt-2 leading-tight">{label}</p>
    </div>
  );
}

function weekdayLabel(iso: string): string {
  return new Date(iso + "T12:00:00Z").toLocaleDateString("en-CA", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** The shape both DailyWorkPanel and FullYearScheduleModal need off a
 *  plan — never the whole Plan type, so a caller can pass one straight
 *  off an API payload without a cast. */
interface DailyPacePlan {
  starts_on: string;
  ends_on: string;
  unit: PlanUnit;
  start_surah: number | null;
  start_ayah: number | null;
  direction: Direction | null;
  daily_new_amount: number | null;
  daily_review_amount: number | null;
}

/**
 * The steady per-day pace this plan actually runs at, however it was
 * set up: the rate directly, if a teacher typed one, or — for an ordinary
 * "total for the year" plan — the total worked out across however many
 * instructional days the plan's own span holds. Either way the rest of
 * this file only ever needs one number, not two different plan shapes.
 *
 * Null when there is nothing to derive a pace from at all: no anchor, or
 * no rate and no total either (a bare plan with no milestones yet).
 */
function dailyPaceOf(plan: DailyPacePlan, cal: SchoolCalendar, totalUnits?: number): number | null {
  if (plan.start_surah == null || plan.start_ayah == null || plan.direction == null) return null;
  if (plan.daily_new_amount != null) return plan.daily_new_amount;
  if (totalUnits && totalUnits > 0) {
    const rate = impliedDailyRate(totalUnits, plan.starts_on, plan.ends_on, cal);
    return rate > 0 ? rate : null;
  }
  return null;
}

/**
 * "1 page a day" made concrete: the week containing today, one row per
 * calendar day, each showing exactly what the plan expects for that day —
 * or "No class" for a weekend or a listed closure, which is the point of
 * asking the school for its calendar in the first place.
 *
 * Works for a plan set up either way: one with a daily rate typed
 * directly, or an ordinary "total for the year" plan, whose pace is
 * worked out from `totalUnits` (pass the plan's own progress.totalUnits —
 * the sum of its milestones' targets). Renders nothing without a mushaf
 * anchor or without either a rate or a total to derive one from.
 *
 * Review carries no position of its own — see dailySchedule's own note —
 * so it shows as a flat "+ N pages review" on every instructional day
 * rather than a range, which is an honest picture of what is actually
 * tracked rather than an invented one of which pages those are.
 */
export function DailyWorkPanel({
  plan,
  cal,
  totalUnits,
  today = todayISO(),
  onViewFullYear,
}: {
  plan: DailyPacePlan;
  cal: SchoolCalendar;
  /** The plan's overall target — progress.totalUnits — used only when the
   *  plan has no daily_new_amount of its own. */
  totalUnits?: number;
  today?: string;
  onViewFullYear?: () => void;
}) {
  const dailyAmount = dailyPaceOf(plan, cal, totalUnits);
  if (dailyAmount == null) return null;
  const start: Position = { surah: plan.start_surah!, ayah: plan.start_ayah! };
  const direction = plan.direction!;

  // The week containing today, clamped into the plan's own span — a plan
  // that has not started yet shows its first week rather than a week with
  // nothing scheduled at all, and a finished plan shows its last one.
  const anchorDay = today < plan.starts_on ? plan.starts_on : today > plan.ends_on ? plan.ends_on : today;
  const weekStart = startOfWeek(anchorDay);
  const weekEnd = addDays(weekStart, 6);

  const rows = dailySchedule(start, direction, plan.unit, dailyAmount, plan.starts_on, weekStart, weekEnd, cal);
  const byDate = new Map(rows.map((r) => [r.date, r]));
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <SectionCard
      title="This week's work"
      note={
        <span className="inline-flex items-center gap-3">
          {plan.daily_review_amount && (
            <span className="whitespace-nowrap">
              + {formatUnits(plan.daily_review_amount, plan.unit)} review daily
            </span>
          )}
          {onViewFullYear && (
            <button
              type="button"
              onClick={onViewFullYear}
              className="font-semibold text-brand-navy dark:text-brand-gold hover:underline whitespace-nowrap"
            >
              Whole year →
            </button>
          )}
        </span>
      }
    >
      {rows.length === 0 ? (
        <EmptyNote>No school days fall in this week.</EmptyNote>
      ) : (
        <ul className="divide-y divide-surface-border -my-1">
          {days.map((d) => {
            const row = byDate.get(d);
            const isToday = d === today;
            const inSpan = d >= plan.starts_on && d <= plan.ends_on;
            return (
              <li
                key={d}
                className={`flex items-center justify-between gap-3 py-2.5 ${
                  isToday ? "bg-brand-gold/10 -mx-2.5 px-2.5 rounded-lg" : ""
                }`}
              >
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-ink-muted uppercase tracking-wide">
                    {weekdayLabel(d)}
                    {isToday && <span className="text-brand-navy dark:text-brand-gold"> · Today</span>}
                  </p>
                  {row ? (
                    <p className="text-[13px] text-ink mt-0.5 font-medium">{row.label}</p>
                  ) : (
                    <p className="text-[13px] text-ink-muted mt-0.5 italic">
                      {inSpan ? "No class" : "Outside the plan's dates"}
                    </p>
                  )}
                </div>
                {row && plan.daily_review_amount ? (
                  <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-surface-bg-warm text-ink-muted flex-shrink-0 whitespace-nowrap">
                    + {formatUnits(plan.daily_review_amount, plan.unit)} review
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </SectionCard>
  );
}

function monthTitle(iso: string): string {
  return new Date(iso + "T12:00:00Z").toLocaleDateString("en-CA", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * The full list DailyWorkPanel's own week is a slice of — every
 * instructional day from the plan's first to its last, grouped by month
 * so a school year's worth of rows (a couple of hundred) stays scannable
 * instead of one undifferentiated scroll.
 *
 * Same rules as the week view: "open" decides whether this renders at
 * all, the same way MilestoneMushafModal reads a nullable milestone —
 * callers pass their toggle straight through rather than wrapping the
 * whole element in a condition themselves.
 */
export function FullYearScheduleModal({
  open,
  plan,
  cal,
  totalUnits,
  onClose,
}: {
  open: boolean;
  plan: DailyPacePlan;
  cal: SchoolCalendar;
  totalUnits?: number;
  onClose: () => void;
}) {
  if (!open) return null;
  const dailyAmount = dailyPaceOf(plan, cal, totalUnits);
  if (dailyAmount == null) return null;
  const start: Position = { surah: plan.start_surah!, ayah: plan.start_ayah! };

  const rows = dailySchedule(
    start,
    plan.direction!,
    plan.unit,
    dailyAmount,
    plan.starts_on,
    plan.starts_on,
    plan.ends_on,
    cal
  );

  const months: Array<{ key: string; label: string; rows: typeof rows }> = [];
  for (const r of rows) {
    const key = r.date.slice(0, 7);
    const current = months[months.length - 1];
    if (current?.key === key) current.rows.push(r);
    else months.push({ key, label: monthTitle(r.date), rows: [r] });
  }

  return (
    <Modal
      title="The whole year, day by day"
      subtitle={`${rows.length} school day${rows.length === 1 ? "" : "s"}, about ${formatUnits(
        dailyAmount,
        plan.unit
      )} each`}
      wide
      onClose={onClose}
    >
      {rows.length === 0 ? (
        <EmptyNote>No school days fall in this plan's dates.</EmptyNote>
      ) : (
        <div className="space-y-6 max-h-[65vh] overflow-y-auto">
          {months.map((m) => (
            <div key={m.key}>
              <p className="eyebrow mb-2">{m.label}</p>
              <ul className="divide-y divide-surface-border -my-1">
                {m.rows.map((r) => (
                  <li key={r.date} className="flex items-center justify-between gap-3 py-2">
                    <span className="text-[11px] font-semibold text-ink-muted uppercase tracking-wide w-24 flex-shrink-0">
                      {weekdayLabel(r.date)}
                    </span>
                    <span className="text-[13px] text-ink flex-1 min-w-0">{r.label}</span>
                    {plan.daily_review_amount ? (
                      <span className="text-[11px] text-ink-muted flex-shrink-0 whitespace-nowrap">
                        + {formatUnits(plan.daily_review_amount, plan.unit)} review
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
