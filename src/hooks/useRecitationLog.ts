"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { DEMO_RECITATION_LOG, type RecitationLogEntry } from "@/data/demo";
import { readDemoStore } from "@/lib/demoStore";

const LOG_KEY = "demo_recitation_log_v1";

/** One child's graded sessions: the sample log (plus what a teacher added in this browser) in demo mode, otherwise their own rows. */
export function useRecitationLog(studentId: string | null, mode: "loading" | "demo" | "real"): RecitationLogEntry[] {
  const [entries, setEntries] = useState<RecitationLogEntry[]>([]);
  useEffect(() => {
    if (!studentId || mode === "loading") return;
    if (mode === "demo") {
      const extra = readDemoStore<RecitationLogEntry[]>(LOG_KEY, []);
      setEntries([...DEMO_RECITATION_LOG, ...extra].filter((e) => e.student_id === studentId).sort((a, b) => Date.parse(a.date) - Date.parse(b.date)));
      return;
    }
    let cancelled = false;
    createClient()
      .from("recitation_log")
      .select("id, student_id, portion, surah, ayah_start, surah_end, ayah_end, rating, notes, session_date")
      .eq("student_id", studentId)
      .order("session_date")
      .then(({ data }) => {
        if (cancelled) return;
        setEntries(
          (data ?? []).map((r) => ({
            id: r.id,
            student_id: r.student_id,
            portion: r.portion,
            surah: r.surah,
            ayah_start: r.ayah_start,
            surah_end: r.surah_end,
            ayah_end: r.ayah_end,
            rating: r.rating,
            notes: r.notes,
            date: r.session_date,
          }))
        );
      });
    return () => {
      cancelled = true;
    };
  }, [studentId, mode]);
  return entries;
}
