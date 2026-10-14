"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { IconBadge } from "@/components/IconBadge";
import { pillSpring } from "@/lib/motion-config";

export type SidebarLink = {
  href: string;
  label: string;
  mark?: LucideIcon;
  /** Fallback glyph when a portal has not moved to Lucide yet. */
  glyph?: ReactNode;
};

/** One left navigation: icon badges and a spring sliding active pill. */
export function Sidebar({
  items,
  activeHref,
  onHover,
}: {
  items: SidebarLink[];
  activeHref: string;
  onHover?: (href: string | null) => void;
}) {
  const reduce = useReducedMotion();
  return (
    <nav className="space-y-1" onMouseLeave={() => onHover?.(null)}>
      {items.map((item) => {
        const active = item.href === activeHref;
        return (
          <Link
            key={item.href}
            href={item.href}
            onMouseEnter={() => onHover?.(item.href)}
            title={item.label}
            className={`relative flex items-center gap-3 min-h-11 px-2 md:px-3 rounded-2xl text-sm font-semibold ${
              active ? "text-white" : "text-ink-body"
            }`}
          >
            {active && (
              <motion.span
                layoutId="sidebar-active"
                className="absolute inset-0 rounded-2xl bg-[#102A56]"
                transition={reduce ? { duration: 0 } : pillSpring}
              />
            )}
            <span className="relative z-10 flex items-center gap-3 min-w-0">
              {item.mark ? (
                <IconBadge icon={item.mark} size="sm" active={active} />
              ) : (
                item.glyph
              )}
              <span className="hidden md:inline truncate">{item.label}</span>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
