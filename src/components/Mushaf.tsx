"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import {
  SURAHS,
  TOTAL_PAGES,
  getSurahById,
  getJuzForPage,
  getSurahsOnPage,
} from "@/data/mushaf-index";
import { QcfMushafPage, usePageLayout } from "./QcfMushafPage";

interface HighlightRange {
  surah: number;
  start: number;
  end: number;
}

interface MushafProps {
  initialPage?: number;
  highlightedRange?: HighlightRange;
}

interface PlayingAyah {
  surah: number;
  ayah: number;
  surahName: string;
}

// Two independent hosts serve per-ayah recitation, and they do not carry the
// same reciters: the Islamic Network CDN indexes by a running ayah number
// 1-6236, while EveryAyah indexes by zero-padded surah+ayah. Reciters missing
// from one are usually present on the other, so a reciter lists sources from
// whichever hosts carry it and the player falls through them in order.
type AudioSource =
  | { host: "islamic"; edition: string; bitrate: number }
  | { host: "everyayah"; folder: string };

interface Reciter {
  id: string;
  name: string;
  sources: AudioSource[];
}

const RECITERS: Reciter[] = [
  {
    // Not carried by the Islamic Network CDN at any bitrate. EveryAyah has
    // him, but his folder is spelled inconsistently across Quran apps (they
    // render the name "Abdur-Rashid Sufi", "Abdurrashid Sufi" and
    // "Abdul Rashid Sufi"), and the exact directory name could not be
    // confirmed from here — everyayah.com is blocked by the build sandbox's
    // egress proxy. The player walks candidates and caches the one that
    // works, so listing the plausible spellings costs a few one-time 404s
    // and then settles on the right one.
    id: "sufi",
    name: "Abdirashid Ali Sufi",
    sources: [
      { host: "everyayah", folder: "Abdurrashid_Sufi_192kbps" },
      { host: "everyayah", folder: "Abdurrashid_Sufi_128kbps" },
      { host: "everyayah", folder: "Abdurrashid_Sufi_64kbps" },
      { host: "everyayah", folder: "Abdur-Rashid_Sufi_192kbps" },
      { host: "everyayah", folder: "Abdur-Rashid_Sufi_128kbps" },
      { host: "everyayah", folder: "AbdurRashid_Sufi_192kbps" },
      { host: "everyayah", folder: "Abdul_Rashid_Sufi_192kbps" },
    ],
  },
  {
    id: "minshawi",
    name: "Al-Minshawi",
    sources: [
      { host: "islamic", edition: "ar.minshawi", bitrate: 128 },
      { host: "everyayah", folder: "Minshawi_Murattal_128kbps" },
    ],
  },
  {
    id: "husary",
    name: "Khalil Al-Husary",
    sources: [
      { host: "islamic", edition: "ar.husary", bitrate: 128 },
      { host: "everyayah", folder: "Husary_128kbps" },
    ],
  },
  {
    // Same story as Sufi — EveryAyah carries him, the Islamic Network CDN
    // does not.
    id: "ayyub",
    name: "Muhammad Ayyub",
    sources: [
      { host: "everyayah", folder: "Muhammad_Ayyoub_128kbps" },
      { host: "everyayah", folder: "Muhammad_Ayyoub_64kbps" },
    ],
  },
];

const REPEAT_OPTIONS = [1, 2, 3, 4, 5];

function getAbsoluteAyahNumber(surah: number, ayah: number): number {
  let total = 0;
  for (const s of SURAHS) {
    if (s.id === surah) break;
    total += s.ayahs;
  }
  return total + ayah;
}

// Every candidate URL for one ayah, most-preferred first.
function getAudioSources(reciter: Reciter, surah: number, ayah: number): string[] {
  return reciter.sources.map((src) => {
    if (src.host === "islamic") {
      const n = getAbsoluteAyahNumber(surah, ayah);
      return `https://cdn.islamic.network/quran/audio/${src.bitrate}/${src.edition}/${n}.mp3`;
    }
    const s = String(surah).padStart(3, "0");
    const a = String(ayah).padStart(3, "0");
    return `https://everyayah.com/data/${src.folder}/${s}${a}.mp3`;
  });
}

