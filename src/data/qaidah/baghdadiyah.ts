// The Baghdadi Qaida (Al-Qa'idah Al-Baghdadiyyah), the old primer of the
// Arab world: the letters in their Arabic order, then each letter spelt aloud
// with every harakah (tahajji: “baa, fatha: ba”), the madds, tanween, sukoon
// and shaddah, the sun and moon letters, and finally al-Fatiha and the last
// surahs. Written the Arab way, as the Madinah Mushaf is: a hamza on the
// alif, no jazm on the madd letters, and an alif after two fathas.
//
// Its drills put every letter through the same pattern, so they are built
// from the letter list below rather than typed out letter by letter.

import {
  DAMMA,
  DAMMATAN,
  FATHA,
  FATHATAN,
  KASRA,
  KASRATAN,
  SHADDA,
  SUKUN,
  rowsOf,
  surahRows,
  together,
  type QaidahBook,
  type QaidahLesson,
} from "./types";

/** The letters in the Arabic order, haa before waw. */
const LETTERS = [
  "ا", "ب", "ت", "ث", "ج", "ح", "خ", "د", "ذ", "ر", "ز", "س", "ش", "ص",
  "ض", "ط", "ظ", "ع", "غ", "ف", "ق", "ك", "ل", "م", "ن", "ه", "و", "ي",
];
const CONSONANTS = LETTERS.slice(1);
/** Waw and yaa with a sukoon are the madd and leen letters, taught on their own. */
const SUKOON_LETTERS = CONSONANTS.filter((l) => l !== "و" && l !== "ي");

const ALIF = "ا";
const WAW = "و";
const YAA = "ي";
// The alif carries a hamza wherever it takes a harakah.
const ALIF_FATHA = "أ" + FATHA;
const ALIF_KASRA = "إ" + KASRA;
const ALIF_DAMMA = "أ" + DAMMA;

const MOON_WORDS = [
  "الْأَرْضُ", "الْبَيْتُ", "الْجَنَّةُ", "الْحَمْدُ", "الْخَيْرُ", "الْعِلْمُ", "الْغَفُورُ",
  "الْفَجْرُ", "الْقَمَرُ", "الْكِتَابُ", "الْمَلِكُ", "الْهُدَى", "الْوَلَدُ", "الْيَوْمُ",
];
const SUN_WORDS = [
  "التِّينُ", "الثَّمَرُ", "الدِّينُ", "الذِّكْرُ", "الرَّحْمَٰنُ", "الزَّيْتُونُ", "السَّمَاءُ",
  "الشَّمْسُ", "الصِّرَاطُ", "الضُّحَى", "الطُّورُ", "الظُّلْمُ", "اللَّيْلُ", "النَّاسُ",
];

