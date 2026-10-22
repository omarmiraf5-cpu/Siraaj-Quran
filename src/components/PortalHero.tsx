// The navy hero every adult portal opens with. Greeting, the date, and the
// numbers that matter sit on one deep panel so a home doesn't open as a
// plain heading over a stack of boxes. Facts may carry a tone (green is
// good, amber needs a look, red is a problem) without bringing back the
// geometric pattern.

import { isValidElement } from "react";

/** A banner fact's colour. Warm ones carry meaning; the rest tell facts apart. */
export type HeroTone = "plain" | "sky" | "teal" | "violet" | "green" | "amber" | "red" | "gold";
export type HeroFact = React.ReactNode | { text: React.ReactNode; tone: HeroTone };

const CHIP: Record<HeroTone, string> = {
  plain: "bg-white/12 text-white/90",
  sky: "bg-sky-300/15 text-sky-100",
  teal: "bg-teal-300/15 text-teal-100",
  violet: "bg-violet-300/15 text-violet-100",
  green: "bg-emerald-400/20 text-emerald-100",
  amber: "bg-amber-300/20 text-amber-100",
  red: "bg-red-400/25 text-red-100",
  gold: "bg-brand-gold/25 text-brand-gold-light",
};

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
  /** Short facts under the title, each drawn as its own chip. */
  meta?: HeroFact[];
  /** Key figures drawn inside the hero, not only in the cards below. */
  stats?: { value: React.ReactNode; label: string }[];
  actions?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const chips = (meta ?? []).filter((m) => {
    if (m == null || m === "") return false;
    if (isToned(m)) return m.text != null && m.text !== "";
    return true;
  });
  return (
    <header className="hero-frame gradient-navy relative overflow-hidden rounded-[24px] px-5 py-5 sm:px-7 sm:py-6 text-white">
      <div className="hero-sheen pointer-events-none absolute inset-0" />
      <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="eyebrow text-brand-gold-light">{eyebrow}</p>
          <h1 className="page-title text-white text-[2rem] sm:text-4xl mt-1 leading-[1.05]">{title}</h1>
          {chips.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {chips.map((m, i) => {
                const toned = isToned(m);
                return (
                  <span key={i} className={`hero-chip ${toned ? CHIP[m.tone] : ""}`}>
                    {toned ? m.text : m}
                  </span>
                );
              })}
            </div>
          )}
        </div>
        {actions && <div className="flex flex-wrap gap-2 flex-shrink-0">{actions}</div>}
      </div>
      {stats && stats.length > 0 && (
        <div className="relative mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
          {stats.map((s) => (
            <div key={s.label} className="hero-stat min-w-0">
              <p className="font-display text-[1.65rem] font-semibold leading-none tabular-nums text-white">
                <bdi dir="ltr">{s.value}</bdi>
              </p>
              <p className="mt-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-brand-gold-light break-words">{s.label}</p>
            </div>
          ))}
        </div>
      )}
      {children}
    </header>
  );
}

/** The amber pill's look, for a hero action that's a button rather than a link. */
export const HERO_GOLD =
  "btn btn-amber rounded-full px-4 text-[13px]";

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
    <a href={href} className="btn btn-amber rounded-full px-4 text-[13px]">
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
    <a href={href} className="btn hero-ghost rounded-full px-4 text-[13px]">
      {icon}
      {children}
    </a>
  );
}
