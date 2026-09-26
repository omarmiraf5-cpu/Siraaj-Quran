"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { SURAHS } from "@/data/mushaf-index";

// Segment: [kind, key, glyphChars]
//   kind 0=word 1=ayah-end 2=surah-header 3=bismillah 4=quarter-marker
//   key  "surah:ayah" for kinds 0/1/4, surah number for kinds 2/3
type Segment = [number, string | number, string];
type PageLayout = { f: number; l: Segment[][] };

const KIND_WORD = 0;
const KIND_END = 1;
const KIND_HEADER = 2;
const KIND_BISMILLAH = 3;

const cache = new Map<number, PageLayout>();

let measurer: CanvasRenderingContext2D | null = null;
/** How wide these glyphs are, side by side, in em of `face`. */
function glyphsWidth(face: string, glyphs: string): number {
  measurer ??= document.createElement("canvas").getContext("2d");
  if (!measurer) return 0;
  measurer.font = `100px '${face}'`;
  return measurer.measureText(glyphs).width / 100;
}

/** Whether a line ends with the last ayah of its surah. */
function endsSurah(line: Segment[]): boolean {
  const last = line[line.length - 1];
  if (!last || last[0] !== KIND_END || typeof last[1] !== "string") return false;
  const [surah, ayah] = last[1].split(":").map(Number);
  return ayah === SURAHS[surah - 1]?.ayahs;
}

// ── The 1441 print's colour, laid under the black QCF4 glyphs ─────────────
// The fonts draw the Mushaf's marks in outline only. In the printed Madinah
// Mushaf the ayah rosettes carry pink caps (with a blue bud on top) and each
// surah opens in a sky-blue ornamental band; both are drawn here, behind the
// glyphs, so the glyphs' own black outlines sit on the colour.

const PRINT_PINK = "#e2519a";
const PRINT_BLUE = "#22b5ec";
const PRINT_LINE = "#2b2b2b";

// Where a rosette's ink sits in its glyph, in em, measured off the QCF4 page
// fonts (identical in all 47, whatever the number inside): the ink starts
// 0.13em in from the left of the glyph's 1.004em advance and is 0.88em wide;
// it rises 0.77em above the baseline and drops 0.37em below. Each glyph is
// its own flex item with line-height 1.7, and the font's ascent and descent
// are 1.48em and 0.79em, so the baseline sits 1.195em down the item.
const ROSETTE = { left: 0.13, width: 0.88, top: 1.195 - 0.77, height: 1.14 };

/** The pink caps and blue bud of an ayah rosette, in the glyph's own ink box (441 × 570). */
function RosetteColour() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 441 570"
      preserveAspectRatio="none"
      className="absolute pointer-events-none"
      style={{
        left: `${ROSETTE.left}em`,
        top: `${ROSETTE.top}em`,
        width: `${ROSETTE.width}em`,
        height: `${ROSETTE.height}em`,
      }}
    >
      <g fill={PRINT_PINK}>
        <circle cx="221" cy="32" r="24" />
        <circle cx="181" cy="52" r="22" />
        <circle cx="261" cy="52" r="22" />
        <circle cx="158" cy="82" r="24" />
        <circle cx="284" cy="82" r="24" />
        <ellipse cx="221" cy="74" rx="58" ry="30" />
        <circle cx="138" cy="526" r="16" />
        <circle cx="179" cy="537" r="18" />
        <circle cx="221" cy="540" r="18" />
        <circle cx="263" cy="537" r="18" />
        <circle cx="304" cy="526" r="16" />
      </g>
      <circle cx="221" cy="93" r="17" fill={PRINT_BLUE} />
    </svg>
  );
}

