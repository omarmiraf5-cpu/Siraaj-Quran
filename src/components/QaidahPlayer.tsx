"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import type { Ayah } from "@/data/qaidah";
import { getSurahById } from "@/data/mushaf-index";
import { RECITERS, getAudioSources, type Reciter } from "@/lib/recitation";
import type { QaidahRecording } from "@/lib/qaidahRecordings";
import { IconPlay, IconSpeaker, IconStop } from "@/components/icons";
import { useLanguage } from "@/components/LanguageProvider";

// What the Qa'idah plays besides a lesson's recording as a whole: the surahs
// the books end on, recited by the Mushaf's reciters from the same hosts,
// and the teacher's recordings of a lesson's tiles, one by one. One thing
// plays at a time across the page, whichever button started it, so the
// player lives here rather than in a component, and every button, row and
// tile reads the one state.

/** One thing to play: an ayah in a reciter's voice, or a tile in the teacher's. */
export interface Track {
  /** What it is, for its row or tile to light up while it plays. */
  id: string;
  /** Where to fetch it from, best first: when one fails, the next is tried. */
  sources: string[];
  /** A reciter's id: which of their hosts answered is remembered, and tried first next time. */
  host?: string;
}

interface Playback {
  /** The lesson playing, as "book:lesson"; null when nothing is. */
  lesson: string | null;
  /** The track playing now. */
  track: string | null;
  /** The run it's part of (a surah, a lesson's tiles), or null for a track on its own. */
  group: string | null;
  /** Still fetching it. */
  loading: boolean;
  /** What wouldn't play, for a few seconds after: in which lesson, and an ayah or a tile. */
  failed: { lesson: string; kind: "ayah" | "tile" } | null;
}

const IDLE: Playback = { lesson: null, track: null, group: null, loading: false, failed: null };

let state = IDLE;
const listeners = new Set<() => void>();

function update(next: Partial<Playback>) {
  state = { ...state, ...next };
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** What's playing, for a button, a row or a tile to show. */
export function usePlayback(): Playback {
  return useSyncExternalStore(subscribe, () => state, () => IDLE);
}

export const ayahTrackId = ([surah, ayah]: Ayah) => `ayah:${surah}:${ayah}`;
export const tileTrackId = (item: string) => `tile:${item}`;

/** An ayah, in a reciter's voice. */
export function ayahTrack(reciter: Reciter, ayah: Ayah): Track {
  return { id: ayahTrackId(ayah), sources: getAudioSources(reciter, ayah[0], ayah[1]), host: reciter.id };
}

/** A tile, in the teacher's voice. */
export function tileTrack(recording: QaidahRecording): Track {
  return { id: tileTrackId(recording.item), sources: [recording.url] };
}

// One audio element for everything. An iPhone lets a page play sound only
// from a tap, and a new element for each track would need a tap of its own,
// so a surah would stop after its first ayah; an element played once from a
// tap may go on playing whatever it's given.
let element: HTMLAudioElement | null = null;
let queue: { lesson: string; tracks: Track[]; index: number; group: string | null } | null = null;
// Each track, and each source tried for it, is one attempt. The element
// reports a dead source twice (its error event and play()'s rejection), and a
// stopped one through play()'s rejection too; only the latest attempt's first
// report counts.
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
    if (q.index < q.tracks.length - 1) {
      q.index += 1;
      playCurrent();
    } else {
      stopPlayback();
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

/** Stops whatever is playing. */
export function stopPlayback() {
  queue = null;
  attempt += 1;
  element?.pause();
  if (state.lesson !== null) update({ lesson: null, track: null, group: null, loading: false });
}

/** Stops it if it's in this lesson: one being closed, or left. */
export function stopPlaybackIn(lesson: string) {
  if (state.lesson === lesson) stopPlayback();
}

/** Plays the tracks in order: one on its own, or a run of them named by `group`. */
export function playTracks(lesson: string, tracks: Track[], group: string | null = null) {
  if (tracks.length === 0) return;
  stopPlayback();
  // One voice at a time: a lesson's recording, playing as a whole, pauses.
  document.querySelectorAll("audio").forEach((el) => el.pause());
  clearTimeout(failTimer);
  queue = { lesson, tracks, index: 0, group };
  update({ failed: null });
  playCurrent();
}

function playCurrent() {
  const q = queue;
  if (!q) return;
  const track = q.tracks[q.index];
  update({ lesson: q.lesson, track: track.id, group: q.group, loading: true });

  const preferred = track.host ? (goodSource[track.host] ?? 0) : 0;
  const order = [preferred, ...track.sources.map((_, i) => i).filter((i) => i !== preferred)].filter(
    (i) => i < track.sources.length
  );

  const tryNext = (n: number) => {
    if (queue !== q) return;
    if (n >= order.length) {
      // Nothing answered: offline, most likely.
      stopPlayback();
      const failure = { lesson: q.lesson, kind: track.id.startsWith("ayah:") ? "ayah" : "tile" } as const;
      update({ failed: failure });
      failTimer = setTimeout(() => {
        if (state.failed === failure) update({ failed: null });
      }, 6000);
      return;
    }
    const which = ++attempt;
    onFailed = () => tryNext(n + 1);
    const audio = player();
    audio.src = track.sources[order[n]];
    audio
      .play()
      .then(() => {
        if (which === attempt && track.host) goodSource[track.host] = order[n];
      })
      .catch(() => failed(which));
  };
  tryNext(0);
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
    stopPlayback();
    setReciter(next);
    try {
      localStorage.setItem(RECITER_KEY, id);
    } catch {
      // Still used for this visit.
    }
  }, []);
  return [reciter, choose];
}

