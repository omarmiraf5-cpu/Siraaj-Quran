"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { QaidahBookId } from "@/data/qaidah";
import type { PortalMode } from "@/hooks/usePortalRoster";
import { demoQaidahRows, demoRemoveLesson, demoSetLesson, demoUpdateLesson } from "@/lib/demoQaidah";
import {
  QAIDAH_COLUMNS,
  isMissingTable,
  type QaidahAssignment,
  type QaidahStatus,
} from "@/lib/qaidahLessons";

/**
 * Qa'idah lessons as the signed-in person may see them — a child their own,
 * a parent their children's, a teacher their school's (the table's policies
 * decide) — or the sample school's in the sample portal. Narrowed to some
 * children when given their ids.
 */
export function useQaidahLessons(mode: PortalMode, studentIds?: string[]) {
  const [rows, setRows] = useState<QaidahAssignment[]>([]);
  const [ready, setReady] = useState(false);
  // The school's database hasn't had the update that adds the table yet.
  const [missingTable, setMissingTable] = useState(false);
  const idsKey = studentIds ? studentIds.join(",") : null;

  useEffect(() => {
    if (mode === "loading") return;
    const ids = idsKey === null ? null : idsKey ? idsKey.split(",") : [];
    if (mode === "demo") {
      const all = demoQaidahRows();
      setRows(ids ? all.filter((r) => ids.includes(r.student_id)) : all);
      setReady(true);
      return;
    }
    if (ids && ids.length === 0) {
      setRows([]);
      setReady(true);
      return;
    }
    let cancelled = false;
    const load = async () => {
      const supabase = createClient();
      let query = supabase
        .from("qaidah_assignments")
        .select(QAIDAH_COLUMNS)
        .order("assigned_at", { ascending: false })
        .limit(5000);
      if (ids) query = query.in("student_id", ids);
      const { data, error } = await query;
      if (cancelled) return;
      if (error) {
        setMissingTable(isMissingTable(error));
        setRows([]);
      } else {
        setRows((data ?? []) as QaidahAssignment[]);
      }
    };
    load()
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

async function call<T>(url: string, init: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json" },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "That didn't save. Please try again.");
  return data as T;
}

export interface LessonUpdate {
  lesson: QaidahAssignment;
  next: QaidahAssignment | null;
  finished: boolean;
}

/**
 * Setting, passing and removing lessons: through /api/qaidah-assignments for
 * a real school, in this browser for the sample one. Each throws with a
 * message to show when it didn't work.
 */
export function qaidahActions(demo: boolean) {
  return {
    async set(studentIds: string[], book: QaidahBookId, lesson: number, note: string | null) {
      if (demo) return demoSetLesson(studentIds, book, lesson, note);
      const data = await call<{ lessons: QaidahAssignment[] }>("/api/qaidah-assignments", {
        method: "POST",
        body: JSON.stringify({ student_ids: studentIds, book, lesson, note }),
      });
      return data.lessons;
    },
    async update(
      id: string,
      patch: { status?: QaidahStatus; note?: string | null },
      next = false
    ): Promise<LessonUpdate> {
      if (demo) {
        const result = demoUpdateLesson(id, patch, next);
        if (!result) throw new Error("That lesson wasn't found.");
        return result;
      }
      return call<LessonUpdate>(`/api/qaidah-assignments/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify({ ...patch, next }),
      });
    },
    async remove(id: string) {
      if (demo) {
        if (!demoRemoveLesson(id)) throw new Error("That lesson wasn't found.");
        return;
      }
      await call(`/api/qaidah-assignments/${encodeURIComponent(id)}`, { method: "DELETE" });
    },
  };
}
