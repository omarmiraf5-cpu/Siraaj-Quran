"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const KEY = "mydiiwaan_seen_at";
const EVERY_MS = 5 * 60 * 1000;

/** Records a visit for whoever is signed in here, at most every five minutes each. */
function record() {
  const supabase = createClient();
  supabase.auth
    .getSession()
    .then(async ({ data: { session } }) => {
      const id = session?.user?.id;
      if (!id) return;
      // Per person, so a parent and child sharing a tablet are each recorded.
      const key = `${KEY}:${id}`;
      try {
        if (Date.now() - Number(localStorage.getItem(key) || 0) < EVERY_MS) return;
      } catch {
        // No storage: record the visit anyway; the database throttles too.
      }
      const { error } = await supabase.rpc("touch_last_seen");
      if (error) return;
      try {
        localStorage.setItem(key, String(Date.now()));
      } catch {}
    })
    .catch(() => {});
}

/**
 * Tells the platform this person is using MyDiiwaan, for the "last active"
 * column on the platform owner's list of schools. A sign-in alone says
 * little — a session stays signed in for weeks — so the portals record a
 * visit as they open, as people move from page to page, and when the app
 * comes back to the front (a phone rarely restarts it), at most every five
 * minutes (the database keeps to five minutes as well). Nothing happens in
 * the sample portal, where nobody is signed in, and a failure is never shown.
 */
export function useRecordVisit() {
  const pathname = usePathname();
  useEffect(() => {
    record();
  }, [pathname]);
  useEffect(() => {
    const onShow = () => {
      if (document.visibilityState === "visible") record();
    };
    document.addEventListener("visibilitychange", onShow);
    return () => document.removeEventListener("visibilitychange", onShow);
  }, []);
}
