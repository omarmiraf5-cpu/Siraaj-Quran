"use client";

import { useEffect, useState } from "react";
import {
  DEMO_CREATED_STUDENTS_KEY,
  DEMO_STUDENT_OVERRIDES_KEY,
  DEMO_CREATED_HALAQAS_KEY,
  DEMO_HALAQA_OVERRIDES_KEY,
  allStudents,
  allHalaqas,
  initials,
  type StudentOverride,
  type HalaqaOverride,
} from "@/data/demo";
import type { DemoStudent, DemoHalaqa } from "@/data/demo";
import { PortalHero } from "@/components/PortalHero";
import { SectionCard, EmptyNote, LoadingNote } from "@/components/portal-ui";
import { IconArrow } from "@/components/icons";
import StudentImport from "@/components/StudentImport";
import WeeklyReportsCard from "@/components/WeeklyReportsCard";
import { readDemoStore, writeDemoStore } from "@/lib/demoStore";
import { createClient } from "@/lib/supabase/client";
import { GRADES, gradeLabel } from "@/lib/grades";
import { loadSchoolShape, type Campus } from "@/lib/schoolStructure";

const bigField =
  "w-full bg-surface-card border border-surface-border rounded-2xl px-4 py-3 text-ink focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/40 transition";
const smallField =
  "w-full bg-surface-card border border-surface-border rounded-xl px-3 py-2.5 text-sm text-ink focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/40 transition";

