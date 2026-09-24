import { JUZ_START_PAGES, PAGE_STARTS, SURAHS, TOTAL_PAGES, getSurahById } from "@/data/mushaf-index";
import { addDays } from "@/lib/planDates";
import { countInstructionalDays, isInstructionalDay, type SchoolCalendar } from "@/lib/schoolCalendar";
import { startOfWeek, type PlanUnit } from "@/lib/yearlyPlan";

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

/* Page geometry, built once from PAGE_STARTS — the real per-page layout
   the mushaf reader itself renders from — so every page question below is
   an array read. The Madinah mushaf never splits an ayah across a page
   break, so "which page is this ayah on" has exactly one answer. */

/** Global 0-based index of each surah's first ayah, by surah id. */
const SURAH_OFFSET: number[] = (() => {
  const out = new Array<number>(SURAHS.length + 1).fill(0);
  let total = 0;
  for (const s of SURAHS) {
    out[s.id] = total;
    total += s.ayahs;
  }
  return out;
})();

/** The page every ayah sits on, by global index. */
const AYAH_PAGE: Uint16Array = (() => {
  const out = new Uint16Array(TOTAL_AYAHS);
  for (let p = 1; p <= TOTAL_PAGES; p++) {
    const [s, a] = PAGE_STARTS[p - 1];
    const from = SURAH_OFFSET[s] + a - 1;
    const to =
      p < TOTAL_PAGES ? SURAH_OFFSET[PAGE_STARTS[p][0]] + PAGE_STARTS[p][1] - 1 : TOTAL_AYAHS;
    out.fill(p, from, to);
  }
  return out;
})();

/** How many ayahs each page holds, by page number. */
const PAGE_AYAHS: Uint16Array = (() => {
  const out = new Uint16Array(TOTAL_PAGES + 1);
  for (const p of AYAH_PAGE) out[p]++;
  return out;
})();

/** Exactly which page a position falls on. */
export function pageOfPosition(pos: Position): number {
  const s = getSurahById(pos.surah);
  if (!s) return 1;
  const ayah = Math.max(1, Math.min(s.ayahs, Math.round(pos.ayah)));
  return AYAH_PAGE[SURAH_OFFSET[s.id] + ayah - 1];
}

/**
 * Pages of text walked from `start`, ayah by ayah, in `direction`:
 * entry n is how many pages the first n walked ayahs amount to, each ayah
 * counting as its page's share (1 ÷ the ayahs on that page).
 *
 * Measured along the path the student actually takes, not along the page
 * numbers. The two differ in hifz order: inside a surah the walk moves UP
 * through the mushaf (Al-Mulk runs pages 562, 563, 564), but the old
 * formula counted "N pages" as the N pages *below* the start, so a hifz
 * student's second day was sized off At-Tahrim's page instead of the Al-Mulk
 * page they were actually on — sometimes far more than a page, sometimes
 * far less. A page the walk only visits part of (a shared page at a surah
 * boundary, or a start partway down a page) counts only for the part walked.
 *
 * Cached per start and direction: a daily schedule asks this for the same
 * anchor a few hundred times.
 */
const walkCache = new Map<string, Float64Array>();

