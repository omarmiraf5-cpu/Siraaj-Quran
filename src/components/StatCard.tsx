interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
  tint?: string;
}

export function StatCard({ label, value, sub, icon, tint = "bg-brand-navy/10 text-brand-navy" }: StatCardProps) {
  return (
    <div className="bg-surface-card rounded-card-lg p-5 shadow-card border border-surface-border">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 ${tint}`}>
        {icon}
      </div>
      <p className="tabular-nums text-3xl font-bold text-ink leading-none">{value}</p>
      <p className="font-semibold text-ink-body mt-2 text-sm">{label}</p>
      {sub && <p className="text-ink-muted text-xs mt-0.5">{sub}</p>}
    </div>
  );
}
