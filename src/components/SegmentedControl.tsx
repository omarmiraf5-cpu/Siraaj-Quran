"use client";

import { useId } from "react";
import { motion, useReducedMotion } from "motion/react";
import { pillSpring } from "@/lib/motion-config";

/**
 * A choice of a few options side by side, the chosen one marked by a pill
 * that slides to it. Options wrap rather than cut off on a narrow phone.
 */
export function SegmentedControl<T extends string | number>({
  label,
  value,
  onChange,
  options,
  role = "radiogroup",
}: {
  label: string;
  value: T;
  onChange: (next: T) => void;
  options: { value: T; label: string }[];
  /** "tablist" when the options switch a page's panels. */
  role?: "radiogroup" | "tablist";
}) {
  const reduce = useReducedMotion();
  const group = useId();
  const itemRole = role === "tablist" ? "tab" : "radio";
  return (
    <div role={role} aria-label={label} className="segmented">
      {options.map((opt) => {
        const on = opt.value === value;
        return (
          <button
            key={String(opt.value)}
            type="button"
            role={itemRole}
            aria-checked={itemRole === "radio" ? on : undefined}
            aria-selected={itemRole === "tab" ? on : undefined}
            onClick={() => onChange(opt.value)}
            className={`segmented-opt ${on ? "segmented-on" : ""}`}
          >
            {on && (
              <motion.span
                layoutId={`segment-${group}`}
                className="segmented-pill"
                transition={reduce ? { duration: 0 } : pillSpring}
              />
            )}
            <span className="relative z-10">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