export default function AdminStudentsPage() {
  const supabase = createClient();
  const [isDemo, setIsDemo] = useState(false);
  // The code students type in the app (the school's slug), and whether the
  // sign-in link was just copied.
  const [schoolSlug, setSchoolSlug] = useState<string | null>(null);
  const [schoolName, setSchoolName] = useState("");
  const [copied, setCopied] = useState(false);
  // Permanent deletion: which student's confirm box is open, what's been
  // typed into it, and any error from the attempt.
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteText, setDeleteText] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [schoolId, setSchoolId] = useState<string | null>(null);
  // An academic school keeps its students in grades, and may have campuses.
  const [graded, setGraded] = useState(false);
  const [campuses, setCampuses] = useState<Campus[]>([]);

  const [students, setStudents] = useState<DemoStudent[]>([]);
  const [halaqas, setHalaqas] = useState<DemoHalaqa[]>([]);
  const [created, setCreated] = useState<DemoStudent[]>([]);
  const [overrides, setOverrides] = useState<Record<string, StudentOverride>>({});

  const [search, setSearch] = useState("");
  const [gradeFilter, setGradeFilter] = useState("");
  const [campusFilter, setCampusFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [newName, setNewName] = useState("");
  // A halaqa by its id; in the sample school, by its name.
  const [newHalaqa, setNewHalaqa] = useState("");
  const [newGrade, setNewGrade] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftHalaqa, setDraftHalaqa] = useState("");
  const [draftGrade, setDraftGrade] = useState("");
  const [draftActive, setDraftActive] = useState(true);
  const [draftReport, setDraftReport] = useState(true);
  // Whether the weekly reports update has been run, so each child has a switch.
  const [reportsReady, setReportsReady] = useState(false);
  const [gradeBusy, setGradeBusy] = useState<number | null>(null);
  const [draftPin, setDraftPin] = useState("");
  const [pinSaving, setPinSaving] = useState(false);
  const [pinNote, setPinNote] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);

  const loadRealHalaqas = async (): Promise<DemoHalaqa[]> => {
    const first = await supabase.from("classes").select("id, name, teacher_id, schedule, grade, campus_id").order("name");
    // Before the grades update, there's no campus to ask for.
    const { data } = first.error
      ? await supabase.from("classes").select("id, name, teacher_id, schedule, grade").order("name")
      : first;
    return ((data ?? []) as Array<{ id: string; name: string; teacher_id: string | null; schedule: string | null; grade: number; campus_id?: string | null }>).map((c) => ({
      id: c.id,
      name: c.name,
      teacherId: c.teacher_id,
      schedule: c.schedule ?? "",
      grade: c.grade,
      campusId: c.campus_id ?? null,
    }));
  };

  // A student's halaqa is a separate enrollment row in the real schema
  // (many-to-many), unlike the demo model's plain name field — this folds
  // it back down to one halaqa per student, by id as well as name, since a
  // name can repeat across an academic school's grades and campuses.
  const loadRealStudents = async () => {
    const first = await supabase.from("students").select("id, full_name, active, grade, weekly_report").order("full_name");
    setReportsReady(!first.error);
    const { data: studentRows } = first.error
      ? await supabase.from("students").select("id, full_name, active, grade").order("full_name")
      : first;
    const { data: enrollments } = await supabase
      .from("class_enrollments")
      .select("student_id, class_id, classes(name)");
    const halaqaByStudent = new Map<string, { id: string; name: string }>();
    for (const e of enrollments ?? []) {
      const className = (e as unknown as { classes: { name: string } | null }).classes?.name;
      if (className) halaqaByStudent.set(e.student_id, { id: e.class_id, name: className });
    }
    setStudents(
      ((studentRows ?? []) as Array<{ id: string; full_name: string; active: boolean; grade: number; weekly_report?: boolean }>).map((s) => ({
        id: s.id,
        name: s.full_name,
        halaqa: halaqaByStudent.get(s.id)?.name ?? "",
        halaqaId: halaqaByStudent.get(s.id)?.id,
        grade: s.grade,
        active: s.active,
        weeklyReport: s.weekly_report !== false,
      }))
    );
  };

  useEffect(() => {
    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setIsDemo(true);
        const c = readDemoStore<DemoStudent[]>(DEMO_CREATED_STUDENTS_KEY, []);
        const o = readDemoStore<Record<string, StudentOverride>>(DEMO_STUDENT_OVERRIDES_KEY, {});
        setCreated(c);
        setOverrides(o);
        setStudents(allStudents(c, o));
        setHalaqas(
          allHalaqas(
            readDemoStore(DEMO_CREATED_HALAQAS_KEY, []),
            readDemoStore<Record<string, HalaqaOverride>>(DEMO_HALAQA_OVERRIDES_KEY, {})
          )
        );
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("school_id")
        .eq("id", user.id)
        .single();
      setSchoolId(profile?.school_id ?? null);
      if (profile?.school_id) {
        supabase
          .from("schools")
          .select("slug, name")
          .eq("id", profile.school_id)
          .single()
          .then(({ data }) => {
            setSchoolSlug(data?.slug ?? null);
            setSchoolName(data?.name ?? "");
          });
      }
      await Promise.all([
        loadSchoolShape(supabase, profile?.school_id ?? null).then((shape) => {
          setGraded(shape.graded);
          setCampuses(shape.campuses);
        }),
        loadRealStudents(),
        loadRealHalaqas().then(setHalaqas),
      ]);
    };
    load().finally(() => setReady(true));
  }, []);

  const campusName = (id: string | null | undefined) => campuses.find((c) => c.id === id)?.name;
  const halaqaById = (id: string) => halaqas.find((h) => h.id === id);
  // A halaqa as it reads in a grade's list: "North · Halaqa A".
  const halaqaInGrade = (h: DemoHalaqa) => [campusName(h.campusId), h.name].filter(Boolean).join(" · ");
  // The halaqas a student of this grade can be in: campus by campus.
  const halaqasFor = (grade: string) =>
    graded
      ? grade === ""
        ? []
        : halaqas
            .filter((h) => (h.grade ?? 0) === Number(grade))
            .sort((a, b) => (campusName(a.campusId) ?? "").localeCompare(campusName(b.campusId) ?? "") || a.name.localeCompare(b.name))
      : halaqas;
  const studentHalaqa = (s: DemoStudent) =>
    isDemo ? halaqas.find((h) => h.name === s.halaqa) : s.halaqaId ? halaqaById(s.halaqaId) : undefined;

  const addStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || (graded ? newGrade === "" : !newHalaqa)) return;

    if (isDemo) {
      const student: DemoStudent = {
        id: `local-student-${Date.now()}`,
        name: newName.trim(),
        halaqa: halaqaById(newHalaqa)?.name ?? "",
      };
      const next = [...created, student];
      setCreated(next);
      writeDemoStore(DEMO_CREATED_STUDENTS_KEY, next);
      setStudents(allStudents(next, overrides));
      setNewName("");
      setNewHalaqa("");
      setShowForm(false);
      return;
    }

    if (!schoolId) {
      setFormError("Your account isn't linked to a school yet — contact support.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const name = newName.trim();
      const { data: student, error: studentError } = await supabase
        .from("students")
        .insert({
          full_name: name,
          grade: graded ? Number(newGrade) : 0,
          avatar_initials: initials(name),
          school_id: schoolId,
        })
        .select("id")
        .single();
      if (studentError) throw studentError;

      if (newHalaqa) {
        const { error: enrollError } = await supabase
          .from("class_enrollments")
          .insert({ class_id: newHalaqa, student_id: student.id });
        if (enrollError) throw enrollError;
      }

      await loadRealStudents();
      setNewName("");
      setNewHalaqa("");
      setShowForm(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to add student");
    } finally {
      setSaving(false);
    }
  };

  const startEditing = (s: DemoStudent) => {
    setEditingId(s.id === editingId ? null : s.id);
    setDraftName(s.name);
    setDraftHalaqa(studentHalaqa(s)?.id ?? "");
    setDraftGrade(String(s.grade ?? 0));
    setDraftActive(s.active !== false);
    setDraftReport(s.weeklyReport !== false);
    setDraftPin("");
    setPinNote(null);
    setEditError(null);
  };

  const savePin = async (s: DemoStudent) => {
    setPinSaving(true);
    setPinNote(null);
    try {
      const res = await fetch("/api/admin/student-pin", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ student_id: s.id, pin: draftPin }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error([data.error, data.debug].filter(Boolean).join(" — ") || "Failed to set PIN");
      setPinNote(`PIN set. ${s.name.split(" ")[0]} can sign in with ${draftPin}.`);
    } catch (err) {
      setPinNote(err instanceof Error ? err.message : "Failed to set PIN");
    } finally {
      setPinSaving(false);
    }
  };

  const saveEdit = async (s: DemoStudent) => {
    if (isDemo) {
      const patch: StudentOverride = {
        name: draftName.trim() || s.name,
        halaqa: halaqaById(draftHalaqa)?.name ?? s.halaqa,
        active: draftActive,
      };
      const next = { ...overrides, [s.id]: { ...overrides[s.id], ...patch } };
      setOverrides(next);
      writeDemoStore(DEMO_STUDENT_OVERRIDES_KEY, next);
      setStudents(allStudents(created, next));
      setEditingId(null);
      return;
    }

    setEditError(null);
    try {
      const { error } = await supabase
        .from("students")
        .update({
          full_name: draftName.trim() || s.name,
          active: draftActive,
          ...(graded ? { grade: Number(draftGrade) } : {}),
          ...(reportsReady ? { weekly_report: draftReport } : {}),
        })
        .eq("id", s.id);
      if (error) throw error;

      if (draftHalaqa !== (s.halaqaId ?? "")) {
        await supabase.from("class_enrollments").delete().eq("student_id", s.id);
        if (draftHalaqa) {
          const { error: enrollError } = await supabase
            .from("class_enrollments")
            .insert({ class_id: draftHalaqa, student_id: s.id });
          if (enrollError) throw enrollError;
        }
      }

      await loadRealStudents();
      setEditingId(null);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "That didn't save. Please try again.");
    }
  };

  const deleteStudent = async (s: DemoStudent) => {
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/admin/students/${encodeURIComponent(s.id)}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Couldn't delete the student");
      setDeletingId(null);
      setEditingId(null);
      await loadRealStudents();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Couldn't delete the student");
    } finally {
      setDeleteBusy(false);
    }
  };

  const filtered = students.filter(
    (s) =>
      s.name.toLowerCase().includes(search.trim().toLowerCase()) &&
      (!graded || gradeFilter === "" || (s.grade ?? 0) === Number(gradeFilter)) &&
      (campusFilter === "" || (campusFilter === "none" ? !studentHalaqa(s)?.campusId : studentHalaqa(s)?.campusId === campusFilter))
  );
  const activeCount = students.filter((s) => s.active !== false).length;
  // An academic school's students, by grade.
  const byGrade = graded
    ? GRADES.map((g) => ({ grade: g, students: filtered.filter((s) => (s.grade ?? 0) === g) })).filter((x) => x.students.length > 0)
    : null;

  // A whole grade's weekly reports, on or off at once — both campuses.
  const gradeAllOn = (grade: number) => students.filter((s) => (s.grade ?? 0) === grade).every((s) => s.weeklyReport !== false);
  const setGradeReports = async (grade: number, on: boolean) => {
    if (!schoolId) return;
    setGradeBusy(grade);
    const { error } = await supabase.from("students").update({ weekly_report: on }).eq("school_id", schoolId).eq("grade", grade);
    if (error) window.alert(error.message);
    await loadRealStudents();
    setGradeBusy(null);
  };

  const halaqaOptions = (grade: string) =>
    halaqasFor(grade).map((h) => (
      <option key={h.id} value={h.id}>
        {graded ? halaqaInGrade(h) : h.name}
      </option>
    ));

  const renderStudent = (s: DemoStudent) => {
    const isOpen = editingId === s.id;
    const inactive = s.active === false;
    const halaqa = studentHalaqa(s);
    return (
      <li key={s.id}>
        <button
          type="button"
          onClick={() => startEditing(s)}
          aria-expanded={isOpen}
          className="w-full flex items-center gap-3 py-3 text-start hover:bg-surface-bg-warm rounded-xl -mx-2 px-2 transition-colors"
        >
          <span
            className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-[11px] flex-shrink-0 ${
              inactive
                ? "bg-slate-100 dark:bg-slate-800/40 text-slate-500"
                : "bg-brand-navy/10 text-brand-navy dark:text-brand-gold"
            }`}
          >
            {initials(s.name)}
          </span>
          <div className="flex-1 min-w-0">
            <p className={`text-[13px] font-semibold truncate ${inactive ? "text-ink-muted" : "text-ink"}`}>
              {s.name}
            </p>
            <p className="text-[11px] text-ink-muted truncate">
              {graded ? (halaqa ? halaqaInGrade(halaqa) : "No halaqa yet") : s.halaqa}
            </p>
          </div>
          {!isDemo && reportsReady && s.weeklyReport === false && !inactive && (
            <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-800/40 text-slate-600 dark:text-slate-300 flex-shrink-0">
              No weekly report
            </span>
          )}
          {inactive && (
            <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-800/40 text-slate-600 dark:text-slate-300 flex-shrink-0">
              Inactive
            </span>
          )}
          <span className={`text-ink-muted transition-transform flex-shrink-0 ${isOpen ? "rotate-90" : ""}`}>
            <IconArrow size={14} />
          </span>
        </button>

        {isOpen && (
          <div className="mb-3 rounded-2xl border border-surface-border bg-surface-bg-warm p-4 space-y-3">
            <div>
              <label className="block text-xs font-semibold text-ink mb-1.5">Full name</label>
              <input value={draftName} onChange={(e) => setDraftName(e.target.value)} className={smallField} />
            </div>
            <div className={graded ? "grid grid-cols-2 gap-3" : ""}>
              {graded && (
                <label className="block">
                  <span className="block text-xs font-semibold text-ink mb-1.5">Grade</span>
                  <select
                    value={draftGrade}
                    onChange={(e) => {
                      setDraftGrade(e.target.value);
                      // A halaqa is in one grade: a new grade starts from none.
                      if (halaqaById(draftHalaqa)?.grade !== Number(e.target.value)) setDraftHalaqa("");
                    }}
                    className={smallField}
                  >
                    {GRADES.map((g) => (
                      <option key={g} value={g}>
                        {gradeLabel(g)}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label className="block">
                <span className="block text-xs font-semibold text-ink mb-1.5">Halaqa</span>
                <select value={draftHalaqa} onChange={(e) => setDraftHalaqa(e.target.value)} className={smallField}>
                  {(graded || !draftHalaqa) && <option value="">{graded ? "No halaqa yet" : "Select a halaqa"}</option>}
                  {halaqaOptions(draftGrade)}
                </select>
              </label>
            </div>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={draftActive}
                onChange={(e) => setDraftActive(e.target.checked)}
                className="w-4 h-4 rounded"
              />
              Active
            </label>
            {!isDemo && reportsReady && (
              <label className="flex items-start gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={draftReport}
                  onChange={(e) => setDraftReport(e.target.checked)}
                  className="w-4 h-4 rounded mt-0.5"
                />
                <span>
                  Weekly progress report
                  <span className="block text-[11px] text-ink-muted">
                    Their parents get one on Fridays when they&apos;ve had lessons that week. Untick to leave them out.
                  </span>
                </span>
              </label>
            )}

            {/* A child signs in with four digits rather than an
                email, so the PIN is set here and read back to
                whoever forgets it. */}
            {!isDemo && (
              <div>
                <label className="block text-xs font-semibold text-ink mb-1.5">Sign-in PIN</label>
                <div className="flex items-center gap-2">
                  <input
                    inputMode="numeric"
                    maxLength={4}
                    value={draftPin}
                    onChange={(e) => setDraftPin(e.target.value.replace(/\D/g, ""))}
                    placeholder="4 digits"
                    className="flex-1 bg-surface-card border border-surface-border rounded-xl px-3 py-2.5 text-sm text-ink tracking-[0.4em] focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/40 transition"
                  />
                  <button
                    type="button"
                    onClick={() => savePin(s)}
                    disabled={draftPin.length !== 4 || pinSaving}
                    className="text-[13px] font-semibold text-ink-muted hover:text-ink px-3 disabled:opacity-40 transition-colors"
                  >
                    {pinSaving ? "Saving…" : "Set PIN"}
                  </button>
                </div>
                {pinNote && <p className="text-[11px] text-ink-muted mt-1">{pinNote}</p>}
              </div>
            )}
            {editError && <p className="text-[11.5px] text-red-700 dark:text-red-300">{editError}</p>}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => saveEdit(s)}
                className="flex-1 gradient-emerald text-white text-sm font-semibold py-2.5 rounded-xl hover:opacity-90 active:scale-[.98] transition-all"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setEditingId(null)}
                className="text-[13px] font-semibold text-ink-muted hover:text-ink px-3 transition-colors"
              >
                Cancel
              </button>
            </div>

            {/* Deactivating (above) can be undone. This can't: it
                is for a family that has left and asked for the
                child's data to be removed, or a child's own
                request from their Account page. */}
            {!isDemo && (
              <div className="border-t border-surface-border pt-3">
                {deletingId !== s.id ? (
                  <button
                    type="button"
                    onClick={() => { setDeletingId(s.id); setDeleteText(""); setDeleteError(null); }}
                    className="text-[12px] font-semibold text-red-700 dark:text-red-300 hover:underline"
                  >
                    Delete permanently…
                  </button>
                ) : (
                  <div className="space-y-2">
                    <p className="text-[12px] text-ink leading-relaxed">
                      This deletes {s.name.split(" ")[0]}&apos;s record, attendance, lessons, plans, messages and
                      sign-in for good. To keep their history, untick Active instead. Type{" "}
                      <span className="font-semibold">{s.name}</span> to confirm.
                    </p>
                    <input
                      value={deleteText}
                      onChange={(e) => setDeleteText(e.target.value)}
                      placeholder={s.name}
                      className="w-full bg-surface-card border border-red-300 dark:border-red-800/60 rounded-xl px-3 py-2 text-sm text-ink focus:outline-none"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => deleteStudent(s)}
                        disabled={deleteBusy || deleteText.trim().toLowerCase() !== s.name.trim().toLowerCase()}
                        className="bg-red-700 text-white text-[12.5px] font-semibold px-3.5 py-2 rounded-xl disabled:opacity-40"
                      >
                        {deleteBusy ? "Deleting…" : "Delete permanently"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingId(null)}
                        className="text-[12.5px] font-semibold text-ink-muted hover:text-ink px-2"
                      >
                        Keep
                      </button>
                    </div>
                    {deleteError && <p className="text-[11.5px] text-red-700 dark:text-red-300">{deleteError}</p>}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </li>
    );
  };

  return (
    <div className="max-w-5xl mx-auto pb-20 space-y-4 pt-2">
      <PortalHero
        eyebrow="Roster"
        title="Students"
        meta={[`${students.length} total`, `${activeCount} active`, `${halaqas.length} halaqas`]}
      />

      {schoolSlug && (
        <div className="card-quiet p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="eyebrow">Student sign-in</p>
            <p className="text-[13px] text-ink mt-1">
              School code: <span className="font-mono font-semibold">{schoolSlug}</span>
            </p>
            <p className="text-[11.5px] text-ink-muted mt-0.5 leading-relaxed">
              Students type this code once in the MyDiiwaan app, or open the sign-in link. Then they tap
              their name and enter their PIN.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              const link = `${window.location.origin}/login?school=${schoolSlug}`;
              navigator.clipboard?.writeText(link).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }).catch(() => {});
            }}
            className="flex-shrink-0 bg-surface-card border border-surface-border text-ink text-[12.5px] font-semibold px-3.5 py-2 rounded-xl hover:border-brand-navy/40 transition"
          >
            {copied ? "Copied" : "Copy sign-in link"}
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search students…"
          className="flex-1 min-w-[180px] bg-surface-card border border-surface-border rounded-2xl px-4 py-2.5 text-sm text-ink focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/40 transition"
        />
        {!isDemo && (
          <button
            type="button"
            onClick={() => { setShowImport((v) => !v); setShowForm(false); }}
            aria-expanded={showImport}
            className="flex-shrink-0 bg-surface-card border border-surface-border text-ink text-sm font-semibold px-4 py-2.5 rounded-2xl hover:border-brand-navy/40 transition"
          >
            Import from a spreadsheet
          </button>
        )}
        <button
          type="button"
          onClick={() => { setShowForm((v) => !v); setShowImport(false); }}
          className="flex-shrink-0 gradient-emerald text-white text-sm font-semibold px-4 py-2.5 rounded-2xl hover:opacity-90 active:scale-[.98] transition-all"
        >
          {showForm ? "Cancel" : "+ Add student"}
        </button>
      </div>

      {graded && (
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={gradeFilter}
            onChange={(e) => setGradeFilter(e.target.value)}
            aria-label="Grade"
            className="bg-surface-card border border-surface-border rounded-xl px-3 py-2 text-[13px] text-ink"
          >
            <option value="">Every grade</option>
            {GRADES.map((g) => (
              <option key={g} value={g}>
                {gradeLabel(g)}
              </option>
            ))}
          </select>
          {campuses.length > 0 && (
            <select
              value={campusFilter}
              onChange={(e) => setCampusFilter(e.target.value)}
              aria-label="Campus"
              className="bg-surface-card border border-surface-border rounded-xl px-3 py-2 text-[13px] text-ink"
            >
              <option value="">Both campuses</option>
              {campuses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
              <option value="none">No halaqa yet</option>
            </select>
          )}
        </div>
      )}

      {!isDemo && schoolId && <WeeklyReportsCard schoolId={schoolId} graded={graded} />}

      {showImport && (
        <StudentImport
          graded={graded}
          campuses={campuses}
          halaqas={halaqas}
          schoolName={schoolName}
          onDone={() => {
            loadRealStudents();
            loadRealHalaqas().then(setHalaqas);
            loadSchoolShape(supabase, schoolId).then((shape) => setCampuses(shape.campuses));
          }}
          onClose={() => setShowImport(false)}
        />
      )}

      {showForm && (
        <form onSubmit={addStudent} className="card-quiet p-5 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-ink mb-2">Full name *</label>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Zainab Ali"
              className={bigField}
            />
          </div>
          <div className={graded ? "grid grid-cols-2 gap-3" : ""}>
            {graded && (
              <label className="block">
                <span className="block text-sm font-semibold text-ink mb-2">Grade *</span>
                <select
                  value={newGrade}
                  onChange={(e) => {
                    setNewGrade(e.target.value);
                    setNewHalaqa("");
                  }}
                  className={bigField}
                >
                  <option value="">Choose…</option>
                  {GRADES.map((g) => (
                    <option key={g} value={g}>
                      {gradeLabel(g)}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="block">
              <span className="block text-sm font-semibold text-ink mb-2">Halaqa {graded ? "" : "*"}</span>
              <select
                value={newHalaqa}
                onChange={(e) => setNewHalaqa(e.target.value)}
                disabled={graded && newGrade === ""}
                className={`${bigField} disabled:opacity-50`}
              >
                <option value="">{graded ? (newGrade === "" ? "Choose the grade first" : "Not yet") : "Select a halaqa"}</option>
                {halaqaOptions(newGrade)}
              </select>
            </label>
          </div>
          {formError && <p className="text-xs text-red-600 dark:text-red-400">{formError}</p>}
          <button
            type="submit"
            disabled={!newName.trim() || (graded ? newGrade === "" : !newHalaqa) || saving}
            className="w-full gradient-emerald text-white font-semibold py-3 rounded-2xl disabled:opacity-40 hover:opacity-90 active:scale-95 transition-all"
          >
            {saving ? "Adding…" : "Add student"}
          </button>
        </form>
      )}

      {!ready ? (
        <SectionCard title="All students">
          <LoadingNote />
        </SectionCard>
      ) : filtered.length === 0 ? (
        <SectionCard title="All students" note="0 shown">
          <EmptyNote>{students.length === 0 ? "No students yet." : "No students match that search."}</EmptyNote>
        </SectionCard>
      ) : byGrade ? (
        byGrade.map(({ grade, students: inGrade }) => (
          <SectionCard
            key={grade}
            title={gradeLabel(grade)}
            note={
              <>
                {inGrade.length} student{inGrade.length === 1 ? "" : "s"}
                {reportsReady && (
                  <>
                    {" · "}
                    <button
                      type="button"
                      onClick={() => setGradeReports(grade, !gradeAllOn(grade))}
                      disabled={gradeBusy !== null}
                      className="underline underline-offset-2 hover:text-ink disabled:opacity-50"
                    >
                      {gradeBusy === grade ? "Saving…" : gradeAllOn(grade) ? "Weekly reports off for this grade" : "Weekly reports on for this grade"}
                    </button>
                  </>
                )}
              </>
            }
          >
            <ul className="divide-y divide-surface-border -my-1">{inGrade.map(renderStudent)}</ul>
          </SectionCard>
        ))
      ) : (
        <SectionCard title="All students" note={`${filtered.length} shown`}>
          <ul className="divide-y divide-surface-border -my-1">{filtered.map(renderStudent)}</ul>
        </SectionCard>
      )}
    </div>
  );
}
