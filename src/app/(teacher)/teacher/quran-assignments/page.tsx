"use client";

import { useEffect, useState } from "react";
import { SURAHS as QURAN, getSurahById } from "@/data/mushaf-index";
import { DEMO_ASSIGNMENTS, DEMO_STUDENTS, studentName, initials } from "@/data/demo";
import { Mushaf } from "@/components/Mushaf";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

interface Student {
  id: string;
  full_name: string;
}

export default function QuranAssignmentsPage() {
  const router = useRouter();
  const supabase = createClient();
  const surahs = QURAN;
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState("");
  const [selectedSurah, setSelectedSurah] = useState("");
  const [ayahStart, setAyahStart] = useState("");
  const [ayahEnd, setAyahEnd] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    const loadStudents = async () => {
      try {
        // Signing in as a demo account stores a local user rather than a
        // Supabase session, so checking Supabase alone bounced demo teachers
        // straight back to the login page and made this screen unreachable.
        // Read it here rather than through useDemoUser: that hook fills in
        // from an effect, so it is still null on the first run and would
        // redirect before the demo account was seen.
        const isDemo =
          typeof window !== "undefined" && !!localStorage.getItem("demo_user");

        const { data: { user } } = await supabase.auth.getUser();
        if (!user && !isDemo) {
          router.push("/login");
          return;
        }

        if (!user) {
          // Demo mode: no database to read, so use the sample roster.
          setStudents(DEMO_STUDENTS.map((s) => ({ id: s.id, full_name: s.name })));
          return;
        }

        const { data: studentData } = await supabase
          .from("students")
          .select("id, full_name")
          .order("full_name");

        if (studentData) {
          setStudents(studentData);
        }
      } catch (err) {
        console.error("Error loading data:", err);
      }
    };

    loadStudents();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setLoading(true);

    try {
      if (!selectedStudent || !selectedSurah || !ayahStart || !ayahEnd) {
        throw new Error("Please fill in all required fields");
      }

      const res = await fetch("/api/quranic-assignments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          student_id: selectedStudent,
          surah: parseInt(selectedSurah),
          ayah_start: parseInt(ayahStart),
          ayah_end: parseInt(ayahEnd),
          due_date: dueDate || null,
          teacher_notes: notes || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create assignment");
      }

      setSuccess(true);
      setSelectedStudent("");
      setSelectedSurah("");
      setAyahStart("");
      setAyahEnd("");
      setDueDate("");
      setNotes("");
      setShowPreview(false);

      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const selectedSurahData = getSurahById(parseInt(selectedSurah) || 0);
  const maxAyahs = selectedSurahData?.ayahs ?? 0;

  const canPreview = selectedSurah && ayahStart && ayahEnd;

  return (
    <div className="px-4 pt-4 pb-20 space-y-6">
      <div>
        <h1 className="page-title text-3xl mb-1">Assignments</h1>
        <p className="text-ink-muted">Assign Surah and Ayahs to students</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-ink mb-2">
              Student *
            </label>
            <select
              value={selectedStudent}
              onChange={(e) => setSelectedStudent(e.target.value)}
              className="w-full bg-surface-card border border-surface-border rounded-2xl px-4 py-3 text-ink focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/40 transition"
            >
              <option value="">Select a student</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-ink mb-2">
              Surah *
            </label>
            <select
              value={selectedSurah}
              onChange={(e) => {
                setSelectedSurah(e.target.value);
                setShowPreview(false);
              }}
              className="w-full bg-surface-card border border-surface-border rounded-2xl px-4 py-3 text-ink focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/40 transition"
            >
              <option value="">Select a Surah</option>
              {surahs.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.id}. {s.englishName} ({s.ayahs} Ayahs)
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-ink mb-2">
                Ayah Start *
              </label>
              <input
                type="number"
                min="1"
                max={maxAyahs}
                value={ayahStart}
                onChange={(e) => {
                  setAyahStart(e.target.value);
                  setShowPreview(false);
                }}
                placeholder="1"
                className="w-full bg-surface-card border border-surface-border rounded-2xl px-4 py-3 text-ink focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/40 transition"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-ink mb-2">
                Ayah End *
              </label>
              <input
                type="number"
                min="1"
                max={maxAyahs}
                value={ayahEnd}
                onChange={(e) => {
                  setAyahEnd(e.target.value);
                  setShowPreview(false);
                }}
                placeholder={maxAyahs.toString()}
                className="w-full bg-surface-card border border-surface-border rounded-2xl px-4 py-3 text-ink focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/40 transition"
              />
            </div>
          </div>
          {maxAyahs > 0 && (
            <p className="text-xs text-ink-muted">
              This Surah has {maxAyahs} Ayahs
            </p>
          )}

          {canPreview && !showPreview && (
            <button
              type="button"
              onClick={() => setShowPreview(true)}
              className="w-full bg-amber-100 dark:bg-amber-900/30 text-amber-900 dark:text-amber-200 font-semibold py-3 rounded-2xl transition-all hover:bg-amber-200 dark:hover:bg-amber-900/50 active:scale-[.98]"
            >
              👁 Preview Mushaf
            </button>
          )}

          <div>
            <label className="block text-sm font-semibold text-ink mb-2">
              Due Date (optional)
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full bg-surface-card border border-surface-border rounded-2xl px-4 py-3 text-ink focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/40 transition"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-ink mb-2">
              Notes for student (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any instructions or tips..."
              rows={4}
              className="w-full bg-surface-card border border-surface-border rounded-2xl px-4 py-3 text-ink focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/40 transition resize-none"
            />
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-950/25 border border-red-200 dark:border-red-800/40 rounded-2xl p-4">
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
          )}

          {success && (
            <div className="bg-green-50 dark:bg-green-950/25 border border-green-200 dark:border-green-800/40 rounded-2xl p-4">
              <p className="text-sm text-green-700 dark:text-green-300">
                Assignment created.
              </p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full gradient-emerald hover:opacity-90 disabled:opacity-50 text-white font-semibold py-3 rounded-2xl transition-all active:scale-95"
          >
            {loading ? "Creating..." : "Create Assignment"}
          </button>
        </form>

        {/* Mushaf Preview Panel */}
        <div className="lg:sticky lg:top-10 lg:self-start">
          {showPreview && canPreview ? (
            <div className="bg-surface-card rounded-3xl border border-surface-border p-6 overflow-hidden">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-ink">Mushaf Preview</h2>
                <button
                  onClick={() => setShowPreview(false)}
                  className="text-xs text-ink-muted hover:text-ink transition"
                >
                  Close
                </button>
              </div>
              <Mushaf
                initialPage={selectedSurahData?.startPage ?? 1}
                highlightedRange={{
                  surah: parseInt(selectedSurah),
                  start: parseInt(ayahStart),
                  end: parseInt(ayahEnd),
                }}
              />
            </div>
          ) : (
            <div className="bg-surface-card rounded-3xl border border-surface-border p-8 text-center">
              <span className="icon-tile mx-auto mb-4">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/></svg>
              </span>
              <h3 className="page-title text-lg mb-2">Mushaf Preview</h3>
              <p className="text-sm text-ink-muted">
                Select a Surah and Ayah range, then tap &ldquo;Preview Mushaf&rdquo; to see the Tajweed-highlighted text your student will study.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* What has already been set. Sample data until the school has its own
          records; the create form above writes real ones. */}
      <div className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="page-title text-lg">Current assignments</h2>
          <span className="text-[11px] text-ink-muted">{DEMO_ASSIGNMENTS.length} across all students</span>
        </div>

        <div className="bg-surface-card rounded-2xl border border-surface-border divide-y divide-surface-border overflow-hidden">
          {DEMO_ASSIGNMENTS.map((a) => {
            const surah = getSurahById(a.surah);
            const name = studentName(a.student_id);
            const chip = {
              assigned: "bg-blue-100 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300",
              in_progress: "bg-amber-100 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300",
              completed: "bg-green-100 dark:bg-green-950/30 text-green-700 dark:text-green-300",
              needs_review: "bg-red-100 dark:bg-red-950/30 text-red-700 dark:text-red-300",
            }[a.status];

            return (
              <div key={a.id} className="flex items-center gap-3 px-3 py-3">
                <div className="w-9 h-9 rounded-xl bg-brand-navy/10 text-brand-navy dark:text-brand-gold flex items-center justify-center font-bold text-xs flex-shrink-0">
                  {initials(name)}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-ink truncate">{name}</p>
                  <p className="text-[11px] text-ink-muted truncate">
                    {surah ? surah.englishName : `Surah ${a.surah}`} · ayahs {a.ayah_start}–{a.ayah_end}
                    {a.due_date ? ` · due ${a.due_date}` : ""}
                  </p>
                </div>

                <div className="w-16 flex-shrink-0 hidden sm:block">
                  <div className="h-1.5 bg-surface-bg rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-600 rounded-full"
                      style={{ width: `${a.memorization_level}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-ink-muted text-right mt-0.5 tabular-nums">
                    {a.memorization_level}%
                  </p>
                </div>

                <span className={`text-[10px] font-semibold px-2 py-1 rounded-full flex-shrink-0 ${chip}`}>
                  {a.status.replace("_", " ")}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
