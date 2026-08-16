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
  english: string;
  /** Who narrated it, in English. */
  narrator: string;
  /** Where it is collected. */
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
      "Actions are only by intentions, and every person shall have only what they intended. So whoever migrated for Allah and His Messenger, their migration was for Allah and His Messenger; and whoever migrated for some worldly gain or to marry a woman, their migration was for what they migrated to.",
    narrator: "Umar ibn al-Khattab",
    source: "Bukhari & Muslim",
    theme: "Intention",
  },
  {
    number: 2,
    arabic:
      "أَنْ تَشْهَدَ أَنْ لَا إِلَهَ إِلَّا اللَّهُ وَأَنَّ مُحَمَّدًا رَسُولُ اللَّهِ، وَتُقِيمَ الصَّلَاةَ، وَتُؤْتِيَ الزَّكَاةَ، وَتَصُومَ رَمَضَانَ، وَتَحُجَّ الْبَيْتَ إِنِ اسْتَطَعْتَ إِلَيْهِ سَبِيلًا. قَالَ: فَأَخْبِرْنِي عَنِ الْإِيمَانِ. قَالَ: أَنْ تُؤْمِنَ بِاللَّهِ وَمَلَائِكَتِهِ وَكُتُبِهِ وَرُسُلِهِ وَالْيَوْمِ الْآخِرِ، وَتُؤْمِنَ بِالْقَدَرِ خَيْرِهِ وَشَرِّهِ. قَالَ: فَأَخْبِرْنِي عَنِ الْإِحْسَانِ. قَالَ: أَنْ تَعْبُدَ اللَّهَ كَأَنَّكَ تَرَاهُ، فَإِنْ لَمْ تَكُنْ تَرَاهُ فَإِنَّهُ يَرَاكَ",
    english:
      "Islam is that you testify there is no god but Allah and that Muhammad is the Messenger of Allah, establish the prayer, give the zakah, fast Ramadan, and make pilgrimage to the House if you are able. Faith is that you believe in Allah, His angels, His books, His messengers, the Last Day, and in destiny, its good and its harm. Excellence is that you worship Allah as though you see Him; for though you do not see Him, He sees you.",
    narrator: "Umar ibn al-Khattab",
    source: "Muslim",
    theme: "Faith",
  },
  {
    number: 3,
    arabic:
      "بُنِيَ الْإِسْلَامُ عَلَى خَمْسٍ: شَهَادَةِ أَنْ لَا إِلَهَ إِلَّا اللَّهُ وَأَنَّ مُحَمَّدًا رَسُولُ اللَّهِ، وَإِقَامِ الصَّلَاةِ، وَإِيتَاءِ الزَّكَاةِ، وَحَجِّ الْبَيْتِ، وَصَوْمِ رَمَضَانَ",
    english:
      "Islam is built upon five: the testimony that there is no god but Allah and that Muhammad is the Messenger of Allah, establishing the prayer, giving the zakah, pilgrimage to the House, and fasting Ramadan.",
    narrator: "Abdullah ibn Umar",
    source: "Bukhari & Muslim",
    theme: "Foundations",
  },
  {
    number: 4,
    arabic:
      "إِنَّ أَحَدَكُمْ يُجْمَعُ خَلْقُهُ فِي بَطْنِ أُمِّهِ أَرْبَعِينَ يَوْمًا نُطْفَةً، ثُمَّ يَكُونُ عَلَقَةً مِثْلَ ذَلِكَ، ثُمَّ يَكُونُ مُضْغَةً مِثْلَ ذَلِكَ، ثُمَّ يُرْسَلُ إِلَيْهِ الْمَلَكُ فَيَنْفُخُ فِيهِ الرُّوحَ، وَيُؤْمَرُ بِأَرْبَعِ كَلِمَاتٍ: بِكَتْبِ رِزْقِهِ وَأَجَلِهِ وَعَمَلِهِ وَشَقِيٍّ أَوْ سَعِيدٍ",
    english:
      "Each of you is gathered in his mother's womb for forty days as a drop, then a clinging form for the like of that, then a lump for the like of that. Then an angel is sent who breathes the spirit into him, and is commanded with four words: to write his provision, his term, his deeds, and whether he will be wretched or happy.",
    narrator: "Abdullah ibn Mas'ud",
    source: "Bukhari & Muslim",
    theme: "Destiny",
  },
  {
    number: 5,
    arabic: "مَنْ أَحْدَثَ فِي أَمْرِنَا هَذَا مَا لَيْسَ مِنْهُ فَهُوَ رَدٌّ",
    english:
      "Whoever introduces into this affair of ours something that is not part of it, it is rejected.",
    narrator: "Aishah",
    source: "Bukhari & Muslim",
    theme: "Following the Sunnah",
  },
  {
    number: 6,
    arabic:
      "إِنَّ الْحَلَالَ بَيِّنٌ وَإِنَّ الْحَرَامَ بَيِّنٌ، وَبَيْنَهُمَا مُشْتَبِهَاتٌ لَا يَعْلَمُهُنَّ كَثِيرٌ مِنَ النَّاسِ، فَمَنِ اتَّقَى الشُّبُهَاتِ فَقَدِ اسْتَبْرَأَ لِدِينِهِ وَعِرْضِهِ… أَلَا وَإِنَّ فِي الْجَسَدِ مُضْغَةً إِذَا صَلَحَتْ صَلَحَ الْجَسَدُ كُلُّهُ، وَإِذَا فَسَدَتْ فَسَدَ الْجَسَدُ كُلُّهُ، أَلَا وَهِيَ الْقَلْبُ",
    english:
      "The lawful is clear and the unlawful is clear, and between them are doubtful matters that many people do not know. Whoever guards against the doubtful has protected his religion and his honour. In the body there is a piece of flesh: if it is sound, the whole body is sound, and if it is corrupt, the whole body is corrupt. It is the heart.",
    narrator: "an-Nu'man ibn Bashir",
    source: "Bukhari & Muslim",
    theme: "The heart",
  },
  {
    number: 7,
    arabic:
      "الدِّينُ النَّصِيحَةُ. قُلْنَا: لِمَنْ؟ قَالَ: لِلَّهِ وَلِكِتَابِهِ وَلِرَسُولِهِ وَلِأَئِمَّةِ الْمُسْلِمِينَ وَعَامَّتِهِمْ",
    english:
      "The religion is sincere counsel. We asked: to whom? He said: to Allah, to His Book, to His Messenger, to the leaders of the Muslims and to their common folk.",
    narrator: "Tamim ad-Dari",
    source: "Muslim",
    theme: "Sincerity",
  },
  {
    number: 8,
    arabic:
      "أُمِرْتُ أَنْ أُقَاتِلَ النَّاسَ حَتَّى يَشْهَدُوا أَنْ لَا إِلَهَ إِلَّا اللَّهُ وَأَنَّ مُحَمَّدًا رَسُولُ اللَّهِ، وَيُقِيمُوا الصَّلَاةَ، وَيُؤْتُوا الزَّكَاةَ، فَإِذَا فَعَلُوا ذَلِكَ عَصَمُوا مِنِّي دِمَاءَهُمْ وَأَمْوَالَهُمْ إِلَّا بِحَقِّ الْإِسْلَامِ، وَحِسَابُهُمْ عَلَى اللَّهِ",
    english:
      "I have been commanded to fight the people until they testify that there is no god but Allah and that Muhammad is the Messenger of Allah, establish the prayer and give the zakah. If they do that, their lives and property are protected from me except by the right of Islam, and their reckoning is with Allah.",
    narrator: "Abdullah ibn Umar",
    source: "Bukhari & Muslim",
    theme: "Sanctity of life",
  },
  {
    number: 9,
    arabic:
      "مَا نَهَيْتُكُمْ عَنْهُ فَاجْتَنِبُوهُ، وَمَا أَمَرْتُكُمْ بِهِ فَأْتُوا مِنْهُ مَا اسْتَطَعْتُمْ، فَإِنَّمَا أَهْلَكَ الَّذِينَ مِنْ قَبْلِكُمْ كَثْرَةُ مَسَائِلِهِمْ وَاخْتِلَافُهُمْ عَلَى أَنْبِيَائِهِمْ",
    english:
      "What I have forbidden you, avoid. What I have commanded you, do as much of it as you can. Those before you were destroyed only by their excessive questioning and their disagreeing with their prophets.",
    narrator: "Abu Hurayrah",
    source: "Bukhari & Muslim",
    theme: "Obedience",
  },
  {
    number: 10,
    arabic:
      "إِنَّ اللَّهَ طَيِّبٌ لَا يَقْبَلُ إِلَّا طَيِّبًا، وَإِنَّ اللَّهَ أَمَرَ الْمُؤْمِنِينَ بِمَا أَمَرَ بِهِ الْمُرْسَلِينَ",
    english:
      "Allah is Pure and accepts only what is pure. Allah has commanded the believers with what He commanded the messengers.",
    narrator: "Abu Hurayrah",
    source: "Muslim",
    theme: "Lawful earnings",
  },
  {
    number: 11,
    arabic: "دَعْ مَا يَرِيبُكَ إِلَى مَا لَا يَرِيبُكَ",
    english: "Leave what makes you doubt for what does not make you doubt.",
    narrator: "al-Hasan ibn Ali",
    source: "Tirmidhi & Nasa'i",
    theme: "Scrupulousness",
  },
  {
    number: 12,
    arabic: "مِنْ حُسْنِ إِسْلَامِ الْمَرْءِ تَرْكُهُ مَا لَا يَعْنِيهِ",
    english:
      "Part of the excellence of a person's Islam is leaving what does not concern them.",
    narrator: "Abu Hurayrah",
    source: "Tirmidhi",
    theme: "Restraint",
  },
  {
    number: 13,
    arabic: "لَا يُؤْمِنُ أَحَدُكُمْ حَتَّى يُحِبَّ لِأَخِيهِ مَا يُحِبُّ لِنَفْسِهِ",
    english:
      "None of you truly believes until he loves for his brother what he loves for himself.",
    narrator: "Anas ibn Malik",
    source: "Bukhari & Muslim",
    theme: "Brotherhood",
  },
  {
    number: 14,
    arabic:
      "لَا يَحِلُّ دَمُ امْرِئٍ مُسْلِمٍ إِلَّا بِإِحْدَى ثَلَاثٍ: الثَّيِّبُ الزَّانِي، وَالنَّفْسُ بِالنَّفْسِ، وَالتَّارِكُ لِدِينِهِ الْمُفَارِقُ لِلْجَمَاعَةِ",
    english:
      "The blood of a Muslim is not lawful except in one of three cases: the married adulterer, a life for a life, and one who abandons his religion and leaves the community.",
    narrator: "Abdullah ibn Mas'ud",
    source: "Bukhari & Muslim",
    theme: "Sanctity of life",
  },
  {
    number: 15,
    arabic:
      "مَنْ كَانَ يُؤْمِنُ بِاللَّهِ وَالْيَوْمِ الْآخِرِ فَلْيَقُلْ خَيْرًا أَوْ لِيَصْمُتْ، وَمَنْ كَانَ يُؤْمِنُ بِاللَّهِ وَالْيَوْمِ الْآخِرِ فَلْيُكْرِمْ جَارَهُ، وَمَنْ كَانَ يُؤْمِنُ بِاللَّهِ وَالْيَوْمِ الْآخِرِ فَلْيُكْرِمْ ضَيْفَهُ",
    english:
      "Whoever believes in Allah and the Last Day, let him speak well or stay silent. Whoever believes in Allah and the Last Day, let him honour his neighbour. Whoever believes in Allah and the Last Day, let him honour his guest.",
    narrator: "Abu Hurayrah",
    source: "Bukhari & Muslim",
    theme: "Good character",
  },
  {
    number: 16,
    arabic: "لَا تَغْضَبْ",
    english: "A man said to the Prophet ﷺ: advise me. He said: do not become angry. The man repeated his request several times, and each time he said: do not become angry.",
    narrator: "Abu Hurayrah",
    source: "Bukhari",
    theme: "Anger",
  },
  {
    number: 17,
    arabic:
      "إِنَّ اللَّهَ كَتَبَ الْإِحْسَانَ عَلَى كُلِّ شَيْءٍ، فَإِذَا قَتَلْتُمْ فَأَحْسِنُوا الْقِتْلَةَ، وَإِذَا ذَبَحْتُمْ فَأَحْسِنُوا الذِّبْحَةَ، وَلْيُحِدَّ أَحَدُكُمْ شَفْرَتَهُ وَلْيُرِحْ ذَبِيحَتَهُ",
    english:
      "Allah has prescribed excellence in all things. So when you kill, kill well; and when you slaughter, slaughter well. Let each of you sharpen his blade and spare the animal suffering.",
    narrator: "Shaddad ibn Aws",
    source: "Muslim",
    theme: "Excellence",
  },
  {
    number: 18,
    arabic:
      "اتَّقِ اللَّهَ حَيْثُمَا كُنْتَ، وَأَتْبِعِ السَّيِّئَةَ الْحَسَنَةَ تَمْحُهَا، وَخَالِقِ النَّاسَ بِخُلُقٍ حَسَنٍ",
    english:
      "Fear Allah wherever you are, follow a bad deed with a good one and it will wipe it out, and treat people with good character.",
    narrator: "Abu Dharr & Mu'adh ibn Jabal",
    source: "Tirmidhi",
    theme: "Good character",
  },
  {
    number: 19,
    arabic:
      "احْفَظِ اللَّهَ يَحْفَظْكَ، احْفَظِ اللَّهَ تَجِدْهُ تُجَاهَكَ، إِذَا سَأَلْتَ فَاسْأَلِ اللَّهَ، وَإِذَا اسْتَعَنْتَ فَاسْتَعِنْ بِاللَّهِ",
    english:
      "Be mindful of Allah and He will protect you. Be mindful of Allah and you will find Him before you. When you ask, ask Allah; when you seek help, seek help from Allah.",
    narrator: "Abdullah ibn Abbas",
    source: "Tirmidhi",
    theme: "Reliance on Allah",
  },
  {
    number: 20,
    arabic: "إِذَا لَمْ تَسْتَحِ فَاصْنَعْ مَا شِئْتَ",
    english: "If you feel no shame, then do as you wish.",
    narrator: "Abu Mas'ud al-Badri",
    source: "Bukhari",
    theme: "Modesty",
  },
  {
    number: 21,
    arabic: "قُلْ آمَنْتُ بِاللَّهِ ثُمَّ اسْتَقِمْ",
    english: "Say: I believe in Allah — then hold fast to that.",
    narrator: "Sufyan ibn Abdullah",
    source: "Muslim",
    theme: "Steadfastness",
  },
  {
    number: 22,
    arabic:
      "أَرَأَيْتَ إِذَا صَلَّيْتُ الْمَكْتُوبَاتِ، وَصُمْتُ رَمَضَانَ، وَأَحْلَلْتُ الْحَلَالَ، وَحَرَّمْتُ الْحَرَامَ، وَلَمْ أَزِدْ عَلَى ذَلِكَ شَيْئًا، أَأَدْخُلُ الْجَنَّةَ؟ قَالَ: نَعَمْ",
    english:
      "A man asked: if I pray the obligatory prayers, fast Ramadan, treat the lawful as lawful and the unlawful as unlawful, and add nothing to that, will I enter Paradise? He said: yes.",
    narrator: "Jabir ibn Abdullah",
    source: "Muslim",
    theme: "The obligations",
  },
  {
    number: 23,
    arabic:
      "الطُّهُورُ شَطْرُ الْإِيمَانِ، وَالْحَمْدُ لِلَّهِ تَمْلَأُ الْمِيزَانَ، وَسُبْحَانَ اللَّهِ وَالْحَمْدُ لِلَّهِ تَمْلَآنِ مَا بَيْنَ السَّمَاوَاتِ وَالْأَرْضِ، وَالصَّلَاةُ نُورٌ، وَالصَّدَقَةُ بُرْهَانٌ، وَالصَّبْرُ ضِيَاءٌ، وَالْقُرْآنُ حُجَّةٌ لَكَ أَوْ عَلَيْكَ",
    english:
      "Purity is half of faith. Alhamdulillah fills the scale. Subhanallah and alhamdulillah fill what is between the heavens and the earth. Prayer is light, charity is proof, patience is illumination, and the Qur'an is either an argument for you or against you.",
    narrator: "Abu Malik al-Ash'ari",
    source: "Muslim",
    theme: "Worship",
  },
  {
    number: 24,
    arabic:
      "يَا عِبَادِي إِنِّي حَرَّمْتُ الظُّلْمَ عَلَى نَفْسِي وَجَعَلْتُهُ بَيْنَكُمْ مُحَرَّمًا فَلَا تَظَالَمُوا… يَا عِبَادِي إِنَّمَا هِيَ أَعْمَالُكُمْ أُحْصِيهَا لَكُمْ ثُمَّ أُوَفِّيكُمْ إِيَّاهَا، فَمَنْ وَجَدَ خَيْرًا فَلْيَحْمَدِ اللَّهَ، وَمَنْ وَجَدَ غَيْرَ ذَلِكَ فَلَا يَلُومَنَّ إِلَّا نَفْسَهُ",
    english:
      "O My servants, I have forbidden injustice for Myself and made it forbidden among you, so do not wrong one another. O My servants, it is only your deeds that I record for you and then repay you for. So whoever finds good, let him praise Allah; and whoever finds otherwise, let him blame none but himself.",
    narrator: "Abu Dharr",
    source: "Muslim",
    theme: "Justice",
    qudsi: true,
  },
  {
    number: 25,
    arabic:
      "أَوَلَيْسَ قَدْ جَعَلَ اللَّهُ لَكُمْ مَا تَصَّدَّقُونَ؟ إِنَّ بِكُلِّ تَسْبِيحَةٍ صَدَقَةً، وَكُلِّ تَكْبِيرَةٍ صَدَقَةً، وَكُلِّ تَحْمِيدَةٍ صَدَقَةً، وَكُلِّ تَهْلِيلَةٍ صَدَقَةً، وَأَمْرٍ بِالْمَعْرُوفِ صَدَقَةٌ، وَنَهْيٍ عَنْ مُنْكَرٍ صَدَقَةٌ",
    english:
      "Has Allah not given you what you may give in charity? Every tasbihah is charity, every takbirah is charity, every tahmidah is charity, every tahlilah is charity, enjoining good is charity and forbidding wrong is charity.",
    narrator: "Abu Dharr",
    source: "Muslim",
    theme: "Charity",
  },
  {
    number: 26,
    arabic:
      "كُلُّ سُلَامَى مِنَ النَّاسِ عَلَيْهِ صَدَقَةٌ كُلَّ يَوْمٍ تَطْلُعُ فِيهِ الشَّمْسُ: تَعْدِلُ بَيْنَ اثْنَيْنِ صَدَقَةٌ، وَتُعِينُ الرَّجُلَ فِي دَابَّتِهِ فَتَحْمِلُهُ عَلَيْهَا أَوْ تَرْفَعُ لَهُ عَلَيْهَا مَتَاعَهُ صَدَقَةٌ، وَالْكَلِمَةُ الطَّيِّبَةُ صَدَقَةٌ، وَتُمِيطُ الْأَذَى عَنِ الطَّرِيقِ صَدَقَةٌ",
    english:
      "Every joint of a person owes charity each day the sun rises: to judge justly between two is charity, to help a man onto his mount or lift his baggage onto it is charity, a good word is charity, and removing something harmful from the road is charity.",
    narrator: "Abu Hurayrah",
    source: "Bukhari & Muslim",
    theme: "Charity",
  },
  {
    number: 27,
    arabic:
      "الْبِرُّ حُسْنُ الْخُلُقِ، وَالْإِثْمُ مَا حَاكَ فِي صَدْرِكَ وَكَرِهْتَ أَنْ يَطَّلِعَ عَلَيْهِ النَّاسُ",
    english:
      "Righteousness is good character, and sin is what troubles your chest and you would hate people to find out about.",
    narrator: "an-Nawwas ibn Sam'an",
    source: "Muslim",
    theme: "Conscience",
  },
  {
    number: 28,
    arabic:
      "أُوصِيكُمْ بِتَقْوَى اللَّهِ وَالسَّمْعِ وَالطَّاعَةِ وَإِنْ تَأَمَّرَ عَلَيْكُمْ عَبْدٌ، فَإِنَّهُ مَنْ يَعِشْ مِنْكُمْ فَسَيَرَى اخْتِلَافًا كَثِيرًا، فَعَلَيْكُمْ بِسُنَّتِي وَسُنَّةِ الْخُلَفَاءِ الرَّاشِدِينَ الْمَهْدِيِّينَ، عَضُّوا عَلَيْهَا بِالنَّوَاجِذِ",
    english:
      "I counsel you to fear Allah and to listen and obey, even if a slave is placed over you. Whoever among you lives will see much disagreement. So hold to my sunnah and the sunnah of the rightly guided caliphs — bite onto it with your back teeth.",
    narrator: "al-Irbad ibn Sariyah",
    source: "Abu Dawud & Tirmidhi",
    theme: "Following the Sunnah",
  },
  {
    number: 29,
    arabic:
      "أَلَا أُخْبِرُكَ بِرَأْسِ الْأَمْرِ وَعَمُودِهِ وَذِرْوَةِ سَنَامِهِ؟ رَأْسُ الْأَمْرِ الْإِسْلَامُ، وَعَمُودُهُ الصَّلَاةُ، وَذِرْوَةُ سَنَامِهِ الْجِهَادُ… أَلَا أُخْبِرُكَ بِمِلَاكِ ذَلِكَ كُلِّهِ؟ كُفَّ عَلَيْكَ هَذَا. وَأَشَارَ إِلَى لِسَانِهِ",
    english:
      "Shall I tell you of the head of the matter, its pillar and its highest point? The head of the matter is Islam, its pillar is the prayer, and its highest point is jihad. Shall I tell you what holds all of that together? Restrain this — and he pointed to his tongue.",
    narrator: "Mu'adh ibn Jabal",
    source: "Tirmidhi",
    theme: "The tongue",
  },
  {
    number: 30,
    arabic:
      "إِنَّ اللَّهَ فَرَضَ فَرَائِضَ فَلَا تُضَيِّعُوهَا، وَحَدَّ حُدُودًا فَلَا تَعْتَدُوهَا، وَحَرَّمَ أَشْيَاءَ فَلَا تَنْتَهِكُوهَا، وَسَكَتَ عَنْ أَشْيَاءَ رَحْمَةً لَكُمْ غَيْرَ نِسْيَانٍ فَلَا تَبْحَثُوا عَنْهَا",
    english:
      "Allah has laid down obligations, so do not neglect them; set limits, so do not transgress them; forbidden things, so do not violate them; and stayed silent about things out of mercy to you, not forgetfulness — so do not go searching after them.",
    narrator: "Abu Tha'labah al-Khushani",
    source: "Daraqutni",
    theme: "The limits",
  },
  {
    number: 31,
    arabic:
      "ازْهَدْ فِي الدُّنْيَا يُحِبَّكَ اللَّهُ، وَازْهَدْ فِيمَا عِنْدَ النَّاسِ يُحِبَّكَ النَّاسُ",
    english:
      "Turn away from the world and Allah will love you; turn away from what people have and people will love you.",
    narrator: "Sahl ibn Sa'd",
    source: "Ibn Majah",
    theme: "Detachment",
  },
  {
    number: 32,
    arabic: "لَا ضَرَرَ وَلَا ضِرَارَ",
    english: "There should be neither harm nor the return of harm.",
    narrator: "Abu Sa'id al-Khudri",
    source: "Ibn Majah & Daraqutni",
    theme: "Harm",
  },
  {
    number: 33,
    arabic:
      "لَوْ يُعْطَى النَّاسُ بِدَعْوَاهُمْ لَادَّعَى رِجَالٌ أَمْوَالَ قَوْمٍ وَدِمَاءَهُمْ، لَكِنَّ الْبَيِّنَةَ عَلَى الْمُدَّعِي وَالْيَمِينَ عَلَى مَنْ أَنْكَرَ",
    english:
      "If people were given whatever they claimed, some would claim the wealth and lives of others. But the burden of proof is on the claimant, and the oath is on the one who denies.",
    narrator: "Abdullah ibn Abbas",
    source: "Bayhaqi",
    theme: "Justice",
  },
  {
    number: 34,
    arabic:
      "مَنْ رَأَى مِنْكُمْ مُنْكَرًا فَلْيُغَيِّرْهُ بِيَدِهِ، فَإِنْ لَمْ يَسْتَطِعْ فَبِلِسَانِهِ، فَإِنْ لَمْ يَسْتَطِعْ فَبِقَلْبِهِ، وَذَلِكَ أَضْعَفُ الْإِيمَانِ",
    english:
      "Whoever among you sees a wrong, let him change it with his hand; if he cannot, then with his tongue; if he cannot, then with his heart — and that is the weakest of faith.",
    narrator: "Abu Sa'id al-Khudri",
    source: "Muslim",
    theme: "Enjoining good",
  },
  {
    number: 35,
    arabic:
      "لَا تَحَاسَدُوا وَلَا تَنَاجَشُوا وَلَا تَبَاغَضُوا وَلَا تَدَابَرُوا، وَلَا يَبِعْ بَعْضُكُمْ عَلَى بَيْعِ بَعْضٍ، وَكُونُوا عِبَادَ اللَّهِ إِخْوَانًا. الْمُسْلِمُ أَخُو الْمُسْلِمِ، لَا يَظْلِمُهُ وَلَا يَخْذُلُهُ وَلَا يَحْقِرُهُ. التَّقْوَى هَاهُنَا",
    english:
      "Do not envy one another, do not inflate prices against one another, do not hate one another, do not turn away from one another, and do not undercut one another in trade. Be servants of Allah, brothers. A Muslim is the brother of a Muslim: he does not wrong him, abandon him, or look down on him. Piety is here — and he pointed to his chest.",
    narrator: "Abu Hurayrah",
    source: "Muslim",
    theme: "Brotherhood",
  },
  {
    number: 36,
    arabic:
      "مَنْ نَفَّسَ عَنْ مُؤْمِنٍ كُرْبَةً مِنْ كُرَبِ الدُّنْيَا نَفَّسَ اللَّهُ عَنْهُ كُرْبَةً مِنْ كُرَبِ يَوْمِ الْقِيَامَةِ، وَمَنْ يَسَّرَ عَلَى مُعْسِرٍ يَسَّرَ اللَّهُ عَلَيْهِ فِي الدُّنْيَا وَالْآخِرَةِ، وَاللَّهُ فِي عَوْنِ الْعَبْدِ مَا كَانَ الْعَبْدُ فِي عَوْنِ أَخِيهِ",
    english:
      "Whoever relieves a believer of a hardship of this world, Allah will relieve him of a hardship on the Day of Resurrection. Whoever eases the way for one in difficulty, Allah will ease the way for him in this world and the next. Allah helps His servant so long as the servant helps his brother.",
    narrator: "Abu Hurayrah",
    source: "Muslim",
    theme: "Helping others",
  },
  {
    number: 37,
    arabic:
      "إِنَّ اللَّهَ كَتَبَ الْحَسَنَاتِ وَالسَّيِّئَاتِ ثُمَّ بَيَّنَ ذَلِكَ: فَمَنْ هَمَّ بِحَسَنَةٍ فَلَمْ يَعْمَلْهَا كَتَبَهَا اللَّهُ عِنْدَهُ حَسَنَةً كَامِلَةً، وَإِنْ هَمَّ بِهَا فَعَمِلَهَا كَتَبَهَا اللَّهُ لَهُ عِنْدَهُ عَشْرَ حَسَنَاتٍ إِلَى سَبْعِمِائَةِ ضِعْفٍ إِلَى أَضْعَافٍ كَثِيرَةٍ",
    english:
      "Allah has written down the good deeds and the bad ones. Whoever intends a good deed and does not do it, Allah writes it with Him as a full good deed; and if he intends it and does it, Allah writes it as ten good deeds up to seven hundred times over, and more.",
    narrator: "Abdullah ibn Abbas",
    source: "Bukhari & Muslim",
    theme: "Reward",
    qudsi: true,
  },
  {
    number: 38,
    arabic:
      "مَنْ عَادَى لِي وَلِيًّا فَقَدْ آذَنْتُهُ بِالْحَرْبِ، وَمَا تَقَرَّبَ إِلَيَّ عَبْدِي بِشَيْءٍ أَحَبَّ إِلَيَّ مِمَّا افْتَرَضْتُهُ عَلَيْهِ، وَمَا يَزَالُ عَبْدِي يَتَقَرَّبُ إِلَيَّ بِالنَّوَافِلِ حَتَّى أُحِبَّهُ",
    english:
      "Whoever shows enmity to a friend of Mine, I declare war upon him. My servant draws near to Me with nothing more beloved to Me than what I have made obligatory upon him. My servant continues to draw near to Me with voluntary works until I love him.",
    narrator: "Abu Hurayrah",
    source: "Bukhari",
    theme: "Nearness to Allah",
    qudsi: true,
  },
  {
    number: 39,
    arabic:
      "إِنَّ اللَّهَ تَجَاوَزَ لِي عَنْ أُمَّتِي الْخَطَأَ وَالنِّسْيَانَ وَمَا اسْتُكْرِهُوا عَلَيْهِ",
    english:
      "Allah has pardoned my nation for mistakes, forgetfulness, and what they are compelled to do.",
    narrator: "Abdullah ibn Abbas",
    source: "Ibn Majah & Bayhaqi",
    theme: "Mercy",
  },
  {
    number: 40,
    arabic:
      "كُنْ فِي الدُّنْيَا كَأَنَّكَ غَرِيبٌ أَوْ عَابِرُ سَبِيلٍ. وَكَانَ ابْنُ عُمَرَ يَقُولُ: إِذَا أَمْسَيْتَ فَلَا تَنْتَظِرِ الصَّبَاحَ، وَإِذَا أَصْبَحْتَ فَلَا تَنْتَظِرِ الْمَسَاءَ، وَخُذْ مِنْ صِحَّتِكَ لِمَرَضِكَ، وَمِنْ حَيَاتِكَ لِمَوْتِكَ",
    english:
      "Be in this world as though you were a stranger or a traveller passing through. Ibn Umar used to say: when evening comes, do not expect the morning; when morning comes, do not expect the evening. Take from your health for your illness, and from your life for your death.",
    narrator: "Abdullah ibn Umar",
    source: "Bukhari",
    theme: "Detachment",
  },
  {
    number: 41,
    arabic: "لَا يُؤْمِنُ أَحَدُكُمْ حَتَّى يَكُونَ هَوَاهُ تَبَعًا لِمَا جِئْتُ بِهِ",
    english:
      "None of you truly believes until his desire follows what I have brought.",
    narrator: "Abdullah ibn Amr",
    source: "Reported in Kitab al-Hujjah",
    theme: "Following the Sunnah",
  },
  {
    number: 42,
    arabic:
      "يَا ابْنَ آدَمَ إِنَّكَ مَا دَعَوْتَنِي وَرَجَوْتَنِي غَفَرْتُ لَكَ عَلَى مَا كَانَ مِنْكَ وَلَا أُبَالِي… يَا ابْنَ آدَمَ لَوْ أَتَيْتَنِي بِقُرَابِ الْأَرْضِ خَطَايَا ثُمَّ لَقِيتَنِي لَا تُشْرِكُ بِي شَيْئًا لَأَتَيْتُكَ بِقُرَابِهَا مَغْفِرَةً",
    english:
      "O son of Adam, so long as you call upon Me and hope in Me, I will forgive you for what you have done, and I will not mind. O son of Adam, were you to come to Me with sins nearly filling the earth, and then meet Me associating nothing with Me, I would meet you with forgiveness nearly as great.",
    narrator: "Anas ibn Malik",
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
