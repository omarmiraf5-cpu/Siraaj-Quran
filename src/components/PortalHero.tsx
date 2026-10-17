// The navy hero the teacher dashboard opens with, extracted so the parent and
// student portals open the same way. Before this, each portal had its own
// idea of a page header — a plain sans heading here, a teal gradient there —
// and switching portals felt like switching products.

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
  meta?: React.ReactNode[];
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
            <p className="text-[13px] text-white/55 mt-2.5">
              {meta.map((m, i) => (
                <span key={i}>
                  {i > 0 && <span className="text-white/25 mx-2">·</span>}
                  {m}
                </span>
              ))}
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
