"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { tapSpring } from "@/lib/motion-config";

/**
 * A button that gives a little under the finger and shows a spinner while
 * its work is running. Styling is the caller's (`className`), so it can be
 * any of the app's buttons.
 */
export function PressButton({
  loading = false,
  children,
  className = "",
  disabled,
  onClick,
  type = "button",
  ...rest
}: {
  loading?: boolean;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  type?: "button" | "submit";
  onClick?: ButtonHTMLAttributes<HTMLButtonElement>["onClick"];
  "aria-label"?: string;
}) {
  const reduce = useReducedMotion();
  const off = disabled || loading;
  return (
    <motion.button
      type={type}
      disabled={off}
      aria-busy={loading || undefined}
      onClick={onClick}
      whileTap={reduce || off ? undefined : { scale: 0.97 }}
      transition={tapSpring}
      className={className}
      {...rest}
    >
      {loading && <span className="spin-ring" aria-hidden />}
      {children}
    </motion.button>
  );
}
