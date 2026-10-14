"use client";

import type { LucideIcon } from "lucide-react";
import type { IconTone } from "@/components/IconBadge";

const STROKE: Record<IconTone, string> = {
  gold: "#102A56",
  navy: "#102A56",
  green: "#0e7a48",
  amber: "#9a6200",
  red: "#c45c54",
};

/** Top of a metric card: a plain stroke and a muted status label. */
export function StatCardHeader({
  icon: Icon,
  tone = "navy",
  pill,
}: {
  icon: LucideIcon;
  tone?: IconTone;
  pill?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-2 min-w-0">
      <Icon size={20} strokeWidth={1.75} color={STROKE[tone]} aria-hidden />
      {pill ? <span className="text-[11px] font-medium text-ink-muted truncate max-w-[8.5rem]">{pill}</span> : null}
    </div>
  );
}
