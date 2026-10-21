"use client";

import { useEffect, useState, useRef } from "react";
import { SURAHS as QURAN, getSurahById, PAGE_STARTS, TOTAL_PAGES, HIZB_STARTS } from "@/data/mushaf-index";
import { RUB_STARTS } from "@/data/hizb-quarters";
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
  DAILY_RATING_STYLES,
  withOverride,
  recitationLogFor,
  type AssignmentOverride,
  type RecitationLogEntry,
} from "@/data/demo";
import type { DemoStudent } from "@/data/demo";
import type { HifzPortion, QuranicAssignment, DailyRating } from "@/hooks/useQuranicAssignments";
import { Mushaf } from "@/components/Mushaf";
import { SurahPicker } from "@/components/SurahPicker";
import { createClient } from "@/lib/supabase/client";
import { sessionUser } from "@/lib/supabase/sessionUser";
import { PortalHero } from "@/components/PortalHero";
import { SectionCard, ProgressBar, RatingPill, RecitationHistory, EmptyNote, OPEN_ROW, RowChevron } from "@/components/portal-ui";
import { PlanAlertBanner, AlertGlyph } from "@/components/yearly-plan-ui";
import { readDemoStore, writeDemoStore } from "@/lib/demoStore";
import {
  demoConfirmSurah,
  demoGradePlanLesson,
  demoPlanStudents,
  demoSyncPlans,
  isDemoPlanLesson,
} from "@/lib/demoPlans";
import { statusForRating } from "@/lib/planLessons";
import { useLanguage } from "@/components/LanguageProvider";
import { myHalaqas, shortHalaqaLabel } from "@/lib/teacherScope";
import { isProgramHalaqa } from "@/lib/programHalaqa";
import { loadSchoolShape } from "@/lib/schoolStructure";
import { gradeLabel } from "@/lib/grades";
import { readCache, writeCache } from "@/lib/pageCache";
import { ColorTile } from "@/components/gem-icons";
import {
  DIRECTION_HINT,
  DIRECTION_LABEL,
  formatPosition,
  pageLabel,
  nextPosition,
  pageOfPosition,
  walk,
  type Direction,
} from "@/lib/mushafPlan";
import { phrase } from "@/lib/i18n/phrases";
import { translateAlert } from "@/lib/yearlyPlan";

// Whether this school is kept in grades, from the last visit: the grade
// buttons show at once rather than after the school is asked again.
const GRADED_KEY = "assignments-graded";

interface Student {
  id: string;
  full_name: string;
  /** In a school kept in grades; null otherwise. */
  grade?: number | null;
}

