"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import type { Ayah } from "@/data/qaidah";
import { getSurahById } from "@/data/mushaf-index";
import { RECITERS, getAudioSources, type Reciter } from "@/lib/recitation";
import { IconPlay, IconSpeaker, IconStop } from "@/components/icons";
import { useLanguage } from "@/components/LanguageProvider";

// The surahs the Qa'idah books end on, recited: the Mushaf's reciters, from
// the same hosts. One ayah plays at a time across the page, whichever button
// started it, so the player lives here rather than in a component, and every
// button reads the one state.

interface Recitation {
  /** The lesson playing, as "book:lesson"; null when nothing is. */
  lesson: string | null;
  /** The ayah playing now. */
  surah: number;
  ayah: number;
  /** Going on to the end of the surah, rather than stopping after this ayah. */
  through: boolean;
  /** Still fetching it. */
  loading: boolean;
  /** The lesson whose recitation wouldn't play, for a few seconds after. */
  failed: string | null;
}

const IDLE: Recitation = { lesson: null, surah: 0, ayah: 0, through: false, loading: false, failed: null };

let state = IDLE;
const listeners = new Set<() => void>();

function update(next: Partial<Recitation>) {
  state = { ...state, ...next };
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** What's playing, for a button or a row to show. */
export function useRecitation(): Recitation {
  return useSyncExternalStore(subscribe, () => state, () => IDLE);
}

// One audio element for every ayah. An iPhone lets a page play sound only
// from a tap, and a new element for each ayah would need a tap of its own,
// so a surah would stop after its first ayah; an element played once from a
// tap may go on playing whatever it's given.
let element: HTMLAudioElement | null = null;
let queue: { lesson: string; ayahs: Ayah[]; index: number; reciter: Reciter; through: boolean } | null = null;
// Each ayah, and each host tried for it, is one attempt. The element reports
// a dead host twice (its error event and play()'s rejection), and a stopped
// one through play()'s rejection too; only the latest attempt's first report
// counts.
let attempt = 0;
let handled = -1;
let onFailed: () => void = () => {};
// Which of a reciter's hosts answered, so the next ayah goes straight there.
const goodSource: Record<string, number> = {};
let failTimer: ReturnType<typeof setTimeout> | undefined;

function player(): HTMLAudioElement {
  if (element) return element;
  const audio = new Audio();
  audio.preload = "auto";
  audio.addEventListener("playing", () => {
    if (state.loading) update({ loading: false });
  });
  audio.addEventListener("ended", () => {
    const q = queue;
    if (!q) return;
    if (q.index < q.ayahs.length - 1) {
      q.index += 1;
      playCurrent();
    } else {
      stopRecitation();
    }
  });
  audio.addEventListener("error", () => failed(attempt));
  element = audio;
  return audio;
}

function failed(which: number) {
  if (which !== attempt || handled === which || !queue) return;
  handled = which;
  onFailed();
}

/** Stops the recitation, wherever it is. */
export function stopRecitation() {
  queue = null;
  attempt += 1;
  element?.pause();
  if (state.lesson !== null) update({ lesson: null, through: false, loading: false });
}

/** Plays the ayahs in order: one, or a surah through. */
function recite(lesson: string, ayahs: Ayah[], reciter: Reciter, through: boolean) {
  stopRecitation();
  // One voice at a time: the teacher's recording of the lesson pauses.
  document.querySelectorAll("audio").forEach((el) => el.pause());
  clearTimeout(failTimer);
  queue = { lesson, ayahs, index: 0, reciter, through };
  update({ failed: null });
  playCurrent();
}

function playCurrent() {
  const q = queue;
  if (!q) return;
  const [surah, ayah] = q.ayahs[q.index];
  update({ lesson: q.lesson, surah, ayah, through: q.through, loading: true });

  const sources = getAudioSources(q.reciter, surah, ayah);
  const preferred = goodSource[q.reciter.id] ?? 0;
  const order = [preferred, ...sources.map((_, i) => i).filter((i) => i !== preferred)];

  const tryHost = (n: number) => {
    if (queue !== q) return;
    if (n >= order.length) {
      // No host answered: offline, most likely.
      stopRecitation();
      update({ failed: q.lesson });
      failTimer = setTimeout(() => {
        if (state.failed === q.lesson) update({ failed: null });
      }, 6000);
      return;
    }
    const which = ++attempt;
    onFailed = () => tryHost(n + 1);
    const audio = player();
    audio.src = sources[order[n]];
    audio
      .play()
      .then(() => {
        if (which === attempt) goodSource[q.reciter.id] = order[n];
      })
      .catch(() => failed(which));
  };
  tryHost(0);
}

const RECITER_KEY = "mydiiwaan_qaidah_reciter";
/** Al-Husary's is the recitation children learn from: unhurried, every letter clear. */
const DEFAULT_RECITER = RECITERS.find((r) => r.id === "husary") ?? RECITERS[0];

/** The reciter chosen, remembered in this browser. */
export function useQaidahReciter(): [Reciter, (id: string) => void] {
  const [reciter, setReciter] = useState<Reciter>(DEFAULT_RECITER);
  useEffect(() => {
    try {
      const stored = RECITERS.find((r) => r.id === localStorage.getItem(RECITER_KEY));
      if (stored) setReciter(stored);
    } catch {
      // No storage (private browsing): the default it is.
    }
  }, []);
  const choose = useCallback((id: string) => {
    const next = RECITERS.find((r) => r.id === id);
    if (!next) return;
    stopRecitation();
    setReciter(next);
    try {
      localStorage.setItem(RECITER_KEY, id);
    } catch {
      // Still used for this visit.
    }
  }, []);
  return [reciter, choose];
}

/** Plays one ayah, or stops it: at the start of the ayah's row. */
export function AyahButton({ lesson, ayah, reciter }: { lesson: string; ayah: Ayah; reciter: Reciter }) {
  const { t } = useLanguage();
  const now = useRecitation();
  const playing = now.lesson === lesson && now.surah === ayah[0] && now.ayah === ayah[1];
  const label = playing ? t("qaidah.stop") : t("qaidah.playAyah");
  return (
    <button
      type="button"
      onClick={() => (playing ? stopRecitation() : recite(lesson, [ayah], reciter, false))}
      aria-label={label}
      title={label}
      className={`w-9 h-9 rounded-full border flex items-center justify-center flex-shrink-0 transition-colors ${
        playing
          ? "bg-brand-navy border-brand-navy text-white"
          : "bg-surface-card border-surface-border text-ink hover:border-brand-gold/60"
      } ${playing && now.loading ? "animate-pulse" : ""}`}
    >
      {playing ? <IconStop size={12} /> : <IconPlay size={14} />}
    </button>
  );
}

/** Each of the lesson's surahs to play through, and who recites them: above its rows. */
export function RecitationBar({
  lesson,
  ayahs,
  reciter,
  onReciterChange,
}: {
  lesson: string;
  /** The lesson's ayahs, in the order of its rows. */
  ayahs: Ayah[];
  reciter: Reciter;
  onReciterChange: (id: string) => void;
}) {
  const { t, language } = useLanguage();
  const now = useRecitation();

  // Closing the lesson, or leaving the page, stops its recitation.
  useEffect(
    () => () => {
      if (state.lesson === lesson) stopRecitation();
    },
    [lesson]
  );

  const surahs: { surah: number; ayahs: Ayah[] }[] = [];
  for (const ayah of ayahs) {
    const last = surahs[surahs.length - 1];
    if (last?.surah === ayah[0]) last.ayahs.push(ayah);
    else surahs.push({ surah: ayah[0], ayahs: [ayah] });
  }

  return (
    <div className="mt-4 rounded-2xl border border-surface-border bg-surface-bg-warm p-3 space-y-2.5">
      <p className="text-[12.5px] font-semibold text-ink flex items-center gap-1.5">
        <IconSpeaker size={15} />
        {t("qaidah.listenReciter")}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {surahs.map(({ surah, ayahs: list }) => {
          const active = now.lesson === lesson && now.through && now.surah === surah;
          const meta = getSurahById(surah);
          return (
            <button
              key={surah}
              type="button"
              aria-pressed={active}
              onClick={() => (active ? stopRecitation() : recite(lesson, list, reciter, true))}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[12.5px] font-semibold transition-colors ${
                active
                  ? "bg-brand-navy border-brand-navy text-white"
                  : "bg-surface-card border-surface-border text-ink hover:border-brand-gold/60"
              } ${active && now.loading ? "animate-pulse" : ""}`}
            >
              {active ? <IconStop size={12} /> : <IconPlay size={13} />}
              {language === "ar" ? meta?.name : meta?.englishName}
            </button>
          );
        })}
      </div>
      <label className="flex flex-wrap items-center gap-2 text-[12px] text-ink-muted">
        {t("qaidah.recitedBy")}
        <select
          value={reciter.id}
          onChange={(e) => onReciterChange(e.target.value)}
          className="rounded-full border border-surface-border bg-surface-card text-ink text-[12.5px] font-semibold px-3 py-1.5 focus:outline-none focus:border-brand-gold"
        >
          {RECITERS.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </label>
      <p className="text-[11.5px] text-ink-muted">{t("qaidah.ayahTip")}</p>
      {now.failed === lesson && (
        <p role="alert" className="text-[12px] text-status-error-text">
          {t("qaidah.recitationFailed")}
        </p>
      )}
    </div>
  );
}
