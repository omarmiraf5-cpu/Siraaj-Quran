"use client";

import { useEffect, useState } from "react";
import { SURAHS as QURAN, getSurahById } from "@/data/mushaf-index";
import { JUZ_STARTS, getJuzRange } from "@/data/juz-index";
import {
  DEMO_ASSIGNMENTS,
  DEMO_CREATED_STUDENTS_KEY,
  DEMO_STUDENT_OVERRIDES_KEY,
  DEMO_TODAY,
  allStudents,
  studentName,
  initials,
  formatDay,
  ASSIGNMENT_LABELS,
  ASSIGNMENT_STYLES,
  HIFZ_PORTIONS,
  PORTION_LABELS,
  PORTION_ARABIC,
  PORTION_BLURB,
  DAILY_RATING_ORDER,
  DAILY_RATING_LABELS,
  withOverride,
  recitationLogFor,
  type AssignmentOverride,
  type RecitationLogEntry,
} from "@/data/demo";
import type { DemoStudent } from "@/data/demo";
import type { HifzPortion, QuranicAssignment, DailyRating } from "@/hooks/useQuranicAssignments";
import { Mushaf } from "@/components/Mushaf";
import { createClient } from "@/lib/supabase/client";
import { PortalHero } from "@/components/PortalHero";
import { SectionCard, ProgressBar, RatingPill, RecitationHistory } from "@/components/portal-ui";
import { IconBook, IconArrow } from "@/components/icons";
import { readDemoStore, writeDemoStore } from "@/lib/demoStore";

interface Student {
  id: string;
  full_name: string;
}

// Assignments created while browsing without a real Supabase session. This is
// the only write path in the app that ever talked to a real backend — every
// other "save" (attendance, the memorisation slider) is local state, so it
// always appears to work. This one used to fall straight through to the API
// and 401, dead-ending the one workflow a prospective school would actually
// want to try. Kept in localStorage, not just React state, so it survives a
// refresh during a demo.
const DEMO_CREATED_KEY = "demo_created_assignments";

