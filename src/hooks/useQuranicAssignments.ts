"use client";

import { useCallback, useState } from "react";

export interface QuranicAssignment {
  id: string;
  student_id: string;
  teacher_id: string;
  surah: number;
  ayah_start: number;
  ayah_end: number;
  assigned_at: string;
  due_date: string | null;
  status: "assigned" | "in_progress" | "completed" | "needs_review";
  memorization_level: number;
  teacher_notes: string | null;
  student_notes: string | null;
  created_at: string;
  updated_at: string;
}

export function useQuranicAssignments() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getAssignmentsByStudent = useCallback(
    async (studentId: string): Promise<QuranicAssignment[]> => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/quranic-assignments?student_id=${studentId}`);
        if (!res.ok) throw new Error("Failed to fetch assignments");
        const data = await res.json();
        return data.assignments || [];
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        setError(message);
        return [];
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const createAssignment = useCallback(
    async (assignment: Omit<QuranicAssignment, "id" | "created_at" | "updated_at">) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/quranic-assignments", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(assignment),
        });
        if (!res.ok) throw new Error("Failed to create assignment");
        return await res.json();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const updateAssignment = useCallback(
    async (id: string, updates: Partial<QuranicAssignment>) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/quranic-assignments/${id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(updates),
        });
        if (!res.ok) throw new Error("Failed to update assignment");
        return await res.json();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return {
    loading,
    error,
    getAssignmentsByStudent,
    createAssignment,
    updateAssignment,
  };
}
