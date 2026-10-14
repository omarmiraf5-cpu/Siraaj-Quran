"use client";

import type { LucideIcon } from "lucide-react";
import { IconBadge, type IconTone } from "@/components/IconBadge";

/** Label row for a metric card: a toned badge and the metric name. */
export function StatCardHeader({
  icon,
  tone = "navy",
  label,
}: {
  icon: LucideIcon;
  tone?: IconTone;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <IconBadge icon={icon} tone={tone} size="md" hover={false} />
      <span className="eyebrow truncate">{label}</span>
    </div>
  );
}
