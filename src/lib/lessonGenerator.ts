// Generates full lesson content (objectives, sections, vocabulary focus,
// a teaching tip, and a check-for-understanding question) for any curriculum
// topic. Used for the ~1,755 weeks that don't have hand-authored lessons.
//
// Content is built from two layers so it doesn't read as one template with
// the topic name swapped in:
//   1. A subject-level lesson structure (warm-up → core → practice → close)
//   2. A keyword-matched "teaching tip" specific to the kind of topic it is
//      (fractions vs. geometry, ecosystems vs. forces, poetry vs. persuasive
//      writing, geography vs. government) — each tip is a domain-accurate,
//      generically-true teaching insight, not a fabricated fact about the
//      specific week.

export interface GeneratedContent {
  objectives: string[];
  content: { heading: string; body: string }[];
  vocabulary: { word: string; definition: string }[];
  checkQuestion: string;
  checkOptions: string[];
  checkAnswer: number;
}

const STOP_WORDS = new Set([
  "and", "the", "of", "in", "to", "a", "an", "for", "with", "on", "from",
  "our", "its", "that", "this", "your", "into", "as", "at", "us",
]);

function focusTerms(topic: string): string[] {
  const words = topic
    .replace(/[^\w\s'-]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOP_WORDS.has(w.toLowerCase()));

  const seen = new Set<string>();
  const terms: string[] = [];
  for (const w of words) {
    const key = w.toLowerCase();
    if (!seen.has(key)) { seen.add(key); terms.push(w); }
    if (terms.length === 3) break;
  }
  return terms.length ? terms : [topic];
}

// ── Keyword-matched teaching tips ─────────────────────────────────────────

function matchTip(topic: string, bank: { keys: string[]; tip: string }[], fallback: string): string {
  const t = topic.toLowerCase();
  for (const entry of bank) {
    if (entry.keys.some((k) => t.includes(k))) return entry.tip;
  }
  return fallback;
}

const MATH_TIPS: { keys: string[]; tip: string }[] = [
  { keys: ["fraction"], tip: "Fractions are easiest to grasp using concrete models — fraction circles, strips, or folded paper — before moving to numbers alone. Keep reinforcing that the denominator names the size of the pieces and the numerator counts how many." },
  { keys: ["decimal"], tip: "Decimals extend the base-ten place value system past the ones place. Anchoring decimals to money (cents as hundredths) or metric measurement gives students an intuitive reference point." },
  { keys: ["geometry", "shape", "angle", "polygon", "symmetry"], tip: "Geometry sticks best when students build, fold, and sort shapes with their hands before naming properties formally. Push students to justify classifications using specific properties — sides, angles, symmetry — not just appearance." },
  { keys: ["measur", "length", "area", "perimeter", "volume", "capacity", "mass"], tip: "Measurement concepts land best when students physically measure real objects in the room before working from a worksheet. Always tie the unit to something familiar — a paperclip, a doorframe, a step." },
  { keys: ["pattern", "algebra", "variable", "equation"], tip: "Patterns are the foundation of algebraic thinking. Have students describe a pattern in words before writing it symbolically — that's the bridge from concrete reasoning to abstract notation." },
  { keys: ["data", "graph", "chart", "statistic", "probability"], tip: "Data handling is most meaningful when students collect their own data first — a quick class survey or simple experiment — rather than only reading pre-made graphs." },
  { keys: ["number sense", "count", "addition", "subtract", "place value"], tip: "Strong number sense comes from flexible strategies, not memorized facts alone. Invite multiple ways to solve the same problem (counting on, making tens, using known facts) and compare approaches as a class." },
  { keys: ["multipl", "divi", "array", "factor"], tip: "Multiplication and division are two sides of the same relationship. Use arrays or equal groups so both operations visibly come from the same concrete model." },
  { keys: ["money", "currency", "price"], tip: "Money problems combine number sense with real-world reasoning. Play currency lets students physically combine, exchange, and make change instead of just calculating on paper." },
  { keys: ["time", "clock", "calendar", "duration"], tip: "Time is genuinely abstract for many students. An analog clock face with movable hands makes the passage of time visible in a way digital time alone doesn't." },
];

const SCI_TIPS: { keys: string[]; tip: string }[] = [
  { keys: ["energy", "electric", "circuit"], tip: "Energy topics land best when framed as transfer or transformation — ask 'where does the energy come from, and where does it go?' rather than defining energy in the abstract." },
  { keys: ["force", "motion", "machine", "gravity", "friction"], tip: "Force and motion concepts benefit from direct physical experimentation — pushing, pulling, rolling objects — so students feel the relationship before naming it." },
  { keys: ["matter", "state", "solid", "liquid", "gas"], tip: "States of matter are best explored through direct observation of everyday materials changing state — ice melting, water boiling — rather than diagrams alone." },
  { keys: ["organism", "living", "plant", "animal", "life cycle", "adaptation"], tip: "When studying living things, compare structures across a few real or pictured organisms rather than describing just one — comparison builds far deeper understanding than a single example." },
  { keys: ["ecosystem", "habitat", "wetland", "food web", "food chain", "environment"], tip: "Ecosystem topics come alive through food web mapping — have students draw arrows connecting real organisms rather than memorizing an isolated vocabulary list." },
  { keys: ["earth", "rock", "soil", "weather", "water cycle", "climate", "season"], tip: "Earth science topics benefit from connecting classroom learning to what students can actually observe locally that day — the sky, the soil, the weather." },
  { keys: ["light", "sound", "sight", "vibration", "wave"], tip: "Light and sound are best explored through simple hands-on demonstrations — mirrors, prisms, tuning forks, homemade instruments — that let students observe the phenomenon directly." },
  { keys: ["body", "health", "nutrition", "muscle", "organ"], tip: "Human body topics benefit from relatable analogies — the heart as a pump, the lungs as balloons — to make invisible internal systems concrete." },
  { keys: ["space", "planet", "solar system", "star", "moon"], tip: "Space topics are naturally abstract since nothing is directly observable up close — scale models and simulations do far more work here than description alone." },
];

const ELA_TIPS: { keys: string[]; tip: string }[] = [
  { keys: ["poem", "poetry", "verse"], tip: "Poetry is best experienced aloud first — read it to students before they read it themselves, so they hear its rhythm and sound before analysing its structure." },
  { keys: ["narrative", "story", "fiction", "novel", "character", "setting", "plot"], tip: "When studying narrative texts, anchor discussion in the core story elements — character, setting, conflict, resolution — before moving to deeper thematic analysis." },
  { keys: ["persuasi", "argument", "opinion", "debate"], tip: "Persuasive writing is strongest when students choose a topic they genuinely care about — real conviction produces far stronger arguments than an assigned position they don't believe." },
  { keys: ["grammar", "sentence", "punctuation", "spelling"], tip: "Grammar concepts transfer best when practiced inside students' own writing, not just isolated worksheet drills — have them find and fix the target skill in something they wrote." },
  { keys: ["non-fiction", "nonfiction", "informational", "comprehension", "article"], tip: "Non-fiction comprehension improves when students preview text features — headings, captions, bold words — before reading the full passage." },
  { keys: ["vocabulary", "word study"], tip: "New vocabulary sticks best when students meet it in context multiple times and use it actively in their own speaking or writing, not just copy a definition." },
  { keys: ["speak", "listen", "discussion", "oral"], tip: "Speaking and listening skills grow through structured, low-stakes practice — partner talk before whole-class discussion lowers anxiety and raises participation." },
  { keys: ["writ", "compos", "paragraph", "essay"], tip: "Writing improves fastest with short, frequent practice and specific feedback on one target skill at a time, rather than broad feedback on everything at once." },
];

const SS_TIPS: { keys: string[]; tip: string }[] = [
  { keys: ["geograph", "land", "region", "map", "climate"], tip: "Geography concepts anchor best in an actual map — have students locate the specific place being studied before discussing its features." },
  { keys: ["government", "law", "right", "citizen", "democracy", "vote"], tip: "Government and rights topics become concrete through classroom-scale examples — comparing how a classroom rule is made to how a law is made, for instance." },
  { keys: ["history", "past", "treaty", "settlement", "war", "confederation"], tip: "History topics benefit from primary sources — a photograph, an artifact, a first-hand account — which make the past feel real rather than abstract." },
  { keys: ["econom", "resource", "trade", "industry", "goods", "service"], tip: "Economic concepts click when tied to something students already understand, like trading items at recess, before scaling up to community or national examples." },
  { keys: ["culture", "community", "tradition", "identity", "celebration"], tip: "Culture and community topics are richer when students share their own family or community traditions alongside what's being studied, making the content personally relevant." },
  { keys: ["indigenous", "first nations", "métis", "metis", "inuit"], tip: "When teaching about Indigenous peoples and history, prioritize accurate, respectful sources and — where possible — First Nations, Métis, and Inuit voices directly, rather than secondhand summaries alone." },
];

const FALLBACK_TIP: Record<string, string> = {
  MATH: "Move from concrete to pictorial to abstract — hands-on materials first, then drawings, then symbols and numbers alone.",
  SCI: "Lead with a question or observation rather than a definition — curiosity before vocabulary produces deeper retention.",
  ELA: "Model the skill explicitly with a real example before asking students to apply it independently.",
  SS: "Ground the topic in something visual or local before moving to abstract concepts or unfamiliar places.",
};

// ── Objectives ─────────────────────────────────────────────────────────────

function objectivesFor(code: string, topic: string): string[] {
  switch (code) {
    case "ELA":
      return [
        `Engage with texts and ideas connected to "${topic}"`,
        "Analyse how structure, language, or craft shape meaning",
        "Communicate understanding clearly through writing or discussion",
      ];
    case "MATH":
      return [
        `Understand the key concept behind "${topic}"`,
        "Apply a clear strategy to solve related problems",
        "Explain reasoning using precise mathematical language",
      ];
    case "SCI":
      return [
        `Investigate "${topic}" through observation and structured inquiry`,
        "Describe key concepts and connect them to real-world phenomena",
        "Record and communicate findings using scientific vocabulary",
      ];
    case "SS":
      return [
        `Describe "${topic}" in its geographic, historical, or social context`,
        "Examine connections between people, place, and community",
        "Reflect on how this topic relates to identity and citizenship",
      ];
    default:
      return [`Understand the key ideas behind "${topic}"`];
  }
}

// ── Content sections ─────────────────────────────────────────────────────

function contentFor(code: string, topic: string, unit: string): { heading: string; body: string }[] {
  const tipBank = code === "MATH" ? MATH_TIPS : code === "SCI" ? SCI_TIPS : code === "ELA" ? ELA_TIPS : SS_TIPS;
  const tip = matchTip(topic, tipBank, FALLBACK_TIP[code] ?? FALLBACK_TIP.MATH);

  switch (code) {
    case "ELA":
      return [
        {
          heading: `Warm-Up: ${topic}`,
          body: `Begin by activating prior knowledge — ask students what they already know or wonder about "${topic}." Record responses on the board as a reference point to revisit at the end of class, within the broader "${unit}" unit.`,
        },
        {
          heading: "Core Skill Focus",
          body: `Model the target skill explicitly: read a short passage or example aloud, thinking aloud about your own interpretation. Point out specific words, structure, or techniques connected to "${topic}" so students see an expert reader's process, not just a finished answer.`,
        },
        {
          heading: "Teaching Tip",
          body: tip,
        },
        {
          heading: "Guided & Independent Practice",
          body: `In pairs, students apply the skill to a new short text or prompt related to "${topic}" — circulate and ask "What makes you say that?" rather than confirming answers directly. Close with a short independent writing or response task, and have a few students share one sentence about what they learned.`,
        },
      ];
    case "MATH":
      return [
        {
          heading: "Warm-Up: Activate Prior Knowledge",
          body: `Start with two or three review questions on a skill students already know that connects to "${topic}." This bridges prior learning to the new concept within the "${unit}" unit and surfaces gaps before instruction begins.`,
        },
        {
          heading: `Core Concept: ${topic}`,
          body: `Introduce the concept using concrete materials or visuals before moving to numbers alone (concrete → pictorial → abstract). Model one example step-by-step, narrating your thinking aloud so students hear the reasoning, not just the procedure.`,
        },
        {
          heading: "Teaching Tip",
          body: tip,
        },
        {
          heading: "Worked Examples & Practice",
          body: `Work through two or three examples of increasing difficulty as a class, asking a student to explain each step before moving on. Then have students practice independently or in pairs, including at least one word problem so the skill connects to a real context.`,
        },
      ];
    case "SCI":
      return [
        {
          heading: `Hook: Wondering About ${topic}`,
          body: `Open with a question, image, or short demonstration related to "${topic}" that sparks curiosity. Ask students to make a prediction before any explanation is given — this is the heart of inquiry-based science.`,
        },
        {
          heading: "Key Concepts",
          body: `Introduce the core ideas behind "${topic}," part of the "${unit}" unit, using clear, age-appropriate language. Use a diagram, model, or real object wherever possible — abstract concepts stick better when students can see or touch something concrete.`,
        },
        {
          heading: "Teaching Tip",
          body: tip,
        },
        {
          heading: "Investigation & Real-World Connection",
          body: `Have students explore "${topic}" hands-on — through an experiment, observation, or sorting activity — recording observations before drawing conclusions. Close by asking: "Where might we see this outside of school?"`,
        },
      ];
    case "SS":
      return [
        {
          heading: `Introduction to ${topic}`,
          body: `Begin by asking what students already associate with "${topic}." Use a map, image, or short story as an entry point into the "${unit}" unit, grounding the topic in something visual or narrative.`,
        },
        {
          heading: "Key Ideas",
          body: `Present the key context behind "${topic}" — the people, place, and time involved. Where relevant, highlight multiple perspectives: whose voices are included, and whose might be missing?`,
        },
        {
          heading: "Teaching Tip",
          body: tip,
        },
        {
          heading: "Discussion & Reflection",
          body: `Facilitate a discussion connecting "${topic}" to ideas of community, identity, or citizenship, encouraging students to support opinions with reasoning. Close with a written or drawn reflection: how does "${topic}" connect to their own community or experience?`,
        },
      ];
    default:
      return [{ heading: topic, body: `Explore "${topic}" as part of the "${unit}" unit.` }];
  }
}

// ── Check for understanding ────────────────────────────────────────────

function checkFor(code: string, topic: string): { question: string; options: string[]; answer: number } {
  switch (code) {
    case "ELA":
      return {
        question: `When exploring "${topic}," what should a reader do first with a new text?`,
        options: [
          "Skip straight to the end",
          "Preview the text and predict what it might be about",
          "Ignore the title and headings",
          "Read as fast as possible without stopping",
        ],
        answer: 1,
      };
    case "MATH":
      return {
        question: `Before solving a problem about "${topic}," what's the most effective first step?`,
        options: [
          "Guess an answer immediately",
          "Identify what is being asked and what information you have",
          "Reach for a calculator right away",
          "Ignore the units or labels in the problem",
        ],
        answer: 1,
      };
    case "SCI":
      return {
        question: `When investigating "${topic}," what should happen before drawing a conclusion?`,
        options: [
          "Decide the answer first, then look for evidence",
          "Make and record careful observations",
          "Skip the experiment and copy a classmate's result",
          "Assume the first idea you had is correct",
        ],
        answer: 1,
      };
    case "SS":
      return {
        question: `When learning about "${topic}," why is it useful to consider multiple perspectives?`,
        options: [
          "It isn't useful — only one perspective matters",
          "It gives a fuller, more accurate understanding of people and events",
          "It makes the lesson take longer",
          "It replaces the need for evidence",
        ],
        answer: 1,
      };
    default:
      return { question: `What is the main idea of "${topic}"?`, options: ["A", "B", "C", "D"], answer: 0 };
  }
}

export function generateLessonContent(code: string, topic: string, unit: string): GeneratedContent {
  const check = checkFor(code, topic);
  return {
    objectives: objectivesFor(code, topic),
    content: contentFor(code, topic, unit),
    vocabulary: focusTerms(topic).map((word) => ({
      word,
      definition: "Focus term for this lesson — introduce it early and build a working definition together as students explore the topic.",
    })),
    checkQuestion: check.question,
    checkOptions: check.options,
    checkAnswer: check.answer,
  };
}
