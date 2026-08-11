/**
 * Quran API Integration
 * Fetches Quranic text from Quran.com API or fallback cache
 */

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

const QURAN_API_BASE = "https://api.alquran.cloud/v1";

// Cache for Surahs list
let surahsCache: QuranSurah[] | null = null;

export async function getSurahs(): Promise<QuranSurah[]> {
  if (surahsCache) return surahsCache;

  try {
    const res = await fetch(`${QURAN_API_BASE}/surah`);
    if (!res.ok) throw new Error("Failed to fetch Surahs");
    const data = await res.json();
    surahsCache = data.data;
    return data.data;
  } catch (error) {
    console.error("Error fetching Surahs:", error);
    // Return fallback Surahs list (first 5)
    return getFallbackSurahs();
  }
}

export async function getSurahByNumber(surahNumber: number): Promise<QuranSurah | null> {
  const surahs = await getSurahs();
  return surahs.find((s) => s.number === surahNumber) || null;
}

export async function getAyahs(
  surahNumber: number,
  ayahStart?: number,
  ayahEnd?: number
): Promise<QuranAyah[]> {
  try {
    // Fetch with uthmani text edition
    const res = await fetch(
      `${QURAN_API_BASE}/quran/en.asad/by/surah/${surahNumber}`
    );
    if (!res.ok) throw new Error("Failed to fetch Ayahs");
    const data = await res.json();

    let ayahs: QuranAyah[] = data.data.ayahs.map((ayah: any) => ({
      number: ayah.number,
      text: ayah.text,
      surah: ayah.surah,
      ayah: ayah.numberInSurah,
      numberInSurah: ayah.numberInSurah,
    }));

    // Filter by range if provided
    if (ayahStart && ayahEnd) {
      ayahs = ayahs.filter(
        (a) => a.numberInSurah >= ayahStart && a.numberInSurah <= ayahEnd
      );
    }

    return ayahs;
  } catch (error) {
    console.error(`Error fetching Ayahs for Surah ${surahNumber}:`, error);
    return getFallbackAyahs(surahNumber, ayahStart, ayahEnd);
  }
}

// Fallback data for offline/error scenarios
function getFallbackSurahs(): QuranSurah[] {
  return [
    {
      number: 1,
      name: "الفاتحة",
      englishName: "Al-Fatiha",
      englishNameTranslation: "The Opening",
      numberOfAyahs: 7,
      revelationType: "Meccan",
    },
    {
      number: 2,
      name: "البقرة",
      englishName: "Al-Baqarah",
      englishNameTranslation: "The Cow",
      numberOfAyahs: 286,
      revelationType: "Medinan",
    },
    {
      number: 3,
      name: "آل عمران",
      englishName: "Al-Imran",
      englishNameTranslation: "The Family of Imran",
      numberOfAyahs: 200,
      revelationType: "Medinan",
    },
    {
      number: 4,
      name: "النساء",
      englishName: "An-Nisa",
      englishNameTranslation: "The Women",
      numberOfAyahs: 176,
      revelationType: "Medinan",
    },
    {
      number: 5,
      name: "المائدة",
      englishName: "Al-Maidah",
      englishNameTranslation: "The Table Spread",
      numberOfAyahs: 120,
      revelationType: "Medinan",
    },
  ];
}

function getFallbackAyahs(
  surahNumber: number,
  ayahStart?: number,
  ayahEnd?: number
): QuranAyah[] {
  // Sample fallback data (first 3 Ayahs of Surah Al-Fatiha)
  if (surahNumber === 1) {
    const ayahs = [
      {
        number: 1,
        text: "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ",
        surah: 1,
        ayah: 1,
        numberInSurah: 1,
      },
      {
        number: 2,
        text: "الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ",
        surah: 1,
        ayah: 2,
        numberInSurah: 2,
      },
      {
        number: 3,
        text: "الرَّحْمَٰنِ الرَّحِيمِ",
        surah: 1,
        ayah: 3,
        numberInSurah: 3,
      },
    ];
    if (ayahStart && ayahEnd) {
      return ayahs.filter(
        (a) => a.numberInSurah >= ayahStart && a.numberInSurah <= ayahEnd
      );
    }
    return ayahs;
  }
  return [];
}
