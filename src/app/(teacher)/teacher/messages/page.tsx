"use client";

import { useEffect, useRef, useState } from "react";
import {
  DEMO_STUDENTS,
  DEMO_TEACHER_NAME,
  demoMessagesFor,
  initials,
  type ThreadMessage,
} from "@/data/demo";
import { PortalHero } from "@/components/PortalHero";
import { MessageThread } from "@/components/MessageThread";
import { readDemoStore, writeDemoStore } from "@/lib/demoStore";

// Shared with the parent portal so a reply sent here shows up there, and a
// parent's message shows up here, within the same browser.
const MESSAGES_KEY = "demo_messages_v1";

export default function TeacherMessagesPage() {
  const [selected, setSelected] = useState(DEMO_STUDENTS[0].id);
  const [local, setLocal] = useState<ThreadMessage[]>([]);
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLocal(readDemoStore(MESSAGES_KEY, []));
  }, []);

  const student = DEMO_STUDENTS.find((s) => s.id === selected) ?? DEMO_STUDENTS[0];
  const messages = demoMessagesFor(selected, local);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, selected]);

  const send = () => {
    const body = text.trim();
    if (!body) return;
    const msg: ThreadMessage = {
      id: `local-${Date.now()}`,
      student_id: selected,
      author: "teacher",
      author_name: DEMO_TEACHER_NAME,
      kind: "message",
      body,
      created_at: new Date().toISOString(),
    };
    const next = [...local, msg];
    setLocal(next);
    writeDemoStore(MESSAGES_KEY, next);
    setText("");
  };

  // Sorted by whoever has spoken most recently, so an active conversation
  // does not get buried under students nobody has messaged yet.
  const rows = DEMO_STUDENTS.map((s) => {
    const thread = demoMessagesFor(s.id, local);
    const last = thread[thread.length - 1];
    return { student: s, last };
  }).sort((a, b) => {
    const at = a.last ? Date.parse(a.last.created_at) : 0;
    const bt = b.last ? Date.parse(b.last.created_at) : 0;
    return bt - at;
  });

  return (
    <div className="max-w-5xl mx-auto pb-8 space-y-4 pt-2">
      <PortalHero
        eyebrow="Parent communication"
        title="Messages"
        meta={[`${DEMO_STUDENTS.length} students`, "concerns, questions & absences"]}
      />

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
                className={`w-full flex items-center gap-3 px-3 py-3 text-left transition-colors ${
                  active ? "bg-surface-bg-warm" : "hover:bg-surface-bg-warm"
                }`}
              >
                <span className="w-9 h-9 rounded-xl bg-brand-navy/10 text-brand-navy dark:text-brand-gold flex items-center justify-center font-bold text-[11px] flex-shrink-0">
                  {initials(s.name)}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-ink truncate">{s.name}</p>
                  <p className="text-[11px] text-ink-muted truncate">
                    {isAbsence
                      ? `Absence · ${last.absence_date}`
                      : last
                        ? last.body
                        : "No messages yet"}
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
        <div className="card-quiet flex flex-col h-[32rem]">
          <div className="px-5 py-4 border-b border-surface-border flex-shrink-0">
            <h2 className="page-title text-lg">{student.name}</h2>
            <p className="text-[11px] text-ink-muted">{student.halaqa}</p>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-4">
            <MessageThread messages={messages} viewerRole="teacher" />
            <div ref={endRef} />
          </div>
          <div className="flex-shrink-0 border-t border-surface-border p-3 flex items-center gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") send();
              }}
              placeholder={`Reply about ${student.name.split(" ")[0]}…`}
              className="flex-1 min-w-0 bg-surface-bg border border-surface-border rounded-pill px-4 py-2.5 text-sm text-ink focus:outline-none focus:border-brand-navy focus:ring-1 focus:ring-brand-navy transition"
            />
            <button
              onClick={send}
              disabled={!text.trim()}
              className="w-11 h-11 rounded-full gradient-emerald shadow-md flex items-center justify-center text-white flex-shrink-0 disabled:opacity-40 hover:opacity-90 active:scale-95 transition-all"
              aria-label="Send"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
