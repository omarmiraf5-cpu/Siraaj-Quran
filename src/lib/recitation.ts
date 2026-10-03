// Per-ayah recitation: the reciters the Mushaf offers and where each one's
// audio lives. Shared with the Qa'idah, whose surah lessons play the same
// recordings.

import { SURAHS } from "@/data/mushaf-index";

// Two independent hosts serve per-ayah recitation, and they do not carry the
// same reciters: the Islamic Network CDN indexes by a running ayah number
// 1-6236, while EveryAyah indexes by zero-padded surah+ayah. Reciters missing
// from one are usually present on the other, so a reciter lists sources from
// whichever hosts carry it and the player falls through them in order.
export type AudioSource =
  | { host: "islamic"; edition: string; bitrate: number }
  | { host: "everyayah"; folder: string };

export interface Reciter {
  id: string;
  name: string;
  sources: AudioSource[];
}

export const RECITERS: Reciter[] = [
  // Abdirashid Ali Sufi was listed here but never played. He is published as
  // whole-surah recordings rather than one file per ayah, so none of the
  // per-ayah URLs a reciter needs here exist for him — every candidate 404'd.
  // Adding him back needs either a per-ayah source, or gapless support:
  // surah-length audio plus ayah timings to seek within it.
  {
    id: "minshawi",
    name: "Al-Minshawi",
    sources: [
      { host: "islamic", edition: "ar.minshawi", bitrate: 128 },
      // EveryAyah spells him "Minshawy"; the "Minshawi_..." folder 404s.
      { host: "everyayah", folder: "Minshawy_Murattal_128kbps" },
    ],
  },
  {
    id: "husary",
    name: "Khalil Al-Husary",
    sources: [
      { host: "islamic", edition: "ar.husary", bitrate: 128 },
      { host: "everyayah", folder: "Husary_128kbps" },
    ],
  },
  {
    // EveryAyah carries him, the Islamic Network CDN does not, so there is
    // no point listing an edition there.
    id: "ayyub",
    name: "Muhammad Ayyub",
    sources: [
      { host: "everyayah", folder: "Muhammad_Ayyoub_128kbps" },
      { host: "everyayah", folder: "Muhammad_Ayyoub_64kbps" },
    ],
  },
  {
    // Hafs, and published as per-ayah files rather than whole-surah ones, so
    // he works with tapping and repeat. Listed on both hosts; whichever
    // answers first is kept for the rest of the session.
    id: "muaiqly",
    name: "Maher Al-Muaiqly",
    sources: [
      { host: "islamic", edition: "ar.mahermuaiqly", bitrate: 128 },
      { host: "islamic", edition: "ar.mahermuaiqly", bitrate: 64 },
      { host: "everyayah", folder: "Maher_AlMuaiqly_64kbps" },
      { host: "everyayah", folder: "Maher_AlMuaiqly_128kbps" },
    ],
  },
];

export function getAbsoluteAyahNumber(surah: number, ayah: number): number {
  let total = 0;
  for (const s of SURAHS) {
    if (s.id === surah) break;
    total += s.ayahs;
  }
  return total + ayah;
}

// Every candidate URL for one ayah, most-preferred first.
export function getAudioSources(reciter: Reciter, surah: number, ayah: number): string[] {
  return reciter.sources.map((src) => {
    if (src.host === "islamic") {
      const n = getAbsoluteAyahNumber(surah, ayah);
      return `https://cdn.islamic.network/quran/audio/${src.bitrate}/${src.edition}/${n}.mp3`;
    }
    const s = String(surah).padStart(3, "0");
    const a = String(ayah).padStart(3, "0");
    return `https://everyayah.com/data/${src.folder}/${s}${a}.mp3`;
  });
}
