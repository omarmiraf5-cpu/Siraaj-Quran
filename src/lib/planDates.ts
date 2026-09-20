/**
 * Plan-shaped date arithmetic — split out of yearlyPlan.ts so
 * schoolCalendar.ts can use it without the two modules importing each
 * other. yearlyPlan.ts re-exports everything here, so every existing
 * `import { addDays } from "@/lib/yearlyPlan"` across the app keeps
 * working unchanged; this file is the one place the logic actually lives.
 *
 * Plan dates are calendar days, never instants. Parsing "2026-03-01" with
 * `new Date(...)` gives midnight UTC, which in Edmonton is the evening of
 * 28 February — enough to shift a milestone into the wrong month and make
 * a child look a day behind at the turn of every month. Anchoring at UTC
 * noon keeps the day stable whichever side of UTC the school sits.
 */
export function parseDay(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1, 12, 0, 0));
}

export function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((parseDay(to).getTime() - parseDay(from).getTime()) / 86_400_000);
}

export function addDays(iso: string, days: number): string {
  const d = parseDay(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return toISODate(d);
}

/** Today as a plan-shaped date string, in the viewer's own timezone —
 *  a parent in Toronto and one in Vancouver should both see their own
 *  "today", not UTC's. */
export function todayISO(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
