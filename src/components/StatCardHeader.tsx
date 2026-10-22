"use client";

import type { LucideIcon } from "lucide-react";
import type { IconTone } from "@/components/IconBadge";
import { ColorTile, type ArtName } from "@/components/gem-icons";

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
  art,
  tone = "navy",
  pill,
}: {
  icon?: LucideIcon;
  art?: ArtName;
  tone?: IconTone;
  pill?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-2 min-w-0">
      {art ? <ColorTile name={art} size={36} /> : Icon ? <Icon size={20} strokeWidth={1.75} color={STROKE[tone]} aria-hidden /> : null}
      {pill ? <span className="text-[11px] font-medium text-ink-muted truncate max-w-[8.5rem]">{pill}</span> : null}
    </div>
  );
}
