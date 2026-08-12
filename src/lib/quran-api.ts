import { QURAN, getSurahById } from "@/data/quran-text";

export interface QuranSurah {
  number: number;
  name: string;
  englishName: string;
  englishNameTranslation: string;
  numberOfAyahs: number;
  revelationType: string;
}

export async function getSurahs(): Promise<QuranSurah[]> {
  return QURAN.map((s) => ({
    number: s.id,
    name: s.name,
    englishName: s.englishName,
    englishNameTranslation: s.translation,
    numberOfAyahs: s.ayahs.length,
    revelationType: s.type === "meccan" ? "Meccan" : "Medinan",
  }));
}

export async function getSurahByNumber(surahNumber: number): Promise<QuranSurah | null> {
  const s = getSurahById(surahNumber);
  if (!s) return null;
  return {
    number: s.id,
    name: s.name,
    englishName: s.englishName,
    englishNameTranslation: s.translation,
    numberOfAyahs: s.ayahs.length,
    revelationType: s.type === "meccan" ? "Meccan" : "Medinan",
  };
}
