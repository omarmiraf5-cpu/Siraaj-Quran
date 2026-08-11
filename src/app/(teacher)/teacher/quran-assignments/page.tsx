"use client";

import { useEffect, useState } from "react";
import { getSurahs, QuranSurah } from "@/lib/quran-api";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

interface Student {
  id: string;
  full_name: string;
}

export default function QuranAssignmentsPage() {
  const router = useRouter();
  const supabase = createClient();
  const [surahs, setSurahs] = useState<QuranSurah[]>([]);
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

  // Load Surahs and students
  useEffect(() => {
    const loadData = async () => {
      try {
        // Load Surahs
        const surahList = await getSurahs();
        setSurahs(surahList);

        // Load students
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.push("/login");
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
        setError("Failed to load form data");
      }
    };

    loadData();
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
      // Reset form
      setSelectedStudent("");
      setSelectedSurah("");
      setAyahStart("");
      setAyahEnd("");
      setDueDate("");
      setNotes("");

      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const selectedSurahData = surahs.find(
    (s) => s.number === parseInt(selectedSurah)
  );
  const maxAyahs = selectedSurahData?.numberOfAyahs || 0;

  return (
    <div className="px-4 pt-4 pb-20 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-ink mb-1">📖 Quranic Assignment</h1>
        <p className="text-ink-muted">Assign Surah and Ayahs to students</p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Student Selection */}
        <div>
          <label className="block text-sm font-semibold text-ink mb-2">
            Student *
          </label>
          <select
            value={selectedStudent}
            onChange={(e) => setSelectedStudent(e.target.value)}
            className="w-full bg-surface-card border border-surface-border rounded-2xl px-4 py-3 text-ink focus:outline-none focus:border-subject-blue focus:ring-1 focus:ring-subject-blue transition"
          >
            <option value="">Select a student</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.full_name}
              </option>
            ))}
          </select>
        </div>

        {/* Surah Selection */}
        <div>
          <label className="block text-sm font-semibold text-ink mb-2">
            Surah *
          </label>
          <select
            value={selectedSurah}
            onChange={(e) => setSelectedSurah(e.target.value)}
            className="w-full bg-surface-card border border-surface-border rounded-2xl px-4 py-3 text-ink focus:outline-none focus:border-subject-blue focus:ring-1 focus:ring-subject-blue transition"
          >
            <option value="">Select a Surah</option>
            {surahs.map((s) => (
              <option key={s.number} value={s.number}>
                {s.number}. {s.englishName} ({s.numberOfAyahs} Ayahs)
              </option>
            ))}
          </select>
        </div>

        {/* Ayah Range */}
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
              onChange={(e) => setAyahStart(e.target.value)}
              placeholder="1"
              className="w-full bg-surface-card border border-surface-border rounded-2xl px-4 py-3 text-ink focus:outline-none focus:border-subject-blue focus:ring-1 focus:ring-subject-blue transition"
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
              onChange={(e) => setAyahEnd(e.target.value)}
              placeholder={maxAyahs.toString()}
              className="w-full bg-surface-card border border-surface-border rounded-2xl px-4 py-3 text-ink focus:outline-none focus:border-subject-blue focus:ring-1 focus:ring-subject-blue transition"
            />
          </div>
        </div>
        {maxAyahs > 0 && (
          <p className="text-xs text-ink-muted">
            This Surah has {maxAyahs} Ayahs
          </p>
        )}

        {/* Due Date */}
        <div>
          <label className="block text-sm font-semibold text-ink mb-2">
            Due Date (optional)
          </label>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="w-full bg-surface-card border border-surface-border rounded-2xl px-4 py-3 text-ink focus:outline-none focus:border-subject-blue focus:ring-1 focus:ring-subject-blue transition"
          />
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-semibold text-ink mb-2">
            Notes for student (optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add any instructions or tips..."
            rows={4}
            className="w-full bg-surface-card border border-surface-border rounded-2xl px-4 py-3 text-ink focus:outline-none focus:border-subject-blue focus:ring-1 focus:ring-subject-blue transition resize-none"
          />
        </div>

        {/* Messages */}
        {error && (
          <div className="bg-red-50 dark:bg-red-950/25 border border-red-200 dark:border-red-800/40 rounded-2xl p-4">
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
        )}

        {success && (
          <div className="bg-green-50 dark:bg-green-950/25 border border-green-200 dark:border-green-800/40 rounded-2xl p-4">
            <p className="text-sm text-green-700 dark:text-green-300">
              ✅ Assignment created successfully!
            </p>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-subject-blue hover:bg-subject-blue/90 disabled:opacity-50 text-white font-semibold py-3 rounded-2xl transition-all active:scale-95"
        >
          {loading ? "Creating..." : "Create Assignment"}
        </button>
      </form>
    </div>
  );
}
