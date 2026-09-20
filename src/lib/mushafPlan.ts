import { JUZ_START_PAGES, SURAHS, TOTAL_PAGES, getSurahById } from "@/data/mushaf-index";

/**
 * Turning "five juz this year" into "Al-Mulk 1–30, then Al-Qalam 1–52, …"
 * — a plan anchored to where the student actually is in the mushaf rather
 * than to an abstract count.
 *
 * Pure, and dependency-free apart from the mushaf index, for the same
 * reason yearlyPlan.ts is: the teacher's browser previews the ranges
 * before saving and the server rebuilds them on submit, and the two have
 * to agree exactly.
 *
 * ── Direction ────────────────────────────────────────────────────────
 * The one thing a generator like this gets wrong if nobody tells it: most
 * hifz students work *backwards* through the mushaf, starting at An-Nas
 * and moving up through Juz 30, 29, 28. Others read forward from
 * Al-Baqarah. Within a surah both go 1 → n. So "hifz" order is surahs
 * descending with ayahs ascending inside each, which is not a reversal of
 * the mushaf and cannot be produced by walking it backwards.
 */

export type Direction = "forward" | "hifz";

export interface Position {
  surah: number;
  ayah: number;
}

export interface MushafBlock {
  from_surah: number;
  from_ayah: number;
  to_surah: number;
  to_ayah: number;
  /** How many ayahs the block covers, summed across the surahs it spans. */
  ayahs: number;
}

export const TOTAL_AYAHS = SURAHS.reduce((sum, s) => sum + s.ayahs, 0); // 6236
/** The average only — juz run from 21 to 23 pages, and sizing a target
 *  with this average is exactly the mistake pagesForJuz() exists to avoid.
 *  Kept for display ("about 20 pages a juz"), never for arithmetic. */
export const AVERAGE_PAGES_PER_JUZ = TOTAL_PAGES / 30;

/** Named the way a teacher says it out loud, not the way a developer
 *  would: "An-Nas and up" is what gets said in a staff room, and
 *  "hifz order" is a term half of them would read two ways. */
export const DIRECTION_LABEL: Record<Direction, string> = {
  hifz: "An-Nas and up — 114 toward Al-Baqarah",
  forward: "Al-Baqarah and down — 2 toward An-Nas",
};

/** One line for a form's help text. */
export const DIRECTION_HINT: Record<Direction, string> = {
  hifz: "The usual hifz order: start at the short surahs and work up the mushaf.",
  forward: "Straight through the mushaf from the beginning.",
};

/**
 * Where a plan begins for a student with nothing on file yet — the first
 * surah in this direction. An-Nas for the usual hifz order; Al-Baqarah,
 * not Al-Fatihah, going the other way, since Al-Fatihah is already known
 * by anyone starting a memorisation plan.
 */
export function firstPosition(direction: Direction): Position {
  return direction === "hifz" ? { surah: 114, ayah: 1 } : { surah: 2, ayah: 1 };
}

/** Surah ids in the order this direction works through them. */
export function surahOrder(direction: Direction): number[] {
  const ids = SURAHS.map((s) => s.id);
  return direction === "hifz" ? [...ids].reverse() : ids;
}

export function isValidPosition(p: Position): boolean {
  const s = getSurahById(p.surah);
  return !!s && Number.isInteger(p.ayah) && p.ayah >= 1 && p.ayah <= s.ayahs;
}

/**
 * Where the next piece of work begins, given the last ayah the student
 * has actually memorised. Rolling past the end of a surah moves to the
 * next one *in this direction* — which for hifz order means the surah
 * before it, at ayah 1.
 */
export function nextPosition(last: Position, direction: Direction): Position | null {
  const s = getSurahById(last.surah);
  if (!s) return null;
  if (last.ayah < s.ayahs) return { surah: last.surah, ayah: last.ayah + 1 };

  const order = surahOrder(direction);
  const i = order.indexOf(last.surah);
  if (i === -1 || i + 1 >= order.length) return null; // finished the mushaf
  return { surah: order[i + 1], ayah: 1 };
}

