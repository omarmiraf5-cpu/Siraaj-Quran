"use client";

import type { CSSProperties } from "react";
import type { LucideIcon } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import type { IconTone } from "@/components/IconBadge";
import { StatCardHeader } from "@/components/StatCardHeader";
import { hoverSpring } from "@/lib/motion-config";
import { gemGlow, type ArtName } from "@/components/gem-icons";

const TONE_GLOW: Record<IconTone, string> = {
  green: "#1b8f5c",
  amber: "#c98426",
  red: "#c45c54",
  navy: "#1a4a8a",
  gold: "#c6a15a",
};

/** Four-up metric: badge, status pill, bold figure, muted label. */
export function StatCard({
  icon,
  art,
  tone = "navy",
  value,
  label,
  pill,
  loading = false,
  onClick,
}: {
  icon?: LucideIcon;
  art?: ArtName;
  tone?: IconTone;
  value?: string | number;
  label: string;
  pill?: string;
  loading?: boolean;
  onClick?: () => void;
}) {
  const reduce = useReducedMotion();
  if (loading || (!icon && !art)) {
    return (
      <div className="card-quiet px-4 py-4 min-w-0 rounded-[22px] space-y-3" aria-hidden>
        <div className="flex items-center justify-between">
          <div className="skeleton h-9 w-9 rounded-[10px]" />
          <div className="skeleton h-5 w-16 rounded-full" />
        </div>
        <div className="skeleton h-8 w-16" />
        <div className="skeleton h-3 w-24" />
      </div>
    );
  }
  const hover = reduce ? undefined : { scale: 1.02 };
  const transition = reduce ? { duration: 0 } : hoverSpring;
  const glow = { "--gem": art ? gemGlow(art) : TONE_GLOW[tone] } as CSSProperties;
  const body = (
    <>
      <StatCardHeader icon={icon} art={art} tone={tone} pill={pill} />
      <p className="font-display text-[30px] font-semibold text-ink tabular-nums leading-none tracking-tight mt-3">
        <bdi dir="ltr">{value}</bdi>
      </p>
      <p className="text-[12px] text-ink-muted mt-1.5 leading-snug">{label}</p>
    </>
  );
  if (onClick) {
    return (
      <motion.button
        type="button"
        onClick={onClick}
        whileHover={hover}
        transition={transition}
        className="card-quiet card-lift gem-surface px-4 py-4 min-w-0 min-h-11 rounded-[22px] text-start"
        style={glow}
      >
        {body}
      </motion.button>
    );
  }
  return (
    <motion.div whileHover={hover} transition={transition} className="card-quiet card-lift gem-surface px-4 py-4 min-w-0 rounded-[22px]" style={glow}>
      {body}
    </motion.div>
  );
}
