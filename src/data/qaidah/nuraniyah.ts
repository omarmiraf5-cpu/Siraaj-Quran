// The Noorani Qaida (Al-Qa'idah An-Nuraniyah) of Sheikh Noor Muhammad
// Haqqani: seventeen lessons, numbered as in the book, from the single
// letters to the rules of noon sakin and tanween. Written in the Indo-Pak
// style its English editions use, like Ahsanul Qawaid: a jazm on the madd
// letters, the standing harakat, an alif carrying the hamza's harakah.
//
// The drills that run every letter through the same pattern (each letter
// with fatha, kasra and damma; with a jazm; with a shaddah) are built from
// the letter list below rather than typed out letter by letter.

import {
  DAMMA,
  DAMMATAN,
  FATHA,
  FATHATAN,
  KASRA,
  KASRATAN,
  KHARI_ZABAR,
  KHARI_ZER,
  SHADDA,
  SUKUN,
  ULTA_PESH,
  rowsOf,
  together,
  type QaidahBook,
  type QaidahLesson,
} from "./types";

const LETTERS = [
  "ا", "ب", "ت", "ث", "ج", "ح", "خ", "د", "ذ", "ر", "ز", "س", "ش", "ص", "ض",
  "ط", "ظ", "ع", "غ", "ف", "ق", "ك", "ل", "م", "ن", "و", "ه", "ء", "ي",
];
/** The letters a drill puts after an alif or gives a harakah of their own. */
const CONSONANTS = LETTERS.filter((l) => l !== "ا" && l !== "ء");
/** Waw and yaa with a jazm are madd or leen letters, taught on their own. */
const SUKOON_LETTERS = CONSONANTS.filter((l) => l !== "و" && l !== "ي");

const ALIF = "ا";
const WAW = "و";
const YAA = "ي";

