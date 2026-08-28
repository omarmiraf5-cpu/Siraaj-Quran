"use client";

import { useEffect, useRef, useState } from "react";
import {
  DEMO_CHILDREN,
  DEMO_TEACHER_NAME,
  demoMessagesFor,
  type ThreadMessage,
} from "@/data/demo";
import { PortalHero } from "@/components/PortalHero";
import { SectionCard, SegmentedSwitch } from "@/components/portal-ui";
import { MessageThread } from "@/components/MessageThread";
import { readDemoStore, writeDemoStore } from "@/lib/demoStore";

// Shared with the teacher portal so a message sent here shows up there, and
// a reply shows up here, within the same browser.
const MESSAGES_KEY = "demo_messages_v1";

export default function ParentMessagesPage() {
  const [childId, setChildId] = useState(DEMO_CHILDREN[0].id);
  const child = DEMO_CHILDREN.find((c) => c.id === childId) ?? DEMO_CHILDREN[0];
  const firstName = child.name.split(" ")[0];

  const [local, setLocal] = useState<ThreadMessage[]>([]);
  const [text, setText] = useState("");
  const [showAbsence, setShowAbsence] = useState(false);
  const [absenceDate, setAbsenceDate] = useState("");
  const [absenceReason, setAbsenceReason] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLocal(readDemoStore(MESSAGES_KEY, []));
  }, []);

  const messages = demoMessagesFor(child.id, local);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const persist = (next: ThreadMessage[]) => {
    setLocal(next);
    writeDemoStore(MESSAGES_KEY, next);
  };

  const send = () => {
    const body = text.trim();
    if (!body) return;
    const msg: ThreadMessage = {
      id: `local-${Date.now()}`,
      student_id: child.id,
      author: "parent",
      author_name: `${firstName}'s parent`,
      kind: "message",
      body,
      created_at: new Date().toISOString(),
    };
    persist([...local, msg]);
    setText("");
  };

  const sendAbsence = () => {
    if (!absenceDate || !absenceReason.trim()) return;
    const msg: ThreadMessage = {
      id: `local-${Date.now()}`,
      student_id: child.id,
      author: "parent",
      author_name: `${firstName}'s parent`,
      kind: "absence",
      body: absenceReason.trim(),
      absence_date: absenceDate,
      created_at: new Date().toISOString(),
    };
    persist([...local, msg]);
    setAbsenceDate("");
    setAbsenceReason("");
    setShowAbsence(false);
  };

  return (
    <div className="max-w-2xl mx-auto pb-28 space-y-4 pt-2">
      <PortalHero
        eyebrow="Speak with the teacher"
        title="Messages"
        meta={[child.halaqa, DEMO_TEACHER_NAME, `${messages.length} messages`]}
      />

      {DEMO_CHILDREN.length > 1 && (
        <div className="flex items-center gap-3">
          <span className="eyebrow">About</span>
          <SegmentedSwitch
            label="Select child"
            value={childId}
            onChange={setChildId}
            options={DEMO_CHILDREN.map((c) => ({ value: c.id, label: c.name.split(" ")[0] }))}
          />
        </div>
      )}

      <SectionCard title="Conversation" note={DEMO_TEACHER_NAME}>
        <div className="max-h-[26rem] overflow-y-auto pr-1">
          <MessageThread messages={messages} viewerRole="parent" />
          <div ref={endRef} />
        </div>
      </SectionCard>

      {showAbsence ? (
        <SectionCard title="Report an absence" note={firstName}>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-ink mb-1.5">Date</label>
              <input
                type="date"
                value={absenceDate}
                onChange={(e) => setAbsenceDate(e.target.value)}
                className="w-full bg-surface-card border border-surface-border rounded-xl px-3 py-2.5 text-sm text-ink focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/40 transition"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink mb-1.5">Reason</label>
              <textarea
                value={absenceReason}
                onChange={(e) => setAbsenceReason(e.target.value)}
                rows={2}
                placeholder="e.g. Doctor's appointment"
                className="w-full bg-surface-card border border-surface-border rounded-xl px-3 py-2.5 text-sm text-ink focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/40 transition resize-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={sendAbsence}
                disabled={!absenceDate || !absenceReason.trim()}
                className="flex-1 gradient-emerald text-white text-sm font-semibold py-2.5 rounded-xl disabled:opacity-50 hover:opacity-90 active:scale-[.98] transition-all"
              >
                Notify teacher
              </button>
              <button
                type="button"
                onClick={() => setShowAbsence(false)}
                className="text-[13px] font-semibold text-ink-muted hover:text-ink px-3 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </SectionCard>
      ) : (
        <button
          type="button"
          onClick={() => setShowAbsence(true)}
          className="w-full flex items-center justify-center gap-2 border border-brand-gold/45 bg-brand-gold/12 text-[#6f5518] dark:text-brand-gold font-semibold py-3 rounded-2xl transition-all hover:bg-brand-gold/20 active:scale-[.98]"
        >
          Report an absence
        </button>
      )}

      {/* Composer */}
      <div className="fixed bottom-20 md:bottom-0 left-0 right-0 md:left-56 p-3 bg-surface-card border-t border-surface-border z-30">
        <div className="max-w-2xl mx-auto flex items-center gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") send();
            }}
            placeholder={`Message ${DEMO_TEACHER_NAME} about ${firstName}…`}
            className="flex-1 min-w-0 bg-surface-bg border border-surface-border rounded-pill px-4 py-2.5 text-sm text-ink focus:outline-none focus:border-brand-navy focus:ring-1 focus:ring-brand-navy transition"
          />
          <button
            onClick={send}
            disabled={!text.trim()}
            className="w-10 h-10 rounded-full gradient-emerald flex items-center justify-center text-white flex-shrink-0 disabled:opacity-40 hover:opacity-90 active:scale-95 transition-all"
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
  );
}
