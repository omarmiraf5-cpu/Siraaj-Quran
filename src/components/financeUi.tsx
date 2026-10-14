"use client";

import { monthLabel, shiftMonth } from "@/lib/finance";
import { useLanguage } from "@/components/LanguageProvider";

// Pieces the Salaries and Expenses tabs share.

export const field =
  "w-full bg-surface-card border border-surface-border rounded-xl px-3 py-2.5 text-sm text-ink focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/40 transition";
export const label = "block text-xs font-semibold text-ink mb-1.5";
export const primary =
  "gradient-emerald text-white text-sm font-semibold py-2.5 px-4 rounded-xl disabled:opacity-40 hover:opacity-90 active:scale-[.98] transition-all";
export const ghost =
  "text-[13px] font-semibold px-3.5 py-2 rounded-xl border border-surface-border text-ink hover:bg-surface-bg-warm transition disabled:opacity-40";

/** ‹ October 2026 › — which month the tab shows. */
export function MonthBar({ month, onChange, thisMonth }: { month: string; onChange: (m: string) => void; thisMonth: string }) {
  const { tr } = useLanguage();
  const arrow =
    "w-9 h-9 rounded-full border border-surface-border bg-surface-card text-ink flex items-center justify-center hover:bg-surface-bg-warm transition disabled:opacity-30";
  return (
    <div className="flex items-center justify-between gap-3">
      <button type="button" onClick={() => onChange(shiftMonth(month, -1))} aria-label={tr("Previous month")} className={arrow}>
        <span className="inline-block rtl:-scale-x-100">‹</span>
      </button>
      <div className="text-center">
        <p className="font-display text-lg font-bold text-ink leading-tight">{monthLabel(month)}</p>
        {month !== thisMonth && (
          <button type="button" onClick={() => onChange(thisMonth)} className="text-[11.5px] font-semibold text-emerald-700 dark:text-emerald-400 hover:underline">
            {tr("Back to this month")}
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={() => onChange(shiftMonth(month, 1))}
        // Up to next month: a salary can be paid ahead.
        disabled={month >= shiftMonth(thisMonth, 1)}
        aria-label={tr("Next month")}
        className={arrow}
      >
        <span className="inline-block rtl:-scale-x-100">›</span>
      </button>
    </div>
  );
}
