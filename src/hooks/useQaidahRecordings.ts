"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { QaidahBookId } from "@/data/qaidah";
import type { PortalMode } from "@/hooks/usePortalRoster";
import { createClient } from "@/lib/supabase/client";
import {
  demoDeleteRecording,
  demoListRecordings,
  demoSaveRecording,
} from "@/lib/demoRecordings";
import { recordingKey, type QaidahRecording } from "@/lib/qaidahRecordings";

/**
 * The school's recordings of Qa'idah lessons, keyed by book and lesson, with
 * a link to play each — or, in the sample portal, the ones made in this
 * browser.
 */
export function useQaidahRecordings(mode: PortalMode) {
  const [recordings, setRecordings] = useState<Map<string, QaidahRecording>>(new Map());
  const [ready, setReady] = useState(false);
  // The school's database hasn't had the update that adds them yet.
  const [missingTable, setMissingTable] = useState(false);
  const objectUrls = useRef<string[]>([]);

  useEffect(() => {
    if (mode === "loading") return;
    let cancelled = false;
    const load = async () => {
      if (mode === "demo") {
        const list = await demoListRecordings();
        if (cancelled) return;
        const map = new Map<string, QaidahRecording>();
        for (const r of list) {
          const url = URL.createObjectURL(r.blob);
          objectUrls.current.push(url);
          map.set(recordingKey(r.book, r.lesson), {
            book: r.book,
            lesson: r.lesson,
            url,
            mime_type: r.mime_type,
            duration_s: r.duration_s,
            teacher_name: null,
            created_at: r.created_at,
          });
        }
        setRecordings(map);
        return;
      }
      const res = await fetch("/api/qaidah-recordings");
      const data = await res.json().catch(() => ({}));
      if (cancelled || !res.ok) return;
      setMissingTable(data.missing_table === true);
      setRecordings(
        new Map(
          ((data.recordings ?? []) as QaidahRecording[]).map((r) => [recordingKey(r.book, r.lesson), r])
        )
      );
    };
    load()
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [mode]);

  useEffect(() => () => objectUrls.current.forEach((url) => URL.revokeObjectURL(url)), []);

  const put = useCallback((recording: QaidahRecording) => {
    setRecordings((prev) => new Map(prev).set(recordingKey(recording.book, recording.lesson), recording));
  }, []);
  const drop = useCallback((book: QaidahBookId, lesson: number) => {
    setRecordings((prev) => {
      const next = new Map(prev);
      next.delete(recordingKey(book, lesson));
      return next;
    });
  }, []);

  return { recordings, ready, missingTable, put, drop };
}

async function call<T>(method: string, body: unknown): Promise<T> {
  const res = await fetch("/api/qaidah-recordings", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "That recording didn't save. Please try again.");
  return data as T;
}

/**
 * Saves a recording as the lesson's: straight to the school's private
 * storage through a one-time link, then recorded against the lesson. In the
 * sample portal, in this browser. Throws with a message to show.
 */
export async function saveLessonRecording(
  demo: boolean,
  book: QaidahBookId,
  lesson: number,
  audio: { blob: Blob; type: string; duration: number | null }
): Promise<QaidahRecording> {
  const duration_s = audio.duration === null ? null : Math.round(audio.duration);
  if (demo) {
    const created_at = new Date().toISOString();
    await demoSaveRecording({ book, lesson, blob: audio.blob, mime_type: audio.type, duration_s, created_at });
    return {
      book,
      lesson,
      url: URL.createObjectURL(audio.blob),
      mime_type: audio.type,
      duration_s,
      teacher_name: null,
      created_at,
    };
  }
  const link = await call<{ path: string; token: string; type: string; bucket: string }>("POST", {
    book,
    lesson,
    type: audio.type,
    size: audio.blob.size,
  });
  // Storage files a recording under the type it's labelled with (the
  // contentType option counts only for raw bytes, not a file) and takes only
  // the kinds of audio the bucket lists; an iPhone labels its voice memos
  // audio/x-m4a. So it goes up labelled with the type checked above.
  const file = new Blob([audio.blob], { type: link.type });
  const { error } = await createClient()
    .storage.from(link.bucket)
    .uploadToSignedUrl(link.path, link.token, file, { contentType: link.type });
  if (error) throw new Error("The recording didn't finish uploading. Please try again.");
  const saved = await call<{ recording: QaidahRecording | null }>("PUT", {
    book,
    lesson,
    path: link.path,
    type: link.type,
    duration_s,
  });
  if (!saved.recording) throw new Error("The recording saved, but couldn't be opened. Reload the page.");
  return saved.recording;
}

export async function deleteLessonRecording(demo: boolean, book: QaidahBookId, lesson: number) {
  if (demo) {
    await demoDeleteRecording(book, lesson);
    return;
  }
  await call("DELETE", { book, lesson });
}
