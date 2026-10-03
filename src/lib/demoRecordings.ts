// The sample portal's lesson recordings, kept in this browser so a recording
// made on the teacher's Qa'idah page plays on the child's, opened in the same
// browser. In IndexedDB, which holds audio comfortably where localStorage
// can't; only in memory, for this visit, where IndexedDB isn't available.

import type { QaidahBookId } from "@/data/qaidah";
import { recordingKey } from "@/lib/qaidahRecordings";

export interface DemoRecording {
  book: QaidahBookId;
  lesson: number;
  blob: Blob;
  mime_type: string;
  duration_s: number | null;
  created_at: string;
}

const DB_NAME = "mydiiwaan-sample";
const STORE = "qaidah-recordings";
const memory = new Map<string, DemoRecording>();

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      if (typeof indexedDB === "undefined") return resolve(null);
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T | undefined> {
  const db = await openDb();
  if (!db) return undefined;
  return new Promise((resolve) => {
    try {
      const request = work(db.transaction(STORE, mode).objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(undefined);
    } catch {
      resolve(undefined);
    }
  });
}

export async function demoListRecordings(): Promise<DemoRecording[]> {
  const stored = await withStore<DemoRecording[]>("readonly", (s) => s.getAll() as IDBRequest<DemoRecording[]>);
  return stored ?? [...memory.values()];
}

export async function demoSaveRecording(recording: DemoRecording): Promise<void> {
  const key = recordingKey(recording.book, recording.lesson);
  memory.set(key, recording);
  await withStore("readwrite", (s) => s.put(recording, key));
}

export async function demoDeleteRecording(book: QaidahBookId, lesson: number): Promise<void> {
  const key = recordingKey(book, lesson);
  memory.delete(key);
  await withStore("readwrite", (s) => s.delete(key));
}
