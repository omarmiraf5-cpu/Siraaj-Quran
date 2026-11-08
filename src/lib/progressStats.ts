import { SURAHS } from "@/data/mushaf-index";
import type { RecitationLogEntry } from "@/data/demo";
import type { DailyRating } from "@/hooks/useQuranicAssignments";

export const SCORE: Record<DailyRating, number> = { excellent: 4, very_good: 3, good: 2, weak: 1, not_recited: 0 };

export const RATING_COLOUR: Record<DailyRating, string> = {
  excellent: "#15803d",
  very_good: "#0d9488",
  good: "#2563eb",
  weak: "#d97706",
  not_recited: "#9aa1b0",
};

const DAY = 86_400_000;
const utc = (iso: string) => Date.parse(iso.slice(0, 10) + "T00:00:00Z");
/** The Monday on or before this day, as a UTC time. */
function weekStart(t: number) {
  const d = new Date(t);
  const back = (d.getUTCDay() + 6) % 7;
  return t - back * DAY;
}

/** How many ayahs a session covered, across surahs if it ran on. */
export function ayahsIn(e: Pick<RecitationLogEntry, "surah" | "ayah_start" | "surah_end" | "ayah_end">): number {
  if (e.surah_end === e.surah) return Math.max(0, e.ayah_end - e.ayah_start + 1);
  let n = (SURAHS[e.surah - 1]?.ayahs ?? 0) - e.ayah_start + 1;
  for (let s = e.surah + 1; s < e.surah_end; s++) n += SURAHS[s - 1]?.ayahs ?? 0;
  return n + e.ayah_end;
}

export interface WeekBucket {
  start: string;
  label: string;
  counts: Record<DailyRating, number>;
  sessions: number;
  ayahs: number;
  /** Average quality 1–4 of the sessions where the child recited; null with none. */
  quality: number | null;
}

export interface ProgressStats {
  weeks: WeekBucket[];
  sessionsThisMonth: number;
  ayahsThisMonth: number;
  daysPracticedThisMonth: number;
  weeksInARow: number;
  quality: number | null;
  trend: "up" | "down" | "steady" | null;
  surahs: Array<{ id: number; name: string; last: DailyRating; times: number; lastDate: string }>;
  byPortion: Record<"new" | "recent" | "old", number>;
  lastSession: string | null;
  total: number;
}

export function progressStats(entries: RecitationLogEntry[], today: string, weeksBack = 8): ProgressStats {
  const now = utc(today);
  const thisWeek = weekStart(now);
  const weeks: WeekBucket[] = [];
  for (let i = weeksBack - 1; i >= 0; i--) {
    const s = thisWeek - i * 7 * DAY;
    const d = new Date(s);
    weeks.push({
      start: d.toISOString().slice(0, 10),
      label: `${d.getUTCDate()}/${d.getUTCMonth() + 1}`,
      counts: { excellent: 0, very_good: 0, good: 0, weak: 0, not_recited: 0 },
      sessions: 0,
      ayahs: 0,
      quality: null,
    });
  }
  const sums = weeks.map(() => ({ score: 0, n: 0 }));
  const monthKey = today.slice(0, 7);
  let sessionsThisMonth = 0;
  let ayahsThisMonth = 0;
  const days = new Set<string>();
  const byPortion = { new: 0, recent: 0, old: 0 };
  const surahMap = new Map<number, { last: DailyRating; lastDate: string; times: number }>();
  const sorted = [...entries].sort((a, b) => utc(a.date) - utc(b.date));

  for (const e of sorted) {
    const t = utc(e.date);
    const idx = Math.floor((weekStart(t) - (thisWeek - (weeksBack - 1) * 7 * DAY)) / (7 * DAY));
    const recited = e.rating !== "not_recited";
    if (idx >= 0 && idx < weeks.length) {
      const w = weeks[idx];
      w.counts[e.rating]++;
      if (recited) {
        w.sessions++;
        w.ayahs += ayahsIn(e);
        sums[idx].score += SCORE[e.rating];
        sums[idx].n++;
      }
    }
    if (recited) {
      byPortion[e.portion]++;
      if (e.date.startsWith(monthKey)) {
        sessionsThisMonth++;
        ayahsThisMonth += ayahsIn(e);
        days.add(e.date);
      }
      for (let s = e.surah; s <= e.surah_end && s - e.surah < 12; s++) {
        const cur = surahMap.get(s);
        surahMap.set(s, { last: e.rating, lastDate: e.date, times: (cur?.times ?? 0) + 1 });
      }
    }
  }
  weeks.forEach((w, i) => (w.quality = sums[i].n ? sums[i].score / sums[i].n : null));

  let weeksInARow = 0;
  for (let i = weeks.length - 1; i >= 0; i--) {
    if (weeks[i].sessions > 0) weeksInARow++;
    else if (i === weeks.length - 1) continue; // this week may not have started yet
    else break;
  }

  const avg = (ws: WeekBucket[]) => {
    const q = ws.map((w) => w.quality).filter((x): x is number => x !== null);
    return q.length ? q.reduce((a, b) => a + b, 0) / q.length : null;
  };
  const recent = avg(weeks.slice(-4));
  const before = avg(weeks.slice(0, -4));
  const trend = recent === null || before === null ? null : recent - before > 0.25 ? "up" : before - recent > 0.25 ? "down" : "steady";
  const all = sorted.filter((e) => e.rating !== "not_recited");

  return {
    weeks,
    sessionsThisMonth,
    ayahsThisMonth,
    daysPracticedThisMonth: days.size,
    weeksInARow,
    quality: all.length ? all.reduce((a, e) => a + SCORE[e.rating], 0) / all.length : null,
    trend,
    surahs: [...surahMap.entries()]
      .map(([id, v]) => ({ id, name: SURAHS[id - 1]?.englishName ?? `Surah ${id}`, ...v }))
      .sort((a, b) => a.id - b.id),
    byPortion,
    lastSession: sorted.length ? sorted[sorted.length - 1].date : null,
    total: sorted.length,
  };
}
