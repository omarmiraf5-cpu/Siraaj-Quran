"use client";

import type { LucideIcon } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";

export type IconTone = "gold" | "green" | "amber" | "red" | "navy";
export type IconBadgeSize = "sm" | "md" | "lg";

const GLYPH = { sm: 15, md: 18, lg: 20 } as const;

/**
 * Circular badge for a functional icon. Gold is the default metallic
 * treatment; status tones tint the disc and its glow.
 */
export function IconBadge({
  icon: Icon,
  tone = "gold",
  size = "md",
  active = false,
  hover = true,
}: {
  icon: LucideIcon;
  tone?: IconTone;
  size?: IconBadgeSize;
  active?: boolean;
  /** Turn off when a parent already scales on hover. */
  hover?: boolean;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.span
      className={`icon-mark icon-mark-${size} icon-mark-${tone}${active ? " icon-mark-active" : ""}`}
      whileHover={reduce || !hover ? undefined : { scale: 1.05 }}
      transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 16 }}
    >
      {active && <span className="icon-mark-sheen" aria-hidden />}
      <Icon size={GLYPH[size]} strokeWidth={1.75} aria-hidden />
    </motion.span>
  );
}
