export interface Lesson {
  id: string;
  subject: string;
  code: string;
  color: string;
  title: string;
  week: number;
  objectives: string[];
  content: { heading: string; body: string }[];
  vocabulary?: { word: string; definition: string }[];
  checkQuestion: string;
  checkOptions: string[];
  checkAnswer: number;
}

export const LESSONS: Lesson[] = [
  {
    id: "1",
    subject: "English Language Arts",
    code: "ELA",
    color: "bg-subject-purple text-white",
    title: "The Giver — Setting & Theme",
    week: 12,
    objectives: [
      "Identify how the author uses setting to create mood and meaning",
      "Explain the central themes of conformity and freedom in The Giver",
      "Support ideas with evidence from the text",
    ],
    content: [
      {
        heading: "What is Setting?",
        body: "Setting is where and when a story takes place. In The Giver, Lois Lowry creates a community that looks perfect on the surface — everyone follows the same rules, families are assigned, and there is 'Sameness.' But as we read deeper, we see this order comes at a cost: the loss of colour, music, memory, and choice.",
      },
      {
        heading: "The Community as Setting",
        body: "The community Jonas lives in is deliberately vague — we never learn its name or exact location. This makes it feel like it could be anywhere. Key features: citizens follow strict rules called 'precision of language,' children are assigned to family units, and a Committee of Elders controls every major decision. This setting creates a mood of quiet unease beneath apparent peace.",
      },
      {
        heading: "Major Themes",
        body: "1. Conformity vs. Individuality — Everyone looks, speaks, and acts the same. Jonas begins to question this when he receives memories.\n\n2. Memory and History — The Giver holds all of humanity's memories. Without access to the past, the community cannot make wise choices.\n\n3. Freedom vs. Safety — The community chose Sameness to eliminate suffering. But they also eliminated joy, love, and beauty. Is that trade worth it?",
      },
      {
        heading: "Key Passage",
        body: "\"We relinquished colour when we relinquished sunshine and did away with differences... We gained control of many things. But we had to let go of others.\" — The Giver\n\nThink about this quote: what did the community gain? What did they lose? Was it worth it?",
      },
    ],
    vocabulary: [
      { word: "Sameness", definition: "The policy in Jonas's community of eliminating all differences to create equality and control" },
      { word: "Release", definition: "The community's euphemism for killing, used for rule-breakers, the elderly, and unwanted newborns" },
      { word: "Precision of language", definition: "The rule requiring citizens to say exactly what they mean — no exaggeration or metaphor" },
      { word: "Receiver", definition: "The person who holds all of society's collective memories, a rare and honoured role given to Jonas" },
    ],
    checkQuestion: "Why does the author make the community's location vague and unnamed?",
    checkOptions: [
      "Because Lowry forgot to name it",
      "To suggest this kind of society could exist anywhere, making it a warning for all readers",
      "Because Jonas never learned the name of his town",
      "To keep the story short",
    ],
    checkAnswer: 1,
  },
  {
    id: "2",
    subject: "Mathematics",
    code: "MATH",
    color: "bg-subject-blue text-white",
    title: "Introduction to Fractions",
    week: 12,
    objectives: [
      "Understand what a fraction represents (part of a whole)",
      "Identify the numerator and denominator and explain what each means",
      "Compare simple fractions using visual models",
    ],
    content: [
      {
        heading: "What is a Fraction?",
        body: "A fraction represents a part of a whole. If you cut a pizza into 4 equal slices and eat 1, you ate 1/4 of the pizza.\n\n• The bottom number (denominator) tells you how many equal parts the whole is divided into.\n• The top number (numerator) tells you how many of those parts you are talking about.",
      },
      {
        heading: "Reading Fractions",
        body: "1/2 → \"one half\" — one out of two equal parts\n3/4 → \"three quarters\" — three out of four equal parts\n2/5 → \"two fifths\" — two out of five equal parts\n\nThe denominator gives the fraction its name: halves, thirds, quarters, fifths, sixths…",
      },
      {
        heading: "Comparing Fractions",
        body: "Same denominator: The bigger the numerator, the larger the fraction.\n1/5 < 3/5 < 4/5\n\nSame numerator: The bigger the denominator, the smaller each piece — so the fraction is smaller.\n1/2 > 1/4 > 1/8\n\nThink of it this way: if you share a chocolate bar equally between 2 people vs. 8 people, each person gets more when there are only 2 people.",
      },
      {
        heading: "Equivalent Fractions",
        body: "Equivalent fractions look different but are equal in value.\n1/2 = 2/4 = 4/8\n\nTo make an equivalent fraction, multiply (or divide) both the numerator and denominator by the same number.\n1/2 × 3/3 = 3/6 ✓\n\nYou can check: if you simplify 3/6 by dividing both by 3, you get 1/2.",
      },
    ],
    vocabulary: [
      { word: "Numerator", definition: "The top number in a fraction — how many parts you have" },
      { word: "Denominator", definition: "The bottom number in a fraction — how many equal parts the whole is split into" },
      { word: "Equivalent fractions", definition: "Fractions that represent the same amount, e.g. 1/2 and 2/4" },
      { word: "Simplify", definition: "To reduce a fraction to its smallest form by dividing both numbers by their greatest common factor" },
    ],
    checkQuestion: "Which fraction is the largest?",
    checkOptions: ["1/8", "1/3", "1/2", "1/6"],
    checkAnswer: 2,
  },
  {
    id: "3",
    subject: "Science",
    code: "SCI",
    color: "bg-subject-teal text-white",
    title: "Ecosystems & Food Webs",
    week: 11,
    objectives: [
      "Define ecosystem and explain the roles of producers, consumers, and decomposers",
      "Construct and interpret a food web showing energy flow",
      "Predict the effect of removing one organism from a food web",
    ],
    content: [
      {
        heading: "What is an Ecosystem?",
        body: "An ecosystem is all the living things (biotic factors) and non-living things (abiotic factors — water, soil, sunlight, temperature) in an area, and how they interact with each other.\n\nExamples: a forest, a pond, the Arctic tundra, or even a backyard garden.",
      },
      {
        heading: "Producers, Consumers, and Decomposers",
        body: "Producers (plants, algae) — make their own food using sunlight through photosynthesis. They are the foundation of every food web.\n\nConsumers — eat other organisms for energy.\n• Primary consumers (herbivores) eat producers: rabbits, deer, caterpillars\n• Secondary consumers eat primary consumers: foxes, frogs, owls\n• Tertiary consumers are top predators: wolves, eagles, sharks\n\nDecomposers (fungi, bacteria, worms) — break down dead matter and return nutrients to the soil.",
      },
      {
        heading: "Food Chains and Food Webs",
        body: "A food chain is a simple line showing who eats whom:\nGrass → Grasshopper → Frog → Snake → Hawk\n\nA food web is more realistic — it shows all the feeding connections in an ecosystem at once. Most animals eat more than one thing, so food webs are made of many overlapping food chains.\n\nArrows always point from the food → to the eater (showing the direction energy flows).",
      },
      {
        heading: "What Happens When One Species is Removed?",
        body: "This is called a trophic cascade. Example: wolves were removed from Yellowstone in the 1920s. Without wolves, elk ate all the riverbank plants. Without plants, rivers eroded and fish declined. When wolves were reintroduced in 1995, the entire ecosystem recovered.\n\nThis shows how every species plays a role — even predators are essential to ecosystem health.",
      },
    ],
    vocabulary: [
      { word: "Ecosystem", definition: "All living and non-living things in an area and their interactions" },
      { word: "Producer", definition: "An organism that makes its own food using sunlight (plant, algae)" },
      { word: "Consumer", definition: "An organism that eats other organisms for energy" },
      { word: "Decomposer", definition: "An organism that breaks down dead matter and recycles nutrients" },
      { word: "Trophic cascade", definition: "A chain reaction in an ecosystem caused by adding or removing a key species" },
    ],
    checkQuestion: "Arrows in a food web point from the food to the eater. What do these arrows represent?",
    checkOptions: [
      "Who is faster",
      "The direction of energy flow",
      "Which animal is stronger",
      "The direction of water flow",
    ],
    checkAnswer: 1,
  },
  {
    id: "4",
    subject: "Social Studies",
    code: "SS",
    color: "bg-subject-orange text-white",
    title: "Alberta: Land & Community",
    week: 12,
    objectives: [
      "Describe the main geographic regions of Alberta and their characteristics",
      "Explain how geography has shaped the communities and economy of Alberta",
      "Identify Indigenous peoples whose traditional lands are in Alberta",
    ],
    content: [
      {
        heading: "Alberta's Geographic Regions",
        body: "Alberta has four main natural regions:\n\n1. Rocky Mountains (West) — rugged peaks, glaciers, and alpine meadows. Home to Banff and Jasper National Parks. Very little farming due to thin rocky soil.\n\n2. Foothills — rolling hills between the mountains and plains. Ranching and forestry are common here.\n\n3. Parkland — a mix of grassland and forest, rich soil. Good for farming and one of the most populated areas.\n\n4. Boreal Forest (North) — vast coniferous forest. Rich in wildlife, wetlands, and natural resources including oil sands.",
      },
      {
        heading: "Plains and Agriculture",
        body: "The Prairies cover much of southern Alberta. This flat, fertile land is ideal for growing wheat, canola, and barley — Alberta is one of Canada's top agricultural producers.\n\nThe dry southern region around Lethbridge uses irrigation from the Oldman River to grow crops in what would otherwise be semi-desert.",
      },
      {
        heading: "Indigenous Peoples of Alberta",
        body: "Before European settlement, many Indigenous nations lived on these lands for thousands of years:\n\n• Blackfoot Confederacy (Siksika, Piikani, Kainai) — southern Alberta plains\n• Cree Nation — central and northern Alberta\n• Nakoda (Stoney) — foothills and mountains\n• Dene — northern regions\n• Métis — throughout Alberta, especially the parkland belt\n\nMany of these communities are still vibrant today and their languages, cultures, and rights are protected under Treaty agreements.",
      },
      {
        heading: "Alberta's Economy",
        body: "Alberta's economy is closely linked to its geography:\n\n• Energy — the oil sands in the north (Fort McMurray area) hold one of the world's largest oil reserves\n• Agriculture — grain farming on the plains, cattle ranching in the foothills\n• Forestry — logging in the boreal forest\n• Tourism — mountains attract millions of visitors each year\n\nThis diversity means Alberta's economy can survive when one sector slows down.",
      },
    ],
    vocabulary: [
      { word: "Geographic region", definition: "An area with shared physical characteristics such as climate, landforms, and vegetation" },
      { word: "Boreal forest", definition: "A large northern forest of coniferous (evergreen) trees, also called the taiga" },
      { word: "Treaty", definition: "A formal agreement between the Canadian Crown and Indigenous nations regarding land and rights" },
      { word: "Irrigation", definition: "Artificially supplying water to land for growing crops" },
    ],
    checkQuestion: "Why is southern Alberta suitable for growing crops even though parts of it are semi-arid?",
    checkOptions: [
      "Because of heavy rainfall from the Rocky Mountains",
      "Because of irrigation systems that bring water from rivers",
      "Because the soil is naturally very wet",
      "Because crops in Alberta don't need much water",
    ],
    checkAnswer: 1,
  },
  {
    id: "5",
    subject: "Physical Education & Wellness",
    code: "PE",
    color: "bg-subject-pink text-white",
    title: "Team Sports Strategy",
    week: 12,
    objectives: [
      "Understand the difference between offence and defence strategies",
      "Apply communication and spatial awareness in team play",
      "Reflect on how fair play and respect contribute to a positive sport experience",
    ],
    content: [
      {
        heading: "What is Strategy in Sport?",
        body: "Strategy is a plan your team uses to score points or prevent the other team from scoring. Good strategy involves positioning (where you stand), communication (talking to teammates), and reading the game (watching what the other team is doing).",
      },
      {
        heading: "Offence: Creating Space and Scoring",
        body: "When your team has the ball, your goal is to create space and get the ball to a player in a good position to score.\n\nKey principles:\n• Spread out — don't bunch together\n• Move into open space before calling for the ball\n• Use passes to draw defenders out of position\n• Communicate constantly — call for the ball, point to where you want teammates to go",
      },
      {
        heading: "Defence: Pressure and Position",
        body: "When the other team has the ball, your goal is to slow them down and take the ball back.\n\nKey principles:\n• Mark your player — stay between them and your goal\n• Apply pressure to the ball carrier to force mistakes\n• Communicate who is covering which player\n• Don't all chase the ball — hold your position",
      },
      {
        heading: "Fair Play and Respect",
        body: "Strategy only works when players trust each other. Fair play means:\n• Playing within the rules even when no referee is watching\n• Encouraging teammates after mistakes\n• Shaking hands or acknowledging opponents at the end\n• Accepting referee decisions without argument\n\nIn Alberta's Physical Education curriculum, how you play is as important as whether you win.",
      },
    ],
    checkQuestion: "On offence, why should players spread out rather than stay together?",
    checkOptions: [
      "To make the team look bigger",
      "To create space and make it harder for defenders to mark everyone",
      "Because the rules require it",
      "To tire out defenders by making them run more",
    ],
    checkAnswer: 1,
  },
];
