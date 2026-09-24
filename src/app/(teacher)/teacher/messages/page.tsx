"use client";

import { useEffect, useRef, useState } from "react";
import {
  DEMO_STUDENTS,
  demoMessagesFor,
  formatDay,
  initials,
  type ThreadMessage,
} from "@/data/demo";
import { PortalHero } from "@/components/PortalHero";
import { MessageThread } from "@/components/MessageThread";
import { LoadingNote, EmptyNote } from "@/components/portal-ui";
import { readDemoStore, writeDemoStore } from "@/lib/demoStore";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/components/LanguageProvider";

// Shared with the parent portal so a reply sent here shows up there, and a
// parent's message shows up here, within the same browser (demo mode only).
const MESSAGES_KEY = "demo_messages_v1";

interface RosterStudent {
  id: string;
  name: string;
  halaqa: string;
}

export default function TeacherMessagesPage() {
  const supabase = createClient();
  const { t, language } = useLanguage();
  const [ready, setReady] = useState(false);
  const [isDemo, setIsDemo] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [teacherName, setTeacherName] = useState<string>("You");

  // Starts empty rather than seeded with the demo roster/threads — see the
  // dashboard and attendance pages for why: showing the sample class first
  // and swapping to the real one a moment later briefly puts one school's
  // conversations on screen inside another's session. Nothing renders below
  // until `ready`.
  const [students, setStudents] = useState<RosterStudent[]>([]);
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [local, setLocal] = useState<ThreadMessage[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setIsDemo(true);
        setStudents(DEMO_STUDENTS);
        setSelected(DEMO_STUDENTS[0].id);
        setLocal(readDemoStore(MESSAGES_KEY, []));
        return;
      }

      const [{ data: profile }, { data: studentRows }] = await Promise.all([
        supabase.from("profiles").select("school_id, full_name").eq("id", user.id).single(),
        supabase.from("students").select("id, full_name, grade").eq("active", true).order("full_name"),
      ]);

      setUserId(user.id);
      setSchoolId(profile?.school_id ?? null);
      setTeacherName(profile?.full_name ?? "You");

      const roster = (studentRows ?? []).map((s) => ({
        id: s.id,
        name: s.full_name,
        halaqa: `Grade ${s.grade}`,
      }));
      setStudents(roster);
      if (roster.length > 0) setSelected(roster[0].id);

      if (roster.length > 0) {
        const { data: rows } = await supabase
          .from("messages")
          .select("*")
          .in(
            "student_id",
            roster.map((s) => s.id)
          )
          .order("created_at");

        // author_name isn't stored on the row itself (just author_id), so
        // it's resolved from profiles in one batch lookup rather than a
        // per-message query.
        // A deleted account leaves its messages with no author; those show the
      // role instead, so there is no name to look up.
      const authorIds = [...new Set((rows ?? []).map((r) => r.author_id).filter(Boolean))];
        const { data: authorRows } =
          authorIds.length > 0
            ? await supabase.from("profiles").select("id, full_name").in("id", authorIds)
            : { data: [] as { id: string; full_name: string }[] };
        const nameById = new Map((authorRows ?? []).map((p) => [p.id, p.full_name]));

        setMessages(
          (rows ?? []).map((r) => ({
            id: r.id,
            student_id: r.student_id,
            author: r.author_role as ThreadMessage["author"],
            author_name:
              nameById.get(r.author_id) ?? t(r.author_role === "teacher" ? "role.teacher" : "role.parent"),
            kind: r.kind as ThreadMessage["kind"],
            body: r.body,
            absence_date: r.absence_date ?? undefined,
            created_at: r.created_at,
          }))
        );
      }
    };

    load().finally(() => setReady(true));
  }, []);

  const messagesFor = (studentId: string) =>
    isDemo ? demoMessagesFor(studentId, local) : messages.filter((m) => m.student_id === studentId);

  const student = students.find((s) => s.id === selected);
  const thread = selected ? messagesFor(selected) : [];

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread.length, selected]);

  const send = async () => {
    const body = text.trim();
    if (!body || !selected) return;

    if (isDemo) {
      const msg: ThreadMessage = {
        id: `local-${Date.now()}`,
        student_id: selected,
        author: "teacher",
        author_name: t("common.demoTeacherName"),
        kind: "message",
        body,
        created_at: new Date().toISOString(),
      };
      const next = [...local, msg];
      setLocal(next);
      writeDemoStore(MESSAGES_KEY, next);
      setText("");
      return;
    }

    if (!userId || !schoolId) return;
    setSending(true);
    const { data, error } = await supabase
      .from("messages")
      .insert({
        student_id: selected,
        school_id: schoolId,
        author_id: userId,
        author_role: "teacher",
        kind: "message",
        body,
      })
      .select()
      .single();
    setSending(false);
    if (error || !data) return;

    setMessages((m) => [
      ...m,
      {
        id: data.id,
        student_id: data.student_id,
        author: "teacher",
        author_name: teacherName,
        kind: "message",
        body: data.body,
        created_at: data.created_at,
      },
    ]);
    setText("");
  };

  // Sorted by whoever has spoken most recently, so an active conversation
  // does not get buried under students nobody has messaged yet.
  const rows = students
    .map((s) => {
      const t = messagesFor(s.id);
      const last = t[t.length - 1];
      return { student: s, last };
    })
    .sort((a, b) => {
      const at = a.last ? Date.parse(a.last.created_at) : 0;
      const bt = b.last ? Date.parse(b.last.created_at) : 0;
      return bt - at;
    });

  if (!ready) {
    return (
      <div className="max-w-7xl mx-auto pt-10">
        <LoadingNote>{t("teacher.messages.loadingMessages")}</LoadingNote>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto pb-8 space-y-4 pt-2">
      <PortalHero
        eyebrow={t("teacher.messages.eyebrow")}
        title={t("nav.messages")}
        meta={[`${students.length} ${t("common.students")}`, t("teacher.messages.subtitle")]}
      />

      {students.length === 0 ? (
        <div className="card-quiet p-8 text-center">
          <EmptyNote>{t("teacher.messages.noStudents")}</EmptyNote>
        </div>
      ) : (
        <div className="grid lg:grid-cols-[280px_1fr] gap-4 items-start">
          {/* Student list */}
          <div className="card-quiet divide-y divide-surface-border overflow-hidden lg:max-h-[34rem] lg:overflow-y-auto">
            {rows.map(({ student: s, last }) => {
              const active = s.id === selected;
              const isAbsence = last?.kind === "absence";
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSelected(s.id)}
                  className={`w-full flex items-center gap-3 px-3 py-3 text-start transition-colors ${
                    active ? "bg-surface-bg-warm" : "hover:bg-surface-bg-warm"
                  }`}
                >
                  <span className="w-9 h-9 rounded-xl bg-brand-navy/10 text-brand-navy dark:text-brand-gold flex items-center justify-center font-bold text-[11px] flex-shrink-0">
                    {initials(s.name)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-ink truncate">{s.name}</p>
                    <p className="text-[11px] text-ink-muted truncate" dir="auto">
                      {isAbsence
                        ? `${t("common.absence")} · ${formatDay(last.absence_date!, language)}`
                        : last
                          ? last.body
                          : t("common.noMessagesYet")}
                    </p>
                  </div>
                  {isAbsence && (
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Thread */}
          {student && (
            <div className="card-quiet flex flex-col h-[32rem]">
              <div className="px-5 py-4 border-b border-surface-border flex-shrink-0">
                <h2 className="page-title text-lg">{student.name}</h2>
                <p className="text-[11px] text-ink-muted">{student.halaqa}</p>
              </div>
              <div className="flex-1 overflow-y-auto px-5 py-4">
                <MessageThread messages={thread} viewerRole="teacher" />
                <div ref={endRef} />
              </div>
              <div className="flex-shrink-0 border-t border-surface-border p-3 flex items-center gap-2">
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") send();
                  }}
                  placeholder={`${t("common.replyAbout")} ${student.name.split(" ")[0]}…`}
                  dir="auto"
                  className="flex-1 min-w-0 bg-surface-bg border border-surface-border rounded-pill px-4 py-2.5 text-sm text-ink focus:outline-none focus:border-brand-navy focus:ring-1 focus:ring-brand-navy transition"
                />
                <button
                  onClick={send}
                  disabled={!text.trim() || sending}
                  className="w-11 h-11 rounded-full gradient-emerald shadow-md flex items-center justify-center text-white flex-shrink-0 disabled:opacity-40 hover:opacity-90 active:scale-95 transition-all"
                  aria-label={t("common.send")}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
