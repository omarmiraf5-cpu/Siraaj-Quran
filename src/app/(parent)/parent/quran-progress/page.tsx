"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getSurahByNumber, QuranSurah } from "@/lib/quran-api";
import { TajweedMushaf } from "@/components/TajweedMushaf";

interface Child {
  id: string;
  full_name: string;
}

interface QuranicAssignment {
  id: string;
  surah: number;
  ayah_start: number;
  ayah_end: number;
  status: "assigned" | "in_progress" | "completed" | "needs_review";
  memorization_level: number;
  due_date: string | null;
  teacher_notes: string | null;
  assigned_at: string;
}

export default function ParentQuranProgressPage() {
  const supabase = createClient();
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChild, setSelectedChild] = useState<Child | null>(null);
  const [assignments, setAssignments] = useState<QuranicAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [surahs, setSurahs] = useState<Record<number, QuranSurah>>({});
  const [expandedAssignment, setExpandedAssignment] = useState<string | null>(null);

  useEffect(() => {
    const loadChildren = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const mockChildren: Child[] = [
          { id: "demo-student-1", full_name: "Yusuf" },
          { id: "demo-student-2", full_name: "Aisha" },
        ];
        setChildren(mockChildren);
        if (mockChildren.length > 0) {
          setSelectedChild(mockChildren[0]);
        }
      } catch (err) {
        console.error("Error loading children:", err);
      } finally {
        setLoading(false);
      }
    };

    loadChildren();
  }, []);

  useEffect(() => {
    if (!selectedChild) return;

    const loadAssignments = async () => {
      setLoading(true);
      setExpandedAssignment(null);
      try {
        const mockAssignments: QuranicAssignment[] = [
          {
            id: "1",
            surah: 1,
            ayah_start: 1,
            ayah_end: 7,
            status: "completed",
            memorization_level: 100,
            due_date: "2026-08-15",
            teacher_notes: "Great recitation!",
            assigned_at: "2026-08-01",
          },
          {
            id: "2",
            surah: 2,
            ayah_start: 1,
            ayah_end: 5,
            status: "in_progress",
            memorization_level: 60,
            due_date: "2026-08-25",
            teacher_notes: "Focus on Ayah 3",
            assigned_at: "2026-08-10",
          },
          {
            id: "3",
            surah: 3,
            ayah_start: 1,
            ayah_end: 3,
            status: "assigned",
            memorization_level: 0,
            due_date: "2026-09-01",
            teacher_notes: null,
            assigned_at: "2026-08-18",
          },
        ];

        setAssignments(mockAssignments);

        const surahMap: Record<number, QuranSurah> = {};
        for (const assignment of mockAssignments) {
          if (!surahMap[assignment.surah]) {
            const surahData = await getSurahByNumber(assignment.surah);
            if (surahData) {
              surahMap[assignment.surah] = surahData;
            }
          }
        }
        setSurahs(surahMap);
      } catch (err) {
        console.error("Error loading assignments:", err);
      } finally {
        setLoading(false);
      }
    };

    loadAssignments();
  }, [selectedChild]);

  const getStatusColor = (status: QuranicAssignment["status"]): string => {
    switch (status) {
      case "completed":
        return "bg-green-100 dark:bg-green-950/25 text-green-700 dark:text-green-300";
      case "in_progress":
        return "bg-amber-100 dark:bg-amber-950/25 text-amber-700 dark:text-amber-300";
      case "needs_review":
        return "bg-red-100 dark:bg-red-950/25 text-red-700 dark:text-red-300";
      default:
        return "bg-blue-100 dark:bg-blue-950/25 text-blue-700 dark:text-blue-300";
    }
  };

  const getStatusEmoji = (status: QuranicAssignment["status"]): string => {
    switch (status) {
      case "completed": return "✅";
      case "in_progress": return "🔄";
      case "needs_review": return "👀";
      default: return "📤";
    }
  };

  const totalAssignments = assignments.length;
  const completedAssignments = assignments.filter((a) => a.status === "completed").length;
  const avgProgress =
    totalAssignments > 0
      ? Math.round(assignments.reduce((sum, a) => sum + a.memorization_level, 0) / totalAssignments)
      : 0;

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full border-4 border-subject-blue/30 border-t-subject-blue animate-spin mx-auto mb-4" />
          <p className="text-ink-muted">Loading progress...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-ink mb-1">📖 Quranic Progress</h1>
        <p className="text-ink-muted">Track your child&apos;s Quranic journey</p>
      </div>

      {children.length > 1 && (
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-ink">Select Child</label>
          <div className="grid grid-cols-2 gap-3">
            {children.map((child) => (
              <button
                key={child.id}
                onClick={() => setSelectedChild(child)}
                className={`p-3 rounded-2xl font-semibold transition-all ${
                  selectedChild?.id === child.id
                    ? "bg-subject-blue text-white"
                    : "bg-surface-card border border-surface-border text-ink hover:bg-surface-bg"
                }`}
              >
                {child.full_name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-surface-card rounded-2xl border border-surface-border p-4 text-center">
          <p className="text-2xl font-bold text-subject-blue mb-1">{totalAssignments}</p>
          <p className="text-xs text-ink-muted font-semibold">Assignments</p>
        </div>
        <div className="bg-surface-card rounded-2xl border border-surface-border p-4 text-center">
          <p className="text-2xl font-bold text-green-600 mb-1">{completedAssignments}</p>
          <p className="text-xs text-ink-muted font-semibold">Completed</p>
        </div>
        <div className="bg-surface-card rounded-2xl border border-surface-border p-4 text-center">
          <p className="text-2xl font-bold text-amber-600 mb-1">{avgProgress}%</p>
          <p className="text-xs text-ink-muted font-semibold">Avg Progress</p>
        </div>
      </div>

      {/* Progress Overview */}
      <div className="bg-surface-card rounded-2xl border border-surface-border p-6 space-y-4">
        <h2 className="font-bold text-ink">Overall Progress</h2>
        <div className="space-y-3">
          <div>
            <div className="flex justify-between mb-2">
              <span className="text-sm text-ink-muted">Completion Rate</span>
              <span className="text-sm font-bold text-ink">{completedAssignments} of {totalAssignments}</span>
            </div>
            <div className="h-3 bg-surface-bg rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-green-400 to-green-600 transition-all duration-500"
                style={{ width: `${totalAssignments > 0 ? (completedAssignments / totalAssignments) * 100 : 0}%` }}
              />
            </div>
          </div>
          <div>
            <div className="flex justify-between mb-2">
              <span className="text-sm text-ink-muted">Memorization Level</span>
              <span className="text-sm font-bold text-ink">{avgProgress}%</span>
            </div>
            <div className="h-3 bg-surface-bg rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-400 to-blue-600 transition-all duration-500"
                style={{ width: `${avgProgress}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Assignments List with Mushaf */}
      <div className="space-y-3">
        <h2 className="font-bold text-ink">Assignments</h2>
        <p className="text-xs text-ink-muted">Tap an assignment to view the Mushaf with highlighted Ayahs</p>
        {assignments.map((assignment) => {
          const surah = surahs[assignment.surah];
          const isOverdue =
            assignment.due_date &&
            new Date(assignment.due_date) < new Date() &&
            assignment.status !== "completed";
          const isExpanded = expandedAssignment === assignment.id;

          return (
            <div key={assignment.id} className="space-y-0">
              <button
                onClick={() => setExpandedAssignment(isExpanded ? null : assignment.id)}
                className={`w-full text-left rounded-2xl border p-4 transition-all ${
                  isOverdue
                    ? "border-red-300 bg-red-50 dark:bg-red-950/25"
                    : isExpanded
                      ? "border-subject-blue bg-subject-blue/5"
                      : "border-surface-border bg-surface-card hover:border-subject-blue/50"
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg font-bold text-ink">
                        {surah?.englishName || `Surah ${assignment.surah}`}
                      </span>
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${getStatusColor(assignment.status)}`}>
                        {getStatusEmoji(assignment.status)} {assignment.status.replace("_", " ")}
                      </span>
                    </div>
                    <p className="text-sm text-ink-muted">
                      Ayahs {assignment.ayah_start}-{assignment.ayah_end}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-subject-blue">{assignment.memorization_level}%</span>
                    <span className={`text-ink-muted transition-transform ${isExpanded ? "rotate-180" : ""}`}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
                    </span>
                  </div>
                </div>

                {/* Progress Bar */}
                <div>
                  <div className="h-2 bg-surface-bg rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-subject-blue to-subject-blue/60 transition-all"
                      style={{ width: `${assignment.memorization_level}%` }}
                    />
                  </div>
                </div>

                {/* Meta */}
                <div className="flex flex-wrap gap-2 text-xs text-ink-muted mt-3">
                  <span>📅 Assigned: {new Date(assignment.assigned_at).toLocaleDateString()}</span>
                  {assignment.due_date && (
                    <span className={isOverdue ? "text-red-600 dark:text-red-400 font-semibold" : ""}>
                      📍 Due: {new Date(assignment.due_date).toLocaleDateString()}
                    </span>
                  )}
                </div>

                {assignment.teacher_notes && (
                  <div className="bg-blue-50 dark:bg-blue-950/25 rounded-lg border border-blue-200 dark:border-blue-800/40 p-3 mt-3">
                    <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 mb-1">📝 Teacher Notes</p>
                    <p className="text-sm text-blue-900 dark:text-blue-100">{assignment.teacher_notes}</p>
                  </div>
                )}
              </button>

              {/* Expanded Mushaf Viewer */}
              {isExpanded && (
                <div className="bg-surface-card rounded-b-3xl border border-t-0 border-subject-blue p-6 -mt-2">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-ink">
                      📖 {surah?.englishName || `Surah ${assignment.surah}`} — Ayahs {assignment.ayah_start}-{assignment.ayah_end}
                    </h3>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedAssignment(null);
                      }}
                      className="text-xs text-ink-muted hover:text-ink"
                    >
                      Close
                    </button>
                  </div>
                  <TajweedMushaf
                    surahNumber={assignment.surah}
                    highlightedAyahs={{
                      start: assignment.ayah_start,
                      end: assignment.ayah_end,
                    }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {selectedChild && (
        <div className="bg-gradient-to-r from-subject-blue to-subject-blue/70 rounded-3xl p-6 text-white text-center">
          <p className="text-lg font-bold mb-2">🌟 Keep Supporting {selectedChild.full_name}!</p>
          <p className="text-sm opacity-90">
            Regular practice helps build a beautiful connection with the Quran.
          </p>
        </div>
      )}
    </div>
  );
}
