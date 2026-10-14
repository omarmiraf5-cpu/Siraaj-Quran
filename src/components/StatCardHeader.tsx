"use client";

import type { LucideIcon } from "lucide-react";
import { IconBadge, type IconTone } from "@/components/IconBadge";

/** Top of a metric card: icon badge and a status pill. */
export function StatCardHeader({
  icon,
  tone = "navy",
  pill,
}: {
  icon: LucideIcon;
  tone?: IconTone;
  pill?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-2 min-w-0">
      <IconBadge icon={icon} tone={tone} size="md" hover={false} />
      {pill ? <span className="status-pill max-w-[8.5rem] truncate">{pill}</span> : null}
    </div>
  );
}
