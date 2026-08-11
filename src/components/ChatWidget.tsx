"use client";

import { useEffect, useRef, useState } from "react";

type Role = "parent" | "teacher" | "student" | "admin";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const ROLE_GREETING: Record<Role, string> = {
  parent: "Hi! I'm your MyDiiwaan Assistant. Ask me about your child's grades, attendance, fees, or how to use the portal.",
  teacher: "Hi! I'm your MyDiiwaan Assistant. Ask me about lesson planning, the Alberta curriculum, grading, or the portal.",
  student: "Hi! I'm your MyDiiwaan Assistant. Ask me for help with homework, a lesson topic, or anything you're stuck on!",
  admin: "Hi! I'm your MyDiiwaan Assistant. Ask me about staff, students, fees, or how to use the portal.",
};

function ChatIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
    </svg>
  );
}

export function ChatWidget({ role }: { role: Role }) {
  const [open, setOpen]         = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open, loading]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setError(null);
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: next, role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      setMessages((m) => [...m, { role: "assistant", content: data.reply }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Floating toggle button */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-28 right-4 md:right-6 z-50 w-14 h-14 rounded-full gradient-navy shadow-dark flex items-center justify-center text-white hover:scale-105 active:scale-95 transition-all ring-2 ring-brand-gold/40"
        aria-label={open ? "Close assistant" : "Open assistant"}
      >
        {open ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        ) : (
          <ChatIcon />
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-44 md:bottom-28 right-4 md:right-6 z-50 w-[calc(100vw-2rem)] max-w-sm h-[28rem] max-h-[70vh] bg-surface-card border border-surface-border rounded-card-lg shadow-dark flex flex-col overflow-hidden">
          {/* Header */}
          <div className="gradient-navy px-4 py-3 flex items-center gap-2.5 flex-shrink-0">
            <div className="w-7 h-7 rounded-full bg-white/15 flex items-center justify-center text-brand-gold flex-shrink-0">
              <ChatIcon />
            </div>
            <p className="text-white text-sm font-semibold">MyDiiwaan Assistant</p>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            <div className="flex justify-start">
              <div className="bg-surface-bg text-ink-body text-sm rounded-card px-3.5 py-2.5 max-w-[85%] leading-relaxed">
                {ROLE_GREETING[role]}
              </div>
            </div>

            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`text-sm rounded-card px-3.5 py-2.5 max-w-[85%] leading-relaxed whitespace-pre-wrap ${
                    m.role === "user" ? "bg-brand-navy text-white" : "bg-surface-bg text-ink-body"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-surface-bg rounded-card px-3.5 py-3 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-ink-muted animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-ink-muted animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-ink-muted animate-bounce" />
                </div>
              </div>
            )}

            {error && (
              <div className="text-status-error-text bg-status-error-bg rounded-card px-3.5 py-2.5 text-xs">
                {error}
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Input */}
          <div className="flex-shrink-0 border-t border-surface-border p-3 flex items-center gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") send(); }}
              placeholder="Ask a question…"
              className="flex-1 min-w-0 bg-surface-bg border border-surface-border rounded-pill px-4 py-2.5 text-sm text-ink focus:outline-none focus:border-brand-navy focus:ring-1 focus:ring-brand-navy transition"
            />
            <button
              onClick={send}
              disabled={loading || !input.trim()}
              className="w-10 h-10 rounded-full gradient-emerald flex items-center justify-center text-white flex-shrink-0 disabled:opacity-40 hover:opacity-90 active:scale-95 transition-all"
              aria-label="Send"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