const LESSONS: QaidahLesson[] = [
  {
    id: 1,
    title: "Single letters (huroof mufradaat)",
    arabicTitle: "الْحُرُوفُ الْمُفْرَدَةُ",
    teaches:
      "The twenty-nine letters on their own, each named and said from its own place in the mouth (its makhraj).",
    rows: [
      ["ا", "ب", "ت", "ث", "ج", "ح", "خ"],
      ["د", "ذ", "ر", "ز", "س", "ش", "ص"],
      ["ض", "ط", "ظ", "ع", "غ", "ف", "ق"],
      ["ك", "ل", "م", "ن", "و", "ه", "ء", "ي"],
    ],
    note: "The Noorani Qaida marks out seven letters — خ ص ض ط ظ غ ق — because they are always read heavy, with a full mouth. Point them out from the first day.",
  },
  {
    id: 2,
    title: "Joined letters (huroof murakkabaat)",
    arabicTitle: "الْحُرُوفُ الْمُرَكَّبَةُ",
    teaches:
      "Letters joined in pairs and threes, read by naming each letter from right to left: لب is laam, baa.",
    rows: [
      ["با", "تا", "ثا", "جا", "حا", "خا"],
      ["دا", "ذا", "را", "زا", "سا", "شا"],
      ["صا", "ضا", "طا", "ظا", "عا", "غا"],
      ["فا", "قا", "كا", "لا", "ما", "نا"],
      ["وا", "ها", "يا"],
      ["لب", "لت", "لث", "لج", "لح", "لخ"],
      ["بسم", "قلم", "نعم", "فتح", "كتب", "خلق"],
    ],
    note: "A letter changes shape when it joins, but its dots don't. Have the child find each letter's dots before naming it.",
  },
  {
    id: 3,
    title: "Disjoined letters (huroof muqatta'aat)",
    arabicTitle: "الْحُرُوفُ الْمُقَطَّعَاتُ",
    teaches:
      "The letters that open twenty-nine surahs. They are read one by one by their names, never joined into a word: الٓمّٓ is “alif, laam, meem”.",
    readings: [
      {
        words: [
          ["الٓمّٓ", "اَلِفْ لَآمْ مِّيْمْ"],
          ["يٰسٓ", "يَا سِيْنْ"],
          ["حٰمٓ", "حَا مِيْمْ"],
          ["طٰهٰ", "طَا هَا"],
        ],
      },
    ],
    rows: [
      ["الٓمّٓ", "الٓمّٓصٓ", "الٓرٰ", "الٓمّٓرٰ"],
      ["كٓهٰيٰعٓصٓ", "طٰهٰ", "طٰسٓمّٓ", "طٰسٓ"],
      ["يٰسٓ", "صٓ", "حٰمٓ", "عٓسٓقٓ"],
      ["قٓ", "نٓ"],
    ],
    note: "Names like laam, meem and seen are stretched six counts, as the madd sign over them shows; haa, yaa, taa and raa two; alif not at all.",
  },
  {
    id: 4,
    title: "Harakaat: fatha, kasra, damma",
    arabicTitle: "الْحَرَكَاتُ",
    teaches:
      "A fatha (zabar) above a letter gives “a”, a kasra (zer) below it “i” and a damma (pesh) above it “u”, each one short count: بَ بِ بُ is “ba, bi, bu”.",
    rows: [
      ...rowsOf(
        LETTERS.map((l) => together(l + FATHA, l + KASRA, l + DAMMA)),
        4
      ),
      ["خَلَقَ", "كَتَبَ", "عَلِمَ", "كُتِبَ"],
    ],
    note: "Spell each one first — “baa zabar ba, baa zer bi, baa pesh bu” — then read the trios without spelling.",
  },
  {
    id: 5,
    title: "Tanween",
    arabicTitle: "التَّنْوِينُ",
    teaches:
      "Two fathas, two kasras or two dammas add an “n” after the vowel, though no noon is written: بً بٍ بٌ is “ban, bin, bun”.",
    rows: rowsOf(
      LETTERS.map((l) => together(l + FATHATAN, l + KASRATAN, l + DAMMATAN)),
      4
    ),
    note: "Keep the “n” light and short, and check the child can tell a single mark from a doubled one at a glance.",
  },
  {
    id: 6,
    title: "Harakaat and tanween together",
    arabicTitle: "الْحَرَكَاتُ مَعَ التَّنْوِينِ",
    teaches: "Words that mix single harakaat and tanween, read straight through without spelling.",
    rows: [
      ["اَحَدٌ", "وَلَدٌ", "بَشَرٌ", "قَمَرٌ"],
      ["رُسُلٌ", "كُتُبٌ", "عَمَلٌ", "مَلَكٌ"],
      ["اَبَدًا", "عَدَدًا", "حَسَنَةً", "شَجَرَةً"],
      ["بَلَدٍ", "عَمَدٍ", "مَسَدٍ", "لَهَبٍ"],
      ["خَلَقَ", "جَعَلَ", "سَمِعَ", "كُتِبَ"],
    ],
    note: "In words, two fathas usually sit before an alif that isn't read: اَبَدًا is “abadan”. The round taa, ة, reads like ت.",
  },
  {
    id: 7,
    title: "Standing fatha, standing kasra, inverted damma",
    arabicTitle: "الْفَتْحَةُ الْقَائِمَةُ وَالْكَسْرَةُ الْقَائِمَةُ وَالضَّمَّةُ الْمَقْلُوبَةُ",
    teaches:
      "The standing fatha (khari zabar) reads “aa”, the standing kasra (khari zer) “ee” and the inverted damma (ulta pesh) “oo”, each stretched two counts: بٰ بٖ بٗ.",
    rows: [
      ...rowsOf(
        CONSONANTS.map((l) => together(l + KHARI_ZABAR, l + KHARI_ZER, l + ULTA_PESH)),
        4
      ),
      ["هٰذَا", "ذٰلِكَ", "اِلٰهٌ", "كِتٰبٌ"],
      ["لَهٗ", "بِهٖ", "خَلَقَهٗ", "كِتٰبَهٗ"],
    ],
    note: "Two counts, evenly. In the Qur'an the khari zer and ulta pesh mostly sit on the ه of “his” and “him”: لَهٗ, بِهٖ.",
  },
  {
    id: 8,
    title: "Madd and leen letters",
    arabicTitle: "حُرُوفُ الْمَدِّ وَاللِّينِ",
    teaches:
      "An alif after a fatha, a yaa with a jazm after a kasra and a waw with a jazm after a damma are the madd letters, stretched two counts: بَا بِيْ بُوْ. A waw or yaa with a jazm after a fatha is soft (leen), read quickly: بَوْ بَيْ.",
    rows: [
      ...rowsOf(
        CONSONANTS.map((l) =>
          together(l + FATHA + ALIF, l + KASRA + YAA + SUKUN, l + DAMMA + WAW + SUKUN)
        ),
        4
      ),
      ...rowsOf(
        ["ب", "ت", "خ", "ق", "ل", "م", "ن", "ه"].map((l) =>
          together(l + FATHA + WAW + SUKUN, l + FATHA + YAA + SUKUN)
        ),
        4
      ),
      ["قَالَ", "قِيْلَ", "يَقُوْلُ", "نُوْحٌ"],
      ["خَوْفٌ", "يَوْمٌ", "بَيْتٌ", "خَيْرٌ"],
    ],
    rowLabels: {
      0: "Madd: stretched two counts",
      7: "Leen: soft and quick",
      9: "In words",
    },
    note: "The harakah before the letter decides it: a fatha before waw or yaa makes it leen, a damma or a kasra makes it madd.",
  },
  {
    id: 9,
    title: "Exercise: harakaat, tanween, madd and leen",
    arabicTitle: "تَمْرِينُ الْحَرَكَاتِ وَالتَّنْوِينِ وَالْمَدِّ وَاللِّينِ",
    teaches:
      "Real words that use everything so far: the harakaat, tanween, the standing harakaat, madd and leen.",
    rows: [
      ["مٰلِكِ", "يَوْمِ", "دِيْنٌ", "نَارٌ"],
      ["كَرِيْمٌ", "رَحِيْمٌ", "غَفُوْرٌ", "عَظِيْمٌ"],
      ["قُلُوْبٌ", "عُيُوْنٌ", "سَمٰوٰتٌ", "يَقُوْلُوْنَ"],
      ["يَوْمَئِذٍ", "قِيْلَ", "خَوْفٌ", "اِلٰهٌ"],
    ],
    note: "Read without spelling now. If a word stalls, spell just that word, then read the row again.",
  },
  {
    id: 10,
    title: "Sukoon (jazm) and qalqalah",
    arabicTitle: "السُّكُونُ وَالْقَلْقَلَةُ",
    teaches:
      "A jazm means the letter has no vowel: join it to the letter before and stop it cleanly. اَبْ اِبْ اُبْ is “ab, ib, ub”. Five letters bounce when they carry a jazm: ق ط ب ج د.",
    rows: [
      ...rowsOf(
        SUKOON_LETTERS.map((l) =>
          together(ALIF + FATHA + l + SUKUN, ALIF + KASRA + l + SUKUN, ALIF + DAMMA + l + SUKUN)
        ),
        4
      ),
      ["اَقْ", "اَطْ", "اَبْ", "اَجْ", "اَدْ"],
    ],
    rowLabels: { 7: "Qalqalah: bounce these five" },
    note: "Gather the qalqalah letters with قُطْبُ جَدٍّ. Bounce them lightly, without adding a vowel after them.",
  },
  {
    id: 11,
    title: "Exercise of sukoon",
    arabicTitle: "تَمْرِينُ السُّكُونِ",
    teaches:
      "Words with a jazm, read straight through without spelling — the bridge from letters to the Qur'an.",
    rows: [
      ["قُلْ", "لَمْ", "مِنْ", "عَنْ", "هَلْ", "قَدْ"],
      ["اَنْتَ", "يَعْلَمُ", "مَسْجِدٌ", "اَرْضٌ"],
      ["اَلْحَمْدُ", "اَلْعٰلَمِيْنَ", "اِهْدِنَا", "اَنْعَمْتَ"],
      ["لَمْ يَلِدْ", "وَلَمْ يُوْلَدْ", "قُلْ اَعُوْذُ"],
    ],
    note: "Read whole words now, and spell only the one that stalls. Listen for the bounce on a qalqalah letter with a jazm.",
  },
  {
    id: 12,
    title: "Tashdeed (shaddah)",
    arabicTitle: "التَّشْدِيدُ",
    teaches:
      "A shaddah doubles a letter: read it once with a jazm, joined to the letter before, then again with its own harakah. اَبَّ اِبِّ اُبُّ is “abba, ibbi, ubbu”.",
    rows: [
      ...rowsOf(
        CONSONANTS.map((l) =>
          together(
            ALIF + FATHA + l + SHADDA + FATHA,
            ALIF + KASRA + l + SHADDA + KASRA,
            ALIF + DAMMA + l + SHADDA + DAMMA
          )
        ),
        4
      ),
      ["رَبِّ", "ثُمَّ", "اِنَّ", "كُلُّ"],
    ],
    note: "Press on the letter rather than saying it twice. A noon or meem with a shaddah always carries a ghunnah, a two-count hum through the nose.",
  },
  {
    id: 13,
    title: "Exercise of tashdeed",
    arabicTitle: "تَمْرِينُ التَّشْدِيدِ",
    teaches:
      "The shaddah in real words, and after ال: before a sun letter the ل is not read and the next letter takes a shaddah instead.",
    rows: [
      ["مُحَمَّدٌ", "عَلَّمَ", "يُعَلِّمُ", "فَصَلِّ"],
      ["اَلرَّحْمٰنِ", "اَلرَّحِيْمِ", "اَلصِّرَاطَ", "اَلشَّيْطٰنِ"],
      ["وَالشَّمْسِ", "وَالضُّحٰى", "وَالشَّفْعِ", "وَالصُّبْحِ"],
    ],
    note: "وَالشَّمْسِ is “wash-shamsi”, with no ل. Compare وَالْقَمَرِ, where the ل is read with its jazm.",
  },
  {
    id: 14,
    title: "Tashdeed with sukoon",
    arabicTitle: "التَّشْدِيدُ مَعَ السُّكُونِ",
    teaches:
      "Words with a shaddah and a jazm together, and a letter with a jazm running into a shaddah, where the jazm letter isn't read on its own: قَدْ تَّبَيَّنَ is “qat-tabayyana”.",
    rows: [
      ["اَلْحَقُّ", "تَبَّتْ", "اَلْمُتَّقِيْنَ", "يُعَلِّمُكُمْ"],
      ["مَنْ يَّعْمَلْ", "مِنْ رَّبِّهِمْ", "قَدْ تَّبَيَّنَ", "قُلْ رَّبِّ"],
      ["مِنْ مَّسَدٍ", "مِنْ نُّوْرٍ", "عَبَدْتُّمْ", "بَلْ رَّفَعَهُ"],
    ],
    note: "A noon with a jazm keeps its hum before ي ن م و and loses it completely before ل and ر.",
  },
  {
    id: 15,
    title: "Tashdeed with tashdeed",
    arabicTitle: "التَّشْدِيدُ مَعَ التَّشْدِيدِ",
    teaches:
      "Two shaddahs one after the other: press each in turn without rushing. اَلْمُزَّمِّلُ is “al-muz-zam-mil”.",
    rows: [
      ["اَلْمُزَّمِّلُ", "اَلْمُدَّثِّرُ", "مِنْ رَّبِّكَ", "اِنَّ الَّذِيْنَ"],
      ["ثُمَّ الَّذِيْنَ", "اِنَّ اللّٰهَ", "عَدُوٌّ مُّبِيْنٌ"],
      ["مُحَمَّدٌ رَّسُوْلُ اللّٰهِ"],
    ],
    note: "Count the shaddahs in a word before reading it, so that none is skipped.",
  },
  {
    id: 16,
    title: "Tashdeed with madd letters",
    arabicTitle: "التَّشْدِيدُ مَعَ حُرُوفِ الْمَدِّ",
    teaches:
      "A shaddah followed by a madd letter: press, then stretch two counts — اَبَّا اَبِّيْ اَبُّوْ. And a wavy madd sign before a shaddah means a long stretch of six counts: اَلضَّآلِّيْنَ.",
    rows: [
      ...rowsOf(
        ["ب", "ت", "ر", "س", "ل", "م", "ن", "ه", "ي"].map((l) =>
          together(
            ALIF + FATHA + l + SHADDA + FATHA + ALIF,
            ALIF + KASRA + l + SHADDA + KASRA + YAA + SUKUN,
            ALIF + DAMMA + l + SHADDA + DAMMA + WAW + SUKUN
          )
        ),
        3
      ),
      ["اِيَّاكَ", "اَلنَّاسِ", "حَتّٰى", "يُحِبُّوْنَ"],
      ["وَلَا الضَّآلِّيْنَ", "دَآبَّةٌ", "اَلطَّآمَّةُ", "اَلصَّآخَّةُ"],
    ],
    rowLabels: {
      3: "In words",
      4: "A madd before a shaddah: six counts",
    },
    note: "Two rules at once: don't rush the shaddah to get to the stretch.",
  },
  {
    id: 17,
    title: "Noon sakin and tanween",
    arabicTitle: "النُّونُ السَّاكِنَةُ وَالتَّنْوِينُ",
    teaches:
      "What happens to a noon with a jazm, or a tanween, depending on the letter after it: it is said clearly (izhar), merged (idgham), turned into a meem (iqlab) or hidden (ikhfa). After this lesson a child is ready to start Juz 'Amma.",
    rows: [
      ["مِنْ هَادٍ", "اَنْعَمْتَ", "مِنْ خَيْرٍ", "عَذَابٌ اَلِيْمٌ"],
      ["مَنْ يَّقُوْلُ", "مِنْ نِّعْمَةٍ", "مِنْ مَّالٍ", "مِنْ وَّالٍ"],
      ["مِنْ لَّدُنْهُ", "مِنْ رَّبِّهِمْ", "غَفُوْرٌ رَّحِيْمٌ", "هُدًى لِّلْمُتَّقِيْنَ"],
      ["مِنۢ بَعْدِ", "اَنۢبِئْهُمْ", "سَمِيْعٌۢ بَصِيْرٌ"],
      ["مِنْ تَحْتِهَا", "اَنْتَ", "مُنْذِرٌ", "مِنْ قَبْلِ"],
    ],
    rowLabels: {
      0: "Izhar: before ء ه ع ح غ خ, say the noon clearly",
      1: "Idgham: before ي ن م و it merges with a hum, before ل ر without one",
      3: "Iqlab: before ب it becomes a meem",
      4: "Ikhfa: before the other fifteen letters, hide it with a hum",
    },
    note: "Idgham with ي ن م و, iqlab and ikhfa each carry a two-count ghunnah; izhar has none.",
  },
];

export const NURANIYAH: QaidahBook = {
  id: "nuraniyah",
  name: "Noorani Qaida",
  shortName: "Noorani",
  arabicName: "الْقَاعِدَةُ النُّورَانِيَّةُ",
  summary:
    "The 17 lessons of the Noorani Qaida, numbered as in the book, from the single letters to the rules of noon sakin and tanween. The Arabic is written the way its English editions write it, in the Indo-Pak style.",
  lessons: LESSONS,
};