const ARABIC_DIGITS = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];

function toArabicNumerals(n: number): string {
  return String(n)
    .split("")
    .map((d) => ARABIC_DIGITS[Number(d)] ?? d)
    .join("");
}

function ReciterPicker({
  onSelect,
  onClose,
}: {
  onSelect: (reciter: Reciter) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative bg-[#fdf8ec] dark:bg-[#1c1a14] border-2 border-[#c4a95a]/40 rounded-xl p-4 shadow-2xl w-[260px]"
        onClick={(e) => e.stopPropagation()}
        dir="ltr"
      >
        <p className="text-xs font-bold text-[#5a4520] dark:text-[#c4a95a] mb-3 text-center">
          Choose Reciter
        </p>
        <div className="space-y-1.5">
          {RECITERS.map((r) => (
            <button
              key={r.id}
              onClick={() => onSelect(r)}
              className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-semibold text-[#2c1f0e] dark:text-[#e8dcc8] hover:bg-[#c4a95a]/20 dark:hover:bg-[#c4a95a]/10 transition active:scale-[.98]"
            >
              {r.name}
            </button>
          ))}
        </div>
        <button
          onClick={onClose}
          className="w-full mt-2 text-[10px] text-[#8b7d56]/60 dark:text-[#c4a95a]/40 hover:text-[#8b7d56] py-1"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function SectionRepeatPanel({
  defaultSurahId,
  onPlay,
  onClose,
}: {
  defaultSurahId: number;
  onPlay: (surahId: number, from: number, to: number) => void;
  onClose: () => void;
}) {
  const [surahId, setSurahId] = useState(defaultSurahId);
  const [from, setFrom] = useState("1");
  const [to, setTo] = useState("");

  const surah = getSurahById(surahId);
  const maxAyah = surah?.ayahs ?? 1;

  // Keep the range inside the chosen surah when it changes.
  const pickSurah = (id: number) => {
    setSurahId(id);
    setFrom("1");
    setTo("");
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const f = Math.min(Math.max(parseInt(from) || 1, 1), maxAyah);
    const t = Math.min(Math.max(parseInt(to) || maxAyah, 1), maxAyah);
    onPlay(surahId, f, t);
  };

  return (
    <form
      onSubmit={submit}
      className="bg-surface-card border border-surface-border rounded-lg p-2 space-y-2"
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold text-ink">Repeat a section</span>
        <button
          type="button"
          onClick={onClose}
          className="text-[10px] text-ink-muted hover:text-ink px-1"
        >
          Close
        </button>
      </div>

      <select
        value={surahId}
        onChange={(e) => pickSurah(parseInt(e.target.value))}
        className="w-full bg-surface-bg border border-surface-border rounded-md px-2 py-1 text-[11px] text-ink focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
      >
        {SURAHS.map((s) => (
          <option key={s.id} value={s.id}>
            {s.id}. {s.englishName}
          </option>
        ))}
      </select>

      <div className="flex items-end gap-2">
        <label className="flex-1 min-w-0">
          <span className="block text-[9px] text-ink-muted mb-0.5">From ayah</span>
          <input
            type="number"
            min={1}
            max={maxAyah}
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            placeholder="1"
            className="w-full bg-surface-bg border border-surface-border rounded-md px-2 py-1 text-[11px] text-ink text-center tabular-nums focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
          />
        </label>
        <label className="flex-1 min-w-0">
          <span className="block text-[9px] text-ink-muted mb-0.5">To ayah</span>
          <input
            type="number"
            min={1}
            max={maxAyah}
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder={String(maxAyah)}
            className="w-full bg-surface-bg border border-surface-border rounded-md px-2 py-1 text-[11px] text-ink text-center tabular-nums focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
          />
        </label>
        <button
          type="submit"
          className="flex-shrink-0 px-3 py-1 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold transition active:scale-95"
        >
          Play
        </button>
      </div>
      <p className="text-[9px] text-ink-muted">
        {surah?.englishName} has {maxAyah} ayahs. Leave &quot;to&quot; empty for the whole surah.
      </p>
    </form>
  );
}

function MushafPage({
  pageNum,
  highlightedRange,
  playingAyah,
  onAyahClick,
  onPlaySurah,
  onPlayAyahs,
}: {
  pageNum: number;
  highlightedRange?: HighlightRange;
  playingAyah: PlayingAyah | null;
  onAyahClick: (surah: number, ayah: number, surahName: string) => void;
  onPlaySurah: (surahId: number) => void;
  onPlayAyahs: (ayahs: PlayingAyah[]) => void;
}) {
  const layout = usePageLayout(pageNum);
  const surahsHere = getSurahsOnPage(pageNum);
  const juz = getJuzForPage(pageNum);

  // Every ayah that appears on this page, in reading order. Taken from the
  // layout the page already fetched, so playing a page costs no extra request.
  // Word, ayah-end and quarter-marker segments all carry a "surah:ayah" key;
  // the surah banner and Bismillah carry a plain surah number, so they drop
  // out here and are not queued.
  const pageAyahs = useMemo<PlayingAyah[]>(() => {
    if (!layout) return [];
    const seen = new Set<string>();
    const out: PlayingAyah[] = [];
    for (const line of layout.l) {
      for (const [, key] of line) {
        if (typeof key !== "string" || seen.has(key)) continue;
        seen.add(key);
        const [s, a] = key.split(":").map(Number);
        out.push({
          surah: s,
          ayah: a,
          surahName: getSurahById(s)?.englishName ?? "",
        });
      }
    }
    return out;
  }, [layout]);

  // The page box needs a DEFINITE height, not just a max-width cap: the Quran
  // text inside is sized off a `container-type: size` query container (see
  // QcfMushafPage), which requires its ancestor chain to resolve to a real
  // size — an unconstrained aspect-ratio box (width capped but no height) can
  // leave that indefinite and the glyphs collapse to invisible. That height,
  // and whether a second page shows at all, live in globals.css under
  // .mushaf-page, driven by a container query on .mushaf-root.
  return (
    <div className="mushaf-page relative bg-[#fdfaf0] dark:bg-[#1c1a14] flex-none flex flex-col aspect-[1/1.545] overflow-hidden">
      {/* Ornamental frame */}
      <div className="absolute inset-0 border-[3px] border-[#a8894a]/60 dark:border-[#8b7d56]/30 rounded-[3px] pointer-events-none" />
      <div className="absolute inset-[5px] border border-[#a8894a]/35 dark:border-[#8b7d56]/20 rounded-[2px] pointer-events-none" />
      <div className="absolute inset-[9px] border-[2px] border-[#c4a95a]/25 dark:border-[#c4a95a]/12 rounded-[2px] pointer-events-none" />
      <span className="absolute top-[9px] right-[9px] w-4 h-4 border-t-2 border-r-2 border-[#a8894a]/50 pointer-events-none" />
      <span className="absolute top-[9px] left-[9px] w-4 h-4 border-t-2 border-l-2 border-[#a8894a]/50 pointer-events-none" />
      <span className="absolute bottom-[9px] right-[9px] w-4 h-4 border-b-2 border-r-2 border-[#a8894a]/50 pointer-events-none" />
      <span className="absolute bottom-[9px] left-[9px] w-4 h-4 border-b-2 border-l-2 border-[#a8894a]/50 pointer-events-none" />

      <div className="relative px-4 md:px-7 pt-4 md:pt-5 pb-2 flex flex-col flex-1 min-h-0" dir="rtl" lang="ar">
        {/* Running header: surah name(s) right, juz left */}
        <div className="flex justify-between items-baseline mb-1.5 pb-1 border-b border-[#a8894a]/25 flex-shrink-0">
          <span className="font-arabic text-[13px] md:text-[15px] text-[#8b6f35] dark:text-[#c4a95a]/60 truncate">
            {surahsHere.map((s, i) => (
              <span key={s.id}>
                {i > 0 && <span className="opacity-50"> · </span>}
                <button
                  onClick={() => onPlaySurah(s.id)}
                  title={`Play all of ${s.englishName}`}
                  className="hover:text-[#c4a95a] hover:underline decoration-dotted underline-offset-2 transition"
                >
                  {s.name}
                </button>
              </span>
            ))}
          </span>
          <span className="font-arabic text-[13px] md:text-[15px] text-[#8b6f35] dark:text-[#c4a95a]/60 flex-shrink-0 pr-2">
            الجزء {toArabicNumerals(juz)}
          </span>
        </div>

        <QcfMushafPage
          pageNum={pageNum}
          layout={layout}
          highlightedRange={highlightedRange}
          playingKey={playingAyah ? `${playingAyah.surah}:${playingAyah.ayah}` : null}
          onAyahClick={(s, a) => {
            const surah = getSurahById(s);
            onAyahClick(s, a, surah ? surah.englishName : "");
          }}
        />

        {/* Page number — bottom centre */}
        <div className="flex-shrink-0 flex justify-center pt-1.5 mt-1 border-t border-[#a8894a]/25">
          <button
            onClick={() => onPlayAyahs(pageAyahs)}
            disabled={pageAyahs.length === 0}
            title={`Play page ${pageNum}`}
            className="inline-flex items-center justify-center min-w-[30px] h-[22px] px-2 rounded-full border border-[#a8894a]/45 font-arabic text-[12px] md:text-[14px] text-[#8b6f35] dark:text-[#c4a95a]/60 hover:border-[#c4a95a] hover:text-[#c4a95a] disabled:opacity-50 transition"
          >
            {toArabicNumerals(pageNum)}
          </button>
        </div>
      </div>
    </div>
  );
}

export function Mushaf({ initialPage = 1, highlightedRange }: MushafProps) {
  const [leftPage, setLeftPage] = useState(() => {
    const p = initialPage;
    return p % 2 === 0 ? p : p > 1 ? p - 1 : p;
  });
  const [pageInput, setPageInput] = useState(String(initialPage));

  const [playingAyah, setPlayingAyah] = useState<PlayingAyah | null>(null);
  const [audioLoading, setAudioLoading] = useState(false);
  const [audioPaused, setAudioPaused] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [activeReciter, setActiveReciter] = useState<Reciter | null>(null);
  const [pendingQueue, setPendingQueue] = useState<PlayingAyah[] | null>(null);
  const [showReciterPicker, setShowReciterPicker] = useState(false);
  const [showSectionPanel, setShowSectionPanel] = useState(false);
  const [repeatCount, setRepeatCount] = useState(1);
  // Progress through the current repeat session, for the now-playing bar.
  const [progress, setProgress] = useState<{
    pass: number;
    total: number;
    index: number;
    length: number;
  } | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // One playback session: a list of ayahs played in order, `total` times over.
  // A single tapped ayah is just a session with a one-entry queue, so repeats
  // and section-repeats share the same engine.
  const sessionRef = useRef<{
    queue: PlayingAyah[];
    index: number;
    pass: number;
    total: number;
    reciter: Reciter;
  } | null>(null);
  // Which candidate URL actually worked for a reciter, so later ayahs skip
  // straight to it instead of re-walking the dead ones every time.
  const goodSourceRef = useRef<Record<string, number>>({});
  const playCurrentRef = useRef<() => void>(() => {});

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      sessionRef.current = null;
    };
  }, []);

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    sessionRef.current = null;
    setPlayingAyah(null);
    setAudioLoading(false);
    setAudioPaused(false);
    setAudioError(null);
    setProgress(null);
  }, []);

  const playCurrent = useCallback(() => {
    const session = sessionRef.current;
    if (!session) return;

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    const item = session.queue[session.index];
    setPlayingAyah(item);
    setAudioLoading(true);
    setAudioPaused(false);
    setAudioError(null);
    setProgress({
      pass: session.pass + 1,
      total: session.total,
      index: session.index + 1,
      length: session.queue.length,
    });

    const sources = getAudioSources(session.reciter, item.surah, item.ayah);
    // Try the known-good candidate first, then everything else in order.
    const preferred = goodSourceRef.current[session.reciter.id] ?? 0;
    const order = [
      preferred,
      ...sources.map((_, i) => i).filter((i) => i !== preferred),
    ].filter((i) => i < sources.length);

    const fail = () => {
      setAudioError(`${session.reciter.name}'s audio is unavailable right now`);
      setAudioLoading(false);
      setPlayingAyah(null);
      setProgress(null);
      sessionRef.current = null;
      audioRef.current = null;
      setTimeout(() => setAudioError(null), 4000);
    };

    const attempt = (n: number) => {
      if (n >= order.length) {
        fail();
        return;
      }
      const sourceIdx = order[n];
      const audio = new Audio(sources[sourceIdx]);
      audioRef.current = audio;

      audio.addEventListener(
        "canplaythrough",
        () => {
          goodSourceRef.current[session.reciter.id] = sourceIdx;
          setAudioLoading(false);
          setAudioError(null);
        },
        { once: true }
      );

      audio.addEventListener("ended", () => {
        const s = sessionRef.current;
        if (!s) return;
        if (s.index < s.queue.length - 1) {
          s.index += 1;
        } else if (s.pass < s.total - 1) {
          s.pass += 1;
          s.index = 0;
        } else {
          stopAudio();
          return;
        }
        playCurrentRef.current();
      });

      // A dead candidate (missing bitrate or wrong edition id) 404s here —
      // fall through to the next one rather than giving up on the reciter.
      audio.addEventListener("error", () => attempt(n + 1), { once: true });
      audio.play().catch(() => attempt(n + 1));
    };

    attempt(0);
  }, [stopAudio]);

  useEffect(() => {
    playCurrentRef.current = playCurrent;
  }, [playCurrent]);

  const startSession = useCallback(
    (reciter: Reciter, queue: PlayingAyah[], total: number) => {
      if (queue.length === 0) return;
      sessionRef.current = { queue, index: 0, pass: 0, total, reciter };
      setActiveReciter(reciter);
      playCurrentRef.current();
    },
    []
  );

  // Queue an ayah list, asking for a reciter only the first time.
  const requestPlayback = useCallback(
    (queue: PlayingAyah[]) => {
      if (activeReciter) {
        startSession(activeReciter, queue, repeatCount);
      } else {
        setPendingQueue(queue);
        setShowReciterPicker(true);
      }
    },
    [activeReciter, repeatCount, startSession]
  );

  const handleAyahClick = useCallback(
    (surah: number, ayah: number, surahName: string) => {
      if (playingAyah && playingAyah.surah === surah && playingAyah.ayah === ayah) {
        if (audioRef.current) {
          if (audioRef.current.paused) {
            audioRef.current.play();
            setAudioPaused(false);
          } else {
            audioRef.current.pause();
            setAudioPaused(true);
          }
        }
        return;
      }
      requestPlayback([{ surah, ayah, surahName }]);
    },
    [playingAyah, requestPlayback]
  );

  const playSection = useCallback(
    (surahId: number, from: number, to: number) => {
      const surah = getSurahById(surahId);
      if (!surah) return;
      const lo = Math.max(1, Math.min(from, to));
      const hi = Math.min(surah.ayahs, Math.max(from, to));
      const queue: PlayingAyah[] = [];
      for (let a = lo; a <= hi; a++) {
        queue.push({ surah: surahId, ayah: a, surahName: surah.englishName });
      }
      requestPlayback(queue);
    },
    [requestPlayback]
  );

  // Whole surah, from the tapped name in the running header.
  const playSurah = useCallback(
    (surahId: number) => {
      const surah = getSurahById(surahId);
      if (surah) playSection(surahId, 1, surah.ayahs);
    },
    [playSection]
  );

  const handleReciterSelect = useCallback(
    (reciter: Reciter) => {
      setShowReciterPicker(false);
      if (pendingQueue) {
        startSession(reciter, pendingQueue, repeatCount);
        setPendingQueue(null);
        return;
      }
      // Picked from the now-playing bar: swap the voice and re-play the ayah
      // we are on, keeping the queue and repeat progress intact.
      const session = sessionRef.current;
      if (session) {
        session.reciter = reciter;
        setActiveReciter(reciter);
        playCurrentRef.current();
        return;
      }
      setActiveReciter(reciter);
    },
    [pendingQueue, repeatCount, startSession]
  );

  const rightPage = leftPage;
  const leftPageNum = leftPage + 1;

  const goTo = useCallback((p: number) => {
    const clamped = Math.max(1, Math.min(TOTAL_PAGES, p));
    const even = clamped % 2 === 0 ? clamped : clamped > 1 ? clamped - 1 : clamped;
    setLeftPage(even);
    setPageInput(String(clamped));
  }, []);

  const prevSpread = () => goTo(rightPage - 2);
  const nextSpread = () => goTo(leftPageNum + 1);

  const handlePageSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const n = parseInt(pageInput);
    if (!isNaN(n)) goTo(n);
  };

  const handleSurahJump = (surahId: string) => {
    if (!surahId) return;
    const s = getSurahById(parseInt(surahId));
    if (s) goTo(s.startPage);
  };

  // Open the section panel on whatever surah the reader is looking at.
  const sectionDefaultSurah = getSurahsOnPage(rightPage)[0]?.id ?? 1;

  return (
    <div className="mushaf-root space-y-1.5">
      {showReciterPicker && (
        <ReciterPicker
          onSelect={handleReciterSelect}
          onClose={() => {
            setShowReciterPicker(false);
            setPendingQueue(null);
          }}
        />
      )}

      {/* Controls */}
      <div className="flex items-center gap-1.5">
        <select
          onChange={(e) => handleSurahJump(e.target.value)}
          defaultValue=""
          className="flex-1 min-w-0 bg-surface-card border border-surface-border rounded-md px-2 py-1 text-[11px] text-ink focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
        >
          <option value="">Jump to Surah...</option>
          {SURAHS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.id}. {s.englishName}
            </option>
          ))}
        </select>

        <form onSubmit={handlePageSubmit} className="flex items-center gap-1 flex-shrink-0">
          <input
            type="number"
            min={1}
            max={TOTAL_PAGES}
            value={pageInput}
            onChange={(e) => setPageInput(e.target.value)}
            className="w-11 bg-surface-card border border-surface-border rounded-md px-1 py-1 text-[11px] text-ink text-center focus:outline-none focus:ring-1 focus:ring-emerald-500/50 tabular-nums"
          />
          <span className="text-[9px] text-ink-muted">/{TOTAL_PAGES}</span>
        </form>
      </div>

      {/* Playback controls — apply to a tapped ayah, a page, a surah name or
          a chosen section. Picking a qari here means playback never has to
          stop and ask, and switching mid-recitation swaps the voice in place. */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[10px] font-semibold text-ink-muted">Qari</span>
        <select
          value={activeReciter?.id ?? ""}
          onChange={(e) => {
            const r = RECITERS.find((x) => x.id === e.target.value);
            if (r) handleReciterSelect(r);
          }}
          className="bg-surface-card border border-surface-border rounded-md px-2 py-1 text-[11px] text-ink focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
        >
          <option value="" disabled>
            Choose…
          </option>
          {RECITERS.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>

        <span className="text-[10px] font-semibold text-ink-muted ml-1">Repeat</span>
        <div className="flex items-center gap-0.5">
          {REPEAT_OPTIONS.map((n) => (
            <button
              key={n}
              onClick={() => setRepeatCount(n)}
              aria-pressed={repeatCount === n}
              className={`px-2 py-1 rounded-md text-[11px] font-semibold tabular-nums transition active:scale-95 ${
                repeatCount === n
                  ? "bg-emerald-600 text-white"
                  : "bg-surface-card border border-surface-border text-ink hover:bg-surface-bg"
              }`}
            >
              {n}×
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowSectionPanel((v) => !v)}
          aria-expanded={showSectionPanel}
          className={`ml-auto px-2 py-1 rounded-md text-[11px] font-semibold transition active:scale-95 ${
            showSectionPanel
              ? "bg-emerald-600 text-white"
              : "bg-surface-card border border-surface-border text-ink hover:bg-surface-bg"
          }`}
        >
          Section…
        </button>
      </div>

      {showSectionPanel && (
        <SectionRepeatPanel
          key={sectionDefaultSurah}
          defaultSurahId={sectionDefaultSurah}
          onPlay={(s, f, t) => {
            setShowSectionPanel(false);
            playSection(s, f, t);
          }}
          onClose={() => setShowSectionPanel(false)}
        />
      )}

      {/* Book spread — lower page number sits on the right (RTL). Whether the
          second page shows, and the row direction, are container-query driven
          (see .mushaf-* rules in globals.css). */}
      <div className="relative bg-[#3a3228] dark:bg-[#1a1610] rounded-xl p-1.5 lg:p-2 shadow-2xl">
        <div className="mushaf-gutter absolute left-1/2 top-2 bottom-2 w-[3px] -translate-x-1/2 bg-gradient-to-r from-black/20 via-black/5 to-black/20 z-10" />

        <div className="mushaf-spread-row flex flex-col items-center justify-center gap-1.5 lg:gap-[3px]">
          <MushafPage
            pageNum={rightPage}
            highlightedRange={highlightedRange}
            playingAyah={playingAyah}
            onAyahClick={handleAyahClick}
            onPlaySurah={playSurah}
            onPlayAyahs={requestPlayback}
          />

          {leftPageNum <= TOTAL_PAGES && (
            <div className="mushaf-second-page">
              <MushafPage
                pageNum={leftPageNum}
                highlightedRange={highlightedRange}
                playingAyah={playingAyah}
                onAyahClick={handleAyahClick}
                onPlaySurah={playSurah}
                onPlayAyahs={requestPlayback}
              />
            </div>
          )}
        </div>

        {audioError && !playingAyah && (
          <div className="mt-1.5 bg-red-900/80 rounded-lg px-3 py-2 text-center">
            <span className="text-[11px] text-red-200">{audioError}</span>
          </div>
        )}

        {playingAyah && activeReciter && (
          <div className="mt-1.5 bg-[#2a2520] dark:bg-[#0f0d0a] rounded-lg px-3 py-2 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              {audioLoading ? (
                <div className="w-4 h-4 rounded-full border-2 border-emerald-400/30 border-t-emerald-400 animate-spin flex-shrink-0" />
              ) : (
                <span className="text-emerald-400 flex-shrink-0">
                  {audioPaused ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
                  )}
                </span>
              )}
              <span className="text-[11px] text-[#c4a95a] font-semibold truncate">
                {playingAyah.surahName} — Ayah {playingAyah.ayah}
              </span>
              {progress && progress.length > 1 && (
                <span className="text-[9px] text-[#8b7d56]/60 flex-shrink-0 tabular-nums">
                  {progress.index}/{progress.length}
                </span>
              )}
              {progress && progress.total > 1 && (
                <span className="text-[9px] text-emerald-400/80 flex-shrink-0 tabular-nums font-semibold">
                  pass {progress.pass}/{progress.total}
                </span>
              )}
              <button
                onClick={() => setShowReciterPicker(true)}
                title="Change reciter"
                className="text-[9px] text-[#8b7d56]/60 hover:text-[#c4a95a] flex-shrink-0 underline decoration-dotted underline-offset-2 transition"
              >
                {activeReciter.name}
              </button>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => handleAyahClick(playingAyah.surah, playingAyah.ayah, playingAyah.surahName)}
                className="text-[#c4a95a]/70 hover:text-[#c4a95a] transition p-1"
              >
                {audioPaused ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
                )}
              </button>
              <button onClick={stopAudio} className="text-[#c4a95a]/70 hover:text-red-400 transition p-1">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="1" /></svg>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Navigation — Next advances (leftward, RTL) */}
      <div className="flex items-center justify-between">
        <button
          onClick={nextSpread}
          disabled={leftPageNum >= TOTAL_PAGES}
          className="flex items-center gap-1 px-3 py-2 rounded-lg bg-surface-card border border-surface-border text-xs font-semibold text-ink hover:bg-surface-bg disabled:opacity-30 transition active:scale-95"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 18l-6-6 6-6" /></svg>
          Next
        </button>

        <span className="text-xs font-bold text-ink tabular-nums">
          {rightPage}
          <span className="mushaf-page-range hidden"> – {Math.min(leftPageNum, TOTAL_PAGES)}</span>
        </span>

        <button
          onClick={prevSpread}
          disabled={rightPage <= 1}
          className="flex items-center gap-1 px-3 py-2 rounded-lg bg-surface-card border border-surface-border text-xs font-semibold text-ink hover:bg-surface-bg disabled:opacity-30 transition active:scale-95"
        >
          Previous
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 18l6-6-6-6" /></svg>
        </button>
      </div>
    </div>
  );
}
