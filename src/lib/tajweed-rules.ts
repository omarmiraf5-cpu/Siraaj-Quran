/**
 * Tajweed Rules Reference
 * Colors and definitions for Quranic recitation rules
 */

export interface TajweedRule {
  id: string;
  name: string;
  arabicName: string;
  color: string;
  bgColor: string;
  description: string;
  details: string;
  examples: string[];
}

export const TAJWEED_RULES: Record<string, TajweedRule> = {
  qalqalah: {
    id: "qalqalah",
    name: "Qalqalah",
    arabicName: "القلقلة",
    color: "text-red-600 dark:text-red-400",
    bgColor: "bg-red-100 dark:bg-red-950/40",
    description: "Heavy/Bouncing letters",
    details:
      "The letters ق, ط, ب, ج, د have a distinctive bouncy sound. They produce a bounce in the throat whether at the beginning, middle, or end of a word.",
    examples: ["ق", "ط", "ب", "ج", "د"],
  },
  ghunna: {
    id: "ghunna",
    name: "Ghunna",
    arabicName: "الغنة",
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-100 dark:bg-blue-950/40",
    description: "Nasal resonance (ن, م)",
    details:
      "A nasal sound produced by the letters ن (Noon) and م (Meem). The sound should resonate through the nose for about 2 beats.",
    examples: ["ن", "م"],
  },
  idgham: {
    id: "idgham",
    name: "Idgham",
    arabicName: "الإدغام",
    color: "text-amber-600 dark:text-amber-400",
    bgColor: "bg-amber-100 dark:bg-amber-950/40",
    description: "Merging of letters",
    details:
      "When two identical or similar letters meet, the first letter is merged into the second with emphasis on the second letter.",
    examples: ["مِمَّا", "يَقُولُ"],
  },
  iqlab: {
    id: "iqlab",
    name: "Iqlab",
    arabicName: "الإقلاب",
    color: "text-green-600 dark:text-green-400",
    bgColor: "bg-green-100 dark:bg-green-950/40",
    description: "Converting Noon/Meem before Ba",
    details:
      "When ن (Noon) or the final م (Meem) comes before ب (Ba), it is converted to م (Meem) with a full ghunna (2 beats).",
    examples: ["مِنْ بَعْدِ", "عَلَيْهِ مُّ"],
  },
  istihaaza: {
    id: "istihaaza",
    name: "Istithaala",
    arabicName: "الاستثقال",
    color: "text-purple-600 dark:text-purple-400",
    bgColor: "bg-purple-100 dark:bg-purple-950/40",
    description: "Difficult to pronounce letters",
    details:
      "Letters that are heavy and require extra care in pronunciation, including emphatic letters ص، ض، ط، ظ and others.",
    examples: ["ص", "ض", "ط", "ظ"],
  },
  tafkhim: {
    id: "tafkhim",
    name: "Tafkhim",
    arabicName: "التفخيم",
    color: "text-orange-600 dark:text-orange-400",
    bgColor: "bg-orange-100 dark:bg-orange-950/40",
    description: "Emphatic/Heavy pronunciation",
    details:
      "Certain letters are pronounced with the back of the tongue raised and emphasis. These include ص، ض، ط، ظ، ق، خ، غ، ل (in certain positions).",
    examples: ["ص", "ض", "ط", "ظ"],
  },
  hamza: {
    id: "hamza",
    name: "Hamza",
    arabicName: "الهمزة",
    color: "text-pink-600 dark:text-pink-400",
    bgColor: "bg-pink-100 dark:bg-pink-950/40",
    description: "Glottal stop",
    details:
      "A brief pause or stop in the throat before pronouncing a vowel. Must be pronounced clearly and distinctly.",
    examples: ["أ", "ؤ", "ئ", "ء"],
  },
  madda: {
    id: "madda",
    name: "Madda",
    arabicName: "المد",
    color: "text-indigo-600 dark:text-indigo-400",
    bgColor: "bg-indigo-100 dark:bg-indigo-950/40",
    description: "Elongation of vowel sound",
    details:
      "The vowel sound is elongated for 2-6 beats depending on the type of Madda and surrounding letters.",
    examples: ["آ", "اً", "يْ"],
  },
};

export function getTajweedRule(ruleId: string): TajweedRule | null {
  return TAJWEED_RULES[ruleId] || null;
}

export function getAllTajweedRules(): TajweedRule[] {
  return Object.values(TAJWEED_RULES);
}

/**
 * Map specific letters to their Tajweed rules
 * In a real implementation, this would analyze the diacritic marks
 */
export const LETTER_TO_RULES: Record<string, string[]> = {
  ق: ["qalqalah", "tafkhim"],
  ط: ["qalqalah", "tafkhim"],
  ب: ["qalqalah"],
  ج: ["qalqalah"],
  د: ["qalqalah"],
  ن: ["ghunna"],
  م: ["ghunna"],
  ص: ["tafkhim", "istihaaza"],
  ض: ["tafkhim", "istihaaza"],
  ظ: ["tafkhim", "istihaaza"],
  غ: ["tafkhim"],
  خ: ["tafkhim"],
  ل: ["tafkhim"], // in certain positions
  ء: ["hamza"],
  أ: ["hamza"],
  ؤ: ["hamza"],
  ئ: ["hamza"],
};

export function getLetterRules(letter: string): TajweedRule[] {
  const ruleIds = LETTER_TO_RULES[letter] || [];
  return ruleIds
    .map((id) => getTajweedRule(id))
    .filter((rule): rule is TajweedRule => rule !== null);
}
