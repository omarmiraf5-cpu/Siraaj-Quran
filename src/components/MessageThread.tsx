"use client";

// The bubble list shared by the parent and teacher messages pages. Each page
// owns its own composer — the parent's includes an absence form the
// teacher's does not — so only the read side lives here.

import { formatMessageTime, type MessageAuthor, type ThreadMessage } from "@/data/demo";
import { EmptyNote } from "@/components/portal-ui";

export function MessageThread({
  messages,
  viewerRole,
}: {
  messages: ThreadMessage[];
  /** Which side of the conversation this page belongs to, so that party's
      own messages align right like a familiar chat. */
  viewerRole: MessageAuthor;
}) {
  if (messages.length === 0) {
    return <EmptyNote>No messages yet — say salaam to start the conversation.</EmptyNote>;
  }

  return (
    <div className="space-y-3">
      {messages.map((m) => {
        const mine = m.author === viewerRole;
        if (m.kind === "absence") {
          return (
            <div key={m.id} className="flex justify-center">
              <div className="max-w-[85%] rounded-2xl border border-amber-300/60 bg-amber-50 dark:bg-amber-950/25 dark:border-amber-800/40 px-4 py-2.5 text-center">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                  Absence reported · {m.absence_date}
                </p>
                <p className="text-[13px] text-ink-body mt-1">{m.body}</p>
                <p className="text-[10px] text-ink-muted mt-1">
                  {m.author_name} · {formatMessageTime(m.created_at)}
                </p>
              </div>
            </div>
          );
        }
        return (
          <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] ${mine ? "items-end" : "items-start"} flex flex-col`}>
              <div
                className={`text-sm rounded-card px-3.5 py-2.5 leading-relaxed whitespace-pre-wrap ${
                  mine ? "bg-brand-navy text-white" : "bg-surface-bg text-ink-body"
                }`}
              >
                {m.body}
              </div>
              <p className="text-[10px] text-ink-muted mt-1 px-1">
                {m.author_name} · {formatMessageTime(m.created_at)}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