function walkedPages(start: Position, direction: Direction): Float64Array {
  const key = `${start.surah}:${start.ayah}:${direction}`;
  const hit = walkCache.get(key);
  if (hit) return hit;

  const order = surahOrder(direction);
  const startIdx = order.indexOf(start.surah);
  const cumulative: number[] = [0];
  if (startIdx !== -1) {
    let pages = 0;
    for (let i = startIdx; i < order.length; i++) {
      const s = getSurahById(order[i])!;
      const from = i === startIdx ? Math.max(1, Math.min(start.ayah, s.ayahs)) : 1;
      const base = SURAH_OFFSET[s.id];
      for (let a = from; a <= s.ayahs; a++) {
        pages += 1 / PAGE_AYAHS[AYAH_PAGE[base + a - 1]];
        cumulative.push(pages);
      }
    }
  }

  const out = Float64Array.from(cumulative);
  if (walkCache.size >= 64) walkCache.clear();
  walkCache.set(key, out);
  return out;
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
 * A page target, in ayahs: how many ayahs, walked from `start` in
 * `direction`, make up `pages` pages of text.
 *
 * From the top of a page this lands exactly on page boundaries — "2 pages"
 * from An-Nisa 1 is An-Nisa 1–11, pages 77 and 78, and not one ayah of 79.
 * A fraction of a page is split in proportion to the ayahs on the page the
 * walk has reached.
 */
export function ayahsForPages(start: Position, direction: Direction, pages: number): number {
  if (pages <= 0) return 0;
  const walked = walkedPages(start, direction);
  const n = walked.length - 1;
  if (n === 0) return 0;
  if (pages >= walked[n] - 1e-9) return n;

  // First ayah count whose running total reaches the target.
  let lo = 1;
  let hi = n;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (walked[mid] >= pages - 1e-9) hi = mid;
    else lo = mid + 1;
  }
  const frac = (pages - walked[lo - 1]) / (walked[lo] - walked[lo - 1]);
  return Math.max(0, Math.round(lo - 1 + Math.min(1, Math.max(0, frac))));
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
    if (whole) return a.englishName;
    // One ayah on its own — Al-Baqarah 282 fills a whole page by itself.
    return from.ayah === to.ayah ? `${a.englishName} ${from.ayah}` : `${a.englishName} ${from.ayah}–${to.ayah}`;
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

/** "Page 78" or "Pages 78–79" — the number a teacher actually tells a
 *  student to turn to. A Surah/ayah range on its own still has to be
 *  looked up against a real mushaf before it means anything to open to;
 *  the page number is the instruction itself. */
export function pageLabel(from: Position, to: Position): string {
  const a = pageOfPosition(from);
  const b = pageOfPosition(to);
  return a === b ? `Page ${a}` : `Pages ${a}–${b}`;
}

/* ── Daily rate ────────────────────────────────────────────────────────
   "1 page a day" instead of a year's total split evenly across a chosen
   number of segments. Review has no version of this walk: it is a plain
   daily amount the teacher assigns from already-covered ground, not a
   second position moving through the mushaf, so it never appears here —
   only as a number the daily breakdown displays alongside each day. */

export interface DailyPortion {
  date: string;
  from: Position;
  to: Position;
  /** Ayahs actually walked this day. Varies with how dense the surah is
   *  per page; `dailyAmount` itself, in the plan's own unit, does not. */
  ayahs: number;
  label: string;
}

/**
 * One row per instructional day in [from, to], walking forward from
 * `start` at a steady `dailyAmount`-per-day pace.
 *
 * Days before `from` are still walked, just not returned — so a "this
 * week" call made in January starts the cursor from wherever a full
 * term's worth of that pace actually lands, not from the plan's own
 * anchor recomputed as if this week were day one. The same "expected
 * by today" idea `expectedUnitsForMilestone` already applies to a unit
 * count, applied here to a mushaf position instead.
 *
 * Non-instructional days (the weekend, a listed closure) are left out of
 * the result and do not move the cursor: there is nothing to assign on a
 * day the student is not at school.
 *
 * Bounded at 1200 calendar days — a little over three school years — so a
 * malformed multi-year span fails by stopping rather than by hanging.
 */
export function dailySchedule(
  start: Position,
  direction: Direction,
  unit: string,
  dailyAmount: number,
  planStartsOn: string,
  from: string,
  to: string,
  cal: SchoolCalendar
): DailyPortion[] {
  if (dailyAmount <= 0 || to < planStartsOn) return [];
  const out: DailyPortion[] = [];
  let cursor: Position | null = start;
  let day = planStartsOn;
  // How many instructional days have been walked so far. Each day's ayah
  // count comes from the *difference* between two cumulative totals
  // measured from the plan's own fixed anchor — the same running-total
  // trick segmentMushaf uses — rather than by asking targetInAyahs for
  // one page from wherever the cursor currently sits. Re-anchoring at the
  // cursor every day would re-trigger ayahsForPages' current-page
  // rounding on every single call instead of once, and that rounding is
  // sized for a whole year's target, not for one page: called this way it
  // overstates a single day by roughly a full extra page, and thirty days
  // of that is not a rounding error any more.
  let instructionalDaysSoFar = 0;

  for (let guard = 0; guard < 1200 && cursor && day <= to; guard++) {
    if (isInstructionalDay(day, cal)) {
      const before = targetInAyahs(start, direction, unit, instructionalDaysSoFar * dailyAmount);
      const after = targetInAyahs(start, direction, unit, (instructionalDaysSoFar + 1) * dailyAmount);
      instructionalDaysSoFar++;
      const ayahs = Math.round(after) - Math.round(before);
      if (ayahs <= 0) break;
      const blocks = walk(cursor, direction, ayahs);
      if (blocks.length === 0) break;
      const firstBlock = blocks[0];
      const lastBlock = blocks[blocks.length - 1];
      if (day >= from) {
        out.push({
          date: day,
          from: { surah: firstBlock.from_surah, ayah: firstBlock.from_ayah },
          to: { surah: lastBlock.to_surah, ayah: lastBlock.to_ayah },
          ayahs: blocks.reduce((s, b) => s + b.ayahs, 0),
          label: formatRange(
            { surah: firstBlock.from_surah, ayah: firstBlock.from_ayah },
            { surah: lastBlock.to_surah, ayah: lastBlock.to_ayah }
          ),
        });
      }
      cursor = nextPosition({ surah: lastBlock.to_surah, ayah: lastBlock.to_ayah }, direction);
    }
    day = addDays(day, 1);
  }
  return out;
}

/**
 * The steady per-instructional-day pace a fixed total works out to across
 * a date range — the reverse of typing a daily rate directly. A teacher
 * gives the portion for the year ("5 juz"), this works out what that
 * actually is a day, the same way `expectedUnitsForMilestone` already
 * turns a target and a deadline into an expected-by-today figure, just
 * solved for "per day" instead of "by this date".
 *
 * `planStartsOn` and `planEndsOn` are the same date, inclusive on both
 * ends — unlike countInstructionalDays' own (from, to] convention, which
 * would silently drop the plan's own first day from the count.
 */
export function impliedDailyRate(
  totalAmount: number,
  planStartsOn: string,
  planEndsOn: string,
  cal: SchoolCalendar
): number {
  if (totalAmount <= 0) return 0;
  const days = countInstructionalDays(addDays(planStartsOn, -1), planEndsOn, cal);
  return days > 0 ? totalAmount / days : 0;
}

/**
 * The shape a daily breakdown or the assignment auto-generator needs off a
 * plan — never the whole Plan type, so either caller can pass one straight
 * off an API payload without a cast.
 */
export interface DailyPacePlan {
  starts_on: string;
  ends_on: string;
  unit: PlanUnit;
  start_surah: number | null;
  start_ayah: number | null;
  direction: Direction | null;
  daily_new_amount: number | null;
  daily_review_amount: number | null;
  /** The unit `daily_review_amount` is counted in. Read only for display —
   *  falls back to `unit` where a caller has no value of its own, the same
   *  way a plan saved before this column existed does. */
  daily_review_unit: PlanUnit | null;
}

/**
 * The steady per-day pace this plan actually runs at, however it was set
 * up: the rate directly, if a teacher typed one, or — for an ordinary
 * "total for the year" plan — the total worked out across however many
 * instructional days the plan's own span holds. Either way, a caller only
 * ever needs one number, not two different plan shapes.
 *
 * Null when there is nothing to derive a pace from at all: no anchor, or
 * no rate and no total either (a bare plan with no milestones yet).
 */
export function dailyPaceOf(plan: DailyPacePlan, cal: SchoolCalendar, totalUnits?: number): number | null {
  if (plan.start_surah == null || plan.start_ayah == null || plan.direction == null) return null;
  if (plan.daily_new_amount != null) return plan.daily_new_amount;
  if (totalUnits && totalUnits > 0) {
    const rate = impliedDailyRate(totalUnits, plan.starts_on, plan.ends_on, cal);
    return rate > 0 ? rate : null;
  }
  return null;
}

export interface DailyRateSegment {
  starts_on: string;
  due_on: string;
  target_units: number;
  from_surah: number;
  from_ayah: number;
  to_surah: number;
  to_ayah: number;
  label: string;
}

/**
 * Milestones for a daily-rate plan: one per calendar week that holds at
 * least one instructional day, sized to however many of that week's days
 * actually carry instruction — a four-day week because of a holiday gets
 * four days' worth, not a fifth of an ordinary week's.
 *
 * Built by grouping `dailySchedule`'s own rows rather than walking the
 * mushaf a second time in weekly jumps, so a milestone's boundary and a
 * daily breakdown's row can never disagree about where one day's portion
 * ends and the next begins.
 *
 * A milestone's own starts_on/due_on are the first and last *instructional*
 * day it actually covers, not the calendar week's Monday and Sunday —
 * the schedule has nothing to say about the weekend in between, and a
 * "due" date nothing is due on would just be confusing on the milestone
 * list.
 */
export function weeklyMilestonesFromDailyRate(
  start: Position,
  direction: Direction,
  unit: string,
  dailyAmount: number,
  planStartsOn: string,
  planEndsOn: string,
  cal: SchoolCalendar
): DailyRateSegment[] {
  const days = dailySchedule(start, direction, unit, dailyAmount, planStartsOn, planStartsOn, planEndsOn, cal);
  if (days.length === 0) return [];

  const out: DailyRateSegment[] = [];
  let weekKey = startOfWeek(days[0].date);
  let bucket: DailyPortion[] = [];

  const flush = () => {
    if (bucket.length === 0) return;
    const first = bucket[0];
    const last = bucket[bucket.length - 1];
    out.push({
      starts_on: first.date,
      due_on: last.date,
      target_units: Math.round(dailyAmount * bucket.length * 100) / 100,
      from_surah: first.from.surah,
      from_ayah: first.from.ayah,
      to_surah: last.to.surah,
      to_ayah: last.to.ayah,
      label: formatRange(first.from, last.to),
    });
  };

  for (const d of days) {
    const k = startOfWeek(d.date);
    if (k !== weekKey) {
      flush();
      weekKey = k;
      bucket = [];
    }
    bucket.push(d);
  }
  flush();

  return out;
}
