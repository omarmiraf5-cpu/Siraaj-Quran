"use client";

import { useEffect, useState } from "react";
import { DEMO_CREATED_STARS_KEY, allStars } from "@/data/awards";
import { readDemoStore } from "@/lib/demoStore";
import { createClient } from "@/lib/supabase/client";
import { sessionUser } from "@/lib/supabase/sessionUser";

/** How many stars a student's teachers have given them. */
export function useTeacherStars(studentId: string | null): number {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!studentId) return;
    let live = true;
    (async () => {
      try {
        const supabase = createClient();
        const user = await sessionUser(supabase);
        if (!user) {
          if (live) setCount(allStars(readDemoStore(DEMO_CREATED_STARS_KEY, [])).filter((s) => s.studentId === studentId).length);
          return;
        }
        const { count: n } = await supabase.from("student_stars").select("id", { count: "exact", head: true }).eq("student_id", studentId);
        if (live) setCount(n ?? 0);
      } catch {
        /* The count is a nicety; the page works without it. */
      }
    })();
    return () => {
      live = false;
    };
  }, [studentId]);
  return count;
}
