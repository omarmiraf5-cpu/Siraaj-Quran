"use client";

import { useEffect, useRef, useState } from "react";
import type { QaidahBookId } from "@/data/qaidah";
import { deleteLessonRecording, saveLessonRecording } from "@/hooks/useQaidahRecordings";
import {
  RECORDING_MAX_BYTES,
  RECORDING_MAX_SECONDS,
  TILE_MAX_SECONDS,
  clock,
  recordingKey,
  recordingType,
  type QaidahRecording,
} from "@/lib/qaidahRecordings";
import { IconArrow, IconMic, IconPlay, IconSpeaker, IconStop } from "@/components/icons";
import { playTracks, stopPlayback, tileTrack, tileTrackId, usePlayback } from "@/components/QaidahPlayer";
import { useLanguage } from "@/components/LanguageProvider";

/** What the recorder records in, best first: MP4 plays everywhere, iPhones included. */
const RECORDER_TYPES = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"];

/** A recording made, before it's saved. */
interface Clip {
  blob: Blob;
  type: string;
  duration: number | null;
}

interface Take extends Clip {
  url: string;
}

/** The length of an audio file, where the file says. */
function probeDuration(url: string): Promise<number | null> {
  return new Promise((resolve) => {
    const audio = new Audio();
    audio.preload = "metadata";
    audio.onloadedmetadata = () => resolve(Number.isFinite(audio.duration) ? audio.duration : null);
    audio.onerror = () => resolve(null);
    audio.src = url;
  });
}

/**
 * A teacher's recording of one lesson: record it with the microphone (or
 * upload one made elsewhere, such as a voice note), listen back, and save it
 * for the school's children — or record it again, or delete it.
 */