const pillClass = (active: boolean, loading: boolean) =>
  `inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[12.5px] font-semibold transition-colors ${
    active
      ? "bg-brand-navy border-brand-navy text-white"
      : "bg-surface-card border-surface-border text-ink hover:border-brand-gold/60"
  } ${active && loading ? "animate-pulse" : ""}`;

/** Plays one ayah, or stops it: at the start of the ayah's row. */
export function AyahButton({ lesson, ayah, reciter }: { lesson: string; ayah: Ayah; reciter: Reciter }) {
  const { t } = useLanguage();
  const now = usePlayback();
  const playing = now.lesson === lesson && now.track === ayahTrackId(ayah);
  const label = playing ? t("qaidah.stop") : t("qaidah.playAyah");
  return (
    <button
      type="button"
      onClick={() => (playing ? stopPlayback() : playTracks(lesson, [ayahTrack(reciter, ayah)]))}
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
  const now = usePlayback();

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
          const group = `surah:${surah}`;
          const active = now.lesson === lesson && now.group === group;
          const meta = getSurahById(surah);
          return (
            <button
              key={surah}
              type="button"
              aria-pressed={active}
              onClick={() =>
                active ? stopPlayback() : playTracks(lesson, list.map((a) => ayahTrack(reciter, a)), group)
              }
              className={pillClass(active, now.loading)}
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
      {now.failed?.lesson === lesson && now.failed.kind === "ayah" && (
        <p role="alert" className="text-[12px] text-status-error-text">
          {t("qaidah.recitationFailed")}
        </p>
      )}
    </div>
  );
}

/**
 * Over a lesson whose tiles the teacher recorded one by one: that a tile
 * plays when it's tapped, and all of them read in turn.
 */
export function TileListenBar({ lesson, tracks }: { lesson: string; tracks: Track[] }) {
  const { t } = useLanguage();
  const now = usePlayback();
  const active = now.lesson === lesson && now.group === "tiles";
  return (
    <div className="mt-4 rounded-2xl border border-brand-gold/40 bg-surface-bg-warm px-3 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-2">
      <p className="me-auto text-[12.5px] font-semibold text-ink flex items-center gap-1.5">
        <IconSpeaker size={15} />
        {t("qaidah.tapToHear")}
      </p>
      <button
        type="button"
        aria-pressed={active}
        onClick={() => (active ? stopPlayback() : playTracks(lesson, tracks, "tiles"))}
        className={pillClass(active, now.loading)}
      >
        {active ? <IconStop size={12} /> : <IconPlay size={13} />}
        {t("qaidah.hearAll")}
      </button>
      {now.failed?.lesson === lesson && now.failed.kind === "tile" && (
        <p role="alert" className="w-full text-[12px] text-status-error-text">
          {t("qaidah.tileRecordingFailed")}
        </p>
      )}
    </div>
  );
}
