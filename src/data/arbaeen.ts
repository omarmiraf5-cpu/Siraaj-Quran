// Al-Arba'un an-Nawawiyyah — the forty-two hadith gathered by Imam an-Nawawi
// (d. 676 AH), the collection most Islamic schools teach first.
//
// ─────────────────────────────────────────────────────────────────────────
// BEFORE THIS SHIPS TO A SCHOOL: the Arabic below must be checked, hadith by
// hadith, against a printed edition or a vetted digital source, and signed
// off by someone qualified. It was transcribed for this build and has not
// been through that check. A misplaced harakah changes a word; a dropped
// word changes a hadith. Everything else in this repository is a design
// decision that can be argued about — this is not.
//
// The English is a plain rendering written for this app rather than a
// reproduction of a published translation, to keep it clear of the rights
// attached to those editions.
// ─────────────────────────────────────────────────────────────────────────

export interface Hadith {
  number: number;
  /** The matn — the body of the hadith, without the chain. */
  arabic: string;
  /**
   * Plain English, written for a child reading on their own: short
   * sentences and everyday words. The Arabic is where the precision lives;
   * this is here so an eight-year-old can follow the meaning.
   */
  english: string;
  /**
   * The narration opening as it is printed — "عَنْ أَمِيرِ الْمُؤْمِنِينَ أَبِي حَفْصٍ
   * عُمَرَ بْنِ الْخَطَّابِ رَضِيَ اللَّهُ عَنْهُ قَالَ…" — which runs straight into the
   * matn. Kept as its own field rather than glued to the front of `arabic`
   * so the two can be styled apart and the matn stays quotable on its own.
   */
  isnad: string;
  isnadEn: string;
  /**
   * The closing line — رَوَاهُ مُسْلِمٌ and the like — as it is set after the
   * matn. Hadith 1 carries the long form the mutun print, naming both
   * imams down their full lineage.
   */
  attribution: string;
  attributionEn: string;
  /** Who narrated it, in English — the short form, for the card header. */
  narrator: string;
  /** Where it is collected — the short form, for the card header. */
  source: string;
  /** A short theme, used to group and colour the list. */
  theme: string;
  /** True for a hadith qudsi, which the list marks. */
  qudsi?: boolean;
}

