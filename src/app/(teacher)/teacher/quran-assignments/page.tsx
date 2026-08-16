"use client";

import { useEffect, useState } from "react";
import { SURAHS as QURAN, getSurahById } from "@/data/mushaf-index";
import {
  DEMO_ASSIGNMENTS,
  DEMO_STUDENTS,
  studentName,
  initials,
  formatDay,
  ASSIGNMENT_LABELS,
  ASSIGNMENT_STYLES,
  HIFZ_PORTIONS,
  PORTION_LABELS,
  PORTION_ARABIC,
  PORTION_BLURB,
} from "@/data/demo";
import type { HifzPortion } from "@/hooks/useQuranicAssignments";
import { Mushaf } from "@/components/Mushaf";
import { createClient } from "@/lib/supabase/client";
import { PortalHero } from "@/components/PortalHero";
import { SectionCard, ProgressBar } from "@/components/portal-ui";
import { IconBook } from "@/components/icons";

interface Student {
  id: string;
  full_name: string;
}

export default function QuranAssignmentsPage() {
  const supabase = createClient();
  const surahs = QURAN;
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState("");
  const [portion, setPortion] = useState<HifzPortion>("new");
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
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          // Demo mode or no auth: use the sample roster.
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
          portion,
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
      setPortion("new");
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
    <div className="max-w-4xl mx-auto pb-20 space-y-4 pt-2">
      <PortalHero
        eyebrow="Set work"
        title="Assignments"
        meta={[
          `${students.length} students`,
          `${DEMO_ASSIGNMENTS.length} set this term`,
        ]}
      />

      <div className="grid lg:grid-cols-2 gap-4 items-start">
        {/* Form */}
        <form onSubmit={handleSubmit} className="card-quiet p-5 space-y-5">
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

          {/* Which of the three daily portions. Defaults to the new lesson,
              which is the one most often being set. */}
          <div>
            <label className="block text-sm font-semibold text-ink mb-2">
              Portion *
            </label>
            <div className="grid grid-cols-3 gap-2">
              {HIFZ_PORTIONS.map((p) => {
                const active = portion === p;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPortion(p)}
                    aria-pressed={active}
                    className={`rounded-2xl border px-2 py-2.5 text-center transition-all active:scale-[.98] ${
                      active
                        ? "border-brand-navy bg-brand-navy text-white"
                        : "border-surface-border bg-surface-card text-ink hover:border-brand-navy/40"
                    }`}
                  >
                    <span className="block text-[12px] font-semibold leading-tight">
                      {PORTION_LABELS[p]}
                    </span>
                    <span
                      className={`block font-arabic text-[13px] mt-1 leading-tight ${
                        active ? "text-white/70" : "text-ink-muted"
                      }`}
                      dir="rtl"
                      lang="ar"
                    >
                      {PORTION_ARABIC[p]}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-ink-muted mt-2">{PORTION_BLURB[portion]}</p>
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
              className="w-full inline-flex items-center justify-center gap-2 border border-brand-gold/45 bg-brand-gold/12 text-[#6f5518] dark:text-brand-gold font-semibold py-3 rounded-2xl transition-all hover:bg-brand-gold/20 active:scale-[.98]"
            >
              <IconBook size={16} />
              Preview in the Mushaf
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
            <div className="card-quiet p-5 overflow-hidden">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="page-title text-lg">
                  {selectedSurahData?.englishName ?? "Preview"}
                </h2>
                <button
                  onClick={() => setShowPreview(false)}
                  className="text-[11px] font-semibold text-ink-muted hover:text-ink transition-colors flex-shrink-0"
                >
                  Close
                </button>
              </div>
              <div className="gold-rule my-4" />
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
            <div className="card-quiet card-feature p-8 text-center">
              <span className="icon-tile mx-auto mb-4">
                <IconBook size={19} />
              </span>
              <h3 className="page-title text-lg mb-2">Mushaf preview</h3>
              <p className="text-[13px] text-ink-muted leading-relaxed max-w-xs mx-auto">
                Pick a surah and an ayah range, then preview it to see exactly
                the Tajweed-highlighted text your student will study.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* What has already been set. Sample data until the school has its own
          records; the create form above writes real ones. */}
      <SectionCard
        title="Current assignments"
        note={`${DEMO_ASSIGNMENTS.length} across all students`}
      >
        <ul className="divide-y divide-surface-border -my-1">
          {DEMO_ASSIGNMENTS.map((a) => {
            const surah = getSurahById(a.surah);
            const name = studentName(a.student_id);

            return (
              <li key={a.id} className="flex items-center gap-3 py-3">
                <span className="w-9 h-9 rounded-xl bg-brand-navy/10 text-brand-navy dark:text-brand-gold flex items-center justify-center font-bold text-[11px] flex-shrink-0">
                  {initials(name)}
                </span>

                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-ink truncate">
                    {name}
                    <span className="font-normal text-ink-muted">
                      {" · "}
                      {PORTION_LABELS[a.portion]}
                    </span>
                  </p>
                  <p className="text-[11px] text-ink-muted truncate">
                    {surah ? surah.englishName : `Surah ${a.surah}`} · ayahs{" "}
                    {a.ayah_start}–{a.ayah_end}
                    {a.due_date ? ` · due ${formatDay(a.due_date)}` : ""}
                  </p>
                </div>

                <div className="w-16 flex-shrink-0 hidden sm:block">
                  <ProgressBar value={a.memorization_level} />
                  <p className="text-[10px] text-ink-muted text-right mt-1 tabular-nums">
                    {a.memorization_level}%
                  </p>
                </div>

                <span
                  className={`text-[10px] font-semibold px-2 py-1 rounded-full flex-shrink-0 whitespace-nowrap ${ASSIGNMENT_STYLES[a.status]}`}
                >
                  {ASSIGNMENT_LABELS[a.status]}
                </span>
              </li>
            );
          })}
        </ul>
      </SectionCard>
    </div>
  );
}
