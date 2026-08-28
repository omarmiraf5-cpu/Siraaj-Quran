// The 30 juz' (parts) of the Quran, each as its starting surah and ayah.
//
// Cross-checked against the quarter-marker positions already embedded in
// the mushaf page data (public/mushaf/*.json, kind 4 segments): every
// mid-surah boundary below matches a marker actually present in that data,
// and every surah-opening boundary (juz 1, 14, 15, 17, 18, 26, 28, 29, 30)
// is one of Islam's most widely known ayahs, not an obscure one. Running
// each juz's own quarter-markers back through these boundaries produces no
// juz with more than the 8 quarters it should have — the check that first
// caught an error in this table (juz 15 was originally mistyped as 16:51;
// it is really 17:1, the opening of Al-Isra).
//
// This table only carries juz-level (whole-juz) precision. The finer
// rub' al-hizb (quarter) subdivisions within many later juz' are not
// reliably present in the source mushaf data, so a hizb/quarter-level
// picker is not yet built on top of this file.
export interface JuzStart {
  juz: number;
  surah: number;
  ayah: number;
}

export const JUZ_STARTS: JuzStart[] = [
  { juz: 1, surah: 1, ayah: 1 },
  { juz: 2, surah: 2, ayah: 142 },
  { juz: 3, surah: 2, ayah: 253 },
  { juz: 4, surah: 3, ayah: 92 },
  { juz: 5, surah: 4, ayah: 24 },
  { juz: 6, surah: 4, ayah: 148 },
  { juz: 7, surah: 5, ayah: 82 },
  { juz: 8, surah: 6, ayah: 111 },
  { juz: 9, surah: 7, ayah: 88 },
  { juz: 10, surah: 8, ayah: 41 },
  { juz: 11, surah: 9, ayah: 93 },
  { juz: 12, surah: 11, ayah: 6 },
  { juz: 13, surah: 12, ayah: 53 },
  { juz: 14, surah: 15, ayah: 1 },
  { juz: 15, surah: 17, ayah: 1 },
  { juz: 16, surah: 18, ayah: 75 },
  { juz: 17, surah: 21, ayah: 1 },
  { juz: 18, surah: 23, ayah: 1 },
  { juz: 19, surah: 25, ayah: 21 },
  { juz: 20, surah: 27, ayah: 56 },
  { juz: 21, surah: 29, ayah: 46 },
  { juz: 22, surah: 33, ayah: 31 },
  { juz: 23, surah: 36, ayah: 28 },
  { juz: 24, surah: 39, ayah: 32 },
  { juz: 25, surah: 41, ayah: 47 },
  { juz: 26, surah: 46, ayah: 1 },
  { juz: 27, surah: 51, ayah: 31 },
  { juz: 28, surah: 58, ayah: 1 },
  { juz: 29, surah: 67, ayah: 1 },
  { juz: 30, surah: 78, ayah: 1 },
];

export interface QuranSpan {
  surahStart: number;
  ayahStart: number;
  surahEnd: number;
  ayahEnd: number;
}

/**
 * The span covered by `count` consecutive juz' starting at `startJuz`.
 * `ayahsInSurah` is injected rather than imported, so this file has no
 * dependency on the mushaf-index surah table.
 */
export function getJuzRange(
  startJuz: number,
  count: number,
  ayahsInSurah: (surah: number) => number
): QuranSpan {
  const clampedStart = Math.max(1, Math.min(30, startJuz));
  const lastIncluded = Math.max(clampedStart, Math.min(30, clampedStart + count - 1));
  const start = JUZ_STARTS[clampedStart - 1];

  if (lastIncluded >= 30) {
    return {
      surahStart: start.surah,
      ayahStart: start.ayah,
      surahEnd: 114,
      ayahEnd: ayahsInSurah(114),
    };
  }

  // The range ends one ayah before the next not-included juz begins.
  const next = JUZ_STARTS[lastIncluded]; // juz `lastIncluded + 1`
  const endsAtNewSurah = next.ayah === 1;
  return {
    surahStart: start.surah,
    ayahStart: start.ayah,
    surahEnd: endsAtNewSurah ? next.surah - 1 : next.surah,
    ayahEnd: endsAtNewSurah ? ayahsInSurah(next.surah - 1) : next.ayah - 1,
  };
}
