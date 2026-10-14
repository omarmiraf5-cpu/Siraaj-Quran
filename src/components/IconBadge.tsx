"use client";

import type { LucideIcon } from "lucide-react";

export type IconTone = "gold" | "green" | "amber" | "red" | "navy";
export type IconBadgeSize = "sm" | "md" | "lg";

const STROKE: Record<IconTone, string> = {
  gold: "#102A56",
  navy: "#102A56",
  green: "#0e7a48",
  amber: "#9a6200",
  red: "#c45c54",
};

/** A flat Lucide stroke. No disc, ring, or shadow. */
export function IconBadge({
  icon: Icon,
  tone = "navy",
}: {
  icon: LucideIcon;
  tone?: IconTone;
  size?: IconBadgeSize;
  active?: boolean;
  hover?: boolean;
}) {
  return <Icon size={20} strokeWidth={1.75} color={STROKE[tone]} aria-hidden />;
}