export function LessonRecorder({
  book,
  lesson,
  recording,
  demo,
  unavailable,
  onSaved,
  onDeleted,
  oneByOne,
}: {
  book: QaidahBookId;
  lesson: number;
  recording?: QaidahRecording;
  demo: boolean;
  /** The school's database can't take recordings yet. */
  unavailable?: boolean;
  onSaved: (recording: QaidahRecording) => void;
  onDeleted: () => void;
  /** Recording the lesson's tiles one by one instead: how far that's got, and the way in. */
  oneByOne?: { recorded: number; total: number; onStart: () => void };
}) {
  const { t } = useLanguage();
  const [phase, setPhase] = useState<"idle" | "recording" | "review" | "saving">("idle");
  const [take, setTake] = useState<Take | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [canRecord, setCanRecord] = useState(false);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const discardOnStop = useRef(false);
  const fileInput = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setCanRecord(!!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined");
  }, []);

  const release = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
  };

  // Leaving the lesson mid-recording stops the microphone and drops the take.
  useEffect(
    () => () => {
      discardOnStop.current = true;
      if (recorder.current?.state === "recording") recorder.current.stop();
      release();
    },
    []
  );
  useEffect(() => () => (take ? URL.revokeObjectURL(take.url) : undefined), [take]);

  const start = async () => {
    setError(null);
    setConfirmDelete(false);
    try {
      const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = mic;
      const mimeType = RECORDER_TYPES.find((type) => MediaRecorder.isTypeSupported?.(type));
      const rec = new MediaRecorder(mic, mimeType ? { mimeType } : undefined);
      const chunks: Blob[] = [];
      const began = Date.now();
      discardOnStop.current = false;
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      rec.onstop = () => {
        release();
        if (discardOnStop.current) {
          setPhase("idle");
          return;
        }
        const type = recordingType(rec.mimeType || mimeType || "") ?? "audio/webm";
        const blob = new Blob(chunks, { type });
        setTake({ blob, url: URL.createObjectURL(blob), type, duration: (Date.now() - began) / 1000 });
        setPhase("review");
      };
      recorder.current = rec;
      rec.start(1000);
      setSeconds(0);
      setPhase("recording");
      timer.current = setInterval(() => {
        const elapsed = (Date.now() - began) / 1000;
        setSeconds(elapsed);
        if (elapsed >= RECORDING_MAX_SECONDS && rec.state === "recording") rec.stop();
      }, 250);
    } catch (err) {
      release();
      const denied = err instanceof DOMException && (err.name === "NotAllowedError" || err.name === "SecurityError");
      setError(denied ? t("qaidah.micDenied") : t("qaidah.noMic"));
      setPhase("idle");
    }
  };

  const stop = () => {
    if (recorder.current?.state === "recording") recorder.current.stop();
  };

  const cancel = () => {
    discardOnStop.current = true;
    stop();
  };

  const pickFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    const type = recordingType(file.type, file.name);
    if (!type) return setError(t("qaidah.notAudio"));
    if (file.size > RECORDING_MAX_BYTES) return setError(t("qaidah.tooBig"));
    const url = URL.createObjectURL(file);
    setTake({ blob: file, url, type, duration: await probeDuration(url) });
    setPhase("review");
  };

  const discard = () => {
    setTake(null);
    setPhase("idle");
  };

  const save = async () => {
    if (!take) return;
    setPhase("saving");
    setError(null);
    try {
      onSaved(await saveLessonRecording(demo, book, lesson, take));
      setTake(null);
      setPhase("idle");
    } catch (err) {
      setError(err instanceof Error ? err.message : "That recording didn't save. Please try again.");
      setPhase("review");
    }
  };

  const remove = async () => {
    setError(null);
    try {
      await deleteLessonRecording(demo, book, lesson);
      setConfirmDelete(false);
      onDeleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That recording couldn't be removed.");
    }
  };

  const busy = phase === "saving";
  const oneByOneButton = oneByOne && (
    <button
      type="button"
      onClick={oneByOne.onStart}
      className="rounded-full border border-brand-gold/60 bg-surface-card text-[12.5px] font-semibold text-ink px-3.5 py-2 hover:border-brand-gold"
    >
      {t("qaidah.recordOneByOne")}
    </button>
  );
  const oneByOneProgress =
    oneByOne && oneByOne.recorded > 0 ? (
      <p className="text-[12px] text-ink-muted">
        <span className="tabular-nums">
          {oneByOne.recorded} / {oneByOne.total}
        </span>{" "}
        {t("qaidah.recordedOneByOne")}
      </p>
    ) : null;
  return (
    <div className="mt-4 rounded-2xl border border-brand-gold/40 bg-surface-bg-warm p-3 space-y-2.5">
      {unavailable ? (
        <p className="text-[12.5px] text-status-warning-text">{t("qaidah.recordingsMissing")}</p>
      ) : phase === "recording" ? (
        <div className="flex items-center gap-3">
          <span className="relative flex w-3 h-3" aria-hidden>
            <span className="absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-60 animate-ping" />
            <span className="relative inline-flex w-3 h-3 rounded-full bg-red-600" />
          </span>
          <span className="text-[13px] font-semibold text-ink" aria-live="polite">
            {t("qaidah.recording")} · <span className="tabular-nums">{clock(seconds)}</span>
          </span>
          <button
            type="button"
            onClick={stop}
            className="ms-auto inline-flex items-center gap-1.5 rounded-full bg-red-700 text-white text-[12.5px] font-semibold px-3.5 py-2"
          >
            <IconStop size={13} />
            {t("qaidah.stop")}
          </button>
          <button type="button" onClick={cancel} className="text-[12.5px] font-semibold text-ink-muted hover:text-ink">
            {t("common.cancel")}
          </button>
        </div>
      ) : (phase === "review" || phase === "saving") && take ? (
        <>
          <p className="text-[12.5px] text-ink-body">{t("qaidah.listenBack")}</p>
          <audio controls src={take.url} onPlay={stopPlayback} className="w-full" />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={save}
              disabled={busy}
              className="rounded-full bg-brand-navy text-white text-[12.5px] font-semibold px-4 py-2 disabled:opacity-40"
            >
              {busy ? t("qaidah.saving") : t("qaidah.saveRecording")}
            </button>
            {canRecord && (
              <button
                type="button"
                onClick={start}
                disabled={busy}
                className="rounded-full border border-surface-border bg-surface-card text-[12.5px] font-semibold text-ink px-3.5 py-2 disabled:opacity-40"
              >
                {t("qaidah.recordAgain")}
              </button>
            )}
            <button
              type="button"
              onClick={discard}
              disabled={busy}
              className="text-[12.5px] font-semibold text-ink-muted hover:text-ink px-1 disabled:opacity-40"
            >
              {t("qaidah.discard")}
            </button>
          </div>
        </>
      ) : recording ? (
        <>
          <p className="text-[12.5px] font-semibold text-ink flex items-center gap-1.5">
            <IconSpeaker size={15} />
            {t("qaidah.recorded")}
            {recording.teacher_name && (
              <span className="font-normal text-ink-muted">
                · {t("qaidah.recordedBy")} {recording.teacher_name}
              </span>
            )}
            {recording.duration_s !== null && (
              <span className="font-normal text-ink-muted tabular-nums">· {clock(recording.duration_s)}</span>
            )}
          </p>
          <audio controls preload="none" src={recording.url} onPlay={stopPlayback} className="w-full" />
          {confirmDelete ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[12.5px] text-ink">{t("qaidah.deleteConfirm")}</span>
              <button
                type="button"
                onClick={remove}
                className="rounded-full bg-red-700 text-white text-[12px] font-semibold px-3 py-1.5"
              >
                {t("qaidah.yesDelete")}
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="text-[12px] font-semibold text-ink-muted hover:text-ink px-1"
              >
                {t("qaidah.keep")}
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              {canRecord && (
                <button
                  type="button"
                  onClick={start}
                  className="inline-flex items-center gap-1.5 rounded-full border border-surface-border bg-surface-card text-[12px] font-semibold text-ink px-3 py-1.5"
                >
                  <IconMic size={13} />
                  {t("qaidah.recordAgain")}
                </button>
              )}
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                className="rounded-full border border-surface-border bg-surface-card text-[12px] font-semibold text-ink px-3 py-1.5"
              >
                {t("qaidah.upload")}
              </button>
              {oneByOneButton}
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="ms-auto text-[12px] font-semibold text-status-error-text hover:underline"
              >
                {t("qaidah.deleteRecording")}
              </button>
            </div>
          )}
          {oneByOneProgress}
        </>
      ) : (
        <>
          <p className="text-[12.5px] text-ink-body">{t("qaidah.recordPrompt")}</p>
          <div className="flex flex-wrap items-center gap-2">
            {canRecord && (
              <button
                type="button"
                onClick={start}
                className="inline-flex items-center gap-1.5 rounded-full bg-red-700 text-white text-[12.5px] font-semibold px-3.5 py-2"
              >
                <IconMic size={14} />
                {t("qaidah.record")}
              </button>
            )}
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="rounded-full border border-surface-border bg-surface-card text-[12.5px] font-semibold text-ink px-3.5 py-2"
            >
              {t("qaidah.upload")}
            </button>
            {oneByOneButton}
          </div>
          {oneByOneProgress}
        </>
      )}
      <input
        ref={fileInput}
        type="file"
        accept="audio/*,.m4a,.mp3,.wav,.ogg,.opus,.webm"
        className="hidden"
        aria-label={t("qaidah.upload")}
        onChange={(e) => {
          void pickFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      {error && (
        <p role="alert" className="text-[12.5px] text-status-error-text">
          {error}
        </p>
      )}
    </div>
  );
}

