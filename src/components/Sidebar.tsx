"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { pillSpring } from "@/lib/motion-config";
import { ColorTile, type ArtName } from "@/components/gem-icons";

export type SidebarLink = {
  href: string;
  label: string;
  mark?: LucideIcon;
  art?: ArtName;
  glyph?: ReactNode;
};

/** Left navigation. A 3px gold bar slides to the active item. */
export function Sidebar({
  items,
  activeHref,
}: {
  items: SidebarLink[];
  activeHref: string;
  onHover?: (href: string | null) => void;
}) {
  const reduce = useReducedMotion();
  return (
    <nav className="space-y-0.5">
      {items.map((item) => {
        const active = item.href === activeHref;
        const Icon = item.mark;
        return (
          <Link
            key={item.href}
            href={item.href}
            title={item.label}
            aria-current={active ? "page" : undefined}
            className={`relative flex items-center gap-3 min-h-12 px-2.5 rounded-xl text-sm font-semibold text-[#102A56] ${
              active ? "bg-[#F3EFE3]" : "hover:bg-[#F4F1E8]"
            }`}
          >
            {active && (
              <motion.span
                layoutId="sidebar-accent"
                className="absolute inset-y-2 start-0 w-[3px] rounded-full bg-[#c6a15a]"
                transition={reduce ? { duration: 0 } : pillSpring}
              />
            )}
            {item.art ? (
              <ColorTile name={item.art} size={32} />
            ) : Icon ? (
              <Icon size={20} strokeWidth={1.75} color="#102A56" aria-hidden />
            ) : (
              item.glyph
            )}
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
