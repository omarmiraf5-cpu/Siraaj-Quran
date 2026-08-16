// Al-Qa'idah An-Nuraniyah — the primer a child works through before they can
// read the Mushaf. Seventeen lessons, letters to fluency, in the order they
// are traditionally taught.
//
// The content here is the Arabic itself: letters, their joined forms, the
// harakat and the rules. There is no translation to make of a letter, so each
// lesson carries an English name and an explanation of what is being learnt
// rather than a rendering of the rows.

export interface QaidahLesson {
  id: number;
  /** English name of the lesson. */
  title: string;
  /** Arabic name, as it appears in the printed Qa'idah. */
  arabicTitle: string;
  /** What the child is learning to do. */
  teaches: string;
  /** Rows of Arabic to read aloud, right to left. */
  rows: string[][];
  /** A point for the teacher or parent sitting with them. */
  note?: string;
}

export const QAIDAH_LESSONS: QaidahLesson[] = [
  {
    id: 1,
    title: "The letters, one by one",
    arabicTitle: "الْحُرُوفُ الْمُفْرَدَةُ",
    teaches:
      "Every letter of the Arabic alphabet on its own, named and pronounced from its correct place in the mouth.",
    rows: [
      ["ا", "ب", "ت", "ث", "ج", "ح", "خ"],
      ["د", "ذ", "ر", "ز", "س", "ش", "ص"],
      ["ض", "ط", "ظ", "ع", "غ", "ف", "ق"],
      ["ك", "ل", "م", "ن", "و", "ﻫ", "لا", "ي"],
    ],
    note: "Do not move on until each letter is said clearly on its own. Everything after this rests on it.",
  },
  {
    id: 2,
    title: "The separated letters",
    arabicTitle: "الْحُرُوفُ الْمُقَطَّعَةُ",
    teaches:
      "The letters that open some surahs, read one by one by their names rather than joined into a word.",
    rows: [
      ["الم", "الر", "المص", "المر"],
      ["كهيعص", "طه", "طسم", "طس"],
      ["يس", "ص", "حم", "عسق"],
      ["ق", "ن"],
    ],
    note: "Read these as letter names — alif, laam, meem — not as a word.",
  },
  {
    id: 3,
    title: "Letters joined together",
    arabicTitle: "الْحُرُوفُ الْمُرَكَّبَةُ",
    teaches:
      "How a letter changes shape at the beginning, the middle and the end of a word, while staying the same letter.",
    rows: [
      ["بـ", "ـبـ", "ـب", "ب"],
      ["جـ", "ـجـ", "ـج", "ج"],
      ["عـ", "ـعـ", "ـع", "ع"],
      ["هـ", "ـهـ", "ـه", "ه"],
    ],
    note: "Point out that the letter has not changed — only its dress.",
  },
  {
    id: 4,
    title: "Fathah, kasrah, dammah",
    arabicTitle: "الْحَرَكَاتُ",
    teaches:
      "The three short vowels: a line above, a line below, and a small waw above.",
    rows: [
      ["بَ", "بِ", "بُ"],
      ["تَ", "تِ", "تُ"],
      ["جَ", "جِ", "جُ"],
      ["سَ", "سِ", "سُ"],
    ],
    note: "Short and clean — a harakah is one count, no stretching.",
  },
  {
    id: 5,
    title: "Tanween",
    arabicTitle: "التَّنْوِينُ",
    teaches:
      "The doubled harakat, which add an n sound to the end of the letter without writing a noon.",
    rows: [
      ["بً", "بٍ", "بٌ"],
      ["تً", "تٍ", "تٌ"],
      ["دً", "دٍ", "دٌ"],
      ["سً", "سٍ", "سٌ"],
    ],
  },
  {
    id: 6,
    title: "Harakat and tanween together",
    arabicTitle: "الْحَرَكَاتُ وَالتَّنْوِينُ",
    teaches:
      "Telling a single harakah from a doubled one at a glance, and hearing the difference.",
    rows: [
      ["بَ", "بً", "بِ", "بٍ", "بُ", "بٌ"],
      ["كَ", "كً", "كِ", "كٍ", "كُ", "كٌ"],
      ["مَ", "مً", "مِ", "مٍ", "مُ", "مٌ"],
    ],
    note: "Alternate them out of order once the row is easy, so it is recognition and not recital.",
  },
  {
    id: 7,
    title: "The standing harakat",
    arabicTitle: "الْحَرَكَاتُ الْقَائِمَةُ",
    teaches:
      "The upright fathah, kasrah and dammah, which stretch the sound for two counts.",
    rows: [
      ["بٰ", "بٖ", "بٗ"],
      ["كٰ", "كٖ", "كٗ"],
      ["لٰ", "لٖ", "لٗ"],
    ],
    note: "Two counts, evenly. Count them on your fingers together the first few times.",
  },
  {
    id: 8,
    title: "The letters of madd",
    arabicTitle: "حُرُوفُ الْمَدِّ",
    teaches:
      "Alif, waw and yaa when they carry no harakah of their own and stretch the vowel before them.",
    rows: [
      ["بَا", "بِي", "بُو"],
      ["تَا", "تِي", "تُو"],
      ["نَا", "نِي", "نُو"],
      ["مَا", "مِي", "مُو"],
    ],
    note: "Fathah before alif, kasrah before yaa, dammah before waw — the harakah must match the letter.",
  },
  {
    id: 9,
    title: "The soft letters",
    arabicTitle: "حَرْفَا اللِّينِ",
    teaches:
      "Waw and yaa with a sukoon after a fathah, which soften rather than stretch.",
    rows: [
      ["أَوْ", "أَيْ"],
      ["بَوْ", "بَيْ"],
      ["خَوْ", "خَيْ"],
      ["قَوْ", "قَيْ"],
    ],
  },
  {
    id: 10,
    title: "Madd and layyin side by side",
    arabicTitle: "الْمَدُّ وَاللِّينُ",
    teaches: "Hearing the difference between a stretched letter and a softened one.",
    rows: [
      ["بُوْ", "بَوْ"],
      ["بِيْ", "بَيْ"],
      ["نُوْ", "نَوْ"],
      ["نِيْ", "نَيْ"],
    ],
  },
  {
    id: 11,
    title: "Sukoon",
    arabicTitle: "السُّكُونُ",
    teaches: "A letter with no vowel at all, closed off cleanly.",
    rows: [
      ["أَبْ", "أَتْ", "أَثْ"],
      ["أَسْ", "أَشْ", "أَصْ"],
      ["أَمْ", "أَنْ", "أَهْ"],
    ],
    note: "No vowel means no vowel — a common slip is to add a small sound after it.",
  },
  {
    id: 12,
    title: "Qalqalah",
    arabicTitle: "الْقَلْقَلَةُ",
    teaches:
      "The five letters that bounce when they carry a sukoon: qaf, taa, baa, jeem, dal.",
    rows: [
      ["قْ", "طْ", "بْ", "جْ", "دْ"],
      ["أَقْ", "أَطْ", "أَبْ", "أَجْ", "أَدْ"],
      ["يَقْ", "يَطْ", "يَبْ", "يَجْ", "يَدْ"],
    ],
    note: "Gather them with the phrase قُطْبُ جَدٍّ.",
  },
  {
    id: 13,
    title: "Shaddah",
    arabicTitle: "الشَّدَّةُ",
    teaches: "A doubled letter — held, not said twice.",
    rows: [
      ["بَّ", "بِّ", "بُّ"],
      ["دَّ", "دِّ", "دُّ"],
      ["رَّ", "رِّ", "رُّ"],
      ["نَّ", "نِّ", "نُّ"],
    ],
  },
  {
    id: 14,
    title: "Shaddah with tanween",
    arabicTitle: "الشَّدَّةُ مَعَ التَّنْوِينِ",
    teaches: "A doubled letter carrying a doubled harakah at the end of a word.",
    rows: [
      ["بًّ", "بٍّ", "بٌّ"],
      ["حًّ", "حٍّ", "حٌّ"],
      ["صًّ", "صٍّ", "صٌّ"],
    ],
  },
  {
    id: 15,
    title: "Shaddah with madd",
    arabicTitle: "الشَّدَّةُ مَعَ الْمَدِّ",
    teaches: "A doubled letter followed by a stretch — the two rules in one word.",
    rows: [
      ["بَّا", "بِّي", "بُّو"],
      ["رَّا", "رِّي", "رُّو"],
      ["نَّا", "نِّي", "نُّو"],
    ],
  },
  {
    id: 16,
    title: "The rules of noon and meem",
    arabicTitle: "أَحْكَامُ النُّونِ وَالْمِيمِ",
    teaches:
      "What happens to a silent noon, a tanween and a silent meem depending on the letter that follows.",
    rows: [
      ["مِنْ رَبِّهِمْ", "مَنْ يَعْمَلْ"],
      ["أَنْبِئْهُمْ", "مِنْ بَعْدِ"],
      ["إِنَّ الْإِنْسَانَ", "ثُمَّ"],
      ["لَهُمْ مَا", "عَلَيْهِمْ بِـ"],
    ],
    note: "This lesson is where the Qa'idah meets Tajweed. Take it slowly, one rule at a time.",
  },
  {
    id: 17,
    title: "Reading from the Mushaf",
    arabicTitle: "التَّطْبِيقُ مِنَ الْمُصْحَفِ",
    teaches:
      "Putting all of it together on real ayahs, which is what the whole primer was for.",
    rows: [
      ["بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ"],
      ["الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ"],
      ["قُلْ هُوَ اللَّهُ أَحَدٌ"],
      ["إِنَّا أَعْطَيْنَاكَ الْكَوْثَرَ"],
    ],
    note: "From here the student moves into the Mushaf itself.",
  },
];

export function qaidahLesson(id: number): QaidahLesson | undefined {
  return QAIDAH_LESSONS.find((l) => l.id === id);
}