/** The teacher's recording of a lesson, for a child or a parent to play. */
export function LessonListen({ recording, label }: { recording: QaidahRecording; label: string }) {
  const { t } = useLanguage();
  return (
    <div className="mt-4 rounded-2xl border border-brand-gold/40 bg-surface-bg-warm p-3 space-y-2">
      <p className="text-[12.5px] font-semibold text-ink flex flex-wrap items-center gap-1.5">
        <IconSpeaker size={15} />
        {label}
        {recording.teacher_name && (
          <span className="font-normal text-ink-muted">
            · {t("qaidah.recordedBy")} {recording.teacher_name}
          </span>
        )}
      </p>
      <audio controls preload="none" src={recording.url} onPlay={stopPlayback} className="w-full" />
    </div>
  );
}

export type TileStatus = "saving" | "failed";

/** Big enough to read across a room, and still fitting when the tile is a whole ayah. */
function bigTileSize(item: string) {
  return item.length > 30 ? "text-[22px]" : item.length > 10 ? "text-[30px]" : "text-[44px]";
}

/**
 * Recording a lesson's tiles one by one, for a child to tap each and hear
 * it: the tile chosen, large, and Record. Read it, press Stop, and it saves
 * while the next one not yet recorded comes up, so a teacher can go straight
 * through a lesson's letters. Any tile can be chosen again, here or in the
 * rows below, to listen, record it again or delete it.
 */
