"use client";

import { createClient } from "@/lib/supabase/client";

/*
 * What each page last loaded, kept in memory while the app is open, so
 * going back to a page shows it at once and quietly refreshes it — rather
 * than a loading screen every time. Only in memory: closing the tab or
 * reloading forgets it all, and so does signing in or out, so one
 * person's data never shows for another.
 */

const store = new Map<string, unknown>();
let watching = false;

function watch() {
  if (watching || typeof window === "undefined") return;
  watching = true;
  createClient().auth.onAuthStateChange((event) => {
    if (event === "SIGNED_IN" || event === "SIGNED_OUT") store.clear();
  });
}

// The sample school's roles share one browser without signing in or out,
// so its entries are kept apart by which sample login is in use.
function scoped(key: string): string {
  let who = "";
  try {
    who = localStorage.getItem("demo_user") ?? "";
  } catch {}
  return `${who}|${key}`;
}

/** What `key` last loaded, if anything. */
export function readCache<T>(key: string): T | undefined {
  if (typeof window === "undefined") return undefined;
  watch();
  return store.get(scoped(key)) as T | undefined;
}

/** Keeps what `key` just loaded, for the next visit. */
export function writeCache<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  watch();
  store.set(scoped(key), value);
}

/** Forgets one page's copy — after a change that page should re-read. */
export function dropCache(key: string): void {
  store.delete(scoped(key));
}

/** Updates part of what `key` holds, keeping the rest. */
export function patchCache<T extends object>(key: string, part: Partial<T>): void {
  writeCache<Partial<T>>(key, { ...(readCache<Partial<T>>(key) ?? {}), ...part });
}
