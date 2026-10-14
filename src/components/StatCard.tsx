"use client";

import type { LucideIcon } from "lucide-react";
import { IconBadge, type IconTone } from "@/components/IconBadge";

/**
 * A headline figure: an icon badge, an optional status word, the number,
 * and what it counts. While `loading`, a placeholder of the same shape.
 */
export function StatCard({
  icon,
  tone = "navy",
  value,
  label,
  pill,
  loading = false,
}: {
  icon: LucideIcon;
  tone?: IconTone;
  value?: string | number;
  label: string;
  pill?: string;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div className="card-quiet px-4 py-4 min-w-0 space-y-3" aria-hidden>
        <div className="flex items-center justify-between">
          <div className="skeleton h-9 w-9 rounded-full" />
          <div className="skeleton h-4 w-14 rounded-full" />
        </div>
        <div className="skeleton h-8 w-16" />
        <div className="skeleton h-3 w-24 max-w-full" />
      </div>
    );
  }
  return (
    <div className="card-quiet card-lift px-4 py-4 min-w-0">
      <div className="flex items-start justify-between gap-2 min-w-0">
        <IconBadge icon={icon} tone={tone} />
        {pill ? <span className="text-[11px] font-medium text-ink-muted text-end [overflow-wrap:anywhere]">{pill}</span> : null}
      </div>
      <p className="font-display text-[28px] font-semibold text-ink tabular-nums leading-none tracking-tight mt-3">
        <bdi dir="ltr">{value}</bdi>
      </p>
      <p className="text-[12px] text-ink-muted mt-1.5 leading-snug">{label}</p>
    </div>
  );
}
