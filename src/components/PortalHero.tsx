// The navy hero every adult portal opens with. Greeting, the date, and the
// numbers that matter sit on one deep panel so a home doesn't open as a
// plain heading over a stack of boxes.

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
  meta?: React.ReactNode[];
  /** Key figures drawn inside the hero, not only in the cards below. */
  stats?: { value: React.ReactNode; label: string }[];
  actions?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const chips = (meta ?? []).filter((m) => m !== "" && m != null);
  return (
    <header className="hero-frame gradient-navy relative overflow-hidden rounded-[24px] px-5 py-5 sm:px-7 sm:py-6 text-white">
      <div className="hero-sheen pointer-events-none absolute inset-0" />
      <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="eyebrow text-brand-gold-light">{eyebrow}</p>
          <h1 className="page-title text-white text-[2rem] sm:text-4xl mt-1 leading-[1.05]">{title}</h1>
          {chips.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {chips.map((m, i) => (
                <span key={i} className="hero-chip">{m}</span>
              ))}
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
              <p className="mt-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-brand-gold-light truncate">{s.label}</p>
            </div>
          ))}
        </div>
      )}
      {children}
    </header>
  );
}

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
    <a
      href={href}
      className="btn hero-ghost rounded-full px-4 text-[13px]"
    >
      {icon}
      {children}
    </a>
  );
}
