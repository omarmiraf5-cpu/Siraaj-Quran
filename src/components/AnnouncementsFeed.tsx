"use client";

import { useEffect, useState } from "react";
import {
  DEMO_CREATED_ANNOUNCEMENTS_KEY,
  DEMO_REMOVED_ANNOUNCEMENTS_KEY,
  allAnnouncements,
  announcementsFor,
  type AnnouncementAudience,
  type DemoAnnouncement,
} from "@/data/demo";
import { SectionCard, EmptyNote, LoadingNote } from "@/components/portal-ui";
import { readDemoStore } from "@/lib/demoStore";
import { createClient } from "@/lib/supabase/client";

// The same notice board seen from a teacher's, parent's or student's
// dashboard — each only gets what's addressed to everyone plus what's aimed
// at them. Admins compose these from their own Announcements page.
export function AnnouncementsFeed({
  audience,
  limit = 3,
}: {
  audience: Exclude<AnnouncementAudience, "all">;
  limit?: number;
}) {
  const [items, setItems] = useState<DemoAnnouncement[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        const created = readDemoStore<DemoAnnouncement[]>(DEMO_CREATED_ANNOUNCEMENTS_KEY, []);
        const removed = readDemoStore<string[]>(DEMO_REMOVED_ANNOUNCEMENTS_KEY, []);
        setItems(announcementsFor(audience, allAnnouncements(created, removed)));
        return;
      }

      // RLS keeps this to the reader's own school; the audience filter is
      // what narrows it to notices meant for this role.
      const { data } = await supabase
        .from("announcements")
        .select("id, title, body, audience, pinned, created_at, profiles(full_name)")
        .in("audience", ["all", audience])
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

    load().finally(() => setReady(true));
  }, [audience]);

  const shown = items.slice(0, limit);

  return (
    <SectionCard title="Announcements" note={items.length ? `${items.length} posted` : undefined}>
      {!ready ? (
        <LoadingNote />
      ) : shown.length === 0 ? (
        <EmptyNote>Nothing from the office right now.</EmptyNote>
      ) : (
        <ul className="divide-y divide-surface-border -my-1">
          {shown.map((a) => (
            <li key={a.id} className="py-2.5">
              <div className="flex items-center gap-2">
                {a.pinned && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-brand-navy/10 text-brand-navy dark:text-brand-gold flex-shrink-0">
                    Pinned
                  </span>
                )}
                <p className="text-[13px] font-semibold text-ink truncate">{a.title}</p>
              </div>
              <p className="text-[13px] text-ink mt-1">{a.body}</p>
              <p className="text-[11px] text-ink-muted mt-0.5">
                {a.authorName} · {a.createdAt}
              </p>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
