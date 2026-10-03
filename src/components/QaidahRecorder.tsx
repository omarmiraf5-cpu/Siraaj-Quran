"use client";

import { useEffect, useRef, useState } from "react";
import type { QaidahBookId } from "@/data/qaidah";
import { deleteLessonRecording, saveLessonRecording } from "@/hooks/useQaidahRecordings";
import {
  RECORDING_MAX_BYTES,
  RECORDING_MAX_SECONDS,
  clock,
  recordingType,
  type QaidahRecording,
} from "@/lib/qaidahRecordings";
import { IconMic, IconSpeaker, IconStop } from "@/components/icons";
import { stopRecitation } from "@/components/QaidahRecitation";
import { useLanguage } from "@/components/LanguageProvider";

/** What the recorder records in, best first: MP4 plays everywhere, iPhones included. */
const RECORDER_TYPES = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"];

interface Take {
  blob: Blob;
  url: string;
  type: string;
  duration: number | null;
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
}: {
  book: QaidahBookId;
  lesson: number;
  recording?: QaidahRecording;
  demo: boolean;
  /** The school's database can't take recordings yet. */
  unavailable?: boolean;
  onSaved: (recording: QaidahRecording) => void;
  onDeleted: () => void;
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
          <audio controls src={take.url} onPlay={stopRecitation} className="w-full" />
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
          <audio controls preload="none" src={recording.url} onPlay={stopRecitation} className="w-full" />
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
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="ms-auto text-[12px] font-semibold text-status-error-text hover:underline"
              >
                {t("qaidah.deleteRecording")}
              </button>
            </div>
          )}
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
          </div>
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
      <audio controls preload="none" src={recording.url} onPlay={stopRecitation} className="w-full" />
    </div>
  );
}
