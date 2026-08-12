import { SURAHS, getSurahData, getAllSurahsList } from "@/data/quran-text";

export interface QuranAyah {
  number: number;
  text: string;
  surah: number;
  ayah: number;
  numberInSurah: number;
}

export interface QuranSurah {
  number: number;
  name: string;
  englishName: string;
  englishNameTranslation: string;
  numberOfAyahs: number;
  revelationType: string;
}

export async function getSurahs(): Promise<QuranSurah[]> {
  return getAllSurahsList().map((s) => ({
    ...s,
    name: SURAHS.find((x) => x.number === s.number)?.name ?? "",
    revelationType: SURAHS.find((x) => x.number === s.number)?.revelationType ?? "Meccan",
  }));
}

export async function getSurahByNumber(surahNumber: number): Promise<QuranSurah | null> {
  const data = getSurahData(surahNumber);
  if (!data) return null;
  return {
    number: data.number,
    name: data.name,
    englishName: data.englishName,
    englishNameTranslation: data.englishNameTranslation,
    numberOfAyahs: data.numberOfAyahs,
    revelationType: data.revelationType,
  };
}

export async function getAyahs(
  surahNumber: number,
  ayahStart?: number,
  ayahEnd?: number
): Promise<QuranAyah[]> {
  const data = getSurahData(surahNumber);
  if (!data) return [];

  let ayahs: QuranAyah[] = data.ayahs.map((a) => ({
    number: a.number,
    text: a.text,
    surah: surahNumber,
    ayah: a.number,
    numberInSurah: a.number,
  }));

  if (ayahStart && ayahEnd) {
    ayahs = ayahs.filter(
      (a) => a.numberInSurah >= ayahStart && a.numberInSurah <= ayahEnd
    );
  }

  return ayahs;
}
