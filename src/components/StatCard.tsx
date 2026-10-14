"use client";

import type { LucideIcon } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import type { IconTone } from "@/components/IconBadge";
import { StatCardHeader } from "@/components/StatCardHeader";
import { hoverSpring } from "@/lib/motion-config";

/** Four-up metric: badge, status pill, bold figure, muted label. */
export function StatCard({
  icon,
  tone = "navy",
  value,
  label,
  pill,
  loading = false,
}: {
  icon?: LucideIcon;
  tone?: IconTone;
  value?: string | number;
  label: string;
  pill?: string;
  loading?: boolean;
}) {
  const reduce = useReducedMotion();
  if (loading || !icon) {
    return (
      <div className="card-quiet px-4 py-4 min-w-0 rounded-[22px] space-y-3" aria-hidden>
        <div className="flex items-center justify-between">
          <div className="skeleton h-9 w-9 rounded-full" />
          <div className="skeleton h-5 w-16 rounded-full" />
        </div>
        <div className="skeleton h-8 w-16" />
        <div className="skeleton h-3 w-24" />
      </div>
    );
  }
  return (
    <motion.div
      whileHover={reduce ? undefined : { scale: 1.05 }}
      transition={reduce ? { duration: 0 } : hoverSpring}
      className="card-quiet card-lift px-4 py-4 min-w-0 rounded-[22px]"
    >
      <StatCardHeader icon={icon} tone={tone} pill={pill} />
      <p className="font-display text-[30px] font-semibold text-ink tabular-nums leading-none tracking-tight mt-3">
        <bdi dir="ltr">{value}</bdi>
      </p>
      <p className="text-[12px] text-ink-muted mt-1.5 leading-snug">{label}</p>
    </motion.div>
  );
}