/**
 * Walks `ayahs` ayahs from a starting position, returning one block per
 * surah crossed. Stops early at the end of the mushaf rather than
 * wrapping — a plan that silently ran off An-Nas into Al-Fatihah would be
 * worse than one that is visibly short.
 */
export function walk(start: Position, direction: Direction, ayahs: number): MushafBlock[] {
  const order = surahOrder(direction);
  const startIdx = order.indexOf(start.surah);
  if (startIdx === -1 || ayahs <= 0) return [];

  const blocks: MushafBlock[] = [];
  let remaining = Math.round(ayahs);

  for (let i = startIdx; i < order.length && remaining > 0; i++) {
    const s = getSurahById(order[i])!;
    const from = i === startIdx ? Math.max(1, Math.min(start.ayah, s.ayahs)) : 1;
    const take = Math.min(remaining, s.ayahs - from + 1);
    if (take <= 0) continue;
    blocks.push({
      from_surah: s.id,
      from_ayah: from,
      to_surah: s.id,
      to_ayah: from + take - 1,
      ayahs: take,
    });
    remaining -= take;
  }
  return blocks;
}

/** The position immediately after a run of blocks — where the next
 *  milestone picks up. */
export function endOf(blocks: MushafBlock[]): Position | null {
  const last = blocks[blocks.length - 1];
  return last ? { surah: last.to_surah, ayah: last.to_ayah } : null;
}

/* ── Sizing ────────────────────────────────────────────────────────────
   How many ayahs a target amounts to, which depends on the unit and, for
   the page-based units, on where in the mushaf you are standing. */

/**
 * How many ayahs of the mushaf lie before a given page.
 *
 * Built by asking each surah what it contributes, rather than by adding up
 * per-surah page spans. Pages are shared — a page routinely carries the
 * end of one surah and the start of the next — so summing every surah's
 * span gives well over 604 and any budget spent that way runs out early.
 * That bug made "30 juz from Al-Fatihah" come to 5,475 ayahs instead of
 * the whole 6,236.
 *
 * Within the surah straddling the page the split is proportional: the
 * index records which pages a surah spans, not which ayah each page break
 * falls on. So a page boundary resolves to within a few ayahs rather than
 * exactly — fine for laying out a year, and the reason a juz target will
 * not land on a textbook juz boundary to the ayah.
 */
export function ayahsBeforePage(page: number): number {
  const p = Math.max(1, Math.min(TOTAL_PAGES + 1, page));
  let total = 0;
  for (const s of SURAHS) {
    if (s.endPage < p) {
      total += s.ayahs;
    } else if (s.startPage < p) {
      const span = Math.max(1, s.endPage - s.startPage + 1);
      total += (s.ayahs * (p - s.startPage)) / span;
    }
  }
  return total;
}

/** Roughly which page a position falls on — proportional inside the
 *  surah, for the same reason as above. */
export function pageOfPosition(pos: Position): number {
  const s = getSurahById(pos.surah);
  if (!s) return 1;
  const span = Math.max(1, s.endPage - s.startPage + 1);
  const through = Math.floor(((pos.ayah - 1) / Math.max(1, s.ayahs)) * span);
  return Math.min(s.endPage, s.startPage + through);
}

/** First and last page of a juz, from the real boundaries. */
function juzPages(juz: number): { first: number; last: number } {
  const j = Math.max(1, Math.min(30, juz));
  return {
    first: JUZ_START_PAGES[j - 1],
    last: j < 30 ? JUZ_START_PAGES[j] - 1 : TOTAL_PAGES,
  };
}

function juzOfPage(page: number): number {
  let j = 1;
  for (let i = 0; i < JUZ_START_PAGES.length; i++) {
    if (page >= JUZ_START_PAGES[i]) j = i + 1;
  }
  return j;
}

/**
 * A page target, in ayahs — measured between two points on the page line
 * rather than accumulated surah by surah.
 */
export function ayahsForPages(start: Position, direction: Direction, pages: number): number {
  if (pages <= 0) return 0;
  const from = pageOfPosition(start);
  const to = direction === "hifz" ? from - pages : from + pages;
  const a = ayahsBeforePage(direction === "hifz" ? to : from);
  const b = ayahsBeforePage(direction === "hifz" ? from + 1 : to + 1);
  return Math.max(0, Math.round(Math.abs(b - a)));
}

