// The navy hero the teacher dashboard opens with, extracted so the parent and
// student portals open the same way. Before this, each portal had its own
// idea of a page header — a plain sans heading here, a teal gradient there —
// and switching portals felt like switching products.

export function PortalHero({
  eyebrow,
  title,
  meta,
  actions,
  children,
}: {
  eyebrow: string;
  title: string;
  /** Short facts under the title, joined with gold separators. */
  meta?: React.ReactNode[];
  actions?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <header className="hero-frame gradient-navy rounded-[20px] px-5 py-5 sm:px-7 sm:py-6 relative overflow-hidden">
      <div className="pattern-lattice absolute inset-0 opacity-30 pointer-events-none" />
      <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="eyebrow text-white/70">{eyebrow}</p>
          <h1 className="page-title text-white text-[1.65rem] sm:text-3xl mt-1.5 leading-tight">{title}</h1>
          {meta && meta.length > 0 && (
            <p className="text-[13px] text-white/75 mt-2.5">
              {meta.map((m, i) => (
                <span key={i}>
                  {i > 0 && <span className="text-white/25 mx-2">·</span>}
                  {m}
                </span>
              ))}
            </p>
          )}
        </div>
        {actions && <div className="flex flex-wrap gap-2.5 flex-shrink-0">{actions}</div>}
      </div>
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
    <a
      href={href}
      className="btn btn-accent rounded-full px-4 text-[13px]"
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
      className="btn rounded-full border-white/30 bg-white/10 px-4 text-[13px] text-white hover:bg-white/16"
    >
      {icon}
      {children}
    </a>
  );
}
