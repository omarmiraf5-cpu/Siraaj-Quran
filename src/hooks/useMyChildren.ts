"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { sessionUser } from "@/lib/supabase/sessionUser";

/**
 * Whether the signed-in teacher or admin is also a parent of a child at the
 * school (the office linked them on its Parents page), and their role — for
 * the switch between their own pages and parent mode.
 */
export function useMyChildren(): { hasChildren: boolean; role: string | null } {
  const [state, setState] = useState<{ hasChildren: boolean; role: string | null }>({ hasChildren: false, role: null });
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const user = await sessionUser(supabase);
      if (!user) return;
      const [{ data: me }, { data: links }] = await Promise.all([
        supabase.from("profiles").select("role").eq("id", user.id).maybeSingle(),
        supabase.from("parent_students").select("student_id").eq("parent_id", user.id).limit(1),
      ]);
      if (!cancelled) setState({ hasChildren: (links ?? []).length > 0, role: (me?.role as string | undefined) ?? null });
    })().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  return state;
}

/** The children linked to the signed-in person as their parent. */
export async function myChildIds(supabase: ReturnType<typeof createClient>): Promise<string[]> {
  const user = await sessionUser(supabase);
  if (!user) return [];
  const { data } = await supabase.from("parent_students").select("student_id").eq("parent_id", user.id);
  return (data ?? []).map((l) => l.student_id as string);
}