/**
 * A juz target, in pages — walked across the real juz boundaries rather
 * than multiplied by an average.
 *
 * Juz are not equal: Juz 1 runs 21 pages, Juz 30 runs 23. Pricing them at
 * 604÷30 made "one juz from An-Naba" come out at 338 ayahs when Juz 30
 * actually holds 564 — a third of the year's work missing, on the single
 * most common hifz plan there is.
 */
export function pagesForJuz(start: Position, direction: Direction, count: number): number {
  if (count <= 0) return 0;
  let juzLeft = count;
  let pages = 0;
  let page = pageOfPosition(start);

  // Bounded: 30 juz is the whole mushaf, so anything beyond that is a
  // malformed request rather than a long plan.
  for (let guard = 0; guard < 40 && juzLeft > 1e-9; guard++) {
    const j = juzOfPage(page);
    const { first, last } = juzPages(j);
    const length = last - first + 1;
    const available = direction === "hifz" ? page - first + 1 : last - page + 1;
    if (available <= 0) break;

    const fraction = available / length;
    if (fraction >= juzLeft) {
      pages += juzLeft * length;
      juzLeft = 0;
    } else {
      pages += available;
      juzLeft -= fraction;
      page = direction === "hifz" ? first - 1 : last + 1;
      if (page < 1 || page > TOTAL_PAGES) break;
    }
  }
  return pages;
}

/** Ayahs in the next `count` surahs, starting from a mid-surah position. */
export function ayahsForSurahs(start: Position, direction: Direction, count: number): number {
  const order = surahOrder(direction);
  const startIdx = order.indexOf(start.surah);
  if (startIdx === -1 || count <= 0) return 0;

  let ayahs = 0;
  for (let n = 0; n < count && startIdx + n < order.length; n++) {
    const s = getSurahById(order[startIdx + n])!;
    const from = n === 0 ? Math.max(1, Math.min(start.ayah, s.ayahs)) : 1;
    ayahs += s.ayahs - from + 1;
  }
  return ayahs;
}

/**
 * The year's target, in ayahs. "lesson" has no mushaf meaning — it counts
 * sessions, not text — so it returns 0 and the caller falls back to the
 * plain, unanchored generator.
 */
export function targetInAyahs(
  start: Position,
  direction: Direction,
  unit: string,
  amount: number
): number {
  if (amount <= 0) return 0;
  switch (unit) {
    case "ayah":
      return Math.round(amount);
    case "line":
      // The index has no line data. A Madani page is fifteen lines, which
      // is the only honest conversion available and is good enough for a
      // year's target.
      return ayahsForPages(start, direction, amount / 15);
    case "page":
      return ayahsForPages(start, direction, amount);
    case "juz":
      return ayahsForPages(start, direction, pagesForJuz(start, direction, amount));
    case "surah":
      return ayahsForSurahs(start, direction, Math.round(amount));
    default:
      return 0;
  }
}

/** How much is left between a position and the end of the mushaf in this
 *  direction — so the form can say "that is more than remains" instead of
 *  silently generating a short plan. */
export function ayahsRemaining(start: Position, direction: Direction): number {
  const order = surahOrder(direction);
  const startIdx = order.indexOf(start.surah);
  if (startIdx === -1) return 0;
  let total = 0;
  for (let i = startIdx; i < order.length; i++) {
    const s = getSurahById(order[i])!;
    const from = i === startIdx ? Math.max(1, Math.min(start.ayah, s.ayahs)) : 1;
    total += s.ayahs - from + 1;
  }
  return total;
}

/* ── Segmenting ────────────────────────────────────────────────────── */

export interface MushafSegment {
  from_surah: number;
  from_ayah: number;
  to_surah: number;
  to_ayah: number;
  /** Ayahs in this segment, whatever unit the plan is counted in. */
  ayahs: number;
  /** The plan's own unit, apportioned to this segment. */
  units: number;
  label: string;
}

