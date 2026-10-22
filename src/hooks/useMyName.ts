"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { sessionUser } from "@/lib/supabase/sessionUser";

let remembered: { id: string; name: string } | null = null;

/** The signed-in person's own name, for the top of the page. Null until known, and for the sample portal. */
export function useMyName(): string | null {
  const [name, setName] = useState<string | null>(remembered?.name ?? null);
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const supabase = createClient();
        const user = await sessionUser(supabase);
        if (!user) return;
        if (remembered?.id === user.id) {
          if (live) setName(remembered.name);
          return;
        }
        const { data } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
        const full = (data?.full_name ?? "").trim();
        if (full) {
          remembered = { id: user.id, name: full };
          if (live) setName(full);
        }
      } catch {
        /* The role line stands in. */
      }
    })();
    return () => {
      live = false;
    };
  }, []);
  return name;
}
