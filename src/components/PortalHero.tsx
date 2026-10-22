// The navy hero the teacher dashboard opens with, extracted so the parent and
// student portals open the same way. Before this, each portal had its own
// idea of a page header — a plain sans heading here, a teal gradient there —
// and switching portals felt like switching products.

import { isValidElement } from "react";

/** A banner fact's colour. Warm ones carry meaning (green is good, amber needs a look, red is a problem); the rest are just to tell the facts apart. */
export type HeroTone = "plain" | "sky" | "teal" | "violet" | "green" | "amber" | "red" | "gold";
export type HeroFact = React.ReactNode | { text: React.ReactNode; tone: HeroTone };

const CHIP: Record<HeroTone, string> = {
  plain: "bg-white/10 text-white/80",
  sky: "bg-sky-300/15 text-sky-100",
  teal: "bg-teal-300/15 text-teal-100",
  violet: "bg-violet-300/15 text-violet-100",
  green: "bg-emerald-400/20 text-emerald-100",
  amber: "bg-amber-300/20 text-amber-100",
  red: "bg-red-400/25 text-red-100",
  gold: "bg-brand-gold/25 text-brand-gold-light",
};
// Facts without a tone of their own: the first plain, then a few cool colours.
const BY_POSITION: HeroTone[] = ["plain", "sky", "teal", "violet"];

function isToned(m: HeroFact): m is { text: React.ReactNode; tone: HeroTone } {
  return typeof m === "object" && m !== null && !isValidElement(m) && !Array.isArray(m) && "tone" in m && "text" in m;
}

export function PortalHero({
  eyebrow,
  title,
  meta,
  stats,
  actions,
  children,
}: {
  eyebrow: string;
  title: string;
  /** Short facts under the title, joined with gold separators. */
  meta?: HeroFact[];
  /** Key numbers, large in gold under the title: "7 total · 7 active". */
  stats?: Array<{ value: React.ReactNode; label: string }>;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <header className="gradient-navy rounded-[18px] px-7 py-6 relative overflow-hidden">
      <div className="pattern-lattice absolute inset-0 opacity-40 pointer-events-none" />
      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="eyebrow text-white/45">{eyebrow}</p>
          <h1 className="page-title text-white text-3xl mt-1.5">{title}</h1>
          {meta && meta.length > 0 && (
            <p className="flex flex-wrap items-center gap-1.5 mt-3">
              {meta.map((m, i) => {
                const toned = isToned(m);
                const tone = toned ? m.tone : BY_POSITION[i % BY_POSITION.length];
                return (
                  <span key={i} className={`inline-flex items-center rounded-full px-2.5 py-1 text-[12px] font-medium leading-tight ${CHIP[tone]}`}>
                    {toned ? m.text : m}
                  </span>
                );
              })}
            </p>
          )}
          {stats && stats.length > 0 && (
            <dl className="flex flex-wrap gap-x-7 gap-y-3 mt-4">
              {stats.map((x) => (
                <div key={x.label}>
                  <dt className="sr-only">{x.label}</dt>
                  <dd className="text-[26px] font-bold leading-none tabular-nums text-brand-gold">{x.value}</dd>
                  <dd className="text-[11.5px] text-white/60 mt-1">{x.label}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
        {actions && <div className="flex flex-wrap gap-2.5 flex-shrink-0">{actions}</div>}
      </div>
      {children}
    </header>
  );
}

/** The gold pill's look, for a hero action that's a button rather than a link. */
export const HERO_GOLD =
  "inline-flex items-center gap-2 rounded-full bg-brand-gold px-4 py-2.5 text-[13px] font-semibold text-[#20180a] hover:brightness-105 active:scale-[.98] transition";

/** Gold pill — the primary action in a hero. */
export function HeroButtonPrimary({
  href,
  icon,
  children,
}: {
  href: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      className="inline-flex items-center gap-2 rounded-full bg-brand-gold px-4 py-2.5 text-[13px] font-semibold text-[#20180a] hover:brightness-105 active:scale-[.98] transition"
    >
      {icon}
      {children}
    </a>
  );
}

/** Outlined pill — the secondary action in a hero. */
export function HeroButtonGhost({
  href,
  icon,
  children,
}: {
  href: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      className="inline-flex items-center gap-2 rounded-full border border-white/25 px-4 py-2.5 text-[13px] font-semibold text-white/85 hover:bg-white/10 active:scale-[.98] transition"
    >
      {icon}
      {children}
    </a>
  );
}
