"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { readDemoStore } from "@/lib/demoStore";
import { useLanguage } from "@/components/LanguageProvider";
import { formatMessageTime } from "@/data/demo";

interface Note {
  id: string;
  body: string;
  created_at: string;
}

const MESSAGES_KEY = "demo_messages_v1";

/**
 * The notes a teacher has sent to this student, newest first, on the
 * student's home page. They are one-way: a child reads them here, and a
 * parent can read the same ones on their Messages page.
 */
export function TeacherNotes({ studentId, demo }: { studentId: string; demo: boolean }) {
  const { tr } = useLanguage();
  const [notes, setNotes] = useState<Note[]>([]);

  useEffect(() => {
    let live = true;
    const load = async () => {
      if (demo) {
        const local = readDemoStore<{ id: string; student_id: string; audience?: string; body: string; created_at: string }[]>(MESSAGES_KEY, []);
        if (live) setNotes(local.filter((m) => m.student_id === studentId && m.audience === "student").reverse().slice(0, 3));
        return;
      }
      const { data, error } = await createClient()
        .from("messages")
        .select("id, body, created_at")
        .eq("student_id", studentId)
        .eq("audience", "student")
        .order("created_at", { ascending: false })
        .limit(3);
      // Until the database update is run there is no such column; show nothing.
      if (live && !error) setNotes(data ?? []);
    };
    load().catch(() => {});
    return () => {
      live = false;
    };
  }, [studentId, demo]);

  if (notes.length === 0) return null;
  return (
    <section className="rounded-3xl bg-surface-card border border-surface-border shadow-card p-4 animate-rise" aria-label={tr("From your teacher")}>
      <h2 className="text-[11px] font-bold text-ink-muted uppercase tracking-[0.12em] mb-3">{tr("From your teacher")}</h2>
      <div className="space-y-2.5">
        {notes.map((n) => (
          <div key={n.id} className="rounded-2xl bg-surface-bg px-4 py-3">
            <p className="text-sm text-ink leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere]" dir="auto">{n.body}</p>
            <p className="text-[10px] text-ink-muted mt-1.5">{formatMessageTime(n.created_at)}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