// Mirrors AutoAssignSummary in @/lib/autoAssignments — duplicated rather
// than imported, since that module is server-only and this page is not.
interface PlanAlertDto {
  code: string;
  level: "info" | "warning" | "critical";
  title: string;
  detail: string;
}
interface PlanSummaryDto {
  pace: "not_started" | "ahead" | "on_track" | "at_risk" | "behind" | "complete";
  alerts: PlanAlertDto[];
  pending_confirmation: { surah: number; surah_name: string } | null;
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

type ExtraKind = "homework" | "recent" | "old";
interface ExtraPiece {
  kind: ExtraKind;
  surah: string;
  start: string;
  end: string;
  due: string;
}
const EXTRA_KINDS: ExtraKind[] = ["homework", "recent", "old"];
// The student picker's "everyone in this group" choice.
const EVERYONE = "__everyone__";

export default function QuranAssignmentsPage() {
  const supabase = createClient();
  const { language, tr } = useLanguage();
  const surahs = QURAN;
  const [students, setStudents] = useState<Student[]>([]);
  // Full roster (admin-created students merged in), kept for name lookups
  // in the assignments list below — the dropdown above only needs id/name.
  const [roster, setRoster] = useState<DemoStudent[]>([]);
  const [selectedStudent, setSelectedStudent] = useState("");
  // In a school kept in grades, the student list is narrowed to one grade
  // at a time ("" is every grade), so a teacher with several grades isn't
  // scrolling one long list of names.
  const [graded, setGraded] = useState(() => readCache<boolean>(GRADED_KEY) ?? false);
  const [gradeFilter, setGradeFilter] = useState("");
  // The teacher's program halaqas (Hifd) — offered as chips beside the
  // grades, since a Hifd class spans grades. A chip key of "p:<id>".
  const [programs, setPrograms] = useState<{ id: string; name: string; studentIds: string[] }[]>([]);
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
  // Or the range given as mushaf pages (Madinah mushaf, 1 to 604).
  const [pageFrom, setPageFrom] = useState("");
  const [pageTo, setPageTo] = useState("");
  // What the preview follows: the surah and ayahs, or a page number being typed.
  const [previewBy, setPreviewBy] = useState<"surah" | "page">("surah");
  // Or in hizbs (a juz' is two), for muraajah.
  const [hizbStart, setHizbStart] = useState("1");
  const [hizbQuarter, setHizbQuarter] = useState("1"); // which quarter of that hizb it starts at
  const [hizbCount, setHizbCount] = useState("1");
  const [hizbUnit, setHizbUnit] = useState<"hizb" | "quarter">("hizb");
  const [juzStart, setJuzStart] = useState("1");
  const [juzCount, setJuzCount] = useState("1");
  // Which way this student works through the mushaf, and where they had
  // reached — read once per student from /api/quran-position, which is
  // the same source the yearly plan uses. Two features guessing this
  // independently is how a plan ends up running the opposite way from the
  // daily lessons feeding it.
  const [direction, setDirection] = useState<Direction>("hifz");
  const [directionKnown, setDirectionKnown] = useState(false);
  const [lastPosition, setLastPosition] = useState<{ surah: number; ayah: number } | null>(null);
  // Whose position that is — so a lesson is never filled in from the child before.
  const [positionFor, setPositionFor] = useState<string | null>(null);
  const [lastSurahName, setLastSurahName] = useState<string>("");
  const [nextCount, setNextCount] = useState("10");
  const [savingDirection, setSavingDirection] = useState(false);
  // Every student's yearly plan, read alongside their assignments so the
  // same behind-schedule signal the Yearly Plan page shows also shows up
  // here, where a teacher actually sets the day's work — and so opening
  // this page at all is what catches each student's auto-generated lesson
  // up, not picking them in the form below. Keyed by student_id; a
  // student missing from this map has no active anchored plan, not just
  // one still loading.
  // Where each of the teacher's students sits — "Grade 3 · North · Halaqa A" — for grouping the list.
  const [placeOf, setPlaceOf] = useState<Record<string, string>>({});
  const [listGroup, setListGroup] = useState("");
  const [planSummaries, setPlanSummaries] = useState<Record<string, PlanSummaryDto>>({});
  const [confirmingSurah, setConfirmingSurah] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState("");
  // Whether it's for today's lesson, in class, or homework to do at home.
  const [forWhen, setForWhen] = useState<"today" | "homework" | "not_recited">("today");
  // More work given in the same save: homework, a recent revision, an old
  // revision — each with its own surah, ayahs and due date. A hifz day is
  // usually the three portions together.
  const [extras, setExtras] = useState<ExtraPiece[]>([]);
  const updateExtra = (kind: ExtraKind, patch: Partial<ExtraPiece>) =>
    setExtras((list) => list.map((x) => (x.kind === kind ? { ...x, ...patch } : x)));
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  // What was just saved, for the "Saved · Undo" bar at the bottom.
  const [saved, setSaved] = useState<{ ids: string[]; text: string; undoable: boolean; demo: boolean } | null>(null);
  const [undoing, setUndoing] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The ways of filling in a range other than surah and ayah (pages, juz',
  // hizb), and the note — tucked away for the new lesson until asked for.
  const [moreWays, setMoreWays] = useState(false);
  const [showNote, setShowNote] = useState(false);
  // Whether the new lesson was filled in for them from where the child stopped.
  const [autoFilledFor, setAutoFilledFor] = useState<string | null>(null);
  const [isDemo, setIsDemo] = useState(false);
  const [demoCreated, setDemoCreated] = useState<QuranicAssignment[]>([]);
  // The sample school's plan lessons, and which students have a plan — a
  // student whose new lesson comes from their plan doesn't also show the
  // hand-typed sample one.
  const [demoPlanLessons, setDemoPlanLessons] = useState<QuranicAssignment[]>([]);
  const [demoPlanStudentIds, setDemoPlanStudentIds] = useState<Set<string>>(new Set());
  const [realAssignments, setRealAssignments] = useState<QuranicAssignment[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<Record<string, AssignmentOverride>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  // Which student's pieces of work are showing: a tap on a name opens that child's day.
  const [openStudent, setOpenStudent] = useState<string | null>(null);
  const [draftRating, setDraftRating] = useState<DailyRating | null>(null);
  const [draftNotes, setDraftNotes] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [log, setLog] = useState<RecitationLogEntry[]>([]);

  const isGradedSchool = async (userId: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("school_id, schools!profiles_school_id_fkey(organised_by_grade)")
        .eq("id", userId)
        .maybeSingle();
      if (!error) {
        const row = data as { schools: { organised_by_grade?: boolean } | { organised_by_grade?: boolean }[] | null } | null;
        const school = Array.isArray(row?.schools) ? row?.schools[0] : row?.schools;
        return school?.organised_by_grade === true;
      }
      // A database from before the grades update can't answer in one go.
      const { data: me } = await supabase.from("profiles").select("school_id").eq("id", userId).maybeSingle();
      return (await loadSchoolShape(supabase, me?.school_id ?? null)).graded;
    } catch {
      return false;
    }
  };

  useEffect(() => {
    const loadStudents = async () => {
      try {
        const user = await sessionUser(supabase);

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
          setPlaceOf(Object.fromEntries(fullRoster.filter((s) => s.halaqa).map((s) => [s.id, s.halaqa])));
          setStudents(
            fullRoster
              .filter((s) => s.active !== false)
              .map((s) => ({ id: s.id, full_name: s.name, grade: s.grade ?? null }))
          );
          setGraded(fullRoster.some((s) => s.grade !== undefined));
          setDemoCreated(loadDemoCreated());
          setOverrides(readDemoStore(OVERRIDES_KEY, {}));
          setLog(readDemoStore(LOG_KEY, []));
          // The same catch-up the live site runs on opening this page, from
          // the sample school's own yearly plans — see demoPlans.ts.
          refreshDemoPlans();
          return;
        }

        const [{ data: allStudentData, error: studentError }, myGroups, schoolGraded] = await Promise.all([
          supabase.from("students").select("id, full_name, grade").order("full_name"),
          // Just the children of their own halaqas:
          // every one of a school's hundreds is synced below otherwise.
          myHalaqas(supabase),
          // Whether this school is kept in grades — a Qur'an school's
          // students carry an age grade too, which means nothing there.
          // Asked alongside the students, so the grade buttons arrive
          // with the list rather than a few seconds after it.
          isGradedSchool(user.id),
        ]);
        setGraded(schoolGraded);
        writeCache(GRADED_KEY, schoolGraded);
        // The same map myHalaqaStudents gives: each child and where they sit.
        let mine: Map<string, string> | null = null;
        if (myGroups) {
          mine = new Map();
          for (const h of myGroups) for (const id of h.studentIds) if (!mine.has(id)) mine.set(id, h.label);
          // Known by the halaqa's own name ("Hifd · Ustadh Omar"), not its
          // label, whose last part is often the teacher.
          const { data: meRow } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
          const progs = myGroups
            // In a school kept in grades, only the Hifd classes (the grades
            // have chips already); in a Qur'an school, every halaqa.
            .filter((h) => isProgramHalaqa(h.name) || !schoolGraded)
            .map((h) => ({ id: h.id, name: shortHalaqaLabel(h, myGroups, meRow?.full_name ?? null), studentIds: h.studentIds }));
          setPrograms(progs);
          // A teacher whose halaqa is a Hifd class opens on it: that's who they set work for.
          if (progs.length === 1) setGradeFilter((now) => now || `p:${progs[0].id}`);
        }
        if (studentError) throw studentError;
        const studentData = mine ? (allStudentData ?? []).filter((s) => mine.has(s.id)) : allStudentData;

        if (mine) setPlaceOf(Object.fromEntries(mine));
        if (studentData) {
          setStudents(studentData);
          // Real students weren't fed into `roster` at all here, which
          // exists solely so the list below can look a name up by id —
          // every real assignment in it read as belonging to a student
          // called "Student", the fallback for a lookup that finds no one.
          setRoster(studentData.map((s) => ({ id: s.id, name: s.full_name, halaqa: "" })));
        }

        // Catches every student's "new" lesson up with their own yearly
        // plan before the list below is read — the point of automating
        // this away is that a teacher never has to open the form and pick
        // a student just to make it happen, so nothing here waits on that.
        const summaries: Record<string, PlanSummaryDto> = {};
        await Promise.all(
          (studentData ?? []).map(async (s) => {
            try {
              const r = await fetch(`/api/quranic-assignments?student_id=${encodeURIComponent(s.id)}`);
              const b = await r.json();
              if (b?.plan_summary) summaries[s.id] = b.plan_summary;
            } catch {
              // One student's sync failing should not stop the rest, or
              // the list below from loading at all.
            }
          })
        );
        setPlanSummaries(summaries);

        // This school's own assignments, read after the sync above so a
        // lesson it just generated shows up on this very first load rather
        // than needing a second visit. Without loading them at all, the
        // list below fell back to the sample data for everyone, so a
        // school that had just signed up opened this page to twenty-one
        // invented assignments belonging to a student called "Student".
        const { data: assignmentData, error: assignmentError } = await supabase
          .from("quranic_assignments")
          .select(
            "id, student_id, teacher_id, surah, ayah_start, surah_end, ayah_end, portion, assigned_at, due_date, status, memorization_level, daily_rating, teacher_notes, student_notes, created_at, updated_at"
          )
          .order("assigned_at", { ascending: false });
        if (assignmentError) throw assignmentError;

        setRealAssignments(
          ((assignmentData ?? []) as QuranicAssignment[]).filter((a) => !mine || mine.has(a.student_id))
        );
      } catch (err) {
        console.error("Error loading data:", err);
        setLoadError(
          err instanceof Error
            ? tr("Couldn't load assignments: {message}", { message: err.message })
            : tr("Couldn't load assignments")
        );
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
      // Named individually rather than as one "fill in all required fields":
      // with the student picker at the top of a long form, the field that's
      // actually missing is usually scrolled out of view by the time the
      // message appears.
      const missing = [
        !selectedStudent && (students.length === 0 ? null : "a student"),
        !selectedSurah && "a surah",
        !ayahStart && "the starting ayah",
        !ayahEnd && "the ending ayah",
      ].filter(Boolean) as string[];

      if (!selectedStudent && students.length === 0) {
        throw new Error(
          phrase("There are no students to assign to yet — add them in the admin portal first.")
        );
      }
      if (missing.length > 0) {
        throw new Error(phrase("Still needed: {fields}.", { fields: missing.join(", ") }));
      }

      const surahEndValue = parseInt(spansSurah && endSurah ? endSurah : selectedSurah);

      // The lesson and anything given with it: each extra is checked, and the
      // lesson is due today when others go with it.
      const extraLabel: Record<ExtraKind, string> = { homework: phrase("homework"), recent: phrase("recent revision"), old: phrase("old revision") };
      for (const x of extras) {
        const need = [!x.surah && phrase("surah"), !x.start && phrase("starting ayah"), !x.end && phrase("ending ayah"), !x.due && phrase("due date")].filter(Boolean) as string[];
        if (need.length > 0) throw new Error(phrase("Still needed for the {piece}: {fields}.", { piece: extraLabel[x.kind], fields: need.join(", ") }));
        if (parseInt(x.end) < parseInt(x.start)) throw new Error(phrase("The {piece}'s last ayah comes before its first.", { piece: extraLabel[x.kind] }));
      }
      const lessonDue = extras.length > 0 ? dueDate || todayStr : dueDate;
      const extraPieces = extras.map((x) => ({
        portion: x.kind === "homework" ? portion : (x.kind as "recent" | "old"),
        surah: parseInt(x.surah),
        ayah_start: parseInt(x.start),
        surah_end: parseInt(x.surah),
        ayah_end: parseInt(x.end),
        due_date: x.due,
      }));

      const createdIds: string[] = [];
      // One child, or everyone under the chip that's on.
      const inGroup = students.filter((s) => inFilter(s, gradeFilter));
      const everyone = selectedStudent === EVERYONE && !gradeFilter.startsWith("p:");
      const targets = everyone ? inGroup.map((s) => s.id) : [selectedStudent];
      if (targets.length === 0) throw new Error(phrase("There's no one in this group yet."));
      const groupName = chips.find((c) => c.key === gradeFilter)?.label ?? "";
      const who = everyone
        ? phrase("everyone in {group} ({count})", { group: groupName, count: targets.length })
        : students.find((s) => s.id === selectedStudent)?.full_name ?? "";
      const surahName = getSurahById(parseInt(selectedSurah))?.englishName ?? "";
      const endName = surahEndValue !== parseInt(selectedSurah) ? `${getSurahById(surahEndValue)?.englishName ?? ""} ` : "";
      const savedText =
        phrase("{what} for {who}", { what: `${surahName} ${ayahStart}–${endName}${ayahEnd}`, who }) +
        (extras.length ? ` ${phrase("+ {count} more", { count: extras.length })}` : "");
      const undoable = forWhen !== "not_recited";

      for (const sid of targets) {
      if (isDemo) {
        // No real session to write against — /api/quranic-assignments would
        // correctly 401 here, since it has no school or teacher row to
        // attach the row to. Simulate the write in the browser instead of
        // dead-ending the one workflow a prospective school would want to
        // try first.
        const demoRow = (piece: { rating?: DailyRating; portion?: typeof portion; surah: number; ayah_start: number; surah_end: number; ayah_end: number; due_date: string }): QuranicAssignment => ({
          id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          student_id: sid,
          teacher_id: "t1",
          surah: piece.surah,
          ayah_start: piece.ayah_start,
          surah_end: piece.surah_end,
          ayah_end: piece.ayah_end,
          portion: piece.portion ?? portion,
          // A plain date, not a full timestamp — formatDay elsewhere expects
          // "YYYY-MM-DD" the way every other assigned_at in the app is
          // shaped, and DEMO_TODAY rather than the real clock so a newly
          // created row reads as "today" on the same fixed timeline the
          // rest of the demo data uses instead of the real calendar date.
          assigned_at: DEMO_TODAY,
          due_date: piece.due_date || null,
          status: "assigned",
          memorization_level: 0,
          daily_rating: piece.rating ?? null,
          teacher_notes: notes || null,
          student_notes: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        const created = [
          demoRow({ rating: forWhen === "not_recited" ? "not_recited" : undefined, surah: parseInt(selectedSurah), ayah_start: parseInt(ayahStart), surah_end: surahEndValue, ayah_end: parseInt(ayahEnd), due_date: lessonDue }),
          ...extraPieces.map(demoRow),
        ];
        createdIds.push(...created.map((c) => c.id));
        const next = [...created, ...demoCreated];
        setDemoCreated(next);
        try {
          localStorage.setItem(DEMO_CREATED_KEY, JSON.stringify(next));
        } catch {
          // Private browsing or a full quota — the assignment still shows
          // for this visit, it just won't survive a refresh.
        }
      } else {
        const pieces = [
          { portion, surah: parseInt(selectedSurah), ayah_start: parseInt(ayahStart), surah_end: surahEndValue, ayah_end: parseInt(ayahEnd), due_date: lessonDue },
          ...extraPieces,
        ];
        for (const [i, piece] of pieces.entries()) {
          const res = await fetch("/api/quranic-assignments", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              student_id: sid,
              ...piece,
              portion: piece.portion ?? portion,
              due_date: piece.due_date || null,
              teacher_notes: notes || null,
            }),
          });
          const made = res.ok ? await res.json().catch(() => null) : null;
          if (made?.id) createdIds.push(made.id);
          if (res.ok && i === 0 && forWhen === "not_recited") {
            // Set, but the child didn't recite it: graded straight away, so it is heard another day.
            if (made?.id) {
              await fetch(`/api/quranic-assignments/${made.id}`, {
                method: "PATCH",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ daily_rating: "not_recited", teacher_notes: notes || null }),
              });
              await fetch("/api/recitation-log", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ student_id: sid, ...piece, rating: "not_recited", notes: notes || null }),
              });
            }
          }
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            // If the lesson went in and the homework didn't, say so rather than leave a half-done save.
            throw new Error(i > 0 ? phrase("The first piece was saved, but another wasn't: {error}", { error: data.error || phrase("Failed to create assignment") }) : data.error || phrase("Failed to create assignment"));
          }
        }

