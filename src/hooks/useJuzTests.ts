"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { sessionUser } from "@/lib/supabase/sessionUser";
import { demoJuzFetch, type DemoJuzRole } from "@/lib/demoJuzTests";
import { readCache, writeCache } from "@/lib/pageCache";

export type JuzApi = (input: string, init?: RequestInit) => Promise<Response>;

/**
 * The live Juz test routes for a signed-in school, or demoJuzTests.ts
 * answering the same routes in the sample portal.
 */
export function useJuzApi(role: DemoJuzRole): { mode: "loading" | "demo" | "real"; api: JuzApi } {
  const [mode, setMode] = useState<"loading" | "demo" | "real">("loading");
  useEffect(() => {
    try {
      if (localStorage.getItem("demo_user") && !document.cookie.includes("auth-token")) {
        setMode("demo");
        return;
      }
    } catch { /* private mode — fall through to the session check */ }
    sessionUser(createClient())
      .then((user) => setMode(user ? "real" : "demo"))
      .catch(() => setMode("demo"));
  }, []);
  const api = useCallback<JuzApi>(
    (input, init) => (mode === "demo" ? demoJuzFetch(role)(input, init) : fetch(input, init)),
    [mode, role]
  );
  return { mode, api };
}

/** JSON in and out, with the server's own message on a refusal. */
export async function callJuz<T>(api: JuzApi, url: string, method = "GET", body?: unknown): Promise<T> {
  const res = await api(url, body === undefined ? { method } : { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || "Something went wrong"), { data, status: res.status });
  return data as T;
}

/**
 * Whether the school runs Juz tests and whether the signed-in person
 * examines: what the menus need. Remembered between pages, so the menu
 * doesn't jump as each one opens.
 */
export function useJuzAccess(role: DemoJuzRole): { enabled: boolean; examiner: boolean } {
  const { mode, api } = useJuzApi(role);
  const key = `juz-access:${role}`;
  const [state, setState] = useState(() => readCache<{ enabled: boolean; examiner: boolean }>(key) ?? { enabled: false, examiner: false });
  useEffect(() => {
    if (mode === "loading") return;
    let cancelled = false;
    callJuz<{ enabled: boolean; examiner: boolean }>(api, "/api/juz-tests?brief=1")
      .then((r) => {
        if (cancelled) return;
        const next = { enabled: r.enabled === true, examiner: r.enabled === true && r.examiner === true };
        setState(next);
        writeCache(key, next);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [mode, api, key]);
  return state;
}
