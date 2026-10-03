// Ahsanul Qawaid — the primer a child works through before they can read the
// Mushaf. Twenty-nine lessons, numbered as in the printed book, so a child
// with the book in hand and a teacher on this page are on the same lesson.
//
// The content here is the Arabic itself: letters, their joined forms, the
// harakat and the rules, written the way the book writes them (the Indo-Pak
// style: a jazm on the madd letters, the standing harakat, an alif carrying
// the hamza's harakah). There is no translation to make of a letter, so each
// lesson carries an English name and an explanation of what is being learnt
// rather than a rendering of the rows.

import { surahRows, together as shapes, type QaidahBook, type QaidahLesson } from "./types";

const LESSONS: QaidahLesson[] = [
  {
    id: 1,
    title: "The single letters",
    arabicTitle: "الْحُرُوفُ الْمُفْرَدَةُ",
    teaches:
      "The twenty-nine letters on their own, each said by its name — alif, baa, taa — from its right place in the mouth.",
    rows: [
      ["ا", "ب", "ت", "ث", "ج", "ح", "خ"],
      ["د", "ذ", "ر", "ز", "س", "ش", "ص"],
      ["ض", "ط", "ظ", "ع", "غ", "ف", "ق"],
      ["ك", "ل", "م", "ن", "و", "ه", "ء", "ي"],
    ],
    note: "Don't move on until every letter is clear on its own. Listen for the ones children mix up: ح and ه, ع and ء, س and ص, ت and ط, د and ض, ذ ز and ظ, ك and ق.",
  },
  {
    id: 2,
    title: "The shapes of the letters",
    arabicTitle: "أَشْكَالُ الْحُرُوفِ",
    teaches:
      "Most letters change shape at the start, in the middle and at the end of a word, and stay the same letter. Six letters — ا د ذ ر ز و — never join to the letter after them, so they have only two shapes.",
    rows: [
      [shapes("بـ", "ـبـ", "ـب"), shapes("تـ", "ـتـ", "ـت"), shapes("ثـ", "ـثـ", "ـث")],
      [shapes("جـ", "ـجـ", "ـج"), shapes("حـ", "ـحـ", "ـح"), shapes("خـ", "ـخـ", "ـخ")],
      [shapes("سـ", "ـسـ", "ـس"), shapes("شـ", "ـشـ", "ـش"), shapes("صـ", "ـصـ", "ـص")],
      [shapes("ضـ", "ـضـ", "ـض"), shapes("طـ", "ـطـ", "ـط"), shapes("ظـ", "ـظـ", "ـظ")],
      [shapes("عـ", "ـعـ", "ـع"), shapes("غـ", "ـغـ", "ـغ"), shapes("فـ", "ـفـ", "ـف")],
      [shapes("قـ", "ـقـ", "ـق"), shapes("كـ", "ـكـ", "ـك"), shapes("لـ", "ـلـ", "ـل")],
      [shapes("مـ", "ـمـ", "ـم"), shapes("نـ", "ـنـ", "ـن"), shapes("هـ", "ـهـ", "ـه")],
      [shapes("يـ", "ـيـ", "ـي"), "لا"],
      [shapes("ا", "ـا"), shapes("د", "ـد"), shapes("ذ", "ـذ"), shapes("ر", "ـر"), shapes("ز", "ـز"), shapes("و", "ـو")],
    ],
    note: "Have the child find the dots: the shape changes, the dots don't. ل and ا written together make لا.",
  },
  {
    id: 3,
    title: "Joined letters",
    arabicTitle: "الْحُرُوفُ الْمُرَكَّبَةُ",
    teaches:
      "Two or three letters joined together, read by naming each letter from right to left: بسم is baa, seen, meem.",
    rows: [
      ["لا", "لب", "لت", "لث", "لج", "لح"],
      ["بسم", "قلم", "علم", "خلق", "جعل", "نعم"],
      ["كتب", "فتح", "نصر", "ذهب", "سمع", "شرب"],
      ["صبر", "ظلم", "غفر", "طلب", "ضرب", "حفظ"],
      ["ولد", "زرع", "يد", "دم", "وجد", "يسر"],
    ],
    note: "Point to each letter as it's named. If a child stalls, cover the rest of the word and show one letter at a time.",
  },
  {
    id: 4,
    title: "Fathah (zabar)",
    arabicTitle: "الْفَتْحَةُ",
    teaches:
      "A short slanting line above a letter is a fathah. It gives the letter a short “a” sound: بَ is “ba”.",
    rows: [
      ["اَ", "بَ", "تَ", "ثَ", "جَ", "حَ", "خَ"],
      ["دَ", "ذَ", "رَ", "زَ", "سَ", "شَ", "صَ"],
      ["ضَ", "طَ", "ظَ", "عَ", "غَ", "فَ", "قَ"],
      ["كَ", "لَ", "مَ", "نَ", "وَ", "هَ", "ءَ", "يَ"],
      ["خَلَقَ", "جَعَلَ", "كَتَبَ", "فَتَحَ"],
      ["نَصَرَ", "ذَهَبَ", "اَمَرَ", "صَبَرَ"],
    ],
    note: "Spell it out the way the book does — “alif zabar a, baa zabar ba” — then read the words without spelling. One short count; no stretching.",
  },
  {
    id: 5,
    title: "Kasrah (zer)",
    arabicTitle: "الْكَسْرَةُ",
    teaches: "A short line below a letter is a kasrah. It gives a short “i” sound: بِ is “bi”.",
    rows: [
      ["اِ", "بِ", "تِ", "ثِ", "جِ", "حِ", "خِ"],
      ["دِ", "ذِ", "رِ", "زِ", "سِ", "شِ", "صِ"],
      ["ضِ", "طِ", "ظِ", "عِ", "غِ", "فِ", "قِ"],
      ["كِ", "لِ", "مِ", "نِ", "وِ", "هِ", "ءِ", "يِ"],
      ["عَلِمَ", "سَمِعَ", "عَمِلَ", "رَحِمَ"],
      ["شَرِبَ", "حَفِظَ", "خَسِرَ", "لَبِثَ"],
    ],
    note: "Once the rows are easy, mix fathah and kasrah out of order — بَ بِ تِ تَ — so the child is reading the mark, not remembering the row.",
  },
  {
    id: 6,
    title: "Dammah (pesh)",
    arabicTitle: "الضَّمَّةُ",
    teaches:
      "A small waw above a letter is a dammah. It gives a short “u” sound: بُ is “bu”. Then all three harakat together.",
    rows: [
      ["اُ", "بُ", "تُ", "ثُ", "جُ", "حُ", "خُ"],
      ["دُ", "ذُ", "رُ", "زُ", "سُ", "شُ", "صُ"],
      ["ضُ", "طُ", "ظُ", "عُ", "غُ", "فُ", "قُ"],
      ["كُ", "لُ", "مُ", "نُ", "وُ", "هُ", "ءُ", "يُ"],
      ["بُ", "بَ", "بِ", "لِ", "لُ", "لَ"],
      ["كُتِبَ", "خُلِقَ", "ذُكِرَ", "جُعِلَ"],
      ["رُسُلُ", "كُتُبُ", "اُذُنُ", "عُنُقُ"],
    ],
    note: "The mixed row has no pattern on purpose. If the child guesses, slow down: every harakah is one short count.",
  },
  {
    id: 7,
    title: "Two fathahs (tanween)",
    arabicTitle: "الْفَتْحَتَانِ",
    teaches:
      "Two fathahs (do zabar) read “an” — a short “a” with an “n” after it, though no noon is written: بً is “ban”.",
    rows: [
      ["اً", "بً", "تً", "ثً", "جً", "حً", "خً"],
      ["دً", "ذً", "رً", "زً", "سً", "شً", "صً"],
      ["ضً", "طً", "ظً", "عً", "غً", "فً", "قً"],
      ["كً", "لً", "مً", "نً", "وً", "هً", "ءً", "يً"],
      ["اَحَدًا", "اَبَدًا", "وَلَدًا", "عَدَدًا"],
      ["شَجَرَةً", "ثَمَرَةً", "بَقَرَةً", "وَرَقَةً"],
    ],
    note: "In words, two fathahs usually sit before an alif that isn't read: اَحَدًا is “ahadan”. The round taa, ة, reads like ت.",
  },
  {
    id: 8,
    title: "Two kasrahs (tanween)",
    arabicTitle: "الْكَسْرَتَانِ",
    teaches: "Two kasrahs (do zer) below a letter read “in”: بٍ is “bin”.",
    rows: [
      ["اٍ", "بٍ", "تٍ", "ثٍ", "جٍ", "حٍ", "خٍ"],
      ["دٍ", "ذٍ", "رٍ", "زٍ", "سٍ", "شٍ", "صٍ"],
      ["ضٍ", "طٍ", "ظٍ", "عٍ", "غٍ", "فٍ", "قٍ"],
      ["كٍ", "لٍ", "مٍ", "نٍ", "وٍ", "هٍ", "ءٍ", "يٍ"],
      ["اَحَدٍ", "بَلَدٍ", "عَمَدٍ", "مَسَدٍ"],
      ["لَهَبٍ", "ذَهَبٍ", "حَسَنَةٍ", "شَجَرَةٍ"],
    ],
    note: "Keep the “n” light and short — the same sound as the last lesson, with an “i”.",
  },
  {
    id: 9,
    title: "Two dammahs (tanween)",
    arabicTitle: "الضَّمَّتَانِ",
    teaches:
      "Two dammahs (do pesh) read “un”: بٌ is “bun”. The last row mixes all six marks.",
    rows: [
      ["اٌ", "بٌ", "تٌ", "ثٌ", "جٌ", "حٌ", "خٌ"],
      ["دٌ", "ذٌ", "رٌ", "زٌ", "سٌ", "شٌ", "صٌ"],
      ["ضٌ", "طٌ", "ظٌ", "عٌ", "غٌ", "فٌ", "قٌ"],
      ["كٌ", "لٌ", "مٌ", "نٌ", "وٌ", "هٌ", "ءٌ", "يٌ"],
      ["اَحَدٌ", "بَشَرٌ", "قَمَرٌ", "مَلَكٌ"],
      ["عَمَلٌ", "رُسُلٌ", "كُتُبٌ", "حَسَنَةٌ"],
      ["بٌ", "بً", "بٍ", "بُ", "بَ", "بِ"],
    ],
    note: "Once all six marks come quickly, the child can read any word made of short vowels. Go back over lessons 4 to 9 together before moving on.",
  },
  {
    id: 10,
    title: "The madd letters: alif",
    arabicTitle: "حُرُوفُ الْمَدِّ: الْأَلِفُ",
    teaches:
      "Alif, waw and yaa are the madd letters: they stretch the sound before them. This lesson is alif. An alif with no mark of its own, after a fathah, stretches the “a” for two counts: بَا is “baa”.",
    rows: [
      ["بَ", "بَا", "تَ", "تَا", "مَ", "مَا"],
      ["بَا", "تَا", "ثَا", "جَا", "حَا", "خَا"],
      ["دَا", "ذَا", "رَا", "زَا", "سَا", "شَا"],
      ["صَا", "ضَا", "طَا", "ظَا", "عَا", "غَا"],
      ["فَا", "قَا", "كَا", "لَا", "مَا", "نَا"],
      ["وَا", "هَا", "يَا"],
      ["قَالَ", "كَانَ", "نَارٌ", "مَالٌ"],
      ["بَابٌ", "عَالِمٌ", "ظَالِمٌ", "صَادِقٌ"],
    ],
    note: "Two counts, evenly — no more. Start with the first row, بَ then بَا, until the child hears the difference.",
  },
  {
    id: 11,
    title: "Standing fathah (khari zabar)",
    arabicTitle: "الْفَتْحَةُ الْقَائِمَةُ",
    teaches:
      "A small upright alif above a letter reads exactly as if a full alif came after it: بٰ is “baa”, stretched two counts.",
    rows: [
      ["اٰ", "بٰ", "تٰ", "ثٰ", "جٰ", "حٰ", "خٰ"],
      ["دٰ", "ذٰ", "رٰ", "زٰ", "سٰ", "شٰ", "صٰ"],
      ["ضٰ", "طٰ", "ظٰ", "عٰ", "غٰ", "فٰ", "قٰ"],
      ["كٰ", "لٰ", "مٰ", "نٰ", "وٰ", "هٰ", "يٰ"],
      ["هٰذَا", "ذٰلِكَ", "اِلٰهٌ", "كِتٰبٌ"],
      ["اٰدَمُ", "مٰلِكِ", "ثَلٰثَةٌ", "سَمٰوٰتٌ"],
    ],
    note: "هٰذَا sounds just like هَاذَا. The Qur'an often writes the standing fathah where the alif isn't written in full.",
  },
  {
    id: 12,
    title: "Standing kasrah and upside-down dammah",
    arabicTitle: "الْكَسْرَةُ الْقَائِمَةُ وَالضَّمَّةُ الْمَقْلُوبَةُ",
    teaches:
      "An upright kasrah below a letter (khari zer) reads “ee”, and an upside-down dammah (ulta pesh) reads “oo”, each stretched two counts: بٖ is “bee”, بٗ is “boo”.",
    rows: [
      ["بٖ", "تٖ", "ثٖ", "جٖ", "حٖ", "خٖ"],
      ["دٖ", "سٖ", "عٖ", "لٖ", "مٖ", "هٖ"],
      ["بٗ", "تٗ", "ثٗ", "جٗ", "حٗ", "خٗ"],
      ["دٗ", "سٗ", "عٗ", "لٗ", "مٗ", "هٗ"],
      ["بٰ", "بٖ", "بٗ", "هٰ", "هٖ", "هٗ"],
      ["بِهٖ", "لَهٗ", "كِتٰبِهٖ", "عِبَادِهٖ"],
      ["خَلَقَهٗ", "اَمَرَهٗ", "مَالَهٗ", "كِتٰبَهٗ"],
    ],
    note: "In the Qur'an these mostly sit on the ه of “his” and “him”: لَهٗ is “lahoo”, بِهٖ is “bihee”.",
  },
  {
    id: 13,
    title: "Waw leen: the soft waw",
    arabicTitle: "وَاوُ اللِّينِ",
    teaches:
      "A waw with a jazm after a fathah is soft: read it quickly, gliding, without stretching. بَوْ is “baw”.",
    rows: [
      ["اَوْ", "بَوْ", "تَوْ", "ثَوْ", "جَوْ", "حَوْ"],
      ["خَوْ", "دَوْ", "ذَوْ", "رَوْ", "زَوْ", "سَوْ"],
      ["شَوْ", "صَوْ", "ضَوْ", "طَوْ", "ظَوْ", "عَوْ"],
      ["غَوْ", "فَوْ", "قَوْ", "كَوْ", "لَوْ", "مَوْ"],
      ["نَوْ", "هَوْ", "يَوْ"],
      ["قَوْمٌ", "يَوْمٌ", "خَوْفٌ", "مَوْتٌ"],
      ["لَوْ", "اَوْ", "فَوْقَ", "سَوْفَ"],
    ],
    note: "The jazm is new here: it means the waw has no vowel of its own. One quick sound, with the lips rounding at the end.",
  },
  {
    id: 14,
    title: "Waw madd: jazm on waw",
    arabicTitle: "وَاوُ الْمَدِّ",
    teaches:
      "A waw with a jazm after a dammah is a madd letter: it stretches the “u” for two counts. بُوْ is “boo”.",
    rows: [
      ["اُوْ", "بُوْ", "تُوْ", "ثُوْ", "جُوْ", "حُوْ"],
      ["خُوْ", "دُوْ", "ذُوْ", "رُوْ", "زُوْ", "سُوْ"],
      ["شُوْ", "صُوْ", "ضُوْ", "طُوْ", "ظُوْ", "عُوْ"],
      ["غُوْ", "فُوْ", "قُوْ", "كُوْ", "لُوْ", "مُوْ"],
      ["نُوْ", "هُوْ", "يُوْ"],
      ["بَوْ", "بُوْ", "قَوْ", "قُوْ", "نَوْ", "نُوْ"],
      ["نُوْرٌ", "نُوْحٌ", "يَقُوْلُ", "يَكُوْنُ"],
      ["رَسُوْلٌ", "يُوْسُفُ", "قُلُوْبٌ", "سُوْرَةٌ"],
    ],
    note: "The row of pairs puts it beside the last lesson: بَوْ is soft and short, بُوْ is stretched. The harakah before the waw decides which.",
  },
  {
    id: 15,
    title: "Yaa leen: the soft yaa",
    arabicTitle: "يَاءُ اللِّينِ",
    teaches:
      "A yaa with a jazm after a fathah is soft: read it quickly, gliding. بَيْ is “bay”.",
    rows: [
      ["اَيْ", "بَيْ", "تَيْ", "ثَيْ", "جَيْ", "حَيْ"],
      ["خَيْ", "دَيْ", "ذَيْ", "رَيْ", "زَيْ", "سَيْ"],
      ["شَيْ", "صَيْ", "ضَيْ", "طَيْ", "ظَيْ", "عَيْ"],
      ["غَيْ", "فَيْ", "قَيْ", "كَيْ", "لَيْ", "مَيْ"],
      ["نَيْ", "هَيْ", "وَيْ"],
      ["بَيْتٌ", "عَيْنٌ", "خَيْرٌ", "شَيْءٌ"],
      ["كَيْفَ", "عَلَيْكَ", "اِلَيْكَ", "وَيْلٌ"],
    ],
    note: "Waw and yaa after a fathah are the two leen letters, and neither is stretched.",
  },
  {
    id: 16,
    title: "Yaa madd: jazm on yaa",
    arabicTitle: "يَاءُ الْمَدِّ",
    teaches:
      "A yaa with a jazm after a kasrah is a madd letter: it stretches the “i” for two counts. بِيْ is “bee”.",
    rows: [
      ["اِيْ", "بِيْ", "تِيْ", "ثِيْ", "جِيْ", "حِيْ"],
      ["خِيْ", "دِيْ", "ذِيْ", "رِيْ", "زِيْ", "سِيْ"],
      ["شِيْ", "صِيْ", "ضِيْ", "طِيْ", "ظِيْ", "عِيْ"],
      ["غِيْ", "فِيْ", "قِيْ", "كِيْ", "لِيْ", "مِيْ"],
      ["نِيْ", "هِيْ", "وِيْ"],
      ["بَيْ", "بِيْ", "عَيْ", "عِيْ", "لَيْ", "لِيْ"],
      ["فِيْ", "دِيْنٌ", "قِيْلَ", "كَرِيْمٌ"],
      ["رَحِيْمٌ", "عَظِيْمٌ", "سَبِيْلٌ", "كَثِيْرٌ"],
      ["بَا", "بُوْ", "بِيْ", "نَا", "نُوْ", "نِيْ"],
    ],
    note: "All three madd letters are known now — alif after a fathah, waw after a dammah, yaa after a kasrah — each two counts. The last row puts them side by side.",
  },
  {
    id: 17,
    title: "Jazm (sukoon)",
    arabicTitle: "السُّكُونُ",
    teaches:
      "A jazm on any letter means it has no vowel: join it to the letter before and stop it cleanly. اَبْ is “ab”.",
    rows: [
      ["اَبْ", "اَتْ", "اَثْ", "اَجْ", "اَحْ", "اَخْ"],
      ["اَدْ", "اَذْ", "اَرْ", "اَزْ", "اَسْ", "اَشْ"],
      ["اَصْ", "اَضْ", "اَطْ", "اَظْ", "اَعْ", "اَغْ"],
      ["اَفْ", "اَقْ", "اَكْ", "اَلْ", "اَمْ", "اَنْ"],
      ["اَهْ", "اِبْ", "اُبْ", "اِذْ", "اُمْ", "اِنْ"],
      ["قُلْ", "لَمْ", "مِنْ", "عَنْ"],
      ["هَلْ", "قَدْ", "اَنْتَ", "يَعْلَمُ"],
      ["اَرْضٌ", "شَمْسٌ", "مَسْجِدٌ", "تَجْرِيْ"],
    ],
    note: "Don't add a little vowel after the jazm letter. Five letters — ق ط ب ج د — bounce slightly when they carry a jazm (qalqalah): اَقْ اَطْ اَبْ اَجْ اَدْ.",
  },
  {
    id: 18,
    title: "Letters written but not read",
    arabicTitle: "حُرُوفٌ تُكْتَبُ وَلَا تُقْرَأُ",
    teaches:
      "Some letters are written but not read. A letter with no mark at all is usually silent: read straight past it.",
    readings: [
      {
        words: [
          ["قَالُوْا", "قَالُوْ"],
          ["عَلٰى", "عَلَا"],
          ["صَلٰوةٌ", "صَلَاةٌ"],
          ["وَالْعَصْرِ", "وَلْعَصْرِ"],
        ],
      },
    ],
    rows: [
      ["قَالُوْا", "كَانُوْا", "اٰمَنُوْا", "عَمِلُوْا"],
      ["عَلٰى", "اِلٰى", "مُوْسٰى", "عِيْسٰى"],
      ["صَلٰوةٌ", "زَكٰوةٌ", "مِشْكٰوةٌ"],
      ["وَالْعَصْرِ", "وَالْفَجْرِ", "بِالْقَلَمِ", "وَالْقَمَرِ"],
    ],
    note: "The alif after a waw at the end of a verb (قَالُوْا) is never read. In وَالْعَصْرِ the alif is skipped because the word before it ends on a vowel.",
  },
  {
    id: 19,
    title: "Alif with a jazm (hamza)",
    arabicTitle: "الْهَمْزَةُ السَّاكِنَةُ",
    teaches:
      "An alif with a jazm on it is read as a hamza: a short catch in the throat. يَاْكُلُ is “ya'kulu”. The hamza can sit on a waw or a yaa too: يُؤْمِنُ, بِئْسَ.",
    rows: [
      ["بَاْ", "فَاْ", "مَاْ", "يَاْ"],
      ["بِئْ", "ذِئْ", "يُؤْ", "مُؤْ"],
      ["يَاْكُلُ", "يَاْتِيْ", "تَاْمُرُ", "مَاْكُوْلٍ"],
      ["اِقْرَاْ", "يَاْجُوْجُ", "مَاْجُوْجُ", "فَاْتُوْا"],
      ["يُؤْمِنُ", "مُؤْمِنٌ", "بِئْسَ", "ذِئْبٌ"],
    ],
    note: "Don't stretch it: an alif with a jazm is not a madd letter. Catch the sound briefly, then move on.",
  },
  {
    id: 20,
    title: "Shaddah (tashdeed)",
    arabicTitle: "التَّشْدِيدُ",
    teaches:
      "A shaddah doubles a letter: read it once with a jazm, joined to the letter before, then again with its own harakah. اَبَّ is “ab-ba”.",
    rows: [
      ["اَبَّ", "اَبِّ", "اَبُّ", "اَتَّ", "اَتِّ", "اَتُّ"],
      ["اَجَّ", "اَدَّ", "اَرَّ", "اَسَّ", "اَصَّ", "اَطَّ"],
      ["اَعَّ", "اَفَّ", "اَقَّ", "اَلَّ", "اَمَّ", "اَنَّ"],
      ["رَبِّ", "ثُمَّ", "كُلُّ", "مُحَمَّدٌ"],
      ["اِنَّ", "اَنَّ", "عَلَّمَ", "يُعَلِّمُ"],
    ],
    note: "Press on the letter rather than saying it twice with a gap. A noon or meem with a shaddah always has a ghunnah, a two-count hum through the nose: اِنَّ, ثُمَّ.",
  },
  {
    id: 21,
    title: "Shaddah in words, and the sun letters",
    arabicTitle: "تَمْرِينُ التَّشْدِيدِ",
    teaches:
      "The shaddah in longer words, and after ال: before a sun letter the ل is written but not read, and the letter after it takes a shaddah instead.",
    rows: [
      ["تَبَّتْ", "فَصَلِّ", "لِرَبِّكَ", "يُكَذِّبُ"],
      ["مُطَهَّرَةٌ", "سُجِّرَتْ", "كُوِّرَتْ", "عُطِّلَتْ"],
      ["وَالشَّمْسِ", "وَالضُّحٰى", "وَالشَّفْعِ", "وَالصُّبْحِ"],
      ["اَلرَّحْمٰنِ", "اَلرَّحِيْمِ", "اَلصِّرَاطَ", "اَلشَّيْطٰنِ"],
    ],
    note: "وَالشَّمْسِ is “wash-shamsi”, with no ل. Compare a moon letter, where the ل is read with its jazm: وَالْقَمَرِ.",
  },
  {
    id: 22,
    title: "Madd: the long stretch",
    arabicTitle: "الْمَدُّ",
    teaches:
      "A wavy line above a madd letter — the madd sign — means stretch it longer than two counts: four or five before a hamza, and six before a shaddah or a jazm.",
    rows: [
      ["جَآءَ", "شَآءَ", "سَمَآءٌ", "مَآءٌ"],
      ["هٰٓؤُلَآءِ", "اُولٰٓئِكَ", "اَلسُّفَهَآءُ"],
      ["بِمَآ اُنْزِلَ", "اِنَّآ اَنْزَلْنٰهُ"],
      ["وَمَآ اَدْرٰىكَ", "يٰٓاَيُّهَا"],
      ["وَلَا الضَّآلِّيْنَ", "دَآبَّةٍ", "اَلْحَآقَّةُ"],
      ["الٓمّٓ", "حٰمٓ", "يٰسٓ", "طٰهٰ"],
    ],
    note: "Count on your fingers together. The letters that open some surahs (الٓمّٓ, حٰمٓ) are read by their names, and a madd sign on one of them is six counts.",
  },
  {
    id: 23,
    title: "Shaddah with madd",
    arabicTitle: "التَّشْدِيدُ مَعَ الْمَدِّ",
    teaches:
      "A letter with a shaddah followed by a madd letter: press the doubled letter, then stretch two counts. اَبَّا is “ab-baa”.",
    rows: [
      ["اَبَّا", "اَبِّيْ", "اَبُّوْ", "اَنَّا", "اَنِّيْ", "اَنُّوْ"],
      ["اَرَّا", "اَرِّيْ", "اَرُّوْ", "اَلَّا", "اَلِّيْ", "اَلُّوْ"],
      ["اِيَّاكَ", "اَلنَّاسِ", "كَلَّا", "تَوَّابًا"],
      ["اِنِّيْ", "يُحِبُّوْنَ", "يُصَلُّوْنَ", "حَتّٰى"],
    ],
    note: "Two rules at once: don't rush the shaddah to get to the stretch.",
  },
  {
    id: 24,
    title: "Alif at the end of a word",
    arabicTitle: "الْأَلِفُ فِي آخِرِ الْكَلِمَةِ",
    teaches:
      "An alif at the end of a word stretches the fathah before it for two counts. Hear the difference between a plain fathah at the end and a fathah with an alif: قَالَ, قَالَا.",
    rows: [
      ["بَ", "بَا", "نَ", "نَا", "هَ", "هَا"],
      ["قَالَ", "قَالَا", "كَانَ", "كَانَا"],
      ["لَنَا", "مَعَنَا", "رَبَّنَا", "عَلَيْنَا"],
      ["بِمَا", "كَمَا", "فِيْهَا", "مِنْهَا"],
    ],
    note: "Children often drop the final alif, or stretch a plain fathah. Read the pairs one after the other until the difference is clear.",
  },
  {
    id: 25,
    title: "Tanween before a shaddah",
    arabicTitle: "التَّنْوِينُ قَبْلَ التَّشْدِيدِ",
    teaches:
      "When tanween comes before a letter with a shaddah, its “n” merges into that letter: خَيْرًا يَّرَهٗ is “khayray-yarah”.",
    rows: [
      ["خَيْرًا يَّرَهٗ", "شَرًّا يَّرَهٗ"],
      ["هُدًى لِّلْمُتَّقِيْنَ", "غَفُوْرٌ رَّحِيْمٌ"],
      ["عِيْشَةٍ رَّاضِيَةٍ", "عَمَدٍ مُّمَدَّدَةٍ"],
      ["رَسُوْلٌ مِّنَ اللّٰهِ", "يَوْمَئِذٍ نَّاعِمَةٌ"],
    ],
    note: "Before ي ن م و the merge keeps a two-count hum through the nose (ghunnah). Before ل and ر there is none.",
  },
  {
    id: 26,
    title: "Jazm before a shaddah",
    arabicTitle: "السُّكُونُ قَبْلَ التَّشْدِيدِ",
    teaches:
      "When a letter with a jazm comes before a letter with a shaddah, the jazm letter isn't read on its own — go straight into the doubled letter. قَدْ تَّبَيَّنَ is “qat-tabayyana”.",
    rows: [
      ["مَنْ يَّعْمَلْ", "مِنْ رَّبِّهِمْ"],
      ["مِنْ مَّسَدٍ", "مِنْ نُّوْرٍ"],
      ["قَدْ تَّبَيَّنَ", "قُلْ رَّبِّ"],
      ["بَلْ رَّفَعَهُ", "عَبَدْتُّمْ"],
    ],
    note: "A noon with a jazm keeps its hum before ي ن م و (مَنْ يَّعْمَلْ) and loses it completely before ل and ر (مِنْ رَّبِّهِمْ).",
  },
  {
    id: 27,
    title: "Shaddah, tanween and jazm together",
    arabicTitle: "التَّشْدِيدُ وَالتَّنْوِينُ وَالسُّكُونُ",
    teaches:
      "Everything so far in the same words, ending with Surah al-Ikhlas.",
    rows: [
      ["حَقٌّ", "عَدُوٌّ", "شَرًّا", "سِرًّا"],
      ["مُحَمَّدٌ رَّسُوْلُ اللّٰهِ"],
      ["قُلْ هُوَ اللّٰهُ اَحَدٌ"],
      ["اَللّٰهُ الصَّمَدُ"],
      ["لَمْ يَلِدْ وَلَمْ يُوْلَدْ"],
      ["وَلَمْ يَكُنْ لَّهٗ كُفُوًا اَحَدٌ"],
    ],
    rowLabels: { 2: "Surah al-Ikhlas" },
    ayahs: surahRows(2, 112, 4),
    note: "Read slowly and name each rule as you meet it. This is the bridge from the Qa'idah into the Qur'an.",
  },
  {
    id: 28,
    title: "Iqlab: noon read as meem",
    arabicTitle: "الْإِقْلَابُ",
    teaches:
      "When a noon with a jazm, or a tanween, comes before ب, it is read as a meem with a two-count hum. A small meem is written above it: مِنۢ بَعْدِ is “mim ba'di”.",
    rows: [
      ["مِنۢ بَعْدِ", "اَنۢبِئْهُمْ"],
      ["لَيُنۢبَذَنَّ", "مِنۢ بَيْنِ"],
      ["سَمِيْعٌۢ بَصِيْرٌ", "عَلِيْمٌۢ بِذَاتِ الصُّدُوْرِ"],
    ],
    note: "Close the lips gently for the meem and hold the hum before the ب.",
  },
  {
    id: 29,
    title: "Noon qutni and stopping (waqf)",
    arabicTitle: "النُّونُ الْقُطْنِيُّ وَالْوَقْفُ",
    teaches:
      "Noon qutni: when tanween is followed by a word that starts with a silent alif, a small noon with a kasrah joins the two (the Indo-Pak Qur'an prints it under the gap). Waqf: how to stop at the end of a word, and the signs that say where.",
    readings: [
      {
        label: "Noon qutni: tanween joined to the next word",
        words: [
          ["نُوْحٌ ابْنَهٗ", "نُوْحُ نِبْنَهٗ"],
          ["خَيْرًا الْوَصِيَّةُ", "خَيْرَ نِلْوَصِيَّةُ"],
          ["قَدِيْرٌ الَّذِيْ", "قَدِيْرُ نِلَّذِيْ"],
        ],
      },
      {
        label: "Waqf: stopping at the end of a word",
        words: [
          ["اَلرَّحِيْمِ", "اَلرَّحِيْمْ"],
          ["اَحَدٌ", "اَحَدْ"],
          ["عَلِيْمًا", "عَلِيْمَا"],
          ["رَحْمَةٌ", "رَحْمَهْ"],
        ],
      },
    ],
    rows: [["۝", "م", "ط", "ج", "ز", "ص", "ق", "لا"]],
    note: "When you stop, the last harakah becomes a jazm, two fathahs become a stretched alif, and ة becomes ه. The signs: ۝ end of an ayah; م must stop; ط stop; ج stopping is better; ز joining is better; ص stop only if out of breath; ق joining is better; لا don't stop.",
  },
];

export const AHSANUL_QAWAID: QaidahBook = {
  id: "ahsanul_qawaid",
  name: "Ahsanul Qawaid",
  shortName: "Ahsanul Qawaid",
  arabicName: "أَحْسَنُ الْقَوَاعِدِ",
  summary:
    "The 29 lessons of Ahsanul Qawaid, numbered as in the book, from the letters to stopping at the end of an ayah. The Arabic is written the way the book writes it, in the Indo-Pak style.",
  lessons: LESSONS,
};
