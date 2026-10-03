// A teacher's recording of a Qa'idah lesson, read aloud for the school's
// children to play at home (qaidah_recordings in schema.sql): the whole
// lesson, or one of its tiles (a letter, a syllable, a word) on its own for a
// child to tap and hear. One of each per school; the audio file sits in the
// class-work bucket, under the school's own qaidah/ folder.

import type { QaidahBookId } from "@/data/qaidah";
import { isMissingTable } from "@/lib/qaidahLessons";

export interface QaidahRecording {
  book: QaidahBookId;
  lesson: number;
  /** The tile it reads, as the book prints it; "" for the whole lesson. */
  item: string;
  /** Where to play it from: recordingPlayLink below, or in the sample portal the file itself. */
  url: string;
  mime_type: string;
  duration_s: number | null;
  teacher_name: string | null;
  created_at: string;
}

/** The longest recording the recorder makes: a lesson read through, with room to spare. */
export const RECORDING_MAX_SECONDS = 15 * 60;
/** ...and of one tile: a letter takes a second, an ayah a few. */
export const TILE_MAX_SECONDS = 2 * 60;
/** The longest tile there is room to key a recording by. */
export const TILE_MAX_CHARS = 200;
/** The bucket's own limit on a file. */
export const RECORDING_MAX_BYTES = 25 * 1024 * 1024;

const EXTENSION: Record<string, string> = {
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mp4": "m4a",
  "audio/mpeg": "mp3",
  "audio/aac": "aac",
  "audio/wav": "wav",
};

/**
 * The kind of audio as storage knows it, from what the browser or the file
 * said: "audio/webm;codecs=opus" from a recorder is audio/webm, an iPhone's
 * .m4a is audio/mp4. Null for anything that isn't a recording.
 */
export function recordingType(declared: string | null | undefined, name = ""): string | null {
  const base = (declared ?? "").toLowerCase().split(";")[0].trim();
  const alias: Record<string, string> = {
    "audio/x-m4a": "audio/mp4",
    "audio/m4a": "audio/mp4",
    "audio/mp3": "audio/mpeg",
    "audio/x-wav": "audio/wav",
    "audio/wave": "audio/wav",
    "audio/opus": "audio/ogg",
  };
  const type = alias[base] ?? base;
  if (EXTENSION[type]) return type;
  const ext = name.toLowerCase().split(".").pop() ?? "";
  const byExtension = Object.entries(EXTENSION).find(([, e]) => e === ext)?.[0];
  return byExtension ?? (ext === "opus" ? "audio/ogg" : null);
}

export function recordingExtension(type: string): string {
  return EXTENSION[type] ?? "audio";
}

/** Where one school's recordings of one lesson go; the routes accept no other. */
export const recordingsFolder = (schoolId: string, book: QaidahBookId, lesson: number) =>
  `${schoolId}/qaidah/${book}/${lesson}/`;

/** A recording's place among the school's: the lesson, and the tile if it's one. */
export const recordingKey = (book: QaidahBookId, lesson: number, item = "") =>
  item ? `${book}:${lesson}:${item}` : `${book}:${lesson}`;

/**
 * Where the portals play a recording from: this site's own link, which sends
 * the player on to the file (api/qaidah-recordings/play). A link to the file
 * itself lapses after an hour, and a child's tablet left on the Qa'idah
 * overnight would have nothing to play; this one never does. It carries when
 * the recording was made, so recording a lesson again changes the link and
 * players fetch the new one.
 */
export const recordingPlayLink = (book: QaidahBookId, lesson: number, item: string, recordedAt: string) =>
  `/api/qaidah-recordings/play?book=${book}&lesson=${lesson}${
    item ? `&item=${encodeURIComponent(item)}` : ""
  }&v=${encodeURIComponent(recordedAt)}`;

/**
 * The school's database hasn't had the update recordings need: no table yet,
 * or no column for recording a lesson's tiles one by one.
 */
export function needsRecordingsUpdate(error: { code?: string } | null | undefined): boolean {
  return isMissingTable(error) || error?.code === "42703" || error?.code === "PGRST204";
}

/** "2:05" */
export function clock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
