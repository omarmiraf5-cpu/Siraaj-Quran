// What a child has memorised, worked out from their finished lessons, and the
// moments worth celebrating in it: a surah finished, a juz' finished, and a juz'
// that has just come within reach of halfway. Pure, so it can be checked on its own.

export interface MemoLesson {
  surah: number;
  ayah_start: number;
  surah_end: number;
  ayah_end: number;
  /** When it was last changed, for telling what is recent. */
  updated_at: string;
}

export interface JuzStartAt {
  juz: number;
  surah: number;
  ayah: number;
}

export interface MilestoneMap {
  /** Each surah's ayah count, from surah 1. */
  ayahsInSurah: number[];
  juzStarts: JuzStartAt[];
}

/** Juz' at or past this share are "nearly halfway", until they pass this share's upper edge. */
export const ALMOST_HALF_FROM = 40;
export const HALF = 50;

export interface Progress {
  /** Surahs memorised in full, with when the last piece of each was finished. */
  surahs: Array<{ surah: number; at: string }>;
  /** Share of each juz' (1–30) memorised, 0–100, with when it last moved. */
  juz: Array<{ juz: number; percent: number; at: string }>;
}

export function memorisation(lessons: MemoLesson[], map: MilestoneMap): Progress {
  const offset: number[] = [0];
  for (const n of map.ayahsInSurah) offset.push(offset[offset.length - 1] + n);
  const total = offset[offset.length - 1];
  const at = (s: number, a: number) => offset[s - 1] + a - 1;

  const done = new Uint8Array(total);
  const touched: string[] = new Array(total).fill("");
  for (const l of lessons) {
    if (!(l.surah >= 1 && l.surah_end >= l.surah && l.surah_end <= map.ayahsInSurah.length)) continue;
    const from = Math.max(0, at(l.surah, Math.max(1, l.ayah_start)));
    const to = Math.min(total - 1, at(l.surah_end, Math.min(l.ayah_end, map.ayahsInSurah[l.surah_end - 1])));
    for (let i = from; i <= to; i++) {
      done[i] = 1;
      if (l.updated_at > touched[i]) touched[i] = l.updated_at;
    }
  }

  const surahs: Progress["surahs"] = [];
  for (let s = 1; s <= map.ayahsInSurah.length; s++) {
    let all = true;
    let last = "";
    for (let i = offset[s - 1]; i < offset[s]; i++) {
      if (!done[i]) {
        all = false;
        break;
      }
      if (touched[i] > last) last = touched[i];
    }
    if (all) surahs.push({ surah: s, at: last });
  }

  const juz: Progress["juz"] = map.juzStarts.map((j, k) => {
    const from = at(j.surah, j.ayah);
    const next = map.juzStarts[k + 1];
    const to = next ? at(next.surah, next.ayah) : total;
    let n = 0;
    let last = "";
    for (let i = from; i < to; i++) {
      if (done[i]) {
        n++;
        if (touched[i] > last) last = touched[i];
      }
    }
    return { juz: j.juz, percent: (n / (to - from)) * 100, at: last };
  });
  return { surahs, juz };
}

export type Milestone =
  | { kind: "surah"; surah: number; at: string }
  | { kind: "juz"; juz: number; at: string }
  | { kind: "almost_half"; juz: number; percent: number; at: string };

/** Every milestone reached, newest first. A juz' only counts as "almost half" while it sits between 40% and 50%. */
export function milestones(p: Progress): Milestone[] {
  const out: Milestone[] = [];
  for (const s of p.surahs) out.push({ kind: "surah", surah: s.surah, at: s.at });
  for (const j of p.juz) {
    if (j.percent >= 99.999) out.push({ kind: "juz", juz: j.juz, at: j.at });
    else if (j.percent >= ALMOST_HALF_FROM && j.percent < HALF) out.push({ kind: "almost_half", juz: j.juz, percent: j.percent, at: j.at });
  }
  return out.sort((a, b) => b.at.localeCompare(a.at));
}
