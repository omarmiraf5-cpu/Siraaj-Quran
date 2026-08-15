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
    <header className="gradient-navy rounded-[18px] px-7 py-6 relative overflow-hidden">
      <div className="pattern-lattice absolute inset-0 opacity-40 pointer-events-none" />
      <div className="relative flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
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
        </div>
        {actions && <div className="flex gap-2.5 flex-shrink-0">{actions}</div>}
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
