"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { PortalMode } from "@/hooks/usePortalRoster";
import { isMissingTable } from "@/lib/qaidahLessons";
import { QAIDAH_PAGE_COLUMNS, type QaidahPageAssignment } from "@/lib/qaidahPages";

/**
 * Qa'idah work set by pages, as the signed-in person may see it — a child
 * their own, a parent their children's, a teacher their school's (the
 * table's policies decide). Narrowed to some children when given their ids.
 * The sample school has none of its own: what a teacher sets there lives on
 * the page until it's left.
 */
export function useQaidahPages(mode: PortalMode, studentIds?: string[]) {
  const [rows, setRows] = useState<QaidahPageAssignment[]>([]);
  const [ready, setReady] = useState(false);
  // The school's database hasn't had the update that adds the table yet.
  const [missingTable, setMissingTable] = useState(false);
  const idsKey = studentIds ? studentIds.join(",") : null;

  useEffect(() => {
    if (mode === "loading") return;
    if (mode === "demo") {
      setRows([]);
      setReady(true);
      return;
    }
    const ids = idsKey === null ? null : idsKey ? idsKey.split(",") : [];
    if (ids && ids.length === 0) {
      setRows([]);
      setReady(true);
      return;
    }
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      let query = supabase.from("qaidah_page_assignments").select(QAIDAH_PAGE_COLUMNS).order("assigned_at", { ascending: false }).limit(2000);
      if (ids) query = query.in("student_id", ids);
      const { data, error } = await query;
      if (cancelled) return;
      if (error) {
        setMissingTable(isMissingTable(error));
        setRows([]);
      } else {
        setRows((data ?? []) as QaidahPageAssignment[]);
      }
    })()
      .catch(() => setRows([]))
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [mode, idsKey]);

  return { rows, setRows, ready, missingTable };
}