function loadDemoCreated(): QuranicAssignment[] {
  try {
    const raw = localStorage.getItem(DEMO_CREATED_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// Rating and remark edits against the sample assignments, which are static
// data and cannot be mutated in place. Read by the parent portal too, so a
// rating set here shows up there in the same browser.
const OVERRIDES_KEY = "demo_assignment_overrides";

// Every graded session, dated, on top of the seeded month of history — kept
// separately from OVERRIDES_KEY above, since an override replaces an
// assignment's *current* rating while this accumulates one entry per day.
// Read by the parent portal too, for the same reason.
const LOG_KEY = "demo_recitation_log_v1";

export default function QuranAssignmentsPage() {
  const supabase = createClient();
  const surahs = QURAN;
  const [students, setStudents] = useState<Student[]>([]);
  // Full roster (admin-created students merged in), kept for name lookups
  // in the assignments list below — the dropdown above only needs id/name.
  const [roster, setRoster] = useState<DemoStudent[]>([]);
  const [selectedStudent, setSelectedStudent] = useState("");
  const [portion, setPortion] = useState<HifzPortion>("new");
  const [selectedSurah, setSelectedSurah] = useState("");
  const [ayahStart, setAyahStart] = useState("");
  const [ayahEnd, setAyahEnd] = useState("");
  // Spanning into a second surah — off by default, since most assignments
  // are one surah. Cleared whenever the portion or start surah changes, so
  // a stale end-surah from a previous pick can't linger.
  const [spansSurah, setSpansSurah] = useState(false);
  const [endSurah, setEndSurah] = useState("");
  // Quick-fill for muraajah: pick a starting juz' and how many to cover,
  // and "Apply" fills in the surah/ayah fields above rather than requiring
  // the teacher to look up boundaries by hand.
  const [juzStart, setJuzStart] = useState("1");
  const [juzCount, setJuzCount] = useState("1");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [isDemo, setIsDemo] = useState(false);
  const [demoCreated, setDemoCreated] = useState<QuranicAssignment[]>([]);
  const [overrides, setOverrides] = useState<Record<string, AssignmentOverride>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftRating, setDraftRating] = useState<DailyRating | null>(null);
  const [draftNotes, setDraftNotes] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [log, setLog] = useState<RecitationLogEntry[]>([]);

  useEffect(() => {
    const loadStudents = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          // Demo mode or no auth: use the sample roster, and remember that
          // there is no real session so submitting the form doesn't try — and
          // fail — a real write.
          setIsDemo(true);
          // Merged with whatever the admin portal has added, so a student
          // added there is immediately assignable — active only, since a
          // withdrawn student isn't getting new work.
          const fullRoster = allStudents(
            readDemoStore(DEMO_CREATED_STUDENTS_KEY, []),
            readDemoStore(DEMO_STUDENT_OVERRIDES_KEY, {})
          );
          setRoster(fullRoster);
          setStudents(
            fullRoster.filter((s) => s.active !== false).map((s) => ({ id: s.id, full_name: s.name }))
          );
          setDemoCreated(loadDemoCreated());
          setOverrides(readDemoStore(OVERRIDES_KEY, {}));
          setLog(readDemoStore(LOG_KEY, []));
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

      const surahEndValue = parseInt(spansSurah && endSurah ? endSurah : selectedSurah);

      if (isDemo) {
        // No real session to write against — /api/quranic-assignments would
        // correctly 401 here, since it has no school or teacher row to
        // attach the row to. Simulate the write in the browser instead of
        // dead-ending the one workflow a prospective school would want to
        // try first.
        const created: QuranicAssignment = {
          id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          student_id: selectedStudent,
          teacher_id: "t1",
          surah: parseInt(selectedSurah),
          ayah_start: parseInt(ayahStart),
          surah_end: surahEndValue,
          ayah_end: parseInt(ayahEnd),
          portion,
          // A plain date, not a full timestamp — formatDay elsewhere expects
          // "YYYY-MM-DD" the way every other assigned_at in the app is
          // shaped, and DEMO_TODAY rather than the real clock so a newly
          // created row reads as "today" on the same fixed timeline the
          // rest of the demo data uses instead of the real calendar date.
          assigned_at: DEMO_TODAY,
          due_date: dueDate || null,
          status: "assigned",
          memorization_level: 0,
          daily_rating: null,
          teacher_notes: notes || null,
          student_notes: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        const next = [created, ...demoCreated];
        setDemoCreated(next);
        try {
          localStorage.setItem(DEMO_CREATED_KEY, JSON.stringify(next));
        } catch {
          // Private browsing or a full quota — the assignment still shows
          // for this visit, it just won't survive a refresh.
        }
      } else {
        const res = await fetch("/api/quranic-assignments", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            student_id: selectedStudent,
            surah: parseInt(selectedSurah),
            ayah_start: parseInt(ayahStart),
            surah_end: surahEndValue,
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
      }

      setSuccess(true);
      setSelectedStudent("");
      setPortion("new");
      setSelectedSurah("");
      setAyahStart("");
      setAyahEnd("");
      setSpansSurah(false);
      setEndSurah("");
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

  const effectiveEndSurahId = spansSurah && endSurah ? parseInt(endSurah) : parseInt(selectedSurah) || 0;
  const endSurahData = getSurahById(effectiveEndSurahId);
  const maxAyahsEnd = endSurahData?.ayahs ?? 0;

  // Only surahs at or after the start are offered, since a muraajah range
  // always reads forward through the mushaf regardless of which direction
  // the student originally memorised it in.
  const endSurahOptions = QURAN.filter((s) => s.id >= (parseInt(selectedSurah) || 0));

  const applyJuzRange = () => {
    const range = getJuzRange(parseInt(juzStart), parseInt(juzCount) || 1, (s) => getSurahById(s)?.ayahs ?? 0);
    setSelectedSurah(String(range.surahStart));
    setAyahStart(String(range.ayahStart));
    setAyahEnd(String(range.ayahEnd));
    if (range.surahEnd !== range.surahStart) {
      setSpansSurah(true);
      setEndSurah(String(range.surahEnd));
    } else {
      setSpansSurah(false);
      setEndSurah("");
    }
    setShowPreview(false);
  };

  const canPreview = selectedSurah && ayahStart && ayahEnd;

  // Newest first, so an assignment just created shows at the top of the list
  // below rather than getting lost among the sample data.
  const allAssignments = [...demoCreated, ...DEMO_ASSIGNMENTS].map((a) =>
    withOverride(a, overrides)
  );

  const startEditing = (a: QuranicAssignment) => {
    setEditingId(a.id === editingId ? null : a.id);
    setDraftRating(a.daily_rating);
    setDraftNotes(a.teacher_notes ?? "");
  };

  const saveEdit = async (a: QuranicAssignment) => {
    setSavingEdit(true);
    const patch: AssignmentOverride = {
      daily_rating: draftRating,
      teacher_notes: draftNotes.trim() || null,
    };
    try {
      if (isDemo) {
        const next = { ...overrides, [a.id]: { ...overrides[a.id], ...patch } };
        setOverrides(next);
        writeDemoStore(OVERRIDES_KEY, next);

        // A rating turns into today's entry in the history log — replacing
        // today's entry for this same portion if one already exists, rather
        // than piling up duplicates from re-grading the same session.
        if (draftRating) {
          const withoutToday = log.filter(
            (e) => !(e.student_id === a.student_id && e.portion === a.portion && e.date === DEMO_TODAY)
          );
          const nextLog = [
            ...withoutToday,
            {
              id: `local-log-${a.student_id}-${a.portion}-${DEMO_TODAY}`,
              student_id: a.student_id,
              portion: a.portion,
              surah: a.surah,
              ayah_start: a.ayah_start,
              surah_end: a.surah_end,
              ayah_end: a.ayah_end,
              rating: draftRating,
              notes: draftNotes.trim() || null,
              date: DEMO_TODAY,
            },
          ];
          setLog(nextLog);
          writeDemoStore(LOG_KEY, nextLog);
        }
      } else {
        await fetch(`/api/quranic-assignments/${a.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(patch),
        });
        if (draftRating) {
          await fetch("/api/recitation-log", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              student_id: a.student_id,
              portion: a.portion,
              surah: a.surah,
              ayah_start: a.ayah_start,
              surah_end: a.surah_end,
              ayah_end: a.ayah_end,
              rating: draftRating,
              notes: draftNotes.trim() || null,
            }),
          });
        }
      }
      setEditingId(null);
    } finally {
      setSavingEdit(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto pb-20 space-y-4 pt-2">
      <PortalHero
        eyebrow="Set work"
        title="Assignments"
        meta={[
          `${students.length} students`,
          `${allAssignments.length} set this term`,
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
                    onClick={() => {
                      setPortion(p);
                      setSpansSurah(false);
                      setEndSurah("");
                    }}
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

          {/* Muraajah is usually set as a quantity — a juz', two juz' —
              rather than by hunting down exact ayah numbers, so give that
              as a quick-fill on top of the manual fields below. Not shown
              for the new lesson, which is a small daily portion picked by
              surah and ayah, not by the juz'. */}
          {portion !== "new" && (
            <div className="rounded-2xl border border-brand-gold/35 bg-brand-gold/8 p-3.5">
              <p className="text-sm font-semibold text-ink mb-2">Or set by juz'</p>
              <div className="flex items-end gap-2">
                <label className="flex-1 min-w-0">
                  <span className="block text-[11px] text-ink-muted mb-1">Starting juz'</span>
                  <select
                    value={juzStart}
                    onChange={(e) => setJuzStart(e.target.value)}
                    className="w-full bg-surface-card border border-surface-border rounded-xl px-3 py-2.5 text-sm text-ink focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/40 transition"
                  >
                    {JUZ_STARTS.map((j) => (
                      <option key={j.juz} value={j.juz}>
                        Juz {j.juz}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="w-20 flex-shrink-0">
                  <span className="block text-[11px] text-ink-muted mb-1">Juz' count</span>
                  <input
                    type="number"
                    min="1"
                    max="30"
                    value={juzCount}
                    onChange={(e) => setJuzCount(e.target.value)}
                    className="w-full bg-surface-card border border-surface-border rounded-xl px-3 py-2.5 text-sm text-ink text-center tabular-nums focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/40 transition"
                  />
                </label>
                <button
                  type="button"
                  onClick={applyJuzRange}
                  className="flex-shrink-0 px-4 py-2.5 rounded-xl bg-brand-navy text-white text-sm font-semibold hover:opacity-90 active:scale-[.98] transition-all"
                >
                  Apply
                </button>
              </div>
              <p className="text-[11px] text-ink-muted mt-2">
                Fills in the surah and ayahs below — a juz' rarely lines up
                with a surah's edges, so this often spans more than one.
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-ink mb-2">
              Surah *
            </label>
            <select
              value={selectedSurah}
              onChange={(e) => {
                setSelectedSurah(e.target.value);
                setSpansSurah(false);
                setEndSurah("");
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
                max={maxAyahsEnd}
                value={ayahEnd}
                onChange={(e) => {
                  setAyahEnd(e.target.value);
                  setShowPreview(false);
                }}
                placeholder={maxAyahsEnd.toString()}
                className="w-full bg-surface-card border border-surface-border rounded-2xl px-4 py-3 text-ink focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/40 transition"
              />
            </div>
          </div>
          {maxAyahs > 0 && !spansSurah && (
            <p className="text-xs text-ink-muted">
              This Surah has {maxAyahs} Ayahs
            </p>
          )}

          {/* Multiple surahs, manually: for a lesson or muraajah that
              simply doesn't line up with the quantity picker above. */}
          {selectedSurah &&
            (spansSurah ? (
              <div className="rounded-2xl border border-surface-border bg-surface-bg-warm p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-ink">Ends in surah</span>
                  <button
                    type="button"
                    onClick={() => {
                      setSpansSurah(false);
                      setEndSurah("");
                      setShowPreview(false);
                    }}
                    className="text-[11px] font-semibold text-ink-muted hover:text-ink transition-colors"
                  >
                    Remove
                  </button>
                </div>
                <select
                  value={endSurah || selectedSurah}
                  onChange={(e) => {
                    setEndSurah(e.target.value);
                    setShowPreview(false);
                  }}
                  className="w-full bg-surface-card border border-surface-border rounded-xl px-3 py-2.5 text-sm text-ink focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/40 transition"
                >
                  {endSurahOptions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.id}. {s.englishName} ({s.ayahs} Ayahs)
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-ink-muted">
                  Ayah End above is now within {endSurahData?.englishName ?? "this surah"}.
                </p>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setSpansSurah(true)}
                className="text-[13px] font-semibold text-brand-navy dark:text-brand-gold hover:underline"
              >
                + End in a different surah
              </button>
            ))}

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
                {isDemo
                  ? "Assignment added below — this preview saves in your browser only."
                  : "Assignment created."}
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
                  {spansSurah && endSurahData && endSurahData.id !== selectedSurahData?.id
                    ? `${selectedSurahData?.englishName ?? "Preview"} – ${endSurahData.englishName}`
                    : (selectedSurahData?.englishName ?? "Preview")}
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
                  surahEnd: effectiveEndSurahId,
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
          records; the create form above writes real ones once a teacher is
          properly signed in, and adds a browser-local preview row otherwise. */}
      <SectionCard
        title="Current assignments"
        note={`${allAssignments.length} across all students · tap to grade`}
      >
        <ul className="divide-y divide-surface-border -my-1">
          {allAssignments.map((a) => {
            const surah = getSurahById(a.surah);
            const surahEnd = a.surah_end !== a.surah ? getSurahById(a.surah_end) : null;
            const name = studentName(a.student_id, roster);
            const isOpen = editingId === a.id;

            const rangeLabel = surahEnd
              ? `${surah?.englishName ?? `Surah ${a.surah}`} ${a.ayah_start} – ${surahEnd.englishName} ${a.ayah_end}`
              : `${surah?.englishName ?? `Surah ${a.surah}`} · ayahs ${a.ayah_start}–${a.ayah_end}`;

            return (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => startEditing(a)}
                  aria-expanded={isOpen}
                  className="w-full flex items-center gap-3 py-3 text-left hover:bg-surface-bg-warm rounded-xl -mx-2 px-2 transition-colors"
                >
                  <span className="w-9 h-9 rounded-xl bg-brand-navy/10 text-brand-navy dark:text-brand-gold flex items-center justify-center font-bold text-[11px] flex-shrink-0">
                    {initials(name)}
                  </span>

                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-ink truncate">
                      {name}
                      {" · "}
                      <span className="underline decoration-2 underline-offset-2">
                        {PORTION_LABELS[a.portion]}
                      </span>
                    </p>
                    <p className="text-[11px] text-ink-muted truncate">
                      {rangeLabel}
                      {a.due_date ? ` · due ${formatDay(a.due_date)}` : ""}
                    </p>
                  </div>

                  {a.daily_rating ? (
                    <RatingPill rating={a.daily_rating} />
                  ) : (
                    <div className="w-16 flex-shrink-0 hidden sm:block">
                      <ProgressBar value={a.memorization_level} />
                      <p className="text-[10px] text-ink-muted text-right mt-1 tabular-nums">
                        {a.memorization_level}%
                      </p>
                    </div>
                  )}

                  <span
                    className={`text-[10px] font-semibold px-2 py-1 rounded-full flex-shrink-0 whitespace-nowrap hidden sm:inline-block ${ASSIGNMENT_STYLES[a.status]}`}
                  >
                    {ASSIGNMENT_LABELS[a.status]}
                  </span>

                  <span
                    className={`text-ink-muted transition-transform flex-shrink-0 ${isOpen ? "rotate-90" : ""}`}
                  >
                    <IconArrow size={14} />
                  </span>
                </button>

                {isOpen && (
                  <div className="mb-3 rounded-2xl border border-surface-border bg-surface-bg-warm p-4 space-y-3">
                    <div>
                      <p className="text-xs font-semibold text-ink mb-2">
                        Today&apos;s rating
                      </p>
                      <div className="grid grid-cols-4 gap-1.5">
                        {DAILY_RATING_ORDER.map((r) => {
                          const active = draftRating === r;
                          return (
                            <button
                              key={r}
                              type="button"
                              onClick={() => setDraftRating(active ? null : r)}
                              aria-pressed={active}
                              className={`rounded-xl border px-1.5 py-2 text-[11px] font-semibold text-center transition-all active:scale-[.97] ${
                                active
                                  ? "border-brand-navy bg-brand-navy text-white"
                                  : "border-surface-border bg-surface-card text-ink hover:border-brand-navy/40"
                              }`}
                            >
                              {DAILY_RATING_LABELS[r]}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-ink mb-1.5">
                        Remark for the parent
                      </label>
                      <textarea
                        value={draftNotes}
                        onChange={(e) => setDraftNotes(e.target.value)}
                        rows={3}
                        placeholder="e.g. Held the madd well today, keep it up."
                        className="w-full bg-surface-card border border-surface-border rounded-xl px-3 py-2.5 text-sm text-ink focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/40 transition resize-none"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => saveEdit(a)}
                        disabled={savingEdit}
                        className="flex-1 gradient-emerald text-white text-sm font-semibold py-2.5 rounded-xl disabled:opacity-50 hover:opacity-90 active:scale-[.98] transition-all"
                      >
                        {savingEdit ? "Saving…" : "Save"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="text-[13px] font-semibold text-ink-muted hover:text-ink px-3 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>

                    <div className="pt-1">
                      <p className="text-xs font-semibold text-ink mb-2">
                        {name.split(" ")[0]}&apos;s history
                      </p>
                      <RecitationHistory entries={recitationLogFor(a.student_id, log)} />
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </SectionCard>
    </div>
  );
}