const LESSONS: QaidahLesson[] = [
  {
    id: 1,
    title: "The letters",
    arabicTitle: "الْحُرُوفُ الْهِجَائِيَّةُ",
    teaches:
      "The twenty-eight letters in their Arabic order, each said by its name: alif, baa, taa. The Baghdadi way names every letter before it is read with a vowel.",
    rows: [
      ["ا", "ب", "ت", "ث", "ج", "ح", "خ"],
      ["د", "ذ", "ر", "ز", "س", "ش", "ص"],
      ["ض", "ط", "ظ", "ع", "غ", "ف", "ق"],
      ["ك", "ل", "م", "ن", "ه", "و", "لا", "ي"],
    ],
    note: "In the Arabic order haa (ه) comes before waw (و), and laam-alif (لا) is learnt as a shape of its own.",
  },
  {
    id: 2,
    title: "Fatha",
    arabicTitle: "الْفَتْحَةُ",
    teaches: "Each letter with a fatha, spelt aloud: “baa, fatha: ba”.",
    rows: rowsOf([ALIF_FATHA, ...CONSONANTS.map((l) => l + FATHA)], 7),
    note: "Name the letter, then the harakah, then the sound: alif fatha a, baa fatha ba. This spelling aloud (tahajji) is the heart of the Baghdadi method.",
  },
  {
    id: 3,
    title: "Kasra",
    arabicTitle: "الْكَسْرَةُ",
    teaches: "Each letter with a kasra, spelt aloud: “baa, kasra: bi”.",
    rows: rowsOf([ALIF_KASRA, ...CONSONANTS.map((l) => l + KASRA)], 7),
    note: "Keep spelling every letter until the sound comes without it.",
  },
  {
    id: 4,
    title: "Damma",
    arabicTitle: "الضَّمَّةُ",
    teaches: "Each letter with a damma, spelt aloud: “baa, damma: bu”.",
    rows: rowsOf([ALIF_DAMMA, ...CONSONANTS.map((l) => l + DAMMA)], 7),
    note: "Watch the lips: they round for a damma, and the sound stays short.",
  },
  {
    id: 5,
    title: "The three harakat together",
    arabicTitle: "الْحَرَكَاتُ الثَّلَاثُ",
    teaches:
      "The Baghdadi table: each letter with all three harakat in turn, spelt and then read: أَ إِ أُ, بَ بِ بُ.",
    rows: [
      ...rowsOf(
        [
          together(ALIF_FATHA, ALIF_KASRA, ALIF_DAMMA),
          ...CONSONANTS.map((l) => together(l + FATHA, l + KASRA, l + DAMMA)),
        ],
        4
      ),
      ["خَلَقَ", "سَمِعَ", "كُتِبَ", "رُسُلُ"],
    ],
    note: "Chant the table the old way — baa fatha ba, baa kasra bi, baa damma bu — then read it straight through.",
  },
  {
    id: 6,
    title: "Madd with alif",
    arabicTitle: "الْمَدُّ بِالْأَلِفِ",
    teaches: "An alif after a letter with a fatha stretches it two counts: بَا is “baa”.",
    rows: [
      ...rowsOf(CONSONANTS.map((l) => l + FATHA + ALIF), 7),
      ["قَالَ", "كَانَ", "سَارَ", "جَاءَ"],
    ],
    note: "The letter before the alif always carries a fatha.",
  },
  {
    id: 7,
    title: "Madd with yaa",
    arabicTitle: "الْمَدُّ بِالْيَاءِ",
    teaches: "A yaa after a letter with a kasra stretches it two counts: بِي is “bee”.",
    rows: [
      ...rowsOf(CONSONANTS.map((l) => l + KASRA + YAA), 7),
      ["قِيلَ", "فِيهِ", "حِينَ", "دِينُ"],
    ],
    note: "The letter before the yaa always carries a kasra.",
  },
  {
    id: 8,
    title: "Madd with waw",
    arabicTitle: "الْمَدُّ بِالْوَاوِ",
    teaches: "A waw after a letter with a damma stretches it two counts: بُو is “boo”.",
    rows: [
      ...rowsOf(CONSONANTS.map((l) => l + DAMMA + WAW), 7),
      ["يَقُولُ", "نُورُ", "يَكُونُ", "سُورَةُ"],
    ],
    note: "The letter before the waw always carries a damma.",
  },
  {
    id: 9,
    title: "The three madds together",
    arabicTitle: "الْمُدُودُ الثَّلَاثَةُ",
    teaches: "All three madds side by side for each letter: بَا بِي بُو.",
    rows: [
      ...rowsOf(
        CONSONANTS.map((l) => together(l + FATHA + ALIF, l + KASRA + YAA, l + DAMMA + WAW)),
        4
      ),
      ["قَالَ", "قِيلَ", "يَقُولُ", "يُوحِي"],
    ],
    note: "Two counts each, evenly: no shorter, no longer.",
  },
  {
    id: 10,
    title: "Tanween",
    arabicTitle: "التَّنْوِينُ",
    teaches:
      "Tanween adds an “n” after the vowel: بًا بٍ بٌ is “ban, bin, bun”. Two fathas are written with an alif after them, and that alif isn't read on its own.",
    rows: [
      ...rowsOf(
        CONSONANTS.map((l) => together(l + FATHATAN + ALIF, l + KASRATAN, l + DAMMATAN)),
        4
      ),
      ["كِتَابٌ", "قَلَمًا", "رَجُلٍ", "وَلَدٌ"],
    ],
    note: "Spell it the old way too: baa, two fathas: ban.",
  },
  {
    id: 11,
    title: "Sukoon",
    arabicTitle: "السُّكُونُ",
    teaches:
      "A sukoon means no vowel: join the letter to the one before and stop it cleanly. أَبْ إِبْ أُبْ is “ab, ib, ub”.",
    rows: [
      ...rowsOf(
        SUKOON_LETTERS.map((l) =>
          together(ALIF_FATHA + l + SUKUN, ALIF_KASRA + l + SUKUN, ALIF_DAMMA + l + SUKUN)
        ),
        4
      ),
      ["قُلْ", "لَمْ", "مِنْ", "عَنْ", "هَلْ", "قَدْ"],
    ],
    note: "Five letters bounce lightly when they carry a sukoon — ق ط ب ج د (qalqalah). Don't add a vowel after them.",
  },
  {
    id: 12,
    title: "Shaddah",
    arabicTitle: "الشَّدَّةُ",
    teaches:
      "A shaddah doubles a letter: read it once with a sukoon, then again with its harakah. أَبَّ إِبِّ أُبُّ is “abba, ibbi, ubbu”.",
    rows: [
      ...rowsOf(
        CONSONANTS.map((l) =>
          together(
            ALIF_FATHA + l + SHADDA + FATHA,
            ALIF_KASRA + l + SHADDA + KASRA,
            ALIF_DAMMA + l + SHADDA + DAMMA
          )
        ),
        4
      ),
      ["رَبِّ", "ثُمَّ", "إِنَّ", "كُلُّ"],
    ],
    note: "A noon or meem with a shaddah carries a two-count hum through the nose (ghunnah).",
  },
  {
    id: 13,
    title: "The sun and moon letters",
    arabicTitle: "اللَّامُ الشَّمْسِيَّةُ وَاللَّامُ الْقَمَرِيَّةُ",
    teaches:
      "Before a moon letter the ل of ال is read, with a sukoon: الْقَمَرُ. Before a sun letter it isn't read, and the next letter takes a shaddah instead: الشَّمْسُ.",
    rows: [...rowsOf(MOON_WORDS, 4), ...rowsOf(SUN_WORDS, 4)],
    rowLabels: {
      0: "Moon letters: the ل is read",
      4: "Sun letters: the ل is silent",
    },
    note: "The fourteen moon letters are gathered in ابْغِ حَجَّكَ وَخَفْ عَقِيمَهُ; the other fourteen are sun letters.",
  },
  {
    id: 14,
    title: "Surat al-Fatiha",
    arabicTitle: "سُورَةُ الْفَاتِحَةِ",
    teaches: "The first surah of the Qur'an, read with everything the Qa'idah has taught.",
    rows: [
      ["بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ"],
      ["ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَٰلَمِينَ"],
      ["ٱلرَّحْمَٰنِ ٱلرَّحِيمِ"],
      ["مَٰلِكِ يَوْمِ ٱلدِّينِ"],
      ["إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ"],
      ["ٱهْدِنَا ٱلصِّرَٰطَ ٱلْمُسْتَقِيمَ"],
      ["صِرَٰطَ ٱلَّذِينَ أَنْعَمْتَ عَلَيْهِمْ غَيْرِ ٱلْمَغْضُوبِ عَلَيْهِمْ وَلَا ٱلضَّآلِّينَ"],
    ],
    ayahs: surahRows(0, 1, 7),
    note: "Read one ayah at a time, then the whole surah, stopping at the end of each ayah.",
  },
  {
    id: 15,
    title: "Al-Ikhlas, al-Falaq and an-Nas",
    arabicTitle: "الْإِخْلَاصُ وَالْمُعَوِّذَتَانِ",
    teaches:
      "The last three surahs of the Qur'an. From here the child carries on through Juz 'Amma in the Mushaf.",
    rows: [
      ["قُلْ هُوَ ٱللَّهُ أَحَدٌ"],
      ["ٱللَّهُ ٱلصَّمَدُ"],
      ["لَمْ يَلِدْ وَلَمْ يُولَدْ"],
      ["وَلَمْ يَكُن لَّهُۥ كُفُوًا أَحَدٌ"],
      ["قُلْ أَعُوذُ بِرَبِّ ٱلْفَلَقِ"],
      ["مِن شَرِّ مَا خَلَقَ"],
      ["وَمِن شَرِّ غَاسِقٍ إِذَا وَقَبَ"],
      ["وَمِن شَرِّ ٱلنَّفَّٰثَٰتِ فِى ٱلْعُقَدِ"],
      ["وَمِن شَرِّ حَاسِدٍ إِذَا حَسَدَ"],
      ["قُلْ أَعُوذُ بِرَبِّ ٱلنَّاسِ"],
      ["مَلِكِ ٱلنَّاسِ"],
      ["إِلَٰهِ ٱلنَّاسِ"],
      ["مِن شَرِّ ٱلْوَسْوَاسِ ٱلْخَنَّاسِ"],
      ["ٱلَّذِى يُوَسْوِسُ فِى صُدُورِ ٱلنَّاسِ"],
      ["مِنَ ٱلْجِنَّةِ وَٱلنَّاسِ"],
    ],
    rowLabels: {
      0: "Al-Ikhlas",
      4: "Al-Falaq",
      9: "An-Nas",
    },
    ayahs: { ...surahRows(0, 112, 4), ...surahRows(4, 113, 5), ...surahRows(9, 114, 6) },
    note: "Children often know these by heart already: have them follow each word with a finger, so they read rather than recite.",
  },
];

export const BAGHDADIYAH: QaidahBook = {
  id: "baghdadiyah",
  name: "Baghdadi Qaida",
  shortName: "Baghdadi",
  arabicName: "الْقَاعِدَةُ الْبَغْدَادِيَّةُ",
  summary:
    "The Baghdadi Qaida in 15 steps: every letter spelt aloud with each harakah, then the madds, tanween, sukoon and shaddah, the sun and moon letters, and al-Fatiha with the last three surahs. The Arabic is written the Arab way, as in the Madinah Mushaf.",
  lessons: LESSONS,
};
