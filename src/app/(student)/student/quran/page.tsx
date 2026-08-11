"use client";

import { useEffect, useState } from "react";
import { TajweedMushaf } from "@/components/TajweedMushaf";
import { useQuranicAssignments, QuranicAssignment } from "@/hooks/useQuranicAssignments";
import { createClient } from "@/lib/supabase/client";
import { useDemoUser } from "@/hooks/useDemoUser";

export default function StudentQuranPage() {
  const demoUser = useDemoUser();
  const supabase = createClient();
  const { getAssignmentsByStudent, updateAssignment } = useQuranicAssignments();
  const [assignments, setAssignments] = useState<QuranicAssignment[]>([]);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [selectedAssignment, setSelectedAssignment] = useState<QuranicAssignment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  // Get student ID and load assignments
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);

        // Get current user
        const {
          data: { user },
        } = await supabase.auth.getUser();

        // For demo, use hardcoded student ID
        let id = studentId;
        if (!id && demoUser) {
          // In a real app, you'd look up student by profile_id
          // For now, use a demo student ID
          id = "00000000-0000-0000-0000-000000000001";
          setStudentId(id);
        }

        if (id) {
          const data = await getAssignmentsByStudent(id);
          setAssignments(data);
          if (data.length > 0) {
            setSelectedAssignment(data[0]);
          }
        }
      } catch (err) {
        console.error("Error loading assignments:", err);
        setError("Failed to load assignments");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [demoUser]);

  const handleStatusChange = async (status: QuranicAssignment["status"]) => {
    if (!selectedAssignment) return;
    try {
      await updateAssignment(selectedAssignment.id, { status });
      setSelectedAssignment({ ...selectedAssignment, status });
      setAssignments(
        assignments.map((a) => (a.id === selectedAssignment.id ? { ...a, status } : a))
      );
    } catch (err) {
      console.error("Error updating status:", err);
    }
  };

  const handleProgressChange = async (level: number) => {
    if (!selectedAssignment) return;
    try {
      setProgress(level);
      await updateAssignment(selectedAssignment.id, { memorization_level: level });
      setSelectedAssignment({ ...selectedAssignment, memorization_level: level });
      setAssignments(
        assignments.map((a) =>
          a.id === selectedAssignment.id ? { ...a, memorization_level: level } : a
        )
      );
    } catch (err) {
      console.error("Error updating progress:", err);
    }
  };

  if (loading) {
    return (
      <div className="px-4 pt-4 pb-20 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full border-4 border-subject-blue/30 border-t-subject-blue animate-spin mx-auto mb-4" />
          <p className="text-ink-muted">Loading your assignments...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-4 pt-4 pb-20">
        <div className="bg-red-50 dark:bg-red-950/25 border border-red-200 dark:border-red-800/40 rounded-3xl p-6 text-center">
          <p className="text-red-700 dark:text-red-300">{error}</p>
        </div>
      </div>
    );
  }

  if (assignments.length === 0) {
    return (
      <div className="px-4 pt-4 pb-20">
        <div className="text-center py-12">
          <p className="text-4xl mb-3">📖</p>
          <h2 className="text-xl font-bold text-ink mb-2">No assignments yet</h2>
          <p className="text-ink-muted">Your teacher will assign Surahs soon!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 pt-4 pb-20 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-ink mb-1">📖 Quranic Study</h1>
        <p className="text-ink-muted">Complete your Quranic homework</p>
      </div>

      {/* Assignment Tabs */}
      <div className="space-y-3">
        {assignments.map((assignment) => {
          const isSelected = selectedAssignment?.id === assignment.id;
          const statusEmoji = {
            assigned: "📤",
            in_progress: "🔄",
            completed: "✅",
            needs_review: "👀",
          }[assignment.status];

          return (
            <button
              key={assignment.id}
              onClick={() => setSelectedAssignment(assignment)}
              className={`w-full text-left p-4 rounded-2xl border-2 transition-all ${
                isSelected
                  ? "border-subject-blue bg-subject-blue/5"
                  : "border-surface-border bg-surface-card hover:border-subject-blue/50"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex-1">
                  <p className="font-semibold text-ink">
                    Surah {assignment.surah} • Ayahs {assignment.ayah_start}-
                    {assignment.ayah_end}
                  </p>
                  <p className="text-xs text-ink-muted mt-1">
                    {statusEmoji} {assignment.status.replace("_", " ")}
                  </p>
                </div>
                <div className="text-right text-sm">
                  <p className="font-bold text-subject-blue">
                    {assignment.memorization_level}%
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {selectedAssignment && (
        <div className="space-y-6">
          {/* Mushaf Viewer */}
          <div className="bg-surface-card rounded-3xl border border-surface-border p-6 overflow-hidden">
            <TajweedMushaf
              surahNumber={selectedAssignment.surah}
              highlightedAyahs={{
                start: selectedAssignment.ayah_start,
                end: selectedAssignment.ayah_end,
              }}
            />
          </div>

          {/* Progress Tracker */}
          <div className="bg-surface-card rounded-3xl border border-surface-border p-6 space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="font-semibold text-ink">Memorization Progress</label>
                <span className="text-sm font-bold text-subject-blue">
                  {selectedAssignment.memorization_level}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="10"
                value={selectedAssignment.memorization_level}
                onChange={(e) => handleProgressChange(parseInt(e.target.value))}
                className="w-full h-2 bg-surface-bg rounded-full appearance-none cursor-pointer accent-subject-blue"
              />
              <div className="flex justify-between text-xs text-ink-muted mt-2">
                <span>Not started</span>
                <span>Halfway</span>
                <span>Complete</span>
              </div>
            </div>
          </div>

          {/* Status Buttons */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => handleStatusChange("in_progress")}
              className={`py-3 rounded-2xl font-semibold transition-all ${
                selectedAssignment.status === "in_progress"
                  ? "bg-amber-500 text-white"
                  : "bg-surface-card border border-surface-border text-ink hover:bg-amber-50 dark:hover:bg-amber-950/25"
              }`}
            >
              🔄 In Progress
            </button>
            <button
              onClick={() => handleStatusChange("completed")}
              className={`py-3 rounded-2xl font-semibold transition-all ${
                selectedAssignment.status === "completed"
                  ? "bg-green-500 text-white"
                  : "bg-surface-card border border-surface-border text-ink hover:bg-green-50 dark:hover:bg-green-950/25"
              }`}
            >
              ✅ Completed
            </button>
          </div>

          {/* Notes Section */}
          {selectedAssignment.teacher_notes && (
            <div className="bg-blue-50 dark:bg-blue-950/25 border border-blue-200 dark:border-blue-800/40 rounded-2xl p-4">
              <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 mb-2">
                📝 Teacher Notes
              </p>
              <p className="text-sm text-blue-900 dark:text-blue-100">
                {selectedAssignment.teacher_notes}
              </p>
            </div>
          )}

          {/* Encouragement */}
          <div className="bg-gradient-to-r from-subject-blue to-subject-blue/70 rounded-3xl p-6 text-white text-center">
            <p className="text-lg font-bold mb-1">📖 Keep Going!</p>
            <p className="text-sm opacity-90">
              You&apos;re doing amazing. Every Ayah you memorize brings you closer to your goal.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
