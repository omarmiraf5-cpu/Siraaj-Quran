"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, ChevronDown, type LucideIcon } from "lucide-react";
import { IconBadge, type IconTone } from "@/components/IconBadge";
import { ColorTile, type ArtName } from "@/components/gem-icons";

/* ── Metric card ───────────────────────────────────────────────────────
   One of the four numbers at the top of a home page. Every card in a row
   is the same height — figure, label, then at most two lines of context —
   with anything extra (a meter) pinned to the bottom edge, so the row
   reads level whatever each card has to say. A zero is greyed out: it's
   the absence of something, not a figure to look at.

   A card leads somewhere: to a page (`href`), to a panel (`onClick`), or
   opens its own `details` in place. The corner arrow says which. */

export interface MetricDetail {
  key: string;
  label: string;
  value: string | number;
  href?: string;
}

export function MetricCard({
  icon,
  art,
  tone = "navy",
  value,
  label,
  sub,
  pill,
  muted,
  meter,
  href,
  onClick,
  details,
  detailsTitle,
}: {
  icon: LucideIcon;
  /** The card's picture, drawn as a gem; the plain `icon` stands in without one. */
  art?: ArtName;
  tone?: IconTone;
  value: string | number;
  label: string;
  /** Up to two lines of context under the label. */
  sub?: React.ReactNode;
  /** A short summary in a pill, in place of a line of text. */
  pill?: string;
  /** Greys the figure out — for a zero. */
  muted?: boolean;
  /** 0–100, drawn as a thin bar along the bottom, with what it measures. */
  meter?: { value: number; label: string };
  href?: string;
  onClick?: () => void;
  /** The full breakdown behind `pill`, opened from the card itself. */
  details?: MetricDetail[];
  detailsTitle?: string;
}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const expands = Boolean(details?.length);

  // Closes on a tap anywhere else, or Escape.
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const leads = expands || Boolean(href || onClick);
  const shell = `card-quiet group relative flex h-full w-full min-w-0 flex-col px-4 py-4 text-start transition-all ${
    leads
      ? "cursor-pointer hover:shadow-md hover:border-slate-300 dark:hover:border-slate-600 active:scale-[.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy/40 dark:focus-visible:ring-brand-gold/50"
      : ""
  } ${open ? "border-slate-300 dark:border-slate-600 shadow-md" : ""}`;

  const corner = expands ? (
    <ChevronDown
      size={16}
      aria-hidden
      className={`text-ink-muted transition-transform group-hover:text-ink ${open ? "rotate-180" : ""}`}
    />
  ) : leads ? (
    <ArrowUpRight
      size={16}
      aria-hidden
      className="text-ink-muted transition-transform group-hover:text-ink group-hover:-translate-y-0.5 group-hover:translate-x-0.5 rtl:-scale-x-100 rtl:group-hover:-translate-x-0.5"
    />
  ) : null;

  const body = (
    <>
      <span className="flex items-start justify-between gap-2 mb-3">
        {art ? <ColorTile name={art} size={40} /> : <IconBadge icon={icon} tone={tone} size={34} />}
        {corner}
      </span>
      <span
        className={`block text-[26px] font-bold tabular-nums leading-none ${
          muted ? "text-slate-400 dark:text-slate-500" : "text-ink"
        }`}
      >
        <bdi dir="ltr">{value}</bdi>
      </span>
      <span className="eyebrow block mt-2">{label}</span>
      {pill && (
        <span className="mt-2 max-w-full self-start rounded-[11px] bg-surface-bg px-2.5 py-1 text-[11px] font-medium leading-snug text-ink-muted">
          {pill}
        </span>
      )}
      {sub && <span className="block text-[11px] text-ink-muted mt-1.5 leading-snug line-clamp-2">{sub}</span>}
      {meter && (
        <span className="mt-auto block pt-3">
          <span
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(meter.value)}
            aria-label={meter.label}
            className="block h-1.5 rounded-full bg-surface-bg overflow-hidden"
          >
            <span
              className="block h-full rounded-full bg-brand-gold transition-[width] duration-700 ease-out"
              style={{ width: `${Math.max(0, Math.min(100, meter.value))}%` }}
            />
          </span>
        </span>
      )}
    </>
  );

  if (expands) {
    return (
      <div ref={wrap} className="relative h-full min-w-0">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((o) => !o)}
          className={shell}
        >
          {body}
        </button>
        {open && (
          <div
            id={panelId}
            className="absolute start-0 top-full z-30 mt-2 w-[min(20rem,calc(100vw-2rem))] card-quiet p-3 shadow-lg"
          >
            {detailsTitle && <p className="eyebrow px-1 pb-2">{detailsTitle}</p>}
            <ul className="max-h-72 overflow-y-auto">
              {details!.map((d) => {
                const row = (
                  <>
                    <span className="min-w-0 [overflow-wrap:anywhere]">{d.label}</span>
                    <span className="flex-shrink-0 tabular-nums font-semibold text-ink">{d.value}</span>
                  </>
                );
                const cls = "flex items-start justify-between gap-3 rounded-xl px-2 py-2 text-[12.5px] text-ink";
                return (
                  <li key={d.key}>
                    {d.href ? (
                      <Link href={d.href} className={`${cls} hover:bg-surface-bg`}>
                        {row}
                      </Link>
                    ) : (
                      <span className={cls}>{row}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    );
  }
  if (href) {
    return (
      <Link href={href} className={shell}>
        {body}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={shell}>
        {body}
      </button>
    );
  }
  return <div className={shell}>{body}</div>;
}