        // Re-read so the new assignment appears in the list below straight
        // away. The demo branch above updates its own state in memory; this
        // one had nothing to update until the list started showing real
        // rows, and would otherwise look like the save hadn't worked.
        const { data: refreshed } = await supabase
          .from("quranic_assignments")
          .select(
            "id, student_id, teacher_id, surah, ayah_start, surah_end, ayah_end, portion, assigned_at, due_date, status, memorization_level, daily_rating, teacher_notes, student_notes, created_at, updated_at"
          )
          .order("assigned_at", { ascending: false });
        setRealAssignments((refreshed ?? []) as QuranicAssignment[]);
      }
      }

      // Going through a class: with a group chosen, the next child in it is
      // picked straight away, so the teacher moves down the list.
      const order = inGroup.map((s) => s.id);
      const after = everyone ? null : order[order.indexOf(selectedStudent) + 1] ?? null;
      const nextName = after ? students.find((s) => s.id === after)?.full_name : null;

      setSuccess(true);
      setSaved({
        ids: createdIds,
        text: savedText + (nextName ? ` · ${phrase("Next: {name}", { name: nextName })}` : ""),
        undoable,
        demo: isDemo,
      });
      if (savedTimer.current) clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setSaved(null), 10000);
      setShowNote(false);
      setAutoFilledFor(null);
      setSelectedStudent(gradeFilter && after ? after : "");
      setPortion("new");
      setSelectedSurah("");
      setAyahStart("");
      setAyahEnd("");
      setSpansSurah(false);
      setEndSurah("");
      setDueDate("");
      setForWhen("today");
      setExtras([]);
      setNotes("");

      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? tr(err.message) : tr("Unknown error"));
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

  useEffect(() => {
    if (!selectedStudent || selectedStudent === EVERYONE || isDemo) {
      setLastPosition(null);
      setDirectionKnown(false);
      return;
    }
    let cancelled = false;
    setLastPosition(null);
    setLastSurahName("");
    setDirectionKnown(false);
    fetch(`/api/quran-position?student_id=${encodeURIComponent(selectedStudent)}`)
      .then((r) => r.json())
      .then((b) => {
        if (cancelled) return;
        if (b?.direction) {
          setDirection(b.direction);
          setDirectionKnown(true);
        }
        if (b?.position) {
          setLastPosition(b.position);
          setPositionFor(selectedStudent);
          setLastSurahName(getSurahById(b.position.surah)?.englishName ?? b.surah_name ?? "");
        }
      })
      // Losing the suggestion costs the shortcut, not the form — every
      // field below still works by hand, so this is not worth an error
      // banner over a page the teacher can use regardless.
      .catch(() => {})
      .finally(() => { if (!cancelled) setDirectionKnown((k) => k || true); });
    return () => { cancelled = true; };
  }, [selectedStudent, isDemo]);

  /** Re-fetching a student's own list also re-triggers the server's catch-up
   *  generation for them (see /api/quranic-assignments and
   *  autoAssignments.ts) — which is exactly what should happen right after
   *  a surah confirmation clears the one thing that was holding it back. */
  const syncOneStudent = async (studentId: string) => {
    try {
      const r = await fetch(`/api/quranic-assignments?student_id=${encodeURIComponent(studentId)}`);
      const b = await r.json();
      setPlanSummaries((prev) => {
        const next = { ...prev };
        if (b?.plan_summary) next[studentId] = b.plan_summary;
        else delete next[studentId];
        return next;
      });
    } catch {
      // Losing this costs the banner, not the page — assignments still
      // load and can still be set by hand.
    }
  };

  const refreshDemoPlans = () => {
    const { lessons, summaries } = demoSyncPlans();
    setDemoPlanLessons(
      [...lessons].sort((x, y) => (y.due_date ?? "").localeCompare(x.due_date ?? ""))
    );
    setPlanSummaries(summaries);
    setDemoPlanStudentIds(demoPlanStudents());
  };

  const refreshAssignments = async () => {
    const { data: refreshed } = await supabase
      .from("quranic_assignments")
      .select(
        "id, student_id, teacher_id, surah, ayah_start, surah_end, ayah_end, portion, assigned_at, due_date, status, memorization_level, daily_rating, teacher_notes, student_notes, created_at, updated_at"
      )
      .order("assigned_at", { ascending: false });
    setRealAssignments((refreshed ?? []) as QuranicAssignment[]);
  };

  const confirmSurah = async (studentId: string, surah: number) => {
    const key = `${studentId}:${surah}`;
    if (isDemo) {
      demoConfirmSurah(studentId, surah);
      refreshDemoPlans();
      return;
    }
    setConfirmingSurah(key);
    try {
      await fetch("/api/surah-confirmations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_id: studentId, surah }),
      });
      // The lesson that was waiting on this can now be generated.
      await syncOneStudent(studentId);
      await refreshAssignments();
    } catch {
      // The confirmation may or may not have gone through; the banner
      // simply stays until the next successful load resolves it either
      // way, rather than guessing here.
    } finally {
      setConfirmingSurah((k) => (k === key ? null : k));
    }
  };

  const saveDirection = async (next: Direction) => {
    setDirection(next);
    if (!selectedStudent || selectedStudent === EVERYONE || isDemo) return;
    setSavingDirection(true);
    try {
      await fetch("/api/quran-position", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_id: selectedStudent, direction: next }),
      });
    } catch {
      // Same reasoning as above: the choice still applies to this form.
    } finally {
      setSavingDirection(false);
    }
  };

  /** Where the next lesson starts — the ayah after the last one recorded,
   *  which in "An-Nas and up" order may be the start of the *previous*
   *  surah. */
  const resumeAt = lastPosition ? nextPosition(lastPosition, direction) : null;

  /** Fills the fields below with the next portion, the same way the juz'
   *  quick-fill does for muraajah. */
  const applyNextPortion = () => {
    if (!resumeAt) return;
    const count = Math.max(1, Math.min(300, parseInt(nextCount, 10) || 1));
    const blocks = walk(resumeAt, direction, count);
    if (blocks.length === 0) return;
    const first = blocks[0];
    const last = blocks[blocks.length - 1];
    setSelectedSurah(String(first.from_surah));
    setPreviewBy("surah");
    setAyahStart(String(first.from_ayah));
    setAyahEnd(String(last.to_ayah));
    // A portion that runs into a second surah has to say so, or the end
    // ayah would be read against the wrong surah's length.
    if (last.to_surah !== first.from_surah) {
      setSpansSurah(true);
      setEndSurah(String(last.to_surah));
    } else {
      setSpansSurah(false);
      setEndSurah("");
    }
  };

  // The new lesson fills itself in from where the child stopped, as soon as
  // that's known — the teacher only changes it when today is different.
  useEffect(() => {
    if (portion !== "new" || !selectedStudent || positionFor !== selectedStudent || !resumeAt || selectedSurah || ayahStart) return;
    applyNextPortion();
    setAutoFilledFor(selectedStudent);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portion, selectedStudent, positionFor, lastPosition, direction]);

  // Pages to ayahs: from the first ayah of the first page to the last ayah
  // of the last (the Madinah mushaf never splits an ayah across pages).
  const applyPageRange = () => {
    const first = Math.max(1, Math.min(TOTAL_PAGES, parseInt(pageFrom) || 0));
    if (!parseInt(pageFrom)) return;
    const last = Math.max(first, Math.min(TOTAL_PAGES, parseInt(pageTo) || first));
    const [s1, a1] = PAGE_STARTS[first - 1];
    let sEnd = 114;
    let aEnd = getSurahById(114)?.ayahs ?? 6;
    if (last < TOTAL_PAGES) {
      const [ns, na] = PAGE_STARTS[last];
      if (na > 1) {
        sEnd = ns;
        aEnd = na - 1;
      } else {
        sEnd = ns - 1;
        aEnd = getSurahById(sEnd)?.ayahs ?? 1;
      }
    }
    setPageFrom(String(first));
    setPageTo(String(last));
    setSelectedSurah(String(s1));
    setPreviewBy("surah");
    setAyahStart(String(a1));
    setAyahEnd(String(aEnd));
    if (sEnd !== s1) {
      setSpansSurah(true);
      setEndSurah(String(sEnd));
    } else {
      setSpansSurah(false);
      setEndSurah("");
    }
  };

  // Hizbs or quarters of a hizb to ayahs: from where the first begins to
  // the ayah before the one after the last.
  const applyHizbRange = () => {
    const hizb = Math.max(1, Math.min(60, parseInt(hizbStart) || 1));
    const startQuarter = (hizb - 1) * 4 + (Math.max(1, Math.min(4, parseInt(hizbQuarter) || 1)) - 1);
    const wanted = Math.max(1, parseInt(hizbCount) || 1) * (hizbUnit === "hizb" ? 4 : 1);
    const next = Math.min(240, startQuarter + wanted); // index of the quarter after the last one asked for
    const [s1, a1] = RUB_STARTS[startQuarter];
    let sEnd = 114;
    let aEnd = getSurahById(114)?.ayahs ?? 6;
    if (next < 240) {
      const [ns, na] = RUB_STARTS[next];
      if (na > 1) {
        sEnd = ns;
        aEnd = na - 1;
      } else {
        sEnd = ns - 1;
        aEnd = getSurahById(sEnd)?.ayahs ?? 1;
      }
    }
    setSelectedSurah(String(s1));
    setPreviewBy("surah");
    setAyahStart(String(a1));
    setAyahEnd(String(aEnd));
    if (sEnd !== s1) {
      setSpansSurah(true);
      setEndSurah(String(sEnd));
    } else {
      setSpansSurah(false);
      setEndSurah("");
    }
  };

  const applyJuzRange = () => {
    const range = getJuzRange(parseInt(juzStart), parseInt(juzCount) || 1, (s) => getSurahById(s)?.ayahs ?? 0);
    setSelectedSurah(String(range.surahStart));
    setPreviewBy("surah");
    setAyahStart(String(range.ayahStart));
    setAyahEnd(String(range.ayahEnd));
    if (range.surahEnd !== range.surahStart) {
      setSpansSurah(true);
      setEndSurah(String(range.surahEnd));
    } else {
      setSpansSurah(false);
      setEndSurah("");
    }
  };

  // Today on this device (the sample school keeps its own fixed day).
  const todayStr = isDemo ? DEMO_TODAY : new Date().toLocaleDateString("en-CA");
  const dayAfter = (iso: string) => {
    const d = new Date(`${iso}T12:00:00`);
    d.setDate(d.getDate() + 1);
    return d.toLocaleDateString("en-CA");
  };
  // Takes back what was just saved.
  const undoSaved = async () => {
    if (!saved) return;
    setUndoing(true);
    try {
      if (saved.demo) {
        const next = demoCreated.filter((a) => !saved.ids.includes(a.id));
        setDemoCreated(next);
        try {
          localStorage.setItem(DEMO_CREATED_KEY, JSON.stringify(next));
        } catch {
          /* Still gone for this visit. */
        }
      } else {
        for (const id of saved.ids) {
          const res = await fetch(`/api/quranic-assignments/${id}`, { method: "DELETE" });
          if (!res.ok) {
            const b = await res.json().catch(() => ({}));
            throw new Error(b.error ?? "Couldn't undo that. Please try again.");
          }
        }
        setRealAssignments((list) => list.filter((a) => !saved.ids.includes(a.id)));
      }
      if (savedTimer.current) clearTimeout(savedTimer.current);
      setSaved(null);
    } catch (e) {
      setSaved((now) => (now ? { ...now, text: e instanceof Error ? tr(e.message) : tr("Couldn't undo that. Please try again."), undoable: false } : now));
    } finally {
      setUndoing(false);
    }
  };

  // Opened from My halaqas on one child (?student=…) or a whole halaqa
  // (?group=…): pick them once the list has arrived.
  const linked = useRef(false);
  useEffect(() => {
    if (linked.current || students.length === 0) return;
    const q = new URLSearchParams(window.location.search);
    const sid = q.get("student");
    const group = q.get("group");
    if (!sid && !group) {
      linked.current = true;
      return;
    }
    if (group?.startsWith("p:") && programs.length === 0) return; // still arriving
    linked.current = true;
    if (group) setGradeFilter(group);
    if (sid && students.some((s) => s.id === sid)) {
      setSelectedStudent(sid);
      if (!group) {
        // Under the chip that holds them: their Hifd class if they're in one.
        const prog = programs.find((p) => p.studentIds.includes(sid));
        setGradeFilter(prog ? `p:${prog.id}` : "");
      }
    }
  }, [students, programs]);

  // Adds a second piece to the same save — homework starts where today's lesson ends.
  const addExtra = (k: ExtraKind) => {
    const next = parseInt(ayahEnd) + 1;
    const sameSurah = selectedSurah && !spansSurah;
    setExtras((list) =>
      list.some((x) => x.kind === k)
        ? list
        : [
            ...list,
            {
              kind: k,
              surah: k === "homework" ? selectedSurah : "",
              start: k === "homework" && sameSurah && next && next <= (selectedSurahData?.ayahs ?? 0) ? String(next) : "",
              end: "",
              due: k === "homework" ? dayAfter(todayStr) : todayStr,
            },
          ]
    );
    if (!dueDate) setDueDate(todayStr);
    setForWhen("today");
  };
  // Today's lesson and homework go together: with today's lesson on, Homework
  // adds a homework piece beside it (and a second tap takes it away) rather
  // than turning today's lesson off.
  const tapWhen = (w: "today" | "homework" | "not_recited") => {
    if (w === "homework" && forWhen === "today") {
      if (extras.some((x) => x.kind === "homework")) setExtras((l) => l.filter((x) => x.kind !== "homework"));
      else addExtra("homework");
      return;
    }
    if (w !== "today") setExtras((l) => l.filter((x) => x.kind !== "homework"));
    chooseWhen(w);
  };
  const chooseWhen = (w: "today" | "homework" | "not_recited") => {
    setForWhen(w);
    // Today's lesson is due today; homework is due a day on, unless a later day is already chosen.
    setDueDate(w !== "homework" ? todayStr : dueDate && dueDate > todayStr ? dueDate : dayAfter(todayStr));
  };
  // What a set piece of work is: today's, homework, or overdue — read off its dates.
  const whenOf = (a: QuranicAssignment): { text: string; tone: string } | null => {
    if (a.status === "completed") return null;
    const set = (a.assigned_at ?? "").slice(0, 10);
    if (a.due_date) {
      if (a.due_date === todayStr) return { text: tr("Today"), tone: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200" };
      if (a.due_date > todayStr) return { text: tr("Homework"), tone: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200" };
      return { text: tr("Overdue"), tone: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200" };
    }
    if (set === todayStr) return { text: tr("Today"), tone: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200" };
    return set ? { text: tr("Set {day}", { day: formatDay(set, language) }), tone: "bg-slate-100 text-slate-700 dark:bg-slate-800/50 dark:text-slate-200" } : null;
  };

  // The preview opens the moment there's something to show: a surah picked
  // (on its first page, or the start ayah's page once that's in) or a page
  // number typed. The highlight waits for both ayahs.
  const typedPage = parseInt(pageFrom);
  const previewPage =
    previewBy === "page" && typedPage >= 1 && typedPage <= TOTAL_PAGES
      ? typedPage
      : selectedSurah
        ? pageOfPosition({ surah: parseInt(selectedSurah), ayah: parseInt(ayahStart) || 1 })
        : null;
  const canPreview = previewPage !== null;
  const canHighlight = Boolean(selectedSurah && ayahStart && ayahEnd);

  // Newest first, so an assignment just created shows at the top of the list
  // below rather than getting lost among the rest. The sample assignments
  // belong to demo mode only — a real school sees its own work or an empty
  // list, never invented rows attributed to its teachers.
  const allAssignments = (
    isDemo
      ? [
          ...demoCreated,
          ...demoPlanLessons,
          ...DEMO_ASSIGNMENTS.filter(
            (a) => !(a.portion === "new" && demoPlanStudentIds.has(a.student_id))
          ),
        ]
      : realAssignments
  ).map((a) => withOverride(a, overrides));

  // The list, one group per halaqa (with its grade, where the school has them),
  // so a teacher with several halaqas grades one at a time.
  const NO_PLACE = "\u0000";
  const groupNames = [...new Set(allAssignments.map((a) => placeOf[a.student_id] ?? NO_PLACE))].sort((x, y) =>
    x === NO_PLACE ? 1 : y === NO_PLACE ? -1 : x.localeCompare(y, undefined, { numeric: true })
  );
  const groups = groupNames
    .filter((g) => !listGroup || g === listGroup)
    .map((g) => ({ name: g, items: allAssignments.filter((a) => (placeOf[a.student_id] ?? NO_PLACE) === g) }));

  // One entry per child in a group, in name order, with their pieces of work.
  const studentsOf = (items: QuranicAssignment[]) => {
    const byStudent = new Map<string, QuranicAssignment[]>();
    for (const a of items) byStudent.set(a.student_id, [...(byStudent.get(a.student_id) ?? []), a]);
    return [...byStudent.entries()]
      .map(([id, list]) => ({ id, name: studentName(id, roster), items: list }))
      .sort((x, y) => x.name.localeCompare(y.name));
  };

  const startEditing = (a: QuranicAssignment) => {
    setEditingId(a.id === editingId ? null : a.id);
    setDraftRating(a.daily_rating);
    setDraftNotes(a.teacher_notes ?? "");
  };

  // `quick` grades a piece straight from its row — "Did not recite" — leaving its note alone.
  const saveEdit = async (a: QuranicAssignment, quick?: DailyRating) => {
    const rating = quick !== undefined ? quick : draftRating;
    const noteText = quick !== undefined ? a.teacher_notes ?? null : draftNotes.trim() || null;
    setSavingEdit(true);
    const patch: AssignmentOverride = {
      daily_rating: rating,
      teacher_notes: noteText,
    };
    try {
      if (isDemo && isDemoPlanLesson(a.id)) {
        // A plan lesson: rated the way the live site rates one, which also
        // carries it through to the student's yearly plan.
        demoGradePlanLesson(a.id, rating, noteText);
        refreshDemoPlans();
      } else if (isDemo) {
        // The rating settles the status too, the same as on the live site.
        const next = {
          ...overrides,
          [a.id]: { ...overrides[a.id], ...patch, status: statusForRating(rating) },
        };
        setOverrides(next);
        writeDemoStore(OVERRIDES_KEY, next);
      }
      if (isDemo) {
        // A rating turns into today's entry in the history log — replacing
        // today's entry for this same portion if one already exists, rather
        // than piling up duplicates from re-grading the same session.
        if (rating) {
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
              rating: rating,
              notes: noteText,
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
        if (rating) {
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
              rating: rating,
              notes: noteText,
            }),
          });
        }
        // The rating also moves the lesson's status, and for a lesson from
        // the yearly plan, the plan's own progress — so re-read both rather
        // than leaving the row on its old status and a behind-schedule
        // banner up that the lesson just cleared.
        await Promise.all([refreshAssignments(), syncOneStudent(a.student_id)]);
      }
      setEditingId(null);
    } finally {
      setSavingEdit(false);
    }
  };

  // The grades among this teacher's students, lowest first — the chips
  // above the student list, shown only when there's more than one.
  const grades = graded
    ? [...new Set(students.map((s) => s.grade).filter(isGradeNum))].sort((x, y) => x - y)
    : [];
  // Whether a student falls under the chip that's on: a grade, or a Hifd class.
  const inFilter = (s: Student, key: string) => {
    if (!key) return true;
    if (key.startsWith("p:")) return programs.find((p) => `p:${p.id}` === key)?.studentIds.includes(s.id) ?? false;
    return String(s.grade) === key;
  };
  const chips = [
    ...grades.map((g) => ({ key: String(g), label: gradeLabel(g), count: students.filter((s) => s.grade === g).length })),
    ...programs.map((p) => ({ key: `p:${p.id}`, label: p.name, count: students.filter((s) => p.studentIds.includes(s.id)).length })),
  ];

  return (
    <div className="max-w-6xl mx-auto pb-20 space-y-4 pt-2">
      <PortalHero
        eyebrow={tr("Set work")}
        title={tr("Assignments")}
        meta={[
          tr("{count} student|{count} students", { count: students.length }),
          tr("{count} set this term", { count: allAssignments.length }),
        ]}
      />

      {Object.entries(planSummaries).flatMap(([studentId, summary]) => {
        const studentLabel = students.find((s) => s.id === studentId)?.full_name ?? tr("A student");
        return summary.alerts.map((a) => (
          <PlanAlertBanner
            key={`${studentId}:${a.code}`}
            level={a.level}
            title={`${studentLabel}: ${translateAlert(a).title}`}
            detail={translateAlert(a).detail}
          />
        ));
      })}

      {Object.entries(planSummaries).map(([studentId, summary]) => {
        if (!summary.pending_confirmation) return null;
        const studentLabel = students.find((s) => s.id === studentId)?.full_name ?? tr("A student");
        const { surah } = summary.pending_confirmation;
        const surah_name = getSurahById(surah)?.englishName ?? summary.pending_confirmation.surah_name;
        const key = `${studentId}:${surah}`;
        return (
          <div
            key={key}
            role="alert"
            className="rounded-[18px] border px-5 py-4 flex items-start gap-3.5"
            style={{ borderColor: "#b8860b44", background: "#b8860b0f" }}
          >
            <span aria-hidden className="w-[3px] self-stretch rounded-full bg-amber-600" />
            <AlertGlyph colour="#b8860b" />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-bold tracking-tight text-amber-700">
                {tr("{studentLabel} has reached the end of {surah_name} — test the whole surah", { studentLabel, surah_name })}
              </p>
              <p className="text-[13px] text-ink-body mt-1 leading-relaxed">
                {tr("Once {studentLabel} has recited all of {surah_name} to you, confirm it here. The next lesson won't be scheduled until you do.", { studentLabel, surah_name })}
              </p>
              {/* Under the words rather than beside them, so on a phone the
                  message keeps the card's full width. */}
              <button
                type="button"
                onClick={() => confirmSurah(studentId, surah)}
                disabled={confirmingSurah === key}
                className="mt-2.5 text-[11px] font-bold uppercase tracking-[0.1em] text-amber-700 hover:text-amber-900 disabled:opacity-40 border border-amber-600/40 rounded-full px-3 py-1.5"
              >
                {confirmingSurah === key ? tr("Saving…") : tr("Confirm tested")}
              </button>
            </div>
          </div>
        );
      })}

      <div className="grid lg:grid-cols-2 gap-4 items-start">
        {/* Form */}
        <form onSubmit={handleSubmit} className="card-quiet p-5 space-y-5">
          <div>
            <label className="block text-sm font-semibold text-ink mb-2">
              {tr("Student *")}
            </label>
            {chips.length > 1 && (
              <div className="flex flex-wrap gap-2 mb-3" role="group" aria-label={tr("Grade")}>
                {[{ key: "", label: tr("All"), count: students.length }, ...chips].map((chip) => {
                  const on = gradeFilter === chip.key;
                  return (
                    <button
                      key={chip.key || "all"}
                      type="button"
                      aria-pressed={on}
                      onClick={() => {
                        setGradeFilter(chip.key);
                        const picked = students.find((s) => s.id === selectedStudent);
                        if (selectedStudent === EVERYONE || (chip.key && picked && !inFilter(picked, chip.key))) setSelectedStudent("");
                      }}
                      className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-semibold border transition ${
                        on
                          ? "bg-brand-navy text-white border-brand-navy dark:bg-brand-gold dark:text-[#20180a] dark:border-brand-gold"
                          : "bg-surface-card text-ink border-surface-border hover:border-brand-navy/40"
                      }`}
                    >
                      {chip.label}
                      <span className={on ? "opacity-70" : "text-ink-muted"}>{chip.count}</span>
                    </button>
                  );
                })}
              </div>
            )}
            <select
              value={selectedStudent}
              onChange={(e) => setSelectedStudent(e.target.value)}
              className="w-full bg-surface-card border border-surface-border rounded-2xl px-4 py-3 text-ink focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/40 transition"
            >
              <option value="">{tr("Select a student")}</option>
              {/* Only for a grade, where the class learns the same surah together —
                  never a Hifd class, where every child is at their own place. */}
              {gradeFilter && !gradeFilter.startsWith("p:") && students.some((s) => inFilter(s, gradeFilter)) && (
                <option value={EVERYONE}>
                  {tr("Everyone in {group} ({count})", {
                    group: chips.find((c) => c.key === gradeFilter)?.label ?? "",
                    count: students.filter((s) => inFilter(s, gradeFilter)).length,
                  })}
                </option>
              )}
              {grades.length > 1 && !gradeFilter
                ? [...grades, null].map((g) => {
                    const inGrade = students.filter((s) => (g === null ? !isGradeNum(s.grade) : s.grade === g));
                    return inGrade.length === 0 ? null : (
                      <optgroup key={g ?? "none"} label={g === null ? tr("No grade") : gradeLabel(g)}>
                        {inGrade.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.full_name}
                          </option>
                        ))}
                      </optgroup>
                    );
                  })
                : students
                    .filter((s) => inFilter(s, gradeFilter))
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.full_name}
                      </option>
                    ))}
            </select>
            {/* Going down the class one child at a time. */}
            {(() => {
              if (!gradeFilter || !selectedStudent || selectedStudent === EVERYONE) return null;
              const order = students.filter((s) => inFilter(s, gradeFilter));
              const at = order.findIndex((s) => s.id === selectedStudent);
              const next = order[at + 1];
              return (
                <div className="flex items-center justify-between gap-3 mt-2 text-[12.5px]">
                  <span className="text-ink-muted tabular-nums">
                    {tr("{n} of {count} in {group}", { n: at + 1, count: order.length, group: chips.find((c) => c.key === gradeFilter)?.label ?? "" })}
                  </span>
                  {next && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedStudent(next.id);
                        setSelectedSurah("");
                        setAyahStart("");
                        setAyahEnd("");
                        setSpansSurah(false);
                        setEndSurah("");
                        setAutoFilledFor(null);
                      }}
                      className="font-semibold text-brand-navy dark:text-brand-gold hover:underline"
                    >
                      {tr("Skip to {name} →", { name: next.full_name })}
                    </button>
                  )}
                </div>
              );
            })()}
            {selectedStudent === EVERYONE && (
              <p className="text-[12px] text-ink-muted mt-2">{tr("The same work goes to every child in this group, each as their own assignment.")}</p>
            )}
          </div>

          {/* Which of the three daily portions. Defaults to the new lesson,
              which is the one most often being set. */}
          <div>
            <label className="block text-sm font-semibold text-ink mb-2">
              {tr("Portion *")}
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

          {/* The new lesson's mirror of the juz' quick-fill below: rather
              than a quantity of revision, it is "carry on from where they
              stopped". Which way that goes is the student's own setting,
              shared with the yearly plan. */}
          {portion === "new" && !isDemo && selectedStudent && selectedStudent !== EVERYONE && (
            <div className="rounded-2xl border border-brand-navy/25 bg-brand-navy/[.04] dark:bg-white/[.03] p-3.5">
              <p className="text-sm font-semibold text-ink mb-2">{tr("Continue from their last lesson")}</p>

              <label className="block">
                <span className="block text-[11px] text-ink-muted mb-1">
                  {tr("Works through the mushaf")}
                </span>
                <select
                  value={direction}
                  onChange={(e) => saveDirection(e.target.value as Direction)}
                  disabled={savingDirection}
                  className="w-full bg-surface-card border border-surface-border rounded-xl px-3 py-2.5 text-sm text-ink focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/40 transition disabled:opacity-50"
                >
                  {(["hifz", "forward"] as const).map((d) => (
                    <option key={d} value={d}>
                      {DIRECTION_LABEL[d]}
                    </option>
                  ))}
                </select>
              </label>
              <p className="text-[11px] text-ink-muted mt-1.5">
                {tr("{DIRECTION_HINT} Saved on the student, so the yearly plan uses the same order.", { DIRECTION_HINT: DIRECTION_HINT[direction] })}
              </p>

              {lastPosition ? (
                <>
                  <div className="flex items-end gap-2 mt-3">
                    <label className="w-28 flex-shrink-0">
                      <span className="block text-[11px] text-ink-muted mb-1">{tr("Ayahs")}</span>
                      <input
                        type="number"
                        min="1"
                        max="300"
                        value={nextCount}
                        onChange={(e) => setNextCount(e.target.value)}
                        className="w-full bg-surface-card border border-surface-border rounded-xl px-3 py-2.5 text-sm text-ink text-center tabular-nums focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/40 transition"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={applyNextPortion}
                      disabled={!resumeAt}
                      className="flex-shrink-0 px-4 py-2.5 rounded-xl bg-brand-navy text-white text-sm font-semibold hover:opacity-90 active:scale-[.98] disabled:opacity-40 transition-all"
                    >
                      {tr("Apply")}
                    </button>
                  </div>
                  <p className="text-[11px] text-ink-muted mt-2">
                    {tr("Last recorded:")}{" "}<span className="font-semibold text-ink">
                      {getSurahById(lastPosition.surah)?.englishName ?? lastSurahName} {lastPosition.ayah}
                    </span>
                    {resumeAt ? (
                      <>
                        {" "}{tr("· next starts at")}{" "}
                        <span className="font-semibold text-ink">{formatPosition(resumeAt)}</span>
                      </>
                    ) : (
                      tr(" · nothing follows it in this direction")
                    )}
                  </p>
                  {autoFilledFor === selectedStudent && selectedSurah && (
                    <p className="text-[12px] font-semibold text-emerald-700 dark:text-emerald-400 mt-1.5">
                      {tr("✓ Today's lesson is filled in below from where they stopped. Change it if today is different.")}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-[11px] text-ink-muted mt-3">
                  {directionKnown
                    ? tr("No new-lesson assignments on file yet, so there is nothing to continue from. Set the surah and ayahs below.")
                    : tr("Checking their recorded lessons…")}
                </p>
              )}
            </div>
          )}

          {/* By mushaf pages, for any portion: "page 562 to 563" instead of
              working out which surah and ayahs those are. For the new lesson
              it waits behind a link: most days the surah and ayahs are
              already filled in from where the child stopped. */}
          {portion === "new" && !moreWays ? (
            <button
              type="button"
              onClick={() => setMoreWays(true)}
              className="text-[13px] font-semibold text-brand-navy dark:text-brand-gold hover:underline"
            >
              {tr("+ Set by mushaf pages instead")}
            </button>
          ) : (
          <div className="rounded-2xl border border-brand-navy/20 bg-brand-navy/5 dark:border-brand-gold/25 dark:bg-brand-gold/5 p-3.5">
            <p className="text-sm font-semibold text-ink mb-2">{tr("Or set by pages")}</p>
            <div className="flex items-end gap-2">
              <label className="flex-1 min-w-0">
                <span className="block text-[11px] text-ink-muted mb-1">{tr("From page")}</span>
                <input
                  type="number"
                  min="1"
                  max={TOTAL_PAGES}
                  value={pageFrom}
                  onChange={(e) => {
                    setPageFrom(e.target.value);
                    setPreviewBy("page");
                  }}
                  placeholder="562"
                  className="w-full bg-surface-card border border-surface-border rounded-xl px-3 py-2.5 text-sm text-ink tabular-nums focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/40 transition"
                />
              </label>
              <label className="flex-1 min-w-0">
                <span className="block text-[11px] text-ink-muted mb-1">{tr("To page")}</span>
                <input
                  type="number"
                  min="1"
                  max={TOTAL_PAGES}
                  value={pageTo}
                  onChange={(e) => {
                    setPageTo(e.target.value);
                    setPreviewBy("page");
                  }}
                  placeholder={pageFrom || "563"}
                  className="w-full bg-surface-card border border-surface-border rounded-xl px-3 py-2.5 text-sm text-ink tabular-nums focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/40 transition"
                />
              </label>
              <button
                type="button"
                onClick={applyPageRange}
                disabled={!parseInt(pageFrom)}
                className="flex-shrink-0 px-4 py-2.5 rounded-xl bg-brand-navy text-white text-sm font-semibold hover:opacity-90 active:scale-[.98] disabled:opacity-40 transition-all"
              >
                {tr("Apply")}
              </button>
            </div>
            <p className="text-[11px] text-ink-muted mt-2">
              {tr("Fills in the surah and ayahs below from the pages of the Madinah mushaf (1 to {total}). A page can start or end partway through a surah.", { total: TOTAL_PAGES })}
            </p>
          </div>
          )}

          {/* Muraajah is usually set as a quantity — a juz', two juz' —
              rather than by hunting down exact ayah numbers, so give that
              as a quick-fill on top of the manual fields below. Not shown
              for the new lesson, which is a small daily portion picked by
              surah and ayah, not by the juz'. */}
          {portion !== "new" && (
            <div className="rounded-2xl border border-brand-gold/35 bg-brand-gold/8 p-3.5">
              <p className="text-sm font-semibold text-ink mb-2">{tr("Or set by juz'")}</p>
              <div className="flex items-end gap-2">
                <label className="flex-1 min-w-0">
                  <span className="block text-[11px] text-ink-muted mb-1">{tr("Starting juz'")}</span>
                  <select
                    value={juzStart}
                    onChange={(e) => setJuzStart(e.target.value)}
                    className="w-full bg-surface-card border border-surface-border rounded-xl px-3 py-2.5 text-sm text-ink focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/40 transition"
                  >
                    {JUZ_STARTS.map((j) => (
                      <option key={j.juz} value={j.juz}>
                        {tr("Juz {juz}", { juz: j.juz })}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="w-20 flex-shrink-0">
                  <span className="block text-[11px] text-ink-muted mb-1">{tr("Juz' count")}</span>
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
                  {tr("Apply")}
                </button>
              </div>
              <p className="text-[11px] text-ink-muted mt-2">
                {tr("Fills in the surah and ayahs below — a juz' rarely lines up with a surah's edges, so this often spans more than one.")}
              </p>
            </div>
          )}

          {/* And in hizbs: half a juz', the other way muraajah is counted. */}
          {portion !== "new" && (
            <div className="rounded-2xl border border-teal-600/25 bg-teal-50/60 dark:bg-teal-950/20 p-3.5">
              <p className="text-sm font-semibold text-ink mb-2">{tr("Or set by hizb or quarter")}</p>
              <div className="grid grid-cols-2 gap-2">
                <label className="min-w-0">
                  <span className="block text-[11px] text-ink-muted mb-1">{tr("Starting hizb")}</span>
                  <select
                    value={hizbStart}
                    onChange={(e) => setHizbStart(e.target.value)}
                    className="w-full bg-surface-card border border-surface-border rounded-xl px-3 py-2.5 text-sm text-ink focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/40 transition"
                  >
                    {HIZB_STARTS.map((_, i) => (
                      <option key={i} value={i + 1}>
                        {tr("Hizb {hizb} (Juz {juz})", { hizb: i + 1, juz: Math.floor(i / 2) + 1 })}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="min-w-0">
                  <span className="block text-[11px] text-ink-muted mb-1">{tr("Starting at")}</span>
                  <select
                    value={hizbQuarter}
                    onChange={(e) => setHizbQuarter(e.target.value)}
                    className="w-full bg-surface-card border border-surface-border rounded-xl px-3 py-2.5 text-sm text-ink focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/40 transition"
                  >
                    <option value="1">{tr("The start of the hizb")}</option>
                    <option value="2">{tr("The 2nd quarter (¼ in)")}</option>
                    <option value="3">{tr("The 3rd quarter (half way)")}</option>
                    <option value="4">{tr("The 4th quarter (¾ in)")}</option>
                  </select>
                </label>
              </div>
              <div className="flex items-end gap-2 mt-2">
                <label className="w-20 flex-shrink-0">
                  <span className="block text-[11px] text-ink-muted mb-1">{tr("How many")}</span>
                  <input
                    type="number"
                    min="1"
                    max="240"
                    value={hizbCount}
                    onChange={(e) => setHizbCount(e.target.value)}
                    className="w-full bg-surface-card border border-surface-border rounded-xl px-3 py-2.5 text-sm text-ink text-center tabular-nums focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/40 transition"
                  />
                </label>
                <label className="flex-1 min-w-0">
                  <span className="block text-[11px] text-ink-muted mb-1">{tr("Counted in")}</span>
                  <select
                    value={hizbUnit}
                    onChange={(e) => setHizbUnit(e.target.value as "hizb" | "quarter")}
                    className="w-full bg-surface-card border border-surface-border rounded-xl px-3 py-2.5 text-sm text-ink focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/40 transition"
                  >
                    <option value="hizb">{tr("Hizbs")}</option>
                    <option value="quarter">{tr("Quarters of a hizb")}</option>
                  </select>
                </label>
                <button
                  type="button"
                  onClick={applyHizbRange}
                  className="flex-shrink-0 px-4 py-2.5 rounded-xl bg-brand-navy text-white text-sm font-semibold hover:opacity-90 active:scale-[.98] transition-all"
                >
                  {tr("Apply")}
                </button>
              </div>
              <p className="text-[11px] text-ink-muted mt-2">
                {tr("Fills in the surah and ayahs below. A hizb is half a juz' and has four quarters.")}
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-ink mb-2">
              {tr("Surah *")}
            </label>
            {/* Type to find it — "mulk", "67", "الملك" — and the preview
                opens on the surah straight away. */}
            <SurahPicker
              value={selectedSurah}
              onChange={(id) => {
                setSelectedSurah(id);
                setSpansSurah(false);
                setEndSurah("");
                setPreviewBy("surah");
              }}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-ink mb-2">
                {tr("Ayah Start *")}
              </label>
              <input
                type="number"
                min="1"
                max={maxAyahs}
                value={ayahStart}
                onChange={(e) => {
                  setAyahStart(e.target.value);
                  setPreviewBy("surah");
                }}
                placeholder="1"
                className="w-full bg-surface-card border border-surface-border rounded-2xl px-4 py-3 text-ink focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/40 transition"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-ink mb-2">
                {tr("Ayah End *")}
              </label>
              <input
                type="number"
                min="1"
                max={maxAyahsEnd}
                value={ayahEnd}
                onChange={(e) => {
                  setAyahEnd(e.target.value);
                }}
                placeholder={maxAyahsEnd.toString()}
                className="w-full bg-surface-card border border-surface-border rounded-2xl px-4 py-3 text-ink focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/40 transition"
              />
            </div>
          </div>
          {maxAyahs > 0 && !spansSurah && (
            <p className="text-xs text-ink-muted">
              {tr("This Surah has {maxAyahs} Ayahs", { maxAyahs })}
            </p>
          )}
          {selectedSurah && parseInt(ayahStart) > 0 && parseInt(ayahEnd) > 0 && effectiveEndSurahId > 0 && (
            <p className="text-xs font-semibold text-brand-navy dark:text-brand-gold">
              {pageLabel(
                { surah: parseInt(selectedSurah), ayah: parseInt(ayahStart) },
                { surah: effectiveEndSurahId, ayah: parseInt(ayahEnd) }
              )}
            </p>
          )}

          {/* Multiple surahs, manually: for a lesson or muraajah that
              simply doesn't line up with the quantity picker above. */}
          {selectedSurah &&
            (spansSurah ? (
              <div className="rounded-2xl border border-surface-border bg-surface-bg-warm p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-ink">{tr("Ends in surah")}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setSpansSurah(false);
                      setEndSurah("");
                    }}
                    className="text-[11px] font-semibold text-ink-muted hover:text-ink transition-colors"
                  >
                    {tr("Remove")}
                  </button>
                </div>
                <select
                  value={endSurah || selectedSurah}
                  onChange={(e) => {
                    setEndSurah(e.target.value);
                  }}
                  className="w-full bg-surface-card border border-surface-border rounded-xl px-3 py-2.5 text-sm text-ink focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/40 transition"
                >
                  {endSurahOptions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {tr("{id}. {englishName} ({ayahs} Ayahs)", { id: s.id, englishName: s.englishName, ayahs: s.ayahs })} · {s.name}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-ink-muted">
                  {tr("Ayah End above is now within")}{" "}{endSurahData?.englishName ?? tr("this surah")}.
                </p>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setSpansSurah(true)}
                className="text-[13px] font-semibold text-brand-navy dark:text-brand-gold hover:underline"
              >
                {tr("+ End in a different surah")}
              </button>
            ))}

          <div>
            <p className="text-sm font-semibold text-ink mb-2">{tr("This is for")}</p>
            <div className="grid grid-cols-3 gap-2">
              {(["today", "homework", "not_recited"] as const).map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => tapWhen(w)}
                  aria-pressed={forWhen === w || (w === "homework" && extras.some((x) => x.kind === "homework"))}
                  className={`rounded-2xl border px-3 py-2.5 text-center transition ${
                    forWhen === w || (w === "homework" && extras.some((x) => x.kind === "homework")) ? "bg-brand-navy text-white border-brand-navy" : "bg-surface-card text-ink border-surface-border hover:border-brand-navy/40"
                  }`}
                >
                  <span className="block text-[13px] font-semibold leading-tight">{w === "today" ? tr("Today's lesson") : w === "homework" ? tr("Homework") : DAILY_RATING_LABELS.not_recited}</span>
                  <span className="block text-[11px] leading-tight mt-0.5 opacity-70">{w === "today" ? tr("Done in class today") : w === "homework" ? tr("To do at home, by the due date") : tr("Set, but not recited today")}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-ink mb-2">
              {forWhen === "homework" ? tr("Due Date") : tr("Due Date (optional)")}
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => {
                setDueDate(e.target.value);
                setForWhen(e.target.value && e.target.value > todayStr ? "homework" : "today");
              }}
              className="w-full bg-surface-card border border-surface-border rounded-2xl px-4 py-3 text-ink focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/40 transition"
            />
          </div>

          {/* More work in the same save: homework, a recent revision, an old revision. */}
          <div className="space-y-3">
            {extras.map((x) => (
              <div key={x.kind} className="rounded-2xl border border-surface-border bg-surface-bg-warm p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-ink">
                    {x.kind === "homework" ? tr("Homework") : x.kind === "recent" ? tr("Recent revision") : tr("Old revision")}
                  </p>
                  <button type="button" onClick={() => setExtras((l) => l.filter((y) => y.kind !== x.kind))} className="text-[12.5px] font-semibold text-ink-muted hover:text-ink">
                    {tr("Remove")}
                  </button>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink mb-1.5">{tr("Surah *")}</label>
                  <SurahPicker value={x.surah} onChange={(id) => updateExtra(x.kind, { surah: id })} placeholder={tr("Choose…")} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-ink mb-1.5">{tr("Ayah Start *")}</label>
                    <input type="number" min={1} max={getSurahById(parseInt(x.surah) || 0)?.ayahs} value={x.start} onChange={(e) => updateExtra(x.kind, { start: e.target.value })} className="w-full bg-surface-card border border-surface-border rounded-xl px-3 py-2.5 text-[14px] text-ink focus:outline-none focus:border-emerald-600" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-ink mb-1.5">{tr("Ayah End *")}</label>
                    <input type="number" min={1} max={getSurahById(parseInt(x.surah) || 0)?.ayahs} value={x.end} onChange={(e) => updateExtra(x.kind, { end: e.target.value })} className="w-full bg-surface-card border border-surface-border rounded-xl px-3 py-2.5 text-[14px] text-ink focus:outline-none focus:border-emerald-600" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink mb-1.5">{tr("Due Date")} *</label>
                  <input type="date" min={todayStr} value={x.due} onChange={(e) => updateExtra(x.kind, { due: e.target.value })} className="w-full bg-surface-card border border-surface-border rounded-xl px-3 py-2.5 text-[14px] text-ink focus:outline-none focus:border-emerald-600" />
                </div>
              </div>
            ))}
            {EXTRA_KINDS.some((k) => !extras.some((x) => x.kind === k)) && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <span className="text-[12.5px] text-ink-muted">{tr("Also give:")}</span>
                {EXTRA_KINDS.filter((k) => !extras.some((x) => x.kind === k) && !(k === "homework" && forWhen === "homework")).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => addExtra(k)}
                    className="text-[13px] font-semibold text-brand-navy dark:text-brand-gold hover:underline"
                  >
                    {k === "homework" ? tr("+ Homework") : k === "recent" ? tr("+ Recent revision") : tr("+ Old revision")}
                  </button>
                ))}
              </div>
            )}
          </div>

          {!showNote && !notes ? (
            <button
              type="button"
              onClick={() => setShowNote(true)}
              className="text-[13px] font-semibold text-brand-navy dark:text-brand-gold hover:underline"
            >
              {tr("+ Add a note for the student")}
            </button>
          ) : (
          <div>
            <label className="block text-sm font-semibold text-ink mb-2">
              {tr("Notes for student (optional)")}
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={tr("Add any instructions or tips...")}
              rows={3}
              autoFocus={showNote && !notes}
              className="w-full bg-surface-card border border-surface-border rounded-2xl px-4 py-3 text-ink focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/40 transition resize-none"
            />
          </div>
          )}

          {error && (
            <div className="bg-red-50 dark:bg-red-950/25 border border-red-200 dark:border-red-800/40 rounded-2xl p-4">
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
          )}

          {success && isDemo && (
            <p className="text-[12px] text-ink-muted">{tr("Assignment added below — this preview saves in your browser only.")}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full gradient-emerald hover:opacity-90 disabled:opacity-50 text-white font-semibold py-3 rounded-2xl transition-all active:scale-95"
          >
            {loading ? tr("Creating...") : tr("Create Assignment")}
          </button>
        </form>

        {/* Mushaf preview panel. Opens itself as soon as the surah and ayah
            range are filled in, rather than waiting on a button: seeing the
            exact Tajweed-highlighted text being assigned is the point of
            setting it here rather than on paper, and a teacher shouldn't
            have to ask for it every time. It follows the fields live, so
            correcting an ayah number redraws it. */}
        <div className="lg:sticky lg:top-10 lg:self-start">
          {canPreview ? (
            <div className="card-quiet p-5 overflow-hidden">
              <h2 className="page-title text-lg">
                {spansSurah && endSurahData && endSurahData.id !== selectedSurahData?.id
                  ? `${selectedSurahData?.englishName ?? phrase("Preview")} – ${endSurahData.englishName}`
                  : previewBy === "page" && previewPage
                    ? tr("Page {page}", { page: previewPage })
                    : (selectedSurahData?.englishName ?? tr("Preview"))}
                {!(previewBy === "page" && !canHighlight) && selectedSurahData && (
                  <span className="ms-3 font-arabic text-ink-muted font-normal">
                    <bdi dir="rtl">
                      {selectedSurahData.name}
                      {spansSurah && endSurahData && endSurahData.id !== selectedSurahData.id ? ` – ${endSurahData.name}` : ""}
                    </bdi>
                  </span>
                )}
              </h2>
              <div className="gold-rule my-4" />
              <Mushaf
                // Open on the page the lesson starts on, and move there
                // again when the starting ayah changes. Mushaf only reads
                // initialPage when it mounts, so the key remounts it; the
                // end ayah only redraws the highlight, which needs no jump.
                key={`p${previewPage}`}
                initialPage={previewPage ?? 1}
                highlightedRange={
                  canHighlight
                    ? {
                        surah: parseInt(selectedSurah),
                        start: parseInt(ayahStart),
                        surahEnd: effectiveEndSurahId,
                        end: parseInt(ayahEnd),
                      }
                    : undefined
                }
              />
            </div>
          ) : (
            <div className="card-quiet card-feature p-8 text-center">
              <span className="mx-auto mb-4 inline-flex">
                <ColorTile name="rehal" size={48} />
              </span>
              <h3 className="page-title text-lg mb-2">{tr("Mushaf preview")}</h3>
              <p className="text-[13px] text-ink-muted leading-relaxed max-w-xs mx-auto">
                {tr("Pick a surah and an ayah range — the Tajweed-highlighted text your student will study appears here as you go.")}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* What has already been set. Sample data until the school has its own
          records; the create form above writes real ones once a teacher is
          properly signed in, and adds a browser-local preview row otherwise. */}
      <SectionCard
        title={tr("Current assignments")}
        note={tr("{count} across all students · tap to grade", { count: allAssignments.length })}
      >
        {loadError && (
          <p className="text-xs font-semibold text-red-700 dark:text-red-400 py-2">{loadError}</p>
        )}
        {!loadError && allAssignments.length === 0 && (
          <EmptyNote>{tr("No assignments yet — set the first one above.")}</EmptyNote>
        )}
        {groupNames.length > 1 && (
          <div role="group" aria-label={tr("Show")} className="flex flex-wrap gap-1.5 mb-3">
            {[{ key: "", label: tr("All"), count: allAssignments.length }, ...groupNames.map((g) => ({
              key: g,
              label: g === NO_PLACE ? tr("Other students") : g,
              count: allAssignments.filter((a) => (placeOf[a.student_id] ?? NO_PLACE) === g).length,
            }))].map((chip) => (
              <button
                key={chip.key || "all"}
                type="button"
                onClick={() => setListGroup(chip.key)}
                aria-pressed={listGroup === chip.key}
                className={`rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                  listGroup === chip.key ? "bg-brand-navy text-white border-brand-navy" : "bg-surface-card text-ink border-surface-border hover:border-brand-navy/40"
                }`}
              >
                {chip.label} <span className="opacity-70 tabular-nums">{chip.count}</span>
              </button>
            ))}
          </div>
        )}
        {groups.map((group) => (
        <div key={group.name} className="mb-4 last:mb-0">
          {groupNames.length > 1 && (
            <p className="eyebrow px-1 pb-1.5">
              {group.name === NO_PLACE ? tr("Other students") : group.name} · {group.items.length}
            </p>
          )}
        <ul className="divide-y divide-surface-border -my-1">
          {studentsOf(group.items).map((st) => (
            <li key={st.id}>
              <button
                type="button"
                onClick={() => setOpenStudent(openStudent === st.id ? null : st.id)}
                aria-expanded={openStudent === st.id}
                className={`w-full flex items-center gap-3 py-3 text-start rounded-xl -mx-2 px-2 transition-colors ${openStudent === st.id ? OPEN_ROW : "hover:bg-surface-bg-warm"}`}
              >
                <span className="w-9 h-9 rounded-xl bg-brand-navy/10 text-brand-navy dark:text-brand-gold flex items-center justify-center font-bold text-[11px] flex-shrink-0">
                  {initials(st.name)}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-semibold [overflow-wrap:anywhere]">{st.name}</p>
                  <p className={`text-[11.5px] ${openStudent === st.id ? "text-white/80" : "text-ink-muted"}`}>
                    {tr("{count} piece of work|{count} pieces of work", { count: st.items.length })}
                    {st.items.some((x) => x.daily_rating === "not_recited") ? ` · ${DAILY_RATING_LABELS.not_recited}` : ""}
                  </p>
                </div>
                <RowChevron open={openStudent === st.id} />
              </button>
              {openStudent === st.id && (
          <ul className="ms-3 border-s border-surface-border ps-3 divide-y divide-surface-border">
          {st.items.map((a) => {
            const surah = getSurahById(a.surah);
            const surahEnd = a.surah_end !== a.surah ? getSurahById(a.surah_end) : null;
            const name = studentName(a.student_id, roster);
            const isOpen = editingId === a.id;

            const rangeLabel = surahEnd
              ? `${surah?.englishName ?? `Surah ${a.surah}`} ${a.ayah_start} – ${surahEnd.englishName} ${a.ayah_end}`
              : a.ayah_start === a.ayah_end
                ? `${surah?.englishName ?? `Surah ${a.surah}`} · ayah ${a.ayah_start}`
                : `${surah?.englishName ?? `Surah ${a.surah}`} · ayahs ${a.ayah_start}–${a.ayah_end}`;

            return (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => startEditing(a)}
                  aria-expanded={isOpen}
                  className={`group w-full flex items-center gap-3 py-3 text-start rounded-xl -mx-2 px-2 transition-colors ${isOpen ? OPEN_ROW : "hover:bg-surface-bg-warm"}`}
                >
                  <span className="w-9 h-9 rounded-xl bg-brand-navy/10 text-brand-navy dark:text-brand-gold flex items-center justify-center font-bold text-[11px] flex-shrink-0">
                    {initials(name)}
                  </span>

                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-ink [overflow-wrap:anywhere]">
                      {name}
                      {" · "}
                      <span className="underline decoration-2 underline-offset-2">
                        {PORTION_LABELS[a.portion]}
                      </span>
                      {(() => {
                        const w = whenOf(a);
                        return w ? (
                          <span className={`ms-2 align-middle text-[10px] font-semibold px-2 py-0.5 rounded-full ${isOpen ? "bg-white/20 text-white" : w.tone}`}>{w.text}</span>
                        ) : null;
                      })()}
                      {a.daily_rating === "not_recited" && (
                        <span className={`ms-2 align-middle text-[10px] font-semibold px-2 py-0.5 rounded-full ${isOpen ? "bg-white/20 text-white" : DAILY_RATING_STYLES.not_recited}`}>
                          {DAILY_RATING_LABELS.not_recited}
                        </span>
                      )}
                    </p>
                    <p className="text-[11px] text-ink-muted [overflow-wrap:anywhere]">
                      {rangeLabel}
                      {surah && (
                        <span className="mx-1 font-arabic text-[14px] text-ink">
                          · <bdi dir="rtl">{surah.name}{surahEnd ? ` – ${surahEnd.name}` : ""}</bdi>
                        </span>
                      )}
                      {a.due_date ? tr(" · due {formatDay}", { formatDay: formatDay(a.due_date, language) }) : ""}
                    </p>
                    {/* On the narrowest phones the rating sits under the
                        details, leaving them the row's width. */}
                    {a.daily_rating && (
                      <span className="inline-block mt-1 min-[400px]:hidden">
                        <RatingPill rating={a.daily_rating} />
                      </span>
                    )}
                  </div>

                  {a.daily_rating ? (
                    <span className="hidden min-[400px]:inline-flex flex-shrink-0">
                      <RatingPill rating={a.daily_rating} />
                    </span>
                  ) : (
                    <div className="w-16 flex-shrink-0 hidden sm:block">
                      <ProgressBar value={a.memorization_level} />
                      <p className="text-[10px] text-ink-muted text-end mt-1 tabular-nums">
                        {a.memorization_level}%
                      </p>
                    </div>
                  )}

                  <span
                    className={`text-[10px] font-semibold px-2 py-1 rounded-full flex-shrink-0 whitespace-nowrap hidden sm:inline-block ${ASSIGNMENT_STYLES[a.status]}`}
                  >
                    {ASSIGNMENT_LABELS[a.status]}
                  </span>

                  <RowChevron open={isOpen} />
                </button>

                {!isOpen && a.daily_rating !== "not_recited" && (
                  <div className="pb-2 ps-12">
                    <button
                      type="button"
                      onClick={() => saveEdit(a, "not_recited")}
                      disabled={savingEdit}
                      className="text-[12px] font-semibold px-2.5 py-1 rounded-full border border-surface-border bg-surface-card text-ink-muted hover:text-ink hover:border-slate-400 disabled:opacity-50"
                    >
                      {DAILY_RATING_LABELS.not_recited}
                    </button>
                  </div>
                )}
                {isOpen && (
                  <div className="mb-3 rounded-2xl border border-surface-border bg-surface-bg-warm p-4 space-y-3">
                    <div>
                      <p className="text-xs font-semibold text-ink mb-2">
                        {tr("Today's rating")}
                      </p>
                      <div className="grid grid-cols-2 min-[420px]:grid-cols-3 gap-1.5">
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
                        {tr("Remark for the parent")}
                      </label>
                      <textarea
                        value={draftNotes}
                        onChange={(e) => setDraftNotes(e.target.value)}
                        rows={3}
                        placeholder={tr("e.g. Held the madd well today, keep it up.")}
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
                        {savingEdit ? tr("Saving…") : tr("Save")}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="text-[13px] font-semibold text-ink-muted hover:text-ink px-3 transition-colors"
                      >
                        {tr("Cancel")}
                      </button>
                    </div>

                    <div className="pt-1">
                      <p className="text-xs font-semibold text-ink mb-2">
                        {tr("{value}'s history", { value: name.split(" ")[0] })}
                      </p>
                      <RecitationHistory entries={recitationLogFor(a.student_id, log)} />
                    </div>
                  </div>
                )}
              </li>
            );
          })}
          </ul>
              )}
            </li>
          ))}
        </ul>
        </div>
        ))}
      </SectionCard>

      {/* What was just saved, with a way to take it back. Sits above the
          phone tab bar; gone by itself after a few seconds. */}
      {saved && (
        <div
          role="status"
          className="fixed z-40 inset-x-4 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] md:bottom-6 md:min-w-[380px] max-w-xl flex items-center gap-3 rounded-2xl bg-[#14213d] text-white shadow-xl px-4 py-3"
        >
          <span aria-hidden className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7" /></svg>
          </span>
          <p className="text-[13.5px] min-w-0 flex-1 [overflow-wrap:anywhere]">
            <span className="font-semibold">{tr("Saved:")}</span> {saved.text}
          </p>
          {saved.undoable && saved.ids.length > 0 && (
            <button
              type="button"
              onClick={undoSaved}
              disabled={undoing}
              className="flex-shrink-0 text-[13px] font-bold text-brand-gold hover:text-white px-2 py-1 rounded-lg disabled:opacity-50"
            >
              {undoing ? tr("Undoing…") : tr("Undo")}
            </button>
          )}
          <button type="button" onClick={() => setSaved(null)} aria-label={tr("Close")} className="flex-shrink-0 text-white/60 hover:text-white px-1">
            ×
          </button>
        </div>
      )}
    </div>
  );
}

function isGradeNum(g: number | null | undefined): g is number {
  return typeof g === "number";
}
