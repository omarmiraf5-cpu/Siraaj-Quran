"use client";

import { useEffect, useRef, useState } from "react";
import { demoMessagesFor, type ThreadMessage } from "@/data/demo";
import { usePortalRoster } from "@/hooks/usePortalRoster";
import { PortalHero } from "@/components/PortalHero";
import { SectionCard, SegmentedSwitch, EmptyNote, LoadingNote } from "@/components/portal-ui";
import { MessageThread } from "@/components/MessageThread";
import { readDemoStore, writeDemoStore } from "@/lib/demoStore";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/components/LanguageProvider";

// Shared with the teacher portal so a message sent here shows up there, and
// a reply shows up here, within the same browser (demo mode only).
const MESSAGES_KEY = "demo_messages_v1";

export default function ParentMessagesPage() {
  const supabase = createClient();
  const { t } = useLanguage();
  // RLS narrows this to the signed-in parent's own children; in demo mode
  // it's the two sample ones.
  const { mode, students: children } = usePortalRoster();
  const [childId, setChildId] = useState<string | null>(null);
  const child = children.find((c) => c.id === childId) ?? children[0] ?? null;

  useEffect(() => {
    if (!childId && children.length > 0) setChildId(children[0].id);
  }, [children, childId]);

  const [ready, setReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [parentName, setParentName] = useState<string>("You");
  const [local, setLocal] = useState<ThreadMessage[]>([]);
  const [realMessages, setRealMessages] = useState<ThreadMessage[]>([]);
  const [text, setText] = useState("");
  const [showAbsence, setShowAbsence] = useState(false);
  const [absenceDate, setAbsenceDate] = useState("");
  const [absenceReason, setAbsenceReason] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (mode === "loading") return;

    if (mode === "demo") {
      setLocal(readDemoStore(MESSAGES_KEY, []));
      setReady(true);
      return;
    }

    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || children.length === 0) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("school_id, full_name")
        .eq("id", user.id)
        .single();
      setUserId(user.id);
      setSchoolId(profile?.school_id ?? null);
      setParentName(profile?.full_name ?? "You");

      const { data: rows } = await supabase
        .from("messages")
        .select("*")
        .in(
          "student_id",
          children.map((c) => c.id)
        )
        .order("created_at");

      const authorIds = [...new Set((rows ?? []).map((r) => r.author_id))];
      const { data: authorRows } =
        authorIds.length > 0
          ? await supabase.from("profiles").select("id, full_name").in("id", authorIds)
          : { data: [] as { id: string; full_name: string }[] };
      const nameById = new Map((authorRows ?? []).map((p) => [p.id, p.full_name]));

      setRealMessages(
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
    };

    load().finally(() => setReady(true));
    // Re-runs once `children` arrives from the roster — it starts empty
    // while that request is in flight.
  }, [mode, children.length]);

  const messages = child
    ? mode === "demo"
      ? demoMessagesFor(child.id, local)
      : realMessages.filter((m) => m.student_id === child.id)
    : [];

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // The demo school's one sample teacher — wrong for every real one. A real
  // thread can have more than one teacher (any teacher at the school can
  // answer), so this names whoever last replied rather than assuming a
  // single fixed contact.
  const teacherLabel =
    mode === "demo"
      ? t("common.demoTeacherName")
      : [...messages].reverse().find((m) => m.author === "teacher")?.author_name ??
        t("parent.messages.yourChildsTeacher");

  if (mode === "loading" || !child) {
    return (
      <div className="max-w-2xl mx-auto space-y-4 pt-2">
        <PortalHero eyebrow={t("parent.messages.eyebrow")} title={t("nav.messages")} />
        <SectionCard title={t("common.yourChildren")}>
          {mode === "loading" ? (
            <LoadingNote />
          ) : (
            <EmptyNote>{t("common.noChildrenLinked")}</EmptyNote>
          )}
        </SectionCard>
      </div>
    );
  }

  const firstName = child.name.split(" ")[0];

  const persist = (next: ThreadMessage[]) => {
    setLocal(next);
    writeDemoStore(MESSAGES_KEY, next);
  };

  const send = async () => {
    const body = text.trim();
    if (!body) return;

    if (mode === "demo") {
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
      return;
    }

    if (!userId || !schoolId) return;
    const { data, error } = await supabase
      .from("messages")
      .insert({
        student_id: child.id,
        school_id: schoolId,
        author_id: userId,
        author_role: "parent",
        kind: "message",
        body,
      })
      .select()
      .single();
    if (error || !data) return;
    setRealMessages((m) => [
      ...m,
      {
        id: data.id,
        student_id: data.student_id,
        author: "parent",
        author_name: parentName,
        kind: "message",
        body: data.body,
        created_at: data.created_at,
      },
    ]);
    setText("");
  };

  const sendAbsence = async () => {
    if (!absenceDate || !absenceReason.trim()) return;

    if (mode === "demo") {
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
      return;
    }

    if (!userId || !schoolId) return;
    const { data, error } = await supabase
      .from("messages")
      .insert({
        student_id: child.id,
        school_id: schoolId,
        author_id: userId,
        author_role: "parent",
        kind: "absence",
        body: absenceReason.trim(),
        absence_date: absenceDate,
      })
      .select()
      .single();
    if (error || !data) return;
    setRealMessages((m) => [
      ...m,
      {
        id: data.id,
        student_id: data.student_id,
        author: "parent",
        author_name: parentName,
        kind: "absence",
        body: data.body,
        absence_date: data.absence_date,
        created_at: data.created_at,
      },
    ]);
    setAbsenceDate("");
    setAbsenceReason("");
    setShowAbsence(false);
  };

  return (
    <div className="max-w-2xl mx-auto pb-28 space-y-4 pt-2">
      <PortalHero
        eyebrow={t("parent.messages.eyebrow")}
        title={t("nav.messages")}
        meta={[child.halaqa, teacherLabel, `${messages.length} ${t("common.messagesCount")}`]}
      />

      {children.length > 1 && (
        <div className="flex items-center gap-3">
          <span className="eyebrow">{t("common.about")}</span>
          <SegmentedSwitch
            label={t("common.selectChild")}
            value={child.id}
            onChange={setChildId}
            options={children.map((c) => ({ value: c.id, label: c.name.split(" ")[0] }))}
          />
        </div>
      )}

      <SectionCard title={t("common.conversation")} note={teacherLabel}>
        {!ready ? (
          <LoadingNote />
        ) : (
          <div className="max-h-[26rem] overflow-y-auto pe-1">
            <MessageThread messages={messages} viewerRole="parent" />
            <div ref={endRef} />
          </div>
        )}
      </SectionCard>

      {showAbsence ? (
        <SectionCard title={t("common.reportAbsence")} note={firstName}>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-ink mb-1.5">{t("common.date")}</label>
              <input
                type="date"
                value={absenceDate}
                onChange={(e) => setAbsenceDate(e.target.value)}
                className="w-full bg-surface-card border border-surface-border rounded-xl px-3 py-2.5 text-sm text-ink focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/40 transition"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink mb-1.5">{t("common.reason")}</label>
              <textarea
                value={absenceReason}
                onChange={(e) => setAbsenceReason(e.target.value)}
                rows={2}
                placeholder={t("parent.messages.absenceReasonPlaceholder")}
                dir="auto"
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
                {t("parent.messages.notifyTeacher")}
              </button>
              <button
                type="button"
                onClick={() => setShowAbsence(false)}
                className="text-[13px] font-semibold text-ink-muted hover:text-ink px-3 transition-colors"
              >
                {t("common.cancel")}
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
          {t("common.reportAbsence")}
        </button>
      )}

      <div className="fixed bottom-20 md:bottom-0 start-0 end-0 md:start-56 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] bg-surface-card border-t border-surface-border z-30">
        <div className="max-w-2xl mx-auto flex items-center gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") send();
            }}
            placeholder={`${t("common.messagePrefix")} ${teacherLabel} ${t("common.about").toLowerCase()} ${firstName}…`}
            dir="auto"
            className="flex-1 min-w-0 bg-surface-bg border border-surface-border rounded-pill px-4 py-2.5 text-sm text-ink focus:outline-none focus:border-brand-navy focus:ring-1 focus:ring-brand-navy transition"
          />
          <button
            onClick={send}
            disabled={!text.trim()}
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
    </div>
  );
}