export const ARBAEEN: Hadith[] = [
  {
    number: 1,
    arabic:
      "إِنَّمَا الْأَعْمَالُ بِالنِّيَّاتِ، وَإِنَّمَا لِكُلِّ امْرِئٍ مَا نَوَى، فَمَنْ كَانَتْ هِجْرَتُهُ إِلَى اللَّهِ وَرَسُولِهِ فَهِجْرَتُهُ إِلَى اللَّهِ وَرَسُولِهِ، وَمَنْ كَانَتْ هِجْرَتُهُ لِدُنْيَا يُصِيبُهَا أَوِ امْرَأَةٍ يَنْكِحُهَا فَهِجْرَتُهُ إِلَى مَا هَاجَرَ إِلَيْهِ",
    english:
      "Everything you do is counted by why you did it. Each person gets what they meant to get. So if you leave your home for Allah and His Messenger, that is what you get. And if you leave to gain something in this world, or to marry someone, then that is all you get.",
    isnad:
      "عَنْ أَمِيرِ الْمُؤْمِنِينَ أَبِي حَفْصٍ عُمَرَ بْنِ الْخَطَّابِ رَضِيَ اللَّهُ عَنْهُ قَالَ: سَمِعْتُ رَسُولَ اللَّهِ ﷺ يَقُولُ:",
    isnadEn:
      "On the authority of the Commander of the Faithful, Abu Hafs Umar ibn al-Khattab (may Allah be pleased with him), who said: I heard the Messenger of Allah ﷺ say:",
    narrator: "Umar ibn al-Khattab",
    attribution:
      "رَوَاهُ إِمَامَا الْمُحَدِّثِينَ أَبُو عَبْدِ اللهِ مُحَمَّدُ بْنُ إِسْمَاعِيلَ بْنِ إِبْرَاهِيمَ بْنِ الْمُغِيرَةِ بْنِ بَرْدِزْبَهْ الْبُخَارِيُّ، وَأَبُو الْحُسَيْنِ مُسْلِمُ بْنُ الْحَجَّاجِ بْنِ مُسْلِمٍ الْقُشَيْرِيُّ النَّيْسَابُورِيُّ، فِي صَحِيحَيْهِمَا اللَّذَيْنِ هُمَا أَصَحُّ الْكُتُبِ الْمُصَنَّفَةِ",
    attributionEn:
      "Reported by the two imams of hadith: Abu Abdillah Muhammad ibn Isma'il ibn Ibrahim ibn al-Mughirah ibn Bardizbah al-Bukhari, and Abu al-Husayn Muslim ibn al-Hajjaj ibn Muslim al-Qushayri an-Naysaburi, in their two Sahihs, which are the soundest of the books ever compiled.",
    source: "Bukhari & Muslim",
    theme: "Intention",
  },
  {
    number: 2,
    arabic:
      "أَنْ تَشْهَدَ أَنْ لَا إِلَهَ إِلَّا اللَّهُ وَأَنَّ مُحَمَّدًا رَسُولُ اللَّهِ، وَتُقِيمَ الصَّلَاةَ، وَتُؤْتِيَ الزَّكَاةَ، وَتَصُومَ رَمَضَانَ، وَتَحُجَّ الْبَيْتَ إِنِ اسْتَطَعْتَ إِلَيْهِ سَبِيلًا. قَالَ: فَأَخْبِرْنِي عَنِ الْإِيمَانِ. قَالَ: أَنْ تُؤْمِنَ بِاللَّهِ وَمَلَائِكَتِهِ وَكُتُبِهِ وَرُسُلِهِ وَالْيَوْمِ الْآخِرِ، وَتُؤْمِنَ بِالْقَدَرِ خَيْرِهِ وَشَرِّهِ. قَالَ: فَأَخْبِرْنِي عَنِ الْإِحْسَانِ. قَالَ: أَنْ تَعْبُدَ اللَّهَ كَأَنَّكَ تَرَاهُ، فَإِنْ لَمْ تَكُنْ تَرَاهُ فَإِنَّهُ يَرَاكَ",
    english:
      "Islam is to say that there is no god but Allah and that Muhammad is His Messenger, to pray, to give zakah, to fast in Ramadan, and to go to hajj if you are able. Faith is to believe in Allah, His angels, His books, His messengers, the Last Day, and that everything happens by His plan — the good and the hard. Excellence is to worship Allah as if you can see Him; and if you cannot see Him, know that He sees you.",
    isnad:
      "عَنْ عُمَرَ بْنِ الْخَطَّابِ رَضِيَ اللَّهُ عَنْهُ أَيْضًا قَالَ: بَيْنَمَا نَحْنُ جُلُوسٌ عِنْدَ رَسُولِ اللَّهِ ﷺ ذَاتَ يَوْمٍ، إِذْ طَلَعَ عَلَيْنَا رَجُلٌ شَدِيدُ بَيَاضِ الثِّيَابِ، شَدِيدُ سَوَادِ الشَّعَرِ، فَقَالَ: يَا مُحَمَّدُ أَخْبِرْنِي عَنِ الْإِسْلَامِ. قَالَ:",
    isnadEn:
      "Also on the authority of Umar ibn al-Khattab (may Allah be pleased with him), who said: While we were sitting with the Messenger of Allah ﷺ one day, a man came upon us in pure white garments with jet black hair, and said: O Muhammad, tell me about Islam. He said:",
    narrator: "Umar ibn al-Khattab",
    attribution:
      "رَوَاهُ مُسْلِمٌ",
    attributionEn:
      "Reported by Muslim.",
    source: "Muslim",
    theme: "Faith",
  },
  {
    number: 3,
    arabic:
      "بُنِيَ الْإِسْلَامُ عَلَى خَمْسٍ: شَهَادَةِ أَنْ لَا إِلَهَ إِلَّا اللَّهُ وَأَنَّ مُحَمَّدًا رَسُولُ اللَّهِ، وَإِقَامِ الصَّلَاةِ، وَإِيتَاءِ الزَّكَاةِ، وَحَجِّ الْبَيْتِ، وَصَوْمِ رَمَضَانَ",
    english:
      "Islam is built on five things: saying there is no god but Allah and that Muhammad is His Messenger, praying, giving zakah, going to hajj, and fasting in Ramadan.",
    isnad:
      "عَنْ أَبِي عَبْدِ الرَّحْمَنِ عَبْدِ اللَّهِ بْنِ عُمَرَ بْنِ الْخَطَّابِ رَضِيَ اللَّهُ عَنْهُمَا قَالَ: سَمِعْتُ رَسُولَ اللَّهِ ﷺ يَقُولُ:",
    isnadEn:
      "On the authority of Abu Abd ar-Rahman, Abdullah ibn Umar ibn al-Khattab (may Allah be pleased with them both), who said: I heard the Messenger of Allah ﷺ say:",
    narrator: "Abdullah ibn Umar",
    attribution:
      "رَوَاهُ الْبُخَارِيُّ وَمُسْلِمٌ",
    attributionEn:
      "Reported by al-Bukhari and Muslim.",
    source: "Bukhari & Muslim",
    theme: "Foundations",
  },
  {
    number: 4,
    arabic:
      "إِنَّ أَحَدَكُمْ يُجْمَعُ خَلْقُهُ فِي بَطْنِ أُمِّهِ أَرْبَعِينَ يَوْمًا نُطْفَةً، ثُمَّ يَكُونُ عَلَقَةً مِثْلَ ذَلِكَ، ثُمَّ يَكُونُ مُضْغَةً مِثْلَ ذَلِكَ، ثُمَّ يُرْسَلُ إِلَيْهِ الْمَلَكُ فَيَنْفُخُ فِيهِ الرُّوحَ، وَيُؤْمَرُ بِأَرْبَعِ كَلِمَاتٍ: بِكَتْبِ رِزْقِهِ وَأَجَلِهِ وَعَمَلِهِ وَشَقِيٍّ أَوْ سَعِيدٍ",
    english:
      "Each of you is put together inside your mother for forty days as a drop. Then you are a clinging shape for the same time. Then a little lump for the same time. Then Allah sends an angel who breathes the soul into you, and who is told to write four things: what you will be given, how long you will live, what you will do, and whether you will be sad or happy.",
    isnad:
      "عَنْ أَبِي عَبْدِ الرَّحْمَنِ عَبْدِ اللَّهِ بْنِ مَسْعُودٍ رَضِيَ اللَّهُ عَنْهُ قَالَ: حَدَّثَنَا رَسُولُ اللَّهِ ﷺ وَهُوَ الصَّادِقُ الْمَصْدُوقُ:",
    isnadEn:
      "On the authority of Abu Abd ar-Rahman, Abdullah ibn Mas'ud (may Allah be pleased with him), who said: The Messenger of Allah ﷺ, and he is the truthful and the trusted, narrated to us:",
    narrator: "Abdullah ibn Mas'ud",
    attribution:
      "رَوَاهُ الْبُخَارِيُّ وَمُسْلِمٌ",
    attributionEn:
      "Reported by al-Bukhari and Muslim.",
    source: "Bukhari & Muslim",
    theme: "Destiny",
  },
  {
    number: 5,
    arabic: "مَنْ أَحْدَثَ فِي أَمْرِنَا هَذَا مَا لَيْسَ مِنْهُ فَهُوَ رَدٌّ",
    english:
      "If someone adds something new to our religion that is not part of it, it is not accepted.",
    isnad:
      "عَنْ أُمِّ الْمُؤْمِنِينَ أُمِّ عَبْدِ اللَّهِ عَائِشَةَ رَضِيَ اللَّهُ عَنْهَا قَالَتْ: قَالَ رَسُولُ اللَّهِ ﷺ:",
    isnadEn:
      "On the authority of the Mother of the Believers, Umm Abdillah Aishah (may Allah be pleased with her), who said: The Messenger of Allah ﷺ said:",
    narrator: "Aishah",
    attribution:
      "رَوَاهُ الْبُخَارِيُّ وَمُسْلِمٌ",
    attributionEn:
      "Reported by al-Bukhari and Muslim.",
    source: "Bukhari & Muslim",
    theme: "Following the Sunnah",
  },
  {
    number: 6,
    arabic:
      "إِنَّ الْحَلَالَ بَيِّنٌ وَإِنَّ الْحَرَامَ بَيِّنٌ، وَبَيْنَهُمَا مُشْتَبِهَاتٌ لَا يَعْلَمُهُنَّ كَثِيرٌ مِنَ النَّاسِ، فَمَنِ اتَّقَى الشُّبُهَاتِ فَقَدِ اسْتَبْرَأَ لِدِينِهِ وَعِرْضِهِ… أَلَا وَإِنَّ فِي الْجَسَدِ مُضْغَةً إِذَا صَلَحَتْ صَلَحَ الْجَسَدُ كُلُّهُ، وَإِذَا فَسَدَتْ فَسَدَ الْجَسَدُ كُلُّهُ، أَلَا وَهِيَ الْقَلْبُ",
    english:
      "What is allowed is clear, and what is not allowed is clear. In between are things many people are not sure about. Whoever stays away from what he is unsure about keeps his religion and his good name safe. In the body there is a small piece of flesh: if it is good, the whole body is good; if it goes bad, the whole body goes bad. That piece is the heart.",
    isnad:
      "عَنْ أَبِي عَبْدِ اللَّهِ النُّعْمَانِ بْنِ بَشِيرٍ رَضِيَ اللَّهُ عَنْهُمَا قَالَ: سَمِعْتُ رَسُولَ اللَّهِ ﷺ يَقُولُ:",
    isnadEn:
      "On the authority of Abu Abdillah an-Nu'man ibn Bashir (may Allah be pleased with them both), who said: I heard the Messenger of Allah ﷺ say:",
    narrator: "an-Nu'man ibn Bashir",
    attribution:
      "رَوَاهُ الْبُخَارِيُّ وَمُسْلِمٌ",
    attributionEn:
      "Reported by al-Bukhari and Muslim.",
    source: "Bukhari & Muslim",
    theme: "The heart",
  },
  {
    number: 7,
    arabic:
      "الدِّينُ النَّصِيحَةُ. قُلْنَا: لِمَنْ؟ قَالَ: لِلَّهِ وَلِكِتَابِهِ وَلِرَسُولِهِ وَلِأَئِمَّةِ الْمُسْلِمِينَ وَعَامَّتِهِمْ",
    english:
      "The religion is giving good and honest advice. We asked: to whom? He said: to Allah, to His Book, to His Messenger, to the leaders of the Muslims, and to everyone.",
    isnad:
      "عَنْ أَبِي رُقَيَّةَ تَمِيمِ بْنِ أَوْسٍ الدَّارِيِّ رَضِيَ اللَّهُ عَنْهُ أَنَّ النَّبِيَّ ﷺ قَالَ:",
    isnadEn:
      "On the authority of Abu Ruqayyah Tamim ibn Aws ad-Dari (may Allah be pleased with him), that the Prophet ﷺ said:",
    narrator: "Tamim ad-Dari",
    attribution:
      "رَوَاهُ مُسْلِمٌ",
    attributionEn:
      "Reported by Muslim.",
    source: "Muslim",
    theme: "Sincerity",
  },
  {
    number: 8,
    arabic:
      "أُمِرْتُ أَنْ أُقَاتِلَ النَّاسَ حَتَّى يَشْهَدُوا أَنْ لَا إِلَهَ إِلَّا اللَّهُ وَأَنَّ مُحَمَّدًا رَسُولُ اللَّهِ، وَيُقِيمُوا الصَّلَاةَ، وَيُؤْتُوا الزَّكَاةَ، فَإِذَا فَعَلُوا ذَلِكَ عَصَمُوا مِنِّي دِمَاءَهُمْ وَأَمْوَالَهُمْ إِلَّا بِحَقِّ الْإِسْلَامِ، وَحِسَابُهُمْ عَلَى اللَّهِ",
    english:
      "I have been ordered to fight people until they say there is no god but Allah and that Muhammad is His Messenger, and they pray and give zakah. When they do that, their lives and their belongings are safe from me, except where Islam gives a right. Their account is with Allah.",
    isnad:
      "عَنِ ابْنِ عُمَرَ رَضِيَ اللَّهُ عَنْهُمَا أَنَّ رَسُولَ اللَّهِ ﷺ قَالَ:",
    isnadEn:
      "On the authority of Ibn Umar (may Allah be pleased with them both), that the Messenger of Allah ﷺ said:",
    narrator: "Abdullah ibn Umar",
    attribution:
      "رَوَاهُ الْبُخَارِيُّ وَمُسْلِمٌ",
    attributionEn:
      "Reported by al-Bukhari and Muslim.",
    source: "Bukhari & Muslim",
    theme: "Sanctity of life",
  },
  {
    number: 9,
    arabic:
      "مَا نَهَيْتُكُمْ عَنْهُ فَاجْتَنِبُوهُ، وَمَا أَمَرْتُكُمْ بِهِ فَأْتُوا مِنْهُ مَا اسْتَطَعْتُمْ، فَإِنَّمَا أَهْلَكَ الَّذِينَ مِنْ قَبْلِكُمْ كَثْرَةُ مَسَائِلِهِمْ وَاخْتِلَافُهُمْ عَلَى أَنْبِيَائِهِمْ",
    english:
      "Stay away from what I have told you not to do. And do what I have told you to do, as much as you can. The people before you were ruined because they asked too many questions and argued with their prophets.",
    isnad:
      "عَنْ أَبِي هُرَيْرَةَ عَبْدِ الرَّحْمَنِ بْنِ صَخْرٍ رَضِيَ اللَّهُ عَنْهُ قَالَ: سَمِعْتُ رَسُولَ اللَّهِ ﷺ يَقُولُ:",
    isnadEn:
      "On the authority of Abu Hurayrah, Abd ar-Rahman ibn Sakhr (may Allah be pleased with him), who said: I heard the Messenger of Allah ﷺ say:",
    narrator: "Abu Hurayrah",
    attribution:
      "رَوَاهُ الْبُخَارِيُّ وَمُسْلِمٌ",
    attributionEn:
      "Reported by al-Bukhari and Muslim.",
    source: "Bukhari & Muslim",
    theme: "Obedience",
  },
  {
    number: 10,
    arabic:
      "إِنَّ اللَّهَ طَيِّبٌ لَا يَقْبَلُ إِلَّا طَيِّبًا، وَإِنَّ اللَّهَ أَمَرَ الْمُؤْمِنِينَ بِمَا أَمَرَ بِهِ الْمُرْسَلِينَ",
    english:
      "Allah is pure, and He accepts only what is pure. Allah told the believers to do the same things He told the messengers to do.",
    isnad:
      "عَنْ أَبِي هُرَيْرَةَ رَضِيَ اللَّهُ عَنْهُ قَالَ: قَالَ رَسُولُ اللَّهِ ﷺ:",
    isnadEn:
      "On the authority of Abu Hurayrah (may Allah be pleased with him), who said: The Messenger of Allah ﷺ said:",
    narrator: "Abu Hurayrah",
    attribution:
      "رَوَاهُ مُسْلِمٌ",
    attributionEn:
      "Reported by Muslim.",
    source: "Muslim",
    theme: "Lawful earnings",
  },
  {
    number: 11,
    arabic: "دَعْ مَا يَرِيبُكَ إِلَى مَا لَا يَرِيبُكَ",
    english:
      "Leave what makes you unsure, and take what does not.",
    isnad:
      "عَنْ أَبِي مُحَمَّدٍ الْحَسَنِ بْنِ عَلِيِّ بْنِ أَبِي طَالِبٍ سِبْطِ رَسُولِ اللَّهِ ﷺ وَرَيْحَانَتِهِ رَضِيَ اللَّهُ عَنْهُمَا قَالَ: حَفِظْتُ مِنْ رَسُولِ اللَّهِ ﷺ:",
    isnadEn:
      "On the authority of Abu Muhammad al-Hasan ibn Ali ibn Abi Talib, the grandson of the Messenger of Allah ﷺ and his sweet fragrance (may Allah be pleased with them both), who said: I memorised from the Messenger of Allah ﷺ:",
    narrator: "al-Hasan ibn Ali",
    attribution:
      "رَوَاهُ التِّرْمِذِيُّ وَالنَّسَائِيُّ",
    attributionEn:
      "Reported by at-Tirmidhi and an-Nasa'i.",
    source: "Tirmidhi & Nasa'i",
    theme: "Scrupulousness",
  },
  {
    number: 12,
    arabic: "مِنْ حُسْنِ إِسْلَامِ الْمَرْءِ تَرْكُهُ مَا لَا يَعْنِيهِ",
    english:
      "Part of being a good Muslim is leaving alone the things that are none of your business.",
    isnad:
      "عَنْ أَبِي هُرَيْرَةَ رَضِيَ اللَّهُ عَنْهُ قَالَ: قَالَ رَسُولُ اللَّهِ ﷺ:",
    isnadEn:
      "On the authority of Abu Hurayrah (may Allah be pleased with him), who said: The Messenger of Allah ﷺ said:",
    narrator: "Abu Hurayrah",
    attribution:
      "رَوَاهُ التِّرْمِذِيُّ",
    attributionEn:
      "Reported by at-Tirmidhi.",
    source: "Tirmidhi",
    theme: "Restraint",
  },
  {
    number: 13,
    arabic: "لَا يُؤْمِنُ أَحَدُكُمْ حَتَّى يُحِبَّ لِأَخِيهِ مَا يُحِبُّ لِنَفْسِهِ",
    english:
      "None of you really believes until you want for your brother what you want for yourself.",
    isnad:
      "عَنْ أَبِي حَمْزَةَ أَنَسِ بْنِ مَالِكٍ رَضِيَ اللَّهُ عَنْهُ خَادِمِ رَسُولِ اللَّهِ ﷺ عَنِ النَّبِيِّ ﷺ قَالَ:",
    isnadEn:
      "On the authority of Abu Hamzah Anas ibn Malik (may Allah be pleased with him), the servant of the Messenger of Allah ﷺ, that the Prophet ﷺ said:",
    narrator: "Anas ibn Malik",
    attribution:
      "رَوَاهُ الْبُخَارِيُّ وَمُسْلِمٌ",
    attributionEn:
      "Reported by al-Bukhari and Muslim.",
    source: "Bukhari & Muslim",
    theme: "Brotherhood",
  },
  {
    number: 14,
    arabic:
      "لَا يَحِلُّ دَمُ امْرِئٍ مُسْلِمٍ إِلَّا بِإِحْدَى ثَلَاثٍ: الثَّيِّبُ الزَّانِي، وَالنَّفْسُ بِالنَّفْسِ، وَالتَّارِكُ لِدِينِهِ الْمُفَارِقُ لِلْجَمَاعَةِ",
    english:
      "It is not allowed to take the life of a Muslim except in three cases: a married person who commits adultery, a life taken for a life, and someone who leaves the religion and leaves the community.",
    isnad:
      "عَنِ ابْنِ مَسْعُودٍ رَضِيَ اللَّهُ عَنْهُ قَالَ: قَالَ رَسُولُ اللَّهِ ﷺ:",
    isnadEn:
      "On the authority of Ibn Mas'ud (may Allah be pleased with him), who said: The Messenger of Allah ﷺ said:",
    narrator: "Abdullah ibn Mas'ud",
    attribution:
      "رَوَاهُ الْبُخَارِيُّ وَمُسْلِمٌ",
    attributionEn:
      "Reported by al-Bukhari and Muslim.",
    source: "Bukhari & Muslim",
    theme: "Sanctity of life",
  },
  {
    number: 15,
    arabic:
      "مَنْ كَانَ يُؤْمِنُ بِاللَّهِ وَالْيَوْمِ الْآخِرِ فَلْيَقُلْ خَيْرًا أَوْ لِيَصْمُتْ، وَمَنْ كَانَ يُؤْمِنُ بِاللَّهِ وَالْيَوْمِ الْآخِرِ فَلْيُكْرِمْ جَارَهُ، وَمَنْ كَانَ يُؤْمِنُ بِاللَّهِ وَالْيَوْمِ الْآخِرِ فَلْيُكْرِمْ ضَيْفَهُ",
    english:
      "Whoever believes in Allah and the Last Day should say something good or stay quiet. Whoever believes in Allah and the Last Day should be kind to his neighbour. Whoever believes in Allah and the Last Day should be kind to his guest.",
    isnad:
      "عَنْ أَبِي هُرَيْرَةَ رَضِيَ اللَّهُ عَنْهُ أَنَّ رَسُولَ اللَّهِ ﷺ قَالَ:",
    isnadEn:
      "On the authority of Abu Hurayrah (may Allah be pleased with him), that the Messenger of Allah ﷺ said:",
    narrator: "Abu Hurayrah",
    attribution:
      "رَوَاهُ الْبُخَارِيُّ وَمُسْلِمٌ",
    attributionEn:
      "Reported by al-Bukhari and Muslim.",
    source: "Bukhari & Muslim",
    theme: "Good character",
  },
  {
    number: 16,
    arabic: "لَا تَغْضَبْ",
    english:
      "A man asked the Prophet ﷺ to give him advice. He said: do not get angry. The man asked again and again, and each time he said: do not get angry.",
    isnad:
      "عَنْ أَبِي هُرَيْرَةَ رَضِيَ اللَّهُ عَنْهُ أَنَّ رَجُلًا قَالَ لِلنَّبِيِّ ﷺ: أَوْصِنِي. قَالَ:",
    isnadEn:
      "On the authority of Abu Hurayrah (may Allah be pleased with him), that a man said to the Prophet ﷺ: Counsel me. He said:",
    narrator: "Abu Hurayrah",
    attribution:
      "رَوَاهُ الْبُخَارِيُّ",
    attributionEn:
      "Reported by al-Bukhari.",
    source: "Bukhari",
    theme: "Anger",
  },
  {
    number: 17,
    arabic:
      "إِنَّ اللَّهَ كَتَبَ الْإِحْسَانَ عَلَى كُلِّ شَيْءٍ، فَإِذَا قَتَلْتُمْ فَأَحْسِنُوا الْقِتْلَةَ، وَإِذَا ذَبَحْتُمْ فَأَحْسِنُوا الذِّبْحَةَ، وَلْيُحِدَّ أَحَدُكُمْ شَفْرَتَهُ وَلْيُرِحْ ذَبِيحَتَهُ",
    english:
      "Allah has told us to do everything well. So when you must take a life, do it well; and when you slaughter an animal, do it well. Sharpen your blade and make it easy for the animal.",
    isnad:
      "عَنْ أَبِي يَعْلَى شَدَّادِ بْنِ أَوْسٍ رَضِيَ اللَّهُ عَنْهُ عَنْ رَسُولِ اللَّهِ ﷺ قَالَ:",
    isnadEn:
      "On the authority of Abu Ya'la Shaddad ibn Aws (may Allah be pleased with him), that the Messenger of Allah ﷺ said:",
    narrator: "Shaddad ibn Aws",
    attribution:
      "رَوَاهُ مُسْلِمٌ",
    attributionEn:
      "Reported by Muslim.",
    source: "Muslim",
    theme: "Excellence",
  },
  {
    number: 18,
    arabic:
      "اتَّقِ اللَّهَ حَيْثُمَا كُنْتَ، وَأَتْبِعِ السَّيِّئَةَ الْحَسَنَةَ تَمْحُهَا، وَخَالِقِ النَّاسَ بِخُلُقٍ حَسَنٍ",
    english:
      "Fear Allah wherever you are. When you do something bad, follow it with something good and it will wipe it out. And treat people with good manners.",
    isnad:
      "عَنْ أَبِي ذَرٍّ جُنْدُبِ بْنِ جُنَادَةَ وَأَبِي عَبْدِ الرَّحْمَنِ مُعَاذِ بْنِ جَبَلٍ رَضِيَ اللَّهُ عَنْهُمَا عَنْ رَسُولِ اللَّهِ ﷺ قَالَ:",
    isnadEn:
      "On the authority of Abu Dharr Jundub ibn Junadah and Abu Abd ar-Rahman Mu'adh ibn Jabal (may Allah be pleased with them both), that the Messenger of Allah ﷺ said:",
    narrator: "Abu Dharr & Mu'adh ibn Jabal",
    attribution:
      "رَوَاهُ التِّرْمِذِيُّ",
    attributionEn:
      "Reported by at-Tirmidhi.",
    source: "Tirmidhi",
    theme: "Good character",
  },
  {
    number: 19,
    arabic:
      "احْفَظِ اللَّهَ يَحْفَظْكَ، احْفَظِ اللَّهَ تَجِدْهُ تُجَاهَكَ، إِذَا سَأَلْتَ فَاسْأَلِ اللَّهَ، وَإِذَا اسْتَعَنْتَ فَاسْتَعِنْ بِاللَّهِ",
    english:
      "Take care of what Allah has told you, and Allah will take care of you. Take care of what Allah has told you, and you will find Him beside you. When you ask, ask Allah. When you need help, ask Allah for help.",
    isnad:
      "عَنْ أَبِي الْعَبَّاسِ عَبْدِ اللَّهِ بْنِ عَبَّاسٍ رَضِيَ اللَّهُ عَنْهُمَا قَالَ: كُنْتُ خَلْفَ النَّبِيِّ ﷺ يَوْمًا فَقَالَ: يَا غُلَامُ، إِنِّي أُعَلِّمُكَ كَلِمَاتٍ:",
    isnadEn:
      "On the authority of Abu al-Abbas Abdullah ibn Abbas (may Allah be pleased with them both), who said: I was behind the Prophet ﷺ one day and he said: Young man, I shall teach you some words:",
    narrator: "Abdullah ibn Abbas",
    attribution:
      "رَوَاهُ التِّرْمِذِيُّ",
    attributionEn:
      "Reported by at-Tirmidhi.",
    source: "Tirmidhi",
    theme: "Reliance on Allah",
  },
  {
    number: 20,
    arabic: "إِذَا لَمْ تَسْتَحِ فَاصْنَعْ مَا شِئْتَ",
    english:
      "If you feel no shame, then do whatever you like.",
    isnad:
      "عَنْ أَبِي مَسْعُودٍ عُقْبَةَ بْنِ عَمْرٍو الْأَنْصَارِيِّ الْبَدْرِيِّ رَضِيَ اللَّهُ عَنْهُ قَالَ: قَالَ رَسُولُ اللَّهِ ﷺ:",
    isnadEn:
      "On the authority of Abu Mas'ud Uqbah ibn Amr al-Ansari al-Badri (may Allah be pleased with him), who said: The Messenger of Allah ﷺ said:",
    narrator: "Abu Mas'ud al-Badri",
    attribution:
      "رَوَاهُ الْبُخَارِيُّ",
    attributionEn:
      "Reported by al-Bukhari.",
    source: "Bukhari",
    theme: "Modesty",
  },
  {
    number: 21,
    arabic: "قُلْ آمَنْتُ بِاللَّهِ ثُمَّ اسْتَقِمْ",
    english:
      "Say: I believe in Allah — and then keep going straight.",
    isnad:
      "عَنْ أَبِي عَمْرٍو - وَقِيلَ أَبِي عَمْرَةَ - سُفْيَانَ بْنِ عَبْدِ اللَّهِ رَضِيَ اللَّهُ عَنْهُ قَالَ: قُلْتُ يَا رَسُولَ اللَّهِ، قُلْ لِي فِي الْإِسْلَامِ قَوْلًا لَا أَسْأَلُ عَنْهُ أَحَدًا غَيْرَكَ. قَالَ:",
    isnadEn:
      "On the authority of Abu Amr — and some say Abu Amrah — Sufyan ibn Abdullah (may Allah be pleased with him), who said: I said: O Messenger of Allah, tell me something about Islam that I need ask no one but you. He said:",
    narrator: "Sufyan ibn Abdullah",
    attribution:
      "رَوَاهُ مُسْلِمٌ",
    attributionEn:
      "Reported by Muslim.",
    source: "Muslim",
    theme: "Steadfastness",
  },
  {
    number: 22,
    arabic:
      "أَرَأَيْتَ إِذَا صَلَّيْتُ الْمَكْتُوبَاتِ، وَصُمْتُ رَمَضَانَ، وَأَحْلَلْتُ الْحَلَالَ، وَحَرَّمْتُ الْحَرَامَ، وَلَمْ أَزِدْ عَلَى ذَلِكَ شَيْئًا، أَأَدْخُلُ الْجَنَّةَ؟ قَالَ: نَعَمْ",
    english:
      "A man asked: if I pray my prayers, fast in Ramadan, treat what is allowed as allowed and what is not allowed as not allowed, and do nothing more than that, will I go to Paradise? He said: yes.",
    isnad:
      "عَنْ أَبِي عَبْدِ اللَّهِ جَابِرِ بْنِ عَبْدِ اللَّهِ الْأَنْصَارِيِّ رَضِيَ اللَّهُ عَنْهُمَا أَنَّ رَجُلًا سَأَلَ رَسُولَ اللَّهِ ﷺ فَقَالَ:",
    isnadEn:
      "On the authority of Abu Abdillah Jabir ibn Abdullah al-Ansari (may Allah be pleased with them both), that a man questioned the Messenger of Allah ﷺ and said:",
    narrator: "Jabir ibn Abdullah",
    attribution:
      "رَوَاهُ مُسْلِمٌ",
    attributionEn:
      "Reported by Muslim.",
    source: "Muslim",
    theme: "The obligations",
  },
  {
    number: 23,
    arabic:
      "الطُّهُورُ شَطْرُ الْإِيمَانِ، وَالْحَمْدُ لِلَّهِ تَمْلَأُ الْمِيزَانَ، وَسُبْحَانَ اللَّهِ وَالْحَمْدُ لِلَّهِ تَمْلَآنِ مَا بَيْنَ السَّمَاوَاتِ وَالْأَرْضِ، وَالصَّلَاةُ نُورٌ، وَالصَّدَقَةُ بُرْهَانٌ، وَالصَّبْرُ ضِيَاءٌ، وَالْقُرْآنُ حُجَّةٌ لَكَ أَوْ عَلَيْكَ",
    english:
      "Keeping clean is half of faith. Saying alhamdulillah fills the scale. Saying subhanallah and alhamdulillah fill everything between the sky and the earth. Prayer is light. Charity is proof. Patience is brightness. And the Qur'an will either speak for you or against you.",
    isnad:
      "عَنْ أَبِي مَالِكٍ الْحَارِثِ بْنِ عَاصِمٍ الْأَشْعَرِيِّ رَضِيَ اللَّهُ عَنْهُ قَالَ: قَالَ رَسُولُ اللَّهِ ﷺ:",
    isnadEn:
      "On the authority of Abu Malik al-Harith ibn Asim al-Ash'ari (may Allah be pleased with him), who said: The Messenger of Allah ﷺ said:",
    narrator: "Abu Malik al-Ash'ari",
    attribution:
      "رَوَاهُ مُسْلِمٌ",
    attributionEn:
      "Reported by Muslim.",
    source: "Muslim",
    theme: "Worship",
  },
  {
    number: 24,
    arabic:
      "يَا عِبَادِي إِنِّي حَرَّمْتُ الظُّلْمَ عَلَى نَفْسِي وَجَعَلْتُهُ بَيْنَكُمْ مُحَرَّمًا فَلَا تَظَالَمُوا… يَا عِبَادِي إِنَّمَا هِيَ أَعْمَالُكُمْ أُحْصِيهَا لَكُمْ ثُمَّ أُوَفِّيكُمْ إِيَّاهَا، فَمَنْ وَجَدَ خَيْرًا فَلْيَحْمَدِ اللَّهَ، وَمَنْ وَجَدَ غَيْرَ ذَلِكَ فَلَا يَلُومَنَّ إِلَّا نَفْسَهُ",
    english:
      "My servants, I have made it wrong for Myself to treat anyone unfairly, and I have made it wrong for you too — so do not treat each other unfairly. My servants, it is only your own deeds that I count for you and then pay you back for. So whoever finds good, let him thank Allah; and whoever finds anything else, let him blame only himself.",
    isnad:
      "عَنْ أَبِي ذَرٍّ الْغِفَارِيِّ رَضِيَ اللَّهُ عَنْهُ عَنِ النَّبِيِّ ﷺ فِيمَا يَرْوِيهِ عَنْ رَبِّهِ تَبَارَكَ وَتَعَالَى أَنَّهُ قَالَ:",
    isnadEn:
      "On the authority of Abu Dharr al-Ghifari (may Allah be pleased with him), from the Prophet ﷺ, from what he related from his Lord, blessed and exalted, that He said:",
    narrator: "Abu Dharr",
    attribution:
      "رَوَاهُ مُسْلِمٌ",
    attributionEn:
      "Reported by Muslim.",
    source: "Muslim",
    theme: "Justice",
    qudsi: true,
  },
  {
    number: 25,
    arabic:
      "أَوَلَيْسَ قَدْ جَعَلَ اللَّهُ لَكُمْ مَا تَصَّدَّقُونَ؟ إِنَّ بِكُلِّ تَسْبِيحَةٍ صَدَقَةً، وَكُلِّ تَكْبِيرَةٍ صَدَقَةً، وَكُلِّ تَحْمِيدَةٍ صَدَقَةً، وَكُلِّ تَهْلِيلَةٍ صَدَقَةً، وَأَمْرٍ بِالْمَعْرُوفِ صَدَقَةٌ، وَنَهْيٍ عَنْ مُنْكَرٍ صَدَقَةٌ",
    english:
      "Has Allah not given you things you can give away? Every subhanallah is charity. Every takbir is charity. Every alhamdulillah is charity. Every la ilaha illallah is charity. Telling someone to do good is charity, and stopping someone from doing wrong is charity.",
    isnad:
      "عَنْ أَبِي ذَرٍّ رَضِيَ اللَّهُ عَنْهُ أَيْضًا أَنَّ نَاسًا مِنْ أَصْحَابِ رَسُولِ اللَّهِ ﷺ قَالُوا لِلنَّبِيِّ ﷺ: يَا رَسُولَ اللَّهِ، ذَهَبَ أَهْلُ الدُّثُورِ بِالْأُجُورِ. فَقَالَ:",
    isnadEn:
      "Also on the authority of Abu Dharr (may Allah be pleased with him), that some of the Companions said to the Prophet ﷺ: O Messenger of Allah, the wealthy have taken all the reward. He said:",
    narrator: "Abu Dharr",
    attribution:
      "رَوَاهُ مُسْلِمٌ",
    attributionEn:
      "Reported by Muslim.",
    source: "Muslim",
    theme: "Charity",
  },
  {
    number: 26,
    arabic:
      "كُلُّ سُلَامَى مِنَ النَّاسِ عَلَيْهِ صَدَقَةٌ كُلَّ يَوْمٍ تَطْلُعُ فِيهِ الشَّمْسُ: تَعْدِلُ بَيْنَ اثْنَيْنِ صَدَقَةٌ، وَتُعِينُ الرَّجُلَ فِي دَابَّتِهِ فَتَحْمِلُهُ عَلَيْهَا أَوْ تَرْفَعُ لَهُ عَلَيْهَا مَتَاعَهُ صَدَقَةٌ، وَالْكَلِمَةُ الطَّيِّبَةُ صَدَقَةٌ، وَتُمِيطُ الْأَذَى عَنِ الطَّرِيقِ صَدَقَةٌ",
    english:
      "Every joint in your body owes charity every day the sun comes up. Being fair between two people is charity. Helping someone onto his animal, or lifting his bags onto it, is charity. A kind word is charity. And moving something harmful off the road is charity.",
    isnad:
      "عَنْ أَبِي هُرَيْرَةَ رَضِيَ اللَّهُ عَنْهُ قَالَ: قَالَ رَسُولُ اللَّهِ ﷺ:",
    isnadEn:
      "On the authority of Abu Hurayrah (may Allah be pleased with him), who said: The Messenger of Allah ﷺ said:",
    narrator: "Abu Hurayrah",
    attribution:
      "رَوَاهُ الْبُخَارِيُّ وَمُسْلِمٌ",
    attributionEn:
      "Reported by al-Bukhari and Muslim.",
    source: "Bukhari & Muslim",
    theme: "Charity",
  },
  {
    number: 27,
    arabic:
      "الْبِرُّ حُسْنُ الْخُلُقِ، وَالْإِثْمُ مَا حَاكَ فِي صَدْرِكَ وَكَرِهْتَ أَنْ يَطَّلِعَ عَلَيْهِ النَّاسُ",
    english:
      "Being good is having good manners. And sin is what makes you uneasy inside, and what you would not want other people to find out about.",
    isnad:
      "عَنِ النَّوَّاسِ بْنِ سَمْعَانَ رَضِيَ اللَّهُ عَنْهُ عَنِ النَّبِيِّ ﷺ قَالَ:",
    isnadEn:
      "On the authority of an-Nawwas ibn Sam'an (may Allah be pleased with him), from the Prophet ﷺ, who said:",
    narrator: "an-Nawwas ibn Sam'an",
    attribution:
      "رَوَاهُ مُسْلِمٌ",
    attributionEn:
      "Reported by Muslim.",
    source: "Muslim",
    theme: "Conscience",
  },
  {
    number: 28,
    arabic:
      "أُوصِيكُمْ بِتَقْوَى اللَّهِ وَالسَّمْعِ وَالطَّاعَةِ وَإِنْ تَأَمَّرَ عَلَيْكُمْ عَبْدٌ، فَإِنَّهُ مَنْ يَعِشْ مِنْكُمْ فَسَيَرَى اخْتِلَافًا كَثِيرًا، فَعَلَيْكُمْ بِسُنَّتِي وَسُنَّةِ الْخُلَفَاءِ الرَّاشِدِينَ الْمَهْدِيِّينَ، عَضُّوا عَلَيْهَا بِالنَّوَاجِذِ",
    english:
      "I tell you to fear Allah, and to listen and obey, even if the one put in charge of you is a slave. Whoever lives long will see many disagreements. So hold on to my way and the way of the rightly guided caliphs — hold on to it tightly.",
    isnad:
      "عَنْ أَبِي نَجِيحٍ الْعِرْبَاضِ بْنِ سَارِيَةَ رَضِيَ اللَّهُ عَنْهُ قَالَ: وَعَظَنَا رَسُولُ اللَّهِ ﷺ مَوْعِظَةً وَجِلَتْ مِنْهَا الْقُلُوبُ وَذَرَفَتْ مِنْهَا الْعُيُونُ، فَقُلْنَا: يَا رَسُولَ اللَّهِ أَوْصِنَا. قَالَ:",
    isnadEn:
      "On the authority of Abu Najih al-Irbad ibn Sariyah (may Allah be pleased with him), who said: The Messenger of Allah ﷺ gave us a sermon that made our hearts tremble and our eyes overflow. We said: O Messenger of Allah, counsel us. He said:",
    narrator: "al-Irbad ibn Sariyah",
    attribution:
      "رَوَاهُ أَبُو دَاوُدَ وَالتِّرْمِذِيُّ",
    attributionEn:
      "Reported by Abu Dawud and at-Tirmidhi.",
    source: "Abu Dawud & Tirmidhi",
    theme: "Following the Sunnah",
  },
  {
    number: 29,
    arabic:
      "أَلَا أُخْبِرُكَ بِرَأْسِ الْأَمْرِ وَعَمُودِهِ وَذِرْوَةِ سَنَامِهِ؟ رَأْسُ الْأَمْرِ الْإِسْلَامُ، وَعَمُودُهُ الصَّلَاةُ، وَذِرْوَةُ سَنَامِهِ الْجِهَادُ… أَلَا أُخْبِرُكَ بِمِلَاكِ ذَلِكَ كُلِّهِ؟ كُفَّ عَلَيْكَ هَذَا. وَأَشَارَ إِلَى لِسَانِهِ",
    english:
      "Shall I tell you the head of the matter, its pillar, and its highest point? The head of the matter is Islam. Its pillar is the prayer. And its highest point is jihad. Shall I tell you what holds all of it together? Control this — and he pointed to his tongue.",
    isnad:
      "عَنْ مُعَاذِ بْنِ جَبَلٍ رَضِيَ اللَّهُ عَنْهُ قَالَ: قُلْتُ يَا رَسُولَ اللَّهِ، أَخْبِرْنِي بِعَمَلٍ يُدْخِلُنِي الْجَنَّةَ وَيُبَاعِدُنِي عَنِ النَّارِ. ثُمَّ قَالَ:",
    isnadEn:
      "On the authority of Mu'adh ibn Jabal (may Allah be pleased with him), who said: I said: O Messenger of Allah, tell me of a deed that will admit me to Paradise and keep me far from the Fire. Then he said:",
    narrator: "Mu'adh ibn Jabal",
    attribution:
      "رَوَاهُ التِّرْمِذِيُّ",
    attributionEn:
      "Reported by at-Tirmidhi.",
    source: "Tirmidhi",
    theme: "The tongue",
  },
  {
    number: 30,
    arabic:
      "إِنَّ اللَّهَ فَرَضَ فَرَائِضَ فَلَا تُضَيِّعُوهَا، وَحَدَّ حُدُودًا فَلَا تَعْتَدُوهَا، وَحَرَّمَ أَشْيَاءَ فَلَا تَنْتَهِكُوهَا، وَسَكَتَ عَنْ أَشْيَاءَ رَحْمَةً لَكُمْ غَيْرَ نِسْيَانٍ فَلَا تَبْحَثُوا عَنْهَا",
    english:
      "Allah has given you duties, so do not leave them. He has set limits, so do not cross them. He has made some things forbidden, so do not do them. And He stayed quiet about some things to be kind to you, not because He forgot — so do not go looking into them.",
    isnad:
      "عَنْ أَبِي ثَعْلَبَةَ الْخُشَنِيِّ جُرْثُومِ بْنِ نَاشِرٍ رَضِيَ اللَّهُ عَنْهُ عَنْ رَسُولِ اللَّهِ ﷺ قَالَ:",
    isnadEn:
      "On the authority of Abu Tha'labah al-Khushani Jurthum ibn Nashir (may Allah be pleased with him), that the Messenger of Allah ﷺ said:",
    narrator: "Abu Tha'labah al-Khushani",
    attribution:
      "رَوَاهُ الدَّارَقُطْنِيُّ",
    attributionEn:
      "Reported by ad-Daraqutni.",
    source: "Daraqutni",
    theme: "The limits",
  },
  {
    number: 31,
    arabic:
      "ازْهَدْ فِي الدُّنْيَا يُحِبَّكَ اللَّهُ، وَازْهَدْ فِيمَا عِنْدَ النَّاسِ يُحِبَّكَ النَّاسُ",
    english:
      "Do not chase after this world, and Allah will love you. Do not chase after what other people have, and people will love you.",
    isnad:
      "عَنْ أَبِي الْعَبَّاسِ سَهْلِ بْنِ سَعْدٍ السَّاعِدِيِّ رَضِيَ اللَّهُ عَنْهُ قَالَ: جَاءَ رَجُلٌ إِلَى النَّبِيِّ ﷺ فَقَالَ: يَا رَسُولَ اللَّهِ، دُلَّنِي عَلَى عَمَلٍ إِذَا عَمِلْتُهُ أَحَبَّنِي اللَّهُ وَأَحَبَّنِي النَّاسُ. فَقَالَ:",
    isnadEn:
      "On the authority of Abu al-Abbas Sahl ibn Sa'd as-Sa'idi (may Allah be pleased with him), who said: A man came to the Prophet ﷺ and said: O Messenger of Allah, show me a deed which, if I do it, Allah will love me and people will love me. He said:",
    narrator: "Sahl ibn Sa'd",
    attribution:
      "رَوَاهُ ابْنُ مَاجَهْ",
    attributionEn:
      "Reported by Ibn Majah.",
    source: "Ibn Majah",
    theme: "Detachment",
  },
  {
    number: 32,
    arabic: "لَا ضَرَرَ وَلَا ضِرَارَ",
    english:
      "Do not harm others, and do not harm someone back.",
    isnad:
      "عَنْ أَبِي سَعِيدٍ سَعْدِ بْنِ مَالِكِ بْنِ سِنَانٍ الْخُدْرِيِّ رَضِيَ اللَّهُ عَنْهُ أَنَّ رَسُولَ اللَّهِ ﷺ قَالَ:",
    isnadEn:
      "On the authority of Abu Sa'id Sa'd ibn Malik ibn Sinan al-Khudri (may Allah be pleased with him), that the Messenger of Allah ﷺ said:",
    narrator: "Abu Sa'id al-Khudri",
    attribution:
      "رَوَاهُ ابْنُ مَاجَهْ وَالدَّارَقُطْنِيُّ",
    attributionEn:
      "Reported by Ibn Majah and ad-Daraqutni.",
    source: "Ibn Majah & Daraqutni",
    theme: "Harm",
  },
  {
    number: 33,
    arabic:
      "لَوْ يُعْطَى النَّاسُ بِدَعْوَاهُمْ لَادَّعَى رِجَالٌ أَمْوَالَ قَوْمٍ وَدِمَاءَهُمْ، لَكِنَّ الْبَيِّنَةَ عَلَى الْمُدَّعِي وَالْيَمِينَ عَلَى مَنْ أَنْكَرَ",
    english:
      "If people were simply given whatever they claimed, some would claim other people's money and lives. But the one making the claim must bring proof, and the one who says no must swear an oath.",
    isnad:
      "عَنِ ابْنِ عَبَّاسٍ رَضِيَ اللَّهُ عَنْهُمَا أَنَّ رَسُولَ اللَّهِ ﷺ قَالَ:",
    isnadEn:
      "On the authority of Ibn Abbas (may Allah be pleased with them both), that the Messenger of Allah ﷺ said:",
    narrator: "Abdullah ibn Abbas",
    attribution:
      "رَوَاهُ الْبَيْهَقِيُّ",
    attributionEn:
      "Reported by al-Bayhaqi.",
    source: "Bayhaqi",
    theme: "Justice",
  },
  {
    number: 34,
    arabic:
      "مَنْ رَأَى مِنْكُمْ مُنْكَرًا فَلْيُغَيِّرْهُ بِيَدِهِ، فَإِنْ لَمْ يَسْتَطِعْ فَبِلِسَانِهِ، فَإِنْ لَمْ يَسْتَطِعْ فَبِقَلْبِهِ، وَذَلِكَ أَضْعَفُ الْإِيمَانِ",
    english:
      "If you see something wrong, change it with your hand. If you cannot, then with your tongue. If you cannot, then hate it in your heart — and that is the weakest faith.",
    isnad:
      "عَنْ أَبِي سَعِيدٍ الْخُدْرِيِّ رَضِيَ اللَّهُ عَنْهُ قَالَ: سَمِعْتُ رَسُولَ اللَّهِ ﷺ يَقُولُ:",
    isnadEn:
      "On the authority of Abu Sa'id al-Khudri (may Allah be pleased with him), who said: I heard the Messenger of Allah ﷺ say:",
    narrator: "Abu Sa'id al-Khudri",
    attribution:
      "رَوَاهُ مُسْلِمٌ",
    attributionEn:
      "Reported by Muslim.",
    source: "Muslim",
    theme: "Enjoining good",
  },
  {
    number: 35,
    arabic:
      "لَا تَحَاسَدُوا وَلَا تَنَاجَشُوا وَلَا تَبَاغَضُوا وَلَا تَدَابَرُوا، وَلَا يَبِعْ بَعْضُكُمْ عَلَى بَيْعِ بَعْضٍ، وَكُونُوا عِبَادَ اللَّهِ إِخْوَانًا. الْمُسْلِمُ أَخُو الْمُسْلِمِ، لَا يَظْلِمُهُ وَلَا يَخْذُلُهُ وَلَا يَحْقِرُهُ. التَّقْوَى هَاهُنَا",
    english:
      "Do not envy each other. Do not raise prices against each other. Do not hate each other. Do not turn your backs on each other. Do not undercut each other in trade. Be servants of Allah, brothers. A Muslim is a Muslim's brother: he does not wrong him, leave him alone in trouble, or look down on him. Piety is here — and he pointed to his chest.",
    isnad:
      "عَنْ أَبِي هُرَيْرَةَ رَضِيَ اللَّهُ عَنْهُ قَالَ: قَالَ رَسُولُ اللَّهِ ﷺ:",
    isnadEn:
      "On the authority of Abu Hurayrah (may Allah be pleased with him), who said: The Messenger of Allah ﷺ said:",
    narrator: "Abu Hurayrah",
    attribution:
      "رَوَاهُ مُسْلِمٌ",
    attributionEn:
      "Reported by Muslim.",
    source: "Muslim",
    theme: "Brotherhood",
  },
  {
    number: 36,
    arabic:
      "مَنْ نَفَّسَ عَنْ مُؤْمِنٍ كُرْبَةً مِنْ كُرَبِ الدُّنْيَا نَفَّسَ اللَّهُ عَنْهُ كُرْبَةً مِنْ كُرَبِ يَوْمِ الْقِيَامَةِ، وَمَنْ يَسَّرَ عَلَى مُعْسِرٍ يَسَّرَ اللَّهُ عَلَيْهِ فِي الدُّنْيَا وَالْآخِرَةِ، وَاللَّهُ فِي عَوْنِ الْعَبْدِ مَا كَانَ الْعَبْدُ فِي عَوْنِ أَخِيهِ",
    english:
      "Whoever takes a worry away from a believer in this world, Allah will take away one of his worries on the Day of Judgement. Whoever makes things easy for someone in difficulty, Allah will make things easy for him in this world and the next. Allah helps His servant as long as the servant is helping his brother.",
    isnad:
      "عَنْ أَبِي هُرَيْرَةَ رَضِيَ اللَّهُ عَنْهُ عَنِ النَّبِيِّ ﷺ قَالَ:",
    isnadEn:
      "On the authority of Abu Hurayrah (may Allah be pleased with him), from the Prophet ﷺ, who said:",
    narrator: "Abu Hurayrah",
    attribution:
      "رَوَاهُ مُسْلِمٌ",
    attributionEn:
      "Reported by Muslim.",
    source: "Muslim",
    theme: "Helping others",
  },
  {
    number: 37,
    arabic:
      "إِنَّ اللَّهَ كَتَبَ الْحَسَنَاتِ وَالسَّيِّئَاتِ ثُمَّ بَيَّنَ ذَلِكَ: فَمَنْ هَمَّ بِحَسَنَةٍ فَلَمْ يَعْمَلْهَا كَتَبَهَا اللَّهُ عِنْدَهُ حَسَنَةً كَامِلَةً، وَإِنْ هَمَّ بِهَا فَعَمِلَهَا كَتَبَهَا اللَّهُ لَهُ عِنْدَهُ عَشْرَ حَسَنَاتٍ إِلَى سَبْعِمِائَةِ ضِعْفٍ إِلَى أَضْعَافٍ كَثِيرَةٍ",
    english:
      "Allah has written down the good deeds and the bad ones. Whoever plans to do something good but does not do it, Allah writes it as one full good deed. And if he plans it and does it, Allah writes it as ten good deeds, up to seven hundred times over, and more.",
    isnad:
      "عَنِ ابْنِ عَبَّاسٍ رَضِيَ اللَّهُ عَنْهُمَا عَنْ رَسُولِ اللَّهِ ﷺ فِيمَا يَرْوِيهِ عَنْ رَبِّهِ تَبَارَكَ وَتَعَالَى قَالَ:",
    isnadEn:
      "On the authority of Ibn Abbas (may Allah be pleased with them both), from the Messenger of Allah ﷺ, from what he related from his Lord, blessed and exalted, who said:",
    narrator: "Abdullah ibn Abbas",
    attribution:
      "رَوَاهُ الْبُخَارِيُّ وَمُسْلِمٌ",
    attributionEn:
      "Reported by al-Bukhari and Muslim.",
    source: "Bukhari & Muslim",
    theme: "Reward",
    qudsi: true,
  },
  {
    number: 38,
    arabic:
      "مَنْ عَادَى لِي وَلِيًّا فَقَدْ آذَنْتُهُ بِالْحَرْبِ، وَمَا تَقَرَّبَ إِلَيَّ عَبْدِي بِشَيْءٍ أَحَبَّ إِلَيَّ مِمَّا افْتَرَضْتُهُ عَلَيْهِ، وَمَا يَزَالُ عَبْدِي يَتَقَرَّبُ إِلَيَّ بِالنَّوَافِلِ حَتَّى أُحِبَّهُ",
    english:
      "Whoever is an enemy to a friend of Mine, I declare war on him. My servant comes closer to Me with nothing I love more than what I have made a duty for him. And My servant keeps coming closer to Me with extra good deeds until I love him.",
    isnad:
      "عَنْ أَبِي هُرَيْرَةَ رَضِيَ اللَّهُ عَنْهُ قَالَ: قَالَ رَسُولُ اللَّهِ ﷺ: إِنَّ اللَّهَ تَعَالَى قَالَ:",
    isnadEn:
      "On the authority of Abu Hurayrah (may Allah be pleased with him), who said: The Messenger of Allah ﷺ said: Allah the Exalted has said:",
    narrator: "Abu Hurayrah",
    attribution:
      "رَوَاهُ الْبُخَارِيُّ",
    attributionEn:
      "Reported by al-Bukhari.",
    source: "Bukhari",
    theme: "Nearness to Allah",
    qudsi: true,
  },
  {
    number: 39,
    arabic:
      "إِنَّ اللَّهَ تَجَاوَزَ لِي عَنْ أُمَّتِي الْخَطَأَ وَالنِّسْيَانَ وَمَا اسْتُكْرِهُوا عَلَيْهِ",
    english:
      "Allah has forgiven my community for mistakes, for forgetting, and for what they are forced to do.",
    isnad:
      "عَنِ ابْنِ عَبَّاسٍ رَضِيَ اللَّهُ عَنْهُمَا أَنَّ رَسُولَ اللَّهِ ﷺ قَالَ:",
    isnadEn:
      "On the authority of Ibn Abbas (may Allah be pleased with them both), that the Messenger of Allah ﷺ said:",
    narrator: "Abdullah ibn Abbas",
    attribution:
      "رَوَاهُ ابْنُ مَاجَهْ وَالْبَيْهَقِيُّ",
    attributionEn:
      "Reported by Ibn Majah and al-Bayhaqi.",
    source: "Ibn Majah & Bayhaqi",
    theme: "Mercy",
  },
  {
    number: 40,
    arabic:
      "كُنْ فِي الدُّنْيَا كَأَنَّكَ غَرِيبٌ أَوْ عَابِرُ سَبِيلٍ. وَكَانَ ابْنُ عُمَرَ يَقُولُ: إِذَا أَمْسَيْتَ فَلَا تَنْتَظِرِ الصَّبَاحَ، وَإِذَا أَصْبَحْتَ فَلَا تَنْتَظِرِ الْمَسَاءَ، وَخُذْ مِنْ صِحَّتِكَ لِمَرَضِكَ، وَمِنْ حَيَاتِكَ لِمَوْتِكَ",
    english:
      "Be in this world like a stranger, or like someone passing through. Ibn Umar used to say: when evening comes, do not expect to see the morning; when morning comes, do not expect to see the evening. Use your health before you fall ill, and your life before you die.",
    isnad:
      "عَنِ ابْنِ عُمَرَ رَضِيَ اللَّهُ عَنْهُمَا قَالَ: أَخَذَ رَسُولُ اللَّهِ ﷺ بِمَنْكِبَيَّ فَقَالَ:",
    isnadEn:
      "On the authority of Ibn Umar (may Allah be pleased with them both), who said: The Messenger of Allah ﷺ took me by the shoulders and said:",
    narrator: "Abdullah ibn Umar",
    attribution:
      "رَوَاهُ الْبُخَارِيُّ",
    attributionEn:
      "Reported by al-Bukhari.",
    source: "Bukhari",
    theme: "Detachment",
  },
  {
    number: 41,
    arabic: "لَا يُؤْمِنُ أَحَدُكُمْ حَتَّى يَكُونَ هَوَاهُ تَبَعًا لِمَا جِئْتُ بِهِ",
    english:
      "None of you really believes until what he wants follows what I have brought.",
    isnad:
      "عَنْ أَبِي مُحَمَّدٍ عَبْدِ اللَّهِ بْنِ عَمْرِو بْنِ الْعَاصِ رَضِيَ اللَّهُ عَنْهُمَا قَالَ: قَالَ رَسُولُ اللَّهِ ﷺ:",
    isnadEn:
      "On the authority of Abu Muhammad Abdullah ibn Amr ibn al-As (may Allah be pleased with them both), who said: The Messenger of Allah ﷺ said:",
    narrator: "Abdullah ibn Amr",
    attribution:
      "رَوَاهُ فِي كِتَابِ الْحُجَّةِ",
    attributionEn:
      "Reported in Kitab al-Hujjah.",
    source: "Reported in Kitab al-Hujjah",
    theme: "Following the Sunnah",
  },
  {
    number: 42,
    arabic:
      "يَا ابْنَ آدَمَ إِنَّكَ مَا دَعَوْتَنِي وَرَجَوْتَنِي غَفَرْتُ لَكَ عَلَى مَا كَانَ مِنْكَ وَلَا أُبَالِي… يَا ابْنَ آدَمَ لَوْ أَتَيْتَنِي بِقُرَابِ الْأَرْضِ خَطَايَا ثُمَّ لَقِيتَنِي لَا تُشْرِكُ بِي شَيْئًا لَأَتَيْتُكَ بِقُرَابِهَا مَغْفِرَةً",
    english:
      "Son of Adam, as long as you call on Me and hope in Me, I will forgive you for whatever you have done, and I will not mind. Son of Adam, if you came to Me with sins almost filling the earth, and then met Me worshipping nothing besides Me, I would meet you with forgiveness almost as big.",
    isnad:
      "عَنْ أَنَسِ بْنِ مَالِكٍ رَضِيَ اللَّهُ عَنْهُ قَالَ: سَمِعْتُ رَسُولَ اللَّهِ ﷺ يَقُولُ: قَالَ اللَّهُ تَعَالَى:",
    isnadEn:
      "On the authority of Anas ibn Malik (may Allah be pleased with him), who said: I heard the Messenger of Allah ﷺ say: Allah the Exalted has said:",
    narrator: "Anas ibn Malik",
    attribution:
      "رَوَاهُ التِّرْمِذِيُّ",
    attributionEn:
      "Reported by at-Tirmidhi.",
    source: "Tirmidhi",
    theme: "Forgiveness",
    qudsi: true,
  },
];

/** The distinct themes, in the order they first appear. */
export const ARBAEEN_THEMES = [...new Set(ARBAEEN.map((h) => h.theme))];

export function hadithByNumber(n: number): Hadith | undefined {
  return ARBAEEN.find((h) => h.number === n);
}
