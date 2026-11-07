import { PAGE_STARTS, TOTAL_PAGES, getSurahById } from "@/data/mushaf-index";

/** Mushaf pages to the surah and ayahs they cover — from the first ayah of the first page to the last of the last. */
export function pagesToRange(from: number, to: number) {
  const first = Math.max(1, Math.min(TOTAL_PAGES, from));
  const last = Math.max(first, Math.min(TOTAL_PAGES, to || first));
  const [s1, a1] = PAGE_STARTS[first - 1];
  let sEnd = 114;
  let aEnd = getSurahById(114)?.ayahs ?? 6;
  if (last < TOTAL_PAGES) {
    const [ns, na] = PAGE_STARTS[last];
    if (na > 1) {
      sEnd = ns;
      aEnd = na - 1;
    } else {
      sEnd = ns - 1;
      aEnd = getSurahById(sEnd)?.ayahs ?? 1;
    }
  }
  return { first, last, surah: s1, ayahStart: a1, surahEnd: sEnd, ayahEnd: aEnd };
}