export function TileRecorder({
  book,
  lesson,
  lessonKey,
  tiles,
  recordings,
  demo,
  selected,
  onSelect,
  status,
  onStatus,
  onSaved,
  onDeleted,
  onDone,
}: {
  book: QaidahBookId;
  lesson: number;
  lessonKey: string;
  /** The lesson's tiles, in the order they're read, each once. */
  tiles: string[];
  recordings: Map<string, QaidahRecording>;
  demo: boolean;
  /** The tile to record. */
  selected: string;
  onSelect: (item: string) => void;
  /** Tiles still saving, or that didn't save, by recordingKey. */
  status: Record<string, TileStatus>;
  onStatus: (item: string, status: TileStatus | null) => void;
  onSaved: (recording: QaidahRecording) => void;
  onDeleted: (item: string) => void;
  onDone: () => void;
}) {
  const { t } = useLanguage();
  const now = usePlayback();
  const [phase, setPhase] = useState<"idle" | "recording">("idle");
  // The tile being recorded: the one chosen when Record was pressed.
  const [recordingItem, setRecordingItem] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const stream = useRef<MediaStream | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const discardOnStop = useRef(false);
  // Saves go one after another, behind the recording.
  const saving = useRef<Promise<void>>(Promise.resolve());
  // Recordings that didn't save, kept to try again, and why.
  const unsaved = useRef(new Map<string, { clip: Clip; message: string }>());
  // What the recorder's callbacks need, as it is now rather than when they were made.
  const latest = useRef({ recordings, status, onSaved, onStatus, onSelect });
  latest.current = { recordings, status, onSaved, onStatus, onSelect };

  const key = (item: string) => recordingKey(book, lesson, item);
  const recording = recordings.get(key(selected));
  const selectedStatus = status[key(selected)];
  const index = Math.max(0, tiles.indexOf(selected));
  const recordedCount = tiles.filter((item) => recordings.has(key(item))).length;
  const shown = recordingItem ?? selected;
  const listening = now.lesson === lessonKey && now.track === tileTrackId(selected);

  // Leaving: the microphone goes off, and a recording half made is dropped.
  useEffect(
    () => () => {
      discardOnStop.current = true;
      if (recorder.current?.state === "recording") recorder.current.stop();
      if (timer.current) clearInterval(timer.current);
      stream.current?.getTracks().forEach((track) => track.stop());
    },
    []
  );
  useEffect(() => {
    setConfirmDelete(false);
  }, [selected]);

  /** The next tile not yet recorded, going on from this one and round again; or simply the next. */
  const nextAfter = (item: string) => {
    const { recordings: have, status: pending } = latest.current;
    const done = (x: string) => x === item || have.has(key(x)) || pending[key(x)] === "saving";
    const i = tiles.indexOf(item);
    for (let step = 1; step < tiles.length; step++) {
      const candidate = tiles[(i + step) % tiles.length];
      if (!done(candidate)) return candidate;
    }
    return tiles[Math.min(i + 1, tiles.length - 1)];
  };

  const save = (item: string, clip: Clip) => {
    unsaved.current.delete(item);
    latest.current.onStatus(item, "saving");
    saving.current = saving.current.then(async () => {
      try {
        const saved = await saveLessonRecording(demo, book, lesson, clip, item);
        latest.current.onSaved(saved);
        latest.current.onStatus(item, null);
      } catch (err) {
        unsaved.current.set(item, {
          clip,
          message: err instanceof Error ? err.message : t("qaidah.tileFailed"),
        });
        latest.current.onStatus(item, "failed");
      }
    });
  };

  const start = async () => {
    setError(null);
    setConfirmDelete(false);
    const item = selected;
    try {
      // One microphone for the whole lesson: asked for once, and quick to start again.
      if (!stream.current) stream.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = RECORDER_TYPES.find((type) => MediaRecorder.isTypeSupported?.(type));
      const rec = new MediaRecorder(stream.current, mimeType ? { mimeType } : undefined);
      const chunks: Blob[] = [];
      const began = Date.now();
      discardOnStop.current = false;
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      rec.onstop = () => {
        if (timer.current) clearInterval(timer.current);
        timer.current = null;
        setPhase("idle");
        setRecordingItem(null);
        if (discardOnStop.current) return;
        const duration = (Date.now() - began) / 1000;
        const type = recordingType(rec.mimeType || mimeType || "") ?? "audio/webm";
        const blob = new Blob(chunks, { type });
        if (blob.size === 0 || duration < 0.3) {
          setError(t("qaidah.tooShort"));
          return;
        }
        save(item, { blob, type, duration });
        latest.current.onSelect(nextAfter(item));
      };
      recorder.current = rec;
      stopPlayback();
      rec.start();
      setRecordingItem(item);
      setSeconds(0);
      setPhase("recording");
      timer.current = setInterval(() => {
        const elapsed = (Date.now() - began) / 1000;
        setSeconds(elapsed);
        if (elapsed >= TILE_MAX_SECONDS && rec.state === "recording") rec.stop();
      }, 200);
    } catch (err) {
      const denied = err instanceof DOMException && (err.name === "NotAllowedError" || err.name === "SecurityError");
      setError(denied ? t("qaidah.micDenied") : t("qaidah.noMic"));
      setPhase("idle");
      setRecordingItem(null);
    }
  };

  const stop = () => {
    if (recorder.current?.state === "recording") recorder.current.stop();
  };

  const cancel = () => {
    discardOnStop.current = true;
    stop();
  };

  const retry = () => {
    const kept = unsaved.current.get(selected);
    if (kept) save(selected, kept.clip);
  };

  const remove = async () => {
    setError(null);
    try {
      await deleteLessonRecording(demo, book, lesson, selected);
      setConfirmDelete(false);
      onDeleted(selected);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That recording couldn't be removed.");
    }
  };

  const recordingNow = phase === "recording";
  const stepClass =
    "w-10 h-10 rounded-full border border-surface-border bg-surface-card text-ink flex items-center justify-center flex-shrink-0 hover:border-brand-gold/60 disabled:opacity-30";
  return (
    <div
      role="region"
      aria-label={t("qaidah.oneByOneTitle")}
      className="mt-4 rounded-2xl border border-brand-gold/40 bg-surface-bg-warm p-3 space-y-3"
    >
      <div className="flex items-center gap-2">
        <p className="text-[12.5px] font-semibold text-ink flex items-center gap-1.5">
          <IconMic size={14} />
          {t("qaidah.oneByOneTitle")}
        </p>
        <span className="text-[12px] text-ink-muted tabular-nums">
          {recordedCount} / {tiles.length}
        </span>
        <button
          type="button"
          onClick={onDone}
          disabled={recordingNow}
          className="ms-auto rounded-full border border-surface-border bg-surface-card text-[12px] font-semibold text-ink px-3.5 py-1.5 disabled:opacity-40"
        >
          {t("qaidah.done")}
        </button>
      </div>

      {/* Right to left, as the tiles are read: the one before on the right,
          the next on the left. */}
      <div dir="rtl" className="flex items-center justify-center gap-3">
        <button
          type="button"
          aria-label={t("qaidah.previous")}
          title={t("qaidah.previous")}
          onClick={() => onSelect(tiles[index - 1])}
          disabled={index === 0 || recordingNow}
          className={stepClass}
        >
          <IconArrow size={16} />
        </button>
        <span
          lang="ar"
          className={`font-arabic text-ink ${bigTileSize(shown)} leading-[1.7] text-center rounded-2xl bg-surface-card border-2 ${
            recordingNow ? "border-red-600" : "border-brand-gold/60"
          } px-5 py-1 min-w-[96px] max-w-full`}
        >
          {shown}
        </span>
        <button
          type="button"
          aria-label={t("qaidah.next")}
          title={t("qaidah.next")}
          onClick={() => onSelect(tiles[index + 1])}
          disabled={index >= tiles.length - 1 || recordingNow}
          className={stepClass}
        >
          <IconArrow size={16} className="rotate-180" />
        </button>
      </div>

      <p className="text-center text-[12px] text-ink-muted" aria-live="polite">
        {recordingNow ? (
          <span className="inline-flex items-center gap-2 font-semibold text-ink">
            <span className="relative flex w-2.5 h-2.5" aria-hidden>
              <span className="absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-60 animate-ping" />
              <span className="relative inline-flex w-2.5 h-2.5 rounded-full bg-red-600" />
            </span>
            {t("qaidah.recording")} · <span className="tabular-nums">{clock(seconds)}</span>
          </span>
        ) : selectedStatus === "saving" ? (
          t("qaidah.saving")
        ) : selectedStatus === "failed" ? (
          <span className="text-status-error-text">
            {unsaved.current.get(selected)?.message ?? t("qaidah.tileFailed")}
          </span>
        ) : recording ? (
          t("qaidah.recorded")
        ) : (
          t("qaidah.notRecorded")
        )}
      </p>

      <div className="flex flex-wrap items-center justify-center gap-2">
        {recordingNow ? (
          <>
            <button
              type="button"
              onClick={stop}
              className="inline-flex items-center gap-1.5 rounded-full bg-red-700 text-white text-[13px] font-semibold px-5 py-2.5"
            >
              <IconStop size={13} />
              {t("qaidah.stop")}
            </button>
            <button type="button" onClick={cancel} className="text-[12.5px] font-semibold text-ink-muted hover:text-ink px-1">
              {t("common.cancel")}
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={start}
              className="inline-flex items-center gap-1.5 rounded-full bg-red-700 text-white text-[13px] font-semibold px-5 py-2.5"
            >
              <IconMic size={14} />
              {recording ? t("qaidah.recordAgain") : t("qaidah.record")}
            </button>
            {selectedStatus === "failed" && (
              <button
                type="button"
                onClick={retry}
                className="rounded-full border border-surface-border bg-surface-card text-[12.5px] font-semibold text-ink px-3.5 py-2"
              >
                {t("qaidah.tryAgain")}
              </button>
            )}
            {recording && (
              <button
                type="button"
                aria-pressed={listening}
                onClick={() => (listening ? stopPlayback() : playTracks(lessonKey, [tileTrack(recording)]))}
                className="inline-flex items-center gap-1.5 rounded-full border border-surface-border bg-surface-card text-[12.5px] font-semibold text-ink px-3.5 py-2"
              >
                {listening ? <IconStop size={12} /> : <IconPlay size={13} />}
                {t("qaidah.listenTile")}
              </button>
            )}
            {recording &&
              (confirmDelete ? (
                <span className="inline-flex items-center gap-2">
                  <button
                    type="button"
                    onClick={remove}
                    className="rounded-full bg-red-700 text-white text-[12px] font-semibold px-3 py-1.5"
                  >
                    {t("qaidah.yesDelete")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="text-[12px] font-semibold text-ink-muted hover:text-ink px-1"
                  >
                    {t("qaidah.keep")}
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="text-[12px] font-semibold text-status-error-text hover:underline px-1"
                >
                  {t("qaidah.deleteRecording")}
                </button>
              ))}
          </>
        )}
      </div>

      <p className="text-[11.5px] text-ink-muted text-center">{t("qaidah.oneByOneHelp")}</p>
      {error && (
        <p role="alert" className="text-[12.5px] text-status-error-text text-center">
          {error}
        </p>
      )}
    </div>
  );
}