// One repeat of the header band: white scrollwork with dark edges around a
// pink flower, on sky blue. It tiles sideways at the band's height, so the
// flowers stay round however wide the page is.
const BAND_TILE = (() => {
  const scroll = [
    // the lens of split leaves around the middle flower, curling out where they meet
    "M60,15 C38,22 31,36 31,50 C31,64 38,78 60,85",
    "M60,15 C82,22 89,36 89,50 C89,64 82,78 60,85",
    "M60,15 C56,8 48,6 43,10 C39,13 41,19 46,18",
    "M60,15 C64,8 72,6 77,10 C81,13 79,19 74,18",
    "M60,85 C56,92 48,94 43,90 C39,87 41,81 46,82",
    "M60,85 C64,92 72,94 77,90 C81,87 79,81 74,82",
    // half of the lens around the flower where two repeats meet
    "M0,27 C11,31 17,40 17,50 C17,60 11,69 0,73",
    "M120,27 C109,31 103,40 103,50 C103,60 109,69 120,73",
    // spirals into the corners between them
    "M31,50 C24,45 22,37 25,31 C28,26 34,27 34,32",
    "M31,50 C24,55 22,63 25,69 C28,74 34,73 34,68",
    "M89,50 C96,45 98,37 95,31 C92,26 86,27 86,32",
    "M89,50 C96,55 98,63 95,69 C92,74 86,73 86,68",
  ];
  const petals = (cx: number, cy: number, r: number, n: number, rot = 0) =>
    Array.from({ length: n }, (_, i) => {
      const a = rot + (360 / n) * i;
      return `<ellipse cx='${cx}' cy='${cy - r}' rx='${r * 0.55}' ry='${r * 0.95}' transform='rotate(${a} ${cx} ${cy})'/>`;
    }).join("");
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='120' height='100' viewBox='0 0 120 100'>
<rect width='120' height='100' fill='${PRINT_BLUE}'/>
<g fill='none' stroke-linecap='round'>
<g stroke='${PRINT_LINE}' stroke-width='6'>${scroll.map((d) => `<path d='${d}'/>`).join("")}</g>
<g stroke='#ffffff' stroke-width='3.4'>${scroll.map((d) => `<path d='${d}'/>`).join("")}</g>
</g>
<g fill='${PRINT_PINK}' stroke='${PRINT_LINE}' stroke-width='0.9'>${petals(60, 50, 9, 5)}${petals(0, 50, 7, 4, 45)}${petals(120, 50, 7, 4, 45)}</g>
<g fill='#ffffff' stroke='${PRINT_LINE}' stroke-width='0.8'><circle cx='60' cy='50' r='3.4'/><circle cx='0' cy='50' r='2.6'/><circle cx='120' cy='50' r='2.6'/></g>
<g fill='${PRINT_PINK}' stroke='${PRINT_LINE}' stroke-width='0.8'><path d='M46,18 q-6,-1 -8,4 q5,2 8,-4z'/><path d='M74,18 q6,-1 8,4 q-5,2 -8,-4z'/><path d='M46,82 q-6,1 -8,-4 q5,-2 8,4z'/><path d='M74,82 q6,1 8,-4 q-5,-2 -8,4z'/><circle cx='60' cy='12' r='2.6'/><circle cx='60' cy='88' r='2.6'/></g>
</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
})();

