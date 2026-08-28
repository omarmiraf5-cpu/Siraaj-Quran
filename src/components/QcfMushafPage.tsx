"use client";

import { useEffect, useMemo, useState } from "react";

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
  highlightedRange?: { surah: number; start: number; end: number };
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
  const headerSize = `min(10cqw, ${(Number(fitHeight) * HEADER_SCALE).toFixed(2)}cqh)`;

  const isHighlighted = (key: string | number) => {
    if (!highlightedRange || typeof key !== "string") return false;
    const [s, a] = key.split(":").map(Number);
    return (
      s === highlightedRange.surah &&
      a >= highlightedRange.start &&
      a <= highlightedRange.end
    );
  };

  return (
    <div
      className="flex-1 min-h-0 overflow-hidden flex flex-col justify-evenly"
      style={{ containerType: "size" }}
      dir="rtl"
    >
      {layout.l.map((line, li) => {
        const centered =
          line.length > 0 &&
          (line[0][0] === KIND_HEADER || line[0][0] === KIND_BISMILLAH);

        return (
          <div
            key={li}
            className={`flex items-center w-full ${
              centered ? "justify-center" : "justify-between"
            }`}
            style={{ lineHeight: 1.7 }}
          >
            {line.map((seg, si) => {
              const [kind, key, chars] = seg;
              const isHeader = kind === KIND_HEADER;
              const isBismillah = kind === KIND_BISMILLAH;
              const playing = typeof key === "string" && key === playingKey;
              const hl = isHighlighted(key);
              const clickable = kind !== KIND_HEADER && kind !== KIND_BISMILLAH;

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
                  className={`${clickable ? "cursor-pointer" : ""} ${
                    playing
                      ? "bg-emerald-200/70 dark:bg-emerald-900/50 rounded"
                      : hl
                        ? "bg-red-200/70 dark:bg-red-900/50 rounded"
                        : clickable
                          ? "hover:bg-[#c4a95a]/20 rounded"
                          : ""
                  }`}
                  style={{
                    // Three different fonts are in play. The surah-name banner
                    // comes from QCF4_BSML. The Bismillah glyph lives only in
                    // Hafs_01 — the upstream layout data names QCF4_Hafs_01 for
                    // every one of the 112 Bismillah lines, whatever page font
                    // the page itself uses; in any other face that codepoint
                    // maps to an empty glyph, which is why it rendered blank.
                    // Everything else uses the page's own Hafs face.
                    fontFamily: isHeader
                      ? "'QCF4_BSML', serif"
                      : isBismillah
                        ? "'QCF4_01', serif"
                        : `'${pageFont}', serif`,
                    fontSize: isHeader ? headerSize : wordSize,
                    color: isHeader ? "#6b5220" : undefined,
                    whiteSpace: "nowrap",
                  }}
                >
                  {ch}
                </span>
              ));
            })}
          </div>
        );
      })}
    </div>
  );
}
