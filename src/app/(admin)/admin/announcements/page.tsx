"use client";

import { useEffect, useState } from "react";
import {
  DEMO_CREATED_ANNOUNCEMENTS_KEY,
  DEMO_REMOVED_ANNOUNCEMENTS_KEY,
  ANNOUNCEMENT_AUDIENCE_LABELS,
  allAnnouncements,
  type AnnouncementAudience,
  type DemoAnnouncement,
} from "@/data/demo";
import { PortalHero } from "@/components/PortalHero";
import { SectionCard, EmptyNote } from "@/components/portal-ui";
import { readDemoStore, writeDemoStore } from "@/lib/demoStore";
import { createClient } from "@/lib/supabase/client";

const AUDIENCES: AnnouncementAudience[] = ["all", "parents", "teachers", "students"];

export default function AdminAnnouncementsPage() {
  const supabase = createClient();
  const [isDemo, setIsDemo] = useState(false);
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const [items, setItems] = useState<DemoAnnouncement[]>([]);
  const [created, setCreated] = useState<DemoAnnouncement[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<AnnouncementAudience>("all");
  const [pinned, setPinned] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadReal = async () => {
    const { data } = await supabase
      .from("announcements")
      .select("id, title, body, audience, pinned, created_at, profiles(full_name)")
      .order("pinned", { ascending: false })
      .order("created_at", { ascending: false });
    setItems(
      (data ?? []).map((a) => ({
        id: a.id,
        title: a.title,
        body: a.body,
        audience: a.audience as AnnouncementAudience,
        authorName:
          (a as unknown as { profiles: { full_name: string } | null }).profiles?.full_name ??
          "School office",
        pinned: a.pinned,
        createdAt: (a.created_at ?? "").slice(0, 10),
      }))
    );
  };

  useEffect(() => {
    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setIsDemo(true);
        const c = readDemoStore<DemoAnnouncement[]>(DEMO_CREATED_ANNOUNCEMENTS_KEY, []);
        const r = readDemoStore<string[]>(DEMO_REMOVED_ANNOUNCEMENTS_KEY, []);
        setCreated(c);
        setRemoved(r);
        setItems(allAnnouncements(c, r));
        return;
      }

      setUserId(user.id);
      const { data: profile } = await supabase
        .from("profiles")
        .select("school_id")
        .eq("id", user.id)
        .single();
      setSchoolId(profile?.school_id ?? null);
      await loadReal();
    };
    load();
  }, []);

  const post = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;
    setFormError(null);

    if (isDemo) {
      const item: DemoAnnouncement = {
        id: `local-announcement-${Date.now()}`,
        title: title.trim(),
        body: body.trim(),
        audience,
        authorName: "School office",
        pinned,
        createdAt: new Date().toISOString().slice(0, 10),
      };
      const next = [...created, item];
      setCreated(next);
      writeDemoStore(DEMO_CREATED_ANNOUNCEMENTS_KEY, next);
      setItems(allAnnouncements(next, removed));
      resetForm();
      return;
    }

    setSaving(true);
    const { error } = await supabase.from("announcements").insert({
      title: title.trim(),
      body: body.trim(),
      audience,
      pinned,
      author_id: userId,
      school_id: schoolId,
    });
    setSaving(false);
    if (error) {
      setFormError(error.message);
      return;
    }
    await loadReal();
    resetForm();
  };

  const resetForm = () => {
    setTitle("");
    setBody("");
    setAudience("all");
    setPinned(false);
    setShowForm(false);
  };

  const togglePin = async (a: DemoAnnouncement) => {
    if (isDemo) {
      // Seed notices aren't stored anywhere writable, so pinning one keeps
      // it as a created copy and hides the original.
      const nextCreated = created.some((c) => c.id === a.id)
        ? created.map((c) => (c.id === a.id ? { ...c, pinned: !c.pinned } : c))
        : [...created, { ...a, id: `local-announcement-${Date.now()}`, pinned: !a.pinned }];
      const nextRemoved = created.some((c) => c.id === a.id) ? removed : [...removed, a.id];
      setCreated(nextCreated);
      setRemoved(nextRemoved);
      writeDemoStore(DEMO_CREATED_ANNOUNCEMENTS_KEY, nextCreated);
      writeDemoStore(DEMO_REMOVED_ANNOUNCEMENTS_KEY, nextRemoved);
      setItems(allAnnouncements(nextCreated, nextRemoved));
      return;
    }

    await supabase.from("announcements").update({ pinned: !a.pinned }).eq("id", a.id);
    await loadReal();
  };

  const remove = async (a: DemoAnnouncement) => {
    if (isDemo) {
      const nextCreated = created.filter((c) => c.id !== a.id);
      const nextRemoved = [...removed, a.id];
      setCreated(nextCreated);
      setRemoved(nextRemoved);
      writeDemoStore(DEMO_CREATED_ANNOUNCEMENTS_KEY, nextCreated);
      writeDemoStore(DEMO_REMOVED_ANNOUNCEMENTS_KEY, nextRemoved);
      setItems(allAnnouncements(nextCreated, nextRemoved));
      return;
    }

    await supabase.from("announcements").delete().eq("id", a.id);
    await loadReal();
  };

  const pinnedCount = items.filter((a) => a.pinned).length;

  return (
    <div className="max-w-3xl mx-auto pb-20 space-y-4 pt-2">
      <PortalHero
        eyebrow="Communication"
        title="Announcements"
        meta={[`${items.length} posted`, pinnedCount ? `${pinnedCount} pinned` : "none pinned"]}
        actions={
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="px-4 py-2 rounded-full bg-white/15 hover:bg-white/25 text-white text-sm font-semibold transition-all active:scale-95"
          >
            {showForm ? "Cancel" : "+ New announcement"}
          </button>
        }
      />

      {showForm && (
        <form onSubmit={post} className="card-quiet p-5 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-ink mb-2">Title *</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. No classes this Saturday"
              className="w-full bg-surface-card border border-surface-border rounded-2xl px-4 py-3 text-ink focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/40 transition"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-ink mb-2">Message *</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              placeholder="Write the announcement…"
              className="w-full bg-surface-card border border-surface-border rounded-2xl px-4 py-3 text-ink focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/40 transition resize-y"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-ink mb-2">Send to</label>
            <div className="flex flex-wrap gap-2">
              {AUDIENCES.map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setAudience(a)}
                  className={`px-3.5 py-2 rounded-full text-sm font-semibold transition-all ${
                    audience === a
                      ? "gradient-emerald text-white"
                      : "bg-surface-card border border-surface-border text-ink-muted hover:text-ink"
                  }`}
                >
                  {ANNOUNCEMENT_AUDIENCE_LABELS[a]}
                </button>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={pinned}
              onChange={(e) => setPinned(e.target.checked)}
              className="w-4 h-4 rounded"
            />
            Pin to the top of everyone&apos;s dashboard
          </label>
          {formError && <p className="text-sm text-status-error-text">{formError}</p>}
          <button
            type="submit"
            disabled={!title.trim() || !body.trim() || saving}
            className="w-full gradient-emerald text-white font-semibold py-3 rounded-2xl disabled:opacity-40 hover:opacity-90 active:scale-95 transition-all"
          >
            {saving ? "Posting…" : "Post announcement"}
          </button>
        </form>
      )}

      <SectionCard title="Posted" note={`${items.length} total`}>
        {items.length === 0 ? (
          <EmptyNote>No announcements yet.</EmptyNote>
        ) : (
          <ul className="divide-y divide-surface-border -my-1">
            {items.map((a) => (
              <li key={a.id} className="py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {a.pinned && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-brand-navy/10 text-brand-navy dark:text-brand-gold">
                          Pinned
                        </span>
                      )}
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800/40 text-slate-600 dark:text-slate-300">
                        {ANNOUNCEMENT_AUDIENCE_LABELS[a.audience]}
                      </span>
                      <p className="text-[13px] font-semibold text-ink">{a.title}</p>
                    </div>
                    <p className="text-[13px] text-ink mt-1">{a.body}</p>
                    <p className="text-[11px] text-ink-muted mt-0.5">
                      {a.authorName} · {a.createdAt}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-2">
                  <button
                    type="button"
                    onClick={() => togglePin(a)}
                    className="text-[12px] font-semibold text-ink-muted hover:text-ink transition-colors"
                  >
                    {a.pinned ? "Unpin" : "Pin"}
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(a)}
                    className="text-[12px] font-semibold text-ink-muted hover:text-status-error-text transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
