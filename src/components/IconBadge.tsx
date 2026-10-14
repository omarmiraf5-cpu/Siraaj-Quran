import type { LucideIcon } from "lucide-react";

/** The colour a metric's icon and badge take, by what it means. */
export type IconTone = "navy" | "gold" | "green" | "amber" | "red";

/* Classes rather than fixed colours, so each reads in light and dark. */
export const TONE_TEXT: Record<IconTone, string> = {
  navy: "text-brand-navy dark:text-brand-gold-light",
  gold: "text-brand-gold-dark dark:text-brand-gold",
  green: "text-emerald-700 dark:text-emerald-400",
  amber: "text-amber-700 dark:text-amber-400",
  red: "text-red-700 dark:text-red-400",
};

const TONE_BG: Record<IconTone, string> = {
  navy: "bg-brand-navy/10 dark:bg-brand-gold/10",
  gold: "bg-brand-gold/15",
  green: "bg-emerald-600/10",
  amber: "bg-amber-500/15",
  red: "bg-red-600/10",
};

/** An icon in a soft round badge of its tone. */
export function IconBadge({ icon: Icon, tone = "navy", size = 36 }: { icon: LucideIcon; tone?: IconTone; size?: number }) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full flex-shrink-0 ${TONE_BG[tone]} ${TONE_TEXT[tone]}`}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <Icon size={Math.round(size * 0.5)} strokeWidth={1.75} />
    </span>
  );
}