/** One end of the cream cartouche the surah name sits in: inward-curving corners and a point at mid-height. */
function CartoucheEnd({ flip }: { flip?: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 30 100"
      preserveAspectRatio="none"
      className="h-full flex-none"
      style={{ width: "auto", aspectRatio: "30 / 100", transform: flip ? "scaleX(-1)" : undefined }}
    >
      <path d="M30,0 L17,0 Q17,14 7,14 L7,42 L1,50 L7,58 L7,86 Q17,86 17,100 L30,100 Z" fill="var(--mushaf-page)" />
      <path
        d="M17,0 Q17,14 7,14 L7,42 L1,50 L7,58 L7,86 Q17,86 17,100"
        fill="none"
        stroke={PRINT_LINE}
        strokeWidth="1.3"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/** The printed Mushaf's surah heading: a framed sky-blue band with the name in a cream cartouche. */
function SurahFrame() {
  return (
    <div
      aria-hidden
      // Laid out left to right whatever the page's direction: in the RTL page
      // the two cartouche ends would otherwise swap and face the wrong way.
      dir="ltr"
      className="absolute inset-x-0 top-[9%] bottom-[9%] p-[2px] pointer-events-none dark:brightness-[0.82]"
      style={{ border: `1.5px solid ${PRINT_LINE}`, background: "var(--mushaf-page)" }}
    >
      <div
        className="relative h-full"
        style={{
          border: `1px solid ${PRINT_LINE}`,
          backgroundColor: PRINT_BLUE,
          backgroundImage: BAND_TILE,
          backgroundSize: "auto 100%",
          backgroundRepeat: "repeat-x",
          backgroundPosition: "center",
        }}
      >
        <div className="absolute inset-y-0 left-[24%] right-[24%] flex">
          <CartoucheEnd />
          {/* Tucked a pixel under each end, so no hairline shows at the seams. */}
          <div className="flex-1 -mx-px" style={{ background: "var(--mushaf-page)" }} />
          <CartoucheEnd flip />
        </div>
      </div>
    </div>
  );
}

export function usePageLayout(pageNum: number) {
  const [layout, setLayout] = useState<PageLayout | null>(
    () => cache.get(pageNum) ?? null
  );

  useEffect(() => {
    const cached = cache.get(pageNum);
    if (cached) {
      setLayout(cached);
      return;
    }
    let cancelled = false;
    setLayout(null);
    fetch(`/mushaf/${pageNum}.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: PageLayout | null) => {
        if (cancelled || !data) return;
        cache.set(pageNum, data);
        setLayout(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [pageNum]);

  return layout;
}

export function QcfMushafPage({
  pageNum,
  layout,
  highlightedRange,
  playingKey,
  onAyahClick,
}: {
  pageNum: number;
  layout: PageLayout | null;
  highlightedRange?: { surah: number; start: number; end: number; surahEnd?: number };
  playingKey: string | null;
  onAyahClick: (surah: number, ayah: number) => void;
}) {
  const pageFont = layout ? `QCF4_${String(layout.f).padStart(2, "0")}` : "";

  // Every face this page draws with, paired with a real glyph taken from it.
  // Memoised on the layout so that playing an ayah, which re-renders this
  // component, does not re-run the probe below and blink the page away.
  const facesNeeded = useMemo(() => {
    if (!layout) return [] as [string, string][];
    const sample = new Map<string, string>();
    for (const line of layout.l) {
      for (const [kind, , glyphs] of line) {
        if (!glyphs) continue;
        const face =
          kind === KIND_HEADER
            ? "QCF4_BSML"
            : kind === KIND_BISMILLAH
              ? "QCF4_01"
              : pageFont;
        if (!sample.has(face)) sample.set(face, glyphs);
      }
    }
    return [...sample];
  }, [layout, pageFont]);

  // Hold the spinner until those faces are actually drawable. Without this the
  // layout JSON arrives well before the woff2 and the page paints a screenful
  // of Private Use Area codepoints that no fallback font can render.
  const [facesReady, setFacesReady] = useState(false);
  useEffect(() => {
    if (facesNeeded.length === 0) return;
    let cancelled = false;
    setFacesReady(false);
    const reveal = () => {
      if (!cancelled) setFacesReady(true);
    };
    if (typeof document === "undefined" || !document.fonts) {
      reveal();
      return;
    }
    // Probe with real glyphs. document.fonts.load tests a space by default,
    // and these faces carry no space, so the default probe would report the
    // font ready without ever fetching it.
    const timer = setTimeout(reveal, 4000); // never strand the reader
    Promise.all(
      facesNeeded.map(([face, glyphs]) =>
        document.fonts.load(`1em '${face}'`, glyphs).catch(() => {})
      )
    ).then(reveal);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [facesNeeded]);

  // The line area's size, to tell which lines are short of the full width.
  const boxRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const measure = () => setBox({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [facesReady, layout]);

  // Each line's glyphs at their natural width, in em, once the face can be measured.
  const naturalWidths = useMemo(
    () =>
      layout && facesReady && typeof document !== "undefined"
        ? layout.l.map((line) => glyphsWidth(pageFont, line.map((seg) => seg[2]).join("")))
        : null,
    [layout, facesReady, pageFont]
  );

  if (!layout || !facesReady) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-5 h-5 rounded-full border-2 border-[#a8894a]/25 border-t-[#a8894a]/70 animate-spin" />
      </div>
    );
  }

  // Size the glyphs against the line area itself: the cqh term makes this
  // page's line count exactly fill the height, and the cqw term stops a line
  // from overrunning the width. With the page box locked to the Mushaf's
  // proportion the two land together, so justification adds no visible gaps.
  //
  // The surah-name banner renders 1.5x a normal line's font-size (headerSize)
  // while sharing the same line-height multiplier, so it occupies 1.5 "line
  // slots", not 1. Budgeting it as 1 slot over-fills the page and the last
  // line of ayah text gets clipped by the container's overflow: hidden.
  const LINE_H = 1.7;
  const HEADER_SCALE = 1.5;
  const rawLineCount = Math.max(layout.l.length, 1);
  const headerLineCount = layout.l.filter(
    (line) => line.length > 0 && line[0][0] === KIND_HEADER
  ).length;
  const effectiveLineCount =
    rawLineCount - headerLineCount + headerLineCount * HEADER_SCALE;
  const fitHeight = (100 / (effectiveLineCount * LINE_H)).toFixed(2);
  const wordSize = `min(6.2cqw, ${fitHeight}cqh)`;

  // A surah:ayah pair orders correctly against another as long as ayah
  // counts never reach 1000 — the largest surah (Al-Baqarah) has 286.
  const readingKey = (surah: number, ayah: number) => surah * 1000 + ayah;

  const isHighlighted = (key: string | number) => {
    if (!highlightedRange || typeof key !== "string") return false;
    const [s, a] = key.split(":").map(Number);
    const k = readingKey(s, a);
    const lo = readingKey(highlightedRange.surah, highlightedRange.start);
    const hi = readingKey(highlightedRange.surahEnd ?? highlightedRange.surah, highlightedRange.end);
    return k >= lo && k <= hi;
  };

  return (
    <div
      ref={boxRef}
      className="flex-1 min-h-0 overflow-hidden flex flex-col justify-evenly"
      style={{ containerType: "size" }}
      dir="rtl"
    >
      {layout.l.map((line, li) => {
        // A surah's heading: the name, a little larger than the text, in
        // the printed band. The line takes the HEADER_SCALE slots budgeted
        // for it above, whatever size the name itself is drawn at.
        if (line.length > 0 && line[0][0] === KIND_HEADER) {
          return (
            <div
              key={li}
              className="relative w-full flex-none flex items-center justify-center"
              style={{ height: `calc(${wordSize} * ${LINE_H * HEADER_SCALE})` }}
            >
              <SurahFrame />
              <span
                className="relative"
                style={{ fontFamily: "'QCF4_BSML', serif", fontSize: `calc(${wordSize} * 1.3)`, lineHeight: 1, whiteSpace: "nowrap" }}
              >
                {line.map((seg) => seg[2]).join("")}
              </span>
            </div>
          );
        }

        const isBismillahLine = line.length > 0 && line[0][0] === KIND_BISMILLAH;

        // Total words + end-markers on the line — every character across
        // every segment, since that is exactly what becomes a flex child
        // below. Checked across a spread of real pages before picking 5:
        // an ordinary page's sparsest line still lands at 6-7, while a
        // genuinely short line — the tail of a short surah, both cases
        // reported — sits at 2-4. A short line stretched edge to edge with
        // only two or three words to hold it apart doesn't get a run of
        // modest gaps, it gets one or two canyons, because there is
        // nowhere else for the leftover width to go. No real justified
        // typesetting — Arabic or Latin — stretches a line that sparse; a
        // short line is set at its natural width instead, which for RTL
        // means it starts flush at the right and simply ends wherever its
        // last word ends, exactly like a paragraph's ragged last line.
        const wordCount = line.reduce(
          (sum, seg) => sum + Array.from(seg[2] || "").length,
          0
        );
        // Where the print sets a line at its natural width, centred rather
        // than stretched: the Bismillah, the two opening pages, and a
        // surah's last line when it falls short of the full width, as the
        // lines closing Surat al-Ghashiyah and Surat al-Fajr on pages
        // 593-594 do. Short or not is measured: the glyphs' own widths
        // against the line area, at the size they're actually drawn. No
        // space is added between them — each QCF4 word glyph carries its own
        // in its advance, which is why a full line's glyphs already span the
        // page (99% of the width on page 593) and a short one's don't (81%).
        const wordPx = box ? Math.min(0.062 * box.w, (Number(fitHeight) / 100) * box.h) : 0;
        const naturalPx = naturalWidths && box ? wordPx * naturalWidths[li] : null;
        const shortOfWidth = naturalPx !== null && box ? naturalPx < 0.9 * box.w : wordCount < 5;
        const centered = isBismillahLine || pageNum <= 2 || (endsSurah(line) && shortOfWidth);
        const justify = centered
          ? "justify-center"
          : wordCount < 5
            ? "justify-start"
            : "justify-between";

        return (
          <div key={li} className={`flex items-center w-full ${justify}`} style={{ lineHeight: 1.7 }}>
            {line.map((seg, si) => {
              const [kind, key, chars] = seg;
              const isBismillah = kind === KIND_BISMILLAH;
              const isRosette = kind === KIND_END;
              const playing = typeof key === "string" && key === playingKey;
              const hl = isHighlighted(key);
              const clickable = !isBismillah;

              const handle = () => {
                if (!clickable || typeof key !== "string") return;
                const [s, a] = key.split(":").map(Number);
                onAyahClick(s, a);
              };

              // Each glyph is one whole word — render individually so the
              // flex row can stretch the line edge to edge like the print.
              return Array.from(chars).map((ch, ci) => (
                <span
                  key={`${si}-${ci}`}
                  role={clickable ? "button" : undefined}
                  tabIndex={clickable ? 0 : undefined}
                  onClick={handle}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handle();
                  }}
                  className={`${isRosette ? "relative" : ""} ${clickable ? "cursor-pointer" : ""} ${
                    playing
                      ? "bg-emerald-200/70 dark:bg-emerald-900/50 rounded"
                      : hl
                        ? "bg-red-200/70 dark:bg-red-900/50 rounded"
                        : clickable
                          ? "hover:bg-[#c4a95a]/20 rounded"
                          : ""
                  }`}
                  style={{
                    // The Bismillah glyph lives only in Hafs_01 — the upstream
                    // layout data names QCF4_Hafs_01 for every one of the 112
                    // Bismillah lines, whatever page font the page itself uses;
                    // in any other face that codepoint maps to an empty glyph,
                    // which is why it rendered blank. Everything else uses the
                    // page's own Hafs face. (Surah names, in QCF4_BSML, are
                    // drawn with their band above.)
                    fontFamily: isBismillah ? "'QCF4_01', serif" : `'${pageFont}', serif`,
                    fontSize: wordSize,
                    whiteSpace: "nowrap",
                  }}
                >
                  {isRosette ? (
                    <>
                      <RosetteColour />
                      {/* Positioned after the colour, so it paints on top of it. */}
                      <span className="relative">{ch}</span>
                    </>
                  ) : (
                    ch
                  )}
                </span>
              ));
            })}
          </div>
        );
      })}
    </div>
  );
}