/**
 * Splits the year's span into `segments` consecutive stretches of the
 * mushaf, each labelled with the surahs it covers.
 *
 * Ayahs are apportioned on a cumulative curve, the same trick the plain
 * generator uses: each segment takes the difference between two rounded
 * running totals, so rounding cannot drift and the segments together
 * cover exactly the intended span.
 */
export function segmentMushaf(
  start: Position,
  direction: Direction,
  totalAyahs: number,
  segments: number,
  unit: string,
  totalUnits: number
): MushafSegment[] {
  const count = Math.max(1, Math.min(52, Math.floor(segments)));
  const capped = Math.min(totalAyahs, ayahsRemaining(start, direction));
  if (capped <= 0) return [];

  const at = (i: number) => Math.round((capped * i) / count);
  const unitAt = (i: number) => Math.round(((totalUnits * i) / count) * 100) / 100;

  const out: MushafSegment[] = [];
  let cursor: Position | null = start;

  for (let i = 0; i < count; i++) {
    if (!cursor) break;
    const take = at(i + 1) - at(i);
    if (take <= 0) continue;

    const blocks = walk(cursor, direction, take);
    if (blocks.length === 0) break;

    const first = blocks[0];
    const last = blocks[blocks.length - 1];
    out.push({
      from_surah: first.from_surah,
      from_ayah: first.from_ayah,
      to_surah: last.to_surah,
      to_ayah: last.to_ayah,
      ayahs: blocks.reduce((s, b) => s + b.ayahs, 0),
      units: Math.round((unitAt(i + 1) - unitAt(i)) * 100) / 100,
      label: formatRange(
        { surah: first.from_surah, ayah: first.from_ayah },
        { surah: last.to_surah, ayah: last.to_ayah }
      ),
    });

    cursor = nextPosition({ surah: last.to_surah, ayah: last.to_ayah }, direction);
  }

  // Rounding inside `walk` can leave the final segment a few ayahs short
  // of the surah it was heading for. Extending it to the end of that
  // surah is almost always what the teacher meant: a milestone that stops
  // at "Al-Qalam 49 of 52" is an artefact, not a decision.
  const tail = out[out.length - 1];
  if (tail) {
    const s = getSurahById(tail.to_surah);
    if (s && tail.to_ayah > s.ayahs - 4 && tail.to_ayah < s.ayahs) {
      tail.ayahs += s.ayahs - tail.to_ayah;
      tail.to_ayah = s.ayahs;
      tail.label = formatRange(
        { surah: tail.from_surah, ayah: tail.from_ayah },
        { surah: tail.to_surah, ayah: tail.to_ayah }
      );
    }
  }

  void unit;
  return out;
}

/* ── Labels ────────────────────────────────────────────────────────── */

export function surahName(id: number): string {
  return getSurahById(id)?.englishName ?? `Surah ${id}`;
}

export function surahNameArabic(id: number): string {
  return getSurahById(id)?.name ?? "";
}

/**
 * "Al-Mulk 1–30" when a range sits inside one surah, "Al-Mulk 1 – Al-Qalam
 * 52" when it crosses. A whole surah drops the ayah numbers entirely,
 * because "Al-Ikhlas 1–4" is a clumsy way of writing "Al-Ikhlas".
 */
export function formatRange(from: Position, to: Position): string {
  const a = getSurahById(from.surah);
  const b = getSurahById(to.surah);
  if (!a || !b) return "";

  if (from.surah === to.surah) {
    const whole = from.ayah === 1 && to.ayah === a.ayahs;
    return whole ? a.englishName : `${a.englishName} ${from.ayah}–${to.ayah}`;
  }
  const left = from.ayah === 1 ? a.englishName : `${a.englishName} ${from.ayah}`;
  const right = to.ayah === b.ayahs ? b.englishName : `${b.englishName} ${to.ayah}`;
  return `${left} – ${right}`;
}

/** For a milestone row that already shows its own dates and figures. */
export function formatPosition(p: Position): string {
  const s = getSurahById(p.surah);
  if (!s) return "";
  return `${s.englishName} ${p.ayah}`;
}
